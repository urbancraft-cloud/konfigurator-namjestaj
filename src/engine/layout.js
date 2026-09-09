// src/engine/layout.js

import { HANDLES } from '../data/hardware';
import { WALLS, COOKTOP, CORNER_WALL, WALL_DEPTH_MM } from '../data/tech';
import { templateById, createPlaced, createInstance, shapeWalls } from '../data/catalog';
import { thicknessesOf } from '../data/decors';
import {
  wallLength, occupiedDepth, perpendicular, bandRect,
  collidesWithAny, wallElevationOf, wallTopOf,
} from './geometry';

/* --- Ručke -------------------------------------------------------------- */
const HANDLE_EDGE_MM = 40;

export function handlePlacements(el, panels, project) {
  const h = HANDLES[el.handleId] || HANDLES.RUCKA_160;
  if (h.kind === 'push' || h.kind === 'gola') return [];
  const isWall = el.type === 'wall';
  const orient = isWall
    ? ((project && project.handleOrientWall) || 'horizontal')
    : ((project && project.handleOrientBase) || 'vertical');
  const vertical = orient === 'vertical' && h.kind !== 'knob';
  const L = h.kind === 'knob' ? h.sizeMm : h.lengthMm;
  const side = el.hingeSide === 'left' ? 'right' : 'left';
  const isDish = el.templateId === 'D-MASINA';
  const out = [];
  panels.forEach((p) => {
    if (p.materialKey !== 'front') return;
    if (p.role.indexOf('Blenda') === 0 || p.role.indexOf('Distancer') === 0) return;
    const isDrawer = p.role.indexOf('Fronta ladice') === 0;
    const centered = isDrawer || isDish;
    p.place.forEach((pl) => {
      const vert = vertical && !centered && pl.h > L + 2 * HANDLE_EDGE_MM;
      let y;
      if (isWall) y = vert ? pl.y + HANDLE_EDGE_MM : pl.y + HANDLE_EDGE_MM - h.sizeMm / 2;
      else y = vert ? pl.y + pl.h - HANDLE_EDGE_MM - L : pl.y + pl.h - HANDLE_EDGE_MM - h.sizeMm / 2;
      let sd = side;
      const row = p.place.filter((q) => Math.abs(q.y - pl.y) < 2).sort((q, r) => q.x - r.x);
      if (row.length > 1) sd = (row.indexOf(pl) === 0) ? 'right' : 'left';
      let x;
      if (centered) {
        x = pl.x + pl.w / 2 - (vert ? h.sizeMm : L) / 2;
      } else if (vert) {
        const cx = sd === 'left' ? pl.x + HANDLE_EDGE_MM : pl.x + pl.w - HANDLE_EDGE_MM;
        x = cx - h.sizeMm / 2;
      } else {
        x = sd === 'left' ? pl.x + HANDLE_EDGE_MM : pl.x + pl.w - HANDLE_EDGE_MM - L;
      }
      out.push(vert
        ? { x, y, z: pl.z + pl.d, w: h.sizeMm, h: L, d: h.projMm }
        : { x, y, z: pl.z + pl.d, w: L, h: h.sizeMm, d: h.projMm });
    });
  });
  return out;
}

/* --- Automatska poravnanja na nivou projekta ---------------------------- */

export function frontPlaneOnWall(project, wall, kindTest) {
  const els = project.elements.filter((e) => e.wall === wall && kindTest(e, templateById(e.templateId) || {}));
  if (!els.length) return null;
  return Math.max.apply(null, els.map((e) =>
    e.dims.depth + (e.mountOffsetMm || 0) + (e.front.thicknessMm || 19)));
}

export function cornerBlendaX(el, project, room) {
  const len = wallLength(el.wall, room);
  const atStart = el.offset < 5;
  const atEnd = (el.offset + el.dims.width) > len - 5;
  const side = atStart ? 'start' : (atEnd ? 'end' : null);
  if (!side) return null;
  const perpWall = CORNER_WALL[el.wall][side];
  const fp = frontPlaneOnWall(project, perpWall, (e, t) => t.worktop);
  if (fp == null) return null;
  const coord = side === 'start' ? fp : (len - fp);
  return Math.max(0, Math.min(el.dims.width, Math.round(coord - el.offset)));
}

/* `room` nije potreban: poravnanje se računa isključivo iz dubina susjeda na istom
   zidu. Potpis je zadržan bez tog parametra da ne laže čitaocu. */
export function frontAlignOffset(el, project) {
  const others = project.elements.filter((e) =>
    e.instanceId !== el.instanceId && e.wall === el.wall && e.type === el.type &&
    !(templateById(e.templateId) || {}).alignFrontDepth);
  if (!others.length) return el.mountOffsetMm || 0;
  const fp = Math.max.apply(null, others.map((e) =>
    e.dims.depth + (e.mountOffsetMm || 0) + (e.front.thicknessMm || 19)));
  return Math.max(0, Math.round(fp - el.dims.depth - (el.front.thicknessMm || 19)));
}

/** Projekat sa izračunatim poravnanjima. Sve dalje računa iz ovoga. */
export function resolveProject(project, room) {
  const leg = project.legHeightMm || 150;
  const wallElev = wallElevationOf(project);
  const wallTop = wallTopOf(project);
  const elements = project.elements.map((el) => {
    const tpl = templateById(el.templateId) || {};
    let next = el;
    if (el.autoElevation !== false && !el.autoParentId) {
      if (tpl.type !== 'wall') {
        if (el.elevation !== leg) next = { ...next, elevation: leg };
      } else if (tpl.elevationOffsetMm != null) {
        const e = wallTop - el.dims.height;
        if (e !== el.elevation) next = { ...next, elevation: e };
      } else {
        const hgt = wallTop - wallElev;
        const dims = { ...el.dims };
        let touched = false;
        if (el.autoHeight !== false && dims.height !== hgt) { dims.height = hgt; touched = true; }
        if (dims.depth !== WALL_DEPTH_MM) { dims.depth = WALL_DEPTH_MM; touched = true; }
        const patch = {};
        if (el.elevation !== wallElev) patch.elevation = wallElev;
        if (touched) patch.dims = dims;
        if (Object.keys(patch).length) next = { ...next, ...patch };
      }
    }
    if (tpl.cornerDistancer) {
      const dx = cornerBlendaX(el, project, room);
      if (dx != null && dx !== el.cornerBlendaXMm) next = { ...next, cornerBlendaXMm: dx };
    }
    if (tpl.alignFrontDepth) {
      const mo = frontAlignOffset(el, project);
      if (mo != null && mo !== el.mountOffsetMm) next = { ...next, mountOffsetMm: mo };
    }
    return next;
  });
  const withOverheads = elements.filter((e) => !e.autoParentId);
  const overheads = [];
  withOverheads.forEach((el) => {
    const tpl = templateById(el.templateId) || {};
    if (!tpl.overheadAbove) return;
    const y = el.elevation + el.dims.height;
    const hgt = Math.round(wallTop - y);
    if (hgt < 150) return;
    const prev = elements.find((e) => e.autoParentId === el.instanceId);
    const ov = prev ? { ...prev } : createInstance('H-NADGRADNJA', el.profileId);
    ov.instanceId = `${el.instanceId}_nad`;
    ov.autoParentId = el.instanceId;
    ov.autoElevation = false;
    ov.wall = el.wall;
    ov.offset = el.offset;
    ov.elevation = y;
    ov.mountOffsetMm = el.mountOffsetMm || 0;
    ov.dims = { width: el.dims.width, height: hgt, depth: el.dims.depth };
    ov.corpus = { ...el.corpus };
    ov.front = { ...el.front };
    ov.edge = { ...el.edge };
    ov.type = 'wall';

    // ✅ FIX: UVIJEK primijeni overheadFrontDecorId, bez obzira da li
    // nadgradnja već postoji ili je novokreirana
    if (project.overheadFrontDecorId) {
      const th = thicknessesOf(project.overheadFrontDecorId);
      ov.front = {
        ...ov.front,
        decorId: project.overheadFrontDecorId,
        thicknessMm: th.indexOf(ov.front.thicknessMm) >= 0
          ? ov.front.thicknessMm
          : (th.indexOf(18) >= 0 ? 18 : th[0]),
      };
    }

    overheads.push(ov);
  });
  return { ...project, elements: withOverheads.concat(overheads) };
}

/* --- autoLayoutEngine --------------------------------------------------- */
const TRIANGLE = { legMinMm: 1200, legMaxMm: 2700, sumMinMm: 4000, sumMaxMm: 7900 };
const SINK_TO_HOB_MIN = 600;

/* `freeIntervals` i `fitNear` su obrisani — autoLayoutEngine je prešao na
   `tryPut`/`seek`/`candidates` pa ih više ništa nije zvalo.
   `blindCornerRule` je obrisan iz istog razloga (pravilo je ugrađeno u
   `perpBlindReach` unutar autoLayoutEngine-a). */

export function centerOf(wall, start, width, room, depth) {
  const r = bandRect(wall, start, start + width, room, 0, depth);
  return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
}

export const dist = (a, b) => Math.round(Math.hypot(a.x - b.x, a.z - b.z));

export function validateTriangle(sink, hob, fridge) {
  if (!sink || !hob || !fridge) return { ok: false, reason: 'nepotpun trokut', legs: null, sum: 0 };
  const legs = { sudoperPloca: dist(sink, hob), plocaFrizider: dist(hob, fridge), friziderSudoper: dist(fridge, sink) };
  const sum = legs.sudoperPloca + legs.plocaFrizider + legs.friziderSudoper;
  const bad = Object.values(legs).some((d) => d < TRIANGLE.legMinMm || d > TRIANGLE.legMaxMm);
  const badSum = sum < TRIANGLE.sumMinMm || sum > TRIANGLE.sumMaxMm;
  return { ok: !bad && !badSum, legs, sum, reason: bad ? 'krak izvan 1,2–2,7 m' : (badSum ? 'zbir izvan 4,0–7,9 m' : null) };
}

export function autoLayoutEngine(cfg) {
  const { room, shape, services = [], obstacles = [], upperCorners = true } = cfg;
  const dwWidth = cfg.dishwasherWidthMm || 600;
  const ovenId = cfg.ovenType === 'tall' ? 'H-PECNICA' : 'D-PECNICA';
  const prof = cfg.profileId || 'SERIJA_KUCANO';
  const walls = shapeWalls(shape);
  const mainWall = walls[0];
  const notes = [];
  const elements = [];
  const reserved = [];
  const W = (id) => templateById(id).dims.width.default;
  const proj = () => ({ elements, obstacles, services });
  const tryPut = (id, wall, off, extra, width) => {
    const el = createPlaced(id, prof, wall, Math.round(off));
    if (width) el.dims = { ...el.dims, width: Math.round(width) };
    if (extra) Object.assign(el, extra);
    if (off < -1 || off + el.dims.width > wallLength(wall, room) + 1) return null;
    if (collidesWithAny(el, proj(), room, el.instanceId)) return null;
    elements.push(el);
    return el;
  };
  const seek = (id, wall, want, extra, width) => {
    const w = width || W(id);
    const len = wallLength(wall, room);
    const start = Math.max(0, Math.min(len - w, want));
    for (let d = 0; d <= len; d += 10) {
      for (const x of (d === 0 ? [start] : [start + d, start - d])) {
        if (x < 0 || x + w > len) continue;
        const el = tryPut(id, wall, x, extra, width);
        if (el) return el;
      }
    }
    return null;
  };
  const centerEl = (el) => (el ? centerOf(el.wall, el.offset, el.dims.width, room, el.dims.depth) : null);
  if (shape === 'L' || shape === 'U') {
    tryPut('D-UGAO-SLIJEPI', mainWall, 0);
    if (upperCorners) tryPut('V-UGAO-SLIJEPI', mainWall, 0);
  }
  if (shape === 'U') {
    const len = wallLength(mainWall, room);
    tryPut('D-UGAO-SLIJEPI', mainWall, len - W('D-UGAO-SLIJEPI'));
    if (upperCorners) tryPut('V-UGAO-SLIJEPI', mainWall, len - W('V-UGAO-SLIJEPI'));
  }
  const struja = services.filter((s) => s.kind === 'struja');
  const outletDist = (wl, cx) => {
    const near = struja.filter((sv) => sv.wall === wl);
    if (!near.length) return null;
    return Math.min.apply(null, near.map((sv) => Math.abs(sv.offset - cx)));
  };
  const voda = services.find((s) => s.kind === 'voda');
  const sinkW = W('D-SUDOPER');
  const sinkWall = voda ? voda.wall : mainWall;
  const sinkWant = (voda ? voda.offset : wallLength(sinkWall, room) / 2) - sinkW / 2;
  const sinkEl = seek('D-SUDOPER', sinkWall, sinkWant);
  if (!sinkEl) notes.push('Nema mjesta za sudoper na zadanom zidu.');
  else if (!voda) notes.push('Vodovodni priključak nije zadan — sudoper je na sredini glavnog zida.');
  if (sinkEl) {
    const right = sinkEl.offset + sinkEl.dims.width;
    const left = sinkEl.offset - dwWidth;
    const dr = outletDist(sinkWall, right + dwWidth / 2);
    const dl = outletDist(sinkWall, left + dwWidth / 2);
    const order = (dl != null && (dr == null || dl < dr)) ? [left, right] : [right, left];
    const dw = tryPut('D-MASINA', sinkWall, order[0], null, dwWidth)
      || tryPut('D-MASINA', sinkWall, order[1], null, dwWidth);
    if (!dw) notes.push('Nema prostora za mašinu za suđe uz sudoper — rezervišite je ručno.');
  }
  const ovenW = W(ovenId);
  const frW = W('H-FRIZIDER');
  const sinkC = centerEl(sinkEl);
  const okFromSink = (wall, x, w) => {
    if (!sinkEl || wall !== sinkWall) return true;
    return (x + w <= sinkEl.offset - SINK_TO_HOB_MIN) || (x >= sinkEl.offset + sinkEl.dims.width + SINK_TO_HOB_MIN);
  };
  const candidates = (id, w, filterFn) => {
    const out = [];
    walls.forEach((wl) => {
      const len = wallLength(wl, room);
      for (let x = 0; x + w <= len; x += 100) {
        if (filterFn && !filterFn(wl, x)) continue;
        const probe = createPlaced(id, prof, wl, x);
        if (collidesWithAny(probe, proj(), room, probe.instanceId)) continue;
        out.push({ wall: wl, off: x, c: centerOf(wl, x, w, room, probe.dims.depth) });
      }
    });
    return out;
  };
  const ovenCands = candidates(ovenId, ovenW, (wl, x) => okFromSink(wl, x, ovenW));
  const ovenFallback = ovenCands.length ? ovenCands : candidates(ovenId, ovenW, null);
  if (ovenCands.length === 0 && ovenFallback.length) {
    notes.push(`Razmak sudoper–ploča je ispod ${SINK_TO_HOB_MIN} mm — prostorija ne dozvoljava više.`);
  }
  const frCands = (() => {
    const out = [];
    const seen = {};
    walls.forEach((wl) => {
      const len = wallLength(wl, room);
      const pts = [0, len - frW];
      elements.filter((e) => e.wall === wl).forEach((e) => {
        pts.push(e.offset + e.dims.width);
        pts.push(e.offset - frW);
      });
      pts.forEach((x0) => {
        const x = Math.round(x0);
        if (x < 0 || x + frW > len) return;
        const key = wl + ':' + x;
        if (seen[key]) return;
        seen[key] = 1;
        const probe = createPlaced('H-FRIZIDER', prof, wl, x);
        if (collidesWithAny(probe, proj(), room, probe.instanceId)) return;
        const touches = x < 1 || x + frW > len - 1
          || elements.some((e) => e.wall === wl &&
            (Math.abs(e.offset + e.dims.width - x) < 2 || Math.abs(x + frW - e.offset) < 2));
        if (!touches) return;
        out.push({ wall: wl, off: x, c: centerOf(wl, x, frW, room, probe.dims.depth) });
      });
    });
    return out;
  })();
  const deviation = (t) => {
    if (!t.legs) return 1e6;
    let d = 0;
    Object.values(t.legs).forEach((L) => {
      if (L < TRIANGLE.legMinMm) d += (TRIANGLE.legMinMm - L) * 2;
      if (L > TRIANGLE.legMaxMm) d += L - TRIANGLE.legMaxMm;
    });
    if (t.sum < TRIANGLE.sumMinMm) d += TRIANGLE.sumMinMm - t.sum;
    if (t.sum > TRIANGLE.sumMaxMm) d += t.sum - TRIANGLE.sumMaxMm;
    return d;
  };
  const powerPenalty = (wl, x, w) => {
    if (!struja.length) return 0;
    const d = outletDist(wl, x + w / 2);
    if (d == null) return 1200;
    return d * 1.2;
  };
  let bestPair = null, bestScore = Infinity;
  ovenFallback.forEach((o) => {
    const pen = powerPenalty(o.wall, o.off, ovenW);
    frCands.forEach((f) => {
      const t = validateTriangle(sinkC, o.c, f.c);
      const sc = deviation(t) + pen + powerPenalty(f.wall, f.off, frW);
      if (sc < bestScore) { bestScore = sc; bestPair = { o, f, t }; }
    });
  });
  let ovenEl = null, frEl = null;
  if (bestPair) {
    ovenEl = tryPut(ovenId, bestPair.o.wall, bestPair.o.off);
    frEl = tryPut('H-FRIZIDER', bestPair.f.wall, bestPair.f.off);
  }
  if (!ovenEl && ovenFallback.length) ovenEl = tryPut(ovenId, ovenFallback[0].wall, ovenFallback[0].off);
  if (!ovenEl) notes.push('Nema mjesta za element za pećnicu.');
  if (!frEl) {
    const alt = frCands.find((f) => tryPut('H-FRIZIDER', f.wall, f.off));
    if (!alt) notes.push('Nema mjesta za ormar frižidera — prostorija je premala za ugradbenu kolonu.');
    else frEl = elements[elements.length - 1];
  }
  const perpBlindReach = (wl) => {
    let out = null;
    WALLS.forEach((w) => {
      if (!perpendicular(wl, w.id)) return;
      const c = elements.find((e) => e.wall === w.id
        && (templateById(e.templateId) || {}).blindCorner
        && (templateById(e.templateId) || {}).worktop);
      if (!c) return;
      const side = CORNER_WALL[wl].start === w.id ? 'start'
        : (CORNER_WALL[wl].end === w.id ? 'end' : null);
      if (!side) return;
      out = { side, reach: occupiedDepth(c) + (c.mountOffsetMm || 0) };
    });
    return out;
  };
  walls.forEach((wl) => {
    const len = wallLength(wl, room);
    let ladicara = elements.filter((x) => x.templateId === 'D-LADICE').length;
    const busy = elements.filter((e) => e.wall === wl)
      .map((e) => [e.offset, e.offset + e.dims.width])
      .concat(reserved.filter((r) => r.wall === wl).map((r) => [r.start, r.end]))
      .sort((a, b) => a[0] - b[0]);
    const gaps = [];
    let cx = 0;
    busy.forEach(([bs, be]) => { if (bs > cx) gaps.push([cx, bs]); cx = Math.max(cx, be); });
    if (cx < len) gaps.push([cx, len]);
    gaps.forEach(([gs0, ge]) => {
      const freeAt = (x) => {
        const probe = createPlaced('D-VRATA', prof, wl, Math.round(x));
        probe.dims = { ...probe.dims, width: 300 };
        return !collidesWithAny(probe, proj(), room, probe.instanceId);
      };
      let gs = gs0;
      let guard = 0;
      while (gs + 300 <= ge && guard++ < 300 && !freeAt(gs)) gs += 10;
      const pb = perpBlindReach(wl);
      if (pb && pb.side === 'start' && Math.abs(gs - pb.reach) < 20) gs = pb.reach;
      if (pb && pb.side === 'end' && Math.abs(ge - (wallLength(wl, room) - pb.reach)) < 20) {
        ge = wallLength(wl, room) - pb.reach;
      }
      const span = ge - gs;
      if (span < 300) return;
      let n = Math.max(1, Math.round(span / 600));
      while (n > 1 && span / n < 300) n -= 1;
      const each = Math.floor(span / n);
      let x = gs;
      for (let k = 0; k < n; k++) {
        const w = (k === n - 1) ? (ge - x) : each;
        if (w < 300) break;
        const id = ladicara < 2 ? 'D-LADICE' : 'D-VRATA';
        const el2 = tryPut(id, wl, x, null, w);
        if (el2 && id === 'D-LADICE') ladicara++;
        x += w;
      }
    });
  });
  const cooktops = [];
  if (ovenEl && ovenId === 'D-PECNICA') {
    cooktops.push({
      id: 'ct_1', wall: ovenEl.wall,
      offset: Math.round(ovenEl.offset + ovenEl.dims.width / 2),
      widthMm: Math.min(COOKTOP.widthMm, ovenEl.dims.width),
    });
  } else if (ovenEl) {
    const napaW = W('V-NAPA');
    const donji = elements.filter((e) => (templateById(e.templateId) || {}).worktop)
      .filter((e) => e.dims.width >= 500 && e.templateId !== 'D-SUDOPER' && e.templateId !== 'D-MASINA')
      .filter((e) => !sinkEl || e.wall !== sinkWall
        || (e.offset + e.dims.width <= sinkEl.offset - SINK_TO_HOB_MIN)
        || (e.offset >= sinkEl.offset + sinkEl.dims.width + SINK_TO_HOB_MIN));
    let host = null;
    for (const e of donji) {
      const want = e.offset + e.dims.width / 2 - napaW / 2;
      const probe = createPlaced('V-NAPA', prof, e.wall, Math.round(want));
      if (want < 0 || want + napaW > wallLength(e.wall, room)) continue;
      if (!collidesWithAny(probe, proj(), room, probe.instanceId)) { host = e; break; }
    }
    if (host) cooktops.push({ id: 'ct_1', wall: host.wall, offset: Math.round(host.offset + host.dims.width / 2), widthMm: 600 });
    else notes.push('Nema donjeg elementa iznad kojeg može stati napa — ploču postavite ručno.');
  }
  const ct = cooktops[0];
  if (ct) {
    const napaW = W('V-NAPA');
    const napa = seek('V-NAPA', ct.wall, ct.offset - napaW / 2, { mountingType: 'rail' });
    if (!napa) notes.push('Napa se ne može postaviti iznad ploče za kuhanje (prozor ili nedostatak mjesta).');
    else if (Math.abs(napa.offset + napaW / 2 - ct.offset) > 100) {
      notes.push('Napa nije centrirana iznad ploče za kuhanje — provjeriti poziciju.');
    }
  }
  const perpWallCorner = (wl) => {
    let out = null;
    WALLS.forEach((w) => {
      if (!perpendicular(wl, w.id)) return;
      const c = elements.find((e) => e.wall === w.id
        && (templateById(e.templateId) || {}).blindCorner
        && (templateById(e.templateId) || {}).type === 'wall');
      if (!c) return;
      const side = CORNER_WALL[wl].start === w.id ? 'start'
        : (CORNER_WALL[wl].end === w.id ? 'end' : null);
      if (!side) return;
      out = { side, reach: occupiedDepth(c) + (c.mountOffsetMm || 0) };
    });
    return out;
  };
  walls.forEach((wl) => {
    const donji = elements.filter((e) => e.wall === wl && (templateById(e.templateId) || {}).worktop);
    if (!donji.length) return;
    const len = wallLength(wl, room);
    let from = Math.min.apply(null, donji.map((e) => e.offset));
    let to = Math.max.apply(null, donji.map((e) => e.offset + e.dims.width));
    const pc = perpWallCorner(wl);
    if (pc && pc.side === 'start') from = Math.min(from, pc.reach);
    if (pc && pc.side === 'end') to = Math.max(to, len - pc.reach);
    const busy = elements
      .filter((e) => e.wall === wl && ((templateById(e.templateId) || {}).type === 'wall'
        || (templateById(e.templateId) || {}).tallColumn))
      .map((e) => [e.offset, e.offset + e.dims.width])
      .concat(reserved.filter((r) => r.wall === wl).map((r) => [r.start, r.end]))
      .sort((a, b) => a[0] - b[0]);
    const gaps = [];
    let cx2 = from;
    busy.forEach(([bs, be]) => {
      if (bs > cx2) gaps.push([cx2, Math.min(bs, to)]);
      cx2 = Math.max(cx2, be);
    });
    if (cx2 < to) gaps.push([cx2, to]);
    gaps.forEach(([gs0, ge]) => {
      const freeAt = (x) => {
        const probe = createPlaced('V-ELEMENT', prof, wl, Math.round(x));
        probe.dims = { ...probe.dims, width: 300 };
        return !collidesWithAny(probe, proj(), room, probe.instanceId);
      };
      let gs = gs0;
      let guard = 0;
      while (gs + 300 <= ge && guard++ < 300 && !freeAt(gs)) gs += 10;
      let back = 0;
      while (gs > gs0 && back++ < 12 && freeAt(gs - 1)) gs -= 1;
      const span = ge - gs;
      if (span < 250) {
        const cand = elements.filter((e) => e.wall === wl
          && (templateById(e.templateId) || {}).type === 'wall' && e.templateId !== 'V-NAPA');
        const nb = cand.find((e) => Math.abs(e.offset + e.dims.width - gs) < 2)
          || cand.find((e) => Math.abs(e.offset - ge) < 2);
        if (nb && span > 1) {
          const growsRight = Math.abs(nb.offset + nb.dims.width - gs) < 2;
          const test = growsRight
            ? { ...nb, dims: { ...nb.dims, width: nb.dims.width + span } }
            : { ...nb, offset: nb.offset - span, dims: { ...nb.dims, width: nb.dims.width + span } };
          if (!collidesWithAny(test, { elements: elements.filter((x) => x !== nb), obstacles, services }, room, nb.instanceId)) {
            nb.dims = test.dims;
            if (!growsRight) nb.offset = test.offset;
          }
        }
        return;
      }
      let n = Math.max(1, Math.round(span / 600));
      while (n > 1 && span / n < 300) n -= 1;
      const each = Math.floor(span / n);
      let x = gs;
      for (let k = 0; k < n; k++) {
        const w = (k === n - 1) ? (ge - x) : each;
        if (w < 250) break;
        tryPut('V-ELEMENT', wl, x, null, w);
        x += w;
      }
    });
  });
  const triangle = validateTriangle(centerEl(sinkEl), centerEl(ovenEl), centerEl(frEl));
  let mode = 'triangle';
  if (!triangle.ok) {
    mode = 'linear';
    notes.push(triangle.reason
      ? `Radni trokut nije u normi (${triangle.reason}) — raspored je linearni funkcionalni niz: hladnjak → radna ploča → sudoper → pripremna ploča → štednjak.`
      : 'Radni trokut se ne može formirati — primijenjen linearni raspored.');
  }
  return { elements, cooktops, triangle, notes, mode };
}