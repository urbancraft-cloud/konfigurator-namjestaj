// src/config/constants.js
/**
 * Centralizovane konstante i konfiguracijske vrijednosti.
 * Sadrži sve "magic numbers" iz projekta sa objašnjenjima.
 */

// ============================================================================
// GEOMETRIJA I DIMENZIJE
// ============================================================================

/** Minimalna visina elementa da bi se koristile 4 šarke umjesto 2 */
export const HINGE_HEIGHT_THRESHOLD_MM = 1200;

/** Tolerancija za spajanje kontinuiranih segmenata (mm) */
export const CONTIGUITY_TOL_MM = 2;

/** Minimalna dužina noge za L-kuhinju (mm) */
export const L_SHAPE_LEG_MIN_MM = 1200;

/** Maksimalna dužina noge za L-kuhinju (mm) */
export const L_SHAPE_LEG_MAX_MM = 2700;

/** Minimalna suma nogu za L-kuhinju (mm) */
export const L_SHAPE_SUM_MIN_MM = 4000;

/** Maksimalna suma nogu za L-kuhinju (mm) */
export const L_SHAPE_SUM_MAX_MM = 7900;

/** Standardna debljina panela (mm) */
export const PANEL_THICKNESS_DEFAULT_MM = 18;

/** Standardna debljina leđne ploče (mm) */
export const BACK_PANEL_THICKNESS_MM = 3;

/** Faktor otpada pri računanju materijala (15%) */
export const WASTE_FACTOR = 1.15;

// ============================================================================
// VREMENSKE KONFIGURACIJE
// ============================================================================

/** Vrijeme grupisanja undo operacija (ms) - kontinuirane izmjene se spajaju */
export const COALESCE_MS = 700;

/** Limit undo istorije (broj stavki) */
export const UNDO_LIMIT = 50;

/** Kašnjenje za automatsko čuvanje nacrta (ms) */
export const DRAFT_SAVE_DELAY_MS = 2500;

// ============================================================================
// UI KONFIGURACIJE
// ============================================================================

/** Širina lijevog panela (px) */
export const LEFT_RAIL_WIDTH_PX = 288;

/** Širina desnog panela (px) */
export const RIGHT_RAIL_WIDTH_PX = 320;

/** Breakpoint za uski ekran (px) */
export const NARROW_SCREEN_BREAKPOINT_PX = 768;

// ============================================================================
// HARDVER I MATERIJALI
// ============================================================================

/** Visina cokla (mm) */
export const PLINTH_HEIGHT_MM = 100;

/** Standardna visina radne ploče od poda (mm) */
export const WORKTOP_HEIGHT_FROM_FLOOR_MM = 850;

/** Minimalna širina fronte vrata (mm) */
export const DOOR_FRONT_MIN_WIDTH_MM = 300;

/** Maksimalna širina fronte vrata (mm) */
export const DOOR_FRONT_MAX_WIDTH_MM = 600;

/** Razmak između fronti (mm) */
export const FRONT_GAP_MM = 4;

// ============================================================================
// VALIDACIJA
// ============================================================================

/** Maksimalna dozvoljena greška pri poravnanju (mm) */
export const ALIGNMENT_TOLERANCE_MM = 1;

/** Minimalni razmak od zida za ugradbene aparate (mm) */
export const APPLIANCE_WALL_CLEARANCE_MM = 50;

// ============================================================================
// EKSPORT I UVOZ
// ============================================================================

/** Verzija formata za eksport projekata */
export const PROJECT_EXPORT_VERSION = '1.0';

/** Prefiks za ključeve u localStorage */
export const STORAGE_KEY_PREFIX = 'kitchen-planner-';

// ============================================================================
// POMOĆNE FUNKCIJE
// ============================================================================

/**
 * Provjerava da li je broj u razumnom opsegu za dimenzije.
 * @param {number} value - Vrijednost u mm
 * @param {number} min - Minimalna dozvoljena vrijednost
 * @param {number} max - Maksimalna dozvoljena vrijednost
 * @returns {boolean}
 */
export const isValidDimension = (value, min, max) => {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
};

/**
 * Zaokružuje vrijednost na najbliži korak.
 * @param {number} value - Vrijednost
 * @param {number} step - Korak
 * @returns {number}
 */
export const roundToStep = (value, step) => {
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
