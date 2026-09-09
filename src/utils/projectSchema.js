// src/utils/projectSchema.js
// Normalizacija i migracija projekta pri učitavanju.
//
// `loadProjectByName` je ranije radio `JSON.parse(...)` i rezultat ubacivao u store
// bez ikakve provjere. Posljedica: projekat sačuvan sa starijom verzijom kataloga
// (izbačen tip elementa, izbačen dekor, polje koje još nije postojalo) rušio je
// engine sa `TypeError: Cannot read properties of undefined` — bez ikakve poruke,
// jer nema ErrorBoundary. Ovdje se svaki takav slučaj presreće: polja se dopunjuju
// defaultima, neispravni elementi odbacuju, a razlog se vraća kao `notes` da ga
// UI može prikazati korisniku.

import { templateById, templateExists } from '../data/catalog';
import { decorById, decorExists, PRICE_LIST } from '../data/decors';
import { WALLS } from '../data/tech';
import {
  DEFAULT_PROJECT, NUMERIC_PROJECT_FIELDS, DECOR_FIELDS,
} from '../data/projectDefaults';

const WALL_IDS = WALLS.map((w) => w.id);
const DEFAULT_ROOM = { width: 5600, depth: 3600, height: 2600 };

const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

function sanitizeRoom(raw, notes) {
  const d = DEFAULT_ROOM;
  const src = (raw && typeof raw === 'object') ? raw : {};
  const width = num(src.width, d.width);
  const depth = num(src.depth, d.depth);
  const height = num(src.height, d.height);
  if (!(width >= 500 && depth >= 500 && height >= 1000)) {
    notes.push(`Dimenzije prostorije (${src.width}×${src.depth}×${src.height}) nisu važeće — vraćeno na ${d.width}×${d.depth}×${d.height} mm.`);
    return { ...d };
  }
  return { width, depth, height };
}

/** Element je upotrebljiv ako ima ID, zid, pomak i brojčane dimenzije. */
function sanitizeElement(e, notes) {
  if (!e || typeof e !== 'object') return null;
  if (!e.instanceId) return null;
  if (!templateExists(e.templateId)) {
    notes.push(`Element "${e.instanceId}" (${e.templateId}) nije u katalogu — preskočen. Vjerovatno je sačuvan sa starijom verzijom programa.`);
    return null;
  }
  const tpl = templateById(e.templateId);
  if (!e.dims || !Number.isFinite(num(e.dims.width, NaN))) {
    notes.push(`Element ${e.instanceId} nema ispravne dimenzije — preskočen.`);
    return null;
  }
  const wall = WALL_IDS.includes(e.wall) ? e.wall : 'top';
  const dims = {
    width: num(e.dims.width, tpl.dims.width.default),
    height: num(e.dims.height, tpl.dims.height.default),
    depth: num(e.dims.depth, tpl.dims.depth.default),
  };
  const front = (e.front && typeof e.front === 'object') ? e.front : {};
  const corpus = (e.corpus && typeof e.corpus === 'object') ? e.corpus : {};
  if (front.decorId && !decorExists(front.decorId)) {
    notes.push(`Dekor fronte "${front.decorId}" više nije u cjenovniku — vraćen na ${tpl.type === 'wall' ? 'frontDecorWall' : 'frontDecorBase'}.`);
  }
  if (corpus.decorId && !decorExists(corpus.decorId)) {
    notes.push(`Dekor korpusa "${corpus.decorId}" više nije u cjenovniku — vraćen na W1000.`);
  }
  return {
    ...e,
    wall,
    dims,
    offset: num(e.offset, 0),
    elevation: num(e.elevation, tpl.elevation ?? 150),
    corpus: { decorId: decorExists(corpus.decorId) ? corpus.decorId : 'W1000',
              thicknessMm: num(corpus.thicknessMm, 18) },
    front: { materialId: front.materialId || 'MDF_F',
             decorId: decorExists(front.decorId) ? front.decorId : 'W1000',
             thicknessMm: num(front.thicknessMm, 18) },
    back: { thicknessMm: num(e.back?.thicknessMm, 3) },
    edge: { visibleId: e.edge?.visibleId || 'E2_23', hiddenId: e.edge?.hiddenId || 'E08_23' },
    mountOffsetMm: num(e.mountOffsetMm, 0),
    shelves: num(e.shelves, tpl.shelves ?? 0),
  };
}

function sanitizeObstacle(o, _notes) {
  if (!o || typeof o !== 'object' || !o.id) return null;
  if (!WALL_IDS.includes(o.wall)) return null;
  const kind = (o.kind === 'vrata') ? 'vrata' : 'prozor';
  return {
    ...o, kind,
    offset: num(o.offset, 0),
    width: Math.max(1, num(o.width, 900)),
    sill: Math.max(0, num(o.sill, kind === 'vrata' ? 0 : 900)),
    height: Math.max(1, num(o.height, kind === 'vrata' ? 2050 : 1200)),
  };
}

function sanitizeService(s, _notes) {
  if (!s || typeof s !== 'object' || !s.id) return null;
  if (!WALL_IDS.includes(s.wall)) return null;
  const kind = (s.kind === 'struja') ? 'struja' : 'voda';
  return { ...s, kind, offset: num(s.offset, 0), heightMm: num(s.heightMm, kind === 'voda' ? 500 : 1150) };
}

function sanitizeCooktop(c, _notes) {
  if (!c || typeof c !== 'object' || !c.id) return null;
  if (!WALL_IDS.includes(c.wall)) return null;
  return { ...c, offset: num(c.offset, 0), widthMm: Math.max(100, num(c.widthMm, 600)) };
}

const list = (v) => (Array.isArray(v) ? v : []);

/**
 * Vraća `{ room, project, notes }` — uvijek upotrebljivo, nikad `undefined`.
 * `notes` je niz poruka za korisnika (prazan ako je projekat bio ispravan).
 */
export function normalizeProject(rawProject, rawRoom) {
  const notes = [];
  const base = DEFAULT_PROJECT();
  const p = (rawProject && typeof rawProject === 'object') ? { ...base, ...rawProject } : base;

  const room = sanitizeRoom(rawRoom, notes);

  // --- elementi -----------------------------------------------------------
  const elements = [];
  const droppedIds = [];
  list(p.elements).forEach((e) => {
    const clean = sanitizeElement(e, notes);
    if (clean) elements.push(clean);
    else if (e && e.instanceId) droppedIds.push(e.instanceId);
  });

  // --- nizovi -------------------------------------------------------------
  const obstacles = list(p.obstacles).map((o) => sanitizeObstacle(o, notes)).filter(Boolean);
  const services = list(p.services).map((s) => sanitizeService(s, notes)).filter(Boolean);
  const cooktops = list(p.cooktops).map((c) => sanitizeCooktop(c, notes)).filter(Boolean);

  const activeWalls = list(p.activeWalls).filter((w) => WALL_IDS.includes(w));

  // --- endPanelSizes: očisti ključeve za maske koje više ne postoje -------
  let endPanelSizes = (p.endPanelSizes && typeof p.endPanelSizes === 'object'
    && !Array.isArray(p.endPanelSizes)) ? { ...p.endPanelSizes } : {};
  if (droppedIds.length) {
    const before = Object.keys(endPanelSizes).length;
    Object.keys(endPanelSizes).forEach((k) => {
      if (droppedIds.some((id) => k.includes(id))) delete endPanelSizes[k];
    });
    const removed = before - Object.keys(endPanelSizes).length;
    if (removed > 0) notes.push(`Uklonjeno ${removed} ručnih izmjena završnih maski za preskočene elemente.`);
  }

  // --- numerička polja ----------------------------------------------------
  NUMERIC_PROJECT_FIELDS.forEach((k) => {
    if (p[k] === undefined || p[k] === null) return;
    const n = Number(p[k]);
    if (!Number.isFinite(n) || n < 0) {
      notes.push(`Polje "${k}" ima nevažeću vrijednost (${p[k]}) — vraćeno na ${base[k] ?? '—'}.`);
      p[k] = base[k];
    } else p[k] = n;
  });

  // --- dekori -------------------------------------------------------------
  DECOR_FIELDS.forEach((k) => {
    if (!p[k]) return;                       // opcionalno polje, fallback ide iz base-a
    if (!decorExists(p[k])) {
      notes.push(`Dekor "${p[k]}" (${k}) više nije u cjenovniku — zamijenjen sa ${decorById(base[k]).code}.`);
      p[k] = base[k];
    }
  });

  /* --- verzija cjenovnika -------------------------------------------------
     Ako je projekat rađen po drugom cjenovniku, cijene u njemu više ne
     odgovaraju onome što aplikacija sada računa. To se mora REĆI, ne prešutjeti. */
  const saved = (rawProject && rawProject.priceList) || null;
  if (!saved || !saved.label) {
    notes.push(`Projekat nije imao oznaku cjenovnika — pretpostavlja se ${PRICE_LIST.label}.`);
  } else if (saved.label !== PRICE_LIST.label) {
    notes.push(`Projekat je rađen po cjenovniku „${saved.label}", a trenutno važi „${PRICE_LIST.label}". Iznosi su preračunati po novom cjenovniku — za staru ponudu učitajte izvezeni fajl ili vratite cjenovnik.`);
  }

  // Način obračuna materijala: stari projekti ga nemaju → podrazumijevani.
  if (p.materialMode !== 'neto' && p.materialMode !== 'ploce') p.materialMode = base.materialMode;

  const project = { ...p, elements, obstacles, services, cooktops, endPanelSizes,
    priceList: saved || { ...PRICE_LIST },
    activeWalls: activeWalls.length ? activeWalls : base.activeWalls };

  return { room, project, notes };
}

/**
 * Normalizacija projekta ormara.
 *
 * Model ormara je promijenjen (donji korpus 2000→1950 i editabilan, visina
 * prostora umjesto visine ormara, bočne maske, ladičar −100 mm od svijetle
 * širine). Stari snimci se ovdje PREBACUJU na novi model uz napomenu, umjesto
 * da se učitaju sa pogrešnim brojevima.
 */
export function normalizeWardrobe(rawWardrobe, rawRoom) {
  const notes = [];
  const room = sanitizeRoom(rawRoom, notes);
  const w = (rawWardrobe && typeof rawWardrobe === 'object') ? { ...rawWardrobe } : {};

  const segments = list(w.segments)
    .map((sg) => ({
      id: sg?.id || `seg_${Math.random().toString(36).slice(2, 7)}`,
      lower: { items: list(sg?.lower?.items).filter((it) => it && it.id && it.type) },
      upper: { items: list(sg?.upper?.items).filter((it) => it && it.id && it.type) },
    }));

  if (!segments.length) {
    notes.push('Projekat ormara nije imao nijedan segment — vraćeno na podrazumijevana 3.');
    for (let i = 0; i < 3; i++) {
      segments.push({ id: `seg_${i + 1}`, lower: { items: [] }, upper: { items: [] } });
    }
  }

  /* --- Migracija sa starog modela ---------------------------------------
     Stari zapis je imao `heightMm` = ukupna visina ORMARA (2350–2900) i
     fiksni donji korpus od 2000 mm. Novi model polazi od VISINE PROSTORA,
     a donji korpus je ulazna veličina (default 1950). */
  if (!Number.isFinite(num(w.roomHeightMm, NaN))) {
    if (Number.isFinite(num(w.heightMm, NaN))) {
      w.roomHeightMm = num(w.heightMm, 2600);
      notes.push(`Projekat je sačuvan po starom modelu (visina ormara ${w.heightMm} mm) — prebačen na visinu prostora ${w.roomHeightMm} mm. Donji korpus je postavljen na 1950 mm; provjerite visine jer se krojna lista razlikuje od stare.`);
    } else {
      w.roomHeightMm = num(room.height, 2600);
      notes.push('Projekat nije imao visinu prostora — uzeta je visina prostorije.');
    }
  }
  delete w.heightMm;

  if (!Number.isFinite(num(w.lowerCorpusHeightMm, NaN))) {
    w.lowerCorpusHeightMm = 1950;
  }
  if (!Number.isFinite(num(w.topMaskHeightMm, NaN)) || num(w.topMaskHeightMm, 0) <= 0) {
    w.topMaskHeightMm = 100;
  }
  if (!Number.isFinite(num(w.legHeightMm, NaN)) || num(w.legHeightMm, 0) <= 0) {
    w.legHeightMm = 100;
  }
  if (!Number.isFinite(num(w.widthMm, NaN)) || num(w.widthMm, 0) < 300) {
    w.widthMm = 2400;
    notes.push('Širina ormara nije bila ispravna — vraćeno na 2400 mm.');
  }
  if (!Number.isFinite(num(w.depthMm, NaN)) || num(w.depthMm, 0) < 200) {
    w.depthMm = 580;
    notes.push('Dubina korpusa nije bila ispravna — vraćeno na 580 mm.');
  }
  if (w.doorType !== 'klizna') w.doorType = 'baglame';

  /* Bočne maske i visina vrata su nove — `null` znači „automatski". */
  if (!('sideMaskDepthLeftMm' in w)) w.sideMaskDepthLeftMm = null;
  if (!('sideMaskDepthRightMm' in w)) w.sideMaskDepthRightMm = null;
  if (!('doorHeightMm' in w)) w.doorHeightMm = null;

  /* Ladičari: stari model nije imao `heightMm` ni `widthMm` po komadu. */
  let ladicaMigrirano = 0;
  segments.forEach((sg) => {
    ['lower', 'upper'].forEach((c) => {
      sg[c].items = sg[c].items.map((it) => {
        if (it.type !== 'ladicar') return it;
        ladicaMigrirano += 1;
        return {
          ...it,
          heightMm: num(it.heightMm, 700),
          drawerCount: Math.max(1, Math.round(num(it.drawerCount, 3))),
        };
      });
    });
  });
  if (ladicaMigrirano > 0) {
    notes.push(`Ladičari (${ladicaMigrirano}) su prebačeni na novi model: visina 700 mm, širina = svijetla širina segmenta − 100 mm.`);
  }

  if (w.corpusDecorId && !decorExists(w.corpusDecorId)) {
    notes.push(`Dekor korpusa "${w.corpusDecorId}" više nije u cjenovniku.`);
    w.corpusDecorId = null;
  }
  if (w.doorDecorId && !decorExists(w.doorDecorId)) {
    notes.push(`Dekor vrata "${w.doorDecorId}" više nije u cjenovniku.`);
    w.doorDecorId = null;
  }

  return { room, wardrobe: { ...w, segments }, notes };
}
