// src/utils/projectSchema.test.js
import { describe, it, expect } from 'vitest';
import { normalizeProject, normalizeWardrobe } from './projectSchema';
import { PRICE_LIST } from '../data/decors';
import { createPlaced } from '../data/catalog';
import { computeBOM } from '../engine/bom';
import { validateElement } from '../engine/validation';

const ROOM = { width: 5600, depth: 3600, height: 2600 };

describe('normalizeProject — migracija starijih sačuvanih projekata', () => {
  it('nedostajuća polja dekora dobijaju default (BUG-05: computeBOM je bacao TypeError)', () => {
    const stari = { elements: [], obstacles: [], services: [] };   // bez ijednog decorId
    const { project } = normalizeProject(stari, ROOM);
    expect(project.worktopDecorId).toBeTruthy();
    expect(project.socleDecorId).toBeTruthy();
    expect(() => computeBOM(project, ROOM)).not.toThrow();
  });

  it('projekat bez ikakvih podataka ne ruši', () => {
    expect(() => normalizeProject(undefined, undefined)).not.toThrow();
    expect(() => normalizeProject(null, null)).not.toThrow();
    expect(() => normalizeProject({}, {})).not.toThrow();
    const { project, room } = normalizeProject(null, null);
    expect(Array.isArray(project.elements)).toBe(true);
    expect(room.width).toBeGreaterThan(0);
  });

  it('element sa tipom koji nije u katalogu se odbaci i prijavi (BUG-03)', () => {
    const e = createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0);
    e.templateId = 'D-STARI-TIP-IZ-2019';
    const { project, notes } = normalizeProject({ elements: [e] }, ROOM);
    expect(project.elements).toHaveLength(0);
    expect(notes.join(' ')).toMatch(/nije u katalogu/);
    expect(notes.join(' ')).toMatch(/D-STARI-TIP-IZ-2019/);
  });

  it('ispravni elementi preživljavaju normalizaciju netaknuti', () => {
    const e = createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 1234);
    const { project, notes } = normalizeProject({ elements: [e] }, ROOM);
    expect(project.elements).toHaveLength(1);
    expect(project.elements[0].offset).toBe(1234);
    expect(project.elements[0].instanceId).toBe(e.instanceId);
    // Jedina napomena je ona o cjenovniku (projekat ga nema jer je star)
    expect(notes.filter((n) => !/cjenovnik/i.test(n))).toHaveLength(0);
  });

  it('projekt bez oznake cjenovnika dobija napomenu i trenutnu oznaku', () => {
    const { project, notes } = normalizeProject({ elements: [] }, ROOM);
    expect(notes.join(' ')).toMatch(/nije imao oznaku cjenovnika/);
    expect(project.priceList.label).toBe(PRICE_LIST.label);
  });

  it('projekt rađen po DRUGOM cjenovniku to javlja (ponuda mora biti reproducible)', () => {
    const stari = { elements: [], priceList: { source: 'ELGRAD', kind: 'MPC', effective: '2025-01-15', label: 'ELGRAD MPC 15.01.2025.' } };
    const { project, notes } = normalizeProject(stari, ROOM);
    expect(notes.join(' ')).toMatch(/ELGRAD MPC 15\.01\.2025/);
    expect(notes.join(' ')).toMatch(/preračunati po novom/);
    // Originalna oznaka se ČUVA — ne prepisuje se trenutnom
    expect(project.priceList.label).toBe('ELGRAD MPC 15.01.2025.');
  });

  it('projekt sa istim cjenovnikom ne dobija napomenu o cjenovniku', () => {
    const { notes } = normalizeProject({ elements: [], priceList: { ...PRICE_LIST } }, ROOM);
    expect(notes.filter((n) => /cjenovnik/i.test(n))).toHaveLength(0);
  });

  it('nepoznat dekor se zamijeni i prijavi', () => {
    const e = createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0);
    e.front.decorId = 'W9999_NE_POSTOJI';
    const { project, notes } = normalizeProject({ elements: [e] }, ROOM);
    expect(project.elements[0].front.decorId).not.toBe('W9999_NE_POSTOJI');
    expect(notes.join(' ')).toMatch(/W9999_NE_POSTOJI/);
  });

  it('nepoznat dekor na nivou projekta se vrati na default', () => {
    const { project, notes } = normalizeProject({ worktopDecorId: 'NE_MA_GA' }, ROOM);
    expect(project.worktopDecorId).toBe('H1180');
    expect(notes.join(' ')).toMatch(/NE_MA_GA/);
  });

  it('nevažeće numeričko polje se vrati na default', () => {
    const { project, notes } = normalizeProject({ legHeightMm: 'abc' }, ROOM);
    expect(project.legHeightMm).toBe(150);
    expect(notes.join(' ')).toMatch(/legHeightMm/);
  });

  it('nevažeći zid elementa pada na "top", ne ruši geometriju', () => {
    const e = createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0);
    e.wall = 'sjever';
    const { project } = normalizeProject({ elements: [e] }, ROOM);
    expect(project.elements[0].wall).toBe('top');
  });

  it('nevažeća prostorija se vrati na default i prijavi', () => {
    const { room, notes } = normalizeProject({}, { width: 0, depth: 'x', height: -5 });
    expect(room).toEqual({ width: 5600, depth: 3600, height: 2600 });
    expect(notes.join(' ')).toMatch(/prostorije/);
  });

  it('string umjesto niza ne ruši', () => {
    const { project } = normalizeProject({ elements: 'nije-niz', obstacles: 42 }, ROOM);
    expect(project.elements).toEqual([]);
    expect(project.obstacles).toEqual([]);
  });

  it('normalizovan projekat prolazi kroz computeBOM i validaciju', () => {
    const els = [
      createPlaced('D-UGAO-SLIJEPI', 'SERIJA_KUCANO', 'top', 0),
      createPlaced('D-SUDOPER', 'SERIJA_KUCANO', 'top', 1000),
      createPlaced('V-ELEMENT', 'SERIJA_KUCANO', 'top', 1500),
    ];
    const { project } = normalizeProject({ elements: els }, ROOM);
    expect(() => computeBOM(project, ROOM)).not.toThrow();
    project.elements.forEach((e) => {
      expect(() => validateElement(e)).not.toThrow();
    });
  });

  it('odbaceni elementi povlače i svoje ručne izmjene završnih maski', () => {
    const e = createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0);
    e.templateId = 'D-OBRISAN-TIP';
    const { project, notes } = normalizeProject({
      elements: [e],
      endPanelSizes: { [`zm_base_1_start`]: { lengthMm: 900 }, [`ručno_${e.instanceId}_x`]: { lengthMm: 800 } },
    }, ROOM);
    expect(Object.keys(project.endPanelSizes)).not.toContain(`ručno_${e.instanceId}_x`);
    expect(notes.join(' ')).toMatch(/završnih maski/);
  });
});

describe('validateElement — nepoznat tip se prijavi, ne sruši (BUG-03)', () => {
  it('element sa izbačenim tipom je nevažeći sa jasnom porukom', () => {
    const e = createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0);
    e.templateId = 'D-NE-POSTOJI';
    const v = validateElement(e);
    expect(v.valid).toBe(false);
    expect(v.errors.join(' ')).toMatch(/nije u katalogu/);
  });

  it('ispravan element i dalje prolazi', () => {
    const v = validateElement(createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0));
    expect(v.valid).toBe(true);
  });
});

describe('normalizeWardrobe', () => {
  it('prazan ulaz daje upotrebljiv ormar sa napomenom', () => {
    const { wardrobe, notes } = normalizeWardrobe(null, null);
    expect(wardrobe.segments.length).toBeGreaterThan(0);
    expect(notes.length).toBeGreaterThan(0);
  });

  it('segmenti bez items dobijaju prazan niz', () => {
    const { wardrobe } = normalizeWardrobe({ segments: [{ id: 'seg_1' }, null, {}] }, ROOM);
    wardrobe.segments.forEach((s) => {
      expect(Array.isArray(s.lower.items)).toBe(true);
      expect(Array.isArray(s.upper.items)).toBe(true);
    });
  });

  it('nepoznat dekor se označi, ne ruši', () => {
    const { wardrobe, notes } = normalizeWardrobe({ corpusDecorId: 'NE_MA_GA', segments: [] }, ROOM);
    expect(wardrobe.corpusDecorId).toBeNull();
    expect(notes.join(' ')).toMatch(/NE_MA_GA/);
  });

  /* -----------------------------------------------------------------------
     Migracija sa STAROG modela ormara

     Stari zapis: `heightMm` = ukupna visina ORMARA, donji korpus fiksan 2000,
     nema bočnih maski, nema ručno prepisive visine vrata.
     Novi zapis: `roomHeightMm` = visina PROSTORA, donji korpus je ulaz (1950),
     gornji korpus izveden, bočne maske van korpusa.
  ----------------------------------------------------------------------- */
  it('stari snimak sa heightMm se prebacuje na roomHeightMm uz napomenu', () => {
    const { wardrobe, notes } = normalizeWardrobe({
      heightMm: 2500, widthMm: 2400, depthMm: 580, legHeightMm: 100,
      doorType: 'baglame', segmentCount: 3,
      segments: [{ id: 'seg_1', lower: { items: [] }, upper: { items: [] } }],
    }, ROOM);
    expect(wardrobe.roomHeightMm).toBe(2500);
    expect(wardrobe.heightMm).toBeUndefined();        // staro polje je uklonjeno
    expect(wardrobe.lowerCorpusHeightMm).toBe(1950);
    expect(wardrobe.topMaskHeightMm).toBe(100);
    expect(notes.join(' ')).toMatch(/starom modelu/);
  });

  it('bez visine se uzima visina prostorije', () => {
    const { wardrobe, notes } = normalizeWardrobe({ segments: [] }, { width: 4000, depth: 3200, height: 2750 });
    expect(wardrobe.roomHeightMm).toBe(2750);
    expect(notes.join(' ')).toMatch(/visina prostorije/);
  });

  it('nova polja (bočne maske, visina vrata) dobijaju null = automatski', () => {
    const { wardrobe } = normalizeWardrobe({ heightMm: 2600, segments: [] }, ROOM);
    expect(wardrobe.sideMaskDepthLeftMm).toBeNull();
    expect(wardrobe.sideMaskDepthRightMm).toBeNull();
    expect(wardrobe.doorHeightMm).toBeNull();
  });

  it('stari ladičari dobijaju visinu 700 i 3 ladice', () => {
    const { wardrobe, notes } = normalizeWardrobe({
      heightMm: 2600, segments: [{
        id: 'seg_1',
        lower: { items: [{ id: 'lad1', type: 'ladicar', yMm: 0 }] },   // bez heightMm/drawerCount
        upper: { items: [] },
      }],
    }, ROOM);
    const lad = wardrobe.segments[0].lower.items[0];
    expect(lad.heightMm).toBe(700);
    expect(lad.drawerCount).toBe(3);
    expect(notes.join(' ')).toMatch(/novi model/);
  });

  it('nepostojeći doorType se vraća na baglame', () => {
    const { wardrobe } = normalizeWardrobe({ heightMm: 2600, doorType: 'harmonika', segments: [] }, ROOM);
    expect(wardrobe.doorType).toBe('baglame');
  });

  it('migrirani ormar daje validan kontrolni zbir visina', () => {
    const { wardrobe } = normalizeWardrobe({ heightMm: 2600, legHeightMm: 50, segments: [] }, ROOM);
    const zbir = wardrobe.legHeightMm + wardrobe.lowerCorpusHeightMm
      + (wardrobe.roomHeightMm - wardrobe.legHeightMm - wardrobe.topMaskHeightMm - wardrobe.lowerCorpusHeightMm)
      + wardrobe.topMaskHeightMm;
    expect(zbir).toBe(2600);
  });
});

describe('materialMode — način obračuna materijala', () => {
  it('stari projekat bez polja dobija podrazumijevani obračun po pločama', () => {
    const { project } = normalizeProject({ elements: [] }, ROOM);
    expect(project.materialMode).toBe('ploce');
  });

  it('sačuvani izbor „neto" preživljava normalizaciju', () => {
    const { project } = normalizeProject({ elements: [], materialMode: 'neto' }, ROOM);
    expect(project.materialMode).toBe('neto');
  });

  it('neispravna vrijednost pada na podrazumijevanu', () => {
    const { project } = normalizeProject({ elements: [], materialMode: 'glupost' }, ROOM);
    expect(project.materialMode).toBe('ploce');
  });
});
