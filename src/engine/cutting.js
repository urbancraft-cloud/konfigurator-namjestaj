// src/engine/cutting.js
//
// Optimizacija krojenja (1D/2D nesting po ploči).
//
// `OfferModal` je od početka govorio: „Konačnu cijenu daje optimizacija krojenja" —
// ali ta optimizacija nije postojala, pa je cijena uvijek bila površina panela ×
// cijena m² × koeficijent otpada 1,15. To je procjena, ne stvarni trošak: stvarni
// zavisi od toga koliko panela STANE na jednu ploču, a to zavisi od njihovih mjera,
// smjera teksture i širine lista pile.
//
// Algoritam: shelf/strip packing sa guillotine rezovima.
//   1. Paneli se grupišu po (materijal, debljina) — samo se isto debela ploča
//      istog dekora može krojiti zajedno.
//   2. Unutar grupe se sortiraju po visini (opadajuće), pa po površini.
//   3. Na svaku ploču se slažu „police" (redovi) pune širine; panel ide u prvu
//      policu u koju staje, inače otvara novu.
//   4. Rotacija je dozvoljena SAMO ako panel nema teksturu (`rotationAllowed`) —
//      drvo mora ići u istom smjeru na cijeloj kuhinji.
//   5. Između dva panela računa se `kerfMm` (širina lista pile). Na rubu ploče ne.
//
// Zašto shelf packing a ne pravi 2D bin packing: daje rezove koji se mogu izvesti
// na klasičnoj krojnoj pili (samo ravni rezovi s jednog kraja na drugi),
// što je ono što pogon stvarno može proizvesti. Pravi 2D packing bi dao bolju
// iskorištenost ali rezove koje pilom nije moguće izvesti.

import { sheetFor, SAW_KERF_MM, SHEET_TRIM_MM, sheetConsumption } from '../data/tech';
import { boardPriceOf, HDF_PRICE_M2 } from '../data/decors';
import { HDF_GROUP_ID } from './bom';
import { r1 } from '../utils/formatters';

/**
 * Rasporedi listu pravougaonika na što manje ploča.
 *
 * @param {Array<{id:string,w:number,h:number,rotatable:boolean,label?:string}>} items
 * @param {number} sheetW   širina ploče (mm)
 * @param {number} sheetH   visina ploče (mm)
 * @param {number} kerf     širina lista pile (mm)
 * @param {number} trim     margina po obodu ploče (mm)
 * @returns {{sheets: Array, unfit: Array}}
 */
export function packRects(items, sheetW, sheetH, kerf = SAW_KERF_MM, trim = SHEET_TRIM_MM) {
  const usableW = sheetW - 2 * trim;
  const usableH = sheetH - 2 * trim;
  const sheets = [];
  const unfit = [];

  /* Panel koji NE STAJE na ploču u zadatoj orijentaciji, a smije se rotirati
     (nema teksturu), rotira se ovdje — inače bi završio u `unfit` iako fizički
     staje. Primjer: HDF leđa 408×1036 na ploču 2800×600 — uspravno ne mogu,
     ali rotirana (1036×408) stanu.

     Ovo NIJE isto što i `packWithRotation` ispod: ta funkcija rotira SVE
     rotabilne panele i poredi dva cijela rasporeda, dok ovdje rotiramo samo one
     koji inače ne bi stali nigdje. */
  const sorted = items.map((it) => {
    const stane = it.w <= usableW && it.h <= usableH;
    if (stane || !it.rotatable || it.w === it.h) return it;
    if (it.h <= usableW && it.w <= usableH) return { ...it, w: it.h, h: it.w, preRotated: true };
    return it;                                    // stvarno prevelik → unfit
  }).sort((a, b) => (b.h - a.h) || (b.w * b.h - a.w * a.h));   // najviši prvi

  const opensSheet = () => {
    const s = { index: sheets.length, shelves: [], items: [], usedAreaMm2: 0 };
    sheets.push(s);
    return s;
  };

  sorted.forEach((item) => {
    if (item.w > usableW || item.h > usableH) { unfit.push(item); return; }
    let placed = false;

    for (let si = 0; si < sheets.length && !placed; si++) {
      const sheet = sheets[si];
      for (let sh = 0; sh < sheet.shelves.length && !placed; sh++) {
        const shelf = sheet.shelves[sh];
        if (item.h > shelf.h) continue;                    // ne staje po visini police
        if (shelf.used + item.w + (shelf.used > 0 ? kerf : 0) <= usableW) {
          const x = trim + (shelf.used > 0 ? shelf.used + kerf : 0);
          shelf.items.push({
            id: item.id, label: item.label,
            x, y: trim + shelf.y, w: item.w, h: item.h,
            rotated: !!item.preRotated,
          });
          shelf.used += item.w + (shelf.used > 0 ? kerf : 0);
          sheet.items.push(item.id);
          sheet.usedAreaMm2 += item.w * item.h;
          placed = true;
        }
      }
      if (!placed) {
        // Nova polica na ovoj ploči?
        const usedH = sheet.shelves.reduce((n, s) => n + s.h + (n > 0 ? kerf : 0), 0);
        if (usedH + item.h + (sheet.shelves.length ? kerf : 0) <= usableH) {
          const shelf = {
            y: usedH + (sheet.shelves.length ? kerf : 0),
            h: item.h,
            used: item.w,
            items: [],
          };
          shelf.items.push({
            id: item.id, label: item.label,
            x: trim, y: trim + shelf.y, w: item.w, h: item.h, rotated: !!item.preRotated,
          });
          sheet.shelves.push(shelf);
          sheet.items.push(item.id);
          sheet.usedAreaMm2 += item.w * item.h;
          placed = true;
        }
      }
    }

    if (!placed) {
      const sheet = opensSheet();
      const shelf = { y: 0, h: item.h, used: item.w, items: [] };
      shelf.items.push({
        id: item.id, label: item.label,
        x: trim, y: trim, w: item.w, h: item.h, rotated: !!item.preRotated,
      });
      sheet.shelves.push(shelf);
      sheet.items.push(item.id);
      sheet.usedAreaMm2 += item.w * item.h;
    }
  });

  sheets.forEach((s) => {
    s.areaMm2 = usableW * usableH;
    s.utilization = s.areaMm2 > 0 ? s.usedAreaMm2 / s.areaMm2 : 0;
    s.wasteMm2 = Math.max(0, s.areaMm2 - s.usedAreaMm2);
  });

  return { sheets, unfit };
}

/**
 * Pokuša i SVE rotirane panele (samo one bez teksture) i zadrži bolji raspored.
 *
 * Napomena: shelf packing NIJE monotona heuristika — veći `kerf` ili `trim` ne
 * znači nužno više ploča, jer se raspored polica presloži. Zato se ovdje ne
 * tvrdi da „veći kerf = više ploča", nego se uzima bolji od dva rasporeda.
 */
function packWithRotation(items, sheetW, sheetH, kerf, trim) {
  const plain = packRects(items, sheetW, sheetH, kerf, trim);

  const mayRotate = items.filter((i) => i.rotatable && i.w !== i.h);
  if (!mayRotate.length) return plain;

  // Alternativa: rotiraj sve koji smiju, pa rasporedi.
  const rotated = items.map((i) => (i.rotatable && i.w !== i.h
    ? { ...i, w: i.h, h: i.w, rotated: true }
    : i));
  const alt = packRects(rotated, sheetW, sheetH, kerf, trim);

  const score = (r) => r.sheets.length * 1e9 + r.unfit.length * 1e12
    - r.sheets.reduce((n, s) => n + s.utilization, 0);
  return score(alt) < score(plain) ? alt : plain;
}

/**
 * Glavna funkcija: krojna lista → plan krojenja po pločama.
 *
 * @param {object} bom      rezultat `computeBOM()`
 * @param {object} [opts]
 * @param {number} [opts.kerfMm]  širina lista pile (default `SAW_KERF_MM`)
 * @param {number} [opts.trimMm]  margina po obodu (default `SHEET_TRIM_MM`)
 * @param {boolean} [opts.includeSurfaces] uključi obloge/maske (default true)
 * @param {Array<string>} [opts.excludeFlags] `surface` oznake koje se izuzimaju
 *        (npr. `['wt']` za radne ploče — vidi napomenu niže)
 * @returns {Array} grupa po (tip ploče, debljina, dekor) sa pločama i cijenom
 */
export function optimizeCutList(bom, opts = {}) {
  const kerf = opts.kerfMm != null ? opts.kerfMm : SAW_KERF_MM;
  const trim = opts.trimMm != null ? opts.trimMm : SHEET_TRIM_MM;
  const includeSurfaces = opts.includeSurfaces !== false;
  const exclude = new Set(opts.excludeFlags || []);

  /* RADNE PLOČE SE IZUZIMAJU iz obračuna po pločama.
     Razlog: one se ne kupuju kao ploča 4100×600 pa režu — kupuju se po DUŽNOM
     METRU (`worktopPriceOf(dekor, širina)`), kao gotov proizvod sa obrađenim
     rubom. Primjena pravila „pola ploče" na njih dala bi 86 KM umjesto stvarnih
     ~662 KM za 3,7 m' ploče. Zato se radna ploča i dalje obračunava po metru
     u `surfacesCost`, a ovdje se prikazuje samo informativno u planu rezanja. */
  const rows = (bom.rows || []).filter((r) => {
    if (!includeSurfaces && r.surface) return false;
    if (r.surfaceFlag && exclude.has(r.surfaceFlag)) return false;
    return true;
  });

  /* Grupisanje po (tip ploče, debljina, dekor).
     Ploča se NE može dijeliti između različitih dekora, a medijapan visoki sjaj
     ima drugi format (2800×1220) nego iverica (2800×2070) — pa oba moraju biti
     dio ključa grupe. */
  const groups = new Map();
  /* Naziv materijala po grupi — uzima se iz PRVOG reda grupe, ne pretragom
     cijelog BOM-a. Pretraga po decorId je hvatala pogrešan red jer isti dekor
     dijele radna ploča, zidna obloga, coklo, gornja i LED maska. */
  const labels = new Map();
  rows.forEach((r) => {
    const cutL = Number(r.cutL);
    const cutW = Number(r.cutW);
    if (!(cutL > 0) || !(cutW > 0)) return;             // okov i nule nisu paneli
    const boardType = r.boardType || 'iverica';
    const decorId = r.decorId || r.material;
    const key = `${boardType}|${r.thickness}|${decorId}`;
    if (!groups.has(key)) groups.set(key, []);
    /* Grupu mogu činiti različite VRSTE komada koje dijele isti dekor, debljinu i
       tip ploče (npr. zidna obloga 18 mm i gornja maska 18 mm u istom dekoru) —
       i to je ispravno, jer se stvarno režu iz iste ploče. Naziv grupe zato
       navodi sve različite vrste, ne samo prvu. */
    if (!labels.has(key)) labels.set(key, []);
    const lbls = labels.get(key);
    if (r.material && lbls.indexOf(r.material) < 0) lbls.push(r.material);
    const n = Math.max(1, Math.round(r.qty || 1));
    for (let i = 0; i < n; i++) {
      groups.get(key).push({
        id: `${r.pos}-${i + 1}`,
        label: `${r.role}${n > 1 ? ` ${i + 1}/${n}` : ''}`,
        element: r.element,
        w: cutL,
        h: cutW,
        rotatable: !!r.rotationAllowed,
        grain: r.grain || 'none',
      });
    }
  });

  const out = [];
  groups.forEach((items, key) => {
    const [boardType, thicknessStr, decorId] = key.split('|');
    const thickness = Number(thicknessStr);
    const sheet = sheetFor(thickness, boardType);
    const packed = packWithRotation(items, sheet.widthMm, sheet.heightMm, kerf, trim);

    const totalPanelArea = items.reduce((n, i) => n + i.w * i.h, 0);
    const sheetAreaMm2 = sheet.widthMm * sheet.heightMm;
    const totalSheetArea = packed.sheets.length * sheetAreaMm2;
    const labelList = labels.get(key) || [];
    const material = labelList.length === 0 ? decorId
      : (labelList.length <= 2
        ? labelList.join(' + ')
        : `${labelList[0]} + još ${labelList.length - 1} vrste`);

    /* Obračun po pravilu pogona: grupa manja od jedne ploče → pola ploče. */
    const consumption = sheetConsumption(totalPanelArea, sheetAreaMm2);
    /* HDF leđa imaju svoju cijenu u cjenovniku, nevezanu za dekor. */
    const priceM2 = decorId === HDF_GROUP_ID
      ? HDF_PRICE_M2
      : boardPriceOf(decorId, thickness);
    const pricePerSheet = r1((priceM2 * sheetAreaMm2) / 1e6 * 100) / 100;

    out.push({
      key,
      material,
      materialLabel: (rows.find((r) => (r.decorId || r.material) === decorId) || {}).material || decorId,
      decorId,
      boardType,
      boardTypeLabel: sheet.label,
      thicknessMm: thickness,
      /* `material` iz BOM-a je već čitljiv naziv („Front W1000 Bijela premium ST9",
           „HDF 3 mm", naziv dekora korpusa) — ne pokušavamo iz njega izvlačiti šifru. */
      decorName: material,
      sheet: { widthMm: sheet.widthMm, heightMm: sheet.heightMm },
      kerfMm: kerf,
      trimMm: trim,
      panelCount: items.length,
      sheetCount: packed.sheets.length,
      sheets: packed.sheets,
      unfit: packed.unfit,
      panelAreaM2: r1(totalPanelArea / 1e6),
      sheetAreaM2: r1(totalSheetArea / 1e6),
      utilization: totalSheetArea > 0 ? r1((totalPanelArea / totalSheetArea) * 1000) / 10 : 0,
      wasteM2: r1(Math.max(0, totalSheetArea - totalPanelArea) / 1e6),
      /* Obračun: `chargedSheets` je ono što se NAPLAĆUJE (pola ploče za grupe
         manje od cijele), a `sheetCount` je ono što algoritam stvarno reže.
         Za grupe koje stanu u jednu ploču to je 0,5 vs 1 — pola ploče se plaća,
         a ostatak ide u zalihe. */
      chargedSheets: consumption.sheets,
      chargedAreaM2: r1((consumption.sheets * sheetAreaMm2) / 1e6),
      fractionOfSheet: r1(consumption.fractionOfSheet * 1000) / 10,
      pricePerM2: priceM2,
      pricePerSheet,
      materialCost: r1(consumption.sheets * pricePerSheet * 100) / 100,
      netAreaCost: r1((totalPanelArea / 1e6) * priceM2 * 100) / 100,
    });
  });

  // Najviše ploča prvi — to je ono što pogon prvo gleda.
  out.sort((a, b) => b.sheetCount - a.sheetCount || b.panelCount - a.panelCount);
  return out;
}

/** Sažetak za prikaz: ukupno ploča, ukupno iskorištenje, otpad. */
export function summarizePlan(plan) {
  const sheets = plan.reduce((n, g) => n + g.sheetCount, 0);
  const panels = plan.reduce((n, g) => n + g.panelCount, 0);
  const panelArea = plan.reduce((n, g) => n + g.panelAreaM2, 0);
  const sheetArea = plan.reduce((n, g) => n + g.sheetAreaM2, 0);
  const unfit = plan.reduce((n, g) => n + g.unfit.length, 0);
  return {
    groups: plan.length,
    sheets,
    panels,
    panelAreaM2: r1(panelArea),
    sheetAreaM2: r1(sheetArea),
    utilization: sheetArea > 0 ? r1((panelArea / sheetArea) * 1000) / 10 : 0,
    wasteM2: r1(Math.max(0, sheetArea - panelArea)),
    unfit,
  };
}

/**
 * CSV izvoz plana krojenja — za softver u pogonu ili za ručnu kontrolu.
 * Jedan red po panelu, sa pozicijom na ploči.
 */
export function planToCSV(plan) {
  const head = ['Materijal', 'Tip ploce', 'Deb', 'Ploca', 'Poz_X', 'Poz_Y', 'Sirina', 'Visina',
    'Rotirano', 'Panel', 'Element'];
  const lines = [head.join(';')];
  plan.forEach((g) => {
    g.sheets.forEach((sheet) => {
      sheet.shelves.forEach((shelf) => {
        shelf.items.forEach((it) => {
          lines.push([
            g.materialLabel || g.material, g.boardTypeLabel || g.boardType, g.thicknessMm, sheet.index + 1,
            it.x, it.y, it.w, it.h, it.rotated ? 'da' : 'ne',
            it.label || it.id, it.element || '',
          ].map(csvCell).join(';'));
        });
      });
    });
    g.unfit.forEach((it) => {
      lines.push([g.materialLabel || g.material, g.boardTypeLabel || g.boardType, g.thicknessMm,
        'NE STAJE', '-', '-', it.w, it.h,
        it.rotated ? 'da' : 'ne', it.label || it.id, it.element || ''].map(csvCell).join(';'));
    });
  });
  return lines.join('\n');
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
