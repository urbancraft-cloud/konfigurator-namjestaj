// src/data/catalog.js

export const CATALOG = [
  { templateId: 'D-VRATA', name: 'Standardni donji', short: 'D', type: 'base', dims: { width: { min: 300, max: 1200, step: 10, default: 600 }, height: { min: 600, max: 900, step: 10, default: 720 }, depth: { min: 300, max: 650, step: 10, default: 550 } }, elevation: 150, worktop: true, shelves: 1 },
  { templateId: 'D-LADICE', name: 'Ladičar 1+2', short: 'DL', type: 'base', innerDrawerCapable: true, dims: { width: { min: 300, max: 900, step: 10, default: 600 }, height: { min: 600, max: 900, step: 10, default: 720 }, depth: { min: 450, max: 650, step: 10, default: 550 } }, elevation: 150, worktop: true, shelves: 0, runnerSystemId: 'GTV_BALL_500', frontStack: [ { label: 'duboka', frontHeightMm: 'auto', boxHeightMm: 200, innerDrawer: true }, { label: 'duboka', frontHeightMm: 'auto', boxHeightMm: 200 }, { label: 'plitka', frontHeightMm: 146, boxHeightMm: 100 } ] },
  { templateId: 'D-UGAO-SLIJEPI', name: 'Slijepi ugao', short: 'DU', type: 'base', dims: { width: { min: 800, max: 1200, step: 10, default: 1000 }, height: { min: 600, max: 900, step: 10, default: 720 }, depth: { min: 500, max: 650, step: 10, default: 550 } }, elevation: 150, worktop: true, blindCorner: true, shelves: 1, mountOffsetMm: 0, edgePatternOverride: { 'Polica': { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' } }, cornerDistancer: { widthMm: 40, mainBlendaMm: 606 }, cornerMechanism: true, frontLayout: { edgeRevealMm: 0, gapMm: 4, slots: [ { kind: 'panel', role: 'Blenda', widthMm: 606, heightMode: 'full' }, { kind: 'door', role: 'Front', widthMm: 'auto', heightMode: 'reveal' } ] } },
  { templateId: 'V-ELEMENT', name: 'Viseći element', short: 'V', type: 'wall', dims: { width: { min: 300, max: 1000, step: 10, default: 600 }, height: { min: 400, max: 1200, step: 1, default: 992 }, depth: { min: 280, max: 400, step: 1, default: 321 } }, elevation: 1508, worktop: false, shelves: 2, corpusRecipe: { bottom: true, top: 'full', back: 'profile', dividers: [] } },
  { templateId: 'H-FRIZIDER', name: 'Ormar za ugradbeni frižider', short: 'HF', type: 'tall', dims: { width: { min: 550, max: 700, step: 10, default: 600 }, height: { min: 1700, max: 2200, step: 1, default: 1818 }, depth: { min: 500, max: 650, step: 10, default: 550 } }, elevation: 150, worktop: false, overheadAbove: true, tallColumn: true, shelves: 0, corpusRecipe: { bottom: true, top: 'full', back: 'strips', dividers: [], backStrips: [{ heightMm: 200, at: 'bottom' }, { heightMm: 200, at: 'top' }] }, applianceSlot: 'FRIDGE_1782', applianceChoices: ['FRIDGE_1782', 'FRIDGE_1772', 'FRIDGE_1225'], frontStack: [ { kind: 'door', label: 'donja', frontHeightMm: 716 }, { kind: 'door', label: 'gornja', frontHeightMm: 'auto' } ] },
  { templateId: 'D-LADICE-4', name: 'Ladičar 4 jednake', short: 'DL4', type: 'base', dims: { width: { min: 300, max: 900, step: 10, default: 450 }, height: { min: 600, max: 900, step: 10, default: 720 }, depth: { min: 450, max: 650, step: 10, default: 550 } }, elevation: 150, worktop: true, shelves: 0, runnerSystemId: 'GTV_BALL_500', frontStack: [ { label: 'jednaka', frontHeightMm: 'auto', boxHeightMm: 120 }, { label: 'jednaka', frontHeightMm: 'auto', boxHeightMm: 120 }, { label: 'jednaka', frontHeightMm: 'auto', boxHeightMm: 120 }, { label: 'jednaka', frontHeightMm: 'auto', boxHeightMm: 120 } ] },
  { templateId: 'D-PECNICA', name: 'Donji za pećnicu', short: 'DP', type: 'base', dims: { width: { min: 550, max: 700, step: 10, default: 600 }, height: { min: 700, max: 900, step: 10, default: 720 }, depth: { min: 500, max: 650, step: 10, default: 550 } }, elevation: 150, worktop: true, shelves: 0, corpusRecipe: { bottom: true, top: 'traverses', traverses: [{ widthMm: 80, at: 'back' }, { widthMm: 20, at: 'front' }], dividers: [{ openingAboveMm: 582 }], back: 'strips', backStrips: [{ heightMm: 120, at: 'bottom' }] }, edgePatternOverride: { 'Traverza prednja': { L1: 'visible' } }, runnerSystemId: 'GTV_BALL_500', frontStack: [ { kind: 'drawer', label: 'donja', frontHeightMm: 116, boxHeightMm: 65 }, { kind: 'appliance', label: 'pećnica', frontHeightMm: 596 } ] },
  { templateId: 'H-PECNICA', name: 'Visoki za pećnicu i mikrotalasnu', short: 'HP', type: 'tall', dims: { width: { min: 550, max: 700, step: 10, default: 600 }, height: { min: 1500, max: 2200, step: 1, default: 1720 }, depth: { min: 500, max: 650, step: 10, default: 550 } }, elevation: 150, worktop: false, overheadAbove: true, tallColumn: true, shelves: 0, corpusRecipe: { bottom: true, top: 'full', back: 'strips', backStrips: [{ heightMm: 720, at: 'bottom' }], dividers: [ { topAtMm: 720 }, { openingBelowMm: 582 } ], shelfZone: { fromMm: 18, toMm: 'firstDivider' } }, runnerSystemId: 'GTV_BALL_500', defaultVariant: 'vrata', frontVariants: { vrata: { label: 'Vrata na šarke + polica', shelves: 1, frontStack: [ { kind: 'door', label: 'donji odjeljak', frontHeightMm: 716 }, { kind: 'appliance', label: 'pećnica', frontHeightMm: 596 }, { kind: 'appliance', label: 'mikrotalasna', frontHeightMm: 'auto' } ] }, ladice: { label: 'Tri ladice 1+2', shelves: 0, frontStack: [ { kind: 'drawer', label: 'duboka', frontHeightMm: 281, boxHeightMm: 200 }, { kind: 'drawer', label: 'duboka', frontHeightMm: 281, boxHeightMm: 200 }, { kind: 'drawer', label: 'plitka', frontHeightMm: 146, boxHeightMm: 100 }, { kind: 'appliance', label: 'pećnica', frontHeightMm: 596 }, { kind: 'appliance', label: 'mikrotalasna', frontHeightMm: 'auto' } ] } } },
  { templateId: 'V-NAPA', name: 'Gornji za ugradbenu napu', short: 'VN', type: 'wall', dims: { width: { min: 500, max: 900, step: 10, default: 600 }, height: { min: 400, max: 1200, step: 1, default: 952 }, depth: { min: 280, max: 400, step: 1, default: 300 } }, elevation: 1548, elevationOffsetMm: 40, worktop: false, alignFrontDepth: true, shelves: 1, corpusRecipe: { bottom: false, top: 'full', back: 'profile', dividers: [{ openingBelowMm: 150 }], dividerRole: 'Pod', shelfZone: { fromMm: 'firstDivider', toMm: 'top' }, fixedMask: { heightMm: 150, atMm: 0 } } },
  { templateId: 'V-UGAO-SLIJEPI', name: 'Gornji slijepi ugao', short: 'VU', type: 'wall', dims: { width: { min: 700, max: 1200, step: 10, default: 900 }, height: { min: 400, max: 1200, step: 1, default: 992 }, depth: { min: 280, max: 400, step: 1, default: 321 } }, elevation: 1508, worktop: false, blindCorner: true, shelves: 2, corpusRecipe: { bottom: true, top: 'full', back: 'profile' }, edgePatternOverride: { 'Polica': { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' } }, frontLayout: { edgeRevealMm: 0, gapMm: 4, slots: [ { kind: 'panel', role: 'Blenda', widthMm: 321, heightMode: 'full' }, { kind: 'door', role: 'Front', widthMm: 'auto', heightMode: 'reveal' } ] } },
  { templateId: 'D-SUDOPER', name: 'Donji za sudoper', short: 'DS', type: 'base', dims: { width: { min: 600, max: 1200, step: 10, default: 800 }, height: { min: 600, max: 900, step: 10, default: 720 }, depth: { min: 450, max: 650, step: 10, default: 500 } }, elevation: 150, worktop: true, sinkBasin: true, mountOffsetMm: 50, shelves: 0, corpusRecipe: { bottom: true, top: 'traverses', traverses: [{ widthMm: 100, at: 'back' }, { widthMm: 100, at: 'front' }], back: 'traverses', backTraverses: [{ heightMm: 100, at: 'bottom' }, { heightMm: 100, at: 'top' }] }, edgePatternOverride: { 'Bok': { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' }, 'Pod': { L1: 'visible', L2: 'visible' } } },
  { templateId: 'D-MASINA', name: 'Mašina za suđe (niša)', short: 'DM', type: 'base', dims: { width: { min: 450, max: 600, step: 150, default: 600 }, height: { min: 600, max: 900, step: 10, default: 720 }, depth: { min: 500, max: 650, step: 10, default: 550 } }, elevation: 150, worktop: true, shelves: 0, corpusRecipe: { sides: false, bottom: false, top: 'none', back: 'none' } },
  { templateId: 'H-NADGRADNJA', name: 'Nadgradnja iznad visokog', short: 'HN', type: 'wall', dims: { width: { min: 300, max: 1200, step: 10, default: 600 }, height: { min: 150, max: 900, step: 1, default: 532 }, depth: { min: 300, max: 650, step: 10, default: 550 } }, elevation: 1968, worktop: false, shelves: 0, corpusRecipe: { bottom: true, top: 'full', back: 'profile' } },
];

/**
 * Šablon elementa po ID-u. Za nepoznat ID vraća sigurnosni šablon sa
 * `missing: true` umjesto `undefined` — stariji sačuvani projekti mogu sadržavati
 * tipove koji su u međuvremenu izbačeni iz kataloga, a engine ne smije pasti.
 * Postojanje stvarnog šablona provjeriti sa `templateExists(id)`.
 */
export const FALLBACK_TEMPLATE = {
  templateId: '?', name: 'Nepoznat element (nije u katalogu)', short: '?', type: 'base',
  dims: {
    width:  { min: 0, max: 99999, step: 10, default: 600 },
    height: { min: 0, max: 99999, step: 10, default: 720 },
    depth:  { min: 0, max: 99999, step: 10, default: 550 },
  },
  elevation: 150, shelves: 0, worktop: false, missing: true,
};

export const templateExists = (id) => CATALOG.some((t) => t.templateId === id);

export const templateById = (id) =>
  CATALOG.find((t) => t.templateId === id) || { ...FALLBACK_TEMPLATE, templateId: id };

export const RECIPE_DEFAULT = { sides: true, bottom: true, top: 'auto', back: 'profile', dividers: [], shelfZone: null, cornerDistancer: null };

export const recipeOf = (el) => {
  const tpl = templateById(el.templateId) || {};
  return { ...RECIPE_DEFAULT, ...(tpl.corpusRecipe || {}), cornerDistancer: tpl.cornerDistancer || null };
};

export function variantOf(tpl, key) {
  if (!tpl.frontVariants) return null;
  return tpl.frontVariants[key] || tpl.frontVariants[tpl.defaultVariant];
}

export function createInstance(templateId, profileId, variantKey) {
  const tpl = templateById(templateId);
  const vKey = tpl.frontVariants ? (variantKey || tpl.defaultVariant) : null;
  const v = variantOf(tpl, vKey);
  return {
    instanceId: nextInstanceId(), templateId, type: tpl.type, profileId,
    dims: { width: tpl.dims.width.default, height: tpl.dims.height.default, depth: tpl.dims.depth.default },
    corpus: { decorId: 'W1000', thicknessMm: 18 },
    front: { materialId: 'MDF_F', decorId: 'W1000', thicknessMm: 18 },
    back: { thicknessMm: 3 },
    edge: { visibleId: 'E2_23', hiddenId: 'E08_23' },
    shelves: v ? v.shelves : (tpl.shelves ?? 0),
    frontVariant: vKey,
    mountOffsetMm: tpl.mountOffsetMm || 0,
    frontLayout: tpl.frontLayout ? JSON.parse(JSON.stringify(tpl.frontLayout)) : null,
    runnerSystemId: tpl.runnerSystemId || null,
    applianceId: tpl.applianceSlot || null,
    cornerMechanism: tpl.cornerMechanism ? 'shelves' : null,
    hasInnerDrawer: false, upperBottomDetail: 'standard', doorHang: 'flush',
    mountingType: 'hangers', isGlassDoor: false, handleId: 'RUCKA_160', hingeSide: 'left',
    frontStack: v ? v.frontStack.map((d) => ({ ...d })) : (Array.isArray(tpl.frontStack) ? tpl.frontStack.map((d) => ({ ...d })) : null),
  };
}

export const SHAPES = [
  { id: 'ravna', label: 'Ravna', walls: ['top'] },
  { id: 'L', label: 'L-kuhinja', walls: ['top', 'left'] },
  { id: 'U', label: 'U-kuhinja', walls: ['top', 'left', 'right'] },
];

export const shapeWalls = (id) => (SHAPES.find((x) => x.id === id) || SHAPES[0]).walls;

export const ROOM_KINDS = [
  { id: 'kuhinja', label: 'Kuhinja' }, { id: 'hodnik', label: 'Hodnik' },
  { id: 'spavaca', label: 'Spavaća soba' }, { id: 'dnevni', label: 'Dnevni boravak' },
  { id: 'wc', label: 'WC / kupatilo' },
];

/* ---------------------------------------------------------------------------
   Jedinstveni ID-jevi instanci.

   Prije je ovdje stajao `let _seq = 0` i `el_${_seq}`. Brojač je modul-lokalan,
   pa se nakon osvježavanja stranice vraćao na 0: učitan projekat je već imao
   el_1..el_N, a prvi novododati element bi dobio el_1 — dupli ID. Posljedica:
   patch() mijenja oba elementa, removeElement() briše oba, React key je dupli.

   Sada se ID sastoji od vremenske komponente, lokalnog brojača i nasumičnog
   sufiksa, a `_usedIds` pamti sve izdate ID-jeve (uključujući one preuzete iz
   sačuvanog projekta preko `adoptInstanceIds`).
--------------------------------------------------------------------------- */
let _seq = 0;
const _usedIds = new Set();

/** Registruje ID koji nije izdao ovaj generator (npr. učitan iz localStorage). */
export function adoptInstanceIds(ids) {
  (Array.isArray(ids) ? ids : [ids]).forEach((id) => { if (id) _usedIds.add(id); });
}

/** Preuzima sve ID-jeve iz projekta, uključujući izvedene nadgradnje (`_nad`). */
export function adoptProjectIds(project) {
  (project?.elements || []).forEach((e) => {
    if (!e || !e.instanceId) return;
    _usedIds.add(e.instanceId);
    _usedIds.add(`${e.instanceId}_nad`);
  });
  return project;
}

export function nextInstanceId() {
  let id;
  let guard = 0;
  do {
    _seq += 1;
    id = `el_${Date.now().toString(36)}_${_seq.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  } while (_usedIds.has(id) && guard++ < 50);
  _usedIds.add(id);
  return id;
}

export function createPlaced(templateId, profileId, wall, offset, variantKey) {
  const el = createInstance(templateId, profileId, variantKey);
  const tpl = templateById(templateId);
  el.wall = wall;
  el.offset = offset;
  el.elevation = tpl.elevation != null ? tpl.elevation : (tpl.type === 'wall' ? 1508 : 150);
  el.handleId = 'RUCKA_160';
  el.hingeSide = 'left';
  el.handle = 'RUCKA';
  return el;
}

export function cornerElementsFor(shape, room, withUpper) {
  const out = [];
  const dw = templateById('D-UGAO-SLIJEPI').dims.width.default;
  const vw = templateById('V-UGAO-SLIJEPI').dims.width.default;
  const put = (id, off) => out.push(createPlaced(id, 'SERIJA_KUCANO', 'top', off));
  if (shape === 'L' || shape === 'U') {
    put('D-UGAO-SLIJEPI', 0);
    if (withUpper) put('V-UGAO-SLIJEPI', 0);
  }
  if (shape === 'U') {
    put('D-UGAO-SLIJEPI', Math.max(0, room.width - dw));
    if (withUpper) put('V-UGAO-SLIJEPI', Math.max(0, room.width - vw));
  }
  return out;
}

export const GROUPS = [
  { id: 'base', label: 'Donji elementi', test: (t) => t.type === 'base' },
  { id: 'wall', label: 'Viseći elementi', test: (t) => t.type === 'wall' },
  { id: 'tall', label: 'Visoki elementi', test: (t) => t.type === 'tall' },
];