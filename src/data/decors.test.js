// src/data/decors.test.js
import { describe, it, expect } from 'vitest';
import {
  DECORS, DECOR_DB, registerDecor, parseDecorCSV, applyDecorRows,
  thicknessesOf, boardPriceOf, PRICE_LIST, decorById,
} from './decors';

describe('parseDecorCSV — uvoz cjenovnika iz tabele', () => {
  it('parsira osnovni format sa više debljina', () => {
    const csv = [
      'šifra;naziv;struktura;porodica;debljina;cijena_m2;debljina2;cijena2',
      'U732;Prašnjavo siva;ST9;siva;18;36,60;25;46,75',
      'H9999;Test hrast;ST36;hrast;18;42,10',
    ].join('\n');
    const { items, errors } = parseDecorCSV(csv);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(2);

    expect(items[0].code).toBe('U732');
    expect(items[0].name).toBe('Prašnjavo siva');
    expect(items[0].struct).toBe('ST9');
    expect(items[0].fam).toBe('siva');
    expect(items[0].board).toEqual([{ t: 18, p: 36.6 }, { t: 25, p: 46.75 }]);

    expect(items[1].board).toEqual([{ t: 18, p: 42.1 }]);
  });

  it('zaglavlje se prepoznaje i preskače bez greške', () => {
    const { items, errors } = parseDecorCSV('šifra;naziv;struktura;porodica;18;cijena\nX1;Novi;ST9;siva;18;30');
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0].code).toBe('X1');
  });

  it('prihvata i zarez kao separator', () => {
    const { items, errors } = parseDecorCSV('X2,Novi dva,ST9,siva,18,31.5');
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0].board[0].p).toBe(31.5);
  });

  it('prihvata decimalni zarez i tačku', () => {
    const a = parseDecorCSV('X3;A;ST9;siva;18;36,60').items[0];
    const b = parseDecorCSV('X4;B;ST9;siva;18;36.60').items[0];
    expect(a.board[0].p).toBe(36.6);
    expect(b.board[0].p).toBe(36.6);
  });

  it('skida UTF-8 BOM (Excel ga dodaje pri snimanju CSV-a)', () => {
    const { items, errors } = parseDecorCSV('\uFEFFX5;Bom test;ST9;siva;18;30');
    expect(errors).toEqual([]);
    expect(items[0].code).toBe('X5');
  });

  it('prazna datoteka', () => {
    expect(parseDecorCSV('').items).toHaveLength(0);
    expect(parseDecorCSV('').errors).toEqual(['Datoteka je prazna.']);
    expect(parseDecorCSV('   \n  \n').errors).toEqual(['Datoteka je prazna.']);
  });

  it('red sa premalo kolona se prijavljuje sa brojem reda', () => {
    const { items, errors } = parseDecorCSV('X6;Samo dvije\nX7;Ispravan;ST9;siva;18;30');
    expect(items).toHaveLength(1);
    expect(items[0].code).toBe('X7');
    expect(errors.join(' ')).toMatch(/Red 1/);
    expect(errors.join(' ')).toMatch(/premalo kolona/);
  });

  it('neispravna šifra se odbija', () => {
    const { items, errors } = parseDecorCSV('x y z!;Loša šifra;ST9;siva;18;30');
    expect(items).toHaveLength(0);
    expect(errors.join(' ')).toMatch(/nije ispravna/);
  });

  it('neispravna debljina ili cijena se prijavljuje uz šifru', () => {
    const a = parseDecorCSV('X8;A;ST9;siva;abc;30');
    expect(a.items).toHaveLength(0);
    expect(a.errors.join(' ')).toMatch(/X8/);
    expect(a.errors.join(' ')).toMatch(/debljina/);

    const b = parseDecorCSV('X9;B;ST9;siva;18;-5');
    expect(b.items).toHaveLength(0);
    expect(b.errors.join(' ')).toMatch(/cijena/);
  });

  it('nepoznata porodica ne ruši — registerDecor pada na "siva"', () => {
    const { items } = parseDecorCSV('XA;Nepoznata porodica;ST9;neštočudno;18;30');
    const res = applyDecorRows(items);
    expect(res.added).toBe(1);
    expect(DECORS.XA.fam).toBe('siva');
    expect(DECORS.XA.tex).toBeTruthy();
  });

  it('više grešaka se sakuplja, ne prekida se na prvoj', () => {
    const { items, errors } = parseDecorCSV([
      'XB;B;ST9;siva;18',                  // nema cijene
      'X C;Loša šifra;ST9;siva;18;30',     // razmak u šifri
      'XD;D;ST9;siva;18;30',               // ispravan
    ].join('\n'));
    expect(items).toHaveLength(1);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('applyDecorRows i registerDecor', () => {
  it('razlikuje nove i izmijenjene dekore', () => {
    const prvi = applyDecorRows([{ code: 'TEST_1', name: 'Test', struct: 'ST9', fam: 'siva', board: [{ t: 18, p: 30 }] }]);
    expect(prvi.added).toBe(1);
    expect(prvi.updated).toBe(0);

    const drugi = applyDecorRows([{ code: 'TEST_1', name: 'Test v2', struct: 'ST9', fam: 'siva', board: [{ t: 18, p: 33 }] }]);
    expect(drugi.added).toBe(0);
    expect(drugi.updated).toBe(1);
  });

  it('izmijenjeni dekor dobija userEdited oznaku i novu cijenu', () => {
    registerDecor({ code: 'TEST_2', name: 'Original', struct: 'ST9', fam: 'siva', board: [{ t: 18, p: 30 }] });
    expect(DECORS.TEST_2.pricePerM2).toBe(30);

    registerDecor({ code: 'TEST_2', name: 'Original', struct: 'ST9', fam: 'siva', board: [{ t: 18, p: 41 }] });
    expect(DECORS.TEST_2.pricePerM2).toBe(41);
    expect(DECORS.TEST_2.userEdited).toBe(true);
    // cijena se stvarno koristi u kalkulaciji
    expect(boardPriceOf('TEST_2', 18)).toBe(41);
  });

  it('dekor iz cjenovnika (nije korisnički mijenjan) nema userEdited', () => {
    expect(DECORS.W1000.userEdited).toBeFalsy();
  });

  it('nova debljina ulazi u thicknessesOf odmah', () => {
    registerDecor({ code: 'TEST_3', name: 'T3', struct: 'ST9', fam: 'siva', board: [{ t: 16, p: 25 }, { t: 18, p: 30 }, { t: 25, p: 40 }] });
    expect(thicknessesOf('TEST_3')).toEqual([16, 18, 25]);
  });
});

describe('PRICE_LIST — verzioniranje cjenovnika', () => {
  it('ima izvor, vrstu, datum i čitljivu oznaku', () => {
    expect(PRICE_LIST.source).toBeTruthy();
    expect(PRICE_LIST.kind).toBeTruthy();
    expect(PRICE_LIST.effective).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PRICE_LIST.label).toMatch(/ELGRAD/);
    expect(PRICE_LIST.label).toContain(PRICE_LIST.effective.slice(0, 4));
  });
});

describe('decorById — sigurnosni lookup', () => {
  it('poznat dekor vraća stvarne podatke', () => {
    expect(decorById('W1000').shortName).toBeTruthy();
    expect(decorById('W1000').missing).toBeFalsy();
  });

  it('nepoznat dekor vraća fallback sa missing: true i cijenom 0', () => {
    const d = decorById('NE_POSTOJI');
    expect(d.missing).toBe(true);
    expect(d.pricePerM2).toBe(0);
    expect(d.code).toBe('NE_POSTOJI');
    expect(d.tex).toBeTruthy();          // tekstura mora postojati, 3D je koristi
  });

  it('baza dekora je netaknuta (fallback se ne upisuje u nju)', () => {
    decorById('NE_POSTOJI_2');
    expect(DECOR_DB.NE_POSTOJI_2).toBeUndefined();
    expect(DECORS.NE_POSTOJI_2).toBeUndefined();
  });
});
