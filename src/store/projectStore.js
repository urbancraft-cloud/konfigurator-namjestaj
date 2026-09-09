// src/store/projectStore.js
import { create } from 'zustand';
import { withUndo } from './withUndo';
import { templateById, createPlaced, cornerElementsFor, shapeWalls, adoptProjectIds } from '../data/catalog';
import { WALLS } from '../data/tech';
import { DECORS, registerDecor, thicknessesOf } from '../data/decors';
import { DEFAULT_PROJECT } from '../data/projectDefaults';
import { normalizeProject } from '../utils/projectSchema';
import { wallLength, snapCandidates, collidesWithAny } from '../engine/geometry';
import { resolveProject, autoLayoutEngine } from '../engine/layout';
import { getTemplateWithGuard, getDecorWithGuard, validateElement, createErrorResult, createSuccessResult, findElementWithGuard, validateProjectIntegrity } from './shared/storeUtils';

/** Tolerancija snap-a na susjede (mm) — ista vrijednost koju koristi `applySnap`. */
export const SNAP_TOLERANCE_MM = 40;

export { QUICK_SAVE_KEY, namedKey, PROJECTS_PREFIX } from '../utils/storageKeys';
import {
  QUICK_SAVE_KEY, namedKey, PROJECTS_PREFIX, DECORS_KEY, DRAFT_KEY,
  read as stRead, write as stWrite, remove as stRemove, keys as stKeys,
} from '../utils/storage';

export const useProjectStore = create(withUndo((set, get) => ({
  room: { width: 5600, depth: 3600, height: 2600 },
  rawProject: DEFAULT_PROJECT(),
  decorVersion: 0,
  /**
   * Ime projekta koji je trenutno učitan iz imenovanog slota, ili `null` ako se
   * radi o brzom slotu / novom projektu.
   *
   * BUG-20: „Brzo sačuvaj" je uvijek pisalo u `kuhinja:projekt`, a „Sačuvaj kao"
   * u `kuhinja:projects:<ime>`. Korisnik bi učitao „Hadžić", izmijenio ga,
   * kliknuo „Brzo sačuvaj" — i izmjene bi otišle u brzi slot dok je „Hadžić"
   * ostao nepromijenjen. Sada „Brzo sačuvaj" poznaje aktivni projekat.
   */
  activeProjectName: null,

  /* Kliznik za dimenzije prostorije šalje desetke izmjena u sekundi — zato
     'drag', da se cijelo pomjeranje kliznika poništi jednim Ctrl+Z. */
  setRoom: (room) => set({ room }, false, 'drag'),
  setActiveProjectName: (name) => set({ activeProjectName: name || null }),

  /**
   * Automatsko čuvanje nacrta.
   *
   * Projekti su se čuvali ISKLJUČIVO na izričit klik. Zatvaranje kartice,
   * refresh ili pad preglednika značili su gubitak svega od posljednjeg ručnog
   * čuvanja. Ovo piše u zaseban ključ (`kuhinja:nacrt`), pa NE dira ni brzi
   * snimak ni imenovane projekte — korisnik nikad ne može izgubiti ono što je
   * namjerno sačuvao.
   */
  saveDraft: () => {
    const { room, rawProject } = get();
    return stWrite(DRAFT_KEY, JSON.stringify({ room, project: rawProject, at: Date.now() }));
  },

  /**
   * Učitava nacrt ako postoji. Poziva se JEDNOM pri pokretanju, i to samo ako
   * korisnik nije već učitao projekat.
   * @returns {{ok:boolean, project?:object, room?:object, at?:number, reason?:string}}
   */
  loadDraft: () => {
    const r = stRead(DRAFT_KEY);
    if (!r.ok) return { ok: false, reason: r.reason };
    try {
      const d = JSON.parse(r.value);
      const { room, project, notes } = normalizeProject(d.project, d.room);
      adoptProjectIds(project);
      return { ok: true, room, project, at: d.at || null, notes };
    } catch (e) {
      return { ok: false, reason: `Nacrt je oštećen: ${e.message}` };
    }
  },

  /** Učitava nacrt u store (odvojeno od `loadDraft` da pozivalac odluči). */
  applyDraft: (room, project) => {
    adoptProjectIds(project);
    set({ room, rawProject: project, activeProjectName: null }, false, false);
    get().clearHistory();
    return true;
  },
  setRawProject: (updater) => set((s) => ({
    rawProject: typeof updater === 'function' ? updater(s.rawProject) : updater,
  })),

  /**
   * `setRawProject` sa grupisanjem — za kontinuirane izmjene (prevlačenje,
   * kliznici). Koristi ga `dragElement`; ostale akcije su diskretne i svaka
   * zaslužuje svoj korak u historiji.
   */
  setRawProjectCoalesced: (updater) => set((s) => ({
    rawProject: typeof updater === 'function' ? updater(s.rawProject) : updater,
  }), false, 'drag'),
  bumpDecorVersion: () => set((s) => ({ decorVersion: s.decorVersion + 1 })),

  patch: (id, p) => {
    get().setRawProject((pr) => ({
      ...pr,
      elements: pr.elements.map((e) => {
        if (e.instanceId !== id) return e;
        const next = { ...e };
        Object.entries(p).forEach(([k, v]) => {
          next[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? { ...(e[k] || {}), ...v } : v;
        });
        return next;
      }),
    }));
  },

  /**
   * Dodaje element na prvo slobodno mjesto na zidu.
   * @returns {{ok: true, id: string} | {ok: false, reason: string}}
   */
  addElement: (templateId, wallId, widthMm, profileId) => {
    const { room, rawProject, setRawProject } = get();
    
    // Guard za template - sprječava crash ako template ne postoji
    const tpl = getTemplateWithGuard(templateId);
    if (tpl.templateId === 'UNKNOWN') {
      return createErrorResult(`Template "${templateId}" nije pronađen u katalogu.`);
    }
    
    const wall = wallId || 'top';
    const len = wallLength(wall, room);
    const w = Math.max(tpl.dims.width.min, Math.min(tpl.dims.width.max,
      Math.round(Number(widthMm) || tpl.dims.width.default)));
    const probe = createPlaced(templateId, profileId || 'SERIJA_KUCANO', wall, 0);
    probe.dims = { ...probe.dims, width: w };
    let found = null;
    for (let x = 0; x <= len - w; x += 10) {
      probe.offset = x;
      if (!collidesWithAny(probe, rawProject, room, probe.instanceId)) { found = x; break; }
    }
    if (found === null) {
      return createErrorResult(`Nema slobodnog mjesta na zidu za element širine ${w} mm.`);
    }
    probe.offset = found;
    setRawProject((p) => ({ ...p, elements: [...p.elements, probe] }));
    return createSuccessResult({ id: probe.instanceId });
  },

  removeElement: (id) => {
    get().setRawProject((p) => ({ ...p, elements: p.elements.filter((e) => e.instanceId !== id) }));
  },

  /* `clearAll` je obrisan: „Očisti prostor" u App.jsx radi isto inline
     (uz `setSelectedId(null)`, `setTool('select')` i poruku korisniku). */

  /**
   * Pomjeranje elementa duž zida.
   *
   * @param {string}  id       instanceId elementa
   * @param {number}  rawOffset željeni odmak od početka zida (mm)
   * @param {object}  [opts]
   * @param {boolean} [opts.snap=true]  da li se primjenjuje snap na susjede (40 mm).
   *        Isključite za direktni upis broja u polje — inače korisnik upiše 1234
   *        a dobije 1240.
   * @returns {{ok: true, offset: number} | {ok: false, reason: string}}
   *
   * BUG-21: ranije je ova akcija pri koliziji tiho vratila nepromijenjeno stanje,
   * pa korisnik nije znao da li je u pitanju kolizija ili greška u programu.
   */
  dragElement: (id, rawOffset, opts) => {
    const { room } = get();
    const snap = !opts || opts.snap !== false;
    const p = get().rawProject;
    
    // Guard za pronalaženje elementa
    const el = findElementWithGuard(p.elements, id);
    if (!el) return createErrorResult('Element nije pronađen.');
    
    const len = wallLength(el.wall, room);
    const rp = resolveProject(p, room);
    const clamp = (v) => Math.max(0, Math.min(len - el.dims.width, v));
    const raw = clamp(Math.round(rawOffset));
    const probeAt = (v) => collidesWithAny({ ...el, offset: v }, rp, room, id);

    let off = raw;
    let snapped = false;
    if (snap) {
      /* Kandidate isprobavamo od najbližeg ka najdaljem i uzimamo PRVI koji ne
         pravi koliziju. Ranije je `applySnap` birao najbližeg kandidata bez
         provjere, pa je kolizija odbijala CIJELO pomjeranje — element se pri
         prevlačenju „zalijepio" i nije pratio kursor. Sada snap ne može
         blokirati slobodno pomjeranje. */
      const cands = snapCandidates(el, rp, room)
        .filter((c) => Math.abs(c - raw) <= SNAP_TOLERANCE_MM)
        .sort((a, b) => Math.abs(a - raw) - Math.abs(b - raw));
      const slobodan = cands.find((c) => !probeAt(c));
      if (slobodan != null) { off = slobodan; snapped = true; }
    }

    const hit = probeAt(off);
    if (hit) {
      return {
        ok: false,
        reason: hit === 'ZID'
          ? 'Element bi izašao izvan gabarita prostorije.'
          : 'Kolizija sa susjednim elementom ili preprekom (prozor/vrata).',
        hit,
      };
    }
    if (off === el.offset) return createSuccessResult({ offset: off, unchanged: true });
    const next = { ...el, offset: off };
    get().setRawProjectCoalesced((pr) => ({
      ...pr,
      elements: pr.elements.map((e) => (e.instanceId === id ? next : e)),
    }));
    return createSuccessResult({ offset: off, snapped });
  },

  /**
   * Premještanje elementa na drugi zid — traži prvo slobodno mjesto.
   * @returns {{ok: true, offset: number} | {ok: false, reason: string}}
   *
   * BUG-21: klik na „Zid 3" ranije nije radio NIŠTA ako na tom zidu nema mjesta,
   * bez ikakve poruke.
   */
  moveToWall: (id, wall) => {
    const { room } = get();
    const p = get().rawProject;
    const el = p.elements.find((e) => e.instanceId === id);
    if (!el) return { ok: false, reason: 'Element nije pronađen.' };
    if (el.wall === wall) return { ok: true, offset: el.offset, unchanged: true };
    const len = wallLength(wall, room);
    if (el.dims.width > len) {
      return { ok: false, reason: `Element od ${el.dims.width} mm ne staje na zid dužine ${len} mm.` };
    }
    const rp = resolveProject(p, room);
    let off = null;
    for (let x = 0; x <= len - el.dims.width; x += 10) {
      if (!collidesWithAny({ ...el, wall, offset: x }, rp, room, id)) { off = x; break; }
    }
    if (off === null) {
      return { ok: false, reason: 'Na tom zidu nema slobodnog mjesta za element.' };
    }
    get().setRawProject((pr) => ({
      ...pr,
      elements: pr.elements.map((e) => (e.instanceId === id ? { ...e, wall, offset: off } : e)),
    }));
    return { ok: true, offset: off };
  },

  placeService: (kind, wall, offset) => {
    const { room, setRawProject } = get();
    const id = `sv_${Date.now()}`;
    setRawProject((p) => {
      const services = (p.services || []).concat([{
        id, kind, wall, offset, heightMm: kind === 'voda' ? 500 : 1150,
      }]);
      if (kind !== 'voda') return { ...p, services };
      const tpl = templateById('D-SUDOPER');
      const w = tpl.dims.width.default;
      const len = wallLength(wall, room);
      const el = createPlaced('D-SUDOPER', 'SERIJA_KUCANO', wall, 0);
      let best = null;
      const wanted = Math.round(offset - w / 2);
      for (let d = 0; d <= len; d += 10) {
        for (const cand of [wanted + d, wanted - d]) {
          const x = Math.max(0, Math.min(len - w, cand));
          el.offset = x;
          if (!collidesWithAny(el, { ...p, services }, room, el.instanceId)) { best = x; break; }
        }
        if (best !== null) break;
      }
      if (best === null) return { ...p, services };
      el.offset = best;
      return { ...p, services, elements: p.elements.concat([el]) };
    });
  },

  moveCooktop: (id, off) => {
    const { room } = get();
    /* Prevlačenje ploče po tlocrtu → grupisano u jedan korak historije.
       Paziti: `set` prima PARCIJALNO stanje store-a, pa se `rawProject` mora
       eksplicitno zamotati — `set((p) => ({ ...p, cooktops }))` bi obrisao
       `room` i sve akcije. */
    set((s) => ({
      rawProject: {
        ...s.rawProject,
        cooktops: (s.rawProject.cooktops || []).map((c) => (c.id === id
          ? { ...c, offset: Math.max(0, Math.min(wallLength(c.wall, room), off)) } : c)),
      },
    }), false, 'drag');
  },

  applyWizard: (d) => {
    const { setRoom, setRawProject } = get();
    setRoom(d.room);
    setRawProject((p) => {
      const services = [];
      if (d.water) services.push({ id: 'sv_voda', kind: 'voda', wall: d.water.wall, offset: d.water.offset, heightMm: d.water.height });
      (d.outlets || []).forEach((o, i) => services.push({
        id: `sv_str_${i + 1}`, kind: 'struja', wall: o.wall, offset: o.offset, heightMm: o.height,
      }));
      const obstacles = []
        .concat((d.windows || []).map((o, i) => ({ id: `ob_w${i + 1}`, kind: 'prozor', wall: o.wall, offset: o.offset, width: o.width, sill: o.sill, height: o.height })))
        .concat((d.doors || []).map((o, i) => ({ id: `ob_d${i + 1}`, kind: 'vrata', wall: o.wall, offset: o.offset, width: o.width, sill: 0, height: o.height })));
      const activeWalls = d.kind === 'kuhinja' ? shapeWalls(d.shape) : WALLS.map((x) => x.id);
      let elements = [];
      let layoutNotes = [];
      let triangle = null;
      let cooktops = [];
      const base = { ...p, services, obstacles, elements: [], legHeightMm: d.legHeight };
      if (d.kind === 'kuhinja' && d.autoLayout) {
        const res = autoLayoutEngine({
          room: d.room, shape: d.shape, services, obstacles,
          upperCorners: d.upperCorners, profileId: 'SERIJA_KUCANO',
          dishwasherWidthMm: d.dishW, ovenType: d.ovenType,
        });
        res.elements.forEach((el) => {
          if (!collidesWithAny(el, { ...base, elements }, d.room, el.instanceId)) elements = elements.concat([el]);
        });
        layoutNotes = res.notes;
        triangle = res.triangle;
        cooktops = res.cooktops || [];
      } else {
        cornerElementsFor(d.shape, d.room, d.upperCorners).forEach((el) => {
          if (!collidesWithAny(el, { ...base, elements }, d.room, el.instanceId)) elements = elements.concat([el]);
        });
        if (d.water) {
          const w = templateById('D-SUDOPER').dims.width.default;
          const len = wallLength(d.water.wall, d.room);
          const el = createPlaced('D-SUDOPER', 'SERIJA_KUCANO', d.water.wall, 0);
          const wanted = Math.round(d.water.offset - w / 2);
          let best = null;
          for (let k = 0; k <= len && best === null; k += 10) {
            for (const cand of [wanted + k, wanted - k]) {
              const x = Math.max(0, Math.min(len - w, cand));
              el.offset = x;
              if (!collidesWithAny(el, { ...base, elements }, d.room, el.instanceId)) { best = x; break; }
            }
          }
          if (best !== null) { el.offset = best; elements = elements.concat([el]); }
        }
      }
      const next = { ...p, kind: d.kind, shape: d.shape, activeWalls, services, obstacles, elements,
        legHeightMm: d.legHeight, ledMask: !!d.ledMask, dishwasherWidthMm: d.dishW,
        wallPanelOn: !!d.wallPanel, wallPanelHeightMm: d.wallPanelH,
        handleOrientBase: d.hOrientBase, handleOrientWall: d.hOrientWall,
        cooktops, layoutNotes, triangle };
      return normalizeProject(next, d.room).project;
    });
  },

  applyFrontDecor: (kindTest, decorId, key) => {
    get().setRawProject((p) => ({
      ...p,
      [key]: decorId,
      elements: p.elements.map((e) => {
        const tpl = templateById(e.templateId) || {};
        if (!kindTest(e, tpl)) return e;
        const th = thicknessesOf(decorId);
        const t = th.indexOf(e.front.thicknessMm) >= 0 ? e.front.thicknessMm : (th.indexOf(18) >= 0 ? 18 : th[0]);
        return { ...e, front: { ...e.front, decorId, thicknessMm: t } };
      }),
    }));
  },

  /**
   * „Brzo sačuvaj".
   *
   * BUG-20: ako je učitan imenovani projekat, piše se U NJEGA — a ne u zasebni
   * brzi slot. Ranije su se „Brzo sačuvaj" i „Sačuvaj kao" međusobno ne poznavali,
   * pa su izmjene nad učitanim projektom završavale na drugom mjestu i korisnik
   * bi ih pri sljedećem učitavanju izgubio.
   */
  saveProject: () => {
    const { room, rawProject, activeProjectName } = get();
    if (activeProjectName) {
      const payload = {
        name: activeProjectName, room,
        project: { ...rawProject, name: activeProjectName },
        savedAt: new Date().toISOString(),
      };
      const r = stWrite(namedKey(activeProjectName), JSON.stringify(payload));
      return r.ok ? { ok: true, slot: 'named', name: activeProjectName }
                  : { ok: false, reason: r.reason };
    }
    const r = stWrite(QUICK_SAVE_KEY, JSON.stringify({ room, project: rawProject }));
    return r.ok ? { ok: true, slot: 'quick' } : { ok: false, reason: r.reason };
  },

  /** Učitava brzi slot (`kuhinja:projekt`). */
  loadProject: () => {
    const r = stRead(QUICK_SAVE_KEY);
    if (!r.ok) return { ok: false, reason: r.missing ? 'Nema brzog snimka.' : r.reason };
    try {
      const d = JSON.parse(r.value);
      const { room, project, notes } = normalizeProject(d.project, d.room);
      adoptProjectIds(project);
      set({ room, rawProject: project, activeProjectName: null }, false, false);
      get().clearHistory();     // učitavanje nije korak koji se poništava
      return { ok: true, notes, slot: 'quick' };
    } catch (e) {
      return { ok: false, reason: `Brzi snimak je oštećen: ${e.message}` };
    }
  },

  /** „Sačuvaj kao" — upisuje imenovani slot i POSTAJE aktivni projekat. */
  saveProjectAs: (name) => {
    const { room, rawProject } = get();
    const clean = String(name || '').trim();
    if (!clean) return { ok: false, reason: 'Ime projekta je obavezno.' };
    const payload = {
      name: clean, room,
      project: { ...rawProject, name: clean },
      savedAt: new Date().toISOString(),
    };
    const r = stWrite(namedKey(clean), JSON.stringify(payload));
    if (!r.ok) return { ok: false, reason: r.reason };
    // activeProjectName se postavlja: od sada „Brzo sačuvaj" piše ovdje.
    set({ rawProject: { ...rawProject, name: clean }, activeProjectName: clean });
    return { ok: true, name: clean, slot: 'named' };
  },

  /**
   * Lista imenovanih projekata, najnoviji prvi.
   * Oštećeni zapisi se preskaču ali se PRIJAVLJUJU kroz `corrupt` — ranije su
   * tiho nestajali sa liste, pa je korisnik mislio da je projekat obrisan.
   */
  listProjects: () => {
    const kljucevi = stKeys(PROJECTS_PREFIX);
    const items = [];
    const corrupt = [];
    kljucevi.forEach((key) => {
      const r = stRead(key);
      if (!r.ok) { corrupt.push(key.slice(PROJECTS_PREFIX.length)); return; }
      try {
        const d = JSON.parse(r.value);
        items.push({ name: d.name || key.slice(PROJECTS_PREFIX.length), savedAt: d.savedAt });
      } catch {
        corrupt.push(key.slice(PROJECTS_PREFIX.length));
      }
    });
    items.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    return { items, corrupt };
  },

  loadProjectByName: (name) => {
    const r = stRead(namedKey(name));
    if (!r.ok) return { ok: false, reason: r.missing ? `Projekat "${name}" ne postoji.` : r.reason };
    try {
      const d = JSON.parse(r.value);
      const { room, project, notes } = normalizeProject(d.project, d.room);
      adoptProjectIds(project);
      // Učitan projekat postaje aktivan → „Brzo sačuvaj" ga dalje ažurira.
      set({ room, rawProject: project, activeProjectName: name }, false, false);
      get().clearHistory();     // učitavanje nije korak koji se poništava
      return { ok: true, notes, slot: 'named', name };
    } catch (e) {
      return { ok: false, reason: `Projekat "${name}" je oštećen: ${e.message}` };
    }
  },

  deleteProject: (name) => {
    const r = stRemove(namedKey(name));
    if (!r.ok) return { ok: false, reason: r.reason };
    // Ako je obrisan upravo aktivni projekat, vratimo se na brzi slot.
    if (get().activeProjectName === name) set({ activeProjectName: null });
    return { ok: true };
  },

  /**
   * Sprema korisnički dodane dekore. Vraća `{ ok, reason, count }` — ranije je
   * tiho gutalo svaku grešku, pa korisnik nije znao da dekor neće preživjeti
   * refresh (npr. kad je lokalna pohrana puna).
   */
  saveDecors: () => {
    const custom = Object.values(DECORS).filter((d) => d.custom).map((d) => ({
      code: d.code, name: d.shortName, struct: d.struct, fam: d.fam,
      board: Object.entries(d.board).map(([t, pp]) => ({ t: Number(t), p: pp })),
      worktop: d.worktop ? Object.entries(d.worktop).map(([w, pp]) => ({ w: Number(w), p: pp })) : [],
      edge: d.edge,
    }));
    const r = stWrite(DECORS_KEY, JSON.stringify(custom));
    return r.ok ? { ok: true, count: custom.length } : { ok: false, reason: r.reason };
  },

  loadDecors: () => {
    const r = stRead(DECORS_KEY);
    if (!r.ok) return 0;
    let arr;
    try {
      arr = JSON.parse(r.value);
    } catch {
      return 0;               // oštećen zapis — ne ruši aplikaciju pri pokretanju
    }
    if (!Array.isArray(arr)) return 0;
    let n = 0;
    arr.forEach((d) => {
      if (d && d.code && !DECORS[d.code]) {
        registerDecor(d);
        n += 1;
      }
    });
    if (n) get().bumpDecorVersion();
    return n;
  },
/* Historija prati samo prostoriju i projekat — `decorVersion` je tehnički brojač,
   a `activeProjectName` se ne smije vraćati undo-om (poslije poništene izmjene
   dugme „Sačuvaj" mora i dalje ciljati isti imenovani zapis). */
}), { keys: ['room', 'rawProject'] }));