// src/utils/formatters.js

/** Zaokruživanje na 1 decimalu */
export const r1 = (n) => Math.round(n * 10) / 10;

/** Formatiranje valute (KM) */
export const fmt = (n) => n.toLocaleString('bs-BA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });