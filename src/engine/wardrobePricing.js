// src/engine/wardrobePricing.js
//
// Kalkulacija cijene i krojna lista ugradbenog ormara.
//
// Model konstrukcije (detaljno u `wardrobeLayout.js`):
//   W_ormar = 18 (bočna maska L) + n × W_segmenta + 18 (bočna maska D)
//   Segmenti stoje jedan do drugog — svaki ima SVOJA dva boka, pa nema zasebnih
//   pregrada između njih (inače bi ukupna širina bila za 18×(n−1) veća i vrata
//   se ne bi poklopila sa svijetlim otvorom).
//   Visinski: nogice/donja maska → donji korpus → gornji korpus → gornja maska,
//   a bočne maske idu punom visinom prostora VAN korpusa.

import { boardPriceOf, HDF_PRICE_M2 } from '../data/decors';
import { VAT_RATE } from '../data/tech';
import { RUNNER_SYSTEMS } from '../data/hardware';
import {
  PANEL_T, BACK_T, DOOR_T, SIDE_MASK_T,
  MIN_UPPER_CORPUS_MM, LEG_PRICE_KM, WARDROBE_LEGS_PER_SEGMENT,
  HINGE_DOOR_HW_PER_LEAF_KM, SLIDING_HW_PER_LEAF_KM, SLIDING_MATERIAL_FACTOR,
  ITEM_TYPES, DRAWER_BOX_HEIGHT_MM,
} from '../data/wardrobe';
import {
  segmentCount, segmentWidthMm, segmentInteriorWidthMm, carcassWidthMm,
  lowerCorpusHeightMm, upperCorpusHeightMm, topMaskHeightMm, bottomMaskHeightMm,
  sideMaskHeightMm, sideMaskDepthMm, computedSideMaskDepthMm,
  doorHeightMm, hingedLeafWidthMm, hingedLeavesPerSegment, hingesPerLeaf,
  slidingLeafCount, slidingLeafWidthMm, doorLeafCount, drawerUnitWidthMm,
  drawerBoxOuterWidthMm, drawerBoxInnerWidthMm, drawerFrontHeightsMm,
  shelfPositionsMm, heightChecksum,
} from './wardrobeLayout';
import { r1 } from '../utils/formatters';

/* Re-izvoz: `slidingLeafCount` i `slidingLeafWidthMm` žive u `wardrobeLayout.js`
   (geometrija), ali ih UI historijski importuje odavde (uz `legCountOf`). */
export { slidingLeafCount, slidingLeafWidthMm, maxSlidingLeafOf } from './wardrobeLayout';

/** Broj nogica: 5 po segmentu (konstanta pogona). */
export function legCountOf(w) {
  return Math.max(0, segmentCount(w)) * WARDROBE_LEGS_PER_SEGMENT;
}

/* ==========================================================================
   KROJNA LISTA
   ========================================================================== */

/**
 * Krojna lista ormara.
 *
 * Vraća `{ rows, hardware, notes }`:
 *   rows     → PLOČNI materijal sa stvarnim krojnim mjerama
 *   hardware → OKOV (bez dimenzija krojenja — okov nije ploča)
 *   notes    → napomene i upozorenja (nevažeće dimenzije, prekoračenja)
 */
export function computeWardrobeBOM(w) {
  const n = segmentCount(w);
  const segW = segmentWidthMm(w);
  const segIn = segmentInteriorWidthMm(w);
  const D = Number(w.depthMm) > 0 ? Number(w.depthMm) : 580;
  const hLower = lowerCorpusHeightMm(w);
  const hUpper = upperCorpusHeightMm(w);
  const hTopMask = topMaskHeightMm(w);
  const hBottomMask = bottomMaskHeightMm(w);
  const rows = [];
  const hardware = [];
  const notes = [];
  let pos = 0;

  const push = (role, qty, cutL, cutW, material) => {
    const q = Math.max(0, Math.round(qty));
    if (!(q > 0) || !(cutL > 0) || !(cutW > 0)) return;
    pos += 1;
    rows.push({
      pos, role, qty: q,
      cutL: Math.round(cutL), cutW: Math.round(cutW),
      areaM2: (q * cutL * cutW) / 1e6,
      material,
    });
  };
  const pushHw = (role, qty, note) => {
    if (!(qty > 0)) return;
    hardware.push({ role, qty: Math.round(qty), note: note || '' });
  };

  const check = heightChecksum(w);
  if (!check.ok) {
    notes.push(`Visine se ne slažu: ${check.sumMm} mm sastava naspram ${check.roomHeightMm} mm prostora (razlika ${check.deltaMm} mm).`);
  }
  if (hUpper <= 0) {
    notes.push(`Gornji korpus ispada ${Math.round(hUpper)} mm — povećajte visinu prostora ili smanjite donji korpus/nogice.`);
  } else if (hUpper < MIN_UPPER_CORPUS_MM) {
    notes.push(`Gornji korpus je samo ${Math.round(hUpper)} mm (ispod preporučenih ${MIN_UPPER_CORPUS_MM} mm) — provjerite da li je izvodiv.`);
  }

  /* --- DONJI KORPUS: svaki segment ima svoj bok, vrh i dno --------------- */
  push(`Bok donjeg korpusa (${n} seg. × 2)`, n * 2, hLower, D, 'korpus');
  push(`Gornja ploča donjeg korpusa`, n, segW, D, 'korpus');
  push(`Donja ploča donjeg korpusa`, n, segW, D, 'korpus');
  push(`Leđa donjeg korpusa (lesomal ${BACK_T} mm)`, n, segW, hLower, 'lesomal');

  /* --- GORNJI KORPUS: samo ako ima pozitivnu visinu ---------------------- */
  if (hUpper > 0) {
    push(`Bok gornjeg korpusa (${n} seg. × 2)`, n * 2, hUpper, D, 'korpus');
    push(`Gornja ploča gornjeg korpusa`, n, segW, D, 'korpus');
    push(`Donja ploča gornjeg korpusa`, n, segW, D, 'korpus');
    push(`Leđa gornjeg korpusa (lesomal ${BACK_T} mm)`, n, segW, hUpper, 'lesomal');
  }

  /* --- MASKE ------------------------------------------------------------- */
  // Donja maska = visina nogica, preko širine korpusa (bočne maske su van).
  push(`Donja maska (${hBottomMask} mm)`, 1, carcassWidthMm(w), hBottomMask, 'korpus');
  // Gornja maska — visina editabilna, preko širine korpusa.
  push(`Gornja maska (${hTopMask} mm)`, 1, carcassWidthMm(w), hTopMask, 'korpus');
  /* Bočne maske: 18 mm, PUNA visina prostora, dubina = 3 + D + 18 (ili ručno
     prepisano zasebno za lijevu i desnu — kad je maska uz zid, ne ide puna). */
  ['left', 'right'].forEach((side) => {
    const dMask = sideMaskDepthMm(w, side);
    const naziv = side === 'left' ? 'lijeva' : 'desna';
    const manual = dMask !== computedSideMaskDepthMm(w);
    push(`Bočna maska ${naziv} (${SIDE_MASK_T} mm${manual ? ', ručno' : ''})`,
      1, sideMaskHeightMm(w), dMask, 'korpus');
  });

  /* --- VRATA ------------------------------------------------------------- */
  const hDoor = doorHeightMm(w);
  if (w.doorType === 'klizna') {
    const leaves = slidingLeafCount(w);
    push(`Klizno krilo (${leaves} kom, max ${Number(w.maxSlidingLeafWidthMm) || 1000} mm)`,
      leaves, slidingLeafWidthMm(w), hDoor, 'vrata');
    pushHw('Vodilice i kotači — klizna vrata', leaves,
      `${SLIDING_HW_PER_LEAF_KM} KM/kom · šina ${r1(carcassWidthMm(w) / 1000)} m`);
  } else {
    const perSeg = hingedLeavesPerSegment(w);
    const leafW = hingedLeafWidthMm(w);
    /* `segmentCount` je jedini izvor istine za broj segmenata — NE dužina niza
       `segments`. Kod neusklađenog ulaza (npr. stari snimak sa 3 segmenta u nizu
       a `segmentCount: 2`) inače bi se napravili redovi za nepostojeće segmente. */
    for (let i = 0; i < n; i++) {
      const krila = perSeg === 1 ? '1 krilo' : `${perSeg} krila`;
      push(`Vrata segment ${i + 1} (${krila})`, perSeg, leafW, hDoor, 'vrata');
    }
    /* Broj šarki je fizički komad (4 po krilu za vrata iznad 1200 mm), ali se
       okov obračunava PO KRILU (`HINGE_DOOR_HW_PER_LEAF_KM`) — to je naslijeđeno
       pravilo iz starog modela (`segmentCount * 2 * 6`). Zato su ovdje dvije
       zasebne informacije i obje su eksplicitno označene. */
    pushHw('Šarke (komada)', doorLeafCount(w) * hingesPerLeaf(w),
      `${hingesPerLeaf(w)} po krilu · vrata ${Math.round(hDoor)} mm`);
    pushHw('Okov vrata (obračun)', doorLeafCount(w),
      `${HINGE_DOOR_HW_PER_LEAF_KM} KM po krilu`);
  }

  /* --- UNUTRAŠNJI ELEMENTI, po segmentu i po korpusu --------------------- */
  (w.segments || []).slice(0, n).forEach((seg, i) => {
    [['lower', 'donji'], ['upper', 'gornji']].forEach(([corpus, label]) => {
      ((seg && seg[corpus] && seg[corpus].items) || []).forEach((it) => {
        if (it.type === 'ladicar') {
          const fronts = drawerFrontHeightsMm(it);
          const unitW = drawerUnitWidthMm(w);
          const boxH = Math.max(60, Number(it.boxHeightMm) || DRAWER_BOX_HEIGHT_MM);
          const R = RUNNER_SYSTEMS[it.runnerSystemId || ITEM_TYPES.ladicar.runnerSystemId];
          const boxOuter = drawerBoxOuterWidthMm(w);   // za napomenu o vodilicama
          const boxInner = drawerBoxInnerWidthMm(w, R);
          const boxD = Math.max(100, D - 100);          // sanduk je kraći od korpusa

          // Fronte ladica — visine se dijele automatski po visini ladičara
          fronts.forEach((h, k) => {
            push(`Ladičar S${i + 1} (${label}) — fronta ${k + 1}`, 1, unitW, h, 'front');
          });
          // Sanduk: bokovi, čelo/leđa, pod
          push(`Ladičar S${i + 1} (${label}) — bok sanduka`, fronts.length * 2, boxD, boxH, 'korpus');
          push(`Ladičar S${i + 1} (${label}) — čelo/leđa sanduka`, fronts.length * 2, boxInner, boxH, 'korpus');
          push(`Ladičar S${i + 1} (${label}) — pod sanduka`, fronts.length, boxD, boxInner, 'lesomal');
          pushHw(`Vodilice ladica — S${i + 1} (${label})`, fronts.length,
            `${(R && R.name) || 'nije odabran sistem'} · sanduk ${Math.round(boxOuter)} mm`);
        } else if (it.type === 'polica') {
          const positions = shelfPositionsMm(it);
          push(`Polica S${i + 1} (${label})${it.adjustable === false ? ' — fiksna' : ''}`,
            positions.length, segIn, D, 'korpus');
          if (it.adjustable !== false) {
            pushHw(`Nosači polica — S${i + 1} (${label})`, positions.length * 4, 'rupičasti nosači');
          }
        } else if (it.type === 'sipka') {
          pushHw(`Garderobna šipka — S${i + 1} (${label})`, 1,
            `${Math.round(segIn)} mm + nosači`);
        }
      });
    });
  });

  /* --- OKOV: nogice ------------------------------------------------------ */
  pushHw('Nogice podesive', legCountOf(w),
    `${WARDROBE_LEGS_PER_SEGMENT} po segmentu · visina ${hBottomMask} mm`);

  return { rows, hardware, notes };
}

/* ==========================================================================
   CIJENA
   ========================================================================== */

/**
 * Informativna kalkulacija cijene ormara.
 *
 * PDV dolazi iz `data/tech.js` (`VAT_RATE`) — ista stopa kao za kuhinju, da
 * promjena stope ne zaobiđe jedan od modula.
 */
export function computeWardrobePrice(w) {
  const n = segmentCount(w);
  const segW = segmentWidthMm(w);
  const segIn = segmentInteriorWidthMm(w);
  const D = (Number(w.depthMm) > 0 ? Number(w.depthMm) : 580) / 1000;
  const hLower = lowerCorpusHeightMm(w) / 1000;
  const hUpper = Math.max(0, upperCorpusHeightMm(w)) / 1000;
  const hTopMask = topMaskHeightMm(w) / 1000;
  const hBottomMask = bottomMaskHeightMm(w) / 1000;
  const wCarcass = carcassWidthMm(w) / 1000;
  const wSide = sideMaskHeightMm(w) / 1000;

  const corpusPricePerM2 = boardPriceOf(w.corpusDecorId, PANEL_T) || 25;
  const doorPricePerM2 = boardPriceOf(w.doorDecorId, DOOR_T) || 30;

  /* --- Korpus: bokovi, vrh/dno po segmentu ------------------------------ */
  const bokovi = n * 2 * hLower * D + (hUpper > 0 ? n * 2 * hUpper * D : 0);
  const ploceVrhDno = n * 2 * (segW / 1000) * D + (hUpper > 0 ? n * 2 * (segW / 1000) * D : 0);
  const corpusBoardM2 = bokovi + ploceVrhDno;
  const corpusCost = corpusBoardM2 * corpusPricePerM2;

  /* --- Leđa (lesomal 3 mm), po segmentu i po korpusu --------------------- */
  const backBoardM2 = n * (segW / 1000) * hLower + (hUpper > 0 ? n * (segW / 1000) * hUpper : 0);
  const backCost = backBoardM2 * HDF_PRICE_M2;

  /* --- Maske ------------------------------------------------------------- */
  const bottomMaskM2 = wCarcass * hBottomMask;
  const topMaskM2 = wCarcass * hTopMask;
  const dMaskL = sideMaskDepthMm(w, 'left') / 1000;
  const dMaskR = sideMaskDepthMm(w, 'right') / 1000;
  const sideMaskM2 = wSide * dMaskL + wSide * dMaskR;
  const maskBoardM2 = bottomMaskM2 + topMaskM2 + sideMaskM2;
  const maskCost = maskBoardM2 * corpusPricePerM2;

  /* --- Vrata ------------------------------------------------------------- */
  const hDoor = doorHeightMm(w) / 1000;
  const sliding = w.doorType === 'klizna';
  const leaves = doorLeafCount(w);
  const leafW = (sliding ? slidingLeafWidthMm(w) : hingedLeafWidthMm(w)) / 1000;
  const doorBoardM2 = leaves * leafW * hDoor;
  const doorHwCost = leaves * (sliding ? SLIDING_HW_PER_LEAF_KM : HINGE_DOOR_HW_PER_LEAF_KM);
  const doorCost = doorBoardM2 * doorPricePerM2 * (sliding ? SLIDING_MATERIAL_FACTOR : 1) + doorHwCost;

  /* --- Nogice ------------------------------------------------------------ */
  const legCount = legCountOf(w);
  const legCost = legCount * LEG_PRICE_KM;

  /* --- Unutrašnje opremanje ---------------------------------------------- */
  let drawerCost = 0, railCost = 0, shelfCost = 0;
  let drawerCount = 0, railCount = 0, shelfCount = 0;
  let drawerBoardM2 = 0, shelfBoardM2 = 0;

  (w.segments || []).slice(0, n).forEach((seg) => {
    ['lower', 'upper'].forEach((corpus) => {
      ((seg && seg[corpus] && seg[corpus].items) || []).forEach((it) => {
        if (it.type === 'ladicar') {
          const fronts = drawerFrontHeightsMm(it);
          const unitW = drawerUnitWidthMm(w) / 1000;
          const boxH = (Math.max(60, Number(it.boxHeightMm) || DRAWER_BOX_HEIGHT_MM)) / 1000;
          const R = RUNNER_SYSTEMS[it.runnerSystemId || ITEM_TYPES.ladicar.runnerSystemId];
          const boxOuter = drawerBoxOuterWidthMm(w) / 1000;
          const boxInner = drawerBoxInnerWidthMm(w, R) / 1000;
          const boxD = Math.max(0.1, D - 0.1);
          drawerCount += fronts.length;
          drawerCost += fronts.length * ITEM_TYPES.ladicar.pricePerDrawer;
          // Fronte + sanduk (bokovi, čelo/leđa, pod)
          const frontsM2 = fronts.reduce((s, h) => s + unitW * (h / 1000), 0);
          const boxM2 = fronts.length * (2 * boxD * boxH + 2 * boxInner * boxH + boxD * boxInner);
          drawerBoardM2 += frontsM2 + boxM2;
        } else if (it.type === 'polica') {
          const k = shelfPositionsMm(it).length;
          shelfCount += k;
          shelfBoardM2 += k * (segIn / 1000) * D;
          shelfCost += k * (segIn / 1000) * D * corpusPricePerM2 * ITEM_TYPES.polica.priceFactor;
        } else if (it.type === 'sipka') {
          railCount += 1;
          railCost += (segIn / 1000) * ITEM_TYPES.sipka.pricePerMeter + ITEM_TYPES.sipka.priceFixed;
        }
      });
    });
  });

  /* Ladičar: `pricePerDrawer` (45 KM) pokriva vodilice i montažu, a materijal
     sanduka i fronti se računa zasebno — inače bi ladičar bio potcijenjen za
     ~40 KM po ladici. */
  const drawerCostBoard = drawerBoardM2 * ((corpusPricePerM2 + doorPricePerM2) / 2);

  /* Police: `priceFactor = 0.6` JE faktor cijene ploče (polica je jeftinija od
     fronta/korpusa), pa je `shelfCost` već puni iznos. Dodavanje zasebnog
     `shelfBoardM2 × corpusPricePerM2` bi duplo obračunalo materijal. */
  void shelfBoardM2;

  const net = corpusCost + backCost + maskCost + doorCost + legCost
    + drawerCost + drawerCostBoard + railCost + shelfCost;
  const vat = net * VAT_RATE;
  const gross = net + vat;

  return {
    net, vat, gross,
    breakdown: {
      'korpus — bokovi, vrh i dno po segmentu': r1(corpusCost),
      'leđa (lesomal 3 mm), po segmentu': r1(backCost),
      'maske — donja, gornja i bočne': r1(maskCost),
      'vrata': r1(doorCost),
      'nogice': r1(legCost),
      'ladičari (okov)': r1(drawerCost),
      'ladičari (materijal)': r1(drawerCostBoard),
      'garderobne šipke': r1(railCost),
      'police': r1(shelfCost),
    },
    meta: {
      segmentCount: n,
      segmentWidthMm: Math.round(segW),
      segmentInteriorWidthMm: Math.round(segIn),
      carcassWidthMm: Math.round(carcassWidthMm(w)),
      lowerCorpusHeightMm: Math.round(lowerCorpusHeightMm(w)),
      upperCorpusHeightMm: Math.round(upperCorpusHeightMm(w)),
      topMaskHeightMm: Math.round(topMaskHeightMm(w)),
      bottomMaskHeightMm: Math.round(hBottomMask * 1000),
      doorHeightMm: Math.round(doorHeightMm(w)),
      doorLeafCount: leaves,
      doorLeafWidthMm: Math.round(leafW * 1000),
      hingesPerLeaf: hingesPerLeaf(w),
      sideMaskDepthLeftMm: Math.round(sideMaskDepthMm(w, 'left')),
      sideMaskDepthRightMm: Math.round(sideMaskDepthMm(w, 'right')),
      drawerUnitWidthMm: Math.round(drawerUnitWidthMm(w)),
      drawerCount, railCount, shelfCount, legCount,
      corpusBoardM2: r1(corpusBoardM2 + backBoardM2 + maskBoardM2),
      doorAreaM2: r1(doorBoardM2),
      heightChecksum: heightChecksum(w),
    },
  };
}
