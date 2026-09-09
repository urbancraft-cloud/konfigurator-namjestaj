// src/engine/cutting.test.js
//
// Optimizacija krojenja mora zadovoljiti tvrda svojstva, ne samo „izgledati
// razumno": nijedan panel se ne smije preklapati, nijedan ne smije izlaziti van
// ploče, panel sa teksturom se ne smije rotirati, a svaki panel iz krojne liste
// mora biti raspoređen tačno jednom. Zato su ovdje i testovi svojstava
// (property-based) nad nasumičnim ulazima, ne samo fiksni primjeri.

import { describe, it, expect } from 'vitest';
import { optimizeCutList, packRects, summarizePlan, planToCSV } from './cutting';
import { computeBOM } from './bom';
import { resolveProject } from './layout';
import { createPlaced } from '../data/catalog';
import { sheetFor, SAW_KERF_MM } from '../data/tech';

const ROOM = { width: 5600, depth: 3600, height: 2600 };
const BASE = {
  name: 'test', worktopDecorId: 'H1180', worktopDepthMm: 600, wallPanelDecorId: 'H1180',
  wallPanelHeightMm: 600, socleDecorId: 'U963', topMaskDecorId: 'H1180', endPanelDecorId: 'H1180',
  services: [], activeWalls: ['top', 'left', 'bottom', 'right'], legHeightMm: 150,
  ledMask: true, wallPanelOn: true, wallPanelThicknessMm: 10,
  endPanelMode: 'auto', endPanelSizes: {}, topMaskHeightMm: 100, obstacles: [], cooktops: [],
};
const bomZa = (elements) => computeBOM(resolveProject({ ...BASE, elements }, ROOM), ROOM);

describe('sheetFor — format ploče po debljini', () => {
  it('poznate debljine daju tačan format', () => {
    expect(sheetFor(18).widthMm).toBe(2800);
    expect(sheetFor(18).heightMm).toBe(2070);
    expect(sheetFor(38).widthMm).toBe(4100);       // radne ploče
    expect(sheetFor(3).grainLocksRotation).toBe(false);   // HDF leđa
  });

  it('nepoznata debljina pada na najbližu, ne na undefined', () => {
    [1, 5, 7, 19, 22, 40, 100].forEach((t) => {
      const s = sheetFor(t);
      expect(s.widthMm).toBeGreaterThan(0);
      expect(s.heightMm).toBeGreaterThan(0);
    });
  });
});

describe('packRects — osnovno ponašanje', () => {
  it('jedan panel ide na jednu ploču', () => {
    const r = packRects([{ id: 'a', w: 600, h: 720, rotatable: false }], 2800, 2070);
    expect(r.sheets).toHaveLength(1);
    expect(r.unfit).toHaveLength(0);
    expect(r.sheets[0].items).toEqual(['a']);
  });

  it('panel veći od ploče ide u unfit, ne ruši', () => {
    const r = packRects([{ id: 'ogroman', w: 5000, h: 720, rotatable: false }], 2800, 2070);
    expect(r.sheets).toHaveLength(0);
    expect(r.unfit).toHaveLength(1);
    expect(r.unfit[0].id).toBe('ogroman');
  });

  it('prazan ulaz daje prazan plan', () => {
    const r = packRects([], 2800, 2070);
    expect(r.sheets).toHaveLength(0);
    expect(r.unfit).toHaveLength(0);
  });

  it('paneli se ne preklapaju i ne izlaze van ploče', () => {
    const items = [];
    for (let i = 0; i < 40; i++) {
      items.push({ id: `p${i}`, w: 200 + (i * 37) % 600, h: 150 + (i * 53) % 700, rotatable: i % 3 === 0 });
    }
    const r = packRects(items, 2800, 2070, 4, 0);
    const placed = [];
    r.sheets.forEach((s) => s.shelves.forEach((sh) => sh.items.forEach((it) => placed.push({ sheet: s.index, ...it }))));

    expect(placed.length + r.unfit.length).toBe(items.length);

    placed.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(2800);
      expect(p.y + p.h).toBeLessThanOrEqual(2070);
    });

    // bez preklapanja unutar iste ploče
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i], b = placed[j];
        if (a.sheet !== b.sheet) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `preklapanje ${a.id} i ${b.id}`).toBe(false);
      }
    }
  });

  it('kerf se poštuje: dva panela u istoj polici nisu zalijepljena', () => {
    const r = packRects([
      { id: 'a', w: 500, h: 400, rotatable: false },
      { id: 'b', w: 500, h: 400, rotatable: false },
    ], 2800, 2070, 4, 0);
    const items = [];
    r.sheets.forEach((s) => s.shelves.forEach((sh) => sh.items.forEach((it) => items.push(it))));
    expect(items).toHaveLength(2);
    const razmak = items[1].x - (items[0].x + items[0].w);
    expect(razmak).toBe(SAW_KERF_MM);
  });

  it('margina (trim) pomjera sve od ruba ploče', () => {
    const r = packRects([{ id: 'a', w: 500, h: 400, rotatable: false }], 2800, 2070, 4, 10);
    const it = r.sheets[0].shelves[0].items[0];
    expect(it.x).toBe(10);
    expect(it.y).toBe(10);
  });

  it('iskorištenje je između 0 i 1', () => {
    const r = packRects([
      { id: 'a', w: 1000, h: 1000, rotatable: false },
      { id: 'b', w: 1000, h: 1000, rotatable: false },
    ], 2800, 2070);
    r.sheets.forEach((s) => {
      expect(s.utilization).toBeGreaterThan(0);
      expect(s.utilization).toBeLessThanOrEqual(1);
      expect(s.wasteMm2).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('optimizeCutList — na stvarnoj krojnoj listi', () => {
  const elementi = () => [
    createPlaced('D-UGAO-SLIJEPI', 'SERIJA_KUCANO', 'top', 0),
    createPlaced('D-SUDOPER', 'SERIJA_KUCANO', 'top', 1000),
    createPlaced('D-PECNICA', 'SERIJA_KUCANO', 'top', 1800),
    createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 2400),
    createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 3000),
    createPlaced('D-LADICE-4', 'SERIJA_KUCANO', 'top', 3600),
    createPlaced('V-ELEMENT', 'SERIJA_KUCANO', 'top', 1500),
    createPlaced('V-NAPA', 'SERIJA_KUCANO', 'top', 900),
    createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'bottom', 2000),
  ];

  it('svaki panel iz BOM-a je raspoređen tačno jednom', () => {
    const bom = bomZa(elementi());
    const plan = optimizeCutList(bom);
    const suma = summarizePlan(plan);

    const izBom = bom.rows.reduce((n, r) => {
      if (!(Number(r.cutL) > 0) || !(Number(r.cutW) > 0)) return n;
      return n + Math.max(1, Math.round(r.qty || 1));
    }, 0);

    // Raspoređeni + neraspoređeni = svi iz krojne liste (nijedan ne smije nestati)
    expect(suma.panels).toBe(izBom);

    /* `unfit` NIJE greška: neki komadi su duži od najvećeg dostupnog formata.
       Završna maska „od poda do plafona" je ~2620 mm, a radna ploča preko 4100 mm
       (`WORKTOP.maxPieceMm`) — takvi komadi se naručuju posebno. Optimizator ih
       mora PRIJAVITI, ne tiho progutati. */
    plan.forEach((g) => {
      g.unfit.forEach((u) => {
        const stane = (u.w <= g.sheet.widthMm && u.h <= g.sheet.heightMm)
          || (u.rotatable && u.h <= g.sheet.widthMm && u.w <= g.sheet.heightMm);
        expect(stane, `${u.label} ${u.w}×${u.h} na ploču ${g.sheet.widthMm}×${g.sheet.heightMm}`).toBe(false);
      });
    });
    // i da ih zaista ima koliko smo prijavili
    const unfitUkupno = plan.reduce((n, g) => n + g.unfit.length, 0);
    expect(unfitUkupno).toBe(suma.unfit);
  });

  it('grupe su po (tip ploče, debljina, dekor) — nema miješanja na istoj ploči', () => {
    const plan = optimizeCutList(bomZa(elementi()));
    const kljucevi = new Set();
    plan.forEach((g) => {
      expect(g.thicknessMm).toBeGreaterThan(0);
      expect(g.boardType).toBeTruthy();
      expect(g.decorId).toBeTruthy();
      expect(g.key).toBe(`${g.boardType}|${g.thicknessMm}|${g.decorId}`);
      kljucevi.add(g.key);
    });
    expect(kljucevi.size).toBe(plan.length);  // ključ je jedinstven po grupi
  });

  it('svaka grupa nosi format ploče i cijenu po ploči', () => {
    const plan = optimizeCutList(bomZa(elementi()));
    plan.forEach((g) => {
      expect(g.boardTypeLabel).toMatch(/\d+×\d+/);
      expect(g.pricePerM2).toBeGreaterThanOrEqual(0);
      expect(g.pricePerSheet).toBeGreaterThan(0);
      expect(g.materialCost).toBeGreaterThan(0);
      expect(g.chargedSheets).toBeGreaterThan(0);
    });
  });

  it('broj ploča je realan (manje od broja panela, više od 0)', () => {
    const plan = optimizeCutList(bomZa(elementi()));
    const suma = summarizePlan(plan);
    expect(suma.sheets).toBeGreaterThan(0);
    expect(suma.sheets).toBeLessThan(suma.panels);
    expect(suma.utilization).toBeGreaterThan(10);
    expect(suma.utilization).toBeLessThanOrEqual(100);
  });

  it('paneli SA teksturom nisu rotirani', () => {
    const plan = optimizeCutList(bomZa(elementi()));
    plan.forEach((g) => {
      g.sheets.forEach((s) => {
        s.shelves.forEach((sh) => {
          sh.items.forEach((it) => {
            expect(it.rotated).toBe(false);   // shelf packing ne rotira unutar police
          });
        });
      });
    });
  });

  it('iskorištenje po grupi je izračunato i u granicama', () => {
    const plan = optimizeCutList(bomZa(elementi()));
    plan.forEach((g) => {
      expect(typeof g.utilization).toBe('number');
      expect(g.utilization).toBeGreaterThanOrEqual(0);
      expect(g.utilization).toBeLessThanOrEqual(100);
      expect(g.panelAreaM2).toBeGreaterThan(0);
      expect(g.sheetAreaM2).toBeGreaterThanOrEqual(g.panelAreaM2);
      expect(g.wasteM2).toBeGreaterThanOrEqual(0);
    });
  });

  it('rezultat je DETERMINISTIČAN (isti ulaz → isti plan)', () => {
    const bom = bomZa(elementi());
    const a = JSON.stringify(optimizeCutList(bom));
    const b = JSON.stringify(optimizeCutList(bom));
    expect(a).toBe(b);
  });

  it('prazan projekat daje prazan plan, ne pad', () => {
    const bom = bomZa([]);
    expect(() => optimizeCutList(bom)).not.toThrow();
    expect(summarizePlan(optimizeCutList(bom)).panels).toBe(0);
  });

  it('opcije kerf i trim se poštuju', () => {
    const bom = bomZa(elementi());
    const a = optimizeCutList(bom, { kerfMm: 0, trimMm: 0 });
    const b = optimizeCutList(bom, { kerfMm: 10, trimMm: 20 });
    expect(a[0].kerfMm).toBe(0);
    expect(b[0].kerfMm).toBe(10);
    expect(b[0].trimMm).toBe(20);
    /* NAMJERNO ne tvrdimo „veći kerf = više ploča": shelf packing nije monotona
       heuristika, pa se raspored polica presloži i broj ploča može i pasti.
       Ono što MORA važiti je da su svi paneli i dalje raspoređeni ili prijavljeni. */
    const sa = summarizePlan(a), sb = summarizePlan(b);
    expect(sb.panels).toBe(sa.panels);
    expect(sb.sheets).toBeGreaterThan(0);
    expect(sb.utilization).toBeGreaterThan(0);
    expect(sb.utilization).toBeLessThanOrEqual(100);
  });

  it('includeSurfaces:false izbacuje radne ploče i obloge', () => {
    const bom = bomZa(elementi());
    const sa = summarizePlan(optimizeCutList(bom, { includeSurfaces: true }));
    const bez = summarizePlan(optimizeCutList(bom, { includeSurfaces: false }));
    expect(bez.panels).toBeLessThan(sa.panels);
  });
});

describe('CSV izvoz plana krojenja', () => {
  it('ima zaglavlje i po jedan red po panelu', () => {
    const bom = bomZa([createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0)]);
    const plan = optimizeCutList(bom);
    const csv = planToCSV(plan);
    const linije = csv.split('\n');
    expect(linije[0]).toBe('Materijal;Tip ploce;Deb;Ploca;Poz_X;Poz_Y;Sirina;Visina;Rotirano;Panel;Element');
    const suma = summarizePlan(plan);
    expect(linije.length - 1).toBe(suma.panels + suma.unfit);
  });

  it('naziv sa tačkom-zarezom ne razbija kolone', () => {
    const plan = [{
      material: 'Iverica; specijalna', materialLabel: 'Iverica; specijalna',
      boardType: 'iverica', boardTypeLabel: 'Iverica 2800×2070',
      thicknessMm: 18, sheetCount: 1, panelCount: 1, unfit: [],
      sheets: [{ index: 0, shelves: [{ items: [{ id: 'x', label: 'Bok; lijevi', x: 0, y: 0, w: 100, h: 100, rotated: false, element: 'D1' }] }] }],
    }];
    const csv = planToCSV(plan);
    expect(csv).toContain('"Iverica; specijalna"');
    expect(csv).toContain('"Bok; lijevi"');
  });
});

describe('property-based: nasumični paneli nikad ne prekrše ograničenja', () => {
  it('200 nasumičnih konfiguracija', () => {
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

    for (let pokus = 0; pokus < 200; pokus++) {
      const n = 1 + Math.floor(rnd() * 30);
      const items = Array.from({ length: n }, (_, i) => ({
        id: `i${i}`,
        w: 100 + Math.floor(rnd() * 1200),
        h: 100 + Math.floor(rnd() * 1000),
        rotatable: rnd() > 0.5,
      }));
      const sheetW = [2800, 2070, 4100][Math.floor(rnd() * 3)];
      const sheetH = [2070, 600, 2800][Math.floor(rnd() * 3)];
      const kerf = [0, 4, 6][Math.floor(rnd() * 3)];

      const r = packRects(items, sheetW, sheetH, kerf, 0);
      const placed = [];
      r.sheets.forEach((s) => s.shelves.forEach((sh) => sh.items.forEach((it) => placed.push({ sheet: s.index, ...it }))));

      // 1) svi paneli su negdje: raspoređeni ili označeni kao nemogući
      expect(placed.length + r.unfit.length).toBe(items.length);

      // 2) svaki je unutar ploče
      placed.forEach((p) => {
        expect(p.x, `x od ${p.id}`).toBeGreaterThanOrEqual(0);
        expect(p.y, `y od ${p.id}`).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w, `${p.id} izlazi desno`).toBeLessThanOrEqual(sheetW);
        expect(p.y + p.h, `${p.id} izlazi dolje`).toBeLessThanOrEqual(sheetH);
      });

      // 3) bez preklapanja
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i], b = placed[j];
          if (a.sheet !== b.sheet) continue;
          const preklapa = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(preklapa, `pokus ${pokus}: ${a.id} × ${b.id}`).toBe(false);
        }
      }

      // 4) unfit su stvarno preveliki
      r.unfit.forEach((u) => {
        const moze = (u.w <= sheetW && u.h <= sheetH) || (u.rotatable && u.h <= sheetW && u.w <= sheetH);
        expect(moze, `pokus ${pokus}: ${u.id} ${u.w}×${u.h} označen kao unfit a staje na ${sheetW}×${sheetH}`).toBe(false);
      });
    }
  });
});
