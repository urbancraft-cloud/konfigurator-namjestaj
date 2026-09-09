// src/data/theme.test.js
//
// Kontrast je lako nazadovati: neko promijeni `faint` da „bude diskretnije" i
// pola pomoćnog teksta postane nečitljivo za korisnike sa slabijim vidom, a
// nijedan test to ne primijeti. Ovdje je WCAG AA zaključan brojevima.

import { describe, it, expect } from 'vitest';
import { C } from './theme';

/** Relativna luminiscencija po WCAG 2.1. */
function luminance(hex) {
  const h = String(hex).replace('#', '');
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Omjer kontrasta (1:1 … 21:1). */
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const POZADINE = {
  paper: C.paper,
  paper2: C.paper2,
  paper3: C.paper3,
  bg: C.bg,
};

describe('WCAG 2.1 AA — kontrast teksta (najmanje 4,5:1)', () => {
  const TEKSTOVI = {
    text: C.text,
    dim: C.dim,
    faint: C.faint,
    accentText: C.accentText,
    warn: C.warn,
    danger: C.danger,
    ok: C.ok,
  };

  Object.entries(TEKSTOVI).forEach(([naziv, boja]) => {
    Object.entries(POZADINE).forEach(([pozadina, hex]) => {
      it(`${naziv} (${boja}) na ${pozadina} (${hex}) ≥ 4,5:1`, () => {
        const r = contrast(boja, hex);
        expect(r, `${naziv} na ${pozadina} ima samo ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  it('bijeli tekst na accent i ink pozadini ≥ 4,5:1', () => {
    expect(contrast('#FFFFFF', C.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', C.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', C.danger)).toBeGreaterThanOrEqual(4.5);
  });

  it('hijerarhija je očuvana: text > dim > faint', () => {
    expect(contrast(C.text, C.paper)).toBeGreaterThan(contrast(C.dim, C.paper));
    expect(contrast(C.dim, C.paper)).toBeGreaterThan(contrast(C.faint, C.paper));
  });
});
