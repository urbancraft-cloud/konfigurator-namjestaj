// src/store/wardrobeStore.js
//
// Stanje konfiguratora ormara. Model je opisan u `engine/wardrobeLayout.js`:
//   nogice/donja maska → donji korpus (1950 default, editabilan)
//   → gornji korpus (izveden, popunjava do gornje maske) → gornja maska (100)
//   a bočne maske stoje VAN korpusa i idu punom visinom prostora.

import { create } from 'zustand';
import { withUndo } from './withUndo';
import {
  WARDROBE_LIMITS, DEFAULT_LEG_HEIGHT_MM, DEFAULT_LOWER_CORPUS_H,
  TOP_MASK_H, DEFAULT_MAX_SLIDING_LEAF_MM, ITEM_TYPES,
  defaultCorpusDecorId, defaultDoorDecorId,
} from '../data/wardrobe';
import { normalizeWardrobe } from '../utils/projectSchema';
import { WARDROBE_KEY, read as stRead, write as stWrite } from '../utils/storage';
import {
  corpusInteriorHeightMm, itemOccupiedHeightMm, collidesInSegment,
  findFreeY, createDefaultItem, segmentInteriorWidthMm, drawerUnitWidthMm,
  upperCorpusHeightMm,
} from '../engine/wardrobeLayout';
import { RUNNER_SYSTEMS } from '../data/hardware';

const DEFAULT_ROOM = () => ({ width: 4000, depth: 3200, height: 2600 });

const emptyCorpus = () => ({ items: [] });
const makeSegments = (n, startIdx = 0) => Array.from({ length: n }, (_, i) => ({
  id: `seg_${startIdx + i + 1}`, lower: emptyCorpus(), upper: emptyCorpus(),
}));

const DEFAULT_WARDROBE = () => ({
  name: 'Ormar — spavaća soba',

  /* Vanjske dimenzije. `widthMm` UKLJUČUJE bočne maske (2 × 18 mm). */
  widthMm: WARDROBE_LIMITS.width.default,
  depthMm: WARDROBE_LIMITS.depth.default,       // editabilna dubina korpusa

  /* Visina PROSTORA, ne ormara — iz nje se sve ostalo izvodi. */
  roomHeightMm: WARDROBE_LIMITS.height.default,

  /* Nogice = donja maska. */
  legHeightMm: DEFAULT_LEG_HEIGHT_MM,

  /* Donji korpus je ULAZ (default 1950, bez granica); gornji je izveden. */
  lowerCorpusHeightMm: DEFAULT_LOWER_CORPUS_H,

  /* Gornja maska je uvijek prisutna, visina joj je editabilna. */
  topMaskHeightMm: TOP_MASK_H,

  /* Dubina bočnih maski se računa (3 + D + 18), ali se može ručno prepisati
     ZASEBNO za lijevu i desnu — kad je maska uz zid, ne ide puna dubina.
     `null` = automatski. */
  sideMaskDepthLeftMm: null,
  sideMaskDepthRightMm: null,

  /* Visina vrata se računa (H_korpusi − 4), ali se može ručno prepisati.
     `null` = automatski. */
  doorHeightMm: null,

  doorType: 'baglame',
  segmentCount: 3,
  maxSlidingLeafWidthMm: DEFAULT_MAX_SLIDING_LEAF_MM,

  corpusDecorId: defaultCorpusDecorId(),
  doorDecorId: defaultDoorDecorId(),
  segments: makeSegments(3),
});

export const useWardrobeStore = create(withUndo((set, get) => ({
  room: DEFAULT_ROOM(),
  wardrobe: DEFAULT_WARDROBE(),
  selectedSegmentIdx: 0,
  selectedCorpus: 'lower',          // 'lower' | 'upper'
  selectedItemId: null,

  setRoom: (room) => set({ room }, false, 'drag'),

  setSelectedSegmentIdx: (i) => set({ selectedSegmentIdx: i, selectedItemId: null }),
  setSelectedCorpus: (c) => set({ selectedCorpus: c, selectedItemId: null }),
  setSelectedItemId: (id) => set({ selectedItemId: id }),

  applyWizard: (d) => {
    const n = d.segmentCount || 3;
    set({
      room: d.room || DEFAULT_ROOM(),
      wardrobe: {
        ...DEFAULT_WARDROBE(),
        widthMm: d.wardrobeW || WARDROBE_LIMITS.width.default,
        depthMm: d.wardrobeD || WARDROBE_LIMITS.depth.default,
        /* Visina prostora dolazi iz čarobnjaka (`wardrobeH` je historijski naziv
           polja, ali semantika je visina prostora — iz nje se sve izvodi). */
        roomHeightMm: d.wardrobeH || (d.room && d.room.height) || WARDROBE_LIMITS.height.default,
        legHeightMm: d.legHeightMm || DEFAULT_LEG_HEIGHT_MM,
        lowerCorpusHeightMm: d.lowerCorpusHeightMm || DEFAULT_LOWER_CORPUS_H,
        topMaskHeightMm: d.topMaskHeightMm || TOP_MASK_H,
        doorType: d.doorType || 'baglame',
        segmentCount: n,
        maxSlidingLeafWidthMm: d.maxSlidingLeafWidthMm || DEFAULT_MAX_SLIDING_LEAF_MM,
        segments: makeSegments(n),
      },
      selectedSegmentIdx: 0,
      selectedCorpus: 'lower',
      selectedItemId: null,
    });
  },

  setWardrobeDims: (patch) => set((s) => ({
    wardrobe: { ...s.wardrobe, ...patch },
  }), false, 'drag'),

  setLegHeight: (mm) => set((s) => ({ wardrobe: { ...s.wardrobe, legHeightMm: mm } })),
  setDoorType: (doorType) => set((s) => ({ wardrobe: { ...s.wardrobe, doorType } })),

  /** Visina donjeg korpusa — ulazna veličina, bez fiksnih granica. */
  setLowerCorpusHeight: (mm) => set((s) => ({
    wardrobe: {
      ...s.wardrobe,
      lowerCorpusHeightMm: Number.isFinite(Number(mm)) && Number(mm) > 0 ? Number(mm) : DEFAULT_LOWER_CORPUS_H,
    },
  }), false, 'drag'),

  /** Visina gornje maske — uvijek prisutna, visina editabilna. */
  setTopMaskHeight: (mm) => set((s) => ({
    wardrobe: {
      ...s.wardrobe,
      topMaskHeightMm: Number.isFinite(Number(mm)) && Number(mm) > 0 ? Number(mm) : TOP_MASK_H,
    },
  }), false, 'drag'),

  /** Ručno prepisivanje dubine bočne maske, zasebno po strani. `null` = auto. */
  setSideMaskDepth: (side, mm) => {
    const key = side === 'right' ? 'sideMaskDepthRightMm' : 'sideMaskDepthLeftMm';
    const v = Number.isFinite(Number(mm)) && Number(mm) > 0 ? Number(mm) : null;
    set((s) => ({ wardrobe: { ...s.wardrobe, [key]: v } }));
  },

  /** Ručno prepisivanje visine vrata. `null` = automatski (H_korpusi − 4). */
  setDoorHeight: (mm) => set((s) => ({
    wardrobe: {
      ...s.wardrobe,
      doorHeightMm: Number.isFinite(Number(mm)) && Number(mm) > 0 ? Number(mm) : null,
    },
  })),

  setSegmentCount: (n) => set((s) => {
    const cur = s.wardrobe.segments;
    let segments;
    if (n === cur.length) segments = cur;
    else if (n < cur.length) segments = cur.slice(0, n);
    else segments = cur.concat(makeSegments(n - cur.length, cur.length));
    return {
      wardrobe: { ...s.wardrobe, segmentCount: n, segments },
      selectedSegmentIdx: Math.min(s.selectedSegmentIdx, n - 1),
    };
  }),

  setMaxSlidingLeafWidthMm: (mm) => set((s) => ({
    wardrobe: {
      ...s.wardrobe,
      maxSlidingLeafWidthMm: Number.isFinite(Number(mm)) ? Number(mm) : DEFAULT_MAX_SLIDING_LEAF_MM,
    },
  }), false, 'drag'),

  setCorpusDecorId: (id) => set((s) => ({ wardrobe: { ...s.wardrobe, corpusDecorId: id } })),
  setDoorDecorId: (id) => set((s) => ({ wardrobe: { ...s.wardrobe, doorDecorId: id } })),

  /**
   * Dodaje unutrašnji element na prvu slobodnu poziciju.
   * @returns {{ok: true, id: string, warnings?: string[]} | {ok: false, reason: string}}
   */
  addItem: (segIdx, corpus, type) => {
    const { wardrobe } = get();
    const seg = wardrobe.segments[segIdx];
    if (!seg) return { ok: false, reason: `Segment ${segIdx + 1} ne postoji.` };

    const interiorH = corpusInteriorHeightMm(wardrobe, corpus);
    if (interiorH <= 0) {
      return { ok: false, reason: 'Korpus nema pozitivnu svjetlu visinu — provjerite visinu prostora, donji korpus i nogice.' };
    }

    const item = createDefaultItem(type, wardrobe);
    const h = itemOccupiedHeightMm(item);
    if (h > interiorH) {
      return {
        ok: false,
        reason: `Element zauzima ${h} mm, a svijetla visina ${corpus === 'lower' ? 'donjeg' : 'gornjeg'} korpusa je ${Math.round(interiorH)} mm.`,
      };
    }
    const y = findFreeY(seg[corpus].items, h, interiorH, null);
    if (y === null) {
      return { ok: false, reason: `Nema slobodne visine (${Math.round(interiorH)} mm) za element od ${h} mm.` };
    }
    item.yMm = y;

    /* Ladičar: provjera da izabrane vodilice stvarno primaju ovu širinu.
       Pravilo „svijetla širina segmenta − 100 mm" za uske segmente daje sanduk
       ispod minimuma iz cjenovnika — to se javlja, ne proguta tiho. */
    const warnings = [];
    if (type === 'ladicar') {
      const R = RUNNER_SYSTEMS[item.runnerSystemId || ITEM_TYPES.ladicar.runnerSystemId];
      const innerW = segmentInteriorWidthMm(wardrobe) - 100;
      if (R && R.constraints && Number.isFinite(R.constraints.minInnerWidthMm)) {
        const boxInner = Math.max(0, innerW - 2 * (R.sideClearanceMm || 0) - 2 * (R.boxThicknessMm || 18));
        if (boxInner < R.constraints.minInnerWidthMm) {
          warnings.push(`Ladičar od ${Math.round(drawerUnitWidthMm(wardrobe))} mm daje unutarnju širinu sanduka ${Math.round(boxInner)} mm, a ${R.name} traži najmanje ${R.constraints.minInnerWidthMm} mm. Segment je preuzak za ove vodilice.`);
        }
      }
      if (upperCorpusHeightMm(wardrobe) <= 0 && corpus === 'upper') {
        warnings.push('Gornji korpus nema pozitivnu visinu.');
      }
    }

    set((s) => ({
      wardrobe: {
        ...s.wardrobe,
        segments: s.wardrobe.segments.map((sg, i) => (i === segIdx
          ? { ...sg, [corpus]: { ...sg[corpus], items: [...sg[corpus].items, item] } }
          : sg)),
      },
      selectedSegmentIdx: segIdx,
      selectedCorpus: corpus,
      selectedItemId: item.id,
    }));
    return { ok: true, id: item.id, warnings };
  },

  /**
   * Pomjeranje unutrašnjeg elementa po visini.
   * @returns {{ok: true, yMm: number} | {ok: false, reason: string}}
   */
  moveItem: (segIdx, corpus, itemId, yMm) => {
    const { wardrobe } = get();
    const seg = wardrobe.segments[segIdx];
    if (!seg) return { ok: false, reason: `Segment ${segIdx + 1} ne postoji.` };
    const interiorH = corpusInteriorHeightMm(wardrobe, corpus);
    const items = seg[corpus].items;
    const item = items.find((it) => it.id === itemId);
    if (!item) return { ok: false, reason: 'Element nije pronađen.' };
    const h = itemOccupiedHeightMm(item);
    const clampedY = Math.max(0, Math.min(interiorH - h, yMm));
    const test = { ...item, yMm: clampedY };
    if (collidesInSegment(test, items, itemId)) {
      const sudar = items.find((o) => o.id !== itemId
        && clampedY < o.yMm + itemOccupiedHeightMm(o) && clampedY + h > o.yMm);
      return {
        ok: false,
        reason: `Na ${Math.round(clampedY)} mm se preklapa sa susjednim elementom (${ITEM_TYPES[sudar && sudar.type] ? ITEM_TYPES[sudar.type].label : 'element'}) — slobodno tek iznad ${sudar ? Math.round(sudar.yMm + itemOccupiedHeightMm(sudar)) : 0} mm.`,
      };
    }
    set((s) => ({
      wardrobe: {
        ...s.wardrobe,
        segments: s.wardrobe.segments.map((sg, i) => (i === segIdx
          ? { ...sg, [corpus]: { ...sg[corpus], items: sg[corpus].items.map((it) => (it.id === itemId ? test : it)) } }
          : sg)),
      },
    }), false, 'drag');
    return { ok: true, yMm: clampedY };
  },

  updateItem: (segIdx, corpus, itemId, patch) => {
    const { wardrobe } = get();
    const seg = wardrobe.segments[segIdx];
    if (!seg) return;
    const interiorH = corpusInteriorHeightMm(wardrobe, corpus);
    const items = seg[corpus].items;
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    const next = { ...item, ...patch };
    const h = itemOccupiedHeightMm(next);
    if (next.yMm + h > interiorH) next.yMm = Math.max(0, interiorH - h);
    if (collidesInSegment(next, items, itemId)) {
      /* Nova veličina se ne uklapa na trenutnu poziciju — probaj naći slobodno
         mjesto, a ako ga nema, izmjena se ipak primjenjuje i preklapanje se
         signalizira kao upozorenje (umjesto tihog odbacivanja). */
      const y = findFreeY(items, h, interiorH, itemId);
      if (y !== null) next.yMm = y;
    }
    set((s) => ({
      wardrobe: {
        ...s.wardrobe,
        segments: s.wardrobe.segments.map((sg, i) => (i === segIdx
          ? { ...sg, [corpus]: { ...sg[corpus], items: sg[corpus].items.map((it) => (it.id === itemId ? next : it)) } }
          : sg)),
      },
    }));
  },

  removeItem: (segIdx, corpus, itemId) => {
    set((s) => ({
      wardrobe: {
        ...s.wardrobe,
        segments: s.wardrobe.segments.map((sg, i) => (i === segIdx
          ? { ...sg, [corpus]: { ...sg[corpus], items: sg[corpus].items.filter((it) => it.id !== itemId) } }
          : sg)),
      },
      selectedItemId: s.selectedItemId === itemId ? null : s.selectedItemId,
    }));
  },

  saveWardrobeProject: () => {
    const { room, wardrobe } = get();
    const r = stWrite(WARDROBE_KEY, JSON.stringify({ room, wardrobe }));
    return r.ok ? { ok: true } : { ok: false, reason: r.reason };
  },

  loadWardrobeProject: () => {
    const r = stRead(WARDROBE_KEY);
    if (!r.ok) return { ok: false, reason: r.missing ? 'Nema sačuvanog projekta ormara.' : r.reason };
    try {
      const d = JSON.parse(r.value);
      const { room, wardrobe, notes } = normalizeWardrobe(d.wardrobe, d.room);
      set({
        room,
        wardrobe: { ...DEFAULT_WARDROBE(), ...wardrobe, segmentCount: wardrobe.segments.length },
        selectedSegmentIdx: 0, selectedCorpus: 'lower', selectedItemId: null,
      }, false, false);
      get().clearHistory();     // učitavanje nije korak koji se poništava
      return { ok: true, notes };
    } catch (e) {
      return { ok: false, reason: `Projekat ormara je oštećen: ${e.message}` };
    }
  },
/* Historija prati prostoriju i ormar; `selectedSegmentIdx`/`selectedCorpus`/
   `selectedItemId` su navigacija i ne smiju se vraćati undo-om. */
}), { keys: ['room', 'wardrobe'] }));
