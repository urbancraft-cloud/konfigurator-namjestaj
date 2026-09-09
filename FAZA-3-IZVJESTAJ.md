# Faza 3 — izvještaj o implementaciji (performanse)

**Datum:** 2026-09-08 · **Testovi:** 169 → **179** · **Lint:** 7 → **3 upozorenja, 0 grešaka**

---

## Glavni brojevi

### Računanje po renderu (12 elemenata + automatske nadgradnje)

```
┌───────────────────────────────────────────────────────────┐
│   PRIJE  :   7,52 ms                                       │
│   POSLIJE:   3,65 ms                                       │
│   UBRZANJE: 2,06×  (−51%)                                  │
└───────────────────────────────────────────────────────────┘
```

Ovo se izvršava na **svaki `pointermove`** tokom prevlačenja elementa, pa je razlika
direktno vidljiva u odzivu — 60 poteza/s × 7,52 ms = 451 ms/s čistog računanja prije,
sada 219 ms/s, i to samo za matematiku (bez React reconciliations i THREE rebuild-a).

### Početni bundle

```
PRIJE:   dist/assets/index.js              976,42 kB │ gzip 267,73 kB   ← sve odjednom

POSLIJE: dist/assets/index.js              410,57 kB │ gzip 123,03 kB   ← početni
         dist/assets/canvas-*.js           527,62 kB │ gzip 132,29 kB   ← three.js, samo za 3D
         dist/assets/WardrobeApp-*.js       28,47 kB │ gzip   9,64 kB   ← samo za mod ormara
         dist/assets/Viewport3D-*.js        15,11 kB │ gzip   5,68 kB
```

**Početni payload: 976 kB → 411 kB (−58 %)**, gzip **268 kB → 123 kB (−54 %)**.
Korisnik koji radi u tlocrtu nikad ne skida 528 kB Three.js-a; korisnik u modu kuhinje
nikad ne skida modul za ormar.

---

## PERF-02 · `surfacesCost` se računao 3× po renderu

**Uzrok:** `projectTotals` interno zove `surfacesCost`, `computeBOM` također, a `App.jsx`
ga je zvao i treći put (za prikaz komada ploča u lijevom panelu). `surfacesCost` je
najskuplji dio kalkulacije — **0,93 ms** od ukupno 3,65 ms.

**Rješenje:** obje funkcije primaju opcionalni treći argument:

```js
export function projectTotals(project, room, precomputedSurfaces) { … }
export function computeBOM(project, room, precomputedSurfaces) { … }
```

`App.jsx` sada ima **jedan** `useMemo` umjesto pet:

```js
const derived = useMemo(() => {
  const project = resolveProject(rawProject, room);
  const surf    = surfacesCost(project, room);          // ← JEDNOM
  const totals  = projectTotals(project, room, surf);   // ← dijeli
  const bom     = computeBOM(project, room, surf);      // ← dijeli
  const validations = new Map();                        // ← vidi PERF-06
  …
  return { project, surf, totals, bom, validations, invalidCount, surfNotes };
}, [rawProject, room, decorVersion]);
```

**Pokriveno:** test ekvivalencije (rezultat sa dijeljenim i zasebnim `surfacesCost` je
**identičan** do 6 decimala, red po red krojne liste) + test obrasca u `App.jsx`.

> Napomena: ESM nije moguće „spy-ovati" — `import * as` daje zaleđeni namespace, a
> `projectTotals` zove `surfacesCost` preko unutarmodulske vezice. Zato test brojanja
> poziva nije moguć; provjerava se obrazac u izvornom kodu, što je upravo ono što
> garantuje jedan poziv.

---

## PERF-06 · `validateInProject` (O(n²)) se zvao na 4 mjesta

Svaki poziv radi `collidesWithAny` koji iterira **sve** elemente i prepreke. Zvao se u:
`App.jsx` (za `invalidCount`), `RightRail.jsx` (za selektovani **i** za svaki element
liste), `PlanView2D.jsx` (dva puta — za donje i za gornje elemente).

Za 14 elemenata: 4 × 14 × 14 = **784 provjere kolizije po renderu**.

**Rješenje:** validacija se računa **jednom** u `App.jsx` kao
`Map<instanceId, rezultat>` i prosljeđuje kroz prop `validations`:

```jsx
<RightRail project={project} room={room} validations={validations} />
<PlanView2D … validations={validations} surfaces={surf} />
```

`RightRail` i `PlanView2D` imaju fallback (`validateInProject` / `NO_VALIDATION`) pa
rade i kad se koriste samostalno, bez mape.

---

## PERF-05 · `PlanView2D` je računao površine inline u renderu

`computeWorktops`, `computeWallPanels` i `computeEndPanels` su se zvale unutar IIFE u
JSX-u, **bez memoizacije** — na svaki `pointermove`. Izmjereno 0,56 ms po prolazu.

Sada se dijele iz `App.jsx` kroz prop `surfaces`, a kao rezerva postoji lokalni
`useMemo`.

⚠️ **Važno:** hook se mora zvati **bezuvjetno** (pravila hookova). Prva verzija moje
popravke je bila `surfaces ? surfaces.wt : useMemo(...)` — što je **uslovni hook** i
`react-hooks/rules-of-hooks` ga je ispravno prijavio kao grešku. Sada:

```js
const localSurf = useMemo(
  () => (surfaces ? null : { wt: …, wp: …, zm: … }),   // tijelo ne računa ništa
  [surfaces, project, room],                            // kad surfaces postoji
);
const wt = surfaces ? surfaces.wt : localSurf.wt;
```

---

## PERF-02b · Prevlaka elementa = potpuna rekonstrukcija svega

**Uzrok:** `onDrag` → `setRawProject` → novi `project` → svi efekti u `Viewport3D`
(rebuild ~500 mesh-ova) + `PlanView2D` re-render + sve kalkulacije. **Na svaki piksel.**

**Rješenje u tri dijela:**

1. **Lokalni pregled** (`dragPreview` / `preview` state) — element prati kursor **1:1**
   bez diranja store-a. U 3D se pomjera samo `group.position`; u 2D samo `rectFor`.
2. **Prag za commit** (`DRAG_COMMIT_MM = 25`) — u store se piše tek kad se pozicija
   pomakne za 25 mm, pa se kolizija i snap i dalje provjeravaju **tokom** prevlačenja
   (element se ne „zalijepi" bez objašnjenja), ali ~2,4× rjeđe.
3. **Commit na puštanje miša** — konačna, tačna pozicija se upisuje u `pointerup`.

Uz to u `Viewport3D`: nakon prevlačenja se **ne** radi raycast za odabir, pa otpuštanje
miša nad praznim prostorom ne poništi selekciju elementa koji ste upravo pomjerili.

**Rezultat:** tokom prevlačenja store se mijenja ~2,4×/sekundi umjesto 60×/sekundi, a
prikaz je i dalje gladak jer lokalni pregled ne koči.

---

## PERF-03 · Beskonačna `requestAnimationFrame` petlja

Oba viewporta su renderovala **60 fps zauvijek**, i kad se ništa ne mijenja. GPU
ventilator radi non-stop, laptop troši bateriju, a na integriranoj grafici to značajno
usporava i ostatak stranice.

**Rješenje — render na zahtjev:**

```js
let frameReq = null;
const invalidate = () => {
  if (frameReq != null || fp.on) return;      // u hodanju radi stalna petlja
  frameReq = requestAnimationFrame(() => { frameReq = null; renderer.render(scene, camera); });
};
```

`invalidate()` se zove iz: `applyCamera` (rotacija/pan/zoom), rebuild-a scene, promjene
režima mjerenja, i `resize`. Više poziva u istom ticku skupi se u **jedan** render.

Stalna petlja (`walkLoop`) se pokreće **samo** u režimu hodanja (`H`), gdje se kamera
zaista pomjera svaki frame, i zaustavlja pri izlasku.

`WardrobeViewport3D` nema režim hodanja, pa stalna petlja tamo **uopšte ne postoji** —
samo `invalidate`.

⚠️ **Pazite na TDZ:** `applyCamera` (linija 74) zove `invalidate`, pa `invalidate` mora
biti deklarisan **prije** njega. Prva verzija je imala `const invalidate` 150 linija
ispod i bacala bi `ReferenceError: Cannot access 'invalidate' before initialization`
pri samom mount-u komponente.

---

## PERF-04 · THREE materijali i teksture se nikad nisu oslobađali

`clear()` je oslobađao **geometriju** ali ne i materijale. Tri konkretna curenja:

| Mjesto | Prije | Poslije |
|---|---|---|
| `Viewport3D.jsx` naljepnice zidova | **novi** `CanvasTexture` (512×128) + `MeshBasicMaterial` za svaku od 4 naljepnice, **na svaku promjenu dimenzija prostorije** | `getLabelMat(text)` kešira po tekstu → **0 novih tekstura** pri pomjeranju kliznika |
| `WardrobeViewport3D.jsx` `box()` | **novi** `LineBasicMaterial` za svaku ivicu svake kutije (stotine po rebuild-u) | jedan dijeljeni `ctx.current.edgeMat` |
| `clear()` | samo `geometry.dispose()` | i `material.map.dispose()` + `material.dispose()`, uz zaštitu dijeljenih materijala |

Pri unmount-u se sada čiste oba keša (`mats`, `labelMats`) i `edgeMat`, pa
`renderer.dispose()`.

`clear(g, shared)` prima skup dijeljenih materijala koje **ne** smije osloboditi —
bez toga bi prvi rebuild uništio `lineMat` koji koriste svi mesh-ovi.

---

## PERF-07 · Bundle 976 kB bez code-splittinga

```js
const Viewport3D  = lazy(() => import('./views/Viewport3D').then((m) => ({ default: m.Viewport3D })));
const WardrobeApp = lazy(() => import('./components/wardrobe/WardrobeApp').then((m) => ({ default: m.WardrobeApp })));
```
sa `<Suspense fallback={<ViewportPlaceholder />}>` i porukom „Učitavanje 3D prikaza…".

`.then((m) => ({ default: … }))` je potreban jer su to **imenovani** izvozi, a
`React.lazy` očekuje default.

**Napomena o Vite 8 / rolldown:** `build.rollupOptions.output.manualChunks` kao
**objekat** (rollup sintaksa) ovdje ne radi — rolldown traži funkciju i baca
`TypeError: manualChunks is not a function`. Nije ni potrebno: dinamički importi sami
prave zasebne chunkove, što se vidi u build izlazu iznad. Postavljen je samo
`chunkSizeWarningLimit: 700` da three.js chunk (528 kB, opravdano) ne diže lažno
upozorenje.

---

## Ostalo u ovoj fazi

| Fajl | Šta |
|---|---|
| `store/projectStore.js` | Uklonjen nekorišteni import `applySnap` (snap logika je sada u `dragElement`, vidi Faza 2) |
| `engine/layout.js` | Uklonjen nekorišteni import `BLIND_GAP_MM` (ostao od obrisanog `blindCornerRule`) |
| `views/PlanView2D.jsx` | Uklonjen nekorišteni import `validateInProject`; dodat `useMemo` i `useState` |

---

## Stanje nakon Faze 3

| Provjera | Faza 2 | Faza 3 |
|---|---|---|
| `npm test` | 169 prolazi | **179 prolazi** (9 fajlova) |
| `npm run lint` | 7 upozorenja | **3 upozorenja, 0 grešaka** |
| `npm run build` | ✅ 976 kB (1 chunk) | ✅ **411 kB početni + 3 lijena chunka** |
| Računanje po renderu | 7,52 ms | **3,65 ms** |
| rAF petlja u mirovanju | 60 fps zauvijek | **0 fps** (render na zahtjev) |
| THREE resursi pri unmount-u | cure | **oslobođeni** |

### Preostala 3 upozorenja lintera (sva namjerna)

| Upozorenje | Zašto ostaje |
|---|---|
| 3× `useMemo has unnecessary dependency: decorVersion` | **Namjerno** — `decorVersion` je cache-bust za mutaciju modula `DECORS` pri registraciji novog dekora. Bez njega se cijene ne bi preračunale. Sada je uz svaki od ta tri mesta i komentar koji to objašnjava |

---

## Šta Faza 3 NIJE dirala (namjerno)

- **`storage.js` polyfill** — i dalje `window.storage` omotač oko `localStorage` sa
  `catch { return null }` koji guta prave uzroke grešaka. Zamjena direktnim pozivima je
  Faza 4.
- **A11y** — kontrast `C.faint` (#94A3B8) na `C.paper2` (#F8FAFC) je i dalje **2,4:1**
  (WCAG traži 4,5:1 za mali tekst); `<button>` elementi nemaju `:focus-visible` stanje;
  `Segmented` sada ima `role="radiogroup"`/`aria-checked` (dodato u Fazi 1), ali
  `DecorPicker` nema.
- **Mobilni prikaz** — `LeftRail` (288 px) + `RightRail` (320 px) + viewport traže
  ~1000 px; na tabletu se lomi.
- **Undo/Redo** — najveći funkcionalni nedostatak (vidi `PREGLED-KODA.md`, odjeljak 9).

---

## Preporuka za CI

Sve tri provjere su sada smislene i brze:

```bash
npm run lint && npm test && npm run build
```

- `lint` uključuje `no-undef` kao **grešku** — to je pravilo koje je u Fazi 1 uhvatilo
  dva stvarna pada koja build **nije** vidio (Vite/rolldown ne provjerava nedefinisane
  identifikatore; pad se desi tek u browseru).
- `test` uključuje **zlatnu regresiju** cijena: svaka slučajna promjena kalkulacije
  pada na `golden.test.js`.
- Ukupno ~50 s.
