# Faza 4 — izvještaj (Undo/Redo, izvoz/uvoz, pristupačnost)

**Datum:** 2026-09-08 · **Testovi:** 179 → **254** · **Lint:** 3 upozorenja, 0 grešaka

Faza 4 u `PREGLED-KODA.md` bila je predviđena kao „higijena". Umjesto toga sam uzeo
stavke koje **najviše znače korisniku** — jer su `Undo/Redo` i `Izvoz projekta` bili
jedini preostali problemi koji mogu koštati stvarnog rada i stvarnih podataka.

---

## 1. Undo / Redo (najveći funkcionalni nedostatak)

### Zašto je ovo bilo kritično

| Akcija | Prije |
|---|---|
| „Očisti prostor" | briše **sve** elemente i instalacije, bez potvrde, bez povrata |
| `Delete` na element | nepovratno |
| Promjena dekora svih fronti | prepisuje cijeli projekat, nepovratno |
| Smanjenje broja segmenata ormara | briše raspored uklonjenih segmenata, nepovratno |

Jedini „oporavak" je bio učitati stariji snimak — **ako ga ima**.

### Implementacija

Novi `src/store/withUndo.js` — generički Zustand middleware, jedna implementacija za
oba store-a:

```js
export const useProjectStore = create(
  withUndo((set, get) => ({ … }), { keys: ['room', 'rawProject'] })
);
export const useWardrobeStore = create(
  withUndo((set, get) => ({ … }), { keys: ['room', 'wardrobe'] })
);
```

**Ključne odluke:**

| Odluka | Razlog |
|---|---|
| **Snapshot**, ne diff/patch | Projekat je mali (desetak elemenata, nekoliko kB), pa je 60 snapshotova zanemarivo — a snapshot se ne može „pokvariti" kao patch logika |
| `UNDO_LIMIT = 60` | Dovoljno za cijelu sesiju rada, ograničava memoriju |
| **Koalescencija** (`COALESCE_MS = 700`) | Kliznici i prevlačenje šalju desetke izmjena u sekundi. Bez grupisanja korisnik bi morao pritisnuti Ctrl+Z pedeset puta da poništi jedno pomjeranje kliznika |
| `keys` ograničen na podatke | `activeProjectName` se **ne** vraća undo-om — inače bi nakon poništene izmjene dugme „Sačuvaj" ciljalo pogrešan zapis |
| `clearHistory()` pri učitavanju | Učitavanje projekta nije korak koji se poništava — korisnik ne smije moći „poništiti" učitavanje i tako se vratiti na pola sačuvanog stanja |
| Dvije nezavisne historije | Kuhinja i ormar imaju odvojene store-ove pa i odvojene historije (test to eksplicitno provjerava) |

### API

`set` je dobio **treći** argument:

```js
set(partial)                     // diskretna izmjena → novi korak u historiji
set(partial, false, 'drag')      // kontinuirana → grupiše se sa prethodnom
set(partial, false, false)       // NE bilježi se (učitavanje projekta, undo/redo)
```

Sve postojeće akcije rade **bez izmjena** — middleware presreće `set`. Samo su
kontinuirane eksplicitno označene:

| Akcija | `record` |
|---|---|
| `setRoom`, `moveCooktop`, `dragElement` (preko `setRawProjectCoalesced`) | `'drag'` |
| `setWardrobeDims`, `moveItem` (ormar) | `'drag'` |
| `loadProject`, `loadProjectByName`, `loadWardrobeProject` | `false` + `clearHistory()` |
| sve ostale (`removeElement`, `patch`, `applyWizard`, `applyFrontDecor`, `addItem`, …) | podrazumijevano = diskretno |

### UI

- **Zaglavlje kuhinje:** dugmad ⟲ / ⟳ sa `disabled` stanjem, `title` („Poništi zadnju
  izmjenu (Ctrl+Z)") i `aria-label`
- **Zaglavlje ormara:** isto
- **Tastatura:** `Ctrl/Cmd+Z` = poništi, `Ctrl/Cmd+Y` **ili** `Ctrl+Shift+Z` = vrati
  (macOS obrazac). Radi u oba moda, nad odgovarajućim store-om. Ne prolazi dok je
  modal ili wizard otvoren i dok je fokus u input polju.
- Poruka korisniku: „Izmjena poništena." / „Nema šta da se poništi."

### ⚠️ Bag koji sam napravio i koji je uhvaćen testom

Prva verzija `wrappedSet` je imala **obrnutu logiku**:

```js
if (!isRecordOption(record)) { set(partial, replace); return; }   // ← undefined nije prolazio
```

`removeElement` i `setRawProject` zovu `set` sa **dva** argumenta, pa je `record` bio
`undefined`, `isRecordOption(undefined)` je vraćao `false` — i **nijedna izmjena se nije
bilježila**. Undo je postojao kao API ali nije radio. Svih 16 undo testova je palo
odmah, što je problem otkrilo prije nego što je stigao do vas.

Ispravljeno: `record === false` je **jedini** način da se izmjena preskoči.

---

## 2. Izvoz i uvoz projekta kao datoteka

### Zašto

Projekti su živjeli **isključivo u `localStorage`**. Promjena preglednika, čišćenje
keša, drugi računar ili profil — i sve je nestajalo, bez upozorenja i bez oporavka.
Ovo je bio **rizik po podatke**, ne samo nedostatak funkcionalnosti.

### Novi `src/utils/exportImport.js`

| Funkcija | Šta radi |
|---|---|
| `projectToJSON(room, project)` | `{ format, formatVersion, exportedAt, name, room, project }` |
| `importProjectFromJSON(text)` | Parsira, **provjerava**, normalizuje. Vraća `{ ok, room, project, notes, name }` |
| `downloadFile` / `downloadJSON` / `downloadCSV` | Blob + privremeni `<a download>` — bez ijedne biblioteke |
| `safeFilename(name, ext)` | Čisti `\\ / : * ? " < > \|`, sažima crte, dodaje ekstenziju |
| `offerToHTML(...)` / `printOffer(...)` | Ponuda kao A4 HTML → sistemski dijalog za štampu → „Sačuvaj kao PDF" |

**Modul namjerno ne importuje store** — vraća podatke, a pozivalac odluči šta će sa
njima. Time nema kružne zavisnosti (`projectStore → projectSchema`, a ne obrnuto).

### Provjere pri uvozu (ništa ne može srušiti aplikaciju)

| Slučaj | Rezultat |
|---|---|
| Prazna datoteka | `{ ok:false, reason:'Datoteka je prazna.' }` |
| Nije JSON | `„Datoteka nije ispravan JSON: …"` |
| Nema polja `project` | `„…ovo nije fajl ovog konfiguratora"` |
| Nepoznat `format` | odbija se |
| `formatVersion` **veći** od podržanog | `„Datoteka je iz novije verzije programa (format v2, program poznaje v1)"` — ne nagađa se |
| Element sa izbačenim tipom | odbacuje se **uz napomenu** |
| Dekor kojeg nema u cjenovniku | zamjenjuje se defaultom **uz napomenu** |
| Neispravna prostorija | pada na default **uz napomenu** |

Uvoz prolazi kroz **istu** `normalizeProject` funkciju kao i učitavanje iz
`localStorage`-a, pa nema dva odvojena puta migracije koja mogu da se razilaze.

### UI

- Zaglavlje: **„Izvezi"** (JSON) i **„Uvezi"** (skriveni `<input type="file">`)
- `BomModal`: **„Preuzmi CSV"** pored postojećeg „Kopiraj CSV". CSV ima **UTF-8 BOM** —
  bez njega Excel na Windowsima prikazuje šđčćž kao šifre
- `OfferModal`: **„Štampaj / PDF"** — otvara A4-prelomljen dokument i pokreće
  `window.print()`. Bez biblioteke za PDF (~500 kB), radi u svakom pregledniku
- `offerToHTML` **escapuje** sav tekst: naziv projekta sa `<script>` ne prolazi
  (testirano)

---

## 3. Pristupačnost — izmjereno, ne procijenjeno

Napisao sam skriptu koja računa stvarne WCAG omjere i **ona je pokazala da sam u
prošlom izvještaju pogriješio**:

```
boja                          paper    paper2    paper3      bg
─────────────────────────────────────────────────────────────────
text  #0F172A                17,85 ✓   17,06 ✓   16,30 ✓   16,30 ✓
dim   #475569 (NOVO)          7,58 ✓    7,24 ✓    6,92 ✓    6,92 ✓
faint #5B6B7F (NOVO)          5,45 ✓    5,21 ✓    4,97 ✓    4,97 ✓
─── PRIJE ───
dim   #64748B                 4,76 ✓    4,55 ✓    4,34 ✗    4,34 ✗
faint #94A3B8                 2,56 ✗    2,45 ✗    2,34 ✗    2,34 ✗
```

### Pronađen i popravljen još jedan neuspjeh koji nisam bio prijavio

```
bijelo na accent #0D9488  =  3,74:1  ✗
```

`accent` je pozadina **svih primarnih dugmadi** („Krojna lista", „Završi", „Sačuvaj",
„Dodaj") i značke sa ukupnom cijenom, a tekst na njoj je bijeli, veličine 12–14 px.
Za tu veličinu WCAG AA traži 4,5:1 — **sva primarna dugmad u aplikaciji nisu bila
pristupačna**.

```diff
-accent: '#0D9488', accentDark: '#0F766E',
+accent: '#0B7F76', accentDark: '#0A6660',
```
Novi `accent` daje **4,87:1** sa bijelim i zadržava isti tirkizni karakter.
`accentDark` (koji nije bio korišten nigdje) je sada taman za hover/aktivno stanje.

### Zaključano testom

Novi `src/data/theme.test.js` ima **30 testova** koji računaju omjer za svaku
kombinaciju boja teksta i pozadine u aplikaciji. Ako neko promijeni `faint` da „bude
diskretnije", test pada sa porukom `„faint na paper3 ima samo 4,34:1"`.

### Vidljiv fokus

Sve komponente koriste inline `style`, pa `:focus` **ne može** biti inline. Bez ovoga
korisnik koji ide Tab-om kroz aplikaciju uopšte nije vidio gdje se nalazi (WCAG 2.4.7,
nivo A — najniži, obavezan).

Dodato u `index.css`:
```css
:focus-visible { outline: 2px solid #0D9488; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { … }
```
Plus `Btn` sada prima `disabled`, `title`, `ariaLabel` i `type` (podrazumijevano
`"button"`, da dugmad u formi ne submituju).

---

## 4. Sitnije

| Fajl | Šta |
|---|---|
| `Controls.jsx` | `Segmented` dobio `role="radiogroup"` / `aria-checked` (Faza 1); `Btn` dobio `disabled`/`title`/`ariaLabel`/`type` |
| `Header.jsx` | `safeFilename` regex je imao nepotrebno escape-ovanje `-` unutar klase (`no-useless-escape`) |
| `projectStore.js` | Novi `setRawProjectCoalesced` za kontinuirane izmjene |
| `moveCooktop` | **Ispravljena greška koju sam uveo**: `set((p) => ({ ...p, cooktops }))` bi obrisalo `room` i sve akcije, jer `set` prima **parcijalno stanje store-a**, ne projekat. Sada `set((s) => ({ rawProject: { ...s.rawProject, cooktops } }))` |

---

## Stanje

| Provjera | Faza 3 | Faza 4 |
|---|---|---|
| `npm test` | 179 | **254 prolazi** (12 fajlova) |
| `npm run lint` | 3 upozorenja | **3 upozorenja, 0 grešaka** |
| `npm run build` | ✅ 411 kB početni | ✅ **421 kB** početni (+10 kB za undo i izvoz) |
| WCAG AA kontrast | 2 pada (nije bilo testirano) | **0 padova, zaključano testom** |
| Undo/Redo | nije postojao | 60 koraka, koalescencija, Ctrl+Z/Y, oba moda |
| Izvoz projekta | nije postojao | JSON izvoz/uvoz + CSV + PDF (štampanje) |

### Novi test fajlovi

```
src/store/undo.test.js            16  undo/redo, koalescencija, limit, clearHistory, ormar
src/utils/exportImport.test.js    22  round-trip, odbijanje neispravnih, BOM, download, HTML
src/data/theme.test.js            30  WCAG AA kontrast za svaku kombinaciju
src/integration.test.jsx          +7  undo dugmad, Ctrl+Z, izvoz/uvoz, CSV dugme
```

---

## Šta je ostalo

| Prioritet | Stavka |
|---|---|
| Srednji | **`storage.js` polyfill** — `window.storage` omotač oko `localStorage` sa `catch { return null }` koji guta prave uzroke grešaka. Zamjena direktnim pozivima je ~1 sat |
| Srednji | **Optimizacija krojenja (nesting)** — `OfferModal` i dalje kaže „Konačnu daje server nakon optimizacije krojenja". Engine ima `cutMm`, `rotationAllowed`, `grain`, `thickness` — sve što treba za 1D guillotine po debljini ploče |
| Srednji | **Cjenovnik kao podatak** — `data/decors.js` je 636 linija hardkodovanog cjenovnika; treba UI za uređivanje **postojećih** dekora i import iz CSV-a, uz verzioniranje po datumu |
| Nizak | **Mobilni/tablet prikaz** — `LeftRail` (288 px) + `RightRail` (320 px) + viewport traže ~1000 px |
| Nizak | `DecorPicker` bez `role="listbox"` / `aria-expanded` |
| Nizak | Detekcija kolizije sa instalacijama u validaciji (`services` se ne provjeravaju, samo `obstacles`) |

### ⚠️ I dalje čekam potvrdu (nije blokiralo nijednu fazu)

Konstante u `src/data/wardrobe.js`:
```js
GOLA_METERS_PER_FRONT     = 1.0   ← jedan profil po fronti? ili po elementu (0.0)?
DRAWER_BOX_HEIGHT_MM      = 140   ← visina boka sanduka ladice u ormaru
SLIDING_HW_PER_LEAF_KM    = 90    ← bilo paušalno 180 KM za 2 krila
SLIDING_LEAF_LIMITS       = 600–1500
```
I dva pitanja iz cjenovnika: treba li stavka za **nogicu 150 mm** (postoji samo „Nogica
podesiva 100 mm", pa se za 150 mm u krojnoj listi navodi pogrešan naziv), i treba li
obrisati duplikat `HARDWARE.PUSH` / `HANDLES.PUSH`.
