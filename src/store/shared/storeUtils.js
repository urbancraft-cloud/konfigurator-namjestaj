// src/store/shared/storeUtils.js
/**
 * Zajednički utility-ji za store-ove.
 * Sadrži guard funkcije, validatore i helper-e koji se koriste u oba store-a.
 */

import { safeTemplateById, safeDecor, validateElementReferences } from '../../engine/shared/safeAccess';
import { DECORS } from '../../data/decors';

/**
 * Guard za template - vraća fallback ako template ne postoji.
 * @param {string} templateId - ID template-a
 * @returns {object} Template objekat (stvarni ili fallback)
 */
export const getTemplateWithGuard = (templateId) => {
  const tpl = safeTemplateById(templateId);
  if (!tpl || tpl.templateId === 'UNKNOWN') {
    console.warn(`Template "${templateId}" nije pronađen, koristi se fallback.`);
  }
  return tpl;
};

/**
 * Guard za dekor - vraća fallback ako dekor ne postoji.
 * @param {string} decorId - ID dekora
 * @returns {object} Dekor objekat (stvarni ili fallback)
 */
export const getDecorWithGuard = (decorId) => {
  const decor = safeDecor(decorId);
  if (!DECORS[decorId]) {
    console.warn(`Dekor "${decorId}" nije pronađen, koristi se fallback.`);
  }
  return decor;
};

/**
 * Validira element prije operacija u store-u.
 * @param {object} el - Element koji se validira
 * @returns {{valid: boolean, errors: string[]}} Rezultat validacije
 */
export const validateElement = (el) => {
  const errors = [];
  
  if (!el.instanceId) {
    errors.push('Nedostaje instanceId');
  }
  
  if (!el.templateId) {
    errors.push('Nedostaje templateId');
  } else {
    const tpl = getTemplateWithGuard(el.templateId);
    if (tpl.templateId === 'UNKNOWN') {
      errors.push(`Template "${el.templateId}" ne postoji u katalogu`);
    }
  }
  
  if (!el.wall && !el.segmentId) {
    errors.push('Element mora imati wall (kuhinja) ili segmentId (ormar)');
  }
  
  // Validiraj reference
  const refValidation = validateElementReferences(el);
  if (!refValidation.valid) {
    errors.push(...refValidation.missing.map(m => `Invalidna referenca: ${m}`));
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Kreira error rezultat za store akcije.
 * @param {string} message - Poruka greške
 * @returns {{ok: false, reason: string}}
 */
export const createErrorResult = (message) => ({
  ok: false,
  reason: message
});

/**
 * Kreira success rezultat za store akcije.
 * @param {object} data - Dodatni podaci
 * @returns {{ok: true, ...data}}
 */
export const createSuccessResult = (data = {}) => ({
  ok: true,
  ...data
});

/**
 * Safe pristup nizu elemenata - filtrira nevalidne elemente.
 * @param {Array} elements - Niz elemenata
 * @returns {Array} Niz validnih elemenata
 */
export const filterValidElements = (elements) => {
  if (!Array.isArray(elements)) return [];
  return elements.filter(el => validateElement(el).valid);
};

/**
 * Pronalazi element po instanceId sa guard-om.
 * @param {Array} elements - Niz elemenata
 * @param {string} instanceId - ID elementa
 * @returns {object|null} Element ili null ako nije pronađen
 */
export const findElementWithGuard = (elements, instanceId) => {
  if (!Array.isArray(elements) || !instanceId) return null;
  const el = elements.find(e => e.instanceId === instanceId);
  if (!el) {
    console.warn(`Element sa instanceId "${instanceId}" nije pronađen.`);
  }
  return el || null;
};

/**
 * Provjerava da li je broj unutar opsega sa guard-om.
 * @param {number} value - Vrijednost za provjeru
 * @param {number} min - Minimum
 * @param {number} max - Maksimum
 * @param {string} fieldName - Naziv polja za error poruku
 * @returns {{valid: boolean, value: number, error?: string}}
 */
export const clampWithValidation = (value, min, max, fieldName = 'Vrijednost') => {
  const numValue = Number(value);
  
  if (isNaN(numValue)) {
    return {
      valid: false,
      value: min,
      error: `${fieldName} mora biti broj`
    };
  }
  
  if (numValue < min || numValue > max) {
    return {
      valid: false,
      value: Math.min(Math.max(numValue, min), max),
      error: `${fieldName} mora biti između ${min} i ${max}`
    };
  }
  
  return {
    valid: true,
    value: numValue
  };
};

/**
 * Loguje upozorenje ako projekat ima oštećene reference.
 * @param {object} project - Projekat koji se validira
 * @returns {object} Informacije o validaciji
 */
export const validateProjectIntegrity = (project) => {
  if (!project || !project.elements) {
    return { valid: false, errors: ['Projekat nije validan'], corruptCount: 0 };
  }
  
  const corruptElements = [];
  project.elements.forEach((el, idx) => {
    const validation = validateElement(el);
    if (!validation.valid) {
      corruptElements.push({ index: idx, instanceId: el.instanceId, errors: validation.errors });
    }
  });
  
  return {
    valid: corruptElements.length === 0,
    errors: corruptElements.flatMap(e => e.errors),
    corruptCount: corruptElements.length,
    corruptElements
  };
};
