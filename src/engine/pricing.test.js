// src/engine/pricing.test.js
import { describe, it, expect } from 'vitest';
import { computeHardware, computePrice, projectTotals, legItemFor } from './pricing';
import { KITCHEN_LEGS_PER_CORPUS, GOLA_METERS_PER_FRONT } from '../data/wardrobe';
import { createPlaced } from '../data/catalog';
import { HANDLES, HARDWARE } from '../data/hardware';

const PROJECT = { legHeightMm: 150, handleOrientBase: 'vertical', handleOrientWall: 'horizontal' };

const el = (templateId = 'D-VRATA', width = 600) => {
  const e = createPlaced(templateId, 'SERIJA_KUCANO', 'top', 0);
  e.dims.width = width;
  return e;
};
const byId = (hw, id) => hw.find((h) => h.id === id);

describe('okov — nogice (BUG-11)', () => {
  it('donji i visoki korpus dobijaju tačno 4 nogice (konstanta pogona)', () => {
    // PROJECT ima legHeightMm: 150 → artikal „Nogica podesiva 150 mm"
    expect(byId(computeHardware(el('D-VRATA'), PROJECT), 'NOGICA_150').qty).toBe(KITCHEN_LEGS_PER_CORPUS);
    // Visoki element također stoji na podu → ima nogice.
    expect(byId(computeHardware(el('H-FRIZIDER'), PROJECT), 'NOGICA_150').qty).toBe(KITCHEN_LEGS_PER_CORPUS);
  });

  it('visina podnožja bira pravi artikal (100 mm vs 150 mm)', () => {
    const h100 = computeHardware(el('D-VRATA'), { ...PROJECT, legHeightMm: 100 });
    expect(byId(h100, 'NOGICA').qty).toBe(4);
    expect(byId(h100, 'NOGICA_150')).toBeUndefined();

    const h150 = computeHardware(el('D-VRATA'), { ...PROJECT, legHeightMm: 150 });
    expect(byId(h150, 'NOGICA_150').qty).toBe(4);
    expect(byId(h150, 'NOGICA')).toBeUndefined();
    expect(byId(h150, 'NOGICA_150').name).toMatch(/150 mm/);
  });

  it('legItemFor nikad ne vraća undefined (ni za nepoznatu visinu)', () => {
    [0, 70, 100, 125, 150, 200, NaN].forEach((h) => {
      const item = legItemFor(h);
      expect(item).toBeTruthy();
      expect(item.id).toMatch(/^NOGICA/);
    });
  });

  it('viseći element nema nogice (ne stoji na podu)', () => {
    expect(byId(computeHardware(el('V-ELEMENT'), PROJECT), 'NOGICA')).toBeUndefined();
    expect(byId(computeHardware(el('V-ELEMENT'), PROJECT), 'NOGICA_150')).toBeUndefined();
  });

  it('širok element NE dobija 6 nogica (bilo je width > 900 ? 6 : 4)', () => {
    expect(byId(computeHardware(el('D-VRATA', 1200), PROJECT), 'NOGICA_150').qty).toBe(4);
  });

  it('kad je podnožje 0 mm, nogica nema', () => {
    const hw = computeHardware(el('D-VRATA'), { ...PROJECT, legHeightMm: 0 });
    expect(byId(hw, 'NOGICA')).toBeUndefined();
    expect(byId(hw, 'NOGICA_150')).toBeUndefined();
  });

  it('ukupno nogica u projektu = 4 × broj korpusa koji stoje na podu', () => {
    const p100 = { ...PROJECT, legHeightMm: 100 };
    const elementi = [el('D-VRATA'), el('D-LADICE'), el('H-FRIZIDER'), el('V-ELEMENT')];
    const ukupno = elementi
      .flatMap((e) => computeHardware(e, p100))
      .filter((h) => h.id === 'NOGICA')
      .reduce((s, h) => s + h.qty, 0);
    expect(ukupno).toBe(3 * KITCHEN_LEGS_PER_CORPUS);   // 3 korpusa na podu, viseći ne
  });

  it('radi i bez proslijeđenog projekta (otpornost na starije pozivaoce)', () => {
    expect(() => computeHardware(el('D-VRATA'))).not.toThrow();
    // bez projekta se podrazumijeva legHeightMm = 150
    expect(byId(computeHardware(el('D-VRATA')), 'NOGICA_150').qty).toBe(4);
  });
});

describe('okov — gola profil je metraža (BUG-10)', () => {
  it('jedinica je metar, a ne komad', () => {
    const e = el('D-VRATA', 400); e.handleId = 'GOLA_C';
    const g = byId(computeHardware(e, PROJECT), 'GOLA_C');
    expect(g.unit).toBe('m');
    expect(g.qty).toBeCloseTo(0.4, 5);          // 400 mm, jedno krilo
  });

  it('količina raste sa širinom elementa', () => {
    const usk = el('D-VRATA', 400); usk.handleId = 'GOLA_C';
    const sir = el('D-VRATA', 600); sir.handleId = 'GOLA_C';
    expect(byId(computeHardware(sir, PROJECT), 'GOLA_C').qty)
      .toBeGreaterThan(byId(computeHardware(usk, PROJECT), 'GOLA_C').qty);
  });

  it('širi element dobija 2 krila (twoLeafAboveMm=600) pa i 2 profila', () => {
    const e = el('D-VRATA', 900); e.handleId = 'GOLA_C';
    expect(byId(computeHardware(e, PROJECT), 'GOLA_C').qty).toBeCloseTo(1.8, 5);
  });

  it('gola profil se ne naplaćuje kao ručka u komadima', () => {
    const e = el('D-VRATA', 600); e.handleId = 'GOLA_C';
    const hw = computeHardware(e, PROJECT);
    expect(hw.filter((h) => h.unit === 'kom' && /Ruč/i.test(h.name))).toHaveLength(0);
  });

  it('metraža se računa po broju fronti (ladičar od 3 ladice = 3 × širina)', () => {
    const e = el('D-LADICE', 600); e.handleId = 'GOLA_C';
    const g = byId(computeHardware(e, PROJECT), 'GOLA_C');
    expect(g.qty).toBeCloseTo(1.8, 5);       // 3 fronte × 0,6 m
  });

  it('cijena je KM po metru (14 KM/m\'), ne po krilu', () => {
    const e = el('D-VRATA', 1000); e.handleId = 'GOLA_C';   // 2 krila → 2,0 m
    const g = byId(computeHardware(e, PROJECT), 'GOLA_C');
    expect(g.price).toBe(HANDLES.GOLA_C.price);
    expect(g.qty * g.price).toBeCloseTo(2 * 14, 5);
  });

  it('za razliku od starog ponašanja: 20 elemenata sa golom nije više ~280 KM', () => {
    const elementi = Array.from({ length: 20 }, () => {
      const e = el('D-VRATA', 600); e.handleId = 'GOLA_C'; return e;
    });
    const ukupno = elementi
      .flatMap((e) => computeHardware(e, PROJECT))
      .filter((h) => h.id === 'GOLA_C')
      .reduce((s, h) => s + h.qty * h.price, 0);
    // 20 elemenata × 0,6 m × 14 KM = 168 KM metraže.
    // Stari kod je ovo računao kao 20 "komada" × 14 KM = 280 KM.
    expect(GOLA_METERS_PER_FRONT).toBe(1.0);
    expect(ukupno).toBeCloseTo(20 * 0.6 * HANDLES.GOLA_C.price * GOLA_METERS_PER_FRONT, 5);
  });
});

describe('okov — push-to-open (BUG-10)', () => {
  it('naplaćuje mehanizam po fronti, ne ručku', () => {
    const e = el('D-VRATA', 600); e.handleId = 'PUSH';
    const hw = computeHardware(e, PROJECT);
    expect(byId(hw, 'PUSH').qty).toBe(1);
    expect(byId(hw, 'PUSH').price).toBe(HARDWARE.PUSH.price);
    expect(hw.filter((h) => /Ruč/i.test(h.name))).toHaveLength(0);
  });

  it('ladičar sa 4 ladice dobija 4 push mehanizma', () => {
    const e = el('D-LADICE-4', 450); e.handleId = 'PUSH';
    expect(byId(computeHardware(e, PROJECT), 'PUSH').qty).toBe(4);
  });
});

describe('okov — klasična ručka ostaje po komadu', () => {
  it('vrata 600 mm = 1 ručka, ladičar 1+2 = 3 ručke', () => {
    const v = el('D-VRATA', 600); v.handleId = 'RUCKA_160';
    expect(byId(computeHardware(v, PROJECT), 'RUCKA_160').qty).toBe(1);
    const l = el('D-LADICE', 600); l.handleId = 'RUCKA_160';
    expect(byId(computeHardware(l, PROJECT), 'RUCKA_160').qty).toBe(3);
  });

  it('šarke su i dalje 2 po krilu (3 ako je više od 1200 mm)', () => {
    const v = el('D-VRATA', 600);
    expect(byId(computeHardware(v, PROJECT), 'SARKA').qty).toBe(2);
  });

  it('element bez frontStack-a dobija šarke iz automatskog rasporeda fronti', () => {
    const v = el('V-ELEMENT', 600);      // nema frontStack
    const hw = computeHardware(v, PROJECT);
    expect(byId(hw, 'SARKA').qty).toBeGreaterThan(0);
    expect(byId(hw, 'RUCKA_160').qty).toBeGreaterThan(0);
  });
});

describe('cijena elementa se ne lomi na nepoznatom dekoru (BUG-03)', () => {
  it('computePrice vraća broj, ne baca', () => {
    const e = el('D-VRATA', 600);
    e.corpus.decorId = 'DEKOR_KOJI_NE_POSTOJI';
    e.front.decorId = 'TAKOĐER_NE_POSTOJI';
    let p;
    expect(() => { p = computePrice(e, PROJECT); }).not.toThrow();
    expect(Number.isFinite(p.net)).toBe(true);
  });
});

describe('ukupna cijena projekta', () => {
  it('projectTotals radi sa praznim projektom i ne daje NaN', () => {
    const t = projectTotals({
      elements: [], obstacles: [], services: [], cooktops: [],
      legHeightMm: 150, ledMask: false, wallPanelOn: false,
      worktopDecorId: 'H1180', wallPanelHeightMm: 600, topMaskHeightMm: 100,
    }, { width: 5600, depth: 3600, height: 2600 });
    expect(t.net).toBe(0);
    expect(Number.isFinite(t.gross)).toBe(true);
  });
});
