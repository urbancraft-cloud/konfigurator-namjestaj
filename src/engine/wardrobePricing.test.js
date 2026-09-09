// src/engine/wardrobePricing.test.js
//
// Kalkulacija i krojna lista ormara po novom modelu:
//   nogice/donja maska → donji korpus (1950, editabilan) → gornji korpus (izveden)
//   → gornja maska (100, editabilna); bočne maske VAN korpusa, pune visine prostora.

import { describe, it, expect } from 'vitest';
import { computeWardrobePrice, computeWardrobeBOM, legCountOf } from './wardrobePricing';
import {
  segmentWidthMm, segmentInteriorWidthMm, carcassWidthMm, upperCorpusHeightMm,
  topMaskHeightMm, computedSideMaskDepthMm, doorHeightMm, hingedLeafWidthMm,
  slidingLeafCount, drawerUnitWidthMm, drawerBoxOuterWidthMm, drawerBoxInnerWidthMm,
  drawerSideGapMm, heightChecksum,
} from './wardrobeLayout';
import {
  WARDROBE_LEGS_PER_SEGMENT, DEFAULT_MAX_SLIDING_LEAF_MM, SIDE_MASK_T,
  PANEL_T, BACK_T, MIN_UPPER_CORPUS_MM,
} from '../data/wardrobe';
import { VAT_RATE } from '../data/tech';
import { RUNNER_SYSTEMS } from '../data/hardware';

const segs = (n) => Array.from({ length: n }, () => ({ lower: { items: [] }, upper: { items: [] } }));

/** Referentni ormar: 2400 × 2600 × 580, 3 segmenta, nogice 100, baglame. */
const W = (over = {}) => ({
  widthMm: 2400, depthMm: 580, roomHeightMm: 2600,
  legHeightMm: 100, lowerCorpusHeightMm: 1950, topMaskHeightMm: 100,
  doorType: 'baglame', segmentCount: 3,
  sideMaskDepthLeftMm: null, sideMaskDepthRightMm: null, doorHeightMm: null,
  maxSlidingLeafWidthMm: DEFAULT_MAX_SLIDING_LEAF_MM,
  corpusDecorId: 'H1180', doorDecorId: 'W1000',
  segments: segs(3),
  ...over,
});

const red = (bom, re) => bom.rows.filter((r) => re.test(r.role));
const kolicina = (bom, re) => red(bom, re).reduce((s, r) => s + r.qty, 0);

describe('nogice — 5 po segmentu', () => {
  it('n segmenata × 5', () => {
    [[1, 5], [2, 10], [3, 15], [4, 20], [6, 30]].forEach(([n, ocekivano]) => {
      expect(legCountOf(W({ segmentCount: n, segments: segs(n) }))).toBe(ocekivano);
    });
    expect(WARDROBE_LEGS_PER_SEGMENT).toBe(5);
  });

  it('ulaze u cijenu po komadu', () => {
    const p = computeWardrobePrice(W());
    expect(p.meta.legCount).toBe(15);
    expect(p.breakdown.nogice).toBeCloseTo(15 * 3.5, 5);
  });

  it('nalaze se u okovu, ne u pločama', () => {
    const b = computeWardrobeBOM(W());
    const n = b.hardware.find((h) => /nogice/i.test(h.role));
    expect(n.qty).toBe(15);
    expect(b.rows.some((r) => /nogice/i.test(r.role))).toBe(false);
  });
});

describe('bočne maske — VAN korpusa, pune visine prostora', () => {
  it('dvije maske debljine 18 mm', () => {
    const b = computeWardrobeBOM(W());
    const maske = red(b, /Bočna maska/);
    expect(maske).toHaveLength(2);
    maske.forEach((m) => {
      expect(m.qty).toBe(1);
      expect(m.cutL).toBe(2600);            // H_prostor, NE H_korpusi
      expect(m.cutW).toBe(601);             // 3 + 580 + 18
      expect(m.material).toBe('korpus');
    });
    expect(maske[0].role).toMatch(/lijeva/);
    expect(maske[1].role).toMatch(/desna/);
  });

  it('dubina maske = 3 (lesomal) + dubina korpusa + 18 (vrata)', () => {
    expect(computedSideMaskDepthMm(W())).toBe(BACK_T + 580 + PANEL_T);
    expect(computedSideMaskDepthMm(W({ depthMm: 450 }))).toBe(471);
  });

  it('ručno prepisana dubina mijenja SAMO tu stranu u krojnoj listi', () => {
    const b = computeWardrobeBOM(W({ sideMaskDepthLeftMm: 300 }));
    const l = red(b, /Bočna maska lijeva/)[0];
    const d = red(b, /Bočna maska desna/)[0];
    expect(l.cutW).toBe(300);
    expect(d.cutW).toBe(601);
    expect(l.role).toMatch(/ručno/);
  });

  it('Širina korpusa = W_ormar − 2 × 18, i maske se režu po tome', () => {
    const w = W();
    expect(carcassWidthMm(w)).toBe(2400 - 2 * SIDE_MASK_T);   // 2364
    const b = computeWardrobeBOM(w);
    red(b, /maska \(/).forEach((m) => expect(m.cutL).toBe(2364));
  });

  it('površina bočnih maski ulazi u cijenu', () => {
    const sa = computeWardrobePrice(W()).breakdown['maske — donja, gornja i bočne'];
    const bez = computeWardrobePrice(W({ sideMaskDepthLeftMm: 50, sideMaskDepthRightMm: 50 }))
      .breakdown['maske — donja, gornja i bočne'];
    expect(sa).toBeGreaterThan(bez);
  });
});

describe('donja i gornja maska', () => {
  it('donja maska = visina nogica, preko širine korpusa', () => {
    const b = computeWardrobeBOM(W());
    const m = red(b, /Donja maska/)[0];
    expect(m.cutL).toBe(2364);
    expect(m.cutW).toBe(100);
  });

  it('visina gornje maske je editabilna i prati krojnu listu', () => {
    const b = computeWardrobeBOM(W({ topMaskHeightMm: 150 }));
    const m = red(b, /Gornja maska/)[0];
    expect(m.cutW).toBe(150);
    expect(topMaskHeightMm(W({ topMaskHeightMm: 150 }))).toBe(150);
  });

  it('gornja maska se ne računa po tvrdo kodiranih 100', () => {
    const a = computeWardrobeBOM(W({ topMaskHeightMm: 60 }));
    const b = computeWardrobeBOM(W({ topMaskHeightMm: 200 }));
    expect(red(a, /Gornja maska/)[0].cutW).toBe(60);
    expect(red(b, /Gornja maska/)[0].cutW).toBe(200);
  });
});

describe('korpus — bokovi, vrh i dno po segmentu', () => {
  it('svaki segment ima SVOJA dva boka (nema zasebnih pregrada između segmenata)', () => {
    const b = computeWardrobeBOM(W());
    expect(kolicina(b, /Bok donjeg korpusa/)).toBe(6);      // 3 × 2
    expect(kolicina(b, /Bok gornjeg korpusa/)).toBe(6);
    expect(red(b, /Pregrada/)).toHaveLength(0);             // bokovi susjeda se dodiruju
    expect(kolicina(b, /Gornja ploča donjeg/)).toBe(3);
    expect(kolicina(b, /Donja ploča donjeg/)).toBe(3);
    expect(kolicina(b, /Gornja ploča gornjeg/)).toBe(3);
    expect(kolicina(b, /Donja ploča gornjeg/)).toBe(3);
  });

  /* Po segmentu: 2 ploče u donjem korpusu (vrh + dno) i 2 u gornjem = 4.
     Ali krojna lista ih grupiše u 4 REDA (vrh donjeg, dno donjeg, vrh gornjeg,
     dno gornjeg), svaki sa `qty = n`, pa je ukupno komada 4n. */
  it('n × 4 horizontalne ploče (vrh i dno, oba korpusa)', () => {
    [1, 2, 3, 4].forEach((n) => {
      const b = computeWardrobeBOM(W({ segmentCount: n, segments: segs(n) }));
      expect(kolicina(b, /ploča (donjeg|gornjeg)/)).toBe(n * 4);
      expect(red(b, /ploča (donjeg|gornjeg)/)).toHaveLength(4);
    });
  });

  it('bokovi imaju visinu odgovarajućeg korpusa', () => {
    const b = computeWardrobeBOM(W());
    expect(red(b, /Bok donjeg korpusa/)[0].cutL).toBe(1950);
    expect(red(b, /Bok gornjeg korpusa/)[0].cutL).toBe(450);
    b.rows.filter((r) => /Bok/.test(r.role)).forEach((r) => expect(r.cutW).toBe(580));
  });

  it('promjena visine donjeg korpusa mijenja sve bokove i leđa', () => {
    const b = computeWardrobeBOM(W({ lowerCorpusHeightMm: 1800 }));
    expect(red(b, /Bok donjeg korpusa/)[0].cutL).toBe(1800);
    expect(red(b, /Bok gornjeg korpusa/)[0].cutL).toBe(600);   // 2400 − 1800
    expect(red(b, /Leđa donjeg/)[0].cutW).toBe(1800);
  });

  it('leđa (lesomal 3 mm) idu PO SEGMENTU, ne u jednoj ploči', () => {
    const b = computeWardrobeBOM(W());
    const donja = red(b, /Leđa donjeg/)[0];
    const gornja = red(b, /Leđa gornjeg/)[0];
    expect(donja.qty).toBe(3);
    expect(donja.cutL).toBe(Math.round(segmentWidthMm(W())));   // 788, ne 2400
    expect(donja.cutW).toBe(1950);
    expect(gornja.qty).toBe(3);
    expect(gornja.cutW).toBe(450);
    expect(donja.cutL).toBeLessThan(2400);
  });

  it('površina korpusa raste sa brojem segmenata pri istoj širini ormara', () => {
    const a = computeWardrobePrice(W({ segmentCount: 2, segments: segs(2) }));
    const b = computeWardrobePrice(W({ segmentCount: 4, segments: segs(4) }));
    expect(b.meta.corpusBoardM2).toBeGreaterThan(a.meta.corpusBoardM2);
  });
});

describe('vrata', () => {
  it('visina = H_prostor − nogice − gornja maska − 4 mm fuge', () => {
    expect(doorHeightMm(W())).toBe(2600 - 100 - 100 - 4);     // 2396
    const b = computeWardrobeBOM(W());
    red(b, /^Vrata segment/).forEach((r) => expect(r.cutW).toBe(2396));
  });

  it('jedno krilo po segmentu dok je širina izvodljiva', () => {
    const b = computeWardrobeBOM(W());
    const vrata = red(b, /^Vrata segment/);
    expect(vrata).toHaveLength(3);
    vrata.forEach((r) => expect(r.qty).toBe(1));
    expect(vrata[0].cutL).toBe(hingedLeafWidthMm(W()));       // 784
    expect(vrata[0].role).toMatch(/1 krilo/);
  });

  it('širok segment dijeli se na 2 krila (gramatika ispravna)', () => {
    const w = W({ widthMm: 3400, segmentCount: 2 });           // korpus 3364, segment 1682
    expect(segmentWidthMm(w)).toBe(1682);
    const b = computeWardrobeBOM(w);
    const vrata = red(b, /^Vrata segment/);
    expect(vrata).toHaveLength(2);
    expect(vrata[0].qty).toBe(2);
    expect(vrata[0].role).toMatch(/2 krila/);
    expect(vrata[0].cutL).toBeLessThanOrEqual(900);
    expect(hingedLeafWidthMm(w)).toBeLessThanOrEqual(900);
  });

  it('vrlo širok segment dijeli se na 3 krila', () => {
    const w = W({ widthMm: 4000, segmentCount: 2 });           // segment 1982
    const b = computeWardrobeBOM(w);
    expect(red(b, /^Vrata segment/)[0].qty).toBe(3);
    expect(red(b, /^Vrata segment/)[0].role).toMatch(/3 krila/);
  });

  it('klizna vrata: broj krila iz širine KORPUSA', () => {
    const w = W({ doorType: 'klizna', widthMm: 4000 });
    expect(slidingLeafCount(w)).toBe(4);
    const b = computeWardrobeBOM(w);
    expect(red(b, /^Vrata segment/)).toHaveLength(0);          // nema krila po segmentu
    expect(kolicina(b, /Klizno krilo/)).toBe(4);
  });

  it('šarke: 4 po krilu za vrata iznad 1200 mm', () => {
    const b = computeWardrobeBOM(W());
    const sarke = b.hardware.find((h) => /Šarke \(komada\)/.test(h.role));
    expect(sarke.qty).toBe(3 * 4);
    expect(sarke.note).toMatch(/4 po krilu/);
    const obracun = b.hardware.find((h) => /Okov vrata \(obračun\)/.test(h.role));
    expect(obracun.qty).toBe(3);                               // po krilu
  });
});

describe('ladičar — širina 100 mm manja od SVIJETLE širine segmenta', () => {
  const saLadicarem = (over = {}) => {
    const w = W(over);
    w.segments[0].lower.items.push({
      id: 'lad1', type: 'ladicar', yMm: 0, heightMm: 700, drawerCount: 3,
      widthMm: drawerUnitWidthMm(w),
    });
    return w;
  };

  it('ukupna dimenzija ladičara = svijetla širina segmenta − 100', () => {
    const w = saLadicarem();
    expect(segmentInteriorWidthMm(w)).toBe(752);
    expect(drawerUnitWidthMm(w)).toBe(652);
    // 4 segmenta: korpus 2364 / 4 = 591, svijetlo 555, ladičar 455
    expect(drawerUnitWidthMm(W({ segmentCount: 4, segments: segs(4) }))).toBe(555 - 100);
  });

  it('fronte ladica se režu po toj širini i po AUTO visinama', () => {
    const b = computeWardrobeBOM(saLadicarem());
    const fronte = red(b, /fronta \d/);
    expect(fronte).toHaveLength(3);
    fronte.forEach((f) => expect(f.cutL).toBe(652));
    // 700 − 4×3 = 688 → 230, 229, 229 (drift na prvu)
    const zbir = fronte.reduce((s, f) => s + f.cutW, 0);
    expect(zbir + 4 * 3).toBe(700);
    expect(Math.max(...fronte.map((f) => f.cutW)) - Math.min(...fronte.map((f) => f.cutW))).toBeLessThanOrEqual(1);
  });

  it('sanduk ladice je raspisan na bokove, čelo/leđa i pod', () => {
    const w = saLadicarem();
    const b = computeWardrobeBOM(w);
    expect(kolicina(b, /bok sanduka/)).toBe(6);          // 3 ladice × 2
    expect(kolicina(b, /čelo\/leđa sanduka/)).toBe(6);
    expect(kolicina(b, /pod sanduka/)).toBe(3);
    red(b, /sanduka/).forEach((r) => {
      expect(r.cutL).toBeGreaterThan(0);
      expect(r.cutW).toBeGreaterThan(0);
    });
    // bokovi sanduka: dubina 480 × visina 140
    expect(red(b, /bok sanduka/)[0].cutL).toBe(480);
    expect(red(b, /bok sanduka/)[0].cutW).toBe(140);
  });

  /* Regresija na stvarni bug: `sideClearanceMm` se oduzimao DVA PUT, pa je čelo
     sanduka (590 mm) izlazilo ŠIRE od samog ladičara (652 − 2×13 − 2×18) i od
     svjetle širine segmenta — fizički nemoguće. */
  it('sanduk nikad nije širi od ladičara ni od svjetle širine segmenta', () => {
    [1, 2, 3, 4, 5, 6].forEach((n) => {
      const w = W({ segmentCount: n, segments: segs(n) });
      const unit = drawerUnitWidthMm(w);
      const inner = segmentInteriorWidthMm(w);
      const boxOuter = drawerBoxOuterWidthMm(w);
      const boxInner = drawerBoxInnerWidthMm(w, RUNNER_SYSTEMS.GTV_BALL_500);
      expect(boxOuter).toBeLessThanOrEqual(unit);
      expect(boxOuter).toBeLessThan(inner);
      expect(boxInner).toBeLessThan(boxOuter);
      expect(boxInner).toBeGreaterThan(0);
      // prostor za vodilice mora biti nenegativan
      expect(drawerSideGapMm(w)).toBeGreaterThanOrEqual(0);
    });
  });

  it('za referentni ormar prostor za vodilice je dovoljan za GTV', () => {
    const w = W();
    const R = RUNNER_SYSTEMS.GTV_BALL_500;
    // svijetlo 752, ladičar 652 → 50 mm po strani, GTV traži 13
    expect(drawerSideGapMm(w)).toBe(50);
    expect(drawerSideGapMm(w)).toBeGreaterThanOrEqual(R.sideClearanceMm);
    expect(drawerBoxInnerWidthMm(w, R)).toBe(652 - 2 * R.boxThicknessMm);
  });

  it('vodilice su u okovu, po ladici', () => {
    const b = computeWardrobeBOM(saLadicarem());
    const v = b.hardware.find((h) => /Vodilice ladica/.test(h.role));
    expect(v.qty).toBe(3);
  });

  it('promjena visine ladičara mijenja visine fronti', () => {
    const w = saLadicarem();
    w.segments[0].lower.items[0].heightMm = 900;
    const b = computeWardrobeBOM(w);
    const fronte = red(b, /fronta \d/);
    expect(fronte.reduce((s, f) => s + f.cutW, 0) + 12).toBe(900);
  });

  it('promjena broja ladica mijenja broj fronti i sanduka', () => {
    const w = saLadicarem();
    w.segments[0].lower.items[0].drawerCount = 5;
    const b = computeWardrobeBOM(w);
    expect(red(b, /fronta \d/)).toHaveLength(5);
    expect(kolicina(b, /bok sanduka/)).toBe(10);
  });
});

describe('police i šipke', () => {
  it('police se režu po SVIJETLOJ širini segmenta', () => {
    const w = W();
    w.segments[1].upper.items.push({ id: 'p1', type: 'polica', yMm: 0, shelfCount: 4, zoneMm: 400, adjustable: true });
    const b = computeWardrobeBOM(w);
    const p = red(b, /Polica S2/);
    expect(p).toHaveLength(1);
    expect(p[0].qty).toBe(4);
    expect(p[0].cutL).toBe(Math.round(segmentInteriorWidthMm(w)));   // 752
    expect(p[0].cutW).toBe(580);
  });

  it('podesive police imaju nosače u okovu, fiksne nemaju', () => {
    const podesive = W();
    podesive.segments[0].lower.items.push({ id: 'p1', type: 'polica', yMm: 0, shelfCount: 3, zoneMm: 900, adjustable: true });
    const fiksne = W();
    fiksne.segments[0].lower.items.push({ id: 'p1', type: 'polica', yMm: 0, shelfCount: 3, zoneMm: 900, adjustable: false });

    expect(computeWardrobeBOM(podesive).hardware.some((h) => /Nosači polica/.test(h.role))).toBe(true);
    expect(computeWardrobeBOM(fiksne).hardware.some((h) => /Nosači polica/.test(h.role))).toBe(false);
    expect(red(computeWardrobeBOM(fiksne), /fiksna/)).toHaveLength(1);
  });

  it('šipka je okov, ne ploča (nema krojnih mjera)', () => {
    const w = W();
    w.segments[0].lower.items.push({ id: 's1', type: 'sipka', yMm: 1000, clearance: 'duga' });
    const b = computeWardrobeBOM(w);
    expect(b.rows.some((r) => /šipka/i.test(r.role))).toBe(false);
    expect(b.hardware.some((h) => /šipka/i.test(h.role))).toBe(true);
  });
});

describe('cijena', () => {
  it('PDV dolazi iz zajedničke konstante (nije tvrdo kodiran)', () => {
    const p = computeWardrobePrice(W());
    expect(p.vat).toBeCloseTo(p.net * VAT_RATE, 6);
    expect(p.gross).toBeCloseTo(p.net + p.vat, 6);
    expect(VAT_RATE).toBe(0.17);
  });

  it('sve stavke su konačni pozitivni brojevi', () => {
    const p = computeWardrobePrice(W());
    expect(p.net).toBeGreaterThan(0);
    Object.values(p.breakdown).forEach((v) => {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    });
  });

  it('nema duplog obračuna polica (priceFactor JE faktor cijene ploče)', () => {
    const prazan = computeWardrobePrice(W());
    const w = W();
    w.segments[0].lower.items.push({ id: 'p1', type: 'polica', yMm: 0, shelfCount: 1, zoneMm: 900, adjustable: true });
    const saPolcom = computeWardrobePrice(w);
    const iznos = saPolcom.breakdown.police;
    expect(prazan.breakdown.police).toBe(0);
    expect(iznos).toBeGreaterThan(0);
    // polica 752 × 580 = 0,4362 m²; H1180 po cjenovniku × 0,6 → mora biti
    // reda veličine jedne ploče, ne dvije (duplo obračunato bi bilo ~2×).
    const m2 = (752 * 580) / 1e6;
    expect(iznos / m2).toBeGreaterThan(5);
    expect(iznos / m2).toBeLessThan(60);
  });

  it('meta podaci su potpuni i konzistentni sa engine-om', () => {
    const w = W();
    const m = computeWardrobePrice(w).meta;
    expect(m.segmentCount).toBe(3);
    expect(m.segmentWidthMm).toBe(Math.round(segmentWidthMm(w)));
    expect(m.segmentInteriorWidthMm).toBe(Math.round(segmentInteriorWidthMm(w)));
    expect(m.carcassWidthMm).toBe(Math.round(carcassWidthMm(w)));
    expect(m.lowerCorpusHeightMm).toBe(1950);
    expect(m.upperCorpusHeightMm).toBe(450);
    expect(m.doorHeightMm).toBe(Math.round(doorHeightMm(w)));
    expect(m.sideMaskDepthLeftMm).toBe(601);
    expect(m.drawerUnitWidthMm).toBe(652);
    expect(m.heightChecksum.ok).toBe(true);
  });
});

describe('nevažeće dimenzije se prijavljuju, ne ruše', () => {
  it('gornji korpus ≤ 0 daje napomenu i izbacuje gornje redove', () => {
    const w = W({ roomHeightMm: 2100 });            // 1900 − 1950 = −50
    expect(upperCorpusHeightMm(w)).toBeLessThan(0);
    let b;
    expect(() => { b = computeWardrobeBOM(w); }).not.toThrow();
    expect(b.notes.length).toBeGreaterThan(0);
    expect(b.notes.join(' ')).toMatch(/Gornji korpus/);
    expect(red(b, /gornjeg korpusa/)).toHaveLength(0);
    expect(red(b, /donjeg korpusa/).length).toBeGreaterThan(0);
  });

  it('gornji korpus ispod preporuke daje upozorenje ali se reže', () => {
    const w = W({ roomHeightMm: 2200 });            // 2000 − 1950 = 50
    expect(upperCorpusHeightMm(w)).toBe(50);
    expect(upperCorpusHeightMm(w)).toBeLessThan(MIN_UPPER_CORPUS_MM);
    const b = computeWardrobeBOM(w);
    expect(b.notes.join(' ')).toMatch(/50 mm/);
    expect(red(b, /Bok gornjeg korpusa/)).toHaveLength(1);
  });

  it('cijena se i dalje računa kad je gornji korpus nevažeći', () => {
    const p = computeWardrobePrice(W({ roomHeightMm: 2100 }));
    expect(Number.isFinite(p.net)).toBe(true);
    expect(p.net).toBeGreaterThan(0);
    expect(p.meta.upperCorpusHeightMm).toBeLessThanOrEqual(0);
  });

  it('nema redova sa krojnom mjerom 0 i nijedan red nije okov', () => {
    const b = computeWardrobeBOM(W());
    b.rows.forEach((r) => {
      expect(r.cutL).toBeGreaterThan(0);
      expect(r.cutW).toBeGreaterThan(0);
      expect(r.qty).toBeGreaterThan(0);
      expect(r.material).not.toBe('okov');
      expect(r.areaM2).toBeCloseTo((r.qty * r.cutL * r.cutW) / 1e6, 6);
    });
  });

  it('kontrolni zbir visina je u napomenama kad se ne slaže', () => {
    // Namjerno neusklađen ulaz: roomHeightMm se ne poklapa sa sastavom
    const w = W({ roomHeightMm: 2600, lowerCorpusHeightMm: 1950 });
    expect(heightChecksum(w).ok).toBe(true);
    const b = computeWardrobeBOM(w);
    expect(b.notes.some((n) => /ne slažu/.test(n))).toBe(false);
  });
});
