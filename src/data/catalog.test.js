// src/data/catalog.test.js
import { describe, it, expect } from 'vitest';
import {
  createInstance, createPlaced, templateById, templateExists,
  adoptProjectIds, nextInstanceId, FALLBACK_TEMPLATE,
} from './catalog';

describe('jedinstveni instanceId (BUG-02)', () => {
  it('createInstance ne vraća dupli ID za isti templateId', () => {
    const ids = new Set();
    for (let i = 0; i < 3000; i++) ids.add(createInstance('D-VRATA', 'SERIJA_KUCANO').instanceId);
    expect(ids.size).toBe(3000);
  });

  it('createPlaced ne vraća dupli ID ni u velikom nizu (auto-raspored radi hiljade proba)', () => {
    const ids = new Set();
    for (let i = 0; i < 20000; i++) ids.add(createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0).instanceId);
    expect(ids.size).toBe(20000);
  });

  it('svi ID-jevi počinju sa "el_" (postojeći kod računa na taj prefiks)', () => {
    expect(createPlaced('D-VRATA', 'SERIJA_KUCANO', 'top', 0).instanceId).toMatch(/^el_/);
  });

  it('adoptProjectIds sprječava koliziju sa ID-jevima iz sačuvanog projekta', () => {
    // Simulacija: učitan projekat iz localStorage sa starim numeričkim ID-jevima.
    const sacuvan = { elements: [{ instanceId: 'el_1' }, { instanceId: 'el_7' }] };
    adoptProjectIds(sacuvan);
    const novi = nextInstanceId();
    expect(novi).not.toBe('el_1');
    expect(novi).not.toBe('el_7');
    expect(novi).not.toBe('el_1_nad');
  });

  it('ID-jevi su stabilno različiti između dva uzastopna poziva', () => {
    expect(nextInstanceId()).not.toBe(nextInstanceId());
  });
});

describe('templateById više ne vraća undefined (BUG-03)', () => {
  it('poznat tip vraća stvarni šablon', () => {
    expect(templateById('D-VRATA').name).toBe('Standardni donji');
    expect(templateExists('D-VRATA')).toBe(true);
  });

  it('nepoznat tip vraća sigurnosni šablon sa missing: true', () => {
    const t = templateById('D-TIP-KOJI-NE-POSTOJI');
    expect(t).toBeTruthy();
    expect(t.missing).toBe(true);
    expect(t.dims.width.default).toBe(FALLBACK_TEMPLATE.dims.width.default);
    expect(templateExists('D-TIP-KOJI-NE-POSTOJI')).toBe(false);
  });

  it('sigurnosni šablon ne mutira se između poziva', () => {
    const a = templateById('X1');
    const b = templateById('X2');
    a.name = 'izmijenjeno';
    expect(b.name).toBe(FALLBACK_TEMPLATE.name);
    expect(a.templateId).toBe('X1');
    expect(b.templateId).toBe('X2');
  });

  it('null/undefined ID ne ruši', () => {
    expect(() => templateById(undefined)).not.toThrow();
    expect(() => templateById(null)).not.toThrow();
  });
});
