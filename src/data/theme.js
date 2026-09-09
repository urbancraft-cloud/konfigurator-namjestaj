// src/data/theme.js

/*
 * WCAG 2.1 AA kontrast — najmanje 4,5:1 za tekst manji od 18 pt.
 *
 * PRIJE:
 *   dim   #64748B → 4,76:1 na paper ✓, 4,55:1 na paper2 ✓, 4,34:1 na paper3 ✗
 *   faint #94A3B8 → 2,56:1 / 2,45:1 / 2,34:1 — PADA na svim pozadinama, a koristi
 *                    se za pomoćni tekst, mjerne oznake i napomene, dakle za tekst
 *                    koji korisnik zaista treba pročitati.
 *
 * POSLIJE (izmjereno, ne procijenjeno — sve kombinacije prolaze AA):
 *   text  #0F172A → 17,85 / 17,06 / 16,30
 *   dim   #475569 →  7,58 /  7,24 /  6,92
 *   faint #5B6B7F →  5,45 /  5,21 /  4,97   ← najsvjetliji koji prolazi svugdje
 *
 * Hijerarhija od tri nivoa je zadržana (text > dim > faint), samo je pomjerena
 * taman koliko treba da prođe WCAG.
 */
export const C = {
  bg: '#F1F5F9',
  paper: '#FFFFFF', paper2: '#F8FAFC', paper3: '#F1F5F9',
  line: '#E2E8F0', lineStrong: '#CBD5E1',
  ink: '#0F172A', ink2: '#1E293B',
  text: '#0F172A', dim: '#475569', faint: '#5B6B7F',
  /* `accent` je pozadina svih primarnih dugmadi i značke sa ukupnom cijenom, a
     tekst na njoj je BIJELI. Originalnih #0D9488 sa bijelim daje **3,74:1** —
     ispod WCAG AA (4,5:1) za tekst veličine 12–14 px, koliko ova dugmad i
     koriste. #0B7F76 daje 4,87:1 i zadržava isti tirkizni karakter.
     `accentDark` (nije bio korišten nigdje) je sada taman za hover/aktivno stanje. */
  accent: '#0B7F76', accentDark: '#0A6660', accentSoft: '#CCFBF1', accentText: '#115E59',
  warn: '#B45309', warnBg: '#FEF3C7',
  danger: '#B91C1C', dangerBg: '#FEE2E2',
  ok: '#15803D', okBg: '#DCFCE7',
};

export const mono = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontVariantNumeric: 'tabular-nums',
};

export const card = { background: C.paper, border: `1px solid ${C.line}`, borderRadius: 14 };