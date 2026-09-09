// src/engine/bom.js

import { templateById } from '../data/catalog';
import { decorById, EDGE_TYPES } from '../data/decors';
import { PROFILES } from '../data/profiles';
import { WALLS, WORKTOP, WALLPANEL, SOCLE, TOPMASK, ENDPANEL, FRONT_PRICE } from '../data/tech';

/** Šifra grupe za HDF leđa — vidi `engine/cutting.js` za cijenu. */
export const HDF_GROUP_ID = '__HDF__';

/** Naziv zida bez pada ako `wall` nije u listi (stariji sačuvani projekti). */
const wallLabel = (id) => (WALLS.find((w) => w.id === id) || { label: id || '?' }).label;
import { computePanels } from './panels';
import { r1 } from '../utils/formatters';
import { computeHardware, surfacesCost } from './pricing';

/**
 * Krojna lista.
 * @param {object} [precomputedSurfaces] već izračunat `surfacesCost(project, room)`
 *        — vidi napomenu u `pricing.js`. Bez ovoga se površine računaju još jednom.
 */
export function computeBOM(project, room, precomputedSurfaces) {
  const rows = [], bandTotals = {}, hwTotals = {}, boardTotals = {};
  project.elements.forEach((el, idx) => {
    const tpl = templateById(el.templateId);
    computePanels(el).forEach((p) => {
      const matName = p.materialKey === 'front' ? `Front ${decorById(el.front.decorId).name}`
        : p.materialKey === 'back' ? 'HDF 3 mm' : decorById(el.corpus.decorId).name;
      rows.push({
        pos: idx + 1, element: `${tpl.short}${idx + 1} · ${tpl.name}`,
        role: p.role, qty: p.qty, material: matName, thickness: p.thickness,
        cutL: p.cutMm.length, cutW: p.cutMm.width,
        finL: p.finalMm.length, finW: p.finalMm.width,
        edges: p.edges, rotationAllowed: p.rotationAllowed, areaM2: p.areaM2,
        /* `decorId` i `boardType` su potrebni za obračun po pločama: cijena po m²
           zavisi od dekora, a format ploče od tipa ploče (medijapan visoki sjaj
           je 2800×1220, iverica 2800×2070). Bez ovoga se moglo grupisati samo po
           NAZIVU materijala, što nije dovoljno za cijenu. */
        materialKey: p.materialKey,
        /* HDF leđa se ne vode po dekoru — cjenovnik ih ima kao posebnu stavku
           (`HDF_PRICE_M2`). Zato dobijaju svoju šifru grupe, a `cutting.js`
           za nju koristi tu cijenu umjesto `boardPriceOf`. */
        decorId: p.materialKey === 'front' ? el.front.decorId
          : p.materialKey === 'back' ? HDF_GROUP_ID : el.corpus.decorId,
        boardType: p.materialKey === 'back' ? 'hdf'
          : decorById(p.materialKey === 'front' ? el.front.decorId : el.corpus.decorId).boardType,
      });
      const key = `${matName} / ${p.thickness} mm`;
      boardTotals[key] = (boardTotals[key] || 0) + p.areaM2;
      Object.entries(p.bandMeters).forEach(([id, mm]) => { bandTotals[id] = (bandTotals[id] || 0) + mm; });
    });
    computeHardware(el, project).forEach((h) => {
      if (!hwTotals[h.id]) hwTotals[h.id] = { ...h, qty: 0 };
      hwTotals[h.id].qty += h.qty;
    });
    /* Količine u metrima (gola profil, alu lajsne) sabiru se u floating pointu,
       pa bi bez zaokruživanja u krojnu listu išlo npr. 11.299999999999997 m. */
  });
  const sc = precomputedSurfaces || surfacesCost(project, room);
  const wpDecor = decorById(project.wallPanelDecorId || project.worktopDecorId);
  /* Cijena po m² kojom se ova površina stvarno obračunava.
     Završne maske se u `surfacesCost` računaju po `FRONT_PRICE.MDF_F` (MDF, bez
     obzira na prikazani dekor) — pa se ISTA cijena mora koristiti i kod obračuna
     po pločama, inače bi dva načina obračuna polazila od različitih osnova. */
  const surfacePriceM2 = (flag) => (flag === 'zm' ? FRONT_PRICE.MDF_F : null);

  const pushSurface = (pc, i, label, decor, flag) => rows.push({
    pos: '—', element: `${label} ${pc.segId}`,
    role: `Komad ${i + 1} · ${wallLabel(pc.wall)}${pc.onSeam ? '' : ' · rez van ivice'}`,
    qty: 1, material: `${label} ${decor.name}`, thickness: pc.thicknessMm,
    cutL: pc.lengthMm, cutW: pc.crossMm, finL: pc.lengthMm, finW: pc.crossMm,
    edges: { L1: null, L2: null, W1: null, W2: null },
    rotationAllowed: false, areaM2: (pc.lengthMm * pc.crossMm) / 1e6,
    surface: flag,
    materialKey: 'surface',
    decorId: decor.id || decor.code || null,
    /* `surfaceFlag` razlikuje radnu ploču od obloge, cokla, maske i LED maske iako
       dijele isti dekor — potrebna je za ispravan naziv grupe u planu krojenja. */
    surfaceFlag: flag,
    boardType: flag === 'wt' ? 'radna_ploca'
      : flag === 'led' ? 'medijapan_sjaj'
        : (decor.boardType || null),
    sheetPriceM2: surfacePriceM2(flag),
  });
  sc.wt.pieces.forEach((pc, i) => pushSurface(pc, i, 'Radna ploča', decorById(project.worktopDecorId), 'wt'));
  sc.wp.pieces.forEach((pc, i) => pushSurface(pc, i, 'Zidna obloga', wpDecor, 'wp'));
  sc.sk.pieces.forEach((pc, i) => pushSurface(pc, i, 'Coklo', decorById(project.socleDecorId || project.worktopDecorId), 'sk'));
  sc.gm.pieces.forEach((pc, i) => pushSurface(pc, i, 'Gornja maska',
    decorById(project.topMaskDecorId || project.wallPanelDecorId || project.worktopDecorId), 'gm'));
  sc.zm.pieces.forEach((pc, i) => pushSurface(pc, i,
    pc.kind === 'base' ? 'Završna maska donja'
      : pc.kind === 'tall' ? (pc.trimmedForSocle ? 'Završna maska visoka (uz coklo)' : 'Završna maska visoka')
        : 'Završna maska gornja',
    decorById(project.endPanelDecorId || project.worktopDecorId), 'zm'));
  sc.led.pieces.forEach((pc, i) => pushSurface(pc, i, 'LED maska', wpDecor, 'led'));
  const wtKey = `Radna ploča ${decorById(project.worktopDecorId).name} / ${WORKTOP.thicknessMm} mm`;
  if (sc.wt.areaM2 > 0) boardTotals[wtKey] = (boardTotals[wtKey] || 0) + sc.wt.areaM2;
  const wpKey = `Zidna obloga ${wpDecor.name} / ${WALLPANEL.thicknessMm} mm`;
  if (sc.wp.areaM2 > 0) boardTotals[wpKey] = (boardTotals[wpKey] || 0) + sc.wp.areaM2;
  const skKey = `Coklo ${decorById(project.socleDecorId || project.worktopDecorId).name} / ${SOCLE.thicknessMm} mm`;
  if (sc.sk.areaM2 > 0) boardTotals[skKey] = (boardTotals[skKey] || 0) + sc.sk.areaM2;
  const gmDecor = decorById(project.topMaskDecorId || project.wallPanelDecorId || project.worktopDecorId);
  const gmKey = `Gornja maska ${gmDecor.name} / ${TOPMASK.thicknessMm} mm`;
  if (sc.gm.areaM2 > 0) boardTotals[gmKey] = (boardTotals[gmKey] || 0) + sc.gm.areaM2;
  const zmDecor = decorById(project.endPanelDecorId || project.worktopDecorId);
  const zmKey = `Završna maska ${zmDecor.name} / ${ENDPANEL.thicknessMm} mm`;
  if (sc.zm.areaM2 > 0) boardTotals[zmKey] = (boardTotals[zmKey] || 0) + sc.zm.areaM2;
  Object.values(hwTotals).forEach((h) => {
    if (h.unit === 'm') h.qty = r1(h.qty);
  });
  Object.keys(bandTotals).forEach((k) => { bandTotals[k] = r1(bandTotals[k]); });
  return {
    rows, bandTotals, hwTotals: Object.values(hwTotals), boardTotals,
    worktop: sc.wt, wallPanel: sc.wp, socle: sc.sk, topMask: sc.gm, endPanels: sc.zm, ledMask: sc.led,
    profileMeters: sc.profileMeters,
    surfaceNotes: sc.wt.notes.concat(sc.wp.notes, sc.sk.notes, sc.gm.notes),
  };
}

/**
 * CSV polje sa escaping-om.
 *
 * Separator je `;`, a nazivi dekora i panela dolaze iz cjenovnika i mogu ga
 * sadržavati (npr. "ABS 0,8 × 23; laser"). Bez quotinga bi se kolone pomjerile
 * i Excel bi otvorio neispravnu krojnu listu.
 */
export function csvField(v) {
  const s = v == null ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function bomToCSV(bom) {
  const head = ['Poz', 'Element', 'Panel', 'Kom', 'Materijal', 'Deb', 'Kroj D', 'Kroj S', 'Gotovo D', 'Gotovo S', 'L1', 'L2', 'W1', 'W2', 'Tekstura'];
  const lines = [head.map(csvField).join(';')];
  bom.rows.forEach((r) => lines.push([
    r.pos, r.element, r.role, r.qty, r.material, r.thickness,
    r.cutL, r.cutW, r.finL, r.finW,
    r.edges.L1 || '-', r.edges.L2 || '-', r.edges.W1 || '-', r.edges.W2 || '-',
    r.rotationAllowed ? 'slobodno' : 'zakljucano',
  ].map(csvField).join(';')));
  lines.push('', 'RUBNE TRAKE;duzni metri');
  // `EDGE_TYPES[id]` i `PROFILES[id]` bez zaštite: nepoznat id (npr. iz starijeg
  // projekta ili ručno upisanog lajsne) bacao je TypeError pri izvozu.
  Object.entries(bom.bandTotals).forEach(([id, m]) => lines.push(
    `${csvField((EDGE_TYPES[id] || { name: id }).name)};${m.toFixed(2)}`));
  lines.push('', 'ALU LAJSNE;duzni metri');
  Object.entries(bom.profileMeters).forEach(([id, m]) => lines.push(
    `${csvField((PROFILES[id] || { name: id }).name)};${m.toFixed(2)}`));
  lines.push('', 'OKOV;kolicina;jedinica');
  bom.hwTotals.forEach((h) => lines.push(
    `${csvField(h.name || h.id)};${h.qty};${csvField(h.unit || 'kom')}`));
  return lines.join('\n');
}