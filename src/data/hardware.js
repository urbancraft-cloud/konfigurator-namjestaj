// src/data/hardware.js

export const RUNNER_SYSTEMS = {
  GTV_BALL_500: {
    id: 'GTV_BALL_500', vendor: 'GTV', name: 'GTV kuglične 500 mm',
    boxKind: 'wooden_4side', nominalLengthMm: 500,
    sideClearanceMm: 13, boxThicknessMm: 18, boxDepthMm: 500,
    bottom: { mount: 'nailed_under', materialKey: 'back', thicknessMm: 3, groove: null },
    constraints: { minInnerWidthMm: 250, minInnerDepthMm: 500 },
    pricePerSet: 9.5, verified: true, source: 'Kalibrisano na krojnu listu pogona',
  },
  BLUM_TANDEM_500: {
    id: 'BLUM_TANDEM_500', vendor: 'Blum', name: 'Blum TANDEM / Tandembox 500 mm',
    boxKind: 'wooden_4side', nominalLengthMm: 500,
    sideClearanceMm: 5, boxThicknessMm: 16, boxDepthMm: 490,
    endPanelHeightDeltaMm: -15,
    bottom: { mount: 'groove_sides', materialKey: 'back', thicknessMm: 3, widthOffsetMm: 18, grooveFromBottomMm: 12, grooveWidthMm: 3 },
    constraints: { minInnerWidthMm: 250, minInnerDepthMm: 500 },
    pricePerSet: 28.0, verified: true, source: 'Kalibrisano po specifikaciji pogona',
  },
  BLUM_LEGRABOX_M_500: {
    id: 'BLUM_LEGRABOX_M_500', vendor: 'Blum', name: 'Blum LEGRABOX M 500 mm',
    boxKind: 'metal_side', nominalLengthMm: 500, boxThicknessMm: 16,
    backHeightMm: null, backWidthOffsetMm: null, bottomWidthOffsetMm: null, bottomDepthOffsetMm: null,
    bottom: { mount: 'system', materialKey: 'back', thicknessMm: 16, groove: null },
    constraints: { minInnerWidthMm: null, minInnerDepthMm: null },
    pricePerSet: 62.0, verified: false, source: 'Konstante se unose iz Blum tehničkog lista',
  },
};

export function runnerCalibrated(R) {
  if (!R) return false;
  const need = R.boxKind === 'wooden_4side'
    ? [R.sideClearanceMm, R.boxThicknessMm, R.boxDepthMm]
    : [R.backHeightMm, R.backWidthOffsetMm, R.bottomWidthOffsetMm, R.bottomDepthOffsetMm];
  if (R.boxKind === 'wooden_4side' && R.bottom.mount === 'groove') need.push(R.bottom.groove && R.bottom.groove.depthMm);
  return (R.verified === true || R.verified === 'partial') && need.every((v) => typeof v === 'number');
}

export const runnerPartial = (R) => !!R && R.verified === 'partial';

export const APPLIANCES = {
  FRIDGE_1782: { id: 'FRIDGE_1782', kind: 'fridge', name: 'Ugradbeni frižider, niša 1782 mm', nicheHeightMm: 1782, nicheWidthMm: 560, nicheDepthMm: 550, bottomFrontMm: 716, verified: true, source: 'Standardna niša 1782; donja fronta 716, gornja prati ostatak otvora' },
  FRIDGE_1225: { id: 'FRIDGE_1225', kind: 'fridge', name: 'Ugradbeni frižider, niša 1225 mm', nicheHeightMm: 1225, nicheWidthMm: 560, nicheDepthMm: 550, bottomFrontMm: 716, verified: true, source: 'Polu-visoki aparat; donja fronta 716, gornja prati ostatak' },
  FRIDGE_1772: { id: 'FRIDGE_1772', name: 'Ugradbeni frižider, niša 1772 mm', nicheHeightMm: 1772, nicheWidthMm: 560, nicheDepthMm: 550, frontPanels: 'frontStack', ventilationBackOpen: true, verified: true, source: 'Niša 1772 mm; donja fronta 716 mm zadana, gornja uzima ostatak' },
};

export const CORNER_MECHANISMS = {
  shelves:      { id: 'shelves',      name: 'Klasične police',        price: 0,     replacesShelf: false },
  magic_corner: { id: 'magic_corner', name: 'Magic Corner',           price: 268.0, replacesShelf: true, minWidthMm: 900 },
  lemans:       { id: 'lemans',       name: 'Le Mans polica',         price: 315.0, replacesShelf: true, minWidthMm: 900 },
  carousel:     { id: 'carousel',     name: 'Karusel (okretna polica)', price: 142.0, replacesShelf: true, minWidthMm: 800 },
};

/* ---------------------------------------------------------------------------
   Push-to-open je bio upisan DVA PUTA — kao `HARDWARE.PUSH` (okov koji ulazi u
   krojnu listu) i kao `HANDLES.PUSH` (opcija u padajućem izboru „Ručka"), oba sa
   istom cijenom od 4,90 KM. Dvije definicije istog artikla su se mogle razdvojiti
   pri izmjeni cjenovnika. Sada postoji JEDNA stavka, a `HARDWARE.PUSH` je
   referenca na nju.
--------------------------------------------------------------------------- */
const PUSH_MECHANISM = { id: 'PUSH', name: 'Push-to-open', price: 4.90, unit: 'kom' };

export const HANDLES = {
  RUCKA_128: { id: 'RUCKA_128', name: 'Ručka profil 128 mm', kind: 'bar', lengthMm: 128, sizeMm: 20, projMm: 26, price: 5.4 },
  RUCKA_160: { id: 'RUCKA_160', name: 'Ručka profil 160 mm', kind: 'bar', lengthMm: 160, sizeMm: 20, projMm: 26, price: 6.5 },
  RUCKA_320: { id: 'RUCKA_320', name: 'Ručka profil 320 mm', kind: 'bar', lengthMm: 320, sizeMm: 20, projMm: 26, price: 9.8 },
  RUCKA_KNOB: { id: 'RUCKA_KNOB', name: 'Ručka dugme Ø30', kind: 'knob', lengthMm: 30, sizeMm: 30, projMm: 28, price: 3.2 },
  GOLA_C:    { id: 'GOLA_C', name: 'Gola profil (bez ručke)', kind: 'gola', lengthMm: 0, sizeMm: 0, projMm: 0, price: 14.0 },
  PUSH:      { ...PUSH_MECHANISM, kind: 'push', lengthMm: 0, sizeMm: 0, projMm: 0 },
};

/*
 * Nogice: katalog dozvoljava `legHeightMm` od 100 i 150 mm (`LEG_HEIGHTS` u
 * tech.js), ali je postojala SAMO stavka „Nogica podesiva 100 mm". Za podnožje od
 * 150 mm krojna lista je navodila pogrešan artikal. Sada postoji po jedna stavka
 * za svaku visinu iz `LEG_HEIGHTS`, a `legItemFor()` bira pravu.
 */
export const HARDWARE = {
  SARKA:     { id: 'SARKA',     name: 'Šarka 110° soft-close', price: 3.40, unit: 'kom' },
  RUCKA:     { id: 'RUCKA',     name: 'Ručkica profil 160 mm', price: 6.50, unit: 'kom' },
  PUSH:      PUSH_MECHANISM,
  NOGICA:    { id: 'NOGICA',    name: 'Nogica podesiva 100 mm', price: 1.20, unit: 'kom' },
  NOGICA_150:{ id: 'NOGICA_150', name: 'Nogica podesiva 150 mm', price: 1.45, unit: 'kom' },
  VJESALICA: { id: 'VJESALICA', name: 'Vješalica za visilicu', price: 2.80, unit: 'kom' },
  SINA:      { id: 'SINA',      name: 'Kuhinjska šina (dm)',    price: 1.60, unit: 'dm' },
  SARKA_ST:  { id: 'SARKA_ST',  name: 'Šarka za staklena vrata', price: 8.90, unit: 'kom' },
  LED_PROFIL:{ id: 'LED_PROFIL',name: 'LED profil ugradni (dm)', price: 4.20, unit: 'dm' },
  PODUPIRAC: { id: 'PODUPIRAC', name: 'Podupirač police',      price: 0.25, unit: 'kom' },
};