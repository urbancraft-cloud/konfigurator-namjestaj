# Faza 5 — izvještaj (krojenje, cjenovnik, mobilni prikaz, instalacije, higijena)

**Datum:** 2026-09-08 · **Testovi:** 254 → **324** · **Lint:** 3 upozorenja, 0 grešaka

Ovo je završna faza. Sa njom su **sve stavke iz `PREGLED-KODA.md` zatvorene**, osim
onih za koje mi i dalje treba vaš poslovni podatak (navedeno na kraju).

---

## 1. Optimizacija krojenja — `src/engine/cutting.js` (novo, 21 test)

`OfferModal` je od prvog dana govorio: *„Konačnu cijenu daje optimizacija krojenja"* —
ali ta optimizacija **nije postojala**. Cijena je uvijek bila
`neto površina × KM/m² × 1,15`.

### Algoritam

Shelf/strip packing sa **guillotine rezovima** — samo ravni rezovi s jednog kraja na
drugi, jer je to ono što klasična krojna pila može izvesti. Pravi 2D bin packing bi
dao bolju iskorištenost ali rezove koje pilom nije moguće izvesti.

1. Paneli se grupišu po `(materijal, debljina)` — različiti dekori se **ne mogu**
   dijeliti na istoj ploči
2. Unutar grupe sortiraju se po visini (opadajuće), pa po površini
3. Na svaku ploču se slažu „police" pune širine; panel ide u prvu policu u koju staje
4. Rotacija je dozvoljena **samo** panelima bez teksture — drvo mora ići u istom smjeru
5. Između dva panela računa se `SAW_KERF_MM = 4` (širina lista pile); na rubu ploče ne
6. Panel koji ne staje uspravno a **smije** se rotirati — rotira se (nije `unfit`)

Formate ploča možete mijenjati u `data/tech.js` (`SHEETS`):

| Debljina | Format | Rotacija |
|---|---|---|
| 18 / 25 / 16 / 12 / 10 mm | 2800 × 2070 | zaključana (tekstura) |
| 38 mm (radne ploče) | 4100 × 600 | zaključana |
| 3 mm (HDF leđa) | 2800 × 2070 | **slobodna** |

### Izmjeren rezultat na referentnoj kuhinji (11 elemenata)

```
panela: 161      ploča: 17      iskorištenje: 50,05 %
neto površina panela:  47,70 m²
potrošene ploče:       95,30 m²
otpad:                 47,60 m²
predugo za standardnu ploču: 2 komada

  5 ploča × 18 mm  104 panela  80,51 %   Bijela premium ST9      ← glavna grupa
  2 ploča × 18 mm   23 panela  58,20 %   Front Bijela premium
  2 ploča ×  3 mm   21 panela  62,37 %   HDF leđa
  1 ploča × 10 mm    2 panela  48,22 %   Zidna obloga
  1 ploča × 18 mm    2 panela  13,59 %   Coklo
  1 ploča × 18 mm    2 panela   5,69 %   Gornja maska            ← cijela ploča za 2 komada
  1 ploča × 38 mm    1 panel   99,22 %   Radna ploča
  …
```

### ⚠️ Ovo je poslovno najvažniji nalaz cijelog pregleda

**Stvarni otpad je 49,9 %, a ne 15 %** koliko pretpostavlja `WASTE_FACTOR = 1,15`.

Razlog nije loš algoritam — glavna grupa (104 panela od 18 mm) ima **80,5 %**
iskorištenja, što je vrlo dobro. Razlog je što se **ploča ne može dijeliti između
različitih dekora**: svaka grupa sa par sitnih komada (završne maske, coklo, LED
maska, gornja maska) troši **cijelu ploču** od 5,8 m² za 1–2 komada.

Cijena u ponudi i dalje računa materijal po neto površini × 1,15. Za ovu kuhinju to
znači da se **stvarni trošak materijala razlikuje od ponuđenog**. `BomModal` to sada
eksplicitno prijavljuje:

> „Stvarno iskorištenje ploča je 50,0 % (otpad 47,6 m² od 95,3 m²). Cijena u ponudi
> računa materijal po neto površini panela sa koeficijentom otpada 1,15 — ako je
> stvarno iskorištenje znatno niže, razliku treba uračunati u cijenu ili spojiti
> grupe u isti dekor."

**Preporuka:** ili (a) obračunavati materijal po potrošenim pločama kad je
iskorištenje ispod praga, ili (b) u ponudi spojiti maske u isti dekor kao korpus.
To je poslovna odluka, ne tehnička — zato je nisam donio sam. Engine za (a) postoji
(`summarizePlan` daje `sheetCount` po grupi), treba samo vaša cijena po ploči.

### UI

Nova kartica **„Optimizacija krojenja"** u `BomModal`:
- 4 brojača: ploča ukupno / iskorištenje / otpad / formata
- po grupi: broj ploča, format, iskorištenje (crveno ako je < 50 %), i oznaka
  **„cijela ploča za N kom"** kad je grupa sitna
- **SVG prikaz svake ploče** sa stvarnim pozicijama panela i mjerama u tooltip-u
- upozorenje za komade koji su predugi za standardni format
- dugme **„Plan (CSV)"** — jedan red po panelu sa pozicijom na ploči, za pogon

### Testovi

21 test, uključujući **property-based** nad 200 nasumičnih konfiguracija koji provjerava
da algoritam **nikad** ne prekrši tvrda svojstva:
- svaki panel je ili raspoređen ili prijavljen kao `unfit` (nijedan ne nestane)
- nijedan panel ne izlazi van ploče
- **nijedna dva panela se ne preklapaju** (provjera svih parova po ploči)
- `unfit` su stvarno preveliki (ne „nisu stali jer algoritam nije pokušao")
- rezultat je determinističan
- kerf se poštuje (razmak između panela u istoj polici = tačno 4 mm)

Ovaj property test je **uhvatio stvarni bug**: rotabilan panel koji ne staje uspravno
bio je odbijan kao `unfit` umjesto da se rotira (npr. HDF leđa 408×1036 na ploču
2800×600).

---

## 2. Cjenovnik kao podatak — CSV uvoz, uređivanje, verzioniranje

### Problem
`data/decors.js` je ~640 linija **hardkodovanog cjenovnika**. Svaka izmjena cijene
značila je diranje izvornog koda i ponovno build-ovanje aplikacije. A `registerDecor`
je mogao samo **dodati** novi dekor — postojeći se nije mogao urediti (dijalog je
vraćao „Dekor sa tom šifrom već postoji").

### Šta je dodato

**`parseDecorCSV(text)`** — čita tabelu kakvu dobijete od dobavljača:
```
šifra;naziv;struktura;porodica;debljina;cijena_m2;debljina2;cijena2
U732;Prašnjavo siva;ST9;siva;18;36,60;25;46,75
```
- separator `;` **ili** `,` (detektuje se po redu)
- decimalni zarez **ili** tačka
- skida UTF-8 BOM koji Excel dodaje
- prepoznaje i preskače zaglavlje
- **sakuplja sve greške** sa brojem reda i šifrom, ne prekida na prvoj
- nepoznata „porodica" pada na `siva` umjesto da sruši teksturu

**`applyDecorRows(rows)`** — vraća `{ added, updated, total }`.

**`registerDecor`** sada razlikuje novi i izmijenjeni dekor (`userEdited: true`), pa
UI može označiti šta je korisnik dirao — jer se originalna cijena iz cjenovnika ne
može vratiti bez ponovnog uvoza.

**Dijalog „Ubaci dekor" → „Cjenovnik dekora":**
- naslov prikazuje **važeći cjenovnik** i broj dekora u bazi
- pretraga + lista svih dekora sa dugmetom za uređivanje (kao `combobox`/`listbox`)
- **„Uvezi CSV cjenovnik"** i **„Primjer CSV formata"** (preuzima šablon)
- pri uređivanju šifra je zaključana (inače bi nastao novi artikal a stari ostao sa
  starom cijenom)

### Verzioniranje cjenovnika — ponuda mora ostati reproducible

```js
export const PRICE_LIST = {
  source: 'ELGRAD', kind: 'MPC', effective: '2026-08-31',
  label: 'ELGRAD MPC 31.08.2026.',
};
```

`normalizeProject` sada:
- upisuje `priceList` u svaki projekat
- pri učitavanju projekta **bez** oznake → napomena „pretpostavlja se trenutni"
- pri učitavanju projekta rađenog po **drugom** cjenovniku → napomena:
  *„Projekat je rađen po cjenovniku „ELGRAD MPC 15.01.2025.", a trenutno važi
  „ELGRAD MPC 31.08.2026.". Iznosi su preračunati po novom cjenovniku…"*
- **čuva** originalnu oznaku, ne prepisuje je trenutnom

Prije ovog, učitavanje stare ponude nakon izmjene cjenovnika tiho bi dalo druge
brojeve — a korisnik ne bi znao zašto.

**19 testova** za parser i `registerDecor`.

---

## 3. `storage.js` — polyfill zamijenjen stvarnim modulom

### Šta je bilo
```js
// main.jsx
// ⚠️ VAŽNO: storage.js MORA biti PRVI import!
import './utils/storage.js';
```
Modul je na `window` kačio objekat `window.storage` sa async metodama
`get/set/delete/list`, od kojih je svaka radila `try { … } catch { return null }`.

Tri problema:
1. `window.storage` nije API ijednog preglednika — bio je ostatak iz drugog runtime-a,
   pa je **redoslijed importovanja bio kritičan** i lako se mogao slučajno razbiti
2. `catch { return null }` je **gutao pravi uzrok**. Najčešći stvarni kvar je
   `QuotaExceededError` (Safari u privatnom režimu, ili kad se nagomila projekata) —
   korisnik je dobijao generičko „Greška pri čuvanju" bez ikakve šanse da shvati da
   treba obrisati stare projekte
3. `async` potpis nad sinhronim `localStorage`-om = `await` na svakom pozivu bez koristi

### Šta je sada
`src/utils/storage.js`: `storageAvailable()`, `read()`, `write()`, `remove()`, `keys()` —
sinhrono, svaka vraća `{ ok, … }` ili `{ ok:false, reason }` sa **ljudski čitljivim**
razlogom koji razlikuje:
- „lokalna pohrana je puna — obrišite stare projekte ili izvezite pa obrišite"
- „preglednik je odbio pristup (privatni režim ili blokirani kolačići)"

Ključevi su izdvojeni u `src/utils/storageKeys.js` da ne bi nastala kružna zavisnost.

**Posljedica po API:** sve `save*`/`load*`/`delete*` akcije su sada **sinhrone** i
vraćaju `{ ok, reason }` umjesto `true`/`false`. `listProjects` vraća
`{ items, corrupt }` — **oštećeni zapisi se prijavljuju** umjesto da tiho nestanu sa
liste (korisnik je mislio da je projekat obrisan). U `LoadProjectModal` se sada vide,
sa objašnjenjem i dugmetom za brisanje.

---

## 4. Kolizija sa instalacijama u validaciji

`services` (odvod, utičnice) su se koristile u automatskom rasporedu, ali ih
`validateInProject` **uopšte nije provjeravao** — samo prepreke (prozore i vrata).
Element sa ladicama postavljen preko odvoda prošao bi kao „proizvodno ispravan", a
sanduk bi na montaži udario u cijev.

Nova `serviceWarnings(el, project, room)` je **namjerno oprezna** — odvod se postavlja
*upravo zato* da sudoper dođe preko njega, pa bi javljanje svakog preklapanja značilo
upozorenje na svakom projektu. Upozorava samo na stvarno nemoguće kombinacije:

| Situacija | Upozorenje |
|---|---|
| Element sa **ladicama** preko odvoda | „sanduk će udariti u cijev — pomjerite element ili izvod" |
| Element sa **ladicama** preko utičnice | „provjerite da li sanduk ima mjesta za instalaciju" |
| **Aparat** sa punim leđima preko utičnice | „predvidite izrez ili nišu" |
| Aparat sa `back: 'strips'` (H-PECNICA) preko utičnice | **bez upozorenja** — trake ostavljaju prolaz |
| Element sa vratima preko odvoda | **bez upozorenja** — leđa se izbuše na licu mjesta |

Provjerava se i visina: instalacija iznad ili ispod raspona elementa se ne računa.
Sve je **upozorenje**, nikad greška — element ostaje upotrebljiv.

**10 testova**, uključujući i onaj koji provjerava da *nema* buke na ispravnim
kombinacijama.

---

## 5. Mobilni i tablet prikaz

`LeftRail` je 288 px (`w-72`), `RightRail` 320 px (`w-80`). Zajedno sa minimalno
upotrebljivim viewportom od ~420 px to znači da **ispod ~1060 px raspored puca** —
viewport dobije nula širine. Na tabletu u portretu (768 px) aplikacija je bila
neupotrebljiva. Ranije nije bilo **nikakvog** prilagođavanja.

Novi `src/hooks/useViewport.js`:
- `useViewportWidth()` — prati širinu, mjerenje odgođeno kroz `requestAnimationFrame`
  (jedan izračun po frejmu, ne jedan po `resize` događaju kojih bude desetine u sekundi)
- `useIsNarrow(1100)`

Ponašanje:
- **≥ 1100 px** — paneli su stupci u rasporedu, kao i do sada
- **< 1100 px** — paneli su skriveni; dugme **„Paneli"** u zaglavlju ih otvara kao
  **izvlačeće ladice** (`fixed`, `max-w-[86vw]`, vlastita pozadina i sjena), sa
  zamračenjem ispod; klik na zamračenje ili „Zatvori panel" ih zatvara
- zaglavlje dobija `flex-wrap` da dugmad ne izlaze van ekrana
- isto važi i za ormar (`WardrobeApp` prima `narrow` / `panelsOpen` / `setPanelsOpen`)

**4 integracijska testa** koji stvarno mijenjaju `window.innerWidth` i provjeravaju da
paneli nestaju, da ladica ima `fixed`, i da se zatvara.

---

## 6. `DecorPicker` — pristupačnost

Bio je `<button>` + lista `<button>`-a **bez ijedne ARIA uloge**: čitač ekrana nije
mogao reći da je riječ o listi opcija niti koja je izabrana. Nije se moglo upravljati
tastaturom (samo Tab kroz svih ~200 dekora). Lista je ostajala otvorena nakon klika van
nje i prekrivala kontrole ispod.

Sada:
- `role="combobox"` + `aria-expanded` + `aria-haspopup="listbox"` + `aria-controls` na okidaču
- `role="listbox"` na listi, `role="option"` + `aria-selected` na svakoj stavci
- `aria-activedescendant` za praćenje aktivne stavke
- **strelice gore/dolje** za navigaciju, **Enter** za odabir, **Esc** i klik van za zatvaranje
- `aria-label` na okidaču sadrži trenutno izabrani dekor
- `aria-hidden` na dekorativnim kvadratićima boje i ikonama

**4 integracijska testa** (ARIA atributi, navigacija strelicama + Enter koji stvarno
promijeni dekor u store-u, sužavanje liste pretragom).

---

## 7. Ispravke cjenovnika iz vaših odgovora

| | Prije | Poslije |
|---|---|---|
| **Nogica 150 mm** | nije postojala — za podnožje od 150 mm krojna lista navodila „Nogica podesiva 100 mm" | `NOGICA_150` (1,45 KM); `legItemFor(legHeightMm)` bira pravu stavku i **nikad ne vraća `undefined`** |
| **Duplikat `PUSH`** | `HARDWARE.PUSH` i `HANDLES.PUSH` — isti artikal na dva mjesta, mogle su se razdvojiti pri izmjeni cjenovnika | jedna konstanta `PUSH_MECHANISM`; `HARDWARE.PUSH` je referenca na nju |

**Efekat na cijenu:** referentna kuhinja ima `legHeightMm: 150` → osnovica sa
3.866,67 KM ide na **3.874,67 KM** (+8,00 KM = 32 nogice × 0,25). Zlatni testovi su
ažurirani **sa razlogom upisanim u komentar**, ne samo prepisani.

---

## 8. Higijena

| | |
|---|---|
| `BomModal` | 7 zasebnih importa iz 3 modula spojeno u 3 (`Stat, Row, Note` / `Segmented, Btn`); uklonjen dupli import `downloadCSV` |
| `PlanView2D` | `useMemo` dodat; uklonjen nekorišteni `validateInProject` import |
| `LoadProjectModal` | `useState(() => listProjects().items)` umjesto `useState([])` + `useEffect(setState)` — bez praznog kadra i bez `set-state-in-effect` upozorenja |
| `DecorPicker` | reset aktivne stavke u `onChange` umjesto u zasebnom `useEffect` |
| Mrtav kod | Obrisano: `MATERIAL_LABEL` (theme), `worktopDecors` (decors), `TINY_PX`, `WARDROBE_PREFS_KEY`, `usageBytes`, `sheetMaterialCost`. Svi potvrđeni grep-om; `sheetMaterialCost` je obrisan jer bi zahtijevao mapiranje naziva materijala → šifra dekora, što je posao za zaseban korak |
| Lint | 3 upozorenja, sva **namjerna** i dokumentovana (2× `set-state-in-effect` za sinhronizaciju draft stanja, 3× `decorVersion` kao cache-bust, 1× `room` u Viewport3D) |

---

## Stanje na kraju svih faza

| | Početak | Kraj |
|---|---|---|
| Testovi | **0** | **324** (15 fajlova) |
| Lint (vaš config) | 10 upozorenja | **3 upozorenja, 0 grešaka** |
| `no-undef` | nije bio uključen | **uključen kao `error`** |
| Padova na bijeli ekran | 7 puteva | **0**, uz `ErrorBoundary` |
| Početni bundle | 976 kB (1 chunk) | **442 kB** + 3 lijena chunka |
| Računanje po renderu | 7,52 ms | **3,65 ms** |
| rAF petlja u mirovanju | 60 fps zauvijek | **0 fps** |
| WCAG AA | 3 pada (netestirano) | **0**, zaključano testom |
| Undo/Redo | nije postojao | 60 koraka, oba moda |
| Izvoz projekta | nije postojao | JSON + CSV + PDF |
| Optimizacija krojenja | nije postojala | shelf packing + SVG prikaz + CSV plan |
| Cjenovnik | samo u kodu | CSV uvoz + uređivanje + verzioniranje |
| Mobilni prikaz | pucao ispod ~1060 px | izvlačeće ladice |
| README | netaknut Vite šablon | stvarna dokumentacija |

### Provjera
```bash
npm run lint && npm test && npm run build
# 0 grešaka · 324 testa · 2,6 s
```

---

## ⚠️ Preostalo — treba mi vaš poslovni podatak, ne tehnički

Ovo **nisam** mogao riješiti sam jer zahtijeva odluku iz pogona:

### 1. Kako obračunavati materijal kad je iskorištenje nisko?
Izmjereno: stvarni otpad 49,9 % naspram `WASTE_FACTOR = 1,15`. Dvije opcije:
- **(a)** obračun po **potrošenim pločama** kad je iskorištenje ispod praga — treba mi
  **cijena po ploči** za svaki format i dekor (ne samo KM/m²)
- **(b)** ostaviti neto × 1,15, ali u ponudi spojiti maske u isti dekor kao korpus

Engine za (a) postoji — `summarizePlan` daje `sheetCount` po grupi. Falí samo vaša
cijena po ploči i prag ispod kojeg se prelazi na obračun po pločama.

### 2. Konstante koje sam pretpostavio (sve u `data/wardrobe.js`)
```js
GOLA_METERS_PER_FRONT     = 1.0   ← jedan profil po fronti? ili po elementu (0.0)?
DRAWER_BOX_HEIGHT_MM      = 140   ← visina boka sanduka ladice u ormaru
SLIDING_HW_PER_LEAF_KM    = 90    ← bilo paušalno 180 KM za 2 krila
SLIDING_LEAF_LIMITS       = 600–1500
HINGE_DOOR_HW_PER_LEAF_KM = 6     ← naslijeđeno iz `segmentCount * 2 * 6`
```
Zlatni testovi trenutno čuvaju **moje** vrijednosti. Kad ih potvrdite ili korigujete,
brojevi u `golden.test.js` se ažuriraju za 5 minuta.

### 3. Formati ploča
`SHEETS` u `data/tech.js` ima 2800×2070 (iverica), 4100×600 (radne ploče) i iste
dimenzije za sve debljine. Ako vaš dobavljač ima druge formate — npr. 2750×1830 za
neke dekore — to direktno mijenja broj ploča i iskorištenje.

### 4. Širina lista pile
`SAW_KERF_MM = 4`. Ako je vaša krojna pila 5 ili 6 mm, to se pomjera na svim
spojevima i mijenja broj ploča.
