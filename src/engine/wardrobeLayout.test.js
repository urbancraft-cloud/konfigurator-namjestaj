// src/engine/wardrobeLayout.test.js
//
// Geometrija ugradbenog ormara po definisanom modelu:
//   nogice/donja maska → donji korpus (1950 default, editabilan)
//   → gornji korpus (izveden) → gornja maska (100, editabilna)
//   bočne maske VAN korpusa, pune visine prostora.

import { describe, it, expect } from 'vitest';
import {
  bottomMaskHeightMm, topMaskHeightMm, totalCorpusHeightMm,
  lowerCorpusHeightMm, upperCorpusHeightMm, corpusHeightMm, corpusInteriorHeightMm,
  corpusBaseYMm, corpusInteriorBaseYMm, topMaskSpanMm, bottomMaskSpanMm,
  isUpperCorpusValid, isWardrobeHeightValid, heightChecksum,
  segmentCount, carcassWidthMm, segmentWidthMm, segmentInteriorWidthMm,
  computedSideMaskDepthMm, sideMaskDepthMm, sideMaskHeightMm, sideMaskIsManual,
  doorHeightMm, hingedLeavesPerSegment, hingedLeafWidthMm, hingesPerLeaf,
  maxSlidingLeafOf, slidingLeafCount, slidingLeafWidthMm, doorLeafCount,
  drawerUnitWidthMm, drawerFrontHeightsMm, drawerFrontPositionsMm,
  shelfPositionsMm, itemOccupiedHeightMm, collidesInSegment, findFreeY,
  createDefaultItem, MAX_HINGED_LEAF_MM,
} from './wardrobeLayout';

/** Referentni ormar: 1236 × 2500, dubina 580, 3 segmenta, nogice 100. */
const W = (over = {}) => ({
  widthMm: 1236, depthMm: 580, roomHeightMm: 2500,
  legHeightMm: 100, lowerCorpusHeightMm: 1950, topMaskHeightMm: 100,
  doorType: 'baglame', segmentCount: 3,
  sideMaskDepthLeftMm: null, sideMaskDepthRightMm: null, doorHeightMm: null,
  maxSlidingLeafWidthMm: 1000,
  segments: [],
  ...over,
});

describe('1. Vertikalne dimenzije i maske', () => {
  it('donja maska je UVIJEK jednaka visini nogica', () => {
    expect(bottomMaskHeightMm(W({ legHeightMm: 100 }))).toBe(100);
    expect(bottomMaskHeightMm(W({ legHeightMm: 50 }))).toBe(50);
  });

  it('gornja maska je default 100 mm ali je editabilna', () => {
    expect(topMaskHeightMm(W())).toBe(100);
    expect(topMaskHeightMm(W({ topMaskHeightMm: 150 }))).toBe(150);
    expect(topMaskHeightMm(W({ topMaskHeightMm: 0 }))).toBe(100);     // 0 nije dozvoljeno
    expect(topMaskHeightMm(W({ topMaskHeightMm: 'abc' }))).toBe(100);
  });

  it('H_korpusi = H_prostor − donja maska − gornja maska', () => {
    expect(totalCorpusHeightMm(W())).toBe(2500 - 100 - 100);          // 2300
    expect(totalCorpusHeightMm(W({ roomHeightMm: 2600 }))).toBe(2400);
    expect(totalCorpusHeightMm(W({ legHeightMm: 50 }))).toBe(2350);
    expect(totalCorpusHeightMm(W({ topMaskHeightMm: 150 }))).toBe(2250);
  });

  it('donji korpus je default 1950 i editabilan BEZ granica', () => {
    expect(lowerCorpusHeightMm(W())).toBe(1950);
    expect(lowerCorpusHeightMm(W({ lowerCorpusHeightMm: 1200 }))).toBe(1200);
    expect(lowerCorpusHeightMm(W({ lowerCorpusHeightMm: 2100 }))).toBe(2100);
    expect(lowerCorpusHeightMm(W({ lowerCorpusHeightMm: 800 }))).toBe(800);
  });

  it('gornji korpus je IZVEDEN i popunjava prostor do gornje maske', () => {
    expect(upperCorpusHeightMm(W())).toBe(2300 - 1950);               // 350
    expect(upperCorpusHeightMm(W({ roomHeightMm: 2600 }))).toBe(450);
    expect(upperCorpusHeightMm(W({ lowerCorpusHeightMm: 1200 }))).toBe(1100);
  });

  it('KONTROLNI ZBIR: nogice + donji + gornji + gornja maska = H_prostor', () => {
    [2200, 2400, 2500, 2600, 2800, 3000].forEach((h) => {
      [50, 100].forEach((leg) => {
        [1200, 1950, 2050].forEach((lower) => {
          const c = heightChecksum(W({ roomHeightMm: h, legHeightMm: leg, lowerCorpusHeightMm: lower }));
          expect(c.ok, `H=${h} nogice=${leg} donji=${lower} → ${c.sumMm} ≠ ${c.roomHeightMm}`).toBe(true);
          expect(c.sumMm).toBe(h);
        });
      });
    });
  });

  it('gornji korpus može biti negativan (nevalidan ulaz) i to se NE krije', () => {
    const w = W({ roomHeightMm: 2100, lowerCorpusHeightMm: 1950 });   // 1900 − 1950 = −50
    expect(upperCorpusHeightMm(w)).toBe(-50);
    expect(isUpperCorpusValid(w)).toBe(false);
    expect(isWardrobeHeightValid(w)).toBe(false);                     // deprecated alias
  });

  it('gornji korpus ispod preporučenih 150 mm je pozitivan ali se upozorava', () => {
    const w = W({ roomHeightMm: 2200, lowerCorpusHeightMm: 1950 });   // 2000 − 1950 = 50
    expect(upperCorpusHeightMm(w)).toBe(50);
    expect(isUpperCorpusValid(w)).toBe(false);        // < MIN_UPPER_CORPUS_MM
    expect(upperCorpusHeightMm(w)).toBeGreaterThan(0); // ali nije negativan
  });

  it('apsolutne kote od poda', () => {
    const w = W();
    expect(corpusBaseYMm(w, 'lower')).toBe(100);
    expect(corpusBaseYMm(w, 'upper')).toBe(100 + 1950);
    expect(corpusInteriorBaseYMm(w, 'lower')).toBe(100 + 18);
    expect(bottomMaskSpanMm(w)).toEqual({ y0: 0, y1: 100 });
    expect(topMaskSpanMm(w)).toEqual({ y0: 2400, y1: 2500 });
  });

  it('svijetla visina korpusa oduzima gornju i donju ploču (2 × 18)', () => {
    expect(corpusInteriorHeightMm(W(), 'lower')).toBe(1950 - 36);
    expect(corpusInteriorHeightMm(W(), 'upper')).toBe(350 - 36);
    expect(corpusHeightMm(W(), 'lower')).toBe(1950);
    expect(corpusHeightMm(W(), 'upper')).toBe(350);
  });
});

describe('2. Horizontalne dimenzije, bočne maske i segmentacija', () => {
  it('bočne maske su VAN korpusa: W_korpusa = W_ormar − 2×18', () => {
    expect(carcassWidthMm(W())).toBe(1236 - 36);      // 1200
    expect(carcassWidthMm(W({ widthMm: 2400 }))).toBe(2364);
  });

  it('širina segmenta = W_korpusa / n', () => {
    expect(segmentWidthMm(W())).toBe(400);
    expect(segmentWidthMm(W({ segmentCount: 2 }))).toBe(600);
    expect(segmentWidthMm(W({ segmentCount: 4 }))).toBe(300);
    expect(segmentWidthMm(W({ widthMm: 2400, segmentCount: 3 }))).toBe(788);
  });

  it('vaš primjer: 1236 mm, 3 segmenta → 3 vrata po 396 mm', () => {
    const w = W();
    expect(carcassWidthMm(w)).toBe(1200);
    expect(segmentWidthMm(w)).toBe(400);
    expect(hingedLeavesPerSegment(w)).toBe(1);
    expect(hingedLeafWidthMm(w)).toBe(396);           // 400 − 2 − 2
    /* Kuhinjska logika fuge (`resolveFrontLayout`):
         usable = W − 2·edgeR − (n−1)·gap   →   1200 − 4 − 8 = 1188
         3 krila × 396 = 1188 ✓
       Ukupno zauzeće = krila + fuge na oba ruba + zazori između:
         3·(2·2) + 2·4 = 12 + 8 = 20 mm, pa 1188 + 20 = 1208... ali se rubne
         fuge dijele sa susjednim segmentom, tako da po segmentu otpada
         4 mm (2 lijevo + 2 desno) a između krila 4 mm:
         3·396 + 3·4 = 1200 ✓ */
    expect(3 * hingedLeafWidthMm(w) + 3 * 4).toBe(1200);
  });

  it('svijetla širina segmenta = širina segmenta − 2 boka', () => {
    expect(segmentInteriorWidthMm(W())).toBe(400 - 36);        // 364
    expect(segmentInteriorWidthMm(W({ segmentCount: 2 }))).toBe(600 - 36);
  });

  it('broj segmenata je ulaz i steže se u granice', () => {
    expect(segmentCount(W({ segmentCount: 5 }))).toBe(5);
    expect(segmentCount(W({ segmentCount: 0 }))).toBe(1);
    expect(segmentCount(W({ segmentCount: 99 }))).toBe(8);
    expect(segmentCount(W({ segmentCount: 'abc' }))).toBe(3);
  });

  it('dubina bočne maske = 3 (lesomal) + dubina korpusa + 18 (vrata)', () => {
    expect(computedSideMaskDepthMm(W())).toBe(3 + 580 + 18);   // 601
    expect(computedSideMaskDepthMm(W({ depthMm: 450 }))).toBe(471);
  });

  it('visina bočne maske = H_prostor (prekriva i donju i gornju masku)', () => {
    expect(sideMaskHeightMm(W())).toBe(2500);
    expect(sideMaskHeightMm(W({ roomHeightMm: 2800 }))).toBe(2800);
    // i da je stvarno veća od visine korpusa
    expect(sideMaskHeightMm(W())).toBeGreaterThan(totalCorpusHeightMm(W()));
  });

  it('dubina bočne maske se može ručno prepisati ZASEBNO po strani', () => {
    const w = W({ sideMaskDepthLeftMm: 300, sideMaskDepthRightMm: null });
    expect(sideMaskDepthMm(w, 'left')).toBe(300);
    expect(sideMaskDepthMm(w, 'right')).toBe(601);            // automatski
    expect(sideMaskIsManual(w, 'left')).toBe(true);
    expect(sideMaskIsManual(w, 'right')).toBe(false);
  });

  it('ručna dubina maske ne utiče na drugu stranu', () => {
    const w = W({ sideMaskDepthRightMm: 120 });
    expect(sideMaskDepthMm(w, 'left')).toBe(601);
    expect(sideMaskDepthMm(w, 'right')).toBe(120);
  });
});

describe('3. Vrata', () => {
  it('visina vrata = H_prostor − nogice − gornja maska − 4 mm fuge', () => {
    expect(doorHeightMm(W())).toBe(2500 - 100 - 100 - 4);     // 2296
    expect(doorHeightMm(W({ roomHeightMm: 2600 }))).toBe(2396);
    expect(doorHeightMm(W({ legHeightMm: 50 }))).toBe(2346);
    expect(doorHeightMm(W({ topMaskHeightMm: 150 }))).toBe(2246);
  });

  it('visina vrata se može ručno prepisati', () => {
    expect(doorHeightMm(W({ doorHeightMm: 2280 }))).toBe(2280);
    expect(doorHeightMm(W({ doorHeightMm: 0 }))).toBe(2296);   // 0 = automatski
    expect(doorHeightMm(W({ doorHeightMm: null }))).toBe(2296);
  });

  it('vrata NE prekrivaju gornju ni donju masku', () => {
    const w = W();
    const vrh = bottomMaskHeightMm(w) + doorHeightMm(w);
    expect(vrh).toBeLessThan(w.roomHeightMm - topMaskHeightMm(w) + 1);
    expect(doorHeightMm(w)).toBeLessThan(totalCorpusHeightMm(w));
  });

  it('šarke: 4 po krilu iznad 1200 mm, 2 ispod (isto kao kuhinja)', () => {
    expect(hingesPerLeaf(W())).toBe(4);                        // 2296 mm
    expect(hingesPerLeaf(W({ roomHeightMm: 1400, lowerCorpusHeightMm: 1000 }))).toBe(2);
  });

  it('širok segment dijeli baglame na više krila (krilo > 900 mm nije izvodljivo)', () => {
    expect(MAX_HINGED_LEAF_MM).toBe(900);
    const w = W({ widthMm: 2400, segmentCount: 2 });           // segment 1182
    expect(segmentWidthMm(w)).toBe(1182);
    expect(hingedLeavesPerSegment(w)).toBe(2);
    expect(hingedLeafWidthMm(w)).toBeLessThanOrEqual(MAX_HINGED_LEAF_MM);
    // ukupno se i dalje zatvara otvor
    const leaves = hingedLeavesPerSegment(w);
    expect(leaves * hingedLeafWidthMm(w) + (leaves - 1) * 4 + 4).toBeCloseTo(1182, 0);
  });

  it('klizna vrata: broj krila iz širine KORPUSA i max širine krila', () => {
    expect(maxSlidingLeafOf(W())).toBe(1000);
    expect(slidingLeafCount(W())).toBe(2);                     // ceil(1200/1000)
    expect(slidingLeafCount(W({ widthMm: 4000 }))).toBe(4);    // ceil(3964/1000)
    expect(slidingLeafWidthMm(W({ widthMm: 4000 }))).toBeLessThanOrEqual(1040);
  });

  it('max širina kliznog krila je editabilna i mijenja broj krila', () => {
    const w = W({ widthMm: 4000, maxSlidingLeafWidthMm: 1400 });
    expect(maxSlidingLeafOf(w)).toBe(1400);
    expect(slidingLeafCount(w)).toBe(3);
  });

  it('doorLeafCount: baglame = krila × segmenti, klizna = ukupno krila', () => {
    expect(doorLeafCount(W())).toBe(3);                        // 1 × 3 segmenta
    expect(doorLeafCount(W({ doorType: 'klizna' }))).toBe(2);
  });
});

describe('4. Unutrašnje opremanje', () => {
  it('ladičar = SVIJETLA širina segmenta − 100 mm', () => {
    expect(drawerUnitWidthMm(W())).toBe(364 - 100);            // 264
    expect(drawerUnitWidthMm(W({ segmentCount: 2 }))).toBe(564 - 100);
    expect(drawerUnitWidthMm(W({ widthMm: 2400, segmentCount: 3 }))).toBe(752 - 100);
  });

  it('ladičar default: 700 mm visine sa 3 ladice', () => {
    const it = createDefaultItem('ladicar', W());
    expect(it.heightMm).toBe(700);
    expect(it.drawerCount).toBe(3);
    expect(it.widthMm).toBe(264);
    expect(it.type).toBe('ladicar');
  });

  it('visine fronti se dijele AUTOMATSKI i zbir tačno odgovara visini ladičara', () => {
    const it = createDefaultItem('ladicar', W());
    const h = drawerFrontHeightsMm(it);
    expect(h).toHaveLength(3);
    // 700 − 4 × 3 (zazor) = 688 → 229 + 229 + 230 (drift ide na PRVU)
    expect(h.reduce((a, b) => a + b, 0) + 4 * 3).toBe(700);
    expect(Math.max(...h) - Math.min(...h)).toBeLessThanOrEqual(1);
  });

  it('drift od zaokruživanja ide na prvu frontu (nema fuge koja ne zatvara)', () => {
    const h = drawerFrontHeightsMm({ heightMm: 700, drawerCount: 3 });
    expect(h[0]).toBeGreaterThanOrEqual(h[1]);
    expect(h[1]).toBe(h[2]);
  });

  it('broj ladica je podesiv i visina po ladici se prilagođava', () => {
    [1, 2, 3, 4, 5, 6].forEach((n) => {
      const h = drawerFrontHeightsMm({ heightMm: 700, drawerCount: n });
      expect(h).toHaveLength(n);
      expect(h.reduce((a, b) => a + b, 0) + (n + 1) * 3).toBe(700);
      h.forEach((x) => expect(x).toBeGreaterThan(0));
    });
  });

  it('visina ladičara je podesiva', () => {
    const h = drawerFrontHeightsMm({ heightMm: 900, drawerCount: 3 });
    expect(h.reduce((a, b) => a + b, 0) + 12).toBe(900);
  });

  it('degenerisane vrijednosti ne ruše', () => {
    expect(drawerFrontHeightsMm({ heightMm: 10, drawerCount: 3 })).toHaveLength(3);
    expect(drawerFrontHeightsMm({ heightMm: 0, drawerCount: 3 }).every((x) => x === 0)).toBe(true);
    expect(drawerFrontHeightsMm({ heightMm: 700, drawerCount: 0 })).toHaveLength(1);
  });

  it('pozicije fronti ladica idu odozdo nagore sa zazorom', () => {
    const p = drawerFrontPositionsMm({ yMm: 0, heightMm: 700, drawerCount: 3 });
    expect(p).toHaveLength(3);
    expect(p[0].y).toBe(3);
    expect(p[1].y).toBeGreaterThan(p[0].y);
    expect(p[2].y + p[2].heightMm).toBeLessThanOrEqual(700);
  });

  it('police se raspoređuju ravnomjerno po zoni', () => {
    const p = shelfPositionsMm({ yMm: 0, zoneMm: 900, shelfCount: 3 });
    expect(p).toHaveLength(3);
    expect(p[0]).toBeCloseTo(225, 5);
    expect(p[1]).toBeCloseTo(450, 5);
    expect(p[2]).toBeCloseTo(675, 5);
  });

  it('visine koje elementi zauzimaju', () => {
    expect(itemOccupiedHeightMm({ type: 'ladicar', heightMm: 700 })).toBe(700);
    expect(itemOccupiedHeightMm({ type: 'sipka' })).toBe(60);
    expect(itemOccupiedHeightMm({ type: 'polica', zoneMm: 900 })).toBe(900);
    expect(itemOccupiedHeightMm({ type: 'polica' })).toBe(900);   // default
  });

  it('kolizija i traženje slobodne pozicije', () => {
    const a = { id: 'a', type: 'ladicar', yMm: 0, heightMm: 700 };
    const b = { id: 'b', type: 'sipka', yMm: 700 };
    expect(collidesInSegment({ ...b, yMm: 690 }, [a], 'b')).toBe(true);
    expect(collidesInSegment({ ...b, yMm: 700 }, [a], 'b')).toBe(false);
    expect(findFreeY([a], 60, 1914, null)).toBe(700);
    expect(findFreeY([{ id: 'x', type: 'ladicar', yMm: 0, heightMm: 1900 }], 60, 1914, null)).toBeNull();
  });
});
