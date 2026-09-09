// src/engine/bom.test.js
import { describe, it, expect } from 'vitest';
import { computeBOM, bomToCSV, csvField } from './bom';
import { resolveProject, validateTriangle } from './layout';
import { createPlaced } from '../data/catalog';

const ROOM = { width: 5600, depth: 3600, height: 2600 };
const BASE = {
  name: 'test', worktopDecorId: 'H1180', worktopDepthMm: 600, wallPanelDecorId: 'H1180',
  wallPanelHeightMm: 600, socleDecorId: 'U963', topMaskDecorId: 'H1180', endPanelDecorId: 'H1180',
  services: [], activeWalls: ['top', 'left', 'bottom', 'right'], legHeightMm: 150,
  ledMask: true, wallPanelOn: true, wallPanelThicknessMm: 10,
  endPanelMode: 'auto', endPanelSizes: {}, topMaskHeightMm: 100, obstacles: [], cooktops: [],
};
const kuhinja = () => resolveProject({
  ...BASE,
  elements: [
    createPlaced('D-UGAO-SLIJEPI', 'SERIJA_KUCANO', 'top', 0),
    createPlaced('D-SUDOPER', 'SERIJA_KUCANO', 'top', 1000),
    createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 2400),
    createPlaced('V-ELEMENT', 'SERIJA_KUCANO', 'top', 1500),
    createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'bottom', 2000),
  ],
}, ROOM);

describe('csvField — escaping separatora', () => {
  it('običan tekst ostaje kakav jest', () => {
    expect(csvField('Bok')).toBe('Bok');
    expect(csvField(18)).toBe('18');
  });

  it('polje sa separatorom ide u navodnike', () => {
    expect(csvField('ABS 0,8 × 23; laser')).toBe('"ABS 0,8 × 23; laser"');
  });

  it('ugrađeni navodnici se dupliciraju (RFC 4180)', () => {
    expect(csvField('Rekao "dobar" dan')).toBe('"Rekao ""dobar"" dan"');
  });

  it('novi red i null vrijednost', () => {
    expect(csvField('a\nb')).toBe('"a\nb"');
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });
});

describe('bomToCSV', () => {
  it('broj kolona je isti u svakom redu (separator ne razbija tabelu)', () => {
    const csv = bomToCSV(computeBOM(kuhinja(), ROOM));
    const redovi = csv.split('\n').filter((l) => l.trim() !== '');
    const brojPolja = (l) => {
      // ispravno brojanje polja uz quoted sekcije
      let n = 1, uNavodnicima = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') uNavodnicima = !uNavodnicima;
        else if (c === ';' && !uNavodnicima) n++;
      }
      return n;
    };
    const head = brojPolja(redovi[0]);
    expect(head).toBe(15);
    // Redovi panela moraju imati isti broj polja kao zaglavlje
    const panelRedovi = redovi.slice(1).filter((l) => /^\d+;/.test(l));
    expect(panelRedovi.length).toBeGreaterThan(0);
    panelRedovi.forEach((l) => expect(brojPolja(l)).toBe(head));
  });

  it('naziv dekora sa tačkom-zarezom ne pomjera kolone', () => {
    const bom = computeBOM(kuhinja(), ROOM);
    bom.rows[0].material = 'Iverica; specijalna "serija"';
    const csv = bomToCSV(bom);
    const prvi = csv.split('\n')[1];
    expect(prvi).toContain('"Iverica; specijalna ""serija"""');
  });

  it('nepoznat id rubne trake ili lajsne ne ruši izvoz', () => {
    const bom = computeBOM(kuhinja(), ROOM);
    bom.bandTotals.NEKA_CUDNA_TRAKA = 3.5;
    bom.profileMeters.NEKA_CUDNA_LAJSNA = 2.1;
    let csv;
    expect(() => { csv = bomToCSV(bom); }).not.toThrow();
    expect(csv).toContain('NEKA_CUDNA_TRAKA');
    expect(csv).toContain('NEKA_CUDNA_LAJSNA');
  });

  it('okov u CSV-u ima jedinicu (m/kom/set)', () => {
    const e = createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0);
    e.handleId = 'GOLA_C';
    const p = resolveProject({ ...BASE, elements: [e] }, ROOM);
    const csv = bomToCSV(computeBOM(p, ROOM));
    expect(csv).toMatch(/OKOV;kolicina;jedinica/);
    expect(csv).toMatch(/metraža.*;[\d.]+;m/);
  });
});

describe('validateTriangle — zbir krakova (bio NaN)', () => {
  /* Ključ u objektu `legs` bio je `frizidercSudoper` (tipfeler, višak "c"), a
     `sum` ga je čitao kao `friziderSudoper` → `undefined` → NaN. Posljedica:
     `badSum` je uvijek bio false jer su sve poredbene sa NaN false, pa kontrola
     zbira krakova (4,0–7,9 m) UOPŠTE NIJE RADILA. */
  const tacka = (x, z) => ({ x, z });

  it('zbir je konačan broj', () => {
    const t = validateTriangle(tacka(0, 0), tacka(2000, 0), tacka(0, 2000));
    expect(Number.isFinite(t.sum)).toBe(true);
    expect(t.sum).toBe(2000 + Math.round(Math.hypot(2000, 2000)) + 2000);
  });

  it('ključevi su konzistentni (nema više "frizidercSudoper")', () => {
    const t = validateTriangle(tacka(0, 0), tacka(2000, 0), tacka(0, 2000));
    expect(Object.keys(t.legs).sort()).toEqual(['friziderSudoper', 'plocaFrizider', 'sudoperPloca']);
  });

  it('zbir se stvarno računa i ulazi u odluku (ranije je bio NaN pa provjera zbira NIJE radila)', () => {
    const t = validateTriangle(tacka(0, 0), tacka(2000, 0), tacka(0, 2000));
    // 2000 + 2828 + 2000 = 6828 → unutar 4000–7900, ali krak 2828 > 2700
    expect(t.sum).toBe(6828);
    expect(t.sum).toBeGreaterThanOrEqual(4000);
    expect(t.sum).toBeLessThanOrEqual(7900);
    expect(t.ok).toBe(false);
    expect(t.reason).toMatch(/krak izvan/);       // krak je sad prioritetniji razlog
  });

  it('svi krakovi u normi → trokut je važeći', () => {
    const t = validateTriangle(tacka(0, 0), tacka(1800, 0), tacka(0, 1800));
    expect(t.legs.plocaFrizider).toBe(2546);
    expect(t.sum).toBe(1800 + 2546 + 1800);
    expect(t.ok).toBe(true);
  });

  /* Napomena: gornja granica zbira (7900 mm) je u praksi nedostićna — zbir tri
     kraka od kojih je svaki ≤ 2700 mm ne može preći 8100 mm, a kod pravouglog
     rasporeda hipotenuza uvijek prije probije granicu po kraku. Donja granica
     (4000 mm) je dostižna samo u rasporedu u istoj liniji. Zato se u realnim
     kuhinjama javlja „krak izvan 1,2–2,7 m", a ne „zbir izvan". */
  it('degenerisan raspored (sve u istoj tački) je nevažeći, bez NaN', () => {
    const t = validateTriangle(tacka(0, 0), tacka(0, 0), tacka(0, 0));
    expect(t.sum).toBe(0);
    expect(t.ok).toBe(false);
    expect(t.reason).toMatch(/krak izvan/);
  });

  it('ispravan trokut prolazi', () => {
    const t = validateTriangle(tacka(0, 0), tacka(1800, 0), tacka(0, 1800));
    expect(t.legs.sudoperPloca).toBe(1800);
    expect(t.legs.friziderSudoper).toBe(1800);
    expect(t.sum).toBeLessThan(7900);
    expect(t.sum).toBeGreaterThan(4000);
    expect(t.ok).toBe(true);
    expect(t.reason).toBeNull();
  });

  it('nepotpun trokut (nedostaje aparat) je nevažeći, ne NaN', () => {
    const t = validateTriangle(tacka(0, 0), null, tacka(0, 2000));
    expect(t.ok).toBe(false);
    expect(t.reason).toMatch(/nepotpun/);
    expect(t.sum).toBe(0);
  });
});
