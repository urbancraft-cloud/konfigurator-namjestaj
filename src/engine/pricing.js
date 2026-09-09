// src/engine/pricing.js

import { HINGE_HEIGHT_THRESHOLD_MM } from '../config/constants';
import { HARDWARE, RUNNER_SYSTEMS, HANDLES, CORNER_MECHANISMS } from '../data/hardware';
import { LEG_HEIGHTS } from '../data/tech';
import { KITCHEN_LEGS_PER_CORPUS, GOLA_METERS_PER_FRONT } from '../data/wardrobe';
import { r1 } from '../utils/formatters';
import {
  FRONT_PRICE, WASTE_FACTOR, LABOR_PER_PANEL, LABOR_PER_BAND_M,
  LABOR_ASSEMBLY, VAT_RATE, WORKTOP, SOCLE, TOPMASK,
} from '../data/tech';
import { profileOf } from '../data/tech';
import { boardPriceOf, edgePriceOf, worktopPriceOf, HDF_PRICE_M2 } from '../data/decors';
import { PROFILES } from '../data/profiles';
import { resolveFrontStack, resolveFrontLayout, computePanels } from './panels';
import {
  computeWorktops, computeWallPanels, computeSocle, computeTopMask,
  computeLedMask, computeEndPanels,
} from './surfaces';
import { optimizeCutList, summarizePlan } from './cutting';

/**
 * Broj nogica po korpusu dolazi iz `data/wardrobe.js` (`KITCHEN_LEGS_PER_CORPUS`)
 * tako da sve konstante pogona stoje na jednom mjestu.
 */

/**
 * Artikal nogice za zadatu visinu podnožja.
 * Bira najbližu dostupnu visinu iz `HARDWARE` (100 ili 150 mm) — nikad ne vraća
 * `undefined`, pa nepoznata visina ne može srušiti krojnu listu.
 */
export function legItemFor(legHeightMm) {
  const h = Number(legHeightMm);
  const tacna = HARDWARE[`NOGICA${h === LEG_HEIGHTS[0] ? '' : `_${h}`}`];
  if (tacna) return tacna;
  // Najbliža poznata visina (za slučaj da project.legHeightMm nije iz LEG_HEIGHTS)
  let best = HARDWARE.NOGICA;
  let bestD = Infinity;
  Object.values(HARDWARE).forEach((x) => {
    const m = /^Nogica podesiva (\d+) mm$/.exec(x.name || '');
    if (!m) return;
    const d = Math.abs(Number(m[1]) - h);
    if (d < bestD) { bestD = d; best = x; }
  });
  return best;
}
/**
 * Okov za element.
 *
 * `project` je sada obavezan kontekst: bez njega nije bilo moguće znati
 * `legHeightMm`, pa su se nogice naplaćivale i za izvedbe bez podnožja.
 */
export function computeHardware(el, project) {
  const out = [];
  const add = (id, qty) => { if (qty > 0) out.push({ ...HARDWARE[id], qty }); };
  const P = profileOf(el);
  const stack = resolveFrontStack(el, P) || [];
  const drawers = stack.filter((s) => s.kind === 'drawer');
  const doors = stack.filter((s) => s.kind === 'door');
  if (drawers.length) {
    const R = RUNNER_SYSTEMS[el.runnerSystemId];
    if (R) out.push({ id: R.id, name: R.name, price: R.pricePerSet, unit: 'set', qty: drawers.length });
  }
  const H = HANDLES[el.handleId] || HANDLES.RUCKA_160;
  const addHandle = (n) => { if (n > 0) out.push({ id: H.id, name: H.name, price: H.price, unit: 'kom', qty: n }); };
  const hingeId = el.isGlassDoor ? 'SARKA_ST' : 'SARKA';
  const hingesPerLeaf = el.dims.height > HINGE_HEIGHT_THRESHOLD_MM ? 4 : 2;

  /* Broj fronti: ili iz eksplicitnog stoga (ladice + vrata), ili — kad element
     nema definisan frontStack — iz automatskog rasporeda fronti. */
  let frontCount;
  if (!stack.length) {
    const leaves = resolveFrontLayout(el, P).filter((s) => s.kind === 'door').length;
    add(hingeId, leaves * hingesPerLeaf);
    frontCount = leaves;
  } else {
    if (doors.length) add(hingeId, doors.length * hingesPerLeaf);
    frontCount = drawers.length + doors.length;
  }

  /* --- Ručke / gola / push-to-open ------------------------------------
     Gola profil i push-to-open su METRAŽA, odnosno mehanizam po fronti,
     a ne "ručka po krilu". Ranije je addHandle() bez obzira na tip ručke
     dodavao 1 kom po fronti, pa je gola profil od 14 KM/m' naplaćivan kao
     14 KM po krilu — za kuhinju od 20 elemenata to je ~250–300 KM razlike. */
  if (H.kind === 'gola') {
    if (frontCount > 0) {
      /* Metraža = širina elementa × broj fronti × pravilo iz data/wardrobe.js.
         Primjer: donji 900 mm sa dva krila (twoLeafAboveMm = 600) → 2 × 0,9 = 1,8 m.
         Ladičar 600 mm sa 3 ladice → 3 × 0,6 = 1,8 m. */
      const meters = r1((el.dims.width / 1000) * frontCount * GOLA_METERS_PER_FRONT);
      out.push({ id: H.id, name: `${H.name} (metraža)`, price: H.price, unit: 'm', qty: meters });
    }
  } else if (H.kind === 'push') {
    add('PUSH', frontCount);                 // HARDWARE.PUSH — mehanizam po fronti
  } else {
    addHandle(frontCount);                   // klasična ručka / dugme: kom po fronti
  }
  const mech2 = CORNER_MECHANISMS[el.cornerMechanism];
  if (mech2 && mech2.replacesShelf) {
    out.push({ id: mech2.id, name: mech2.name, price: mech2.price, unit: 'set', qty: 1 });
  } else if (el.shelves > 0) add('PODUPIRAC', el.shelves * 4);
  if (el.type === 'wall') {
    if (el.mountingType === 'rail') {
      add('SINA', Math.ceil(el.dims.width / 100));
      add('VJESALICA', 2);
    } else add('VJESALICA', 2);
    if (el.upperBottomDetail === 'led_mask_18') add('LED_PROFIL', Math.ceil(el.dims.width / 100));
  }
  else {
    /* Nogice idu samo ako podnožje uopšte postoji, i to u VISINI koja je
       odabrana u projektu. Ranije je ova grana bila `el.dims.width > 900 ? 6 : 4`
       bez pristupa `project`, pa se (a) podnožje naplaćivalo i kad je
       `legHeightMm` 0 i (b) u krojnoj listi uvijek pisalo „Nogica podesiva
       100 mm" čak i za podnožje od 150 mm. */
    const legH = project?.legHeightMm ?? 150;
    if (legH > 0) add(legItemFor(legH).id, KITCHEN_LEGS_PER_CORPUS);
  }
  return out;
}

export function computePrice(el, project) {
  const panels = computePanels(el);
  const hw = computeHardware(el, project);
  let corpusArea = 0, frontArea = 0, backArea = 0, panelCount = 0;
  const bandTotals = {};
  panels.forEach((p) => {
    if (p.materialKey === 'corpus') corpusArea += p.areaM2;
    if (p.materialKey === 'front') frontArea += p.areaM2;
    if (p.materialKey === 'back') backArea += p.areaM2;
    panelCount += p.qty;
    Object.entries(p.bandMeters).forEach(([id, mm]) => { bandTotals[id] = (bandTotals[id] || 0) + mm; });
  });
  const korpus = corpusArea * boardPriceOf(el.corpus.decorId, el.corpus.thicknessMm) * WASTE_FACTOR;
  const frontovi = frontArea * (el.isGlassDoor
    ? FRONT_PRICE.STAKLO
    : boardPriceOf(el.front.decorId, el.front.thicknessMm)) * WASTE_FACTOR;
  const ledja = backArea * HDF_PRICE_M2 * 1.05;
  let kantovanje = 0, bandMeters = 0;
  Object.entries(bandTotals).forEach(([id, mm]) => {
    kantovanje += mm * edgePriceOf(el.corpus.decorId, id);
    bandMeters += mm;
  });
  const okov = hw.reduce((s, h) => s + h.price * h.qty, 0);
  const rad = panelCount * LABOR_PER_PANEL + bandMeters * LABOR_PER_BAND_M + LABOR_ASSEMBLY;
  const net = korpus + frontovi + ledja + kantovanje + okov + rad;
  return { breakdown: { korpus, frontovi, ledja, kantovanje, okov, rad }, panelCount, bandMeters, net };
}

/** Cijena ploča i obloga: materijal po m² + alu lajsne po dužnom metru. */
export function surfacesCost(project, room) {
  const wt = computeWorktops(project, room);
  const wp = computeWallPanels(project, room);
  const wtWidth = project.worktopDepthMm || WORKTOP.depthMm;
  const wtPerM = worktopPriceOf(project.worktopDecorId, wtWidth);
  const radnaPloca = wtPerM != null
    ? (wt.lengthMm / 1000) * wtPerM * WASTE_FACTOR
    : wt.areaM2 * boardPriceOf(project.worktopDecorId, 38) * WASTE_FACTOR;
  const zidnaObloga = wp.areaM2 * boardPriceOf(project.wallPanelDecorId || project.worktopDecorId, 18) * WASTE_FACTOR;
  const profileMeters = {};
  [wt, wp].forEach((x) => Object.entries(x.profileMeters).forEach(([id, m]) => {
    profileMeters[id] = (profileMeters[id] || 0) + m;
  }));
  const lajsne = Object.entries(profileMeters)
    .reduce((a, [id, m]) => a + m * PROFILES[id].pricePerM, 0);
  const sk = computeSocle(project, room);
  const gm = computeTopMask(project, room);
  const zm = computeEndPanels(project, room);
  const led = computeLedMask(project, room);
  const coklo = sk.areaM2 * boardPriceOf(project.socleDecorId || project.worktopDecorId, SOCLE.thicknessMm) * WASTE_FACTOR;
  const gornjaMaska = gm.areaM2 * boardPriceOf(project.topMaskDecorId || project.wallPanelDecorId || project.worktopDecorId, TOPMASK.thicknessMm) * WASTE_FACTOR;
  const zavrsneMaske = zm.areaM2 * (FRONT_PRICE.MDF_F) * WASTE_FACTOR;
  const ledMaska = led.areaM2 * boardPriceOf(project.wallPanelDecorId || project.worktopDecorId, 18) * WASTE_FACTOR;
  return {
    wt, wp, sk, gm, zm, led, radnaPloca, zidnaObloga, lajsne, coklo, gornjaMaska, zavrsneMaske, ledMaska, profileMeters,
    total: radnaPloca + zidnaObloga + lajsne + coklo + gornjaMaska + zavrsneMaske + ledMaska,
  };
}

/**
 * Ukupna cijena projekta.
 *
 * @param {object} [precomputedSurfaces] već izračunat rezultat `surfacesCost()`.
 *        `surfacesCost` je najskuplji dio kalkulacije (~0,9 ms), a `App.jsx` ga
 *        treba zasebno (za prikaz komada ploča), `projectTotals` ga treba za
 *        cijene, a `computeBOM` za krojnu listu — bez ovog parametra računao se
 *        3× po svakom renderu.
 */
export function projectTotals(project, room, precomputedSurfaces) {
  let net = 0; const parts = {};
  project.elements.forEach((el) => {
    const p = computePrice(el, project);
    net += p.net;
    Object.entries(p.breakdown).forEach(([k, v]) => { parts[k] = (parts[k] || 0) + v; });
  });
  const sc = precomputedSurfaces || surfacesCost(project, room);
  parts.radnaPloca = sc.radnaPloca;
  parts.zidnaObloga = sc.zidnaObloga;
  parts.lajsne = sc.lajsne;
  parts.coklo = sc.coklo;
  parts.gornjaMaska = sc.gornjaMaska;
  parts.zavrsneMaske = sc.zavrsneMaske;
  if (sc.ledMaska) parts.ledMaska = sc.ledMaska;
  net += sc.total;
  return { net, parts, vat: net * VAT_RATE, gross: net * (1 + VAT_RATE), worktop: sc.wt, wallPanel: sc.wp };
}

/* ---------------------------------------------------------------------------
   Obračun materijala PO PLOČAMA
--------------------------------------------------------------------------- */

/**
 * Ukupna cijena projekta sa materijalom obračunatim po potrošenim PLOČAMA,
 * umjesto po neto površini panela sa paušalnim koeficijentom otpada.
 *
 * Zašto: ploča se ne može dijeliti između različitih dekora, pa grupa sa dva
 * sitna komada (završna maska, coklo, LED maska) troši CIJELU ploču. Izmjereno
 * na referentnoj kuhinji: stvarni otpad 49,9 % naspram `WASTE_FACTOR` 15 %.
 *
 * Pravilo pogona (`MIN_SHEET_FRACTION` u `data/tech.js`): grupa koja zauzima
 * manje od jedne cijele ploče računa se kao **pola ploče**; inače se računa
 * onoliko cijelih ploča koliko ode, zaokruženo na više.
 *
 * @param {object} project riješen projekat (`resolveProject`)
 * @param {object} room
 * @param {object} bom     **obavezan** rezultat `computeBOM(project, room)`
 * @param {object} [sc]    već izračunat `surfacesCost`
 *
 * `bom` je obavezan, a ne opcion sa fallback-om, jer `computeBOM` živi u
 * `engine/bom.js` koji već importuje iz ovog modula (`computeHardware`,
 * `surfacesCost`) — import u oba smjera bi bio kružna zavisnost. Pozivalac
 * (`App.jsx`) ionako već ima BOM izračunat.
 */
export function projectTotalsBySheets(project, room, bom, sc) {
  if (!bom || !Array.isArray(bom.rows)) {
    throw new TypeError('projectTotalsBySheets zahtijeva rezultat computeBOM() kao treći argument.');
  }
  const b = bom;
  const surfaces = sc || surfacesCost(project, room);

  /* 1. Materijali koji se NE kupuju kao ploča, pa ostaju na starom obračunu:
        - alu lajsne (`lajsne`) → po dužnom metru
        - radna ploča (`radnaPloca`) → po dužnom metru, kao gotov proizvod
     Sve ostalo (korpus, fronte, HDF leđa, kantovanje, obloga, coklo, maske)
     se kupuje u pločama i prelazi na obračun po pločama. */
  const vanPloca = surfaces.lajsne + surfaces.radnaPloca;

  let netMaterial = 0;
  project.elements.forEach((el) => {
    const p = computePrice(el, project);
    netMaterial += p.breakdown.korpus + p.breakdown.frontovi + p.breakdown.ledja
                 + p.breakdown.kantovanje;
  });
  netMaterial += surfaces.total - surfaces.radnaPloca - surfaces.lajsne;

  /* 2. Isti ti materijali, ali po potrošenim PLOČAMA. */
  const plan = optimizeCutList(b, { excludeFlags: ['wt'] });
  const sheetCost = plan.reduce((sum, g) => sum + (g.materialCost || 0), 0);
  const chargedSheets = plan.reduce((sum, g) => sum + (g.chargedSheets || 0), 0);

  /* 3. Osnovica = (rad + okov + montaža + lajsne + radna ploča) + materijal po
        pločama. `base.net` sadrži sve; oduzmemo pločni materijal po neto cijeni
        i vratimo ga po cijeni potrošenih ploča. */
  const base = projectTotals(project, room, surfaces);
  /* Osnovica se računa iz NEZaokruženih iznosa — da `net` bude tačno
     `base.net - netMaterial + sheetCost`, bez greške zaokruživanja od par feninga
     koja bi inače nastala jer se `sheets.sheetCost` i `sheets.netMaterial`
     prikazuju na 2 decimale. */
  const net = Math.max(0, base.net - netMaterial + sheetCost);

  return {
    ...base,
    net,
    vat: net * VAT_RATE,
    gross: net * (1 + VAT_RATE),
    materialMode: 'sheet',
    sheets: {
      plan,
      summary: summarizePlan(plan),
      chargedSheets: r1(chargedSheets * 10) / 10,
      sheetCost: Math.round(sheetCost * 100) / 100,
      netMaterial: Math.round(netMaterial * 100) / 100,
      razlika: Math.round((sheetCost - netMaterial) * 100) / 100,
      /* Ono što je ostalo na starom obračunu (lajsne + radna ploča) — prikazuje
         se zasebno da korisnik vidi odakle dolazi ukupni iznos. */
      /* 2 decimale, kao i `base.parts` — `r1` (1 decimala) bi dao 667.0 dok je
         zbir stavki 667.01, pa se prikaz ne bi slagao sa sabircima. */
      vanPloca: Math.round(vanPloca * 100) / 100,
    },
    parts: {
      ...base.parts,
      materijalPoPlocama: r1(sheetCost),
      materijalNeto: r1(netMaterial),
      /* `base.parts` je zaokružen na 2 decimale (kao i `projectTotals`), pa se i
         ovi iznosi drže na istoj preciznosti — `r1` (1 decimala) bi dao 662.0
         umjesto 661.97 i ne bi se slagao sa prikazom u ponudi. */
      radnaPlocaPoMetru: surfaces.radnaPloca,
      lajsne: surfaces.lajsne,
    },
  };
}
