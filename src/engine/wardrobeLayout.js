// src/engine/wardrobeLayout.js
//
// Geometrija ugradbenog ormara.
//
// Sve formule su na jednom mjestu i sve primaju cijeli objekat `wardrobe`, pa se
// nijedna veličina ne računa "usput" u UI-u. Svaka funkcija je čista (bez stanja,
// bez DOM-a) i pokrivena testovima u `wardrobeLayout.test.js`.
//
// Konstrukcija, od poda prema stropu:
//
//   H_prostor
//   ├─ H_gornja_maska            (default 100, editabilno)
//   ├─ H_gornji korpus           (IZVEDENO — popunjava do gornje maske)
//   ├─ H_donji korpus            (default 1950, editabilno, bez granica)
//   └─ H_nogice = H_donja_maska  (50 ili 100)
//
//   Kontrolni zbir: H_nogice + H_donji + H_gornji + H_gornja_maska = H_prostor
//
// Bočne maske stoje VAN vanjskih bokova korpusa i idu PUNOM visinom prostora:
//
//   W_ormar = 18 (L maska) + W_korpusa + 18 (D maska)
//   W_korpusa = n × W_segmenta
//   H_bocna_maska = H_prostor
//   D_bocna_maska = 3 (lesomal) + D_korpus + 18 (vrata)

import {
  PANEL_T, BACK_T, DOOR_T, SIDE_MASK_T,
  DEFAULT_LOWER_CORPUS_H, DEFAULT_LEG_HEIGHT_MM, TOP_MASK_H, MIN_UPPER_CORPUS_MM,
  DOOR_REVEAL_PER_SIDE_MM, DOOR_GAP_BETWEEN_MM,
  HINGES_4_ABOVE_MM, HINGES_PER_LEAF_LOW, HINGES_PER_LEAF_HIGH,
  SLIDING_OVERLAP_MM, DEFAULT_MAX_SLIDING_LEAF_MM, SLIDING_LEAF_LIMITS,
  ITEM_TYPES, SEGMENT_LIMITS,
} from '../data/wardrobe';

const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/* ==========================================================================
   1. VISINSKA LOGIKA
   ========================================================================== */

/** Visina donje maske = visina nogica (uvijek jednake). */
export function bottomMaskHeightMm(w) {
  return num(w.legHeightMm, DEFAULT_LEG_HEIGHT_MM);
}

/** Visina gornje maske — default 100 mm, ali je editabilna. */
export function topMaskHeightMm(w) {
  const v = num(w.topMaskHeightMm, TOP_MASK_H);
  return v > 0 ? v : TOP_MASK_H;
}

/** Ukupna visina koju zauzimaju korpusi (bez nogica i bez gornje maske). */
export function totalCorpusHeightMm(w) {
  return num(w.roomHeightMm, num(w.heightMm, 2600))
    - bottomMaskHeightMm(w) - topMaskHeightMm(w);
}

/* NAPOMENA: `topMaskHeightMm` je IZNAD ove funkcije i čita editabilnu
   `w.topMaskHeightMm`. Prva verzija ove funkcije je oduzimala konstantu
   `TOP_MASK_H` (100), pa promjena visine gornje maske NIJE uticala ni na
   gornji korpus ni na visinu vrata — maska bi rasla "preko" korpusa umjesto da
   ga skraćuje. Test `veća gornja maska skraćuje vrata` to sada čuva. */

/** Visina donjeg korpusa — ULAZ (default 1950), bez granica. */
export function lowerCorpusHeightMm(w) {
  const v = num(w.lowerCorpusHeightMm, DEFAULT_LOWER_CORPUS_H);
  return v > 0 ? v : DEFAULT_LOWER_CORPUS_H;
}

/**
 * Visina gornjeg korpusa — IZVEDENO: popunjava sav prostor do gornje maske.
 * Može ispasti negativna ako su dimenzije neusklađene; namjerno se NE steže na 0
 * da bi validacija mogla prikazati stvarni (nevažeći) rezultat.
 */
export function upperCorpusHeightMm(w) {
  return totalCorpusHeightMm(w) - lowerCorpusHeightMm(w);
}

/** Visina traženog korpusa ('lower' | 'upper'). */
export function corpusHeightMm(w, corpus) {
  return corpus === 'lower' ? lowerCorpusHeightMm(w) : upperCorpusHeightMm(w);
}

/** Svijetla (unutrašnja) visina korpusa — bez gornje i donje korpusne ploče. */
export function corpusInteriorHeightMm(w, corpus) {
  return Math.max(0, corpusHeightMm(w, corpus) - PANEL_T * 2);
}

/** Apsolutni Y početak korpusa od poda. */
export function corpusBaseYMm(w, corpus) {
  return corpus === 'lower'
    ? bottomMaskHeightMm(w)
    : bottomMaskHeightMm(w) + lowerCorpusHeightMm(w);
}

/** Apsolutni Y početak UNUTRAŠNJOSTI korpusa (iznad donje korpusne ploče). */
export function corpusInteriorBaseYMm(w, corpus) {
  return corpusBaseYMm(w, corpus) + PANEL_T;
}

/** Y raspon gornje maske: [H_prostor − H_gornja_maska, H_prostor]. */
export function topMaskSpanMm(w) {
  const h = num(w.roomHeightMm, num(w.heightMm, 2600));
  return { y0: h - topMaskHeightMm(w), y1: h };
}

/** Y raspon donje maske (nogica): [0, H_nogice]. */
export function bottomMaskSpanMm(w) {
  return { y0: 0, y1: bottomMaskHeightMm(w) };
}

/** Da li je gornji korpus konstrukcijski smislen. */
export function isUpperCorpusValid(w, minMm = MIN_UPPER_CORPUS_MM) {
  return upperCorpusHeightMm(w) >= minMm;
}

/**
 * @deprecated isto što i `isUpperCorpusValid` — zadržano jer ga UI još zove pod
 * starim imenom; potpis `(wardrobe, minMm)` je nepromijenjen.
 */
export const isWardrobeHeightValid = isUpperCorpusValid;

/**
 * Kontrolni zbir visina. Mora biti jednak `H_prostor` — ako nije, negdje je
 * zaokruživanje ili neusklađen ulaz, i to treba prijaviti umjesto nacrtati
 * ormar koji ne staje u prostor.
 */
export function heightChecksum(w) {
  const prostor = num(w.roomHeightMm, num(w.heightMm, 2600));
  const zbir = bottomMaskHeightMm(w) + lowerCorpusHeightMm(w)
    + upperCorpusHeightMm(w) + topMaskHeightMm(w);
  return { roomHeightMm: prostor, sumMm: zbir, deltaMm: zbir - prostor, ok: Math.abs(zbir - prostor) < 0.5 };
}

/* ==========================================================================
   2. ŠIRINSKA LOGIKA
   ========================================================================== */

/** Broj segmenata — ulaz, uz stezanje u dozvoljene granice. */
export function segmentCount(w) {
  const n = Math.round(num(w.segmentCount, 3));
  return Math.max(SEGMENT_LIMITS.min, Math.min(SEGMENT_LIMITS.max, n || SEGMENT_LIMITS.min));
}

/** Širina korpusa (bez bočnih maski, koje stoje van). */
export function carcassWidthMm(w) {
  return num(w.widthMm, 2400) - 2 * SIDE_MASK_T;
}

/**
 * Širina jednog segmenta.
 *
 * Bočne maske su VAN korpusa, a segmenti dijele cijelu širinu korpusa — između
 * segmenata nema dodatne pregrade debljine 18 mm koja bi se oduzimala od
 * širine (pregrade su bokovi susjednih segmenata i već su uračunate u
 * `svijetla širina` niže).
 */
export function segmentWidthMm(w) {
  const n = segmentCount(w);
  return Math.max(0, carcassWidthMm(w) / n);
}

/**
 * Svijetla (unutrašnja) širina segmenta — između njegova dva boka.
 * Ovo je mjera od koje se polazi za unutrašnje opremanje.
 */
export function segmentInteriorWidthMm(w) {
  return Math.max(0, segmentWidthMm(w) - 2 * PANEL_T);
}

/* ==========================================================================
   3. BOČNE MASKE
   ========================================================================== */

/**
 * Izračunata dubina (= širina panela) bočne maske:
 *   3 mm lesomal + dubina korpusa + 18 mm vrata
 */
export function computedSideMaskDepthMm(w) {
  return BACK_T + num(w.depthMm, 580) + DOOR_T;
}

/**
 * Stvarna dubina bočne maske za stranu 'left' | 'right'.
 * Ručno prepisana vrijednost ima prednost — kad je maska uz sam zid, ne ide
 * puna dubina.
 */
export function sideMaskDepthMm(w, side) {
  const manual = side === 'left' ? w.sideMaskDepthLeftMm : w.sideMaskDepthRightMm;
  const v = num(manual, NaN);
  if (Number.isFinite(v) && v > 0) return v;
  return computedSideMaskDepthMm(w);
}

/** Visina bočne maske = visina prostora (prekriva i donju i gornju masku). */
export function sideMaskHeightMm(w) {
  return num(w.roomHeightMm, num(w.heightMm, 2600));
}

/** Da li je dubina maske ručno prepisana (za prikaz "auto" dugmeta u UI-u). */
export function sideMaskIsManual(w, side) {
  const manual = side === 'left' ? w.sideMaskDepthLeftMm : w.sideMaskDepthRightMm;
  return Number.isFinite(num(manual, NaN)) && num(manual, 0) > 0;
}

/* ==========================================================================
   4. VRATA
   ========================================================================== */

/**
 * Visina vrata.
 *
 * Prekrivaju ISKLJUČIVO vertikalu korpusa (donji + gornji), bez preklapanja
 * gornje i donje maske, umanjeno za fuge 2 mm gore i 2 mm dolje:
 *   H_vrata = H_prostor − H_nogice − H_gornja_maska − 4
 *
 * Može se ručno prepisati (`doorHeightMm`) jer visoke fronte znaju zahtijevati
 * korekciju zbog neravnog poda ili stropa.
 */
export function doorHeightMm(w) {
  const manual = num(w.doorHeightMm, NaN);
  if (Number.isFinite(manual) && manual > 0) return manual;
  return Math.max(0, totalCorpusHeightMm(w) - 2 * DOOR_REVEAL_PER_SIDE_MM);
}

/**
 * Broj krila po segmentu za klasična (baglam) vrata.
 *
 * Vrata se rade iz JEDNOG komada po visini, a po širini jedno krilo po segmentu
 * dok je širina izvodljiva. `MAX_HINGED_LEAF_MM` štiti od nemogućih fronti:
 * krilo od 1200×2300 mm je ~45 kg i ne postoji šarka koja ga drži.
 */
export const MAX_HINGED_LEAF_MM = 900;

export function hingedLeavesPerSegment(w) {
  const clear = Math.max(0, segmentWidthMm(w) - 2 * DOOR_REVEAL_PER_SIDE_MM);
  if (clear <= MAX_HINGED_LEAF_MM) return 1;
  return Math.ceil(clear / MAX_HINGED_LEAF_MM);
}

/** Širina jednog krila klasičnih vrata (sa fugama i zazorom između krila). */
export function hingedLeafWidthMm(w) {
  const leaves = hingedLeavesPerSegment(w);
  const usable = segmentWidthMm(w) - 2 * DOOR_REVEAL_PER_SIDE_MM - (leaves - 1) * DOOR_GAP_BETWEEN_MM;
  return Math.max(0, Math.round(usable / leaves));
}

/** Šarke po krilu — isto pravilo kao u kuhinji (`computeHardware`). */
export function hingesPerLeaf(w) {
  return doorHeightMm(w) > HINGES_4_ABOVE_MM ? HINGES_PER_LEAF_HIGH : HINGES_PER_LEAF_LOW;
}

/* --- Klizna vrata -------------------------------------------------------- */

export function maxSlidingLeafOf(w) {
  const raw = num(w.maxSlidingLeafWidthMm, NaN);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MAX_SLIDING_LEAF_MM;
  return Math.min(SLIDING_LEAF_LIMITS.max, Math.max(SLIDING_LEAF_LIMITS.min, Math.round(raw)));
}

/** Broj kliznih krila preko CIJELOG korpusa (ne po segmentu). */
export function slidingLeafCount(w) {
  const n = Math.ceil(carcassWidthMm(w) / maxSlidingLeafOf(w));
  return Number.isFinite(n) && n >= 2 ? n : 2;
}

/** Krojna širina kliznog krila, uključujući preklapanje potrebno za sistem. */
export function slidingLeafWidthMm(w) {
  return Math.round(carcassWidthMm(w) / slidingLeafCount(w)) + SLIDING_OVERLAP_MM;
}

/** Ukupan broj krila (za okov i cijenu). */
export function doorLeafCount(w) {
  return w.doorType === 'klizna'
    ? slidingLeafCount(w)
    : hingedLeavesPerSegment(w) * segmentCount(w);
}

/* ==========================================================================
   5. UNUTRAŠNJE OPREMANJE
   ========================================================================== */

/**
 * Ukupna (vanjska) širina ladičara.
 *
 * Pravilo: SVIJETLA širina segmenta − 100 mm.
 * Za segment od 400 mm: (400 − 36) − 100 = 264 mm.
 */
export function drawerUnitWidthMm(w) {
  return Math.max(0, segmentInteriorWidthMm(w) - ITEM_TYPES.ladicar.widthReductionMm);
}

/**
 * Vanjska širina sanduka ladice.
 *
 * „Ukupna dimenzija ladičara" (`drawerUnitWidthMm`) JE vanjska mjera sanduka —
 * vodilice idu sa njegove vanjske strane, u preostali prostor do boka korpusa.
 *
 * Paziti: ranije se ovdje oduzimao i `sideClearanceMm`, pa se on oduzimao
 * DVA PUT (jednom kroz pravilo −100 mm, drugi put ovdje). Rezultat je bio da
 * čelo sanduka (590 mm) izlazi ŠIRE od samog ladičara (652 mm − 2×13 − 2×18) i
 * od svjetle širine segmenta, što je fizički nemoguće.
 */
export function drawerBoxOuterWidthMm(w) {
  return drawerUnitWidthMm(w);
}

/** Unutarnja širina sanduka (između dva boka). */
export function drawerBoxInnerWidthMm(w, runner) {
  const t = num(runner && runner.boxThicknessMm, PANEL_T);
  return Math.max(0, drawerBoxOuterWidthMm(w) - 2 * t);
}

/**
 * Slobodan prostor između sanduka i boka korpusa, po strani — mora biti dovoljan
 * za vodilice. Provjerava se protiv `sideClearanceMm` iz cjenovnika.
 */
export function drawerSideGapMm(w) {
  return Math.max(0, (segmentInteriorWidthMm(w) - drawerBoxOuterWidthMm(w)) / 2);
}

/** Visina koju element zauzima u svom korpusu (za koliziju i crtanje). */
export function itemOccupiedHeightMm(item) {
  switch (item && item.type) {
    case 'ladicar': {
      const h = num(item.heightMm, ITEM_TYPES.ladicar.defaultHeightMm);
      return h > 0 ? h : ITEM_TYPES.ladicar.defaultHeightMm;
    }
    case 'sipka':
      return ITEM_TYPES.sipka.bandHeightMm;
    case 'polica':
      return num(item.zoneMm, ITEM_TYPES.polica.defaultZoneMm);
    default:
      return 100;
  }
}

export function itemSpan(item) {
  const h = itemOccupiedHeightMm(item);
  return { y0: num(item.yMm, 0), y1: num(item.yMm, 0) + h };
}

/** Da li se element preklapa sa nekim drugim u istom korpusu. */
export function collidesInSegment(item, items, excludeId) {
  const a = itemSpan(item);
  return (items || []).some((o) => {
    if (!o || o.id === excludeId) return false;
    const b = itemSpan(o);
    return a.y0 < b.y1 && a.y1 > b.y0;
  });
}

/** Da li element izlazi iz svijetle visine svog korpusa. */
export function itemOverflows(item, interiorHeightMm) {
  const { y0, y1 } = itemSpan(item);
  return y0 < 0 || y1 > interiorHeightMm;
}

/**
 * Visine fronti ladica — AUTO podjela po visini ladičara.
 *
 * Ista logika kao `resolveFrontStack` u kuhinji: sve fronte jednake, a ostatak
 * od zaokruživanja (`drift`) ide na PRVU auto-ladicu, tako da zbir uvijek tačno
 * odgovara visini ladičara (nema "fuge" koja ne zatvara front).
 */
export function drawerFrontHeightsMm(item) {
  const n = Math.max(1, Math.round(num(item.drawerCount, ITEM_TYPES.ladicar.drawerCount.default)));
  const H = Math.max(0, num(item.heightMm, ITEM_TYPES.ladicar.defaultHeightMm));
  const gap = ITEM_TYPES.ladicar.gapMm;
  const usable = H - (n + 1) * gap;
  if (usable <= 0) return Array.from({ length: n }, () => 0);
  const base = Math.floor(usable / n);
  const heights = Array.from({ length: n }, () => base);
  const drift = usable - base * n;
  if (drift > 0) heights[0] += drift;              // sav ostatak na prvu frontu
  return heights;
}

/**
 * Y pozicije pojedinačnih fronti ladica (za crtanje i krojnu listu).
 * Vraća niz `{ y, heightMm }` — visina fronte je stvarna (auto podjela), pa
 * 3D prikaz i krojna lista crtaju iste brojeve.
 */
export function drawerFrontPositionsMm(item) {
  const gap = ITEM_TYPES.ladicar.gapMm;
  const out = [];
  let y = num(item.yMm, 0) + gap;
  drawerFrontHeightsMm(item).forEach((h) => {
    out.push({ y, heightMm: h });
    y += h + gap;
  });
  return out;
}

/** Y pozicije polica — ravnomjerno po zoni. */
export function shelfPositionsMm(item) {
  const n = Math.max(1, Math.round(num(item.shelfCount, ITEM_TYPES.polica.shelfCount.default)));
  const zone = Math.max(0, num(item.zoneMm, ITEM_TYPES.polica.defaultZoneMm));
  const step = zone / (n + 1);
  const y0 = num(item.yMm, 0);
  const out = [];
  for (let i = 1; i <= n; i++) out.push(y0 + step * i);
  return out;
}

/** Pronađi prvu slobodnu poziciju odozdo za element date visine. */
export function findFreeY(items, heightMm, interiorHeightMm, excludeId) {
  for (let y = 0; y <= interiorHeightMm - heightMm; y += 5) {
    const span = { y0: y, y1: y + heightMm };
    const hit = (items || []).some((o) => {
      if (!o || o.id === excludeId) return false;
      const b = itemSpan(o);
      return span.y0 < b.y1 && span.y1 > b.y0;
    });
    if (!hit) return y;
  }
  return null;
}

/** Da li lista elemenata (jedan korpus) sadrži međusobno preklapanje. */
export function segmentHasCollisions(items) {
  const arr = items || [];
  return arr.some((it, i) => arr.some((other, j) => {
    if (i === j) return false;
    const a = itemSpan(it), b = itemSpan(other);
    return a.y0 < b.y1 && a.y1 > b.y0;
  }));
}

/** Novi unutrašnji element sa default vrijednostima. */
export function createDefaultItem(type, w) {
  const id = `wi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  if (type === 'ladicar') {
    return {
      id, type, yMm: 0,
      heightMm: ITEM_TYPES.ladicar.defaultHeightMm,
      drawerCount: ITEM_TYPES.ladicar.drawerCount.default,
      widthMm: drawerUnitWidthMm(w || {}),
      runnerSystemId: ITEM_TYPES.ladicar.runnerSystemId,
    };
  }
  if (type === 'sipka') {
    return { id, type, yMm: 0, clearance: 'duga' };
  }
  if (type === 'polica') {
    return {
      id, type, yMm: 0,
      shelfCount: ITEM_TYPES.polica.shelfCount.default,
      zoneMm: ITEM_TYPES.polica.defaultZoneMm,
      adjustable: true,
    };
  }
  return { id, type, yMm: 0 };
}
