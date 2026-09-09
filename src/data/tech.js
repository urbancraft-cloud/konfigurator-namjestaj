// src/data/tech.js

export const BAND_TRIM_MM = 60;

export const MACHINE = {
  premilling: true,
  note: 'Kanterica sa predglodalom: cutMm = finalMm',
};

export const TECH_PROFILES = {
  SERIJA_KANAL: {
    id: 'SERIJA_KANAL', name: 'Serija A — leđa u kanalu',
    backMount: 'groove', backGroove: { depthMm: 5, insetMm: 10 },
    traverseWidthMm: 100,
    shelf: { mode: 'flat', offsetMm: 20, sideClearanceMm: 0 },
    reveals: { perSideMm: 2, betweenFrontsMm: 4 },
    twoLeafAboveMm: 600,
    edgePattern: {
      'Bok':              { L1: 'visible' }, 'Pod': { L1: 'visible' }, 'Plafon': { L1: 'visible' },
      'Traverza prednja': { L1: 'hidden' }, 'Traverza zadnja': {}, 'Polica': { L1: 'visible' },
      'Pregrada':         { L1: 'visible' }, 'Fiksna maska': { L1: 'visible' },
      'Distancer':        { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' },
      'LED maska':        { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' },
      'Leđa':             {}, 'Ladica bok': { L1: 'visible' }, 'Ladica čelo': { L1: 'visible' },
      'Ladica pod':       {}, 'Fronta ladice': { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' },
      'Blenda':           { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' },
      'Front':            { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' },
    },
  },
  SERIJA_KUCANO: {
    id: 'SERIJA_KUCANO', name: 'Serija B — leđa na zakucavanje',
    backMount: 'nailed', backGroove: null,
    traverseWidthMm: 80,
    shelf: { mode: 'flat', offsetMm: 20, sideClearanceMm: 0 },
    reveals: { perSideMm: 2, betweenFrontsMm: 4 },
    twoLeafAboveMm: 600,
    edgePattern: {
      'Bok':              { L1: 'visible', W1: 'visible', W2: 'visible' }, 'Pod': { L1: 'visible' },
      'Plafon':           { L1: 'visible' }, 'Traverza prednja': { L1: 'visible', L2: 'visible' },
      'Traverza zadnja':  { L1: 'visible', L2: 'visible' }, 'Polica': { L1: 'visible' },
      'Pregrada':         { L1: 'visible' }, 'Fiksna maska': { L1: 'visible' },
      'Distancer':        { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' },
      'LED maska':        { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' },
      'Leđa':             {}, 'Ladica bok': { L1: 'visible' }, 'Ladica čelo': { L1: 'visible' },
      'Ladica pod':       {}, 'Fronta ladice': { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' },
      'Blenda':           { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' },
      'Front':            { L1: 'visible', L2: 'visible', W1: 'visible', W2: 'visible' },
    },
  },
};

export const profileOf = (el) => TECH_PROFILES[el.profileId] || TECH_PROFILES.SERIJA_KANAL;

export const WASTE_FACTOR = 1.15;
export const LABOR_PER_PANEL = 1.5;
export const LABOR_PER_BAND_M = 1.2;
export const LABOR_ASSEMBLY = 18.0;
export const VAT_RATE = 0.17;
export const FRONT_PRICE = { MDF_F: 54.0, MDF_L: 89.0, LTD: 26.0, STAKLO: 132.0 };

export const WALLS = [
  { id: 'top', label: 'Gornji zid' }, { id: 'right', label: 'Desni zid' },
  { id: 'bottom', label: 'Donji zid' }, { id: 'left', label: 'Lijevi zid' },
];

export const WORKTOP   = { depthMm: 600, thicknessMm: 38, maxPieceMm: 4100 };
export const WALLPANEL = { thicknessMm: 10, heightMm: 600, maxPieceMm: 4100 };
export const SOCLE     = { heightMm: 150, recessMm: 100, thicknessMm: 18, maxPieceMm: 4100 };
export const TOPMASK   = { heightMm: 100, thicknessMm: 18, maxPieceMm: 4100 };
export const LEDMASK   = { thicknessMm: 20, maxPieceMm: 4100 };
export const ENDPANEL  = { thicknessMm: 18 };
export const COOKTOP   = { widthMm: 600, depthMm: 520, cutoutMarginMm: 50 };

/* ---------------------------------------------------------------------------
   Formati ploča za optimizaciju krojenja.

   `grainLocksRotation: true` znači da se panel sa teksturom (drvo) NE smije
   rotirati — šara mora ići u istom smjeru na cijeloj kuhinji. Paneli bez
   teksture (`rotationAllowed`) smiju se okrenuti ako tako bolje stanu.

   `kerfMm` je širina lista pile: svaki rez pojede toliko materijala, pa se
   mora uračunati između dva panela (ne i na rubu ploče).
--------------------------------------------------------------------------- */
/*
 * Formati ploča po TIPU ploče, ne po debljini.
 *
 * Razlog: ista debljina od 18 mm postoji i kao iverica (2800×2070) i kao
 * medijapan visoki sjaj (2800×1220) — a to su dvije različite ploče sa
 * različitim formatom i različitim iskorištenjem. Zato dekor nosi `boardType`,
 * a format se traži prvo po tipu, pa po debljini.
 */
export const SHEET_FORMATS = {
  /* Iverica (LTD / melamin) — standardni format */
  iverica:        { label: 'Iverica 2800×2070', widthMm: 2800, heightMm: 2070, grainLocksRotation: true },
  /* Medijapan visoki sjaj — uži format (potvrđeno od pogona) */
  medijapan_sjaj: { label: 'Medijapan visoki sjaj 2800×1220', widthMm: 2800, heightMm: 1220, grainLocksRotation: true },
  /* HDF za leđa — bez zaključane teksture, smije se rotirati */
  hdf:            { label: 'HDF 2800×2070', widthMm: 2800, heightMm: 2070, grainLocksRotation: false },
  /* Radne ploče 38 mm — dugački format */
  radna_ploca:    { label: 'Radna ploča 4100×600', widthMm: 4100, heightMm: 600, grainLocksRotation: true },
};

/** Tipovi ploča za izbor u UI-u. */
export const BOARD_TYPES = [
  { id: 'iverica',        label: 'Iverica 2800×2070' },
  { id: 'medijapan_sjaj', label: 'Medijapan visoki sjaj 2800×1220' },
  { id: 'hdf',            label: 'HDF 2800×2070 (leđa)' },
  { id: 'radna_ploca',    label: 'Radna ploča 4100×600' },
];

/** Format ploče po debljini unutar tipa (iverica i HDF dijele dimenzije). */
export const SHEETS = {
  '18': { widthMm: 2800, heightMm: 2070, grainLocksRotation: true },
  '25': { widthMm: 2800, heightMm: 2070, grainLocksRotation: true },
  '38': { widthMm: 4100, heightMm: 600,  grainLocksRotation: true },
  '10': { widthMm: 2800, heightMm: 2070, grainLocksRotation: true },
  '16': { widthMm: 2800, heightMm: 2070, grainLocksRotation: true },
  '12': { widthMm: 2800, heightMm: 2070, grainLocksRotation: true },
  '3':  { widthMm: 2800, heightMm: 2070, grainLocksRotation: false },
};

/**
 * Format ploče za (tip, debljina).
 *
 * @param {number} thicknessMm
 * @param {string} [boardType] `iverica` | `medijapan_sjaj` | `hdf` | `radna_ploca`
 */
export function sheetFor(thicknessMm, boardType) {
  const t = Number(thicknessMm);
  const fmt = SHEET_FORMATS[boardType];
  if (fmt) return { thicknessMm: t, boardType, ...fmt };
  const byThickness = SHEETS[String(t)];
  /* Bez eksplicitnog tipa prepoznajemo format po debljini: 38 mm je radna ploča
     (4100×600), 3 mm je HDF leđa, sve ostalo je iverica 2800×2070. */
  if (byThickness) {
    const inferred = t === 38 ? 'radna_ploca' : (t === 3 ? 'hdf' : 'iverica');
    return { thicknessMm: t, boardType: inferred, ...SHEET_FORMATS[inferred] };
  }
  // Nepoznata debljina → najbliža poznata
  const known = Object.keys(SHEETS).map(Number)
    .sort((a, b) => Math.abs(a - t) - Math.abs(b - t));
  const k = String(known[0] != null ? known[0] : 18);
  return { thicknessMm: Number(k), boardType: 'iverica', ...SHEETS[k] };
}

/* ---------------------------------------------------------------------------
   Obračun materijala po PLOČAMA.

   `WASTE_FACTOR = 1,15` je procjena po neto površini panela. U stvarnosti se
   materijal kupuje u cijelim pločama, a ploča se NE može dijeliti između
   različitih dekora — pa grupa sa dva sitna komada (završna maska, coklo, LED
   maska) troši cijelu ploču od 5,8 m². Izmjereno na referentnoj kuhinji:
   stvarni otpad 49,9 % naspram pretpostavljenih 15 %.

   Pravilo pogona: ako grupa panela zauzima MANJE od jedne cijele ploče,
   računa se **pola ploče**. Inače se računa onoliko cijelih ploča koliko
   stvarno ode (zaokruženo na više).
--------------------------------------------------------------------------- */
/** Dijelova ploče koji se računaju kad grupa ne popuni cijelu ploču. */
export const MIN_SHEET_FRACTION = 0.5;

/**
 * Potrošnja ploča za jednu grupu (isti materijal + ista debljina).
 * @returns {{sheetAreaMm2:number, panelAreaMm2:number, sheets:number, fractionOfSheet:number}}
 */
export function sheetConsumption(panelAreaMm2, sheetAreaMm2) {
  const area = Math.max(0, Number(panelAreaMm2) || 0);
  const sheet = Number(sheetAreaMm2) > 0 ? Number(sheetAreaMm2) : 1;
  const fraction = area / sheet;
  const sheets = fraction <= 1 ? MIN_SHEET_FRACTION : Math.ceil(fraction);
  return { sheetAreaMm2: sheet, panelAreaMm2: area, sheets, fractionOfSheet: fraction };
}

export const SAW_KERF_MM = 4;

/**
 * Margina koju treba ostaviti po obodu ploče za hvatanje i obradu ruba.
 * Nula po difoltu — pogon sam odlučuje; može se postaviti kroz `optimizeCutList`.
 */
export const SHEET_TRIM_MM = 0;

export const BLIND_GAP_MM = 40;
export const CORNER_WALL = {
  top:    { start: 'left', end: 'right' }, bottom: { start: 'left', end: 'right' },
  left:   { start: 'top',  end: 'bottom' }, right:  { start: 'top',  end: 'bottom' },
};

export const LEG_HEIGHTS = [100, 150];
export const CORPUS_BASE_H = 720;
export const WALL_DEPTH_MM = 321;