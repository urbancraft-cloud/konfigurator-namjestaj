// src/engine/surfaces.js

import { WALLS, WORKTOP, WALLPANEL, SOCLE, TOPMASK, LEDMASK, ENDPANEL, CORNER_WALL, CORPUS_BASE_H } from '../data/tech';
import { templateById } from '../data/catalog';
import {
  bandRect, spanRect, rectOverlap, perpendicular, wallLength,
  overlaps, elementAABB, wallTopOf, wallElevationOf,
} from './geometry';

const CONTIGUITY_TOL = 2;

/** Niz = maksimalna grupa susjednih donjih elemenata na istom zidu. */
export function detectRuns(project, pred, splitByDepth) {
  const runs = [];
  const test = pred || ((e, t) => t.worktop);
  const bases = project.elements.filter((e) => test(e, templateById(e.templateId) || {}));
  const dOf = (e) => e.dims.depth + (e.mountOffsetMm || 0);
  WALLS.forEach((w) => {
    const on = bases.filter((e) => e.wall === w.id).sort((a, b) => a.offset - b.offset);
    let cur = null;
    on.forEach((e) => {
      const end = e.offset + e.dims.width;
      const sameDepth = !splitByDepth || !cur || Math.abs(dOf(cur.elements[0]) - dOf(e)) < 2;
      if (cur && sameDepth && Math.abs(cur.end - e.offset) <= CONTIGUITY_TOL) {
        cur.end = Math.max(cur.end, end);
        cur.elements.push(e);
      } else {
        if (cur) runs.push(cur);
        cur = { wall: w.id, start: e.offset, end, elements: [e] };
      }
    });
    if (cur) runs.push(cur);
  });
  return runs;
}

/** Ivice na kojima rez SMIJE pasti: spojevi susjednih ormarića na tom zidu. */
export function seamsOnWall(project, wall, pred) {
  const test = pred || ((e, t) => t.worktop);
  const els = project.elements
    .filter((e) => e.wall === wall && test(e, templateById(e.templateId) || {}))
    .sort((a, b) => a.offset - b.offset);
  const out = [];
  els.forEach((e) => { out.push(Math.round(e.offset)); out.push(Math.round(e.offset + e.dims.width)); });
  return [...new Set(out)].sort((a, b) => a - b);
}

export function cutPositions(seg, seams, maxMm) {
  const L = seg.end - seg.start;
  const cuts = [], notes = [];
  if (L <= maxMm) return { cuts, notes };
  const n = Math.ceil(L / maxMm);
  let prev = seg.start;
  for (let k = 1; k < n; k++) {
    const ideal = seg.start + (L * k) / n;
    const left = n - k;
    const cand = seams.filter((s) =>
      s > prev + 1 && s < seg.end - 1 && cuts.indexOf(s) < 0 &&
      (s - prev) <= maxMm && (seg.end - s) <= maxMm * left);
    if (!cand.length) {
      const forced = Math.round(Math.min(prev + maxMm, seg.end - 1));
      cuts.push(forced);
      notes.push(`Rez na ${forced} mm NE pada na ivicu ormarića — nema pogodne ivice u dometu.`);
      prev = forced;
      continue;
    }
    cand.sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal) || a - b);
    cuts.push(cand[0]);
    const shift = Math.round(cand[0] - ideal);
    if (Math.abs(shift) > 1) {
      notes.push(`Rez pomjeren sa idealnih ${Math.round(ideal)} na ivicu ormarića ${cand[0]} mm (${shift > 0 ? '+' : ''}${shift}).`);
    }
    prev = cand[0];
  }
  return { cuts, notes };
}

/** Zajednički sastavljač za radne ploče i zidne obloge. */
export function assembleSpans(spans, project, room, cfg) {
  const segs = spans.map((s, i) => ({ ...s, id: `${cfg.idPrefix}_${i + 1}`, group: i }));
  segs.forEach((s) => { s.rect = spanRect(s.wall, s.start, s.end, room, cfg.depthMm); });
  const joints = [], notes = [];
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const A = segs[i], B = segs[j];
      if (!perpendicular(A.wall, B.wall)) continue;
      const ov = rectOverlap(A.rect, B.rect);
      if (!ov) continue;
      let keep = A, trim = B;
      if (B.blind && !A.blind) { keep = B; trim = A; }
      else if (!A.blind && !B.blind && (B.end - B.start) > (A.end - A.start)) { keep = B; trim = A; }
      const alongX = (trim.wall === 'top' || trim.wall === 'bottom');
      const o0 = alongX ? ov.x0 : ov.z0;
      const o1 = alongX ? ov.x1 : ov.z1;
      if (o0 <= trim.start + 1) trim.start = o1;
      else if (o1 >= trim.end - 1) trim.end = o0;
      trim.rect = spanRect(trim.wall, trim.start, trim.end, room, cfg.depthMm);
      const g = Math.min(A.group, B.group), old = Math.max(A.group, B.group);
      segs.forEach((s) => { if (s.group === old) s.group = g; });
      joints.push({
        kind: '90', keepWall: keep.wall, trimWall: trim.wall, group: g,
        profileId: cfg.corner90ProfileId, lengthMm: cfg.jointLengthMm,
      });
    }
  }
  const pieces = [];
  segs.forEach((s) => {
    const L = s.end - s.start;
    if (L <= 1) { s.pieces = []; return; }
    const seams = seamsOnWall(project, s.wall);
    const res = cutPositions(s, seams, cfg.maxPieceMm);
    res.notes.forEach((n) => notes.push(`${s.wall}: ${n}`));
    const bounds = [s.start].concat(res.cuts, [s.end]);
    s.pieces = [];
    for (let k = 0; k < bounds.length - 1; k++) {
      const a = bounds[k], b = bounds[k + 1];
      const piece = {
        id: `${s.id}_p${k + 1}`, segId: s.id, group: s.group, wall: s.wall,
        start: a, end: b,
        lengthMm: Math.round(b - a),
        crossMm: cfg.crossMm,
        thicknessMm: cfg.thicknessMm,
        topY: s.topY,
        onSeam: k > 0 ? seams.indexOf(Math.round(a)) >= 0 : true,
        rect: spanRect(s.wall, a, b, room, cfg.depthMm),
      };
      s.pieces.push(piece);
      pieces.push(piece);
      if (k < bounds.length - 2) {
        joints.push({
          kind: 'ravni', wall: s.wall, atMm: Math.round(b), group: s.group,
          profileId: cfg.straightProfileId, lengthMm: cfg.jointLengthMm,
          onSeam: seams.indexOf(Math.round(b)) >= 0,
        });
      }
    }
  });
  const profileMeters = {};
  joints.forEach((j) => { profileMeters[j.profileId] = (profileMeters[j.profileId] || 0) + j.lengthMm / 1000; });
  return {
    kind: cfg.idPrefix, depthMm: cfg.depthMm, crossMm: cfg.crossMm, thicknessMm: cfg.thicknessMm,
    segments: segs, pieces, joints, notes, profileMeters,
    assemblies: [...new Set(segs.filter((s) => s.pieces && s.pieces.length).map((s) => s.group))].length,
    joints90: joints.filter((j) => j.kind === '90').length,
    jointsStraight: joints.filter((j) => j.kind === 'ravni').length,
    areaM2: pieces.reduce((a, p) => a + (p.lengthMm * p.crossMm) / 1e6, 0),
    lengthMm: pieces.reduce((a, p) => a + p.lengthMm, 0),
  };
}

export function computeWorktops(project, room) {
  const depth = project.worktopDepthMm || WORKTOP.depthMm;
  const exp = runExposure(project, room, (e, t) => t.worktop);
  const spans = detectRuns(project).map((r, i) => ({
    wall: r.wall,
    start: r.start - ((exp[i] && exp[i].start) ? ENDPANEL.thicknessMm : 0),
    end: r.end + ((exp[i] && exp[i].end) ? ENDPANEL.thicknessMm : 0),
    elements: r.elements,
    topY: Math.max.apply(null, r.elements.map((e) => e.elevation + e.dims.height)),
    blind: r.elements.some((e) => (templateById(e.templateId) || {}).blindCorner),
  }));
  return assembleSpans(spans, project, room, {
    idPrefix: 'rp', depthMm: depth, crossMm: depth, thicknessMm: WORKTOP.thicknessMm,
    maxPieceMm: WORKTOP.maxPieceMm, jointLengthMm: depth,
    corner90ProfileId: 'T_WORKTOP', straightProfileId: 'T_WORKTOP',
  });
}

export function computeWallPanels(project, room) {
  if (project.wallPanelOn === false) {
    return { pieces: [], joints: [], notes: [], profileMeters: {}, segments: [],
             assemblies: 0, joints90: 0, jointsStraight: 0, areaM2: 0, lengthMm: 0,
             heightMm: project.wallPanelHeightMm || WALLPANEL.heightMm };
  }
  const h = project.wallPanelHeightMm || WALLPANEL.heightMm;
  const th = project.wallPanelThicknessMm || WALLPANEL.thicknessMm;
  const wt = computeWorktops(project, room);
  const spans = [];
  WALLS.forEach((w) => {
    const on = project.elements.filter((e) => e.wall === w.id && !e.autoParentId);
    const wtOn = wt.pieces.filter((p) => p.wall === w.id);
    const perp = wt.pieces.filter((p) => {
      const r = p.rect;
      if (w.id === 'top') return r.z0 <= 1;
      if (w.id === 'bottom') return r.z1 >= room.depth - 1;
      if (w.id === 'left') return r.x0 <= 1;
      return r.x1 >= room.width - 1;
    });
    const starts = [], ends = [];
    on.forEach((e) => { starts.push(e.offset); ends.push(e.offset + e.dims.width); });
    wtOn.forEach((p) => { starts.push(p.start); ends.push(p.end); });
    perp.forEach((p) => {
      const along = (w.id === 'top' || w.id === 'bottom')
        ? [p.rect.x0, p.rect.x1] : [p.rect.z0, p.rect.z1];
      starts.push(along[0]); ends.push(along[1]);
    });
    if (!starts.length) return;
    const from = Math.max(0, Math.min.apply(null, starts));
    const to = Math.min(wallLength(w.id, room), Math.max.apply(null, ends));
    const blocks = on.filter((e) => (templateById(e.templateId) || {}).tallColumn)
      .map((e) => [e.offset, e.offset + e.dims.width]).sort((a, b) => a[0] - b[0]);
    if (to - from < 100) return;
    const topY = on.length
      ? Math.max.apply(null, on.filter((e) => (templateById(e.templateId) || {}).worktop)
        .map((e) => e.elevation + e.dims.height).concat([0]))
      : 0;
    const blindOn = on.some((e) => (templateById(e.templateId) || {}).blindCorner);
    const baseY = topY || (project.legHeightMm || 150) + CORPUS_BASE_H;
    let cur = from;
    blocks.forEach(([bs, be]) => {
      if (bs > cur) spans.push({ wall: w.id, start: cur, end: Math.min(bs, to), topY: baseY, blind: blindOn });
      cur = Math.max(cur, be);
    });
    if (cur < to) spans.push({ wall: w.id, start: cur, end: to, topY: baseY, blind: blindOn });
  });
  const out = assembleSpans(spans, project, room, {
    idPrefix: 'zo', depthMm: th, crossMm: h, thicknessMm: th,
    maxPieceMm: WALLPANEL.maxPieceMm, jointLengthMm: h,
    corner90ProfileId: 'L_WALL', straightProfileId: 'H_WALL',
  });
  out.heightMm = h;
  return out;
}

/** Zajednički generator uspravnih traka (coklo, maska). */
export function buildStrips(project, room, cfg) {
  const runs = detectRuns(project, cfg.pred, cfg.splitByDepth);
  const pieces = [], notes = [];
  runs.forEach((r) => {
    const d = Math.max.apply(null, r.elements.map((e) => e.dims.depth + (e.mountOffsetMm || 0)));
    r.frontMm = d - (cfg.recessMm || 0);
    r.band = [r.frontMm - cfg.thicknessMm, r.frontMm];
    r.blind = r.elements.some((e) => (templateById(e.templateId) || {}).blindCorner);
  });
  for (let i = 0; i < runs.length; i++) {
    for (let j = 0; j < runs.length; j++) {
      if (i === j || !perpendicular(runs[i].wall, runs[j].wall)) continue;
      const A = runs[i], B = runs[j];
      const owner = A.blind && !B.blind ? A : (B.blind && !A.blind ? B : ((A.end - A.start) >= (B.end - B.start) ? A : B));
      if (owner !== A) continue;
      const side = CORNER_WALL[B.wall].start === A.wall ? 'start' : (CORNER_WALL[B.wall].end === A.wall ? 'end' : null);
      if (!side) continue;
      const len = wallLength(B.wall, room);
      if (cfg.cornerMode === 'trim') {
        const rB = bandRect(B.wall, B.start, B.end, room, B.band[0], B.band[1]);
        const rA = bandRect(A.wall, A.start, A.end, room, A.band[0], A.band[1]);
        const ov = rectOverlap(rA, rB);
        if (ov) {
          const alongX = (B.wall === 'top' || B.wall === 'bottom');
          const o0 = alongX ? ov.x0 : ov.z0, o1 = alongX ? ov.x1 : ov.z1;
          if (o0 <= B.start + 1) B.start = o1;
          else if (o1 >= B.end - 1) B.end = o0;
        }
      } else {
        if (side === 'start' && B.start > A.band[1]) B.start = A.band[1];
        if (side === 'end' && B.end < len - A.band[1]) B.end = len - A.band[1];
      }
    }
  }
  runs.forEach((r, i) => {
    const front = r.frontMm;
    const yBase = cfg.yOf(r);
    const seams = seamsOnWall(project, r.wall, cfg.pred).concat([r.start, r.end]);
    const res = cutPositions({ start: r.start, end: r.end }, seams, cfg.maxPieceMm);
    res.notes.forEach((n) => notes.push(`${r.wall}: ${n}`));
    const bounds = [r.start].concat(res.cuts, [r.end]);
    for (let k = 0; k < bounds.length - 1; k++) {
      const a = bounds[k], b = bounds[k + 1];
      pieces.push({
        id: `${cfg.idPrefix}_${i + 1}_p${k + 1}`, runId: `${cfg.idPrefix}_${i + 1}`,
        wall: r.wall, start: a, end: b,
        lengthMm: Math.round(b - a), crossMm: cfg.heightMm, thicknessMm: cfg.thicknessMm,
        yBase,
        rect: bandRect(r.wall, a, b, room, front - cfg.thicknessMm, front),
        onSeam: k === 0 || seams.indexOf(Math.round(a)) >= 0,
      });
    }
  });
  return {
    pieces, notes, runs: runs.length,
    lengthMm: pieces.reduce((x, p) => x + p.lengthMm, 0),
    areaM2: pieces.reduce((x, p) => x + (p.lengthMm * p.crossMm) / 1e6, 0),
  };
}

export function computeSocle(project, room) {
  return buildStrips(project, room, {
    idPrefix: 'sk', pred: (e, t) => t.worktop || t.tallColumn,
    heightMm: project.legHeightMm || project.socleHeightMm || SOCLE.heightMm,
    thicknessMm: SOCLE.thicknessMm, recessMm: SOCLE.recessMm,
    maxPieceMm: SOCLE.maxPieceMm, cornerMode: 'extend',
    yOf: (_run) => 0,
  });
}

export function computeTopMask(project, room) {
  return buildStrips(project, room, {
    idPrefix: 'gm', pred: (e, t) => t.type === 'wall',
    heightMm: project.topMaskHeightMm || TOPMASK.heightMm,
    thicknessMm: TOPMASK.thicknessMm, recessMm: 0,
    maxPieceMm: TOPMASK.maxPieceMm, cornerMode: 'trim', splitByDepth: true,
    yOf: (r) => Math.max.apply(null, r.elements.map((e) => e.elevation + e.dims.height)),
  });
}

/* `cooktopCenter` je ovdje ranije stajao, ali je koristio konstantu `COOKTOP`
   koja NIJE bila importovana u ovaj modul — svaki poziv bi bacio
   `ReferenceError: COOKTOP is not defined`. Funkcija nije imala nijednog
   pozivaoca (3D prikaz ploče računa isti pravougaonik inline, u
   views/Viewport3D.jsx), pa je obrisana umjesto da se popravi import. */

export function computeLedMask(project, room) {
  if (!project.ledMask) return { pieces: [], lengthMm: 0, areaM2: 0, notes: [] };
  const th = LEDMASK.thicknessMm;
  const pieces = [], notes = [];
  const wallEls = project.elements.filter((e) => (templateById(e.templateId) || {}).type === 'wall' && !e.autoParentId);
  WALLS.forEach((w) => {
    const on = wallEls.filter((e) => e.wall === w.id).sort((a, b) => a.offset - b.offset);
    if (!on.length) return;
    let spans = [];
    let cur = null;
    on.forEach((e) => {
      const isNapa = e.templateId === 'V-NAPA';
      if (isNapa) { if (cur) { spans.push(cur); cur = null; } return; }
      if (cur && Math.abs(cur.end - e.offset) <= 2) { cur.end = e.offset + e.dims.width; cur.d = Math.max(cur.d, e.dims.depth); cur.y = Math.min(cur.y, e.elevation); }
      else { if (cur) spans.push(cur); cur = { start: e.offset, end: e.offset + e.dims.width, d: e.dims.depth, y: e.elevation }; }
    });
    if (cur) spans.push(cur);
    spans.forEach((sp, i) => {
      const L = sp.end - sp.start;
      const n = Math.max(1, Math.ceil(L / LEDMASK.maxPieceMm));
      const each = Math.round(L / n);
      for (let k = 0; k < n; k++) {
        const a = sp.start + k * each;
        const b = (k === n - 1) ? sp.end : a + each;
        pieces.push({
          id: `led_${w.id}_${i + 1}_${k + 1}`, wall: w.id,
          lengthMm: Math.round(b - a), crossMm: Math.round(sp.d), thicknessMm: th,
          yBase: sp.y - th, rect: bandRect(w.id, a, b, room, 0, sp.d),
        });
      }
    });
  });
  if (pieces.length) notes.push('LED maska ne ide ispod nape — niz je prekinut na toj poziciji.');
  return {
    pieces, notes,
    lengthMm: pieces.reduce((x, p) => x + p.lengthMm, 0),
    areaM2: pieces.reduce((x, p) => x + (p.lengthMm * p.crossMm) / 1e6, 0),
  };
}

/**
 * Da li je strana PROSTORA (uz koju bi maska stajala) slobodna: unutar gabarita i
 * bez drugog elementa u pojasu dubine `D`.
 *
 * Ovo je zajednička logika za `endExposed` (niz elemenata) i
 * `tallEndExposed` (pojedinačni visoki element).
 */
/**
 * @param {Array} exclude  elementi koje NE treba testirati (oni čiji se kraj
 *                         upravo provjerava — inače se probni pravougaonik
 *                         preklapa sa njima samima).
 */
function sideIsClear(wall, a0, a1, room, D, y0, y1, elements, exclude) {
  const skip = new Set();
  (exclude || []).forEach((e) => {
    if (!e || !e.instanceId) return;
    skip.add(e.instanceId);
    skip.add(`${e.instanceId}_nad`);       // automatska nadgradnja dijeli otisak
  });
  /* Inset od 1 mm (ne 3) samo da pravougaonik ne bude degenerisan.
     ±3 mm je ranije zalazilo U element koji se provjerava, pa je `overlaps`
     sa eps=2 uvijek vraćao true i funkcija je javljala „nije izloženo"
     čak i kad je prostor bio potpuno prazan. */
  const r = bandRect(wall, a0 + 1, a1 - 1, room, 0, D);
  if (r.x1 <= r.x0 || r.z1 <= r.z0) return false;
  const box = { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y0, y1 };
  return !elements.some((e) => (skip.has(e.instanceId) ? false : overlaps(box, elementAABB(e, room), 2)));
}

/** Kraj niza je vidljiv ako iza njega nije zid niti drugi element. */
export function endExposed(run, project, room, side) {
  const len = wallLength(run.wall, room);
  const probe = 200;
  const a0 = side === 'start' ? run.start - probe : run.end;
  const a1 = side === 'start' ? run.start : run.end + probe;
  if (a0 < -1 || a1 > len + 1) return false;
  const D = Math.max.apply(null, run.elements.map((e) => e.dims.depth + (e.mountOffsetMm || 0)));
  const y0 = Math.min.apply(null, run.elements.map((e) => e.elevation));
  const y1 = Math.max.apply(null, run.elements.map((e) => e.elevation + e.dims.height));
  // Elementi SAMOG niza se izuzimaju — provjeravamo šta je PORED niza, ne u njemu.
  return sideIsClear(run.wall, a0, a1, room, D, y0, y1, project.elements, run.elements);
}

/**
 * Da li je bok VISOKOG elementa izložen, odnosno da li tamo uopšte ima mjesta za
 * završnu masku.
 *
 * `computeEndPanels` je za base/wall nizove provjeravao `endExposed()`, ali je
 * petlja po visokim elementima (`talls.forEach`) generisala maske BEZUVJETNO —
 * samo je preskakala slučaj kad je susjed također visoki element. Rezultat:
 * frižider postavljen na `offset 0` (uz lijevi zid) dobijao je masku na
 * "start" strani, iako je tamo zid i maska fizički ne može stati.
 *
 * Provjera je dvodijelna:
 *   1. ima li uopšte prostora između elementa i kraja zida (≥ debljina maske),
 *   2. da li je taj prostor prazan (bez drugog elementa ili prepreke).
 */
export function tallEndExposed(el, project, room, side, thicknessMm, alsoSkip) {
  const len = wallLength(el.wall, room);
  const t = thicknessMm || ENDPANEL.thicknessMm;

  /* Koliko prostora ima između elementa i zida/kraja prostorije na toj strani. */
  const gapStart = el.offset;
  const gapEnd = len - (el.offset + el.dims.width);
  const gap = side === 'start' ? gapStart : gapEnd;

  // Nema mjesta za masku: element je uz sam zid ili uz kraj prostorije.
  if (gap < t) return false;

  /* Provjeravamo SAMO pojas u koji maska stvarno staje (debljina `t`), a ne fiksni
     pojas od 200 mm. Sa 200 mm bi maska od 18 mm bila odbijena i kad je susjed
     udaljen 100 mm — a tamo fizički staje. (`endExposed` za base/wall nizove i
     dalje koristi 200 mm jer je to ugrađeno ponašanje za radne ploče/obloge.) */
  const a0 = side === 'start' ? el.offset - t : el.offset + el.dims.width;
  const a1 = side === 'start' ? el.offset : el.offset + el.dims.width + t;

  const D = el.dims.depth + (el.mountOffsetMm || 0);
  const y0 = el.elevation;
  const y1 = el.elevation + el.dims.height;
  /* Izuzimamo sam element (i njegovu automatsku nadgradnju `<id>_nad`, jer dijeli
     otisak). `alsoSkip` je susjed koji je zalijepljen za ovu stranu — njegov kraj
     se poklapa sa početkom elementa, pa bi inače blokirao masku koja se ionako
     obradi preko `trimmedForSocle` logike u `computeEndPanels`. */
  const skip = [el].concat(alsoSkip || []);
  return sideIsClear(el.wall, a0, a1, room, D, y0, y1, project.elements, skip);
}

export function runExposure(project, room, pred) {
  const map = {};
  detectRuns(project, pred).forEach((r, i) => {
    map[i] = { start: endExposed(r, project, room, 'start'), end: endExposed(r, project, room, 'end') };
  });
  return map;
}

export function computeEndPanels(project, room) {
  const pieces = [];
  const wtDepth = project.worktopDepthMm || WORKTOP.depthMm;
  const maskH = project.topMaskHeightMm || TOPMASK.heightMm;
  const t = project.endPanelThicknessMm || ENDPANEL.thicknessMm;
  const mode = project.endPanelMode || 'auto';
  const over = project.endPanelSizes || {};
  const ceil = wallTopOf(project) + maskH;
  const walk = (pred, kind) => {
    detectRuns(project, pred).forEach((r, i) => {
      const D = Math.max.apply(null, r.elements.map((e) => e.dims.depth + (e.mountOffsetMm || 0)));
      const H = Math.max.apply(null, r.elements.map((e) => e.dims.height));
      const elev = Math.min.apply(null, r.elements.map((e) => e.elevation));
      const depth = kind === 'base' ? wtDepth : D;
      const height = kind === 'base' ? H + elev : H + maskH;
      const yBase = kind === 'base' ? 0 : elev;
      ['start', 'end'].forEach((side) => {
        if (!endExposed(r, project, room, side)) return;
        const a = side === 'start' ? r.start - t : r.end;
        const id = `zm_${kind}_${i + 1}_${side}`;
        const full = mode === 'full';
        const o = over[id] || {};
        const L = Math.round(o.lengthMm || (full ? ceil : height));
        const Cx = Math.round(o.crossMm || depth);
        pieces.push({
          id, kind, wall: r.wall, side,
          lengthMm: L, crossMm: Cx, thicknessMm: t,
          yBase: o.yBase != null ? o.yBase : (full ? 0 : yBase),
          manual: !!(o.lengthMm || o.crossMm),
          rect: bandRect(r.wall, a, a + t, room, 0, Cx),
        });
      });
    });
  };
  walk((e, tp) => tp.worktop, 'base');
  walk((e, tp) => tp.type === 'wall' && !e.autoParentId, 'wall');
  const tallTop = wallElevationOf(project) + templateById('V-ELEMENT').dims.height.default + maskH;
  const talls = project.elements.filter((e) => (templateById(e.templateId) || {}).tallColumn);
  const legH = project.legHeightMm || 150;
  talls.forEach((el, i) => {
    const onWall = project.elements.filter((o) =>
      o.wall === el.wall && o.instanceId !== el.instanceId && !o.autoParentId);
    const isTall = (o) => !!(templateById(o.templateId) || {}).tallColumn;
    const neighbour = (side) => onWall.find((o) => (side === 'start'
      ? Math.abs(o.offset + o.dims.width - el.offset) < 3
      : Math.abs(el.offset + el.dims.width - o.offset) < 3));
    ['start', 'end'].forEach((side) => {
      const nb = neighbour(side);
      if (nb && isTall(nb)) return;
      /* BUG-12: bez ove provjere frižider postavljen uz zid (offset 0) dobijao je
         fantomsku masku od ~1,4 m² na strani gdje je zid. Susjed koji je zalijepljen
         za element (`nb`) se izuzima iz provjere jer se njegov slučaj rješava preko
         `trimmedForSocle` — maska tada staje na coklo susjeda. */
      if (!tallEndExposed(el, project, room, side, t, nb ? [nb] : null)) return;
      const id = `zm_tall_${i + 1}_${side}`;
      const o = over[id] || {};
      const full = mode === 'full';
      const yb = o.yBase != null ? o.yBase : ((nb && !full) ? legH : 0);
      const hgt = Math.round(o.lengthMm || (tallTop - yb));
      const Cx = Math.round(o.crossMm || (el.dims.depth + (el.mountOffsetMm || 0)));
      const a = side === 'start' ? el.offset - t : el.offset + el.dims.width;
      pieces.push({
        id, kind: 'tall', wall: el.wall, side,
        lengthMm: hgt, crossMm: Cx, thicknessMm: t, yBase: yb,
        trimmedForSocle: !!nb && yb > 0, manual: !!(o.lengthMm || o.crossMm),
        rect: bandRect(el.wall, a, a + t, room, 0, Cx),
      });
    });
  });
  return {
    pieces,
    lengthMm: pieces.reduce((x, p) => x + p.lengthMm, 0),
    areaM2: pieces.reduce((x, p) => x + (p.lengthMm * p.crossMm) / 1e6, 0),
  };
}