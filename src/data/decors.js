// src/data/decors.js
/* Baza dekora — ELGRAD cjenovnik MPC 31.08.2026. */

/**
 * Metapodaci cjenovnika.
 *
 * Ponuda mora ostati reproducible: ako se cjenovnik promijeni, stara ponuda ne
 * smije tiho dobiti nove cijene. Zato se `PRICE_LIST` upisuje u svaki sačuvani
 * projekat (`projectSchema`), a pri učitavanju se poredi sa trenutnim — ako se
 * razlikuje, korisnik dobije napomenu umjesto da se čudi zašto se iznos promijenio.
 */
export const PRICE_LIST = {
  source: 'ELGRAD',
  kind: 'MPC',
  effective: '2026-08-31',
  label: 'ELGRAD MPC 31.08.2026.',
};

export const TEX_FAMILY = {
  bijela:  { kind: 'melamin', base: '#F1EFE9', accent: '#DCD8CE', noise: 9,  pore: 0.10, texWorldMm: 700, rough: 0.72, bump: 0.0016 },
  bez:     { kind: 'melamin', base: '#E8E0D2', accent: '#D5CCBB', noise: 9,  pore: 0.10, texWorldMm: 700, rough: 0.72, bump: 0.0016 },
  siva:    { kind: 'melamin', base: '#BFC3C6', accent: '#A9AEB2', noise: 10, pore: 0.12, texWorldMm: 700, rough: 0.74, bump: 0.0017 },
  tamna:   { kind: 'melamin', base: '#41464A', accent: '#33383C', noise: 11, pore: 0.14, texWorldMm: 700, rough: 0.78, bump: 0.0018 },
  crna:    { kind: 'melamin', base: '#26292C', accent: '#1B1E20', noise: 10, pore: 0.14, texWorldMm: 700, rough: 0.80, bump: 0.0018 },
  beton:   { kind: 'melamin', base: '#B6B4B0', accent: '#9C9A96', noise: 14, pore: 0.20, texWorldMm: 900, rough: 0.85, bump: 0.0022 },
  hrast:   { kind: 'drvo', base: '#BFA37B', grain: '#8A6C48', dark: '#5B4529', light: '#D6C09B', lines: 1100, knots: 5, cracks: 26, texWorldMm: 950, rough: 0.66, bump: 0.006 },
  hrastS:  { kind: 'drvo', base: '#C9B79A', grain: '#9C8763', dark: '#6E5B3C', light: '#E0D2B8', lines: 950,  knots: 4, cracks: 18, texWorldMm: 950, rough: 0.68, bump: 0.005 },
  hrastT:  { kind: 'drvo', base: '#8A6A47', grain: '#5E432A', dark: '#3A2817', light: '#A98A63', lines: 1000, knots: 5, cracks: 22, texWorldMm: 950, rough: 0.64, bump: 0.006 },
  orah:    { kind: 'drvo', base: '#6E4B33', grain: '#4A3020', dark: '#2E1C10', light: '#8A6446', lines: 950,  knots: 3, cracks: 18, texWorldMm: 900, rough: 0.60, bump: 0.005 },
};

/* Tipovi ABS traka po katalogu — prošireno sa 2/31 i 1/23 Laser iz cjenovnika */
export const EDGE_TYPES = {
  NONE:   { id: 'NONE',   name: 'bez trake',      thicknessMm: 0,   widthMm: 0,   key: null },
  E04_22: { id: 'E04_22', name: 'ABS 0,4 × 22',   thicknessMm: 0.4, widthMm: 22,  key: 'e04_22' },
  E08_23: { id: 'E08_23', name: 'ABS 0,8 × 23',   thicknessMm: 0.8, widthMm: 23,  key: 'e08_23' },
  E08_43: { id: 'E08_43', name: 'ABS 0,8 × 43',   thicknessMm: 0.8, widthMm: 43,  key: 'e08_43' },
  E2_23:  { id: 'E2_23',  name: 'ABS 2 × 23',     thicknessMm: 2,   widthMm: 23,  key: 'e2_23' },
  E2_28:  { id: 'E2_28',  name: 'ABS 2 × 28',     thicknessMm: 2,   widthMm: 28,  key: 'e2_28' },
  E2_31:  { id: 'E2_31',  name: 'ABS 2 × 31',     thicknessMm: 2,   widthMm: 31,  key: 'e2_31' },
  E2_43:  { id: 'E2_43',  name: 'ABS 2 × 43',     thicknessMm: 2,   widthMm: 43,  key: 'e2_43' },
  E1_110: { id: 'E1_110', name: 'ABS 1(2) × 110', thicknessMm: 1,   widthMm: 110, key: 'e1_110' },
  E1_23L: { id: 'E1_23L', name: 'ABS 1 × 23 Laser', thicknessMm: 1, widthMm: 23, key: 'e1_23l' },
};

/* =========================================================================
   DECOR_DB — Kompletna baza iz ELGRAD cjenovnika MPC 31.08.2026.
   board:   cijena KM/m² po debljini (mm)
   worktop: cijena KM/m' radne ploče 38mm po širini (mm)
   edge:    cijena KM/m' ABS trake po tipu
   ========================================================================= */
export const DECOR_DB = {
  /* ---------- BIJELA ---------- */
  W960:  { code: 'W960',  struct: 'ST7',  name: 'Klasična bijela', fam: 'bijela',
    board: { 10: 25.45, 12: 25.80, 16: 25.05, 18: 26.30, 25: 38.55, 38: 60.00 },
    edge: { e04_22: 0.44, e08_23: 0.80, e08_43: 2.90, e2_28: 2.90, e2_43: 4.25, e1_23l: 4.25 } },
  W1000: { code: 'W1000', struct: 'ST9',  name: 'Bijela premium', fam: 'bijela',
    board: { 10: 34.80, 18: 36.60, 25: 46.75 },
    edge: { e04_22: 0.70, e08_23: 1.25, e1_110: 8.45, e2_23: 1.80, e2_28: 3.15, e2_43: 5.19, e1_23l: 4.25 } },
  W1100: { code: 'W1100', struct: 'ST9',  name: 'Alpin bijela', fam: 'bijela',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  W1200: { code: 'W1200', struct: 'ST9',  name: 'Porculan bijela', fam: 'bijela',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },

  /* ---------- BEŽ / KREM ---------- */
  U104:  { code: 'U104',  struct: 'ST9',  name: 'Alabaster', fam: 'bez',
    board: { 10: 30.60, 18: 32.46, 25: 42.71 },
    edge: { e08_23: 1.35, e2_23: 2.20, e2_28: 3.15, e2_43: 5.19 } },
  U113:  { code: 'U113',  struct: 'ST9',  name: 'Pamuk bež', fam: 'bez',
    board: { 18: 36.50 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U115:  { code: 'U115',  struct: 'ST9',  name: 'Karat bež', fam: 'bez',
    board: { 18: 39.90 },
    edge: { e08_23: 1.25, e08_43: 3.30 } },
  U125:  { code: 'U125',  struct: 'ST9',  name: 'Pješčano žuta', fam: 'bez',
    board: { 18: 44.85 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U156:  { code: 'U156',  struct: 'ST9',  name: 'Pješčano bež', fam: 'bez',
    board: { 18: 36.50 },
    edge: { e08_23: 1.25, e2_23: 2.20, e2_28: 5.19 } },
  U163:  { code: 'U163',  struct: 'ST9',  name: 'Curry žuta', fam: 'bez',
    board: { 18: 44.85 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U201:  { code: 'U201',  struct: 'ST9',  name: 'Šljunak siva', fam: 'siva',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U211:  { code: 'U211',  struct: 'ST9',  name: 'Badem bež', fam: 'bez',
    board: { 18: 42.40 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U216:  { code: 'U216',  struct: 'ST9',  name: 'Came bež', fam: 'bez',
    board: { 18: 36.50 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U220:  { code: 'U220',  struct: 'ST9',  name: 'Nježna bež', fam: 'bez',
    board: { 18: 39.85 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U222:  { code: 'U222',  struct: 'ST9',  name: 'Krema bež', fam: 'bez',
    board: { 18: 34.25 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U250:  { code: 'U250',  struct: 'ST9',  name: 'Karamel bež', fam: 'bez',
    board: { 18: 45.10 },
    edge: { e08_23: 2.90, e08_43: 3.80 } },
  U311:  { code: 'U311',  struct: 'ST9',  name: 'Crvena burgundy', fam: 'siva',
    board: { 18: 42.40 },
    edge: { e08_23: 1.35, e2_28: 5.19 } },
  U321:  { code: 'U321',  struct: 'ST9',  name: 'Crvena kineska', fam: 'siva',
    board: { 18: 42.40 },
    edge: { e08_23: 1.35, e2_28: 5.19 } },
  U325:  { code: 'U325',  struct: 'ST9',  name: 'Antik rose', fam: 'bez',
    board: { 18: 42.40 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U335:  { code: 'U335',  struct: 'ST9',  name: 'Hrđavo crvena', fam: 'siva',
    board: { 18: 44.85 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U350:  { code: 'U350',  struct: 'ST9',  name: 'Siena narančasta', fam: 'bez',
    board: { 18: 0 },
    edge: {} },

  /* ---------- SIVA ---------- */
  U502:  { code: 'U502',  struct: 'ST9',  name: 'Misty plava', fam: 'siva',
    board: { 18: 44.85 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U504:  { code: 'U504',  struct: 'ST9',  name: 'Tirolsko plava', fam: 'siva',
    board: { 18: 42.40 },
    edge: { e08_23: 1.35, e2_28: 5.19 } },
  U525:  { code: 'U525',  struct: 'ST9',  name: 'Delft plava', fam: 'siva',
    board: { 18: 42.40 },
    edge: { e08_23: 1.35, e2_28: 5.19 } },
  U540:  { code: 'U540',  struct: 'ST9',  name: 'Denim plava', fam: 'siva',
    board: { 18: 42.40 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U599:  { code: 'U599',  struct: 'ST9',  name: 'Indigo plava', fam: 'siva',
    board: { 18: 44.85 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U604:  { code: 'U604',  struct: 'ST9',  name: 'Eukaliptus zelena', fam: 'siva',
    board: { 18: 44.85 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U630:  { code: 'U630',  struct: 'ST9',  name: 'Limeta zelena', fam: 'siva',
    board: { 18: 42.40 },
    edge: { e04_22: 0.40, e08_23: 1.35, e2_28: 5.19 } },
  U636:  { code: 'U636',  struct: 'ST9',  name: 'Fjord zelena', fam: 'siva',
    board: { 18: 44.85 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U638:  { code: 'U638',  struct: 'ST9',  name: 'Sage zelena', fam: 'siva',
    board: { 18: 44.85 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U665:  { code: 'U665',  struct: 'ST9',  name: 'Stone zelena', fam: 'siva',
    board: { 18: 44.85 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U669:  { code: 'U669',  struct: 'ST9',  name: 'Estate zelena', fam: 'siva',
    board: { 18: 52.05 },
    edge: { e08_23: 1.76, e08_43: 4.00 } },
  U699:  { code: 'U699',  struct: 'ST9',  name: 'Jela zelena', fam: 'siva',
    board: { 18: 44.85 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U702:  { code: 'U702',  struct: 'ST9',  name: 'Kašmir siva', fam: 'siva',
    board: { 10: 30.60, 18: 32.55, 25: 42.71 },
    worktop: { 600: 68.85 },
    edge: { e08_23: 0.90, e08_43: 1.80, e2_28: 3.45 } },
  U705:  { code: 'U705',  struct: 'ST9',  name: 'Angora siva', fam: 'siva',
    board: { 10: 38.25, 18: 39.90 },
    edge: { e08_23: 1.25, e08_43: 3.30 } },
  U707:  { code: 'U707',  struct: 'ST9',  name: 'Svileno siva', fam: 'siva',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U708:  { code: 'U708',  struct: 'ST9',  name: 'Svijetlo siva', fam: 'siva',
    board: { 10: 30.60, 16: 31.45, 18: 32.46, 25: 42.71 },
    worktop: { 600: 70.25, 920: 128.85 },
    edge: { e04_22: 0.70, e08_23: 0.99, e1_110: 12.80, e2_23: 1.80, e2_28: 3.15, e2_43: 5.19 } },
  U727:  { code: 'U727',  struct: 'ST9',  name: 'Kamen siva', fam: 'siva',
    board: { 10: 38.25, 18: 39.90, 25: 50.15 },
    edge: { e08_23: 1.35, e2_23: 2.20, e2_28: 3.15, e2_43: 5.19 } },
  U732:  { code: 'U732',  struct: 'ST9',  name: 'Prašnjavo siva', fam: 'siva',
    board: { 18: 36.50 },
    edge: { e04_22: 0.70, e08_23: 1.35, e2_23: 2.20, e2_28: 5.19 } },
  U740:  { code: 'U740',  struct: 'ST9',  name: 'Taupe tamna', fam: 'tamna',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U741:  { code: 'U741',  struct: 'ST9',  name: 'Lava siva', fam: 'tamna',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U748:  { code: 'U748',  struct: 'ST9',  name: 'Tartuf smeđa', fam: 'tamna',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e2_28: 5.19 } },
  U750:  { code: 'U750',  struct: 'ST9',  name: 'Siva', fam: 'siva',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U755:  { code: 'U755',  struct: 'ST9',  name: 'Havana siva', fam: 'siva',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U763:  { code: 'U763',  struct: 'ST9',  name: 'Perl siva', fam: 'siva',
    board: { 18: 36.50 },
    edge: { e08_23: 0.90, e08_43: 1.80 } },
  U767:  { code: 'U767',  struct: 'ST9',  name: 'Cubanit siva', fam: 'siva',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U775:  { code: 'U775',  struct: 'ST9',  name: 'Bijelo-siva', fam: 'siva',
    board: { 18: 36.50 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U780:  { code: 'U780',  struct: 'ST9',  name: 'Monument siva', fam: 'siva',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U788:  { code: 'U788',  struct: 'ST9',  name: 'Arktik siva', fam: 'siva',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U818:  { code: 'U818',  struct: 'ST9',  name: 'Tamno smeđa', fam: 'tamna',
    board: { 18: 0 },
    edge: {} },
  U830:  { code: 'U830',  struct: 'ST9',  name: 'Nude karamel', fam: 'bez',
    board: { 18: 44.85 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },

  /* ---------- TAMNA / CRNA ---------- */
  U899:  { code: 'U899',  struct: 'ST9',  name: 'Soft crna', fam: 'crna',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30, e1_110: 12.80 } },
  U960:  { code: 'U960',  struct: 'ST9',  name: 'Onix siva', fam: 'tamna',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U961:  { code: 'U961',  struct: 'ST7',  name: 'Grafitno crna', fam: 'tamna',
    board: { 18: 32.46, 25: 42.71 },
    worktop: { 600: 44.85 },
    edge: { e04_22: 0.70, e08_23: 0.99, e08_43: 3.30, e1_110: 12.69, e2_23: 1.80, e2_28: 3.15 } },
  U963:  { code: 'U963',  struct: 'ST9',  name: 'Dijamant siva', fam: 'tamna',
    board: { 10: 34.80, 16: 35.50, 18: 33.56, 25: 46.75 },
    worktop: { 600: 44.85 },
    edge: { e04_22: 0.60, e08_23: 0.90, e2_23: 1.85, e2_31: 2.15, e2_43: 3.50 } },
  U968:  { code: 'U968',  struct: 'ST9',  name: 'Karbon siva', fam: 'tamna',
    board: { 18: 39.90 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U998:  { code: 'U998',  struct: 'ST38', name: 'Shadow crna', fam: 'crna',
    board: { 18: 53.35 },
    edge: { e08_23: 1.35, e08_43: 3.30 } },
  U999:  { code: 'U999',  struct: 'ST7',  name: 'Crna', fam: 'crna',
    board: { 18: 29.50 },
    worktop: { 600: 44.85 },
    edge: { e04_22: 0.70, e08_23: 0.99, e08_43: 3.30, e2_23: 1.80 } },

  /* ---------- BETON / KAMEN ---------- */
  F186:  { code: 'F186',  struct: 'ST9',  name: 'Chicago beton svijetlo sivi', fam: 'beton',
    board: { 18: 44.85 },
    worktop: { 600: 68.85, 920: 128.04 },
    edge: { e08_23: 1.70, e2_43: 5.96 } },
  F187:  { code: 'F187',  struct: 'ST9',  name: 'Chicago beton tamno sivi', fam: 'beton',
    board: { 18: 44.85 },
    worktop: { 600: 70.80, 920: 128.04 },
    edge: { e08_23: 1.70, e2_43: 5.96 } },
  F205:  { code: 'F205',  struct: 'ST9',  name: 'Pietra Grigia antracit', fam: 'beton',
    board: { 18: 44.85 },
    worktop: { 600: 68.85 },
    edge: { e08_23: 1.70, e2_43: 5.96 } },
  F206:  { code: 'F206',  struct: 'ST9',  name: 'Pietra Grigia crni', fam: 'beton',
    board: { 18: 44.85 },
    worktop: { 600: 68.85, 920: 128.04 },
    edge: { e08_23: 1.70, e2_43: 5.96 } },
  F235:  { code: 'F235',  struct: 'ST76', name: 'Scivaro škriljevac', fam: 'beton',
    board: { 18: 46.91 },
    worktop: { 600: 68.85, 920: 124.50 },
    edge: { e08_23: 1.70, e08_43: 4.50, e2_43: 5.96 } },
  F243:  { code: 'F243',  struct: 'ST76', name: 'Candela mramor svijetlo sivi', fam: 'beton',
    board: { 18: 46.91 },
    worktop: { 600: 68.85 },
    edge: { e08_23: 1.70, e08_43: 4.50, e2_43: 5.96 } },
  F323:  { code: 'F323',  struct: 'ST20', name: 'Cobra bronca', fam: 'beton',
    board: { 18: 46.91 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  F416:  { code: 'F416',  struct: 'ST10', name: 'Laneno bež', fam: 'bez',
    board: { 10: 40.84, 18: 31.10 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  F433:  { code: 'F433',  struct: 'ST10', name: 'Laneno antrazit', fam: 'tamna',
    board: { 18: 44.85 },
    edge: { e08_23: 1.70, e2_43: 6.00 } },
  F528:  { code: 'F528',  struct: 'ST20', name: 'Brušeni metal bronca', fam: 'beton',
    board: { 18: 46.91 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  F685:  { code: 'F685',  struct: 'ST10', name: 'Acapulco', fam: 'beton',
    board: { 18: 44.85 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  F765:  { code: 'F765',  struct: 'ST20', name: 'Srebrno siva četkana', fam: 'siva',
    board: { 18: 39.90 },
    edge: { e08_23: 1.70, e08_43: 4.50, e2_23: 2.90 } },
  F800:  { code: 'F800',  struct: 'ST9',  name: 'Kristalni mramor', fam: 'beton',
    board: { 18: 44.85 },
    worktop: { 600: 68.85, 920: 124.50 },
    edge: { e08_23: 1.70, e08_43: 4.50, e2_43: 5.96 } },

  /* ---------- HRAST / DRVO ---------- */
  H305:  { code: 'H305',  struct: 'ST12', name: 'Tonsberg hrast natur', fam: 'hrastS',
    board: { 18: 44.85 },
    worktop: { 600: 70.80 },
    edge: { e08_23: 1.70, e08_43: 4.50, e2_43: 5.96 } },
  H309:  { code: 'H309',  struct: 'ST12', name: 'Tonsberg hrast smeđi', fam: 'hrastT',
    board: { 18: 44.85 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1113: { code: 'H1113', struct: 'ST10', name: 'Smeđi Kanzas hrast', fam: 'hrastT',
    board: { 18: 39.90 },
    edge: { e08_23: 1.70, e2_43: 6.00 } },
  H1142: { code: 'H1142', struct: 'ST36', name: 'Sacramento hrast smeđi', fam: 'hrastT',
    board: { 18: 53.40 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1145: { code: 'H1145', struct: 'ST10', name: 'Hrast Bardolino natur', fam: 'hrastS',
    board: { 10: 30.60, 18: 30.46, 25: 42.71, 38: 65.30 },
    worktop: { 600: 63.10, 920: 113.70 },
    edge: { e04_22: 0.99, e08_23: 1.21, e1_110: 15.05, e2_23: 2.75, e2_31: 2.50, e2_43: 3.85 } },
  H1176: { code: 'H1176', struct: 'ST37', name: 'Halifax hrast bijeli', fam: 'hrastS',
    board: { 18: 59.55 },
    edge: { e08_23: 1.70, e2_43: 6.00 } },
  H1180: { code: 'H1180', struct: 'ST37', name: 'Halifax hrast natur', fam: 'hrast',
    board: { 10: 56.10, 18: 59.60, 25: 70.15 },
    worktop: { 650: 141.50, 920: 246.10 },
    edge: { e08_23: 1.30, e1_110: 19.05, e2_28: 3.65, e2_43: 4.95 } },
  H1181: { code: 'H1181', struct: 'ST37', name: 'Halifax hrast tobacco', fam: 'hrastT',
    board: { 10: 56.10, 18: 59.55 },
    worktop: { 650: 141.50, 920: 246.10 },
    edge: { e08_23: 1.70, e2_43: 5.96 } },
  H1199: { code: 'H1199', struct: 'ST12', name: 'Termo hrast crno smeđi', fam: 'hrastT',
    board: { 18: 39.90 },
    edge: { e08_23: 1.70, e2_43: 6.00 } },
  H1223: { code: 'H1223', struct: 'ST19', name: 'Sevilla jasen', fam: 'hrastS',
    board: { 10: 41.50, 18: 46.91 },
    edge: { e08_23: 1.70, e08_43: 4.50, e2_23: 2.80 } },
  H1225: { code: 'H1225', struct: 'ST12', name: 'Trondheim jasen', fam: 'hrastS',
    board: { 18: 39.90 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1242: { code: 'H1242', struct: 'ST10', name: 'Sheffield bagrem natur', fam: 'hrastS',
    board: { 18: 44.85 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1250: { code: 'H1250', struct: 'ST36', name: 'Jasen Navarra', fam: 'hrastS',
    board: { 18: 53.35 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1277: { code: 'H1277', struct: 'ST9',  name: 'Lakeland bagrem svijetli', fam: 'hrastS',
    board: { 18: 36.50, 25: 46.75 },
    edge: { e08_23: 1.70, e2_23: 2.75, e2_31: 2.90, e2_43: 5.96 } },
  H1303: { code: 'H1303', struct: 'ST12', name: 'Belmont hrast smeđi', fam: 'hrastT',
    board: { 18: 42.40 },
    worktop: { 600: 68.85 },
    edge: { e08_23: 1.70, e08_43: 4.50, e2_43: 5.96 } },
  H1307: { code: 'H1307', struct: 'ST19', name: 'Warmia orah smeđi', fam: 'orah',
    board: { 18: 46.91 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1312: { code: 'H1312', struct: 'ST10', name: 'Whiteriver hrast pješčani', fam: 'hrastS',
    board: { 18: 44.85 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1313: { code: 'H1313', struct: 'ST10', name: 'Whiteriver hrast sivo-smeđi', fam: 'hrastT',
    board: { 18: 44.85 },
    worktop: { 600: 70.80 },
    edge: { e08_23: 1.70, e2_43: 5.96 } },
  H1316: { code: 'H1316', struct: 'ST17', name: 'Bookmatch hrast', fam: 'hrast',
    board: { 18: 39.85 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1318: { code: 'H1318', struct: 'ST10', name: 'Divlji hrast natur', fam: 'hrast',
    board: { 18: 38.50 },
    worktop: { 600: 68.85, 920: 128.04 },
    edge: { e08_23: 1.21, e1_110: 15.10, e2_43: 3.85 } },
  H1330: { code: 'H1330', struct: 'ST10', name: 'Santa Fe hrast vintage', fam: 'hrastT',
    board: { 18: 44.85 },
    edge: { e08_23: 1.70, e2_43: 6.00 } },
  H1344: { code: 'H1344', struct: 'ST32', name: 'Sherman hrast konjak', fam: 'hrastT',
    board: { 18: 59.55 },
    worktop: { 600: 141.50, 920: 246.10 },
    edge: { e08_23: 1.70, e2_43: 5.96 } },
  H1346: { code: 'H1346', struct: 'ST32', name: 'Sherman hrast antracit', fam: 'hrastT',
    board: { 18: 0 },
    edge: {} },
  H1362: { code: 'H1362', struct: 'ST12', name: 'Baronia hrast svijetli', fam: 'hrastS',
    board: { 18: 42.40 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1367: { code: 'H1367', struct: 'ST40', name: 'Casella hrast svijetli natur', fam: 'hrastS',
    board: { 18: 59.60 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1385: { code: 'H1385', struct: 'ST40', name: 'Casella hrast natur', fam: 'hrast',
    board: { 10: 56.75, 18: 59.60, 25: 63.00 },
    worktop: { 650: 141.50 },
    edge: { e08_23: 1.70, e08_43: 4.50, e2_28: 3.65, e2_43: 5.96 } },
  H1386: { code: 'H1386', struct: 'ST40', name: 'Casella hrast smeđi', fam: 'hrastT',
    board: { 18: 59.60 },
    worktop: { 650: 141.50 },
    edge: { e08_23: 1.70, e08_43: 4.50, e2_43: 5.96 } },
  H1399: { code: 'H1399', struct: 'ST10', name: 'Denver hrast tartuf', fam: 'hrastT',
    board: { 18: 44.85 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1401: { code: 'H1401', struct: 'ST22', name: 'Cascina pinija', fam: 'hrastS',
    board: { 10: 34.60, 18: 38.50 },
    edge: { e08_23: 1.70, e2_43: 6.00 } },
  H1487: { code: 'H1487', struct: 'ST22', name: 'Bramberg smreka', fam: 'hrastS',
    board: { 18: 39.90 },
    edge: { e08_23: 1.70, e2_43: 6.00 } },
  H1636: { code: 'H1636', struct: 'ST12', name: 'Locarno trešnja', fam: 'orah',
    board: { 18: 39.90 },
    edge: { e08_23: 1.70, e2_23: 2.60, e2_43: 6.00 } },
  H1708: { code: 'H1708', struct: 'ST17', name: 'Brighton kesten', fam: 'hrastT',
    board: { 18: 39.90 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1710: { code: 'H1710', struct: 'ST10', name: 'Kentucky kesten pijesak', fam: 'hrastS',
    board: { 18: 44.85 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1714: { code: 'H1714', struct: 'ST19', name: 'Lincoln orah', fam: 'orah',
    board: { 18: 46.91 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1715: { code: 'H1715', struct: 'ST12', name: 'Parona orah', fam: 'orah',
    board: { 18: 39.90 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H1732: { code: 'H1732', struct: 'ST9',  name: 'Breza pijesak', fam: 'hrastS',
    board: { 18: 32.46, 25: 42.71 },
    edge: { e08_23: 1.70, e08_43: 4.50, e2_28: 3.65 } },
  H1910: { code: 'H1910', struct: 'ST9',  name: 'Willow bukva', fam: 'hrastS',
    board: { 18: 32.46, 25: 42.71 },
    edge: { e08_23: 1.70, e08_43: 4.50, e2_28: 3.65 } },
  H2033: { code: 'H2033', struct: 'ST10', name: 'Hunton hrast tamni', fam: 'hrastT',
    board: { 18: 44.85 },
    worktop: { 600: 68.85, 920: 124.50 },
    edge: { e08_23: 1.70, e2_43: 5.96 } },
  H3003: { code: 'H3003', struct: 'ST19', name: 'Norwich hrast', fam: 'hrast',
    board: { 18: 0 },
    edge: {} },
  H3012: { code: 'H3012', struct: 'ST22', name: 'Coco Bolo natur', fam: 'orah',
    board: { 10: 32.65, 18: 39.90 },
    edge: { e08_23: 2.00, e2_43: 5.96 } },
  H3043: { code: 'H3043', struct: 'ST12', name: 'Eukaliptus tamno smeđi', fam: 'hrastT',
    board: { 18: 32.46 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3131: { code: 'H3131', struct: 'ST12', name: 'Hrast Davos natur', fam: 'hrastS',
    board: { 18: 38.50 },
    edge: { e08_23: 1.70, e2_43: 6.15 } },
  H3133: { code: 'H3133', struct: 'ST12', name: 'Davos hrast tartuf smeđi', fam: 'hrastT',
    board: { 18: 39.90 },
    worktop: { 600: 68.85 },
    edge: { e08_23: 1.70, e2_43: 5.96 } },
  H3146: { code: 'H3146', struct: 'ST19', name: 'Lorenzo hrast bež-sivi', fam: 'hrastS',
    board: { 18: 46.91 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3152: { code: 'H3152', struct: 'ST19', name: 'Vicenza hrast bijeljeni', fam: 'hrastS',
    board: { 18: 46.91 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3154: { code: 'H3154', struct: 'ST36', name: 'Charleston hrast tamno smeđi', fam: 'hrastT',
    board: { 18: 53.35 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3156: { code: 'H3156', struct: 'ST12', name: 'Corbridge hrast sivi', fam: 'hrastT',
    board: { 18: 39.90 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3157: { code: 'H3157', struct: 'ST12', name: 'Vicenza hrast', fam: 'hrast',
    board: { 10: 38.25, 18: 38.10, 25: 50.15 },
    worktop: { 600: 68.85 },
    edge: { e08_23: 1.60, e08_43: 4.50, e2_43: 5.96 } },
  H3170: { code: 'H3170', struct: 'ST12', name: 'Kendal hrast natur', fam: 'hrastS',
    board: { 18: 42.40 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3176: { code: 'H3176', struct: 'ST37', name: 'Halifax hrast kositar', fam: 'hrastT',
    board: { 18: 59.55 },
    worktop: { 600: 134.00, 650: 141.50 },
    edge: { e08_23: 1.70, e2_43: 5.96 } },
  H3190: { code: 'H3190', struct: 'ST19', name: 'Fineline metallic antracit', fam: 'tamna',
    board: { 18: 0 },
    edge: {} },
  H3195: { code: 'H3195', struct: 'ST19', name: 'Fineline bijeli', fam: 'bijela',
    board: { 10: 44.16, 18: 46.91 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3197: { code: 'H3197', struct: 'ST19', name: 'Fineline srednje sivi', fam: 'siva',
    board: { 18: 46.91 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3198: { code: 'H3198', struct: 'ST19', name: 'Fineline tamno sivi', fam: 'tamna',
    board: { 18: 46.91 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3303: { code: 'H3303', struct: 'ST10', name: 'Hamilton hrast natur', fam: 'hrast',
    board: { 10: 38.25, 18: 39.25, 25: 50.15 },
    worktop: { 600: 63.10, 920: 116.95 },
    edge: { e04_22: 0.99, e08_23: 2.00, e1_110: 15.10, e2_23: 1.95, e2_31: 3.45, e2_43: 5.96 } },
  H3309: { code: 'H3309', struct: 'ST28', name: 'Hrast Gladstone pijesak', fam: 'hrastS',
    board: { 18: 59.55 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3317: { code: 'H3317', struct: 'ST28', name: 'Cuneo hrast smeđi', fam: 'hrastT',
    board: { 18: 59.60 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3322: { code: 'H3322', struct: 'ST17', name: 'Rovato hrast svijetli natur', fam: 'hrastS',
    board: { 18: 39.85 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3325: { code: 'H3325', struct: 'ST28', name: 'Hrast Gladstone Tobacco', fam: 'hrastT',
    board: { 18: 59.55 },
    worktop: { 600: 101.35 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3331: { code: 'H3331', struct: 'ST10', name: 'Nebraska hrast natur', fam: 'hrastS',
    board: { 10: 40.84, 18: 40.10 },
    worktop: { 600: 68.85, 920: 128.04 },
    edge: { e08_23: 1.70, e1_110: 15.10, e2_43: 5.96 } },
  H3359: { code: 'H3359', struct: 'ST32', name: 'Davenport hrast svijetli natur', fam: 'hrastS',
    board: { 18: 59.60 },
    worktop: { 650: 141.50 },
    edge: { e08_23: 1.70, e08_43: 4.50, e2_43: 5.96 } },
  H3395: { code: 'H3395', struct: 'ST12', name: 'Corbridge hrast natur', fam: 'hrastS',
    board: { 18: 36.50 },
    edge: { e08_23: 1.70, e2_43: 6.15 } },
  H3398: { code: 'H3398', struct: 'ST12', name: 'Kendal hrast konjak', fam: 'hrastT',
    board: { 18: 36.64 },
    edge: { e08_23: 1.70, e2_43: 6.00 } },
  H3430: { code: 'H3430', struct: 'ST22', name: 'Aland pinija bijela', fam: 'bijela',
    board: { 18: 39.90 },
    edge: { e08_23: 1.70, e2_43: 6.00 } },
  H3433: { code: 'H3433', struct: 'ST22', name: 'Aland pinija polarna', fam: 'bijela',
    board: { 18: 39.90 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3450: { code: 'H3450', struct: 'ST22', name: 'Fleetwood bijeli', fam: 'bijela',
    board: { 18: 0 },
    edge: {} },
  H3700: { code: 'H3700', struct: 'ST10', name: 'Pacific orah natur', fam: 'orah',
    board: { 18: 39.90 },
    edge: { e04_22: 1.21, e08_43: 4.31 } },
  H3702: { code: 'H3702', struct: 'ST10', name: 'Orah Pacific tobacco', fam: 'orah',
    board: { 18: 39.90, 25: 50.15 },
    worktop: { 600: 24.06 },
    edge: { e08_23: 2.00, e2_28: 3.45, e2_43: 5.96 } },
  H3710: { code: 'H3710', struct: 'ST12', name: 'Carini orah natur', fam: 'orah',
    board: { 18: 42.40 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3730: { code: 'H3730', struct: 'ST10', name: 'Hikori natur', fam: 'orah',
    board: { 18: 42.40 },
    worktop: { 600: 68.85, 920: 128.04 },
    edge: { e08_23: 1.30, e2_43: 5.96 } },
  H3734: { code: 'H3734', struct: 'ST9',  name: 'Orah Dijon natur', fam: 'orah',
    board: { 18: 32.46 },
    worktop: { 600: 44.85 },
    edge: { e04_22: 0.99, e08_23: 1.70, e2_23: 2.60, e2_43: 6.00 } },
  H3786: { code: 'H3786', struct: 'ST19', name: 'Bolivar Wood natur', fam: 'orah',
    board: { 18: 48.30 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3787: { code: 'H3787', struct: 'ST19', name: 'Bolivar Wood smeđi', fam: 'orah',
    board: { 18: 48.30 },
    edge: { e08_23: 1.70, e08_43: 4.50 } },
  H3840: { code: 'H3840', struct: 'ST9',  name: 'Mandal javor natur', fam: 'hrastS',
    board: { 18: 36.50 },
    edge: { e08_23: 1.70, e2_43: 6.00 } },
  H3860: { code: 'H3860', struct: 'ST9',  name: 'Javor champagne', fam: 'hrastS',
    board: { 18: 0 },
    edge: {} },
  H7586: { code: 'H7586', struct: 'ST17', name: 'Alba orah tobacco', fam: 'orah',
    board: { 18: 39.45 },
    edge: { e08_23: 1.70, e08_43: 5.15 } },
};

/* HDF za leđa — cjenovnik ga vodi zasebno */
export const HDF_PRICE_M2 = 8.90;

/** Runtime mapa dekora: baza + recept teksture + izvedene vrijednosti. */
export const DECORS = (() => {
  const out = {};
  Object.values(DECOR_DB).forEach((d) => {
    const th = Object.keys(d.board).map(Number).sort((a, b) => a - b);
    out[d.code] = {
      id: d.code, code: d.code, struct: d.struct,
      name: `${d.name} ${d.struct}`,
      shortName: d.name,
      fam: d.fam,
      tex: TEX_FAMILY[d.fam],
      color: TEX_FAMILY[d.fam].base,
      grain: TEX_FAMILY[d.fam].kind === 'drvo',
      thicknesses: th,
      board: d.board,
      worktop: d.worktop || null,
      edge: d.edge || {},
      pricePerM2: d.board[18] || d.board[th[0]],
      /* Format ploče na kojoj se ovaj dekor kupuje. `null` = standardna iverica
         2800×2070. Medijapan visoki sjaj ide na 2800×1220, pa se bez ovoga
         iskorištenje i broj ploča računaju po pogrešnom formatu. */
      boardType: d.boardType || null,
    };
  });
  return out;
})();

/** Cijena m² ploče za dati dekor i debljinu; najbliža dostupna ako nema tačne. */
export function boardPriceOf(decorId, thicknessMm) {
  const d = DECORS[decorId];
  if (!d) return 0;
  if (d.board[thicknessMm] != null) return d.board[thicknessMm];
  const near = d.thicknesses.reduce((a, b) =>
    Math.abs(b - thicknessMm) < Math.abs(a - thicknessMm) ? b : a, d.thicknesses[0]);
  return d.board[near];
}

/** Debljine u kojima dekor STVARNO postoji. */
export const thicknessesOf = (decorId) => (DECORS[decorId] ? DECORS[decorId].thicknesses : [18]);

/**
 * Sigurnosni dekor za ID kojeg nema u bazi. Cijene su 0 da se greška vidi u
   ponudi, a `missing: true` da je UI može označiti. Engine zahvaljujući ovome
 * ne pada na projektu sačuvanom sa dekorom koji je u međuvremenu izbačen.
 */
export const FALLBACK_DECOR = {
  id: '?', code: '?', struct: '', name: 'Nepoznat dekor', shortName: 'Nepoznat dekor',
  fam: 'siva', tex: TEX_FAMILY.siva, color: TEX_FAMILY.siva.base, grain: false,
  thicknesses: [18], board: { 18: 0 }, worktop: null, edge: {}, pricePerM2: 0,
  boardType: null, missing: true,
};

/** Dekor po ID-u, sa sigurnosnom vrijednošću umjesto `undefined`. */
export const decorById = (decorId) => DECORS[decorId]
  || { ...FALLBACK_DECOR, id: decorId, code: decorId, name: `Nepoznat dekor (${decorId})`, shortName: decorId };

export const decorExists = (decorId) => !!DECORS[decorId];

/** Cijena m' ABS trake: zavisi i od dekora i od tipa trake. */
export function edgePriceOf(decorId, edgeId) {
  const e = EDGE_TYPES[edgeId];
  if (!e || !e.key) return 0;
  const d = DECORS[decorId];
  if (!d || d.edge[e.key] == null) return 0;
  return d.edge[e.key];
}

/** Cijena m' radne ploče 38 mm za dekor i širinu; null ako dekor nije u ponudi. */
export function worktopPriceOf(decorId, widthMm) {
  const d = DECORS[decorId];
  if (!d || !d.worktop) return null;
  const keys = Object.keys(d.worktop).map(Number).sort((a, b) => a - b);
  const k = keys.find((x) => x >= widthMm) || keys[keys.length - 1];
  return d.worktop[k];
}

/* `worktopDecors()` je obrisan — `DecorPicker` već filtrira preko
   `filter={(d) => !!d.worktop}` u LeftRail-u, pa je helper bio mrtav kod. */

/**
 * Upisuje novi dekor u bazu u toku rada. Baza je obični objekat, pa se
 * dekor odmah vidi svuda gdje se cijena i debljina računaju.
 */
export function registerDecor(spec) {
  const code = (spec.code || '').trim().toUpperCase();
  if (!code) return null;
  const fam = TEX_FAMILY[spec.fam] ? spec.fam : 'siva';
  const board = {};
  (spec.board || []).forEach((r) => {
    const t = Number(r.t), p = Number(r.p);
    if (t > 0 && p > 0) board[t] = p;
  });
  if (!Object.keys(board).length) board[18] = Number(spec.price18) || 0;
  const edge = {};
  Object.entries(spec.edge || {}).forEach(([k, v]) => { if (Number(v) > 0) edge[k] = Number(v); });
  const worktop = {};
  (spec.worktop || []).forEach((r) => {
    const w = Number(r.w), p = Number(r.p);
    if (w > 0 && p > 0) worktop[w] = p;
  });
  const th = Object.keys(board).map(Number).sort((a, b) => a - b);
  const existed = !!DECOR_DB[code];
  DECOR_DB[code] = { code, struct: spec.struct || '', name: spec.name || code, fam, board, edge,
    worktop: Object.keys(worktop).length ? worktop : null,
    boardType: spec.boardType || null };
  DECORS[code] = {
    id: code, code, struct: spec.struct || '',
    name: `${spec.name || code} ${spec.struct || ''}`.trim(),
    shortName: spec.name || code,
    fam, tex: TEX_FAMILY[fam], color: TEX_FAMILY[fam].base,
    grain: TEX_FAMILY[fam].kind === 'drvo',
    thicknesses: th, board, worktop: Object.keys(worktop).length ? worktop : null, edge,
    pricePerM2: board[18] || board[th[0]],
    boardType: spec.boardType || null,
    custom: true,
    /* `userEdited` razlikuje dekor koji je korisnik IZMIJENIO od onog koji je
       došao sa cjenovnikom — kod izmjene postojećeg artikla to je važno, jer
       se originalna cijena više ne može vratiti bez ponovnog uvoza cjenovnika. */
    userEdited: existed,
  };
  return code;
}

/**
 * Parsira CSV cjenovnik dekora.
 *
 * Format (separator `;` ili `,`, prvi red je zaglavlje ako prepoznat):
 *   šifra;naziv;struktura;porodica;debljina;cijena_m2[;debljina2;cijena2 …]
 *
 * Zašto CSV a ne JSON: cjenovnik dobijate od dobavljača u tabeli, i to je format
 * u kojem ga trgovina već održava. `DECOR_DB` je 636 linija hardkodovanog koda —
 * svaka izmjena cijene značila je diranje izvornog koda i ponovno build-ovanje.
 *
 * @returns {{items: Array, errors: Array<string>}}
 */
export function parseDecorCSV(text) {
  const items = [];
  const errors = [];
  if (!text || !String(text).trim()) return { items, errors: ['Datoteka je prazna.'] };

  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  const detectSep = (line) => (line.split(';').length >= line.split(',').length ? ';' : ',');

  lines.forEach((line, idx) => {
    const sep = detectSep(line);
    const f = line.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
    if (f.length < 4) { errors.push(`Red ${idx + 1}: premalo kolona (${f.length}).`); return; }

    const code = (f[0] || '').toUpperCase();
    // Zaglavlje i prazni redovi se preskaču bez greške
    if (!code || /^(sifra|šifra|code|red\.?|br\.?|r\.?br\.?)$/i.test(code)) return;
    if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
      errors.push(`Red ${idx + 1}: šifra „${f[0]}" nije ispravna (dozvoljeni su slova, cifre, - i _).`);
      return;
    }

    const name = f[1] || code;
    const struct = f[2] || '';
    const fam = f[3] || '';

    // Parovi (debljina, cijena) od kolone 4 nadalje
    const board = [];
    for (let i = 4; i + 1 < f.length; i += 2) {
      const t = Number(String(f[i]).replace(',', '.'));
      const p = Number(String(f[i + 1]).replace(',', '.'));
      if (!(t > 0)) { errors.push(`Red ${idx + 1} (${code}): neispravna debljina „${f[i]}".`); break; }
      if (!(p > 0)) { errors.push(`Red ${idx + 1} (${code}): neispravna cijena „${f[i + 1]}".`); break; }
      board.push({ t, p });
    }
    if (!board.length) {
      errors.push(`Red ${idx + 1} (${code}): nema nijednog para debljina/cijena.`);
      return;
    }
    items.push({ code, name, struct, fam, board, edge: {}, worktop: [], line: idx + 1 });
  });

  return { items, errors };
}

/**
 * Primjenjuje parsirani CSV na bazu. Vraća broj novih i izmijenjenih dekora.
 */
export function applyDecorRows(rows) {
  let added = 0, updated = 0;
  (rows || []).forEach((r) => {
    if (!r || !r.code) return;
    const postojao = !!DECORS[r.code];
    registerDecor(r);
    if (postojao) updated += 1; else added += 1;
  });
  return { added, updated, total: added + updated };
}