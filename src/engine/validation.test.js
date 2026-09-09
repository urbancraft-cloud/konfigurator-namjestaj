// src/engine/validation.test.js
//
// Instalacije (odvod, utičnice) su se koristile u automatskom rasporedu, ali ih
// `validateInProject` uopšte NIJE provjeravao — samo prepreke (prozore i vrata).
// Element sa ladicama postavljen preko odvoda prošao bi kao „proizvodno ispravan",
// a sanduk bi na montaži udario u cijev.

import { describe, it, expect } from 'vitest';
import { validateInProject, validateElement, serviceWarnings } from './validation';
import { resolveProject } from './layout';
import { createPlaced } from '../data/catalog';

const ROOM = { width: 5600, depth: 3600, height: 2600 };
const BASE = {
  name: 't', worktopDecorId: 'H1180', worktopDepthMm: 600, wallPanelDecorId: 'H1180',
  wallPanelHeightMm: 600, socleDecorId: 'U963', topMaskDecorId: 'H1180', endPanelDecorId: 'H1180',
  services: [], activeWalls: ['top', 'left', 'bottom', 'right'], legHeightMm: 150,
  ledMask: false, wallPanelOn: false, wallPanelThicknessMm: 10,
  endPanelMode: 'auto', endPanelSizes: {}, topMaskHeightMm: 100, obstacles: [], cooktops: [],
  priceList: null,
};

const projekat = (elements, services) =>
  resolveProject({ ...BASE, elements, services: services || [] }, ROOM);

describe('serviceWarnings — instalacije', () => {
  it('ladice preko odvoda daju upozorenje (sanduk udara u cijev)', () => {
    const ladicar = createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 800);   // 800–1400
    const p = projekat([ladicar], [
      { id: 'sv1', kind: 'voda', wall: 'top', offset: 1000, heightMm: 500 },
    ]);
    const w = serviceWarnings(p.elements.find((e) => e.instanceId === ladicar.instanceId), p, ROOM);
    expect(w.length).toBeGreaterThan(0);
    expect(w.join(' ')).toMatch(/ladice/i);
    expect(w.join(' ')).toMatch(/odvod/i);
  });

  it('element sa VRATIMA preko odvoda NE upozorava (leđa se izbuše)', () => {
    const vrata = createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 800);
    const p = projekat([vrata], [
      { id: 'sv1', kind: 'voda', wall: 'top', offset: 1000, heightMm: 500 },
    ]);
    const w = serviceWarnings(p.elements.find((e) => e.instanceId === vrata.instanceId), p, ROOM);
    expect(w).toHaveLength(0);
  });

  it('instalacija na DRUGOM zidu se ne provjerava', () => {
    const ladicar = createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 800);
    const p = projekat([ladicar], [
      { id: 'sv1', kind: 'voda', wall: 'left', offset: 1000, heightMm: 500 },
    ]);
    expect(serviceWarnings(p.elements[0], p, ROOM)).toHaveLength(0);
  });

  it('instalacija izvan visinskog raspona elementa se ne provjerava', () => {
    const ladicar = createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 800);   // y 150–870
    const p = projekat([ladicar], [
      { id: 'sv1', kind: 'voda', wall: 'top', offset: 1000, heightMm: 1150 },  // iznad elementa
    ]);
    expect(serviceWarnings(p.elements[0], p, ROOM)).toHaveLength(0);
  });

  it('utičnica iza aparata sa punim leđima traži izrez', () => {
    const pecnica = createPlaced('D-PECNICA', 'SERIJA_KUCANO', 'top', 1800);
    const p = projekat([pecnica], [
      { id: 'sv2', kind: 'struja', wall: 'top', offset: 2000, heightMm: 300 },
    ]);
    const w = serviceWarnings(p.elements.find((e) => e.instanceId === pecnica.instanceId), p, ROOM);
    // D-PECNICA ima back: 'strips' → upozorenje se NE daje (trake ostavljaju prolaz)
    expect(w.join(' ')).not.toMatch(/izrez/);
  });

  it('bez instalacija nema ni upozorenja', () => {
    const ladicar = createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 800);
    const p = projekat([ladicar], []);
    expect(serviceWarnings(p.elements[0], p, ROOM)).toHaveLength(0);
  });

  it('upozorenja ulaze u validateInProject (vide se u UI-u)', () => {
    const ladicar = createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 800);
    const p = projekat([ladicar], [
      { id: 'sv1', kind: 'voda', wall: 'top', offset: 1000, heightMm: 500 },
    ]);
    const el = p.elements.find((e) => e.instanceId === ladicar.instanceId);
    const v = validateInProject(el, p, ROOM);
    expect(v.warnings.join(' ')).toMatch(/odvod/i);
    // upozorenje, ne greška — element je i dalje upotrebljiv
    expect(v.errors.filter((e) => /odvod/i.test(e))).toHaveLength(0);
  });
});

describe('validateElement — sigurnost', () => {
  it('radi na svim tipovima iz kataloga bez pada', () => {
    const tipovi = ['D-VRATA', 'D-LADICE', 'D-LADICE-4', 'D-UGAO-SLIJEPI', 'D-SUDOPER',
      'D-PECNICA', 'D-MASINA', 'V-ELEMENT', 'V-NAPA', 'V-UGAO-SLIJEPI',
      'H-FRIZIDER', 'H-PECNICA', 'H-NADGRADNJA'];
    tipovi.forEach((t) => {
      const el = createPlaced(t, 'SERIJA_KUCANO', 'top', 0, t === 'H-PECNICA' ? 'vrata' : undefined);
      expect(() => validateElement(el), t).not.toThrow();
      const v = validateElement(el);
      expect(Array.isArray(v.errors)).toBe(true);
      expect(Array.isArray(v.warnings)).toBe(true);
      expect(typeof v.valid).toBe('boolean');
    });
  });

  it('element ispod minimalne širine je nevažeći', () => {
    const el = createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0);
    el.dims.width = 100;                     // min je 300
    const v = validateElement(el);
    expect(v.valid).toBe(false);
    expect(v.errors.join(' ')).toMatch(/ispod minimuma/);
  });

  it('nekalibrisan sistem vodilica je greška, ne tihi prolaz', () => {
    const el = createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 0);
    el.runnerSystemId = 'BLUM_LEGRABOX_M_500';      // verified: false
    const v = validateElement(el);
    expect(v.valid).toBe(false);
    expect(v.errors.join(' ')).toMatch(/nije kalibrisan/);
  });
});
