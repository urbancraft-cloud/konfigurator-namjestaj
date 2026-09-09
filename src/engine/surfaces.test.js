// src/engine/surfaces.test.js
//
// BUG-12: `computeEndPanels` je za base/wall nizove provjeravao `endExposed()`,
// ali je petlja po VISOKIM elementima generisala završne maske bezuvjetno.
// Frižider postavljen uz lijevi zid (offset 0) dobijao je masku na "start"
// strani, iako je tamo zid i maska fizički ne može stati — ~1,4 m² fantomskog
// materijala u krojnoj listi i cijeni, po svakom takvom elementu.

import { describe, it, expect } from 'vitest';
import { computeEndPanels, tallEndExposed } from './surfaces';
import { resolveProject } from './layout';
import { createPlaced } from '../data/catalog';

const ROOM = { width: 5600, depth: 3600, height: 2600 };

const BASE = {
  name: 'test', worktopDecorId: 'H1180', worktopDepthMm: 600, wallPanelDecorId: 'H1180',
  wallPanelHeightMm: 600, socleDecorId: 'U963', topMaskDecorId: 'H1180', endPanelDecorId: 'H1180',
  services: [], activeWalls: ['top', 'left', 'bottom', 'right'], legHeightMm: 150,
  ledMask: false, wallPanelOn: false, wallPanelThicknessMm: 10,
  endPanelMode: 'auto', endPanelSizes: {}, topMaskHeightMm: 100,
  obstacles: [], cooktops: [],
};

const proj = (elements) => resolveProject({ ...BASE, elements }, ROOM);
const tallMasks = (p, room = ROOM) => computeEndPanels(p, room).pieces.filter((x) => x.kind === 'tall');

describe('BUG-12 — završne maske visokih elemenata poštuju gabarit i susjede', () => {
  it('frižider na offset 0 (uz lijevi zid) NEMA masku na start strani', () => {
    const p = proj([createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'top', 0)]);
    const maske = tallMasks(p);
    expect(maske.map((m) => m.side)).toEqual(['end']);
    expect(maske).toHaveLength(1);
  });

  it('frižider na kraju zida NEMA masku na end strani', () => {
    const offset = ROOM.width - 600;                      // 600 = širina H-FRIZIDER
    const p = proj([createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'top', offset)]);
    expect(tallMasks(p).map((m) => m.side)).toEqual(['start']);
  });

  it('frižider koji zauzima CIJELU širinu zida nema nijednu masku', () => {
    // Lijevi zid ga zatvara s jedne, a prostorija je široka tačno koliko element.
    const uska = { ...ROOM, width: 600 };
    const p = resolveProject({ ...BASE, elements: [createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'top', 0)] }, uska);
    expect(tallMasks(p, uska)).toHaveLength(0);
  });

  it('frižider u uglu L-kuhinje (uz lijevi zid, slobodan desno) ima samo end masku', () => {
    const p = proj([createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'top', 0)]);
    expect(tallMasks(p).map((m) => m.side)).toEqual(['end']);
  });

  it('frižider u sredini zida ima maske na OBJE strane', () => {
    const p = proj([createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'top', 2500)]);
    expect(tallMasks(p).map((m) => m.side).sort()).toEqual(['end', 'start']);
  });

  it('dva susjedna visoka elementa nemaju masku MEĐU sobom', () => {
    const p = proj([
      createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'top', 0),
      createPlaced('H-PECNICA', 'SERIJA_KUCANO', 'top', 600, 'vrata'),
    ]);
    const maske = tallMasks(p);
    // frižider: start = zid (ne), end = susjedni visoki (ne) → 0
    // pećnica:  start = susjedni visoki (ne), end = slobodno (da) → 1
    expect(maske).toHaveLength(1);
    expect(maske[0].side).toBe('end');
  });

  it('visoki element uz DONJI element dobija masku, skraćenu za coklo', () => {
    const p = proj([
      createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0),                 // 0–600
      createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'top', 600),             // 600–1200
    ]);
    const maske = tallMasks(p);
    const start = maske.find((m) => m.side === 'start');
    expect(start).toBeTruthy();
    expect(start.trimmedForSocle).toBe(true);       // susjed je niži → maska staje na coklo
    expect(start.yBase).toBe(150);                  // = legHeightMm
  });

  it('maska se ne generiše kad je procjep uži od debljine maske', () => {
    // 10 mm slobodno do zida, a maska je 18 mm
    const p = proj([createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'top', ROOM.width - 610)]);
    expect(tallMasks(p).map((m) => m.side)).toEqual(['start']);
  });
});

describe('tallEndExposed — direktna provjera', () => {
  it('start strana uz zid je zauzeta', () => {
    const el = createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'top', 0);
    const p = proj([el]);
    const resolved = p.elements.find((e) => e.instanceId === el.instanceId);
    expect(tallEndExposed(resolved, p, ROOM, 'start', 18)).toBe(false);
    expect(tallEndExposed(resolved, p, ROOM, 'end', 18)).toBe(true);
  });

  it('poštuje zadatu debljinu maske', () => {
    // Element na "right" zidu; do desnog kraja prostorije ostaje 20 mm.
    const p = proj([createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'right', ROOM.depth - 600 - 20)]);
    const resolved = p.elements.find((e) => e.templateId === 'H-FRIZIDER');
    expect(tallEndExposed(resolved, p, ROOM, 'end', 18)).toBe(true);    // 20 ≥ 18
    expect(tallEndExposed(resolved, p, ROOM, 'end', 25)).toBe(false);   // 20 < 25
  });

  it('maska od 18 mm staje i kad je susjed na 100 mm (ne odbija se zbog probnog pojasa)', () => {
    const p = proj([
      createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0),          // 0–600
      createPlaced('H-FRIZIDER', 'SERIJA_KUCANO', 'top', 700),      // 700–1300, razmak 100 mm
    ]);
    const tall = p.elements.find((e) => e.templateId === 'H-FRIZIDER');
    expect(tallEndExposed(tall, p, ROOM, 'start', 18)).toBe(true);
    expect(tallEndExposed(tall, p, ROOM, 'start', 120)).toBe(false);  // 100 < 120
  });
});

describe('base i wall maske i dalje rade (regresija)', () => {
  it('niz donjih elemenata uz zid nema masku na start strani', () => {
    const p = proj([
      createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0),
      createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 600),
    ]);
    const base = computeEndPanels(p, ROOM).pieces.filter((x) => x.kind === 'base');
    expect(base.map((m) => m.side)).toEqual(['end']);
  });

  it('niz u sredini zida ima obje maske', () => {
    const p = proj([
      createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 2000),
      createPlaced('D-LADICE', 'SERIJA_KUCANO', 'top', 2600),
    ]);
    const base = computeEndPanels(p, ROOM).pieces.filter((x) => x.kind === 'base');
    expect(base.map((m) => m.side).sort()).toEqual(['end', 'start']);
  });

  it('mode "full" daje masku od poda do plafona', () => {
    const p = resolveProject({ ...BASE, endPanelMode: 'full',
      elements: [createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 2000)] }, ROOM);
    const maska = computeEndPanels(p, ROOM).pieces.find((x) => x.kind === 'base');
    expect(maska.yBase).toBe(0);
    expect(maska.lengthMm).toBeGreaterThan(2000);
  });
});
