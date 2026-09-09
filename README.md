# Konfigurator kuhinja i ormara

Web aplikacija za projektovanje kuhinja i ugradbenih ormara sa **kalkulacijom cijene**,
**krojnom listom za pogon** i **3D prikazom** u stvarnim mjerilima.

Cjenovnik: ELGRAD MPC 31.08.2026 (iverica, ABS trake, radne ploče, okov).

---

## Pokretanje

```bash
npm install
npm run dev          # http://localhost:5173
```

| Skripta | Šta radi |
|---|---|
| `npm run dev` | razvojni server sa HMR-om |
| `npm run build` | produkcijski build u `dist/` |
| `npm run preview` | poslužuje produkcijski build lokalno |
| `npm run lint` | oxlint (uključuje `no-undef` kao grešku) |
| `npm test` | **361 test** — engine, kalkulacije, krojenje, obračun po pločama, migracija, undo, izvoz, cjenovnik, pristupačnost, performanse, integracijski |
| `npm run test:watch` | testovi u watch režimu |
| `npm run test:e2e` | Playwright smoke test (prvo `npx playwright install chromium`) |
| `npm run verify` | lint + testovi + build — isto što radi CI |

---

## Arhitektura

Podjela je namjerna i treba je sačuvati: **engine ne zna za React**, pa se sav izračun
može testirati u čistom Node-u bez browsera.

```
src/
├── data/       ← PODACI (cjenovnik, katalog, tehničke konstante)
│   decors.js          618  baza dekora + cijene ploča/traka/radnih ploča
│   catalog.js         tipovi elemenata, šabloni, jedinstveni ID-jevi
│   tech.js            tehnološke serije, fuge, dimenzije, PDV, koeficijent otpada
│   hardware.js        vodilice, šarke, ručke, aparati, ugaoni mehanizmi
│   wardrobe.js        konstante pogona za ormar (nogice, klizna vrata, sanduk)
│   projectDefaults.js početni projekat + liste polja za migraciju
│
├── engine/     ← ČISTE FUNKCIJE (bez React-a, bez DOM-a)
│   layout.js          poravnanja, nadgradnje, auto-raspored sa radnim trokutom
│   geometry.js        AABB, kolizije, snap na susjede, pojasovi
│   panels.js          krojne mjere panela, kantovanje, spajanje identičnih
│   surfaces.js        radne ploče, obloge, coklo, maske, rezovi na spojeve ormarića
│   pricing.js         cijena elementa, okov, ukupno sa PDV-om
│   bom.js             krojna lista + CSV izvoz
│   validation.js      proizvodna ispravnost (kalibracija vodilica, niše aparata…)
│   wardrobe*.js       raspored i cijena ormara
│
├── store/      ← ZUSTAND (projectStore, wardrobeStore, uiStore)
├── components/ ← layout/ (paneli), app/ (modali, wizard), wardrobe/, ui/
├── views/      ← PlanView2D (SVG tlocrt), Viewport3D (Three.js)
└── utils/      ← projectSchema (migracija), canvas (teksture), storage, formatters
```

**Tok podataka:** `rawProject` (sirovo stanje) → `resolveProject()` (poravnanja,
nadgradnje, kote) → `computeBOM` / `projectTotals` / `surfacesCost` → UI.
Sirovo stanje se nikad ne mutira; sve izvedeno se računa u jednom prolazu.

---

## Testovi

Tri nivoa, svi u Vitest-u:

1. **Engine i store testovi** (`environment: 'node'`) — brzi, bez DOM-a.
   `pricing.test.js`, `wardrobePricing.test.js`, `surfaces.test.js`, `bom.test.js`,
   `catalog.test.js`, `projectSchema.test.js`, `store.test.js`
2. **⭐ Zlatna regresija** (`golden.test.js`) — zaključane **stvarne cijene** za
   referentnu kuhinju (11 elemenata) i referentni ormar. Svaka slučajna promjena
   kalkulacije pada ovdje. Ako namjerno mijenjate cijene, ažurirajte brojeve i
   **napišite zašto** u poruci testa.
3. **Integracijski** (`integration.test.jsx`, jsdom) — pokreće stvarnu aplikaciju i
   simulira klikove: promjena dekora fronti, wizard, numerička polja, učitavanje
   oštećenog projekta, `ErrorBoundary`.

> Three.js/WebGL ne radi u jsdom-u, pa je `Viewport3D` u integracijskim testovima
> zamijenjen mock-om. Sve ostalo je stvarni kod.

---

## Otpornost na starije podatke

Projekti se čuvaju u `localStorage`. Kako se katalog i cjenovnik mijenjaju, stariji
sačuvani projekti mogu sadržavati tipove elemenata ili dekore kojih više nema.

`utils/projectSchema.js` (`normalizeProject` / `normalizeWardrobe`) pri učitavanju:
- dopunjava polja koja nisu postojala u starijoj verziji,
- odbacuje elemente čiji tip nije u katalogu,
- zamjenjuje dekore kojih nema u cjenovniku,
- steže nevažeće brojeve,
- **vraća `notes`** koje UI prikazuje korisniku.

Nijedan od ovih slučajeva ne smije srušiti aplikaciju — `ErrorBoundary` je zadnja linija
odbrane i eksplicitno kaže da sačuvani projekti nisu izgubljeni.

---

## Rad sa projektima

| | |
|---|---|
| **Sačuvaj** | Piše u aktivni imenovani projekat ako postoji, inače u „brzi snimak" |
| **Sačuvaj kao…** | Daje ime projektu i postavlja ga kao aktivni |
| **Izvezi / Uvezi** | JSON datoteka — jedini način da se projekat iznese iz preglednika. Uvoz provjerava verziju formata i normalizuje starije zapise uz napomene |
| **Poništi / Vrati** | `Ctrl/Cmd+Z` i `Ctrl/Cmd+Y` (ili `Ctrl+Shift+Z`). 60 koraka, zasebno za kuhinju i ormar. Kontinuirane izmjene (kliznici, prevlačenje) grupišu se u jedan korak |
| **Krojna lista** | „Preuzmi CSV" (UTF-8 sa BOM-om, za Excel) ili „Kopiraj CSV" |
| **Ponuda** | „Štampaj / PDF" → A4 dokument → sistemski dijalog za štampu |

> Projekti se čuvaju u `localStorage` preglednika. **Izvezite ih kao JSON** prije
> čišćenja keša, promjene preglednika ili računara.

## Obračun materijala

Dva načina, biraju se u lijevom panelu (**„Obračun materijala"**) i čuvaju u projektu:

| Način | Kako računa |
|---|---|
| **Po potrošenim pločama** (podrazumijevano) | Paneli se grupišu po tipu ploče, debljini i dekoru, rasporede na stvarne formate, i naplaćuje se broj potrošenih ploča. **Pravilo pogona: grupa koja zauzima manje od jedne cijele ploče računa se kao pola ploče** (`MIN_SHEET_FRACTION = 0.5`) |
| Neto × koeficijent otpada | Neto površina panela × KM/m² × 1,15 — brzo i stabilno, za poređenje |

Radna ploča i alu lajsne **ostaju po dužnom metru** u oba načina — one se ne kupuju
kao ploča pa režu, nego kao gotov proizvod.

Formati ploča (`SHEET_FORMATS` u `data/tech.js`):

| Tip | Format | Rotacija |
|---|---|---|
| `iverica` | 2800 × 2070 | zaključana (tekstura) |
| `medijapan_sjaj` | 2800 × 1220 | zaključana |
| `hdf` | 2800 × 2070 | slobodna |
| `radna_ploca` | 4100 × 600 | zaključana |

Dekor nosi `boardType`; ako nije zadat, format se prepoznaje po debljini
(38 mm → radna ploča, 3 mm → HDF, ostalo → iverica). Tip ploče se bira i u dijalogu
„Cjenovnik dekora".

## Optimizacija krojenja

`engine/cutting.js` raspoređuje panele iz krojne liste na stvarne formate ploča
(2800×2070 za ivericu, 4100×600 za radne ploče) koristeći *shelf packing* sa
**guillotine rezovima** — dakle samo ravni rezovi s jednog kraja na drugi, što je
ono što klasična krojna pila može izvesti.

- Paneli sa teksturom drveta se **ne rotiraju** (šara mora ići u istom smjeru)
- Razmak između panela je širina lista pile (`SAW_KERF_MM = 4`)
- Paneli duži od najvećeg formata se **prijavljuju**, ne progutaju tiho
- Rezultat: broj ploča, iskorištenje i otpad po grupi, SVG prikaz svake ploče
  (sa mjerama u tooltip-u) i CSV izvoz plana za pogon

> ⚠️ Ovo mijenja sliku o trošku: `WASTE_FACTOR = 1,15` je procjena po neto površini,
> a ploča se **ne može dijeliti između različitih dekora**. Na referentnoj kuhinji
> stvarno iskorištenje iznosi ~50 % (glavna grupa 18 mm: 80,5 %), jer svaka grupa
> sa par sitnih komada — završne maske, coklo, LED maska — troši cijelu ploču.
> `BomModal` to sada eksplicitno prijavljuje.

## Cjenovnik

Cjenovnik (`data/decors.js`, ~640 linija) je i dalje u izvornom kodu, ali se
**može mijenjati iz aplikacije**:

- dijalog „Ubaci dekor" ima pretragu postojećih dekora i dugme za uređivanje
- uvoz cijelog cjenovnika iz **CSV tabele** (šifra;naziv;struktura;porodica;debljina;cijena…)
- svaki korisnički izmijenjen dekor dobija oznaku `izmijenjen`
- `PRICE_LIST` (izvor, vrsta, datum) se upisuje u svaki projekat; pri učitavanju
  projekta rađenog po drugom cjenovniku korisnik dobije **napomenu**, jer ponuda
  mora ostati reproducible

## Automatsko čuvanje

Nacrt se automatski čuva **2,5 s nakon svake izmjene**, u zaseban ključ
(`kuhinja:nacrt`) koji nikad ne dira brzi snimak ni imenovane projekte. Podnožje
prikazuje vrijeme posljednjeg čuvanja. Zatvaranje kartice ili pad preglednika više
ne znači gubitak rada.

## CI

`.github/workflows/ci.yml` pokreće **lint → testove → build** na svaki push.
Redoslijed je namjeran: `no-undef` je najjeftinija provjera i hvata padove koje
`vite build` **ne vidi** (rolldown ne provjerava nedefinisane identifikatore —
greška se desi tek u browseru).

## Konstante pogona

Sve vrijednosti koje određuju krojnu listu i cijenu nalaze se u `data/` — **nema
magičnih brojeva u engine-u**:

| Konstanta | Vrijednost | Fajl |
|---|---|---|
| `KITCHEN_LEGS_PER_CORPUS` | 4 po korpusu | `data/wardrobe.js` |
| `WARDROBE_LEGS_PER_SEGMENT` | 5 po segmentu | `data/wardrobe.js` |
| `GOLA_METERS_PER_FRONT` | 1,0 m po fronti | `data/wardrobe.js` |
| `DEFAULT_MAX_SLIDING_LEAF_MM` | 1000 mm (uredivo u UI) | `data/wardrobe.js` |
| `SLIDING_OVERLAP_MM` | 40 mm | `data/wardrobe.js` |
| `DRAWER_BOX_HEIGHT_MM` | 140 mm | `data/wardrobe.js` |
| `WASTE_FACTOR` | 1,15 | `data/tech.js` |
| `VAT_RATE` | 0,17 | `data/tech.js` |
| `CORPUS_BASE_H` | 720 mm | `data/tech.js` |
| `DEFAULT_LOWER_CORPUS_H` | 1950 mm (uredivo) | `data/wardrobe.js` |
| `TOP_MASK_H` | 100 mm (uredivo) | `data/wardrobe.js` |
| `MAX_HINGED_LEAF_MM` | 900 mm | `engine/wardrobeLayout.js` |

---

## Model ormara (Faza 7)

Konstrukcijski model ugradbenog ormara. Isti princip korpusa primjenjiv je na
kupatilo, hodnik i sl., pa su konstante u `data/wardrobe.js`, a formule u
`engine/wardrobeLayout.js` (detaljno u `FAZA-7-IZVJESTAJ.md`).

```
H_prostor
├─ gornja maska        100 mm   (default, UREDIVA)
├─ GORNJI KORPUS       IZVEDEN  = H_korpusi − H_donji
├─ DONJI KORPUS       1950 mm   (default, UREDIV, bez granica)
└─ nogice = donja maska 100 mm   (50 ili 100)

W_ormar  =  18 (maska L)  +  n × W_segmenta  +  18 (maska D)
             └─ bočne maske stoje VAN korpusa, pune visine H_prostor
```

| Veličina | Formula |
|---|---|
| `H_korpusi` | `H_prostor − H_nogice − H_gornja_maska` |
| `H_gornji` | `H_korpusi − H_donji` |
| `W_korpusa` | `W_ormar − 2 × 18` |
| `W_segmenta` | `W_korpusa / n` |
| `W_svijetlo` | `W_segmenta − 2 × 18` |
| `D_bocna_maska` | `3 (lesomal) + D_korpus + 18 (vrata)` — prepisivo zasebno L/D |
| `H_bocna_maska` | `H_prostor` |
| `H_vrata` | `H_korpusi − 4` (2 mm fuga gore + dolje) — prepisivo |
| `W_vrata` | `W_segmenta − 2 × 2` |
| `W_ladicara` | `W_svijetlo − 100` |

**Kontrolni zbir** (test `heightChecksum` pada ako se ne poklopi):

```
H_nogice + H_donji + H_gornji + H_gornja_maska = H_prostor
100      + 1950   + 450     + 100            = 2600 ✓
```

Svaki segment ima **svoja dva boka** (nema zasebnih pregrada između segmenata) —
inače vrata ne bi zatvorila svijetli otvor.

Fuge, zazori, šarke, vodilice i ravnomjerna raspodjela polica preuzeti su iz
kuhinjskog modula (`reveals`, `hingesPerLeaf`, `RUNNER_SYSTEMS`,
`shelfPositionsMm`), tako da se pravilo mijenja na jednom mjestu za oba modula.

---

## Dokumentacija o kvaliteti koda

- **`PREGLED-KODA.md`** — puni pregled: 23 bugova, 7 problema s performansama,
  25 zapažanja o kvaliteti, plan u 4 faze, prijedlozi novih funkcionalnosti
- **`FAZA-1-IZVJESTAJ.md`** — šta je urađeno u Fazi 1, sa izmjerenim cijenama
- **`FAZA-2-IZVJESTAJ.md`** — Faza 2: fiktivne maske, čuvanje projekata, povratne
  informacije korisniku, modal, kalkulacija ormara
- **`FAZA-3-IZVJESTAJ.md`** — Faza 3: performanse (2× brže računanje, −58 % početni
  bundle, render na zahtjev, oslobađanje GPU resursa)
- **`FAZA-4-IZVJESTAJ.md`** — Faza 4: Undo/Redo, izvoz i uvoz projekta kao datoteke,
  WCAG AA pristupačnost
- **`FAZA-5-IZVJESTAJ.md`** — Faza 5: optimizacija krojenja, cjenovnik kao podatak
  (CSV uvoz + uređivanje), mobilni prikaz, kolizije sa instalacijama
- **`FAZA-6-IZVJESTAJ.md`** — Faza 6: obračun po potrošenim pločama (pravilo pola
  ploče), format medijapana 2800×1220, automatsko čuvanje nacrta, CI
- **`IZVJESTAJ-dokazi.txt`** — sirovi dokazi iz originalne analize
"# konfigurator-namjestaj" 
