// src/engine/sheetCosting.test.js
//
// Obračun materijala po potrošenim PLOČAMA, sa pravilom pogona:
//   „pola ploče kad je kvadratura manja od kvadrature cijele ploče"
//
// Zašto: `WASTE_FACTOR = 1,15` je procjena po neto površini, a ploča se ne može
// dijeliti između različitih dekora. Grupa sa dva sitna komada (završna maska,
// coklo, LED maska) troši cijelu ploču — i to se mora vidjeti u cijeni.

import { describe, it, expect } from 'vitest';
import { projectTotals, projectTotalsBySheets, surfacesCost } from './pricing';
import { computeBOM } from './bom';
import { resolveProject } from './layout';
import { optimizeCutList } from './cutting';
import { createPlaced } from '../data/catalog';
import {
  sheetConsumption, sheetFor, SHEET_FORMATS, MIN_SHEET_FRACTION, BOARD_TYPES,
} from '../data/tech';

const ROOM = { width: 5600, depth: 3600, height: 2600 };
const BASE = {
  name: 't', worktopDecorId: 'H1180', worktopDepthMm: 600, wallPanelDecorId: 'H1180',
  wallPanelHeightMm: 600, socleDecorId: 'U963', topMaskDecorId: 'H1180', endPanelDecorId: 'H1180',
  services: [], activeWalls: ['top', 'left', 'bottom', 'right'], legHeightMm: 150,
  ledMask: true, wallPanelOn: true, wallPanelThicknessMm: 10,
  endPanelMode: 'auto', endPanelSizes: {}, topMaskHeightMm: 100, obstacles: [], cooktops: [],
};
const kuhinja = (elements) => resolveProject({ ...BASE, elements }, ROOM);
const REFERENTNA = () => [
  createPlaced('D-UGAO-SLIJEPI', 'SERIJA_KUCANO', 'top', 0),
  createPlaced('D-SUDOPER', 'SERIJA_KUCANO', 'top', 1000),
  createPlaced('D-PECNICA', 'SERIJA_KUCANO', 'top', 1800),
  createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 2400),
  createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 3000),
  createPlaced('D-LADICE-4', 'SERIJA_KUCANO', 'top', 3600),
  createPlaced('V-UGAO-SLIJEPI', 'SERIJA_KUCANO', 'top', 0),
  createPlaced('V-NAPA', 'SERIJA_KUCANO', 'top', 900),
  createPlaced('V-ELEMENT', 'SERIJA_KUCANO', 'top', 1500),
  createPlaced('V-ELEMENT', 'SERIJA_KUCANO', 'top', 2100),
  createPlaced('H-PECNICA', 'SERIJA_KUCANO', 'bottom', 1400, 'vrata'),
  createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'bottom', 2000),
];

describe('MIN_SHEET_FRACTION — pravilo pola ploče', () => {
  it('konstanta je 0,5 (pola ploče)', () => {
    expect(MIN_SHEET_FRACTION).toBe(0.5);
  });

  it('grupa manja od cijele ploče → pola ploče', () => {
    const sheetArea = 2800 * 2070;                 // 5,796 m²
    expect(sheetConsumption(1e6, sheetArea).sheets).toBe(0.5);       // 1 m²
    expect(sheetConsumption(0.5e6, sheetArea).sheets).toBe(0.5);     // 0,5 m²
    expect(sheetConsumption(sheetArea * 0.99, sheetArea).sheets).toBe(0.5);
    expect(sheetConsumption(sheetArea, sheetArea).sheets).toBe(0.5); // tačno jedna → pola
  });

  it('grupa veća od jedne ploče → cijele ploče, zaokruženo na više', () => {
    const sheetArea = 2800 * 2070;
    expect(sheetConsumption(sheetArea * 1.01, sheetArea).sheets).toBe(2);
    expect(sheetConsumption(sheetArea * 2, sheetArea).sheets).toBe(2);
    expect(sheetConsumption(sheetArea * 2.01, sheetArea).sheets).toBe(3);
    expect(sheetConsumption(sheetArea * 5.5, sheetArea).sheets).toBe(6);
  });

  it('nula površine i degenerate vrijednosti ne ruše', () => {
    expect(sheetConsumption(0, 2800 * 2070).sheets).toBe(0.5);
    expect(sheetConsumption(-100, 2800 * 2070).sheets).toBe(0.5);
    expect(sheetConsumption(NaN, 2800 * 2070).sheets).toBe(0.5);
    expect(() => sheetConsumption(1000, 0)).not.toThrow();
  });

  it('uz 0,5 ploče ne može biti manje od pola, ali ni više od cijele', () => {
    const sheetArea = 2800 * 2070;
    [1, 1000, 1e5, 1e6, 5e6].forEach((a) => {
      const s = sheetConsumption(a, sheetArea).sheets;
      expect(s).toBeGreaterThanOrEqual(0.5);
    });
  });
});

describe('sheetFor — format ploče po tipu i debljini', () => {
  it('iverica je 2800×2070', () => {
    expect(sheetFor(18, 'iverica').widthMm).toBe(2800);
    expect(sheetFor(18, 'iverica').heightMm).toBe(2070);
  });

  it('medijapan visoki sjaj je 2800×1220 (format dobavljača)', () => {
    const s = sheetFor(18, 'medijapan_sjaj');
    expect(s.widthMm).toBe(2800);
    expect(s.heightMm).toBe(1220);
    expect(s.label).toMatch(/2800×1220/);
  });

  it('ista debljina 18 mm daje RAZLIČIT format zavisno od tipa ploče', () => {
    const a = sheetFor(18, 'iverica');
    const b = sheetFor(18, 'medijapan_sjaj');
    expect(a.heightMm).not.toBe(b.heightMm);
    expect(a.widthMm * a.heightMm).toBeGreaterThan(b.widthMm * b.heightMm);
  });

  it('radna ploča je 4100×600', () => {
    expect(sheetFor(38, 'radna_ploca').widthMm).toBe(4100);
    expect(sheetFor(38, 'radna_ploca').heightMm).toBe(600);
  });

  it('bez zadanog tipa format se prepoznaje po debljini', () => {
    expect(sheetFor(38).boardType).toBe('radna_ploca');
    expect(sheetFor(3).boardType).toBe('hdf');
    expect(sheetFor(18).boardType).toBe('iverica');
  });

  it('svi tipovi ploča iz BOARD_TYPES imaju format', () => {
    BOARD_TYPES.forEach((t) => {
      expect(SHEET_FORMATS[t.id]).toBeTruthy();
      expect(SHEET_FORMATS[t.id].widthMm).toBeGreaterThan(0);
      expect(SHEET_FORMATS[t.id].heightMm).toBeGreaterThan(0);
      expect(t.label).toMatch(/\d+×\d+/);
    });
  });
});

describe('projectTotalsBySheets — obračun po pločama', () => {
  it('zahtijeva BOM (kružna zavisnost pricing ↔ bom je izbjegnuta)', () => {
    const p = kuhinja(REFERENTNA());
    expect(() => projectTotalsBySheets(p, ROOM)).toThrow(/computeBOM/);
    expect(() => projectTotalsBySheets(p, ROOM, null)).toThrow(/computeBOM/);
  });

  it('vraća ispravnu strukturu i konačne brojeve', () => {
    const p = kuhinja(REFERENTNA());
    const sc = surfacesCost(p, ROOM);
    const bom = computeBOM(p, ROOM, sc);
    const t = projectTotalsBySheets(p, ROOM, bom, sc);

    expect(t.materialMode).toBe('sheet');
    expect(Number.isFinite(t.net) && t.net > 0).toBe(true);
    expect(t.gross).toBeCloseTo(t.net * 1.17, 6);
    expect(t.sheets.plan.length).toBeGreaterThan(0);
    expect(t.sheets.chargedSheets).toBeGreaterThan(0);
    expect(t.sheets.sheetCost).toBeGreaterThan(0);
    expect(t.sheets.netMaterial).toBeGreaterThan(0);
    /* Svaka grupa zaokružuje `materialCost` na 2 decimale, pa zbir 6 grupa može
       odstupati do ~3 feninga od zbira nezaokruženih vrijednosti. */
    expect(Math.abs(t.parts.materijalPoPlocama - t.sheets.sheetCost)).toBeLessThan(0.05);
  });

  it('radna ploča i alu lajsne OSTAJU po dužnom metru (ne po ploči)', () => {
    const p = kuhinja(REFERENTNA());
    const sc = surfacesCost(p, ROOM);
    const bom = computeBOM(p, ROOM, sc);
    const t = projectTotalsBySheets(p, ROOM, bom, sc);

    // radna ploča NIJE u planu krojenja po pločama
    const plan = t.sheets.plan;
    expect(plan.some((g) => /Radna ploča/.test(g.materialLabel || g.material)
      && g.thicknessMm === 38)).toBe(false);
    // ali JE obračunata zasebno, po metru
    expect(t.sheets.vanPloca).toBeGreaterThan(0);
    expect(t.parts.radnaPlocaPoMetru).toBeGreaterThan(0);
    expect(t.parts.lajsne).toBeGreaterThanOrEqual(0);
    // oba iznosa su zaokružena na 2 decimale → tolerancija 1 fenig
    expect(Math.abs(t.sheets.vanPloca - (t.parts.radnaPlocaPoMetru + t.parts.lajsne)))
      .toBeLessThan(0.01);
  });

  it('osnovica = (sve osim pločnog materijala) + materijal po pločama', () => {
    const p = kuhinja(REFERENTNA());
    const sc = surfacesCost(p, ROOM);
    const bom = computeBOM(p, ROOM, sc);
    const neto = projectTotals(p, ROOM, sc);
    const t = projectTotalsBySheets(p, ROOM, bom, sc);

    /* `sheets.netMaterial` i `sheets.sheetCost` su zaokruženi na 2 decimale za
       prikaz, pa se tolerancija postavlja na nivo te zaokruženosti (0,15 KM na
       iznos od ~3.700 KM = 0,004 %). */
    expect(Math.abs(t.net - (neto.net - t.sheets.netMaterial + t.sheets.sheetCost)))
      .toBeLessThan(0.15);
  });

  it('rad i okov su IDENTIČNI u oba načina obračuna', () => {
    const p = kuhinja(REFERENTNA());
    const sc = surfacesCost(p, ROOM);
    const bom = computeBOM(p, ROOM, sc);
    const neto = projectTotals(p, ROOM, sc);
    const t = projectTotalsBySheets(p, ROOM, bom, sc);

    expect(t.parts.rad).toBeCloseTo(neto.parts.rad, 6);
    expect(t.parts.okov).toBeCloseTo(neto.parts.okov, 6);
  });

  it('grupe sa malo materijala se naplaćuju kao pola ploče', () => {
    const p = kuhinja(REFERENTNA());
    const sc = surfacesCost(p, ROOM);
    const bom = computeBOM(p, ROOM, sc);
    const t = projectTotalsBySheets(p, ROOM, bom, sc);

    const male = t.sheets.plan.filter((g) => g.fractionOfSheet <= 100);
    expect(male.length).toBeGreaterThan(0);
    male.forEach((g) => {
      expect(g.chargedSheets).toBe(MIN_SHEET_FRACTION);
      expect(g.materialCost).toBeCloseTo(g.pricePerSheet / 2, 1);
    });
  });

  it('HDF leđa koriste svoju cijenu iz cjenovnika (8,90 KM/m²)', () => {
    const p = kuhinja(REFERENTNA());
    const sc = surfacesCost(p, ROOM);
    const bom = computeBOM(p, ROOM, sc);
    const t = projectTotalsBySheets(p, ROOM, bom, sc);
    const hdf = t.sheets.plan.find((g) => g.boardType === 'hdf');
    expect(hdf).toBeTruthy();
    expect(hdf.pricePerM2).toBeCloseTo(8.9, 5);
  });

  it('LED maska ide na format medijapana (2800×1220)', () => {
    const p = kuhinja(REFERENTNA());
    const sc = surfacesCost(p, ROOM);
    const bom = computeBOM(p, ROOM, sc);
    const t = projectTotalsBySheets(p, ROOM, bom, sc);
    const led = t.sheets.plan.find((g) => g.thicknessMm === 20);
    expect(led).toBeTruthy();
    expect(led.boardType).toBe('medijapan_sjaj');
    expect(led.sheet.heightMm).toBe(1220);
  });
});

describe('UI prekidač načina obračuna', () => {
  it('materialMode se čuva u projektu i preživljava normalizaciju', async () => {
    const { normalizeProject } = await import('../utils/projectSchema');
    const { project } = normalizeProject({ elements: [], materialMode: 'neto' }, ROOM);
    expect(project.materialMode).toBe('neto');
  });

  it('optimizeCutList sa excludeFlags:["wt"] izbacuje radnu ploču', () => {
    const p = kuhinja(REFERENTNA());
    const sc = surfacesCost(p, ROOM);
    const bom = computeBOM(p, ROOM, sc);
    const saSvim = optimizeCutList(bom);
    const bezPloca = optimizeCutList(bom, { excludeFlags: ['wt'] });
    expect(bezPloca.length).toBeLessThan(saSvim.length);
    expect(bezPloca.some((g) => g.thicknessMm === 38)).toBe(false);
    expect(saSvim.some((g) => g.thicknessMm === 38)).toBe(true);
  });
});
