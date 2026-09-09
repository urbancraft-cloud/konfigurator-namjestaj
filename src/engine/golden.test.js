// src/engine/golden.test.js
//
// ZLATNA REGRESIJA — najvažniji test u projektu.
//
// Ovdje su zaključane STVARNE izračunate vrijednosti za dvije referentne
// konfiguracije (kuhinja od 11 elemenata i ormar 2400×2500×580 sa 3 segmenta).
// Svaka promjena engine-a koja slučajno pomjeri cijenu ili broj komada okova
// pada na ovom testu.
//
// ⚠️  Ako NAMJERNO mijenjate cijene/konstrukciju, ažurirajte brojeve ispod i
//     u poruci testa navedite zašto. Nemojte samo "popravljati test".
//
// Stanje: 2026-09-08, nakon Faze 5 (ELGRAD cjenovnik MPC 31.08.2026).
//
// Izmjene zlatnih brojeva (svaka je NAMJERNA i ima svoj razlog):
//   Faza 1: gola profil po metru, push-to-open, 4 nogice po korpusu,
//           ploče/leđa ormara po segmentu, klizna krila po max širini
//   Faza 2: fiktivne završne maske za visoke elemente uklonjene
//   Faza 5: nogica 150 mm je zaseban artikal (1,45 KM) umjesto da se za podnožje
//           od 150 mm navodi „Nogica podesiva 100 mm" (1,20 KM). Referentna
//           kuhinja ima legHeightMm = 150 → +0,25 KM × 32 nogice = +8,00 KM.

import { describe, it, expect } from 'vitest';
import { createPlaced } from '../data/catalog';
import { resolveProject } from './layout';
import { projectTotals, projectTotalsBySheets, surfacesCost } from './pricing';
import { computeBOM } from './bom';
import { computeWardrobePrice, computeWardrobeBOM } from './wardrobePricing';

const ROOM = { width: 5600, depth: 3600, height: 2600 };

/* -------------------------------------------------------------------------- */
/* Referentna kuhinja                                                          */
/* -------------------------------------------------------------------------- */
const KUHINJA_BASE = {
  name: 'Referentna kuhinja', worktopDecorId: 'H1180', worktopDepthMm: 600,
  wallPanelDecorId: 'H1180', wallPanelHeightMm: 600, socleDecorId: 'U963',
  topMaskDecorId: 'H1180', endPanelDecorId: 'H1180', services: [],
  activeWalls: ['top', 'left', 'bottom', 'right'], legHeightMm: 150, ledMask: true,
  wallPanelOn: true, wallPanelThicknessMm: 10, endPanelMode: 'auto', endPanelSizes: {},
  frontDecorBase: 'W1000', frontDecorWall: 'W1000', handleOrientBase: 'vertical',
  handleOrientWall: 'horizontal', cooktops: [], topMaskHeightMm: 100, obstacles: [],
};

const kuhinja = () => resolveProject({
  ...KUHINJA_BASE,
  elements: [
    createPlaced('D-UGAO-SLIJEPI', 'SERIJA_KUCANO', 'top', 0),
    createPlaced('D-SUDOPER', 'SERIJA_KUCANO', 'top', 1000),
    createPlaced('D-PECNICA', 'SERIJA_KUCANO', 'top', 1800),
    createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 2400),
    createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 3000),
    createPlaced('D-LADICE-4', 'SERIJA_KUCANO', 'top', 3600),
    createPlaced('V-UGAO-SLIJEPI', 'SERIJA_KUCANO', 'top', 0),
    createPlaced('V-NAPA', 'SERIJA_KUCANO', 'top', 900),
    createPlaced('V-ELEMENT', 'SERIJA_KUCANO', 'top', 1500),
    createPlaced('H-PECNICA', 'SERIJA_KUCANO', 'bottom', 1400, 'vrata'),
    createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'bottom', 2000),
  ],
}, ROOM);

describe('ZLATNI BROJEVI — kuhinja (11 elemenata)', () => {
  it('ukupna cijena', () => {
    const t = projectTotals(kuhinja(), ROOM);
    expect(t.net).toBeCloseTo(3874.67, 2);
    expect(t.vat).toBeCloseTo(658.69, 2);
    expect(t.gross).toBeCloseTo(4533.36, 2);
  });

  it('po stavkama', () => {
    const p = projectTotals(kuhinja(), ROOM).parts;
    expect(p.korpus).toBeCloseTo(982.01, 2);
    expect(p.frontovi).toBeCloseTo(283.98, 2);
    expect(p.ledja).toBeCloseTo(67.57, 2);
    expect(p.kantovanje).toBeCloseTo(310.42, 2);
    expect(p.okov).toBeCloseTo(390.40, 2);
    expect(p.rad).toBeCloseTo(662.95, 2);
    expect(p.radnaPloca).toBeCloseTo(661.97, 2);
    expect(p.zidnaObloga).toBeCloseTo(191.56, 2);
    expect(p.lajsne).toBeCloseTo(5.04, 2);
    expect(p.coklo).toBeCloseTo(30.39, 2);
    expect(p.gornjaMaska).toBeCloseTo(22.62, 2);
    expect(p.zavrsneMaske).toBeCloseTo(232.76, 2);
    expect(p.ledMaska).toBeCloseTo(33.00, 2);
  });

  it('okov po količinama', () => {
    const hw = Object.fromEntries(computeBOM(kuhinja(), ROOM).hwTotals.map((h) => [h.id, h.qty]));
    expect(hw.SARKA).toBe(30);
    expect(hw.RUCKA_160).toBe(20);
    expect(hw.PODUPIRAC).toBe(32);
    // legHeightMm referentne kuhinje je 150 → artikal „Nogica podesiva 150 mm"
    expect(hw.NOGICA_150).toBe(32);      // 8 korpusa na podu × 4
    expect(hw.NOGICA).toBeUndefined();
    expect(hw.GTV_BALL_500).toBe(8);
    expect(hw.VJESALICA).toBe(10);
  });

  it('količine u metrima su zaokružene (bez 11.299999999999997)', () => {
    const bom = computeBOM(kuhinja(), ROOM);
    const metri = bom.hwTotals.filter((h) => h.unit === 'm');
    metri.forEach((h) => expect(String(h.qty)).not.toMatch(/\.\d{4,}/));
    Object.values(bom.bandTotals).forEach((m) => expect(String(m)).not.toMatch(/\.\d{4,}/));
  });

  it('gola profil mijenja obračun sa komada na metre', () => {
    /* Napomena: `handleId` se postavlja PO ELEMENTU, pa se mora preslikati na
       sve elemente uključujući nadgradnje. `resolveProject` nadgradnju iznad
       visokog elementa regeneriše iz roditelja (`{ ...prev }`), pa bi filtriranje
       `autoParentId` elemenata ostavilo nadgradnju sa starom ručkom.
       => Ovo je i stvarno ograničenje UI-a: ne postoji "primijeni ručku na sve
       elemente", za razliku od "primijeni dekor fronti na sve". */
    const saGola = resolveProject({
      ...KUHINJA_BASE,
      elements: kuhinja().elements.map((e) => ({ ...e, handleId: 'GOLA_C' })),
    }, ROOM);
    const bom = computeBOM(saGola, ROOM);
    const g = bom.hwTotals.find((h) => h.id === 'GOLA_C');
    expect(g.unit).toBe('m');
    // 12 elemenata (11 + automatska nadgradnja iznad visokog) × širina elementa
    expect(g.qty).toBeCloseTo(12.5, 1);
    expect(g.qty * g.price).toBeCloseTo(175.00, 1);
    expect(bom.hwTotals.find((h) => h.id === 'RUCKA_160')).toBeUndefined();
  });
});

/* --------------------------------------------------------------------------
   ORMAR — zlatni brojevi NOVOG modela

   Model (detaljno u `engine/wardrobeLayout.js`):
     nogice = donja maska → donji korpus (1950 default, editabilan)
     → gornji korpus (IZVEDEN, popunjava do gornje maske) → gornja maska (100)
     bočne maske stoje VAN korpusa i idu PUNOM visinom prostora.

   Referentni ormar: 2400 × 2600 × 580, 3 segmenta, nogice 100, baglame,
   korpus H1180 (21,50 KM/m²), vrata W1000 (28,00 KM/m²).

   Izvedeno: širina korpusa 2364 · segment 788 · svijetlo 752 · donji 1950 ·
   gornji 450 · vrata 2396 × 784 · bočne maske 2600 × 601 · ladičar 652.

   Mjereno 2026-09-08. Svaka promjena konstrukcije ormara mora osvježiti ove
   brojeve i zabilježiti to u izvještaju faze.
-------------------------------------------------------------------------- */

const WSEG = (n) => Array.from({ length: n }, () => ({ lower: { items: [] }, upper: { items: [] } }));

const ORMAR = {
  widthMm: 2400, depthMm: 580, roomHeightMm: 2600,
  legHeightMm: 100, lowerCorpusHeightMm: 1950, topMaskHeightMm: 100,
  doorType: 'baglame', segmentCount: 3, maxSlidingLeafWidthMm: 1000,
  sideMaskDepthLeftMm: null, sideMaskDepthRightMm: null, doorHeightMm: null,
  corpusDecorId: 'H1180', doorDecorId: 'W1000',
  segments: WSEG(3),
};

const ORMAR_ZLATNI = {
  neto: 1366.3454,
  pdv: 232.2787,
  bruto: 1598.6241,
  stavke: {
    'korpus — bokovi, vrh i dno po segmentu': 824.7000,
    'leđa (lesomal 3 mm), po segmentu': 50.5000,
    'maske — donja, gornja i bočne': 214.4000,
    'vrata': 224.3000,
    'nogice': 52.5000,
    'ladičari (okov)': 0.0000,
    'ladičari (materijal)': 0.0000,
    'garderobne šipke': 0.0000,
    'police': 0.0000,
  },
  panela: 37,
  povrsinaM2: 28.7435,
  kliznaBruto: 1932.4937,
  ladicarBruto: 1883.5494,
  ladicarOkov: 135.0000,
  ladicarMaterijal: 108.5000,
};

describe('ZLATNI BROJEVI — ormar 2400×2600×580, 3 segmenta, baglame', () => {
  it('neto / PDV / bruto', () => {
    const p = computeWardrobePrice(ORMAR);
    expect(p.net).toBeCloseTo(ORMAR_ZLATNI.neto, 4);
    expect(p.vat).toBeCloseTo(ORMAR_ZLATNI.pdv, 4);
    expect(p.gross).toBeCloseTo(ORMAR_ZLATNI.bruto, 4);
  });

  it('sve stavke breakdown-a', () => {
    const b = computeWardrobePrice(ORMAR).breakdown;
    Object.entries(ORMAR_ZLATNI.stavke).forEach(([k, v]) => expect(b[k], k).toBeCloseTo(v, 4));
    expect(Object.keys(b)).toHaveLength(Object.keys(ORMAR_ZLATNI.stavke).length);
  });

  it('meta podaci — sve izvedene mjere novog modela', () => {
    const m = computeWardrobePrice(ORMAR).meta;
    expect(m.carcassWidthMm).toBe(2364);          // 2400 − 2×18 (bočne maske su VAN)
    expect(m.segmentWidthMm).toBe(788);           // 2364 / 3
    expect(m.segmentInteriorWidthMm).toBe(752);   // 788 − 2×18
    expect(m.lowerCorpusHeightMm).toBe(1950);
    expect(m.upperCorpusHeightMm).toBe(450);      // (2600−100−100) − 1950
    expect(m.topMaskHeightMm).toBe(100);
    expect(m.bottomMaskHeightMm).toBe(100);
    expect(m.doorHeightMm).toBe(2396);            // 2400 − 4 mm fuge
    expect(m.doorLeafWidthMm).toBe(784);          // 788 − 4
    expect(m.doorLeafCount).toBe(3);
    expect(m.hingesPerLeaf).toBe(4);              // vrata > 1200 mm
    expect(m.sideMaskDepthLeftMm).toBe(601);      // 3 + 580 + 18
    expect(m.sideMaskDepthRightMm).toBe(601);
    expect(m.drawerUnitWidthMm).toBe(652);        // 752 − 100
    expect(m.legCount).toBe(15);                  // 3 × 5
    expect(m.heightChecksum.ok).toBe(true);
    expect(m.heightChecksum.sumMm).toBe(2600);
  });

  it('krojna lista: broj panela i ukupna površina', () => {
    const b = computeWardrobeBOM(ORMAR);
    expect(b.rows.reduce((s, r) => s + r.qty, 0)).toBe(ORMAR_ZLATNI.panela);
    expect(b.rows.reduce((s, r) => s + r.areaM2, 0)).toBeCloseTo(ORMAR_ZLATNI.povrsinaM2, 4);
    expect(b.notes).toEqual([]);
  });

  it('bočne maske su pune visine prostora i dubine 3+D+18', () => {
    const maske = computeWardrobeBOM(ORMAR).rows.filter((r) => /Bočna maska/.test(r.role));
    expect(maske).toHaveLength(2);
    maske.forEach((m) => {
      expect(m.cutL).toBe(2600);                  // H_prostor, NE 2400
      expect(m.cutW).toBe(601);
      expect(m.qty).toBe(1);
    });
  });

  it('donja i gornja maska idu preko širine KORPUSA (2364), ne ormara', () => {
    const b = computeWardrobeBOM(ORMAR);
    expect(b.rows.find((r) => /Donja maska/.test(r.role)).cutL).toBe(2364);
    expect(b.rows.find((r) => /Gornja maska/.test(r.role)).cutL).toBe(2364);
    expect(b.rows.find((r) => /Donja maska/.test(r.role)).cutW).toBe(100);
  });

  it('horizontalne ploče su širine segmenta (788 mm), po 3 komada', () => {
    const ploce = computeWardrobeBOM(ORMAR).rows.filter((r) => /ploča/i.test(r.role));
    expect(ploce).toHaveLength(4);                // vrh+dnо donjeg, vrh+dno gornjeg
    ploce.forEach((r) => {
      expect(r.qty).toBe(3);
      expect(r.cutL).toBe(788);
      expect(r.cutW).toBe(580);
    });
  });

  it('leđa su po segmentu (788 mm), ne pune širine ormara', () => {
    const ledja = computeWardrobeBOM(ORMAR).rows.filter((r) => /Leđa/.test(r.role));
    expect(ledja).toHaveLength(2);
    ledja.forEach((r) => {
      expect(r.qty).toBe(3);
      expect(r.cutL).toBe(788);
      expect(r.material).toBe('lesomal');
    });
    expect(ledja[0].cutW).toBe(1950);
    expect(ledja[1].cutW).toBe(450);
  });

  it('svaki segment ima SVOJA dva boka — nema zasebnih pregrada', () => {
    const b = computeWardrobeBOM(ORMAR);
    expect(b.rows.find((r) => /Bok donjeg/.test(r.role)).qty).toBe(6);
    expect(b.rows.find((r) => /Bok gornjeg/.test(r.role)).qty).toBe(6);
    expect(b.rows.filter((r) => /Pregrada/.test(r.role))).toHaveLength(0);
  });

  it('klizna vrata su skuplja (vodilice 90 KM/krilo)', () => {
    const p = computeWardrobePrice({ ...ORMAR, doorType: 'klizna' });
    expect(p.gross).toBeCloseTo(ORMAR_ZLATNI.kliznaBruto, 4);
    expect(p.gross).toBeGreaterThan(ORMAR_ZLATNI.bruto);
  });

  it('promjena max širine kliznog krila mijenja broj krila i cijenu', () => {
    const usko = computeWardrobePrice({ ...ORMAR, doorType: 'klizna', maxSlidingLeafWidthMm: 700 });
    const siroko = computeWardrobePrice({ ...ORMAR, doorType: 'klizna', maxSlidingLeafWidthMm: 1400 });
    expect(usko.meta.doorLeafCount).toBe(4);      // ceil(2364/700)
    expect(siroko.meta.doorLeafCount).toBe(2);    // ceil(2364/1400)
    expect(usko.breakdown.vrata).toBeGreaterThan(siroko.breakdown.vrata);
  });

  it('ladičar 700 mm sa 3 ladice dodaje okov i materijal', () => {
    const w = { ...ORMAR, segments: WSEG(3) };
    w.segments[0].lower.items.push({ id: 'l1', type: 'ladicar', yMm: 0, heightMm: 700, drawerCount: 3 });
    const p = computeWardrobePrice(w);
    expect(p.breakdown['ladičari (okov)']).toBeCloseTo(ORMAR_ZLATNI.ladicarOkov, 4);
    expect(p.breakdown['ladičari (materijal)']).toBeCloseTo(ORMAR_ZLATNI.ladicarMaterijal, 4);
    expect(p.gross).toBeCloseTo(ORMAR_ZLATNI.ladicarBruto, 4);
  });

  it('4 segmenta: 20 nogica, 4 krila, širina segmenta 591 mm', () => {
    const w = { ...ORMAR, segmentCount: 4, segments: WSEG(4) };
    const p = computeWardrobePrice(w);
    expect(p.meta.legCount).toBe(20);
    expect(p.meta.segmentWidthMm).toBe(591);      // 2364 / 4
    expect(p.meta.drawerUnitWidthMm).toBe(455);   // (591−36) − 100
    expect(p.meta.doorLeafCount).toBe(4);
    const b = computeWardrobeBOM(w);
    expect(b.rows.filter((r) => /ploča/i.test(r.role)).reduce((s, r) => s + r.qty, 0)).toBe(16);
  });

  it('smanjenje broja segmenata smanjuje cijenu (manje bokova i leđa)', () => {
    const tri = computeWardrobePrice(ORMAR).net;
    const dva = computeWardrobePrice({ ...ORMAR, segmentCount: 2, segments: WSEG(2) }).net;
    expect(dva).toBeLessThan(tri);
  });

  it('dublji korpus je skuplji, plići jeftiniji', () => {
    const baza = computeWardrobePrice(ORMAR).net;
    expect(computeWardrobePrice({ ...ORMAR, depthMm: 600 }).net).toBeGreaterThan(baza);
    expect(computeWardrobePrice({ ...ORMAR, depthMm: 450 }).net).toBeLessThan(baza);
  });

  it('uža bočna maska (uz zid) je jeftinija', () => {
    const baza = computeWardrobePrice(ORMAR).net;
    expect(computeWardrobePrice({ ...ORMAR, sideMaskDepthLeftMm: 120, sideMaskDepthRightMm: 120 }).net)
      .toBeLessThan(baza);
  });

  /* Važna sprega modela: gornja maska pokriva dio otvora koji bi inače bio
     vrata, pa VEĆA maska daje MANJA vrata i ukupno JEFTINIJI ormar (maska je
     18 mm korpus, vrata su 18 mm skupljeg dekora). Nije greška — ali se mora
     znati, jer se cijena ne ponaša monotono po visini maske. */
  it('veća gornja maska skraćuje vrata i zato je ukupno jeftinije', () => {
    const velika = computeWardrobePrice({ ...ORMAR, topMaskHeightMm: 200 });
    const mala = computeWardrobePrice({ ...ORMAR, topMaskHeightMm: 50 });
    expect(velika.meta.doorHeightMm).toBe(2296);    // 2600−100−200−4
    expect(mala.meta.doorHeightMm).toBe(2446);      // 2600−100−50−4
    expect(velika.net).toBeLessThan(mala.net);

    /* Prava invarijanta: DONJI korpus je ulaz i ostaje 1950 bez obzira na masku,
       a GORNJI je izveden — raste/skuplja se zajedno sa maskom. Kontrolni zbir
       (nogice + donji + gornji + maska = H_prostor) mora držati za obje
       varijante, inače bi ormar bio kraći ili duži od prostora. */
    expect(velika.meta.lowerCorpusHeightMm).toBe(1950);
    expect(mala.meta.lowerCorpusHeightMm).toBe(1950);
    expect(velika.meta.upperCorpusHeightMm).toBe(350);   // 2600−100−200−1950
    expect(mala.meta.upperCorpusHeightMm).toBe(500);     // 2600−100−50−1950
    expect(velika.meta.heightChecksum.ok).toBe(true);
    expect(mala.meta.heightChecksum.ok).toBe(true);
    expect(velika.meta.heightChecksum.sumMm).toBe(2600);
    expect(mala.meta.heightChecksum.sumMm).toBe(2600);
    // donji korpus ostaje isti, gornji prati masku → ukupni korpusi se mijenjaju
    expect(velika.meta.lowerCorpusHeightMm + velika.meta.upperCorpusHeightMm).toBe(2300);
    expect(mala.meta.lowerCorpusHeightMm + mala.meta.upperCorpusHeightMm).toBe(2450);
  });

  it('promjena visine donjeg korpusa NE mijenja ukupnu visinu sastava', () => {
    [1500, 1800, 1950, 2100].forEach((h) => {
      const p = computeWardrobePrice({ ...ORMAR, lowerCorpusHeightMm: h });
      expect(p.meta.heightChecksum.ok, `donji=${h}`).toBe(true);
      expect(p.meta.heightChecksum.sumMm).toBe(2600);
      expect(p.meta.lowerCorpusHeightMm + p.meta.upperCorpusHeightMm).toBe(2400);
    });
  });

  it('viši prostor automatski povećava gornji korpus, a visina vrata prati', () => {
    const p = computeWardrobePrice({ ...ORMAR, roomHeightMm: 3000 });
    expect(p.meta.upperCorpusHeightMm).toBe(850);     // 2800 − 1950
    expect(p.meta.doorHeightMm).toBe(2796);           // 2800 − 4
    expect(p.meta.heightChecksum.sumMm).toBe(3000);
  });
});


/* PERF-02: dijeljenje `surfacesCost` između kalkulacija                       */
/* -------------------------------------------------------------------------- */

describe('PERF-02 — surfacesCost se računa jednom, ne tri puta', () => {
  /**
   * Bez `precomputedSurfaces` parametra `projectTotals` i `computeBOM` svaki
   * interno pozovu `surfacesCost`, a `App.jsx` ga je zvao i treći put za prikaz
   * komada ploča. `surfacesCost` je najskuplji dio kalkulacije (~0,9 ms od
   * ukupno 3,6 ms po renderu), pa je to bilo ~25% ukupnog vremena bačeno tri puta.
   */
  it('App.jsx računa surfacesCost JEDNOM i prosljeđuje ga objema kalkulacijama', async () => {
    /* Napomena: ESM nije moguće "spy-ovati" — `import * as` daje zaleđeni
       namespace, a `projectTotals`/`computeBOM` zovu `surfacesCost` preko
       unutarmodulske vezice. Zato se ovdje provjerava obrazac u izvornom kodu:
       to je upravo ono što garantuje jedan poziv umjesto tri. */
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
    expect(src).toMatch(/const surf = surfacesCost\(project, room\);/);
    expect(src).toMatch(/projectTotals\(project, room, surf\)/);
    expect(src).toMatch(/computeBOM\(project, room, surf\)/);
    // i da nema više odvojenih useMemo poziva koji svaki računaju za sebe
    expect(src).not.toMatch(/useMemo\(\(\) => projectTotals\(project, room\)\)/);
    expect(src).not.toMatch(/useMemo\(\(\) => computeBOM\(project, room\)\)/);
    expect(src).not.toMatch(/useMemo\(\(\) => surfacesCost\(project, room\)\)/);
  });

  it('engine prihvata unaprijed izračunate površine (potpis postoji)', () => {
    expect(projectTotals.length).toBeGreaterThanOrEqual(2);
    expect(computeBOM.length).toBeGreaterThanOrEqual(2);
  });

  it('rezultat je IDENTIČAN sa dijeljenim i sa zasebnim surfacesCost', () => {
    const p = kuhinja();
    const sc = surfacesCost(p, ROOM);

    const t1 = projectTotals(p, ROOM);
    const t2 = projectTotals(p, ROOM, sc);
    expect(t2.net).toBeCloseTo(t1.net, 6);
    expect(t2.gross).toBeCloseTo(t1.gross, 6);
    Object.keys(t1.parts).forEach((k) => expect(t2.parts[k]).toBeCloseTo(t1.parts[k], 6));

    const b1 = computeBOM(p, ROOM);
    const b2 = computeBOM(p, ROOM, sc);
    expect(b2.rows).toHaveLength(b1.rows.length);
    expect(b2.rows.map((r) => [r.element, r.role, r.qty, r.cutL, r.cutW]))
      .toEqual(b1.rows.map((r) => [r.element, r.role, r.qty, r.cutL, r.cutW]));
    expect(b2.surfaceNotes).toEqual(b1.surfaceNotes);
  });
});

describe('PERF-01 — computePanels se ne računa dvaput po elementu', () => {
  it('Viewport3D više ne zove computePanels(el) dvaput u istom efektu', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../views/Viewport3D.jsx', import.meta.url), 'utf8');
    const pozivi = (src.match(/computePanels\(el\)/g) || []).length;
    expect(pozivi).toBe(1);
    expect(src).toMatch(/const elPanels = computePanels\(el\);/);
    expect(src).toMatch(/handlePlacements\(el, elPanels, project\)/);
  });
});

describe('PERF-03 — nema stalne requestAnimationFrame petlje', () => {
  it('Viewport3D: petlja radi samo u režimu hodanja', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../views/Viewport3D.jsx', import.meta.url), 'utf8');
    expect(src).toMatch(/const invalidate = \(\) =>/);
    expect(src).toMatch(/startWalkLoop/);
    expect(src).toMatch(/stopWalkLoop/);
    // Stalna petlja se smije pokretati samo iz walk efekta
    expect(src).not.toMatch(/^\s*raf = requestAnimationFrame\(loop\);/m);
  });

  it('WardrobeViewport3D: nema stalne petlje (ormar nema režim hodanja)', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      new URL('../components/wardrobe/WardrobeViewport3D.jsx', import.meta.url), 'utf8');
    expect(src).toMatch(/const invalidate = \(\) =>/);
    expect(src).not.toMatch(/const loop = \(\) => \{ renderer\.render/);
  });
});

describe('PERF-04 — THREE resursi se oslobađaju', () => {
  it('Viewport3D čisti keš materijala pri unmount-u', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../views/Viewport3D.jsx', import.meta.url), 'utf8');
    expect(src).toMatch(/mats\.forEach\(\(m\) => \{ if \(m\.map\) m\.map\.dispose\(\)/);
    expect(src).toMatch(/labelMats\.forEach/);
    expect(src).toMatch(/renderer\.dispose\(\)/);
  });

  it('WardrobeViewport3D dijeli materijal ivica umjesto novog po svakoj kutiji', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      new URL('../components/wardrobe/WardrobeViewport3D.jsx', import.meta.url), 'utf8');
    expect(src).toMatch(/const edgeMat = new THREE\.LineBasicMaterial/);
    expect(src).toMatch(/EdgesGeometry\(m\.geometry, 20\), ctx\.current\.edgeMat/);
    expect(src).toMatch(/edgeMat\.dispose\(\)/);
    // ne smije više stvarati nov materijal unutar box()
    expect(src).not.toMatch(/EdgesGeometry\([^)]*\),\s*new THREE\.LineBasicMaterial/);
  });

  it('naljepnice zidova se keširaju po tekstu (0 novih tekstura po promjeni dimenzija)', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../views/Viewport3D.jsx', import.meta.url), 'utf8');
    expect(src).toMatch(/const getLabelMat = \(text\) =>/);
    expect(src).toMatch(/cache\.has\(text\)/);
  });
});

describe('PERF-07 — 3D prikazi se učitavaju na zahtjev', () => {
  it('App.jsx koristi React.lazy za Viewport3D i WardrobeApp', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
    expect(src).toMatch(/const Viewport3D = lazy\(/);
    expect(src).toMatch(/const WardrobeApp = lazy\(/);
    expect(src).toMatch(/<Suspense/);
    // statički importi 3D komponenti više ne postoje
    expect(src).not.toMatch(/^import \{ Viewport3D \} from/m);
    expect(src).not.toMatch(/^import \{ WardrobeApp \} from/m);
  });
});

/* -------------------------------------------------------------------------- */
/* ZLATNI BROJEVI — obračun materijala po pločama (Faza 6)                     */
/* -------------------------------------------------------------------------- */

describe('ZLATNI BROJEVI — kuhinja po potrošenim pločama', () => {
  const izracun = () => {
    const p = kuhinja();
    const sc = surfacesCost(p, ROOM);
    const b = computeBOM(p, ROOM, sc);
    return { neto: projectTotals(p, ROOM, sc), ploce: projectTotalsBySheets(p, ROOM, b, sc) };
  };

  it('ukupna cijena', () => {
    const { neto, ploce } = izracun();
    expect(neto.net).toBeCloseTo(3874.67, 2);      // stari način: neto × 1,15
    expect(ploce.net).toBeCloseTo(3630.68, 2);     // po potrošenim pločama
    expect(ploce.gross).toBeCloseTo(4247.90, 2);
  });

  it('po stavkama obračuna', () => {
    const { ploce } = izracun();
    expect(ploce.sheets.chargedSheets).toBeCloseTo(10, 1);   // naplaćeno (sa pola-ploče)
    expect(ploce.sheets.summary.sheets).toBe(12);            // fizički rezano
    expect(ploce.sheets.sheetCost).toBeCloseTo(1910.30, 1);
    expect(ploce.sheets.netMaterial).toBeCloseTo(2154.30, 1);
    expect(ploce.sheets.vanPloca).toBeCloseTo(667.00, 1);    // radna ploča + lajsne po m'
    expect(ploce.sheets.razlika).toBeCloseTo(-244.00, 1);
  });

  it('glavna grupa 18 mm (korpus + fronte istog dekora) = 6 ploča', () => {
    const { ploce } = izracun();
    const glavna = ploce.sheets.plan.find((g) => g.boardType === 'iverica'
      && g.thicknessMm === 18 && g.decorId === 'W1000');
    expect(glavna).toBeTruthy();
    expect(glavna.chargedSheets).toBe(6);
    expect(glavna.utilization).toBeGreaterThan(80);      // 86,5 % — korpus i fronte istog dekora dijele ploču
    expect(glavna.materialCost).toBeCloseTo(1272.80, 1);
  });

  it('HDF leđa = 2 ploče po 8,90 KM/m²', () => {
    const { ploce } = izracun();
    const hdf = ploce.sheets.plan.find((g) => g.boardType === 'hdf');
    expect(hdf.chargedSheets).toBe(2);
    expect(hdf.pricePerM2).toBeCloseTo(8.9, 5);
    expect(hdf.materialCost).toBeCloseTo(103.17, 1);
  });

  it('LED maska (20 mm) ide na medijapan 2800×1220 i računa pola ploče', () => {
    const { ploce } = izracun();
    const led = ploce.sheets.plan.find((g) => g.thicknessMm === 20);
    expect(led.boardType).toBe('medijapan_sjaj');
    expect(led.sheet.widthMm).toBe(2800);
    expect(led.sheet.heightMm).toBe(1220);
    expect(led.chargedSheets).toBe(0.5);
  });

  it('radne ploče NEMA u planu po pločama (kupuje se po dužnom metru)', () => {
    const { ploce } = izracun();
    expect(ploce.sheets.plan.some((g) => g.thicknessMm === 38)).toBe(false);
    expect(ploce.parts.radnaPlocaPoMetru).toBeCloseTo(661.97, 1);
  });
});
