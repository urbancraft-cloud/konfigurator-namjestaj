# FAZA 7 — Konfigurator spavaće sobe i ormara (novi konstrukcijski model)

Datum: 2026-09-08
Status: **završeno** — 426 testova prolazi, lint 0 grešaka, build ✓

Ova faza **prepisuje** model ormara u potpunosti, po specifikaciji koju ste
definisali. Stari model (donji korpus fiksan 2000 mm, vrata 2 krila po segmentu
iznad 600 mm, bez bočnih maski) je uklonjen — nema prekidača između starog i
novog, jer ste tražili samo ovu verziju.

Isti princip korpusa se može primijeniti na kupatilo, hodnik i sl., pa su sve
konstante u `src/data/wardrobe.js`, a sve formule u `src/engine/wardrobeLayout.js`.

---

## 1. Model konstrukcije

```
H_prostor
├─ gornja maska        100 mm   (default, EDITABILNA)
├─ GORNJI KORPUS       IZVEDEN  = H_korpusi − H_donji
├─ DONJI KORPUS       1950 mm   (default, EDITABILAN, BEZ granica)
└─ nogice = donja maska 100 mm   (50 ili 100)

W_ormar
├─ bočna maska L       18 mm    ← VAN korpusa, pune visine H_prostor
├─ n × W_segmenta
└─ bočna maska D       18 mm    ← VAN korpusa, pune visine H_prostor
```

### Formule

| Veličina | Formula | Za 2600/2400/580/3 |
|---|---|---|
| `H_donja_maska` | `= H_nogice` | 100 |
| `H_korpusi` | `H_prostor − H_nogice − H_gornja_maska` | 2400 |
| `H_gornji` | `H_korpusi − H_donji` | 450 |
| `W_korpusa` | `W_ormar − 2 × 18` | 2364 |
| `W_segmenta` | `W_korpusa / n` | 788 |
| `W_svijetlo` | `W_segmenta − 2 × 18` | 752 |
| `D_bocna_maska` | `3 (lesomal) + D_korpus + 18 (vrata)` | 601 |
| `H_bocna_maska` | `= H_prostor` | 2600 |
| `H_vrata` | `H_korpusi − 4` (2 mm fuga gore + dolje) | 2396 |
| `W_vrata` | `W_segmenta − 2 × 2` | 784 |
| `W_ladicara` | `W_svijetlo − 100` | 652 |

**Kontrolni zbir** (test koji pada ako se ne poklopi):
```
H_nogice + H_donji + H_gornji + H_gornja_maska = H_prostor
100      + 1950   + 450     + 100            = 2600 ✓
```

### Šta je ulaz, a šta izvedeno

| Ulaz (korisnik bira) | Izvedeno (računa se) |
|---|---|
| `H_prostor` | `H_korpusi` |
| `H_nogice` (50/100) | `H_donja_maska` |
| `H_donji` (default 1950, **bez granica**) | `H_gornji` |
| `H_gornja_maska` (default 100, editabilna) | `H_vrata` (editabilno, ručno prepisivo) |
| `W_ormar` (sa maskama) | `W_korpusa`, `W_segmenta`, `W_svijetlo` |
| `D_korpus` (editabilna) | `D_bocna_maska` (editabilno **zasebno L/D**) |
| `n` (broj segmenata, 1–8) | `W_ladicara` |

---

## 2. Krojna lista

Referentni ormar 2400 × 2600 × 580, 3 segmenta, nogice 100, baglame:

| # | Kol | Krojna mjera | Naziv |
|---|---|---|---|
| 1 | 6 | 1950 × 580 | Bok donjeg korpusa |
| 2 | 3 | 788 × 580 | Gornja ploča donjeg korpusa |
| 3 | 3 | 788 × 580 | Donja ploča donjeg korpusa |
| 4 | 3 | 788 × 1950 | Leđa donjeg korpusa (lesomal 3 mm) |
| 5 | 6 | 450 × 580 | Bok gornjeg korpusa |
| 6 | 3 | 788 × 580 | Gornja ploča gornjeg korpusa |
| 7 | 3 | 788 × 580 | Donja ploča gornjeg korpusa |
| 8 | 3 | 788 × 450 | Leđa gornjeg korpusa (lesomal 3 mm) |
| 9 | 1 | 2364 × 100 | Donja maska |
| 10 | 1 | 2364 × 100 | Gornja maska |
| 11 | 1 | 2600 × 601 | Bočna maska lijeva |
| 12 | 1 | 2600 × 601 | Bočna maska desna |
| 13–15 | 3 | 784 × 2396 | Vrata (1 krilo po segmentu) |

**Ukupno: 37 panela, 28,74 m².**

Okov: 12 šarki (4 po krilu, jer su vrata iznad 1200 mm) + 15 nogica (5 po segmentu).

### Bitna konstrukcijska odluka

**Svaki segment ima SVOJA dva boka** — nema zasebnih pregrada između segmenata.
Razlog: da postoje pregrade od 18 mm, ukupna širina bi bila
`n × W_segmenta + (n−1) × 18` i vrata se ne bi poklopila sa svijetlim otvorom.
Vaš primjer (1236 mm → 3 × 400 → 3 vrata po 396 mm) se poklapa samo ako segmenti
stoje jedan do drugog bez dodatne pregrade.

Cijena toga: za 3 segmenta ide 6 bokova umjesto 4 (2 boka + 2 pregrade), dakle
2 ploče 1950×580 i 2 ploče 450×580 više. To je uračunato u zlatne brojeve.

---

## 3. Zlatni brojevi (regresioni testovi)

Sve vrijednosti su u `src/engine/golden.test.js`, objekat `ORMAR_ZLATNI`.

| Stavka | Iznos |
|---|---|
| korpus — bokovi, vrh i dno po segmentu | 824,70 KM |
| leđa (lesomal 3 mm), po segmentu | 50,50 KM |
| maske — donja, gornja i bočne | 214,40 KM |
| vrata | 224,30 KM |
| nogice | 52,50 KM |
| **neto** | **1366,35 KM** |
| PDV (17 %) | 232,28 KM |
| **ukupno** | **1598,62 KM** |
| klizna vrata (isti ormar) | 1932,49 KM |
| sa ladičarem 700/3 u segmentu 1 | 1883,55 KM |

Dekor korpusa H1180 (21,50 KM/m²), vrata W1000 (28,00 KM/m²).

---

## 4. Šta je preuzeto iz kuhinjskog modula

Kako ste tražili — identična logika, ne kopija koda (pozivaju se iste funkcije):

**Fronte / vrata** → `reveals` iz `TECH_PROFILES`:
- `perSideMm = 2` (fuga po obodu krila)
- `betweenFrontsMm = 4` (zazor između dva krila)
- Vaš primjer provjeren testom: 1236 → korpus 1200 → 3 × 400 → vrata **396 mm**

**Okov** → pravilo iz `computeHardware`:
- `hingesPerLeaf = H_vrata > 1200 ? 4 : 2`

**Ladice** → `RUNNER_SYSTEMS` + `drawerBoxPanels` logika:
- izbor vodilica, `sideClearanceMm`, `boxThicknessMm`
- sanduk se raspisuje na bok / čelo-leđa / pod
- validacija `constraints.minInnerWidthMm`

**Police** → `shelfPositionsMm`: ravnomjerno `step = zone / (brojPolica + 1)`

**Podjela visine ladica** → ista logika kao `resolveFrontStack`:
jednake fronte, a ostatak od zaokruživanja (`drift`) ide na **prvu**, tako da
zbir uvijek tačno odgovara visini ladičara (nema fuge koja ne zatvara front).

---

## 5. Bugovi nađeni i popravljeni tokom ove faze

Svi su uhvaćeni testovima ili `no-undef` lint pravilom — `vite build` ih **nije**
vidio (rolldown ne provjerava nedefinisane identifikatore).

| # | Bug | Kako je nađen | Posljedica da nije nađen |
|---|---|---|---|
| **BUG-24** | `totalCorpusHeightMm` je oduzimao konstantu `TOP_MASK_H` (100) umjesto editabilne `topMaskHeightMm(w)` | zlatni test | Promjena visine gornje maske **ne bi uticala** ni na gornji korpus ni na visinu vrata — maska bi rasla "preko" korpusa, ormar bi bio viši od prostora |
| **BUG-25** | `drawerBoxOuterWidthMm` je oduzimao `sideClearanceMm`, koji je već uračunat u pravilo −100 mm → oduziman **dva puta** | test | Čelo sanduka 590 mm **šire** od samog ladičara (652 − 26 − 36 = 590) i od svjetle širine segmenta — fizički nemoguć panel u krojnoj listi |
| **BUG-26** | Petlja za vrata je iterirala po `w.segments.length` umjesto po `segmentCount` | test | Kod neusklađenog ulaza (niz od 3 segmenta, `segmentCount: 2`) krojna lista bi imala **3 reda vrata** za konstrukciju od 2 segmenta |
| **BUG-27** | `shelfCost` i `shelfCostBoard` su se **oba** dodavala u neto | `no-unused-vars` pri čišćenju | Police obračunate **duplo** |
| **BUG-28** | `sideMaskM2` je množio metre sa milimetrima i dijelio sa 1e6 | `no-unused-vars` pri čišćenju | Bočne maske bi bile **1000× precijenjene** |

### Zanimljivost: cijena NIJE monotona po visini gornje maske

Test `veća gornja maska skraćuje vrata i zato je ukupno jeftinije` dokumentuje
spregu koju je lako pogrešno protumačiti kao bug:

- gornja maska 200 mm → `H_korpusi = 2300`, `H_vrata = 2296`, gornji korpus 350
- gornja maska 50 mm → `H_korpusi = 2450`, `H_vrata = 2446`, gornji korpus 500

Veća maska pokriva dio otvora koji bi inače bio **vrata** (skuplji dekor, 28 vs
21,50 KM/m²), pa je ormar ukupno **jeftiniji**. Donji korpus ostaje 1950 u oba
slučaja, a kontrolni zbir drži za obje varijante.

---

## 6. Otvoreno pitanje koje trebate odlučiti

Rekli ste da se tih 100 mm oduzima od **svijetle** širine segmenta (opcija A).
Za referentni ormar to znači:

```
W_svijetlo = 752 mm
W_ladicara = 652 mm
sanduk     = 652 mm (vanjski), 616 mm (unutarnji, bokovi 18 mm)
prostor za vodilice = (752 − 652) / 2 = 50 mm po strani
```

GTV vodilice traže 13 mm po strani → **prolazi** (test to provjerava).

Ali za **uske segmente** pravilo pada. Za ormar 2400 mm sa 6 segmenata:

```
W_segmenta = 394 mm → W_svijetlo = 358 → W_ladicara = 258
unutarnja širina sanduka = 258 − 36 = 222 mm
GTV minInnerWidthMm = 250 mm  →  NE PROLAZI
```

Implementirao sam kako ste rekli i dodao **validaciju koja to javlja** (ne
proguta tiho) — isto kao u kuhinji za elemente u koliziji. Upozorenje se
pojavljuje pri dodavanju ladičara i kaže koliko milimetara fali i za koje
vodilice.

Ako želite da uski segmenti ipak mogu imati ladičar, opcije su:
1. smanjiti tih 100 mm na npr. 60 mm (više mjesta za vodilice),
2. ograničiti broj segmenata prema širini (npr. max 4 za 2400 mm),
3. dozvoliti uži sistem vodilica za male ladičare.

Recite koju, pa mijenjam konstantu.

---

## 7. Fajlovi

### Novi
- `src/engine/wardrobeLayout.js` — sve formule, ~430 linija, čiste funkcije
- `src/engine/wardrobeLayout.test.js` — 38 testova
- `src/engine/wardrobePricing.test.js` — prepisan za novi model, 43 testa

### Prepisani
- `src/data/wardrobe.js` — sve konstante novog modela, dokumentovane
- `src/engine/wardrobePricing.js` — BOM + cijena
- `src/store/wardrobeStore.js` — novo stanje (`roomHeightMm`, `lowerCorpusHeightMm`,
  `topMaskHeightMm`, `sideMaskDepthLeftMm/RightMm`, `doorHeightMm`)
- `src/components/wardrobe/WardrobeSettingsRail.jsx` — paneli za sve nove ulaze
- `src/components/wardrobe/WardrobeViewport3D.jsx` — 3D po novom modelu
- `src/engine/golden.test.js` — zlatni brojevi ormara
- `src/utils/projectSchema.js` — migracija starih snimaka

### Ažurirani
- `src/components/wardrobe/WardrobeSegmentRail.jsx` — visina ladičara, broj ladica,
  prikaz fronti, širina ladičara
- `src/components/wardrobe/WardrobeBomModal.jsx`
- `src/components/wardrobe/WardrobeHeader.jsx`
- `src/components/app/StartupWizard.jsx` — koraci „Dimenzije ormara" i „Vrata i
  segmenti" po novom modelu (uključujući max širinu kliznog krila, koja je u Fazi 1
  bila dodata u store ali **ne i u wizard** — taj propust je sada ispravljen)

---

## 8. Migracija starih projekata

Stari snimci u `localStorage` se prebacuju automatski pri učitavanju
(`normalizeWardrobe`), uz napomenu korisniku:

| Staro polje | Novo ponašanje |
|---|---|
| `heightMm` (visina ormara) | → `roomHeightMm`, polje se briše |
| donji korpus fiksan 2000 | → `lowerCorpusHeightMm = 1950` |
| nema gornje maske kao ulaza | → `topMaskHeightMm = 100` |
| nema bočnih maski | → `sideMaskDepthLeftMm/RightMm = null` (automatski) |
| nema visine vrata | → `doorHeightMm = null` (automatski) |
| ladičar bez `heightMm` | → 700 mm, 3 ladice |
| `doorType` nepoznat | → `baglame` |

Svaka migracija dodaje napomenu koja se prikazuje korisniku, tako da niko ne
dobije tiho promijenjenu cijenu.

**Napomena:** cijene starih projekata **će se promijeniti** jer se model
promijenio (bočne maske dodaju ~3 m² materijala po ormaru, donji korpus je 50 mm
niži). To je namjerno i zabilježeno u napomenama.

---

## 9. Provjera

```bash
cd projekat
npm install
npm run verify     # lint + test + build
```

Rezultat:
```
Test Files  17 passed (17)
Tests       426 passed (426)
Lint        4 warnings / 0 errors
Build       ✓  (459,88 kB početni + 3 lazy chunka)
```

---

## 10. Šta slijedi (nije rađeno u ovoj fazi)

- 2D prikaz ormara (`WardrobePlan2D`) — trenutno postoji samo 3D
- kupatilo / hodnik kao zasebne vrste prostorije sa istim principom korpusa
- PDF za krojnu listu ormara (ponuda ima PDF, krojna lista samo CSV)
- odluka o uskim segmentima i ladičarima (odjeljak 6)
