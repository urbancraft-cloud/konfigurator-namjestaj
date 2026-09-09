// src/engine/shared/safeAccess.js
/**
 * Sigurni akcesori za rad sa podacima koji mogu biti nepotpuni ili nevalidni.
 * Rješava problem crash-eva kada stari projekti imaju reference na nepostojeće
 * dekore, template-e ili hardver.
 */

import { FALLBACK_TEMPLATE, templateById as originalTemplateById } from '../../data/catalog';
import { DECORS } from '../../data/decors';
import { HARDWARE } from '../../data/hardware';
import { PROFILES } from '../../data/profiles';

/**
 * Siguran pristup dekoru - vraća fallback ako dekor ne postoji.
 * @param {string} decorId - ID dekora
 * @returns {object} Dekor objekat ili fallback
 */
export const safeDecor = (decorId) => {
  if (!decorId || typeof decorId !== 'string') {
    return { 
      id: 'UNKNOWN', 
      code: 'UNKNOWN', 
      name: 'Nepoznat dekor', 
      price: 0,
      grain: 'uni' // default grain
    };
  }
  
  const decor = DECORS[decorId];
  if (!decor) {
    console.warn(`Dekor "${decorId}" nije pronađen u katalogu.`);
    return { 
      id: decorId, 
      code: decorId, 
      name: `Dekor ${decorId} (nije u katalogu)`, 
      price: 0,
      grain: 'uni'
    };
  }
  
  return decor;
};

/**
 * Siguran pristup template-u - već postoji u catalog.js, ali dodajemo dodatnu validaciju.
 * @param {string} templateId - ID template-a
 * @returns {object} Template objekat ili fallback
 */
export const safeTemplateById = (templateId) => {
  if (!templateId || typeof templateId !== 'string') {
    console.warn('Pokušan pristup template-u bez validnog ID.');
    return { ...FALLBACK_TEMPLATE, templateId: 'UNKNOWN' };
  }
  
  return originalTemplateById(templateId);
};

/**
 * Siguran pristup hardveru - vraća null ako hardver ne postoji.
 * @param {string} hardwareId - ID hardvera
 * @returns {object|null} Hardver objekat ili null
 */
export const safeHardware = (hardwareId) => {
  if (!hardwareId || typeof hardwareId !== 'string') {
    return null;
  }
  
  const hw = HARDWARE[hardwareId];
  if (!hw) {
    console.warn(`Hardver "${hardwareId}" nije pronađen u katalogu.`);
    return null;
  }
  
  return hw;
};

/**
 * Siguran pristup profilu - vraća null ako profil ne postoji.
 * @param {string} profileId - ID profila
 * @returns {object|null} Profil objekat ili null
 */
export const safeProfile = (profileId) => {
  if (!profileId || typeof profileId !== 'string') {
    return null;
  }
  
  const profile = PROFILES[profileId];
  if (!profile) {
    console.warn(`Profil "${profileId}" nije pronađen u katalogu.`);
    return null;
  }
  
  return profile;
};

/**
 * Validira da li element ima sve potrebne reference.
 * @param {object} el - Element koji se validira
 * @returns {{valid: boolean, missing: string[]}} Rezultat validacije
 */
export const validateElementReferences = (el) => {
  const missing = [];
  
  if (!el.templateId || !safeTemplateById(el.templateId)) {
    missing.push(`template:${el.templateId || 'missing'}`);
  }
  
  if (el.corpus?.decorId && !safeDecor(el.corpus.decorId)) {
    missing.push(`decor:${el.corpus.decorId}`);
  }
  
  if (el.front?.decorId && !safeDecor(el.front.decorId)) {
    missing.push(`frontDecor:${el.front.decorId}`);
  }
  
  if (el.handleId && !safeHardware(el.handleId)) {
    missing.push(`handle:${el.handleId}`);
  }
  
  if (el.runnerSystemId && !safeHardware(el.runnerSystemId)) {
    missing.push(`runner:${el.runnerSystemId}`);
  }
  
  if (el.profileId && !safeProfile(el.profileId)) {
    missing.push(`profile:${el.profileId}`);
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
};

/**
 * Popravlja element sa nevalidnim referencama koristeći fallback vrijednosti.
 * @param {object} el - Element koji se popravlja
 * @returns {object} Popravljeni element
 */
export const fixElementReferences = (el) => {
  const fixed = { ...el };
  
  // Fix corpus decor
  if (!fixed.corpus) fixed.corpus = {};
  if (!fixed.corpus.decorId || !DECORS[fixed.corpus.decorId]) {
    fixed.corpus = { ...fixed.corpus, decorId: 'W1000' }; // default white
  }
  
  // Fix front decor
  if (!fixed.front) fixed.front = {};
  if (!fixed.front.decorId || !DECORS[fixed.front.decorId]) {
    fixed.front = { ...fixed.front, decorId: 'W1000' };
  }
  
  // Fix handle
  if (!fixed.handleId || !HARDWARE[fixed.handleId]) {
    fixed.handleId = 'RUCKA_160'; // default handle
  }
  
  // Fix runner system
  if (fixed.runnerSystemId && !HARDWARE[fixed.runnerSystemId]) {
    fixed.runnerSystemId = 'GTV_BALL_500'; // default runner
  }
  
  return fixed;
};
