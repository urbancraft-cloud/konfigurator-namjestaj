// src/store/withUndo.js
//
// Undo/redo za Zustand store-ove, kao generički middleware.
//
// Zašto ovo nedostaje je bio najveći funkcionalni problem aplikacije: „Očisti
// prostor" briše SVE elemente i instalacije bez potvrde, `Delete` briše element,
// a promjena dekora fronti prepisuje cijeli projekat — i ništa od toga se nije
// moglo vratiti. Jedini „oporavak" je bio učitati stariji snimak, ako ga ima.
//
// Pristup: snapshot cijelog praćenog dijela stanja (ne diff). Projekat je
// mali (desetak elemenata, nekoliko kB), pa je 60 snapshotova zanemarivo, a
// snapshot se ne može „pokvariti" kao patch logika.
//
// Koalescencija: kontinuirane izmjene (prevlačenje elementa, kliznici za
// dimenzije) bi inače napravile po jedan unos u historiji za SVAKI korak —
// korisnik bi morao pritisnuti Ctrl+Z pedeset puta da poništi jedno
// prevlačenje. Takve izmjene se grupišu u jedan dok traju.

/** Koliko se koraka unazad pamti. */
export const UNDO_LIMIT = 60;

/**
 * Kontinuirane izmjene se grupišu ako je prošlo manje od ovoliko ms od
 * prethodne izmjene ISTE vrste.
 */
export const COALESCE_MS = 700;

/**
 * @param {Function} config         Zustand store creator `(set, get, api) => ({…})`
 * @param {object}   options
 * @param {string[]} options.keys   Ključevi stanja koji ulaze u historiju
 *                                  (npr. `['room', 'rawProject']`).
 * @param {number}  [options.limit] Najviše koraka unazad.
 * @returns {Function}              Middleware za `create(...)`.
 *
 * @example
 * export const useProjectStore = create(
 *   withUndo((set, get) => ({ … }), { keys: ['room', 'rawProject'] })
 * );
 */
export function withUndo(config, options) {
  const opts = options || {};
  const keys = opts.keys || [];
  const limit = opts.limit || UNDO_LIMIT;

  /**
   * `record` u trećem argumentu `set`-a:
   *   undefined | 'discrete' → novi unos u historiji
   *   'drag'                  → grupiše se sa prethodnim iste vrste
   *   false                   → NE bilježi se (učitavanje projekta, undo/redo)
   */
  return (set, get, api) => {
    /* `config` se MORA pozvati tačno jednom — i to sa `wrappedSet`. Poziv sa
       originalnim `set`-om (kao što je stajalo u prvoj verziji) izvršio bi sve
       inicijalizatore dvaput, pa bi `DEFAULT_PROJECT()` dvaput pozvao
       `createPlaced` i potrošio ID-jeve, a akcije bi bile duplicirane. */
    const past = [];
    const future = [];
    let lastKind = null;
    let lastAt = 0;

    const snapshot = () => {
      const s = get();
      const o = {};
      keys.forEach((k) => { o[k] = s[k]; });
      return o;
    };

    const notify = () => {
      api.setState({ canUndo: past.length > 0, canRedo: future.length > 0 });
    };

    const wrappedSet = (partial, replace, record) => {
      /* `record === false` je JEDINI način da se izmjena preskoči — koristi se za
         učitavanje projekta i za sam undo/redo. Sve ostalo (uključujući
         `undefined`, tj. običan `set({...})` kakav koristi većina akcija) se
         bilježi kao diskretan korak.

         Paziti: prva verzija je obrnuto tretirala `undefined` (nije bilježila
         ništa osim eksplicitno označenih izmjena), pa undo uopšte nije radio —
         `removeElement` i `setRawProject` zovu `set` sa dva argumenta. */
      if (record === false) {
        set(partial, replace);
        lastKind = null;                       // prekida lanac koalescencije
        return;
      }

      const now = Date.now();
      const coalesce = record === 'drag'
        && lastKind === 'drag'
        && (now - lastAt) < COALESCE_MS
        && past.length > 0;

      if (!coalesce) {
        past.push(snapshot());
        if (past.length > limit) past.shift();
        future.length = 0;                     // nova izmjena briše redo granu
      }
      lastKind = record;
      lastAt = now;

      set(partial, replace);
      notify();
    };

    /* `config` dobija `wrappedSet`, pa svaka akcija u store-u prolazi kroz
       historiju bez ikakvih izmjena u samim akcijama. */
    const initial = config(wrappedSet, get, api);

    return {
      ...initial,
      canUndo: false,
      canRedo: false,
      undoDepth: () => past.length,
      redoDepth: () => future.length,

      undo: () => {
        if (!past.length) return false;
        future.push(snapshot());
        const prev = past.pop();
        lastKind = null;
        set(prev, false, false);                // bez bilježenja (inače beskonačna petlja)
        notify();
        return true;
      },

      redo: () => {
        if (!future.length) return false;
        past.push(snapshot());
        const next = future.pop();
        lastKind = null;
        set(next, false, false);
        notify();
        return true;
      },

      /**
       * Briše historiju bez diranja stanja.
       * Poziva se nakon učitavanja projekta: korisnik ne treba da može
       * „poništiti" samo učitavanje i tako se vratiti na pola sačuvanog stanja.
       */
      clearHistory: () => {
        past.length = 0;
        future.length = 0;
        lastKind = null;
        notify();
      },
    };
  };
}

export default withUndo;
