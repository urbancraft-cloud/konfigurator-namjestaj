# Faza 2 — izvještaj o implementaciji

**Datum:** 2026-09-08 · **Testovi:** 102 → **169** · **Lint:** 9 → **7 upozorenja, 0 grešaka**

---

## Stanje

| Provjera | Nakon Faze 1 | Nakon Faze 2 |
|---|---|---|
| `npm test` | 102 prolaze | **169 prolazi** (9 fajlova, 43 s) |
| `npm run lint` | 9 upozorenja | **7 upozorenja, 0 grešaka** |
| `no-undef` | 0 grešaka | 0 grešaka |
| `npm run build` | ✅ 2,5 s | ✅ 2,4 s |

Novi test fajlovi: `surfaces.test.js` (14), `bom.test.js` (12), `store.test.js` (23) i
+11 integracijskih (Modal, tok čuvanja).

---

## 🔴 BUG-12 · Fiktivne završne maske za visoke elemente

**Problem:** `computeEndPanels` je za base/wall nizove provjeravao `endExposed()`, ali je
petlja po visokim elementima generisala maske **bezuvjetno** — samo je preskakala slučaj
kad je susjed također visok. Frižider uz zid dobijao je masku na strani gdje je zid.

Tokom popravke našao sam **još dva dublja problema** u istoj funkciji:

### 12a · Proverni pravougaonik se preklapao sa samim elementom
`sideIsClear` je koristio inset `+3/-3` mm. Pošto se maska lijepi **direktno uz**
element, tih 3 mm su uvijek zalazili u njegov AABB, a `overlaps` sa `eps=2` je vraćao
`true` → funkcija je javljala „nije izloženo" **čak i kad je prostor bio potpuno prazan**.

```diff
-const r = bandRect(wall, a0 + 3, a1 - 3, room, 0, D);
+const r = bandRect(wall, a0 + 1, a1 - 1, room, 0, D);
+if (r.x1 <= r.x0 || r.z1 <= r.z0) return false;
```
Plus: elementi čiji se kraj provjerava sada se **izuzimaju** iz provjere
(`run.elements` za nizove, `[el]` + njegova `_nad` nadgradnja za visoke).

### 12b · Proverni pojas od 200 mm odbijao je maske koje fizički stanu
Za visoke elemente maska je 18 mm, a provjera je gledala pojas od **200 mm**. Susjed
udaljen 100 mm blokirao je masku koja tamo komotno staje.

Sada `tallEndExposed` provjerava **tačno onoliko koliko maska zauzima**:
```js
const a0 = side === 'start' ? el.offset - t : el.offset + el.dims.width;
const a1 = side === 'start' ? el.offset     : el.offset + el.dims.width + t;
```
(`endExposed` za base/wall nizove zadržava 200 mm — to je ugrađeno ponašanje za
radne ploče i obloge, ne diram ga bez vaše potvrde.)

### Izmjeren efekat

Realna kuhinja: frižider i pećnica uz **lijevi zid** (offset 0 i 600), donji niz na
gornjem zidu, viseći elementi.

| | Prije | Poslije |
|---|---|---|
| tall maski | 4 (po 2 na svaki visoki element) | **2** (samo `end` strane) |
| Ukupno maski | 6 | **4** |
| Ukupna površina maski | ~5,5 m² | **2,65 m²** |
| Cijena maski | ~343 KM | **164,64 KM** |

**≈ 178 KM uštede po ovoj kuhinji**, i 2 reda manje u krojnoj listi koja se ne može
proizvesti (maska debljine 18 mm ne može stati između elementa i zida).

**Pokriveno:** `src/engine/surfaces.test.js` — 14 testova (uz zid, na kraju zida, u
sredini, dva susjedna visoka, visoki uz donji sa `trimmedForSocle`, procjep uži od
maske, poštovanje zadate debljine, regresija za base/wall).

---

## 🔴 BUG-20 · „Brzo sačuvaj" i „Sačuvaj kao" se nisu poznavali

**Problem:** „Brzo sačuvaj" je uvijek pisalo u `kuhinja:projekt`, a „Sačuvaj kao" u
`kuhinja:projects:<ime>`. Korisnik bi učitao „Hadžić", izmijenio ga, kliknuo „Brzo
sačuvaj" — izmjene bi otišle u brzi slot, a „Hadžić" bi ostao nepromijenjen. **Pri
sljedećem učitavanju izmjene su bile izgubljene.**

**Rješenje:** uveden `activeProjectName` u store.

| Akcija | Prije | Poslije |
|---|---|---|
| `loadProjectByName('X')` | postavi projekat | postavi projekat **+ `activeProjectName = 'X'`** |
| `saveProjectAs('X')` | sačuvaj | sačuvaj **+ `activeProjectName = 'X'`** |
| `saveProject()` | uvijek u `kuhinja:projekt` | ako je aktivan → **u `kuhinja:projects:X`**, inače u brzi slot |
| `loadProject()` | postavi projekat | postavi projekat + `activeProjectName = null` |
| `deleteProject('X')` | obriši | obriši + ako je bio aktivan → `null` |

**Vidljivo u UI:**
- natpis dugmeta se mijenja: **„Brzo sačuvaj"** → **„Sačuvaj: Hadžić"**
- značka **„aktivan"** pored imena projekta u zaglavlju i u listi za učitavanje
- objašnjenje u dijalogu za učitavanje
- poruka nakon čuvanja govori **gdje** je sačuvano

Sve `save*`/`load*`/`delete*` akcije sada vraćaju `{ ok, reason, slot, name, notes }`
umjesto golog `true`/`false`.

**Pokriveno:** 12 testova u `store.test.js` + 3 integracijska (stvarni klikovi kroz
„Sačuvaj kao" → izmjena → „Sačuvaj" → provjera `localStorage`).

---

## 🔴 BUG-21 · Tiho odbacivanje izmjena

Sve akcije sada vraćaju `{ ok, reason }` i UI to javlja korisniku:

| Akcija | Prije | Poslije |
|---|---|---|
| `dragElement` | `return p` (tiho) | `{ ok:false, reason:'Kolizija sa susjednim elementom ili preprekom (prozor/vrata).', hit:'<id>' }` |
| `moveToWall` | `return p` (tiho) | `{ ok:false, reason:'Na tom zidu nema slobodnog mjesta za element.' }` ili `'Element od 1200 mm ne staje na zid dužine 900 mm.'` |
| `addElement` | `return null` | `{ ok:false, reason:'Nema slobodnog mjesta na zidu za element širine 600 mm.' }` |
| `addItem` (ormar) | `return null` | razlikuje: nepostojeći segment / korpus bez visine / element viši od korpusa / nema slobodne pozicije |
| `moveItem` (ormar) | `return p` (tiho) | `'Na 900 mm se preklapa sa susjednim elementom (Ladičar) — slobodno tek iznad 1092 mm.'` |

Dodat **`flashThrottled(msg, ms)`** u `uiStore` — za poruke koje se mogu okinuti na
svaki `pointermove` (prevlačenje). Ista poruka se ne prikazuje ponovo prije 1,4 s,
pa korisnik dobije objašnjenje **jednom** kad naleti na koliziju, a ne 60 puta u sekundi.

### Usput popravljen stvarni UX bug u snap-u

`applySnap` je birao **najbližeg** kandidata bez provjere kolizije. Ako je taj kandidat
bio zauzet, odbijalo se **cijelo** pomjeranje — element se pri prevlačenju „zalijepio"
i nije pratio kursor.

```js
// Sada: kandidati unutar tolerancije, poredani po udaljenosti, prvi SLOBODAN
const cands = snapCandidates(el, rp, room)
  .filter((c) => Math.abs(c - raw) <= SNAP_TOLERANCE_MM)
  .sort((a, b) => Math.abs(a - raw) - Math.abs(b - raw));
const slobodan = cands.find((c) => !probeAt(c));
if (slobodan != null) { off = slobodan; snapped = true; }
```
Snap više **ne može** blokirati slobodno pomjeranje.

### Direktni upis odmaka više ne „zaokružuje"

Polje „Odmak duž zida" u desnom panelu zvalo je `dragElement(id, v)` **sa** snap-om, pa
bi korisnik upisao `1234` a dobio `1240`. Sada:
```js
dragElement(selected.instanceId, v, { snap: false })
```
Prevlačenje mišem i dalje ima snap (tako i treba); direktni upis je tačan.

**Pokriveno:** 11 testova u `store.test.js` (uključujući 3 nova za snap ponašanje).

---

## 🔴 BUG-17 · Ormar se mogao sačuvati ali ne i učitati

`loadWardrobeProject` je postojao u store-u, ali ga **nijedan dio UI-a nije zvao**
(potvrđeno `grep`-om). Pokretanje čarobnjaka bi resetovalo ormar na `DEFAULT_WARDROBE()`.

Dodato dugme **„Učitaj"** u `WardrobeHeader` + poruka o uspjehu/razlogu + napomene o
ispravkama pri učitavanju starijeg zapisa.

---

## 🟠 BUG-22 · Panel „Sadržaj" je nestajao zajedno sa podacima

`WardrobeSegmentRail.jsx:136` je imao `{seg && !upperInvalid && (...)}`. Čim bi gornji
korpus pao na ≤ 0, **nestajao je cijeli panel** — uključujući sve ladičare, šipke i
police koje je korisnik dodao u **donji** korpus. Podaci su ostajali u store-u ali ih
se nije moglo ni vidjeti ni urediti.

Sada je panel **uvijek** tu; poruka o grešci zamjenjuje samo dugmad za dodavanje kad je
gornji korpus neupotrebljiv, a postojeći elementi se i dalje mogu uređivati i brisati.

---

## 🟠 BUG-23 · Modal bez osnovne UX i a11y zaštite

`Modal.jsx` je bio samo `<div className="fixed inset-0">` sa sadržajem. Sada:

| | Prije | Poslije |
|---|---|---|
| **Esc** | ne radi | zatvara dijalog |
| **Klik van** | ne radi | zatvara (samo ako je kliknut overlay, ne sadržaj) |
| **Skrol pozadine** | vrti se ispod dijaloga | `body.overflow = hidden` + kompenzacija širine scrollbar-a |
| **`role="dialog"` / `aria-modal`** | nema | ima, uz `aria-label` iz naslova |
| **Focus trap** | nema | Tab/Shift+Tab ostaju unutar dijaloga |
| **Početni fokus** | ostaje na dugmetu ispod | prvi input/dugme u dijalogu |
| **Vraćanje fokusa** | nema | na element koji je otvorio dijalog |
| `dismissable` prop | — | moguće isključiti zatvaranje (za obavezne dijaloge) |

**Pokriveno:** 5 integracijskih testova (Esc, klik van, klik unutar **ne** zatvara,
aria atributi, X dugme) + provjera da se `body.style.overflow` vrati nakon zatvaranja.

---

## 🟠 BUG-16 · Ostatak grešaka u kalkulaciji ormara

| Linija | Prije | Poslije |
|---|---|---|
| `wardrobePricing.js:44–46` | leđa `širina × visina` **ukupno** | **po segmentu**: `segmentCount × širinaSegmenta × visina` |
| `wardrobePricing.js:143` | `push(..., widthMm, 100, ...)` — tvrdo kodirano | `TOP_MASK_H` konstanta |
| `wardrobePricing.js:163` | 1 red „dno/bok/leđa kutije" × pune dubine po ladici | raspisano: **bok (2×), čelo/leđa (2×), pod (1×)** sa stvarnim mjerama |
| `wardrobePricing.js:57` | `segmentCount * 2 * 6` (magični broj) | `HINGE_DOOR_HW_PER_LEAF_KM` konstanta, po krilu |

### Novi `DRAWER_BOX_HEIGHT_MM = 140`
Sanduk ladice se sada raspisuje na stvarne dijelove. Za ladičar od 3 ladice u segmentu
širine 776 mm, dubine 580 mm:

| Dio | Kom | Mjere |
|---|---|---|
| Bok sanduka | 6 | 480 × 140 |
| Čelo/leđa sanduka | 6 | 740 × 140 |
| Pod sanduka | 3 | 480 × 740 |

Prije: 3 reda „776 × 580" (svaka ladica je dobijala kompletan sanduk pune dubine).

### PDV više nije duplo definisan
`wardrobePricing.js` je imao `net * 0.17` tvrdo kodirano, dok kuhinja koristi
`VAT_RATE` iz `data/tech.js`. Promjena stope bi tiho zaobišla ormar. Sada oba modula
koriste istu konstantu.

---

## 🟡 BUG-11 (nadopuna) · `validateTriangle` je imao `NaN` zbir

Dok sam pisao testove za Fazu 2 naišao sam na ovo: ključ u objektu `legs` bio je
`frizidercSudoper` (tipfeler, višak „c"), a `sum` ga je čitao kao `friziderSudoper` →
`undefined` → **`NaN`**.

Posljedica: `badSum = NaN < 4000 || NaN > 7900` → uvijek `false`, pa **kontrola zbira
krakova (4,0–7,9 m) uopšte nije radila**. Korisnik je u panelu „Radni trokut" vidio
`zbir: NaN mm`.

```diff
-const legs = { sudoperPloca: ..., plocaFrizider: ..., frizidercSudoper: dist(fridge, sink) };
-const sum = legs.sudoperPloca + legs.plocaFrizider + legs.frizidercSudoper;
+const legs = { sudoperPloca: ..., plocaFrizider: ..., friziderSudoper: dist(fridge, sink) };
+const sum = legs.sudoperPloca + legs.plocaFrizider + legs.friziderSudoper;
```
Ažurirano i u `LeftRail.jsx:119` gdje se taj ključ čita za prikaz.

**Napomena o normi:** gornja granica zbira (7900 mm) je u pravih kuhinja nedostićna —
zbir tri kraka od kojih je svaki ≤ 2700 mm ne može preći 8100 mm, a kod pravouglog
rasporeda hipotenuza uvijek prije probije granicu **po kraku**. Zato se javlja
„krak izvan 1,2–2,7 m", a ne „zbir izvan". Donja granica (4000 mm) je dostižna samo u
rasporedu u istoj liniji. Testovi to dokumentuju umjesto da forsiraju nemoguće brojeve.

---

## 🟡 Ostale popravke

| # | Fajl | Šta |
|---|---|---|
| 1 | `engine/bom.js` | **`csvField()`** — CSV separator je `;` bez escaping-a; nazivi dekora/traka mogu ga sadržavati (`ABS 0,8 × 23; laser`) pa bi se kolone pomjerile u Excelu. Sada RFC 4180 quoting |
| 2 | `engine/bom.js` | `EDGE_TYPES[id].name` i `PROFILES[id].name` bez zaštite → crash pri izvozu ako id nije poznat. Sada fallback na sam id |
| 3 | `engine/bom.js` | Okov u CSV-u dobija i **jednicu** (m/kom/set) — bez nje se gola metraža nije mogla razlikovati od komada |
| 4 | `engine/bom.js` | Zaokruživanje agregata: `11.299999999999997 m` u krojnoj listi → `r1()` |
| 5 | `components/app/BomModal.jsx` | `document.execCommand('copy')` je deprecated i tiho ne radi u dijelu preglednika → **Async Clipboard API** sa starom metodom kao rezervom, stvarnom provjerom uspjeha i vidljivim `<textarea>` ako preglednik odbije pristup |
| 6 | `components/layout/RightRail.jsx` | `max={2600}` za „Visina montaže" tvrdo kodirano → `max={room.height}` (sobа ide do 3200) |
| 7 | `components/layout/LeftRail.jsx` | `720` i `600` tvrdo kodirani u prikazu podnožja → `CORPUS_BASE_H` i `project.worktopDepthMm`; dodat red „visina korpusa" |
| 8 | `components/layout/LeftRail.jsx` | `Field max={wallLength(...)}` za poziciju ploče za kuhanje dozvoljavao je centru da dođe na sam kraj zida → pola ploče viri van. Sada `min = širina/2`, `max = dužinaZida − širina/2` |
| 9 | `components/layout/LeftRail.jsx` | `handleAdd`: tihi `return` kad širina nije u granicama → sada `flash()` sa porukom |
| 10 | `App.jsx` | Popunjene zavisnosti `useEffect`-a za učitavanje dekora |
| 11 | `index.html` | `lang="en"` → `lang="bs"`; `<title>kuhinja-konfigurator` → „Konfigurator kuhinja i ormara"; dodat `meta description` i `theme-color` |
| 12 | `engine/surfaces.js` | `_run` umjesto nekorištenog parametra `r` |
| 13 | `engine/layout.js` | `frontAlignOffset(el, project)` — uklonjen nekorišteni parametar `room` |
| 14 | Mrtav kod | Obrisani: `freeIntervals`, `fitNear`, `blindCornerRule` (layout.js), `topMaskSpanMm`, `itemOverflows` (wardrobeLayout.js), `toggleWalk`, `toggleMeasure` (uiStore), `clearAll` (projectStore) — **svi potvrđeno nekorišteni grep-om**, sa komentarom zašto su uklonjeni |

Zadržani mrtvi izvozi: `loadProject` (parnjak „brzog snimka" — UI trenutno ima samo
„Učitaj projekat" za imenovane; ostavljen jer je dio javnog API-ja store-a).

---

## Preostala upozorenja lintera (7, sva bezopasna i objašnjena)

| Upozorenje | Zašto ostaje |
|---|---|
| 3× `useMemo has unnecessary dependency: decorVersion` | **Namjerno** — `decorVersion` je cache-bust za mutaciju modula `DECORS` |
| `set-state-in-effect` u `Controls.jsx:70` | Sinhronizacija draft stanja sa vanjskom vrijednošću — legitimni obrazac |
| `missing dependency: room` u `Viewport3D.jsx:364` | Efekat namjerno prati samo `room.width/depth/height` |
| `Parameter 'project' is never used` u `pricing.js` | `computePrice(el, project)` — potpis je dio javnog API-ja; 14 pozivalaca |

---

## Šta je ostalo za Fazu 3 (performanse)

Mjerenja iz originalnog pregleda i dalje stoje:

| # | Problem | Efekat |
|---|---|---|
| PERF-02 | Prevlaka elementa = potpuna rekonstrukcija scene + `computeBOM` **2×** po renderu | `computeBOM` za 14 elemenata = **4,36 ms**, na svaki `pointermove` |
| PERF-03 | `requestAnimationFrame` petlja renderuje 60 fps **zauvijek**, i u mirovanju | GPU/baterija; na integriranoj grafici usporava cijelu stranicu |
| PERF-04 | THREE materijali i `CanvasTexture` se nikad ne oslobađaju; `WardrobeViewport3D` pravi **novi** `LineBasicMaterial` po svakoj ivici svake kutije | curenje memorije pri svakoj promjeni dimenzija sobe |
| PERF-05 | `PlanView2D` računa sve površine **inline u renderu**, bez `useMemo` | — |
| PERF-06 | `validateInProject` je O(n²) i zove se na **4 mjesta** | 784 provjere kolizije po renderu za 14 elemenata |
| PERF-07 | Bundle **976 kB** bez code-splittinga | `three` se učitava i korisniku koji gleda samo tlocrt |

Najveći dobitak za najmanje rizika: **PERF-02** (jedan `derived` useMemo u `App.jsx` +
commit prevlačenja na `pointerup`) i **PERF-07** (`React.lazy` za `Viewport3D` i
`WardrobeApp`).

---

## ⚠️ I dalje trebam vašu potvrdu (nije blokiralo Fazu 2)

Sve su konstante u `src/data/wardrobe.js` — mijenjaju se na jednom mjestu:

```js
GOLA_METERS_PER_FRONT   = 1.0    ← jedan profil po fronti? ili po elementu (0.0)?
DRAWER_BOX_HEIGHT_MM    = 140    ← visina boka sanduka ladice u ormaru
SLIDING_HW_PER_LEAF_KM  = 90     ← bilo paušalno 180 KM za 2 krila
SLIDING_LEAF_LIMITS     = 600–1500, korak 10
HINGE_DOOR_HW_PER_LEAF_KM = 6    ← naslijeđeno iz `segmentCount * 2 * 6`
SLIDING_MATERIAL_FACTOR = 1.1    ← naslijeđeno iz postojećeg koda
```

I dva pitanja iz cjenovnika:
1. `data/hardware.js` ima samo **„Nogica podesiva 100 mm" (1,20 KM)**, a kuhinja
   dozvoljava i `legHeightMm = 150`. Za 150 mm se u krojnoj listi i dalje navodi
   „Nogica podesiva 100 mm". Treba li druga stavka u cjenovniku?
2. `HARDWARE.PUSH` i `HANDLES.PUSH` su **duplikat** istog artikla (4,90 KM) na dva
   mjesta. Sada se koristi onaj iz `HARDWARE`. Treba li jedan obrisati?

---

## Napomena o E2E testu

`e2e/smoke.mjs` (Playwright) i dalje **ne radi u mom okruženju** — sandbox ima
`/dev/shm` od 64 MB pa Chromium pada pri pokretanju. Kod vas:
```bash
npx playwright install chromium
npm run test:e2e
```
Sve što bi E2E pokrio sada je pokriveno integracijskim testovima u jsdom-u
(19 testova, stvarni klikovi kroz cijelo stablo), koji prolaze.
