// src/data/wardrobe.js
//
// Konstante ugradbenog ormara.
//
// Konstrukcija (od poda prema stropu):
//   nogice = donja maska  →  donji korpus  →  gornji korpus  →  gornja maska
// a bočne maske stoje VAN korpusa i idu punom visinom prostora.
//
// Ovaj princip korpusa primjenjuje se i na ostale prostorije (kupatilo, hodnik),
// pa su sve veličine ovdje, a ne u engine-u — da se mogu mijenjati na jednom
// mjestu i da ih UI može prikazati i urediti.

import { HINGE_HEIGHT_THRESHOLD_MM } from '../config/constants';

/* ---------------------------------------------------------------------------
   Debljine materijala
--------------------------------------------------------------------------- */
export const PANEL_T = 18;   // korpusne ploče: bok, pregrada, vrh, dno
export const BACK_T = 3;     // leđa — lesomal
export const DOOR_T = 18;    // vrata / fronte

/* ---------------------------------------------------------------------------
   Nogice i donja maska

   Visina donje maske je UVIJEK jednaka odabranoj visini nogica.
--------------------------------------------------------------------------- */
export const LEG_HEIGHTS = [50, 100];
export const DEFAULT_LEG_HEIGHT_MM = 100;

/** Donja maska je zaseban panel (ne samo prostor između nogica). */
export const BOTTOM_MASK_T = 18;

/* ---------------------------------------------------------------------------
   Gornja maska — po defaultu 100 mm, ali je visina editabilna.
--------------------------------------------------------------------------- */
export const TOP_MASK_H = 100;
export const TOP_MASK_T = 18;

/* ---------------------------------------------------------------------------
   Donji korpus

   Standardna visina je 1950 mm i MOŽE se ručno mijenjati. Gornji korpus je
   izveden: popunjava sav prostor do gornje maske.

   `LOWER_CORPUS_H` je zato samo DEFAULT, ne konstanta konstrukcije (za razliku
   od ranijeg modela gdje je bio fiksno 2000 mm i nije se mogao mijenjati).
--------------------------------------------------------------------------- */
export const DEFAULT_LOWER_CORPUS_H = 1950;

/* Ispod ove visine gornji korpus je konstrukcijski nepraktičan → UPOZORENJE
   (ne greška): korisnik ponekad namjerno želi plitak gornji odjeljak. */
export const MIN_UPPER_CORPUS_MM = 150;

/* ---------------------------------------------------------------------------
   Bočne maske (lijeva i desna)

   Obavezne su, stoje VAN vanjskih bokova korpusa, i idu PUNOM visinom prostora
   (prekrivaju i donju i gornju masku). Debljina 18 mm.

   Širina (= dubina) maske se računa, ali se može ručno prepisati ZASEBNO za
   lijevu i desnu stranu — kad je maska uz sam zid, ne ide puna dubina.
--------------------------------------------------------------------------- */
export const SIDE_MASK_T = 18;

/* ---------------------------------------------------------------------------
   Vrata

   Rade se iz jednog komada po visini i prekrivaju ISKLJUČIVO vertikalu korpusa
   (donji + gornji), bez preklapanja gornje i donje maske.

   Fuge i zazori su identični kuhinjskim (`TECH_PROFILES.*.reveals`):
     2 mm po obodu krila, 4 mm između dva krila.
--------------------------------------------------------------------------- */
export const DOOR_REVEAL_PER_SIDE_MM = 2;
export const DOOR_GAP_BETWEEN_MM = 4;

/** Iznad ove visine krila idu 4 šarke, ispod 2 — isto pravilo kao u kuhinji. */
export const HINGES_4_ABOVE_MM = HINGE_HEIGHT_THRESHOLD_MM;
export const HINGES_PER_LEAF_LOW = 2;
export const HINGES_PER_LEAF_HIGH = 4;

/**
 * Klizna vrata: jedno krilo šire od ovoga je preteško za standardne vodilice i
 * ne prolazi kroz vrata/stepenice, pa se iznad toga dijele.
 */
export const SLIDING_OVERLAP_MM = 40;
export const DEFAULT_MAX_SLIDING_LEAF_MM = 1000;
export const SLIDING_LEAF_LIMITS = { min: 600, max: 1500, step: 10 };

export const DOOR_TYPES = [
  { id: 'baglame', label: 'Klasična vrata na šarke (baglame)' },
  { id: 'klizna', label: 'Klizna vrata' },
];

/* ---------------------------------------------------------------------------
   Segmentacija

   Broj segmenata je ULAZ (aplikacija pita korisnika), a ne izbor iz fiksnog
   skupa — zavisi od dimenzije prostora. `SEGMENT_COUNTS` su samo prijedlozi
   za brzi odabir; `SEGMENT_LIMITS` dozvoljavaju i druge vrijednosti.
--------------------------------------------------------------------------- */
export const SEGMENT_COUNTS = [2, 3, 4];
export const SEGMENT_LIMITS = { min: 1, max: 8 };

/* ---------------------------------------------------------------------------
   Unutrašnje opremanje — po segmentu, ODVOJENO za donji i gornji korpus.
--------------------------------------------------------------------------- */
export const ITEM_TYPES = {
  ladicar: {
    id: 'ladicar',
    label: 'Ladičar',
    /* Ukupna dimenzija ladičara = SVIJETLA širina segmenta − 100 mm.
       Svijetla širina je širina između dva boka (W_segmenta − 2 × PANEL_T). */
    widthReductionMm: 100,
    defaultHeightMm: 700,
    drawerCount: { min: 1, max: 6, default: 3 },
    /* Visina pojedine fronte se dijeli automatski po visini ladičara, istom
       logikom kao u kuhinji (`resolveFrontStack`): jednake fronte, a ostatak od
       zaokruživanja ide na prvu. */
    gapMm: 3,
    pricePerDrawer: 45,      // KM — procjena; stvarna cijena dolazi iz vodilica
    runnerSystemId: 'GTV_BALL_500',
  },
  sipka: {
    id: 'sipka',
    label: 'Garderobna šipka',
    bandHeightMm: 60,        // visina koju šipka zauzima za koliziju i crtanje
    pricePerMeter: 12,
    priceFixed: 8,           // nosači
    clearance: {
      kratka: { label: 'kraća odjeća (sakoi, košulje)', mm: 900 },
      duga: { label: 'duža odjeća (haljine, kaputi)', mm: 1500 },
    },
  },
  polica: {
    id: 'polica',
    label: 'Polica',
    shelfCount: { min: 1, max: 6, default: 3 },
    shelfThicknessMm: PANEL_T,
    defaultZoneMm: 900,      // ukupna visina zone u kojoj se police raspoređuju
    priceFactor: 0.6,        // umnožak cijene ploče po m²
    adjustable: true,        // podesive na rupičastim nosačima
  },
};

/** Sanduk ladice u ormaru: bokovi/čelo-leđa i pod. */
export const DRAWER_BOX_HEIGHT_MM = 140;

/* ---------------------------------------------------------------------------
   Okov
--------------------------------------------------------------------------- */
export const LEG_PRICE_KM = 3.5;
export const WARDROBE_LEGS_PER_SEGMENT = 5;
export const HINGE_DOOR_HW_PER_LEAF_KM = 6;
export const SLIDING_HW_PER_LEAF_KM = 90;
export const SLIDING_MATERIAL_FACTOR = 1.1;

/**
 * Gola profil je metraža — jedan profil po fronti. Promijenite na 0.0 ako pogon
 * radi jedan profil po elementu bez obzira na broj krila.
 */
export const GOLA_METERS_PER_FRONT = 1.0;

/** Nogica po korpusu kuhinje (koristi se u `engine/pricing.js`). */
export const KITCHEN_LEGS_PER_CORPUS = 4;

/* ---------------------------------------------------------------------------
   Granice ulaznih veličina
--------------------------------------------------------------------------- */
export const WARDROBE_LIMITS = {
  width: { min: 600, max: 6000, step: 10, default: 2400 },
  /* Visina ormara je izvedena iz visine prostora — ne unosi se zasebno.
     `height` ovdje je samo donja/ gornja granica za H_prostor. */
  height: { min: 1800, max: 3600, step: 10, default: 2600 },
  depth: { min: 300, max: 800, step: 10, default: 580 },
};

export function defaultCorpusDecorId() {
  return 'H1180';
}
export function defaultDoorDecorId() {
  return 'W1000';
}

/* ---------------------------------------------------------------------------
   Zastarjele konstante — zadržane kao aliasi da stariji sačuvani projekti i
   eventualni vanjski pozivi ne padnu. Nove vrijednosti su gore.
--------------------------------------------------------------------------- */
/** @deprecated koristi `DEFAULT_LOWER_CORPUS_H` (1950, editabilno) */
export const LOWER_CORPUS_H = DEFAULT_LOWER_CORPUS_H;
