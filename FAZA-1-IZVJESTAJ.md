# Faza 1 — izvještaj o implementaciji

**Datum:** 2026-09-08 · **Obim:** 26 fajlova (5 novih, 21 izmijenjen) · **Testovi:** 0 → **102**

---

## Stanje prije i poslije

| Provjera | Prije | Poslije |
|---|---|---|
| `npm run lint` | 10 upozorenja, 0 grešaka | **9 upozorenja, 0 grešaka** |
| `no-undef` (nije bio uključen) | 2 stvarna pada, neotkrivena | **uključen kao `error` — 0 grešaka** |
| `npm run build` | ✅ 2,6 s | ✅ 2,5 s |
| Testovi | **nije ih bilo** | **102 prolaze** (`npm test`, 27 s) |
| `ErrorBoundary` | nije postojao → bijeli ekran | postoji, hvata pad i nudi oporavak |
| Padova na bijeli ekran | **7 puteva** | **0** (svi pokriveni testom) |

---

## ⚠️ Prvo pročitajte: promjene koje utiču na cijene

Ovo su **namjerne** promjene kalkulacije. Ako imate sačuvane ponude, stari brojevi se
više neće poklapati.

### Kuhinja

| Stavka | Prije | Poslije | Razlog |
|---|---|---|---|
| **Gola profil** | 1 „komad" (14 KM) po krilu | **metraža**: širina elementa × broj fronti, 14 KM/m' | Vaša specifikacija. Gola je metraža, ne komad |
| **Push-to-open** | ručka 6,50 KM po fronti | mehanizam `HARDWARE.PUSH` 4,90 KM po fronti | Push nije ručka; `HARDWARE.PUSH` je postojao ali se nikad nije koristio |
| **Nogice** | `širina > 900 ? 6 : 4` po elementu, uvijek | **4 po korpusu**, samo ako je `legHeightMm > 0` | Vaša specifikacija (4 po korpusu). Ranije `computeHardware` nije ni primao `project`, pa nije mogao znati visinu nogica |

**Referentna kuhinja (11 elemenata), izmjereno:**

```
osnovica  3.866,67 KM      korpus        982,01 KM
PDV 17%     657,33 KM      frontovi      283,98 KM
ukupno    4.524,00 KM      okov          382,40 KM
                           radna ploča   661,97 KM
                           rad           662,95 KM
                           ...
OKOV: 30 šarki · 20 ručki · 32 podupirača · 32 nogice (8 korpusa × 4) · 8 setova vodilica · 10 vješalica
```

Isti projekat sa gola profilom umjesto ručki: **12,5 m × 14 KM = 175,00 KM**
(stari kod bi dao 20 „komada" × 14 = 280 KM).

### Ormar

| Stavka | Prije | Poslije |
|---|---|---|
| **Nogice** | `(segmentCount + 1) × 2` → 8 za 3 segmenta | **5 po segmentu** → 15 za 3 segmenta |
| **Ploče vrha/dna** | `2 × širina × dubina` **ukupno** | `segmentCount × 2 × širinaSegmenta × dubina` po korpusu |
| **Leđa** | `širina × visina` (jedna ploča preko svega) | **po segmentu**: `segmentCount × širinaSegmenta × visina` |
| **Klizna vrata** | uvijek **2 krila**, `širina/2 + 40` | broj krila iz **najšireg krila** (default 1000 mm, **može se urediti u UI**) |
| **Okov kliznih vrata** | paušalno 180 KM | 90 KM **po krilu** |
| **Okov baglam vrata** | `segmentCount × 2 × 6` (magični broj) | `HINGE_DOOR_HW_PER_LEAF_KM` po krilu, konstanta u `data/wardrobe.js` |
| **Sanduk ladice** | 1 red „dno/bok/leđa kutije" × pune dubine po ladici | raspisano na **bok (2×), čelo/leđa (2×), pod (1×)** sa stvarnim mjerama |
| **Okov u krojnoj listi** | gurnut u `rows` sa `cutW: 0` → prikazivano kao „—" | izdvojen u `hardware` sekciju sa količinom i napomenom |
| **Gornja maska** | tvrdo kodiranih `100` | `TOP_MASK_H` konstanta |

**Referentni ormar 2400×2500×580, 3 segmenta, klizna — izmjereno:**

```
osnovica  1.246,62 KM     korpus (bokovi, pregrade, dno, vrh)  639,92 KM
ukupno    1.458,54 KM     leđa (po segmentu)                    47,65 KM
                          vrata                                492,24 KM
                          nogice (15 × 3,50)                    52,50 KM
                          gornja maska                          14,30 KM

15 nogica · 3 klizna krila po 840 mm (svjetlo 800 + 40 preklop)
```

Klizna vrata po širinama (max krilo 1000 mm):

| Širina ormara | Prije | Poslije |
|---|---|---|
| 1200 mm | 2 × 640 | 2 × 640 |
| 2400 mm | 2 × 1240 | **3 × 840** |
| 4000 mm | 2 × **2040** ❌ | **4 × 1040** ✅ |

Uređivanje najšireg krila (800 / 1000 / 1200 / 1400 mm) odmah mijenja broj krila i
cijenu — vidljivo u panelu *Vrata* i u wizardu.

---

## 🔴 Popravljeni padovi (bijeli ekran)

### BUG-01 · `thicknessesOf` nije bio importovan
`src/store/projectStore.js:5` — **jedna linija**:
```diff
-import { DECORS, registerDecor } from '../data/decors';
+import { DECORS, registerDecor, thicknessesOf } from '../data/decors';
```
Klik na *„Dekor fronti → Sve fronte donjih elemenata"* više ne ruši aplikaciju.
**Pokriveno:** `src/integration.test.jsx` (3 testa, stvarni klik kroz cijelo stablo).

### BUG-02 · Dupli `instanceId`
`src/data/catalog.js`:
- `createInstance` više ne vraća `el_${templateId}` (svi elementi istog tipa su imali **isti** ID)
- `_seq` modul-brojač zamijenjen generatorom `vrijeme + brojač + nasumični sufiks`
- dodati `adoptProjectIds(project)` i `adoptInstanceIds(ids)` — pozivaju se pri učitavanju
  projekta tako da se stari ID-jevi nikad ne mogu ponovo izdati
- `resolveProject` već radi `${el.instanceId}_nad`; `adoptProjectIds` registruje i tu varijantu

**Pokriveno:** `src/data/catalog.test.js` — 9 testova, uključujući **20.000 uzastopnih
`createPlaced` poziva** bez ijedne kolizije (auto-raspored realno radi hiljade proba).

### BUG-03/05 · Nepoznat dekor, nepoznat tip elementa, projekat bez polja
- `data/decors.js`: novi `decorById(id)` + `decorExists(id)` + `FALLBACK_DECOR`
- `data/catalog.js`: `templateById(id)` sada **nikad** ne vraća `undefined` — vraća
  `FALLBACK_TEMPLATE` sa `missing: true`; dodati `templateExists(id)`
- Primijenjeno na svih 8 mjesta koja su padala: `panels.js`, `bom.js` (11 lookup-ova),
  `pricing.js`, `validation.js`, `Viewport3D.jsx` (6), `RightRail.jsx`, `Header.jsx`,
  `OfferModal.jsx`
- `validation.js` sada **javlja** „Tip elementa X nije u katalogu" umjesto da padne
- Novi `src/utils/projectSchema.js` — `normalizeProject()` i `normalizeWardrobe()`:
  dopunjava defaulte, odbacuje neispravne elemente, zamjenjuje nepostojeće dekore,
  steže brojeve, čisti `endPanelSizes` za uklonjene elemente, i **vraća `notes`** da
  korisnik vidi šta je ispravljeno

**Pokriveno:** `src/utils/projectSchema.test.js` (17 testova) + integracijski test koji
učitava namjerno pokvaren projekat iz `localStorage`.

### BUG-04 · `cooktopCenter` sa neimportovanim `COOKTOP`
`src/engine/surfaces.js` — funkcija obrisana (bila je mrtav kod; 3D prikaz ploče već
računa isti pravougaonik inline u `Viewport3D.jsx:471`). Ostavljen komentar zašto.

### BUG-06 · Prazno numeričko polje → `0`
`src/components/ui/Controls.jsx` — novi `NumberInput` sa lokalnim *draft* stanjem:
- prazno polje se **ne** šalje u store (korisnik još kuca)
- `NaN` se ignoriše
- vrijednost se steže u `[min, max]` pri commit-u
- vanjske promjene stanja se sinhronizuju nazad u draft

**Pokriveno:** integracijski test — `clear()` + upis „abc" ne mijenja `room.width`;
upis 99999999 se steže na 9000.

### Novi `ErrorBoundary`
`src/components/ErrorBoundary.jsx` + `src/main.jsx`. Prikazuje poruku, `componentStack`,
dugmad **Pokušaj ponovo / Ponovo učitaj stranicu / Kopiraj grešku**, i eksplicitno kaže
da sačuvani projekti **nisu izgubljeni**.

**Pokriveno:** test koji namjerno baca `TypeError` i provjerava da se prikaže poruka.

### BUG-18 · Wizard se zaglavljavao na „Korak 5 od 4"
`StartupWizard.jsx:159` — `onChange={(v) => { setKind(v); setStep(0); }}`.

**Pokriveno:** integracijski test koji ode do koraka 6, vrati se na 1, izabere
„Spavaća soba" i provjeri da je sada „Korak 1 od 4" sa vidljivim sadržajem.

### BUG-19 · „Preskoči" je tiho bacalo podatke
Dugme je preimenovano u **„Završi, preskoči ostalo"** / **„Preskoči ovaj korak"** (prema
tome gdje se nalazite) i sada pita za potvrdu navodeći koliko koraka preskače.

---

## 🟠 Ostale popravke u ovoj fazi

| # | Fajl | Šta |
|---|---|---|
| 1 | `Views/Viewport3D.jsx:383` | **PERF-01** — `computePanels(el)` se zvao **2×** po elementu u istom efektu; sada jednom, rezultat se dijeli sa `handlePlacements` |
| 2 | `store/uiStore.js` | `flash()` nije čistio prethodni `setTimeout` → dvije brze poruke su se preklapale. Dodati `toastTimer` i `toastSeq` (key za toast) |
| 3 | `App.jsx` | `Delete`/`Backspace` su brisali element **dok je modal otvoren**. Dodata provjera `if (modal \|\| wizard) return;` i `t.isContentEditable` |
| 4 | `App.jsx` | Popunjene zavisnosti `useEffect`-a za tastaturne kratice |
| 5 | `engine/bom.js` | Količine u metrima (gola, lajsne, rubne trake) sabirale su se u floating pointu → u krojnu listu išlo `11.299999999999997 m`. Sada `r1()` |
| 6 | `engine/bom.js` | `wallLabel()` helper — `WALLS.find(...).label` je padao na nepoznatom zidu |
| 7 | `LoadProjectModal.jsx` | `loadProjectByName` sada vraća `{ ok, notes }`; modal javlja „učitan uz N ispravki". Dodato `live` čišćenje i `listProjects` u zavisnostima |
| 8 | `data/projectDefaults.js` | **Novi fajl** — `DEFAULT_PROJECT` izdvojen iz store-a da `projectSchema.js` može migrirati bez kružnog importa |
| 9 | `.oxlintrc.json` | Uključeno `no-undef: error` + `env.browser` + `ignorePatterns`. **Ovo je već uhvatilo 2 realna pada** (vidi ispod) |
| 10 | `vite.config.js` | `resolve.extensions` (engine koristi importe bez ekstenzije, čisti Node ESM to ne podnosi) + Vitest konfiguracija |

### Kako je `no-undef` uhvatio 2 pada koja build nije

Vite/rolldown **ne provjerava** nedefinisane identifikatore — samo ih proglasi
globalnim i build „prođe". Pad se desi tek u browseru.

1. `projectStore.js` — `templateById` sam greškom uklonio iz importa jer ga je
   normalizacija učinila „nekorištenim" na jednom mjestu, ali `applyFrontDecor` ga
   i dalje zove. **Build je prošao. Integracijski test je pao.**
2. `WardrobeSettingsRail.jsx` — importi za `slidingLeafCount`, `legCountOf`,
   `SLIDING_LEAF_LIMITS` i hook `setMaxSlidingLeafWidthMm` nisu bili primijenjeni
   (moj patch je pao na trećem uzorku, a fajl se piše tek na kraju). Komponenta bi
   pala **pri prvom otvaranju panela za ormar**. Build je prošao.

Zato je `no-undef` sada trajno u vašem lint configu. **Preporuka: dodajte
`npm run lint && npm test` u pre-commit hook ili CI.**

---

## Novi i izmijenjeni fajlovi

### Novi (5)
```
src/components/ErrorBoundary.jsx      hvata padove, nudi oporavak
src/data/projectDefaults.js           DEFAULT_PROJECT + liste polja za sanitizaciju
src/utils/projectSchema.js            normalizacija/migracija pri učitavanju
test/setup.js                         jsdom mock-ovi (canvas 2D, ResizeObserver, SVG)
e2e/smoke.mjs                         Playwright smoke test (vidi napomenu ispod)
```

### Testovi (5 fajlova, 102 testa)
```
src/data/catalog.test.js               9   jedinstveni ID-jevi, sigurni templateById
src/engine/pricing.test.js            20   nogice, gola metraža, push, ručke, šarke
src/engine/wardrobePricing.test.js    33   nogice/leđa/ploče po segmentu, klizna krila, BOM
src/utils/projectSchema.test.js       17   migracija starijih projekata
src/engine/golden.test.js             13   ⭐ ZLATNA REGRESIJA — zaključane cijene
src/integration.test.jsx              10   stvarni klikovi kroz App (jsdom)
```

### ⭐ Zlatna regresija
`src/engine/golden.test.js` sadrži **stvarne izračunate brojeve** za dvije referentne
konfiguracije. Svaka promjena engine-a koja slučajno pomjeri cijenu pada na ovom testu.
Ako **namjerno** mijenjate kalkulaciju, ažurirajte brojeve i napišite zašto u poruci
testa — nemojte samo „popravljati test".

---

## Napomena o E2E testu

`e2e/smoke.mjs` pokreće pravi Chromium preko Playwright-a i prolazi kroz aplikaciju
stvarnim klikovima. **Nisam ga uspio izvršiti u svom okruženju** — sandbox ima
`/dev/shm` od samo 64 MB pa Chromium pada pri pokretanju (`Target crashed`).
Prvi (djelimični) prolaz je ipak potvrdio: aplikacija se renderuje (87.954 znakova),
wizard radi, cijena se računa i **nije NaN** (5.609,20 KM).

Kod vas će raditi normalno:
```bash
npx playwright install chromium
npm run test:e2e
```

Za sada se oslanjam na `src/integration.test.jsx` koji radi **isto to u jsdom-u** i
prolazi — uključujući stvarni klik na DecorPicker koji je rušio aplikaciju.

---

## Preostala upozorenja lintera (9, sva bezopasna)

| Upozorenje | Zašto ostaje |
|---|---|
| 3× `useMemo has unnecessary dependency: decorVersion` | **Namjerno** — `decorVersion` je cache-bust za mutaciju modula `DECORS`. Bez njega se cijene ne preračunavaju nakon dodavanja novog dekora. Treba komentar, ne brisanje |
| `missing dependencies: flash, loadDecors` | `flash`/`loadDecors` su stabilne Zustand reference; dodavanje je bezopasno ali nepotrebno |
| `set-state-in-effect` u `Controls.jsx:70` | Sinhronizacija draft stanja sa vanjskom vrijednošću — legitimni obrazac |
| `missing dependency: room` u `Viewport3D.jsx:364` | Efekat namjerno prati samo `room.width/depth/height`, ne cijeli objekat |
| `Parameter 'r'/'room' is never used` | `surfaces.js:292` (`yOf: (r) => 0`) i `layout.js:98` (`frontAlignOffset`) — dio Faze 4 |

---

## Šta je ostalo za Fazu 2

Prema `PREGLED-KODA.md`, odjeljak 6:

- **BUG-12** — završne maske za visoke elemente bez `endExposed()` provjere
  (frižider uz zid i dalje dobija fantomsku masku od 2600×550 mm)
- **BUG-17** — ormar se može sačuvati ali ne i učitati (nema dugmeta u `WardrobeHeader`)
- **BUG-20** — „Brzo sačuvaj" i „Sačuvaj kao" se ne poznaju → moguće gubljenje izmjena
- **BUG-21** — tiho odbacivanje izmjena (kolizija pri prevlačenju, `moveToWall` bez mjesta)
- **BUG-22** — `WardrobeSegmentRail` sakriva sav sadržaj kad je gornji korpus ≤ 0
- **BUG-23** — `Modal` bez Esc / klik-van / zaključavanja skrola / `aria`
- **PERF-02..07** — debounce prevlačenja, jedna `derived` memoizacija, `dispose()` za
  THREE materijale, render na zahtjev, `React.lazy` za code-splitting

### Treba mi potvrda za Fazu 2 (nagađao sam gdje nisam imao podatak)

U ovoj fazi sam **pretpostavio** sljedeće vrijednosti — sve su sada konstante u
`src/data/wardrobe.js`, pa ih lako korigujete:

```js
WARDROBE_LEGS_PER_SEGMENT   = 5      // ← vaša specifikacija
KITCHEN_LEGS_PER_CORPUS     = 4      // ← vaša specifikacija
GOLA_METERS_PER_FRONT       = 1.0    // ← PRETPOSTAVKA: jedan profil po fronti
SLIDING_OVERLAP_MM          = 40     // ← zadržano iz postojećeg koda
DEFAULT_MAX_SLIDING_LEAF_MM = 1000   // ← vaša specifikacija
SLIDING_LEAF_LIMITS         = 600–1500, korak 10   // ← PRETPOSTAVKA
DRAWER_BOX_HEIGHT_MM        = 140    // ← PRETPOSTAVKA (visina boka sanduka ladice)
HINGE_DOOR_HW_PER_LEAF_KM   = 6      // ← iz postojećeg koda (`* 2 * 6`)
SLIDING_HW_PER_LEAF_KM      = 90     // ← PRETPOSTAVKA (bilo paušalno 180 za 2 krila)
SLIDING_MATERIAL_FACTOR     = 1.1    // ← zadržano iz postojećeg koda
```

Molim vas da potvrdite ili korigujete: **`GOLA_METERS_PER_FRONT`**,
**`DRAWER_BOX_HEIGHT_MM`**, **`SLIDING_HW_PER_LEAF_KM`** i raspon
**`SLIDING_LEAF_LIMITS`**.

Također: u `data/hardware.js` postoji samo jedna nogica —
`NOGICA: 'Nogica podesiva 100 mm', 1,20 KM` — dok kuhinja dozvoljava `legHeightMm`
od 100 i 150 mm. Za 150 mm se u krojnoj listi i dalje navodi „Nogica podesiva 100 mm".
Treba li dodati drugu stavku u cjenovnik?

I: `HARDWARE.PUSH` (4,90 KM) i `HANDLES.PUSH` (4,90 KM) su **duplikat** istog artikla
na dva mjesta. Sada se koristi onaj iz `HARDWARE`. Treba li jedan obrisati?
