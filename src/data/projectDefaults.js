// src/data/projectDefaults.js
// Početni (demo) projekat kuhinje. Izdvojen iz projectStore-a jer ga koristi i
// normalizacija pri učitavanju starijih projekata (utils/projectSchema.js),
// a da pri tome ne nastane kružni import.

import { createPlaced } from './catalog';
import { PRICE_LIST } from './decors';

export const DEFAULT_PROJECT = () => ({
  name: 'Kuhinja — ponuda 001',
  /**
   * Cjenovnik po kojem je ponuda rađena. Ponuda mora ostati reproducible:
   * bez ovoga bi učitavanje stare ponude nakon izmjene cjenovnika tiho dalo
   * druge brojeve, a korisnik ne bi znao zašto.
   */
  priceList: { ...PRICE_LIST },
  worktopDecorId: 'H1180',
  worktopDepthMm: 600,
  wallPanelDecorId: 'H1180',
  wallPanelHeightMm: 600,
  socleDecorId: 'U963',
  topMaskDecorId: 'H1180',
  endPanelDecorId: 'H1180',
  services: [],
  activeWalls: ['top', 'left', 'bottom', 'right'],
  legHeightMm: 150,
  ledMask: true,
  wallPanelOn: true,
  wallPanelThicknessMm: 10,
  endPanelMode: 'auto',
  endPanelSizes: {},
  frontDecorBase: 'W1000',
  frontDecorWall: 'W1000',
  handleOrientBase: 'vertical',
  handleOrientWall: 'horizontal',
  cooktops: [{ id: 'ct_1', wall: 'top', offset: 2100, widthMm: 600 }],
  topMaskHeightMm: 100,
  /**
   * Način obračuna materijala:
   *   'ploce' → po potrošenim pločama (grupa manja od cijele ploče = pola ploče)
   *   'neto'  → neto površina panela × WASTE_FACTOR (1,15)
   * Podrazumijevano je 'ploce' jer odražava stvarnu potrošnju — ploča se ne može
   * dijeliti između različitih dekora.
   */
  materialMode: 'ploce',
  elements: [
    createPlaced('D-UGAO-SLIJEPI', 'SERIJA_KUCANO', 'top', 0),
    createPlaced('D-SUDOPER', 'SERIJA_KUCANO', 'top', 1000),
    createPlaced('D-PECNICA', 'SERIJA_KUCANO', 'top', 1800),
    createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 2400),
    createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 3000),
    createPlaced('D-LADICE-4', 'SERIJA_KUCANO', 'top', 3600),
    createPlaced('D-VRATA', 'SERIJA_KUCANO', 'left', 560),
    createPlaced('D-LADICE', 'SERIJA_KUCANO', 'left', 1160),
    createPlaced('V-UGAO-SLIJEPI', 'SERIJA_KUCANO', 'top', 0),
    createPlaced('V-NAPA', 'SERIJA_KUCANO', 'top', 900),
    createPlaced('V-ELEMENT', 'SERIJA_KUCANO', 'top', 1500),
    createPlaced('V-ELEMENT', 'SERIJA_KUCANO', 'top', 2100),
    createPlaced('H-PECNICA', 'SERIJA_KUCANO', 'bottom', 1400, 'vrata'),
    createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'bottom', 2000),
  ],
  obstacles: [
    { id: 'ob_1', kind: 'prozor', wall: 'top', offset: 4300, width: 1000, sill: 900, height: 1200 },
    { id: 'ob_2', kind: 'vrata', wall: 'bottom', offset: 300, width: 900, sill: 0, height: 2050 },
  ],
});

/** Samo ključevi sa numeričkim vrijednostima — koriste se pri sanitizaciji. */
export const NUMERIC_PROJECT_FIELDS = [
  'worktopDepthMm', 'wallPanelHeightMm', 'legHeightMm', 'wallPanelThicknessMm',
  'topMaskHeightMm', 'dishwasherWidthMm', 'endPanelThicknessMm',
];

/** Ključevi koji moraju biti ID-jevi dekora iz baze. */
export const DECOR_FIELDS = [
  'worktopDecorId', 'wallPanelDecorId', 'socleDecorId',
  'topMaskDecorId', 'endPanelDecorId', 'frontDecorBase', 'frontDecorWall',
];
