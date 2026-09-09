// src/utils/storageKeys.js
//
// Ključevi lokalne pohrane na jednom mjestu.
// Izdvojeni iz `projectStore.js` da ih `utils/storage.js` može koristiti bez
// kružne zavisnosti (store → schema → defaults, a storage ne smije vući store).

/** „Brzi snimak" — jedan zapis bez imena, preko dugmeta „Brzo sačuvaj". */
export const QUICK_SAVE_KEY = 'kuhinja:projekt';

/** Prefiks imenovanih projekata („Sačuvaj kao…"). */
export const PROJECTS_PREFIX = 'kuhinja:projects:';

/** Ključ za konkretan imenovani projekat. */
export const namedKey = (name) => `${PROJECTS_PREFIX}${name}`;

/** Korisnički dodati dekori (iz dijaloga „Ubaci dekor"). */
export const DECORS_KEY = 'konfigurator:dekori';

/**
 * Automatski sačuvan nacrt. Zaseban ključ od brzog snimka i imenovanih
 * projekata — automatsko čuvanje nikad ne smije prepisati ono što je korisnik
 * namjerno sačuvao.
 */
export const DRAFT_KEY = 'kuhinja:nacrt';

/** Projekat ormara (spavaća soba). */
export const WARDROBE_KEY = 'kuhinja:ormar';

