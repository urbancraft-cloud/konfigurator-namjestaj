// src/engine/shared/geometry.js
/**
 * Zajedničke geometrijske funkcije koje se koriste u kuhinji i ormarima.
 * Rješava problem duplicirane logike između kitchen i wardrobe engine-a.
 */

import { CONTIGUITY_TOL_MM, HINGE_HEIGHT_THRESHOLD_MM } from '../../config/constants';

/**
 * Provjerava da li se dva segmenta preklapaju ili dodiruju.
 * @param {number} start1 - Početak prvog segmenta
 * @param {number} end1 - Kraj prvog segmenta
 * @param {number} start2 - Početak drugog segmenta
 * @param {number} end2 - Kraj drugog segmenta
 * @returns {boolean}
 */
export const segmentsOverlap = (start1, end1, start2, end2) => {
  return start1 <= end2 && start2 <= end1;
};

/**
 * Provjerava da li su dva segmenta kontinuirana (dodiruju se unutar tolerancije).
 * @param {number} end1 - Kraj prvog segmenta
 * @param {number} start2 - Početak drugog segmenta
 * @returns {boolean}
 */
export const areSegmentsContiguous = (end1, start2) => {
  return Math.abs(end1 - start2) <= CONTIGUITY_TOL_MM;
};

/**
 * Spaja kontinuirane segmente u veće grupe.
 * @param {Array<{offset: number, length: number}>} segments - Lista segmenata
 * @returns {Array<{start: number, end: number, length: number}>}
 */
export const mergeContiguousSegments = (segments) => {
  if (!segments || segments.length === 0) return [];
  
  // Sort by offset
  const sorted = [...segments].sort((a, b) => a.offset - b.offset);
  
  const merged = [];
  let current = {
    start: sorted[0].offset,
    end: sorted[0].offset + sorted[0].length
  };
  
  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i];
    const segEnd = seg.offset + seg.length;
    
    if (areSegmentsContiguous(current.end, seg.offset)) {
      // Produži trenutni segment
      current.end = Math.max(current.end, segEnd);
    } else {
      // Sačuvaj trenutni i započni novi
      merged.push({
        start: current.start,
        end: current.end,
        length: current.end - current.start
      });
      current = { start: seg.offset, end: segEnd };
    }
  }
  
  // Dodaj posljednji segment
  merged.push({
    start: current.start,
    end: current.end,
    length: current.end - current.start
  });
  
  return merged;
};

/**
 * Računa broj šarki potrebnih za vrata na osnovu visine.
 * @param {number} heightMm - Visina vrata u mm
 * @returns {number} Broj šarki po krilu
 */
export const calculateHingesPerLeaf = (heightMm) => {
  return heightMm > HINGE_HEIGHT_THRESHOLD_MM ? 4 : 2;
};

/**
 * Računa ukupan broj šarki za listu vrata.
 * @param {Array<{height: number}>} doors - Lista vrata sa visinama
 * @returns {number} Ukupan broj šarki
 */
export const calculateTotalHinges = (doors) => {
  if (!doors || !Array.isArray(doors)) return 0;
  
  return doors.reduce((total, door) => {
    return total + calculateHingesPerLeaf(door.height);
  }, 0);
};

/**
 * Provjerava da li je vrijednost unutar dozvoljenog opsega.
 * @param {number} value - Vrijednost za provjeru
 * @param {number} min - Minimum
 * @param {number} max - Maksimum
 * @returns {boolean}
 */
export const isInRange = (value, min, max) => {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
};

/**
 * Zaokružuje vrijednost na najbliži korak.
 * @param {number} value - Vrijednost
 * @param {number} step - Korak
 * @returns {number}
 */
export const roundToStep = (value, step) => {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
};

/**
 * Clamp vrijednost između minimuma i maksimuma.
 * @param {number} value - Vrijednost
 * @param {number} min - Minimum
 * @param {number} max - Maksimum
 * @returns {number}
 */
export const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Računa preklapanje dva pravougaonika.
 * @param {object} rect1 - Prvi pravougaonik {x, y, width, height}
 * @param {object} rect2 - Drugi pravougaonik {x, y, width, height}
 * @returns {object|null} Preklapanje ili null ako nema preklapanja
 */
export const rectangleIntersection = (rect1, rect2) => {
  const x1 = Math.max(rect1.x, rect2.x);
  const y1 = Math.max(rect1.y, rect2.y);
  const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
  const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
  
  if (x1 < x2 && y1 < y2) {
    return {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1
    };
  }
  
  return null;
};

/**
 * Provjerava da li se dva pravougaonika preklapaju.
 * @param {object} rect1 - Prvi pravougaonik {x, y, width, height}
 * @param {object} rect2 - Drugi pravougaonik {x, y, width, height}
 * @returns {boolean}
 */
export const rectanglesOverlap = (rect1, rect2) => {
  return rectangleIntersection(rect1, rect2) !== null;
};

/**
 * Računa udaljenost između dvije tačke.
 * @param {number} x1 - X koordinata prve tačke
 * @param {number} y1 - Y koordinata prve tačke
 * @param {number} x2 - X koordinata druge tačke
 * @param {number} y2 - Y koordinata druge tačke
 * @returns {number} Udaljenost
 */
export const distance = (x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Normalizuje ugao na opseg [0, 360).
 * @param {number} angle - Ugao u stepenima
 * @returns {number} Normalizovani ugao
 */
export const normalizeAngle = (angle) => {
  let normalized = angle % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
};
