// src/utils/storage.js
//
// Pristup lokalnoj pohrani sa STVARNOM obradom grešaka.
//
// Šta je ovdje ranije stajalo: polyfill koji je na `window` kačio objekat
// `window.storage` sa async metodama `get/set/delete/list`, od kojih je svaka
// interno radila `try { … } catch { return null }`.
//
// Tri problema sa tim:
//   1. `window.storage` nije API ijednog preglednika — bio je ostatak iz drugog
//      runtime-a, pa je `main.jsx` morao da ga importuje PRVI sa komentarom
//      „MORA se učitati PRIJE App.jsx". Taj redoslijed importovanja je krhka
//      stvar koju je lako slučajno razbiti.
//   2. `catch { return null }` **guta pravi uzrok**. Najčešći stvarni kvar je
//      `QuotaExceededError` kad `localStorage` napuni (Safari u privatnom režimu,
//      ili kad se nagomila projekata) — korisnik je dobijao generičko „Greška pri
//      čuvanju", bez ikakve šanse da shvati da treba obrisati stare projekte.
//   3. Async potpis nad sinhronim `localStorage`-om značio je `await` na svakom
//      pozivu bez ikakve stvarne koristi.
//
// Sada: jedna sinhrona funkcija po operaciji koja vraća `{ ok, … }` ili
// `{ ok:false, reason }` sa ljudski čitljivim razlogom. `storageAvailable()` se
// provjeri JEDNOM pri pokretanju, pa privatni režim daje jasnu poruku umjesto
// tihih neuspjeha na svaku akciju.

import {
  QUICK_SAVE_KEY, namedKey, PROJECTS_PREFIX, DECORS_KEY, WARDROBE_KEY, DRAFT_KEY,
} from './storageKeys';

/** Detaljan, čitljiv razlog za neuspjeh — ne generički „catch". */
function reasonFor(e, operacija) {
  const name = (e && e.name) || '';
  const msg = (e && e.message) || String(e || '');
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || /quota/i.test(msg)) {
    return `${operacija}: lokalna pohrana je puna. Obrišite stare projekte (Učitaj projekat → ikona korpe) ili izvezite pa obrišite.`;
  }
  if (name === 'SecurityError' || /denied|permission|security/i.test(msg)) {
    return `${operacija}: preglednik je odbio pristup lokalnoj pohrani (privatni režim ili blokirani kolačići).`;
  }
  return `${operacija}: ${msg || 'nepoznata greška'}`;
}

let _available = null;

/**
 * Da li je `localStorage` uopšte upotrebljiv.
 * Provjerava se jednom — u Safarijevom privatnom režimu i `getItem` može baciti.
 */
export function storageAvailable() {
  if (_available !== null) return _available;
  try {
    const probe = '__konfigurator_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    _available = true;
  } catch {
    _available = false;
  }
  return _available;
}

export function read(key) {
  if (!storageAvailable()) return { ok: false, reason: 'Lokalna pohrana nije dostupna u ovom pregledniku.' };
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? { ok: false, reason: 'Nema zapisa pod tim ključem.', missing: true }
                          : { ok: true, value };
  } catch (e) {
    return { ok: false, reason: reasonFor(e, 'Čitanje') };
  }
}

export function write(key, value) {
  if (!storageAvailable()) return { ok: false, reason: 'Lokalna pohrana nije dostupna u ovom pregledniku.' };
  try {
    window.localStorage.setItem(key, value);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: reasonFor(e, 'Čuvanje') };
  }
}

export function remove(key) {
  if (!storageAvailable()) return { ok: false, reason: 'Lokalna pohrana nije dostupna u ovom pregledniku.' };
  try {
    window.localStorage.removeItem(key);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: reasonFor(e, 'Brisanje') };
  }
}

/** Svi ključevi sa datim prefiksom. */
export function keys(prefix = '') {
  if (!storageAvailable()) return [];
  try {
    const out = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
    return out;
  } catch {
    return [];
  }
}

export { QUICK_SAVE_KEY, namedKey, PROJECTS_PREFIX, DECORS_KEY, WARDROBE_KEY, DRAFT_KEY };
