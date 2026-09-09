// src/engine/panels.js
import { MACHINE, BAND_TRIM_MM, BLIND_GAP_MM } from '../data/tech';
import { profileOf } from '../data/tech';
import { EDGE_TYPES, decorById } from '../data/decors';
import { templateById, recipeOf } from '../data/catalog';
import { RUNNER_SYSTEMS, CORNER_MECHANISMS, runnerCalibrated } from '../data/hardware';
import { r1 } from '../utils/formatters';

export function makePanel({ role, qty, materialKey, length, width, thickness, grain, edges, place }) {
  const e = edges || {};
  if ((!grain || grain === 'none') && !(e.L1 || e.L2 || e.W1 || e.W2) && width > length) {
    const tmp = length; length = width; width = tmp;
  }
  const dWidth  = MACHINE.premilling ? 0 : (e.L1 ? e.L1.thicknessMm : 0) + (e.L2 ? e.L2.thicknessMm : 0);
  const dLength = MACHINE.premilling ? 0 : (e.W1 ? e.W1.thicknessMm : 0) + (e.W2 ? e.W2.thicknessMm : 0);
  const bandMeters = {};
  const addBand = (edge, len) => {
    if (!edge || edge.thicknessMm === 0) return;
    bandMeters[edge.id] = (bandMeters[edge.id] || 0) + ((len + BAND_TRIM_MM) * qty) / 1000;
  };
  addBand(e.L1, length); addBand(e.L2, length);
  addBand(e.W1, width);  addBand(e.W2, width);
  return {
    role, qty, materialKey, thickness,
    grain: grain || 'none',
    rotationAllowed: !grain || grain === 'none',
    finalMm: { length: r1(length), width: r1(width) },
    cutMm:   { length: r1(length - dLength), width: r1(width - dWidth) },
    edges: {
      L1: e.L1 && e.L1.thicknessMm > 0 ? e.L1.id : null,
      L2: e.L2 && e.L2.thicknessMm > 0 ? e.L2.id : null,
      W1: e.W1 && e.W1.thicknessMm > 0 ? e.W1.id : null,
      W2: e.W2 && e.W2.thicknessMm > 0 ? e.W2.id : null,
    },
    bandMeters,
    areaM2: (length * width * qty) / 1e6,
    place: place || [],
  };
}

/** Zajednički naziv dva panela: presjek prefiksa i sufiksa. Prazno = nemaju veze. */
export function commonRole(a, b) {
  if (a === b) return a;
  const A = a.split(' '), B = b.split(' ');
  const pre = [];
  while (pre.length < A.length && pre.length < B.length && A[pre.length] === B[pre.length]) pre.push(A[pre.length]);
  const suf = [];
  while (suf.length + pre.length < A.length && suf.length + pre.length < B.length &&
         A[A.length - 1 - suf.length] === B[B.length - 1 - suf.length]) suf.unshift(A[A.length - 1 - suf.length]);
  return pre.concat(suf).join(' ').trim();
}

export function mergeIdentical(panels) {
  const out = [];
  panels.forEach((p) => {
    const twin = out.find((q) =>
      q.materialKey === p.materialKey && q.thickness === p.thickness && q.grain === p.grain &&
      q.finalMm.length === p.finalMm.length && q.finalMm.width === p.finalMm.width &&
      q.cutMm.length === p.cutMm.length && q.cutMm.width === p.cutMm.width &&
      JSON.stringify(q.edges) === JSON.stringify(p.edges) &&
      commonRole(q.role, p.role) !== '');
    if (twin) {
      twin.qty += p.qty;
      twin.areaM2 += p.areaM2;
      twin.place = twin.place.concat(p.place);
      Object.entries(p.bandMeters).forEach(([id, mm]) => { twin.bandMeters[id] = (twin.bandMeters[id] || 0) + mm; });
      twin.refs.push({ role: p.role, qty: p.qty });
      twin.role = commonRole(twin.role, p.role);
    } else {
      out.push({ ...p, bandMeters: { ...p.bandMeters }, place: p.place.slice(), refs: [{ role: p.role, qty: p.qty }] });
    }
  });
  return out;
}

export function shelfDepth(P, D, tb) {
  if (P.shelf.mode === 'flat') return D - P.shelf.offsetMm;
  const intrusion = P.backMount === 'groove' ? P.backGroove.insetMm + tb : 0;
  return D - intrusion - P.shelf.frontSetbackMm;
}

export function resolveFrontLayout(el, P) {
  const W = el.dims.width, H = el.dims.height;
  const tpl = templateById(el.templateId) || {};
  const spec = el.frontLayout || tpl.frontLayout || {
    edgeRevealMm: P.reveals.perSideMm,
    gapMm: P.reveals.betweenFrontsMm,
    slots: (W > P.twoLeafAboveMm
      ? [{ kind: 'door', role: 'Front (krilo)', widthMm: 'auto', heightMode: 'reveal' },
         { kind: 'door', role: 'Front (krilo)', widthMm: 'auto', heightMode: 'reveal' }]
      : [{ kind: 'door', role: 'Front', widthMm: 'auto', heightMode: 'reveal' }]),
  };
  const n = spec.slots.length;
  const edgeR = spec.edgeRevealMm != null ? spec.edgeRevealMm : P.reveals.perSideMm;
  const gap = spec.gapMm != null ? spec.gapMm : P.reveals.betweenFrontsMm;
  const usable = W - 2 * edgeR - (n - 1) * gap;
  const fixedSum = spec.slots.reduce((a, x) => a + (typeof x.widthMm === 'number' ? x.widthMm : 0), 0);
  const autoCount = spec.slots.filter((x) => typeof x.widthMm !== 'number').length;
  const autoW = autoCount ? Math.round((usable - fixedSum) / autoCount) : 0;
  const widths = spec.slots.map((x) => (typeof x.widthMm === 'number' ? x.widthMm : autoW));
  const drift = usable - widths.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    const i = spec.slots.findIndex((x) => typeof x.widthMm !== 'number');
    if (i >= 0) widths[i] += drift;
  }
  const oh = (el.doorHang === 'overhang') ? 20 : 0;
  let x = edgeR;
  return spec.slots.map((slot, i) => {
    const full = slot.heightMode === 'full';
    const out = {
      role: slot.role || 'Front',
      edgeRole: slot.kind === 'panel' ? 'Blenda' : 'Front',
      kind: slot.kind,
      sizing: typeof slot.widthMm === 'number' ? 'fiksno' : 'auto',
      widthMm: widths[i],
      heightMm: full ? H : H - 2 * P.reveals.perSideMm + oh,
      offsetXmm: x,
      offsetYmm: full ? 0 : P.reveals.perSideMm - oh,
    };
    x += widths[i] + gap;
    return out;
  });
}

export function resolveFrontStack(el, P) {
  const layout = el.frontStack;
  if (!Array.isArray(layout)) return null;
  const n = layout.length;
  if (!n) return [];
  const total = el.dims.height - 2 * P.reveals.perSideMm - (n - 1) * P.reveals.betweenFrontsMm;
  const fixedSum = layout.reduce((s, d) => s + (typeof d.frontHeightMm === 'number' ? d.frontHeightMm : 0), 0);
  const autoCount = layout.filter((d) => typeof d.frontHeightMm !== 'number').length;
  const autoH = autoCount ? Math.round((total - fixedSum) / autoCount) : 0;
  const heights = layout.map((d) => (typeof d.frontHeightMm === 'number' ? d.frontHeightMm : autoH));
  const drift = total - heights.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    const i = layout.findIndex((d) => typeof d.frontHeightMm !== 'number');
    if (i >= 0) heights[i] += drift;
  }
  let y = P.reveals.perSideMm;
  return layout.map((d, i) => {
    const out = { ...d, kind: d.kind || 'drawer', frontHeightMm: heights[i], frontYmm: y };
    y += heights[i] + P.reveals.betweenFrontsMm;
    return out;
  });
}

export function drawerBoxPanels(slot, R, geo, edgesFor) {
  const out = [];
  if (!runnerCalibrated(R)) return out;
  const { innerW, t, D } = geo;
  if (R.boxKind === 'wooden_4side') {
    const tD = R.boxThicknessMm;
    const boxOuterW = innerW - 2 * R.sideClearanceMm;
    const boxInnerW = boxOuterW - 2 * tD;
    const bx = t + R.sideClearanceMm;
    const bz = Math.max(0, D - R.boxDepthMm);
    const by = Math.max(slot.frontYmm + 14, t + 4);
    const h = slot.boxHeightMm;
    out.push(makePanel({
      role: `Ladica ${slot.label} — bok`, qty: 2, materialKey: 'corpus',
      length: R.boxDepthMm, width: h, thickness: tD, grain: 'none',
      edges: edgesFor('Ladica bok'),
      place: [
        { x: bx, y: by, z: bz, w: tD, h, d: R.boxDepthMm },
        { x: bx + boxOuterW - tD, y: by, z: bz, w: tD, h, d: R.boxDepthMm },
      ],
    }));
    const dH = R.endPanelHeightDeltaMm || 0;
    const endH = h + dH;
    const endY = by - dH;
    out.push(makePanel({
      role: `Ladica ${slot.label} — čelo/leđa`, qty: 2, materialKey: 'corpus',
      length: boxInnerW, width: endH, thickness: tD, grain: 'none',
      edges: edgesFor('Ladica čelo'),
      place: [
        { x: bx + tD, y: endY, z: bz, w: boxInnerW, h: endH, d: tD },
        { x: bx + tD, y: endY, z: bz + R.boxDepthMm - tD, w: boxInnerW, h: endH, d: tD },
      ],
    }));
    if (R.bottom.mount === 'groove_sides') {
      const bw = boxOuterW - R.bottom.widthOffsetMm;
      out.push(makePanel({
        role: `Ladica ${slot.label} — pod`, qty: 1, materialKey: R.bottom.materialKey,
        length: R.boxDepthMm, width: bw, thickness: R.bottom.thicknessMm, grain: 'none',
        edges: edgesFor('Ladica pod'),
        place: [{ x: bx + (boxOuterW - bw) / 2, y: by + R.bottom.grooveFromBottomMm,
                  z: bz, w: bw, h: R.bottom.thicknessMm, d: R.boxDepthMm }],
      }));
      out[0].machining = [{
        op: 'groove', for: 'pod ladice',
        fromBottomMm: R.bottom.grooveFromBottomMm, widthMm: R.bottom.grooveWidthMm,
      }];
    } else if (R.bottom.mount === 'nailed_under') {
      out.push(makePanel({
        role: `Ladica ${slot.label} — pod`, qty: 1, materialKey: R.bottom.materialKey,
        length: boxOuterW, width: R.boxDepthMm, thickness: R.bottom.thicknessMm, grain: 'none',
        edges: edgesFor('Ladica pod'),
        place: [{ x: bx, y: by - R.bottom.thicknessMm, z: bz, w: boxOuterW, h: R.bottom.thicknessMm, d: R.boxDepthMm }],
      }));
    } else {
      const g = R.bottom.groove.depthMm;
      out.push(makePanel({
        role: `Ladica ${slot.label} — pod`, qty: 1, materialKey: R.bottom.materialKey,
        length: boxInnerW + 2 * g, width: R.boxDepthMm - 2 * tD + 2 * g,
        thickness: R.bottom.thicknessMm, grain: 'none', edges: edgesFor('Ladica pod'),
        place: [{ x: bx + tD - g, y: by + 10, z: bz + tD - g, w: boxInnerW + 2 * g, h: R.bottom.thicknessMm, d: R.boxDepthMm - 2 * tD + 2 * g }],
      }));
    }
  } else if (R.boxKind === 'metal_side') {
    out.push(makePanel({
      role: `Ladica ${slot.label} — zadnja stijenka`, qty: 1, materialKey: 'corpus',
      length: innerW - R.backWidthOffsetMm, width: R.backHeightMm, thickness: R.boxThicknessMm,
      grain: 'none', edges: edgesFor('Ladica čelo'), place: [],
    }));
    out.push(makePanel({
      role: `Ladica ${slot.label} — pod`, qty: 1, materialKey: R.bottom.materialKey,
      length: innerW - R.bottomWidthOffsetMm, width: R.nominalLengthMm - R.bottomDepthOffsetMm,
      thickness: R.bottom.thicknessMm, grain: 'none', edges: edgesFor('Ladica pod'), place: [],
    }));
  }
  return out;
}

/* --- Glavni izlaz enginea ----------------------------------------------- */
export function computePanels(el) {
  const P  = profileOf(el);
  const W  = el.dims.width, H = el.dims.height, D = el.dims.depth;
  const t  = el.corpus.thicknessMm;
  const tb = el.back.thicknessMm;
  const tf = el.front.thicknessMm;
  const EMAP = { visible: EDGE_TYPES[el.edge.visibleId], hidden: EDGE_TYPES[el.edge.hiddenId] };
  const tpl0 = templateById(el.templateId) || {};
  const OVR = tpl0.edgePatternOverride || {};
  const edgesFor = (role) => {
    const pat = OVR[role] || P.edgePattern[role] || {};
    const out = {};
    ['L1', 'L2', 'W1', 'W2'].forEach((k) => { if (pat[k]) out[k] = EMAP[pat[k]]; });
    return out;
  };
  const grainDecor = decorById(el.corpus.decorId).grain ? 'length' : 'none';
  const frontGrain = decorById(el.front.decorId).grain ? 'length' : 'none';
  const innerW = W - 2 * t;
  const isBase = el.type === 'base';
  const tvW = P.traverseWidthMm;
  const panels = [];
  const RC0 = recipeOf(el);
  if (RC0.sides !== false) panels.push(makePanel({
    role: 'Bok', qty: 2, materialKey: 'corpus', length: H, width: D,
    thickness: t, grain: grainDecor, edges: edgesFor('Bok'),
    place: [
      { x: 0, y: 0, z: 0, w: t, h: H, d: D },
      { x: W - t, y: 0, z: 0, w: t, h: H, d: D },
    ],
  }));
  const RC = recipeOf(el);
  const grooved = RC.back === 'profile' && P.backMount === 'groove';
  const isWall = el.type === 'wall';
  const wg = P.wallGroove || { insetMm: 12, shortenMm: 15 };
  const backIntr = grooved ? (isWall ? wg.insetMm : P.backGroove.insetMm) + tb : 0;
  const horizD = D - ((grooved && isWall) ? wg.shortenMm : 0);
  if (RC.bottom) {
    panels.push(makePanel({
      role: 'Pod', qty: 1, materialKey: 'corpus', length: innerW, width: horizD,
      thickness: t, grain: 'none', edges: edgesFor('Pod'),
      place: [{ x: t, y: 0, z: backIntr, w: innerW, h: t, d: horizD }],
    }));
  }
  const topMode = RC.top === 'auto' ? (isBase ? 'traverses' : 'full') : RC.top;
  if (topMode === 'traverses') {
    const tvSpec = RC.traverses || [
      { widthMm: tvW, at: 'front' }, { widthMm: tvW, at: 'back' },
    ];
    tvSpec.forEach((tv) => {
      const role = tv.at === 'front' ? 'Traverza prednja' : 'Traverza zadnja';
      panels.push(makePanel({
        role, qty: 1, materialKey: 'corpus', length: innerW, width: tv.widthMm,
        thickness: t, grain: 'none', edges: edgesFor(role),
        place: [{ x: t, y: H - t, z: tv.at === 'front' ? D - tv.widthMm : 0, w: innerW, h: t, d: tv.widthMm }],
      }));
    });
  } else if (topMode === 'full') {
    panels.push(makePanel({
      role: 'Plafon', qty: 1, materialKey: 'corpus', length: innerW, width: horizD,
      thickness: t, grain: 'none', edges: edgesFor('Plafon'),
      place: [{ x: t, y: H - t, z: backIntr, w: innerW, h: t, d: horizD }],
    }));
  }
  let dividerTops = [];
  if (RC.dividers && RC.dividers.length) {
    const divD = D - backIntr;
    let prevTop = RC.bottom ? t : 0;
    dividerTops = RC.dividers.map((dv) => {
      let top;
      if (typeof dv.topAtMm === 'number') top = dv.topAtMm;
      else if (typeof dv.openingBelowMm === 'number') top = prevTop + dv.openingBelowMm + t;
      else if (typeof dv.openingAboveMm === 'number') top = (H - t) - dv.openingAboveMm;
      else top = H / 2;
      prevTop = top;
      return top;
    });
    panels.push(makePanel({
      role: RC.dividerRole || 'Pregrada', qty: dividerTops.length, materialKey: 'corpus',
      length: innerW, width: divD,
      thickness: t, grain: 'none', edges: edgesFor(RC.dividerRole || 'Pregrada'),
      place: dividerTops.map((top) => ({ x: t, y: top - t, z: backIntr, w: innerW, h: t, d: divD })),
    }));
  }
  if (el.upperBottomDetail === 'led_mask_18') {
    panels.push(makePanel({
      role: 'LED podložna maska', qty: 1, materialKey: 'corpus',
      length: W, width: D, thickness: t, grain: grainDecor,
      edges: edgesFor('LED maska'),
      place: [{ x: 0, y: -t, z: 0, w: W, h: t, d: D }],
    }));
  }
  if (RC.cornerDistancer) {
    const dw = RC.cornerDistancer.widthMm;
    const bigW = RC.cornerDistancer.mainBlendaMm || 606;
    const outer = (el.cornerBlendaXMm != null ? el.cornerBlendaXMm : bigW + BLIND_GAP_MM);
    const dx = Math.max(0, Math.min(W - tf, outer - tf));
    panels.push(makePanel({
      role: 'Blenda ugaona', qty: 1, materialKey: 'front',
      length: H, width: dw, thickness: tf, grain: frontGrain,
      edges: edgesFor('Blenda'),
      place: [{ x: dx, y: 0, z: D + tf, w: tf, h: H, d: dw }],
    }));
  }
  if (RC.fixedMask) {
    const mh = RC.fixedMask.heightMm;
    panels.push(makePanel({
      role: 'Fiksna maska', qty: 1, materialKey: 'corpus',
      length: innerW, width: mh, thickness: t, grain: 'none',
      edges: edgesFor('Fiksna maska'),
      place: [{ x: t, y: RC.fixedMask.atMm || 0, z: D - t, w: innerW, h: mh, d: t }],
    }));
  }
  const mech = CORNER_MECHANISMS[el.cornerMechanism] || null;
  const shelvesOff = mech && mech.replacesShelf;
  if (el.shelves > 0 && !shelvesOff) {
    const shD = (grooved && isWall) ? horizD : shelfDepth(P, D, tb);
    const shC = P.shelf.sideClearanceMm;
    const z = RC.shelfZone || {};
    const zFrom = z.fromMm === 'firstDivider'
      ? (dividerTops.length ? dividerTops[0] : t)
      : (typeof z.fromMm === 'number' ? z.fromMm : t);
    const zTo = z.toMm === 'firstDivider'
      ? (dividerTops.length ? dividerTops[0] - t : H - t)
      : (typeof z.toMm === 'number' ? z.toMm : H - t);
    panels.push(makePanel({
      role: 'Polica', qty: el.shelves, materialKey: 'corpus',
      length: innerW - shC, width: shD,
      thickness: t, grain: 'none', edges: edgesFor('Polica'),
      place: Array.from({ length: el.shelves }, (_, i) => ({
        x: t + shC / 2,
        y: zFrom + ((zTo - zFrom) * (i + 1)) / (el.shelves + 1) - t / 2,
        z: backIntr, w: innerW - shC, h: t, d: shD,
      })),
    }));
  }
  if (RC.back === 'none') {
    // bez leđa
  } else if (RC.back === 'traverses') {
    const bt = RC.backTraverses || [];
    bt.forEach((x) => {
      panels.push(makePanel({
        role: 'Zadnja traverza', qty: 1, materialKey: 'corpus',
        length: innerW, width: x.heightMm, thickness: t, grain: 'none',
        edges: edgesFor('Zadnja traverza'),
        place: [{ x: t, y: x.at === 'top' ? H - x.heightMm : t, z: 0, w: innerW, h: x.heightMm, d: t }],
      }));
    });
  } else if (RC.back === 'strips') {
    const st = RC.backStrips || [];
    if (st.length) {
      panels.push(makePanel({
        role: 'Leđa', qty: st.length, materialKey: 'back',
        length: W, width: st[0].heightMm, thickness: tb, grain: 'none',
        edges: edgesFor('Leđa'),
        place: st.map((x) => ({
          x: 0, y: x.at === 'top' ? H - x.heightMm : 0, z: -tb,
          w: W, h: x.heightMm, d: tb,
        })),
      }));
    }
  } else if (P.backMount === 'groove') {
    const g = P.backGroove.depthMm;
    const nB = (RC.bottom ? 1 : 0) + (topMode === 'none' ? 0 : 1);
    panels.push(makePanel({
      role: 'Leđa', qty: 1, materialKey: 'back',
      length: W - 2 * t + 2 * g, width: H - nB * t + nB * g,
      thickness: tb, grain: 'none', edges: edgesFor('Leđa'),
      place: [{ x: t, y: t, z: P.backGroove.insetMm, w: W - 2 * t, h: H - 2 * t, d: tb }],
    }));
  } else {
    panels.push(makePanel({
      role: 'Leđa', qty: 1, materialKey: 'back',
      length: H, width: W, thickness: tb, grain: 'none', edges: edgesFor('Leđa'),
      place: [{ x: 0, y: 0, z: -tb, w: W, h: H, d: tb }],
    }));
  }
  const stack = resolveFrontStack(el, P);
  if (stack) {
    const R = RUNNER_SYSTEMS[el.runnerSystemId];
    const r = P.reveals.perSideMm;
    stack.forEach((slot) => {
      if (slot.kind === 'appliance') return;
      const role = slot.kind === 'door' ? `Fronta — ${slot.label}` : `Fronta ladice — ${slot.label}`;
      panels.push(makePanel({
        role, qty: 1, materialKey: 'front',
        length: W - 2 * r, width: slot.frontHeightMm, thickness: tf,
        grain: frontGrain, edges: edgesFor('Fronta ladice'),
        place: [{ x: r, y: slot.frontYmm, z: D, w: W - 2 * r, h: slot.frontHeightMm, d: tf }],
      }));
      if (slot.kind === 'drawer') {
        drawerBoxPanels(slot, R, { innerW, t, D }, edgesFor).forEach((pn) => panels.push(pn));
        if (el.hasInnerDrawer && slot.innerDrawer) {
          const inner = {
            label: 'unutrašnja', boxHeightMm: Math.max(80, Math.round(slot.boxHeightMm * 0.55)),
            frontYmm: slot.frontYmm + 6,
          };
          drawerBoxPanels(inner, R, { innerW, t, D }, edgesFor).forEach((pn) => panels.push(pn));
        }
      }
    });
  } else {
    resolveFrontLayout(el, P).forEach((slot) => {
      const glass = !!el.isGlassDoor && slot.kind === 'door';
      const pn = makePanel({
        role: glass ? `${slot.role} (staklo)` : slot.role, qty: 1, materialKey: 'front',
        length: slot.heightMm, width: slot.widthMm, thickness: tf,
        grain: glass ? 'none' : frontGrain, edges: edgesFor(slot.edgeRole),
        place: [{ x: slot.offsetXmm, y: slot.offsetYmm, z: D, w: slot.widthMm, h: slot.heightMm, d: tf }],
      });
      pn.glass = glass;
      panels.push(pn);
    });
  }
  if (el.flipX) {
    panels.forEach((pn) => {
      pn.place = pn.place.map((pl) => ({ ...pl, x: W - pl.x - pl.w }));
    });
  }
  return mergeIdentical(panels);
}