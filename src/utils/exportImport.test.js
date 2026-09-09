/**
 * @vitest-environment jsdom
 */
// src/utils/exportImport.test.js
//
// Projekti su živjeli ISKLJUČIVO u localStorage: promjena preglednika, čišćenje
// keša ili drugi računar = gubitak svih projekata, bez upozorenja. Izvoz u JSON
// to rješava, a uvoz mora prolaziti kroz istu normalizaciju kao i učitavanje iz
// localStorage-a, pa stariji ili oštećeni fajl ne smije srušiti aplikaciju.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../utils/storage.js';
import { createPlaced } from '../data/catalog';
import { DEFAULT_PROJECT } from '../data/projectDefaults';
import {
  safeFilename, projectToJSON, importProjectFromJSON,
  downloadCSV, downloadFile, offerToHTML,
  EXPORT_FORMAT, EXPORT_VERSION,
} from './exportImport';
import { computeBOM, bomToCSV } from '../engine/bom';
import { resolveProject } from '../engine/layout';
import { projectTotals } from '../engine/pricing';

const ROOM = { width: 5600, depth: 3600, height: 2600 };

const primjer = () => ({
  ...DEFAULT_PROJECT(),
  name: 'Hadžić — ponuda 3',
  elements: [
    createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0),
    createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 600),
  ],
});

describe('safeFilename', () => {
  it('uklanja znakove koji nisu dozvoljeni u imenima datoteka', () => {
    // `:` `/` `*` → `-`, razmaci → `_`, bez vodećih/završnih crta
    expect(safeFilename('Kuhinja: Hadžić/ponuda *3*')).toBe('Kuhinja_Hadžić-ponuda_3.json');
    expect(safeFilename('a\\b?c<d>e|f"g')).toBe('a-b-c-d-e-f-g.json');
  });

  it('višestruke razmake i donje crte svodi na jednu', () => {
    expect(safeFilename('a    b___c')).toBe('a_b_c.json');
  });

  it('prazan naziv daje razumnu default vrijednost', () => {
    expect(safeFilename('')).toBe('projekat.json');
    expect(safeFilename('   ')).toBe('projekat.json');
    expect(safeFilename(null)).toBe('projekat.json');
  });

  it('poštuje zadatu ekstenziju i ne duplira je', () => {
    expect(safeFilename('krojna', 'csv')).toBe('krojna.csv');
    expect(safeFilename('krojna.csv', 'csv')).toBe('krojna.csv');
  });
});

describe('izvoz → uvoz (round-trip)', () => {
  it('projekt preživi cijeli krug netaknut', () => {
    const p = primjer();
    const json = JSON.stringify(projectToJSON(ROOM, p));
    const res = importProjectFromJSON(json);

    expect(res.ok).toBe(true);
    expect(res.name).toBe('Hadžić — ponuda 3');
    expect(res.room).toEqual(ROOM);
    expect(res.project.elements).toHaveLength(2);
    expect(res.project.elements[0].instanceId).toBe(p.elements[0].instanceId);
    expect(res.project.elements[0].offset).toBe(0);
    expect(res.project.elements[1].offset).toBe(600);
    expect(res.project.worktopDecorId).toBe(p.worktopDecorId);
    expect(res.notes).toHaveLength(0);
  });

  it('prihvata i „goli" oblik brzog snimka { room, project }', () => {
    const res = importProjectFromJSON(JSON.stringify({ room: ROOM, project: primjer() }));
    expect(res.ok).toBe(true);
    expect(res.project.elements).toHaveLength(2);
  });

  it('prihvata i imenovani oblik { name, room, project, savedAt }', () => {
    const res = importProjectFromJSON(JSON.stringify({
      name: 'StaraPonuda', room: ROOM, project: primjer(), savedAt: '2026-01-01T00:00:00Z',
    }));
    expect(res.ok).toBe(true);
    expect(res.name).toBe('StaraPonuda');
  });

  it('označava format i verziju radi budućih migracija', () => {
    const d = projectToJSON(ROOM, primjer());
    expect(d.format).toBe(EXPORT_FORMAT);
    expect(d.formatVersion).toBe(EXPORT_VERSION);
    expect(d.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('uvoz odbija neispravne datoteke — bez pada aplikacije', () => {
  it('prazna datoteka', () => {
    expect(importProjectFromJSON('').ok).toBe(false);
    expect(importProjectFromJSON('   ').ok).toBe(false);
    expect(importProjectFromJSON(null).ok).toBe(false);
  });

  it('nije JSON', () => {
    const r = importProjectFromJSON('ovo nije json {');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/nije ispravan JSON/);
  });

  it('nema polje "project"', () => {
    const r = importProjectFromJSON(JSON.stringify({ room: ROOM, nesto: 1 }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/nema polje "project"/);
  });

  it('nepoznat format', () => {
    const r = importProjectFromJSON(JSON.stringify({
      format: 'neki-drugi-program/projekat', formatVersion: 1, room: ROOM, project: primjer(),
    }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Nepoznat format/);
  });

  it('datoteka iz NOVIJE verzije programa se odbija (ne pokušava se nagadjati)', () => {
    const r = importProjectFromJSON(JSON.stringify({
      format: EXPORT_FORMAT, formatVersion: EXPORT_VERSION + 1, room: ROOM, project: primjer(),
    }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/novije verzije/);
  });

  it('stari projekat sa izbačenim tipom elementa se normalizuje uz napomenu', () => {
    const p = primjer();
    p.elements.push({
      instanceId: 'el_stari', templateId: 'D-TIP-IZ-2019', wall: 'top', offset: 1500,
      dims: { width: 600, height: 720, depth: 550 },
      corpus: { decorId: 'W1000', thicknessMm: 18 }, front: { decorId: 'W1000', thicknessMm: 18 },
      back: { thicknessMm: 3 },
    });
    const r = importProjectFromJSON(JSON.stringify({ room: ROOM, project: p }));
    expect(r.ok).toBe(true);
    expect(r.project.elements).toHaveLength(2);          // treći je odbačen
    expect(r.notes.join(' ')).toMatch(/D-TIP-IZ-2019/);
  });

  it('stari projekat sa nepoznatim dekorom se normalizuje', () => {
    const p = primjer();
    p.worktopDecorId = 'DEKOR_KOJI_VISE_NE_POSTOJI';
    const r = importProjectFromJSON(JSON.stringify({ room: ROOM, project: p }));
    expect(r.ok).toBe(true);
    expect(r.project.worktopDecorId).not.toBe('DEKOR_KOJI_VISE_NE_POSTOJI');
    expect(r.notes.join(' ')).toMatch(/DEKOR_KOJI_VISE_NE_POSTOJI/);
  });

  it('neispravna prostorija u datoteci pada na default', () => {
    const r = importProjectFromJSON(JSON.stringify({ room: { width: 0, depth: 'x' }, project: primjer() }));
    expect(r.ok).toBe(true);
    expect(r.room.width).toBeGreaterThan(1000);
    expect(r.notes.join(' ')).toMatch(/prostorije/);
  });

  it('uvezeni projekat se može dalje računati (BOM, cijena)', () => {
    const r = importProjectFromJSON(JSON.stringify(projectToJSON(ROOM, primjer())));
    expect(r.ok).toBe(true);
    const rp = resolveProject(r.project, r.room);
    expect(() => computeBOM(rp, r.room)).not.toThrow();
    expect(() => projectTotals(rp, r.room)).not.toThrow();
    expect(projectTotals(rp, r.room).net).toBeGreaterThan(0);
  });
});

describe('preuzimanje datoteka', () => {
  beforeEach(() => {
    // jsdom nema URL.createObjectURL — dovoljno je stub-ovati ga za test.
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:mock');
      URL.revokeObjectURL = vi.fn();
    }
  });

  it('downloadFile pravi <a download> i klikne ga', () => {
    const klikovi = [];
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { klikovi.push(this.download); };
    try {
      downloadFile('sadržaj', 'test.json');
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
    }
    expect(klikovi).toEqual(['test.json']);
  });

  it('downloadCSV dodaje UTF-8 BOM (Excel bez njega lomi šđčćž)', () => {
    let sadrzaj = null;
    const origCreate = globalThis.Blob;
    globalThis.Blob = class extends origCreate {
      constructor(parts, opts) { super(parts, opts); sadrzaj = parts.join(''); }
    };
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};
    try {
      downloadCSV('a;b;c', 'krojna');
    } finally {
      globalThis.Blob = origCreate;
      HTMLAnchorElement.prototype.click = origClick;
    }
    expect(sadrzaj.charCodeAt(0)).toBe(0xFEFF);
    expect(sadrzaj).toContain('a;b;c');
  });
});

describe('CSV krojne liste', () => {
  it('bomToCSV daje ispravne zaglavlja i redove', () => {
    const rp = resolveProject(primjer(), ROOM);
    const csv = bomToCSV(computeBOM(rp, ROOM));
    const linije = csv.split('\n');
    expect(linije[0]).toBe('Poz;Element;Panel;Kom;Materijal;Deb;Kroj D;Kroj S;Gotovo D;Gotovo S;L1;L2;W1;W2;Tekstura');
    expect(csv).toContain('RUBNE TRAKE;duzni metri');
    expect(csv).toContain('ALU LAJSNE;duzni metri');
    expect(csv).toMatch(/OKOV;kolicina;jedinica/);
    expect(linije.length).toBeGreaterThan(10);
  });
});

describe('ponuda za štampu (PDF preko sistemskog dijaloga)', () => {
  it('HTML sadrži sve stavke, ukupni iznos i @page pravilo za A4', () => {
    const p = primjer();
    const rp = resolveProject(p, ROOM);
    const totals = projectTotals(rp, ROOM);
    const rows = rp.elements.map((el, i) => ({
      pos: i + 1, element: el.templateId, dims: `${el.dims.width}`, net: 100 + i,
    }));
    const html = offerToHTML({ project: rp, room: ROOM, totals, rows });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('lang="bs"');
    expect(html).toContain('@page');
    expect(html).toContain('Hadžić — ponuda 3');
    expect(html).toContain('window.print()');
    rows.forEach((r) => expect(html).toContain(String(r.pos)));
    expect(html).toContain('PDV 17%');
  });

  it('escapuje HTML u nazivima (dekor sa <script> ne prolazi)', () => {
    const p = primjer();
    p.name = '<script>alert(1)</script>';
    const html = offerToHTML({
      project: p, room: ROOM,
      totals: { net: 1, vat: 2, gross: 3, parts: {} }, rows: [],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
