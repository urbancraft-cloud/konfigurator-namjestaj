# Faza 6 — obračun po pločama, formati ploča, automatsko čuvanje, CI

**Datum:** 2026-09-08 · **Testovi:** 324 → **361** · **Lint:** 3 upozorenja, 0 grešaka

Ovo je faza koja je nastala iz vaših odgovora na četiri pitanja iz Faze 5.

---

## 1. Obračun materijala po potrošenim pločama

### Vaše pravilo

> „Racunaj da je pola ploce/kvadrature utrosak kada kvadratura je manja od
> kvadrature cijele ploce"

Ugrađeno doslovno, kao konstanta koju možete mijenjati:

```js
// src/data/tech.js
export const MIN_SHEET_FRACTION = 0.5;

export function sheetConsumption(panelAreaMm2, sheetAreaMm2) {
  const fraction = area / sheet;
  const sheets = fraction <= 1 ? MIN_SHEET_FRACTION : Math.ceil(fraction);
  return { sheetAreaMm2: sheet, panelAreaMm2: area, sheets, fractionOfSheet: fraction };
}
```

| Kvadratura grupe | Naplaćuje se |
|---|---|
| ≤ 1 ploča | **0,5 ploče** |
| 1,01 – 2 ploče | 2 ploče |
| 2,01 – 3 ploče | 3 ploče |
| 5,5 ploča | 6 ploča |

### ⚠️ Greška koju sam napravio i ispravio

Prva verzija je **radne ploče** tretirala kao pločni materijal i primijenila pravilo
pola ploče na njih. Rezultat: radna ploča obračunata sa **86 KM umjesto 662 KM** —
jer se ploča od 4100×600 poklopila sa „jedna ploča = pola".

Radne ploče se **ne kupuju kao ploča pa režu** — one su gotov proizvod po **dužnom
metru** (`worktopPriceOf(dekor, širina)`), sa obrađenim rubom. Isto važi za alu lajsne.

Zato su obje stavke **izuzete** iz obračuna po pločama i ostaju na postojećem načinu:

```js
const plan = optimizeCutList(b, { excludeFlags: ['wt'] });   // 'wt' = radna ploča
const vanPloca = surfaces.lajsne + surfaces.radnaPloca;       // ostaju po dužnom metru
```

Test to zaključava: „radne ploče NEMA u planu po pločama (kupuje se po dužnom metru)".

### Šta ostaje na kojem obračunu

| Stavka | Obračun |
|---|---|
| Korpus, fronte, HDF leđa, kantovanje | **po pločama** |
| Zidna obloga, coklo, gornja maska, završne maske, LED maska | **po pločama** |
| Radna ploča | po dužnom metru (gotov proizvod) |
| Alu lajsne | po dužnom metru |
| Okov (šarke, vodilice, nogice, ručke) | po komadu / setu / metru — bez promjene |
| Rad (po panelu + po metru kanta + montaža) | bez promjene |

Osnovica se računa kao:
```
net = base.net − (pločni materijal po neto cijeni) + (pločni materijal po pločama)
```
gdje je `base.net` postojeći `projectTotals`. Rad i okov su **identični** u oba načina —
test to eksplicitno provjerava.

### Izmjereno na referentnoj kuhinji (11 elemenata)

```
NETO × 1,15 : osnovica 3.874,67 KM · PDV 658,69 · ukupno 4.533,36 KM
PO PLOČAMA  : osnovica 3.630,68 KM · PDV 617,22 · ukupno 4.247,90 KM
RAZLIKA     : −243,99 KM (−6,3 %)

pločni materijal: neto 2.154,30 KM  →  po pločama 1.910,30 KM
van ploča (radna ploča + lajsne po m'):  667,00 KM
naplaćeno ploča: 10   ·   fizički rezano: 12

  iverica 18 mm W1000 (korpus + fronte)   6 ploča   86,5 %   1.272,80 KM
  HDF 3 mm leđa                           2 ploče   62,4 %     103,17 KM
  iverica 18 mm H1180 (obloga + maska)  0,5 ploče   70,4 %     172,72 KM
  iverica 10 mm H1180 (zidna obloga)    0,5 ploče   48,2 %     162,58 KM
  iverica 18 mm U963  (coklo)           0,5 ploče   13,6 %      97,26 KM
  medijapan 20 mm     (LED maska)       0,5 ploče   14,1 %     101,80 KM
```

**Zašto je sada jeftinije, a ne skuplje?** Zato što `WASTE_FACTOR = 1,15` dodaje 15 %
na **svaku** neto površinu, uključujući glavnu grupu od 104 panela koja se stvarno
reže sa 86,5 % iskorištenja (dakle ~13,5 % otpada, ne 15 %). Istovremeno male grupe
plaćaju pola ploče. Neto ispad je niži za ovu konkretnu kuhinju.

Za kuhinju sa **mnogo sitnih maski u različitim dekorima** odnos se obrće — i upravo
zato je ovo sada vidljivo po grupama, umjesto sakriveno u jednom koeficijentu.

### Prekidač u UI-u

Lijevi panel → **„Obračun materijala"**:
- *Po potrošenim pločama (preporučeno)* — podrazumijevano
- *Neto površina × koeficijent otpada 1,15* — stari način, za poređenje

Izbor se čuva u projektu (`materialMode`) i preživljava normalizaciju; stari projekti
bez tog polja dobijaju podrazumijevanu vrijednost. Zaglavlje prikazuje koji je način
aktivan („Ukupno sa PDV-om · materijal po pločama"), a podnožje broj ploča i
iskorištenje.

`BomModal` prikazuje **obje** brojke: „Ploča (fizički) 12" i „Ploča (naplaćeno) 10",
sa objašnjenjem pravila.

---

## 2. Formati ploča — medijapan visoki sjaj 2800×1220

Vaša informacija: *„Postoje ploce dimenzija 2800x1220 a to su medijapan ploce visoki sjaj."*

To znači da **ista debljina 18 mm može biti na dva različita formata** — pa format više
ne može zavisiti samo od debljine. uveden je `boardType`:

```js
// src/data/tech.js
export const SHEET_FORMATS = {
  iverica:        { label: 'Iverica 2800×2070',              widthMm: 2800, heightMm: 2070, grainLocksRotation: true },
  medijapan_sjaj: { label: 'Medijapan visoki sjaj 2800×1220', widthMm: 2800, heightMm: 1220, grainLocksRotation: true },
  hdf:            { label: 'HDF 2800×2070',                  widthMm: 2800, heightMm: 2070, grainLocksRotation: false },
  radna_ploca:    { label: 'Radna ploča 4100×600',           widthMm: 4100, heightMm: 600,  grainLocksRotation: true },
};
```

`sheetFor(thicknessMm, boardType)` radi u tri koraka:
1. ako je `boardType` zadat → taj format
2. inače prepoznaje po debljini: **38 mm → radna ploča**, **3 mm → HDF**, ostalo → iverica
3. inače najbliža poznata debljina

Dekor nosi `boardType` (`null` = automatski). Postavlja se:
- u `DECOR_DB` (za dekore iz cjenovnika),
- u dijalogu **„Cjenovnik dekora"** → novo polje **„Format ploče"** sa sve četiri opcije
  i objašnjenjem zašto je važno,
- kroz CSV uvoz (polje se može dodati u `registerDecor` spec).

**Primjer koji test pokriva:** LED maska (20 mm) ide na `medijapan_sjaj` → format
2800×1220 → pola ploče = 101,80 KM. Da je ostalo na automatskom, računalo bi po
2800×2070 i dalo 172,72 KM — **70 KM razlike na jednoj maski**.

> ⚠️ Trenutno **nijedan** dekor u `DECOR_DB` nema `boardType: 'medijapan_sjaj'`, jer u
> cjenovniku ELGRAD 31.08.2026. nema eksplicitno označenih dekora visokog sjaja.
> Postavite ga za one dekore koji se stvarno kupuju kao medijapan — ili kroz dijalog,
> ili dodavanjem `boardType: 'medijapan_sjaj'` uz odgovarajući unos u `DECOR_DB`.

---

## 3. Automatsko čuvanje nacrta

**Problem:** projekti su se čuvali **isključivo na izričit klik**. Zatvaranje kartice,
refresh ili pad preglednika = gubitak svega od posljednjeg ručnog čuvanja.

**Rješenje:** auto-save sa debounce-om od 2,5 s, u **zaseban ključ** `kuhinja:nacrt`.

Zaseban ključ je ključan: automatsko čuvanje **nikad** ne dira ni brzi snimak
(`kuhinja:projekt`) ni imenovane projekte (`kuhinja:projects:*`). Korisnik ne može
izgubiti ono što je namjerno sačuvao.

- `saveDraft()`, `loadDraft()`, `applyDraft(room, project)` u store-u
- `loadDraft` **ne** upisuje u store — vraća podatke, pa pozivalac odluči
- podnožje prikazuje „nacrt sačuvan 14:32" sa objašnjenjem u tooltip-u
- oštećen nacrt se prijavi, ne sruši aplikaciju

**6 testova** (uključujući integracijski koji stvarno čeka debounce od 2,5 s i provjerava
`localStorage`).

---

## 4. CI workflow

`.github/workflows/ci.yml`:
```yaml
- npm ci
- npm run lint      # no-undef je GREŠKA — hvata padove koje build ne vidi
- npm test          # uključuje zlatnu regresiju cijena
- npm run build
- upload dist/ kao artefakt
```
Plus `npm run verify` = sva tri koraka lokalno.

Zašto je `lint` **prije** `test`: tokom ovog rada `no-undef` je uhvatio **tri** stvarna
pada koja build nije vidio (Vite/rolldown ne provjerava nedefinisane identifikatore —
pad se desi tek u browseru). To je najjeftinija provjera u nizu.

---

## 5. Prečice — pomoć

Novi `ShortcutsModal` (taster **?** ili **Shift+/** , i dugme „Prečice" u zaglavlju):
navodi sve tastaturne prečice i radnje mišem, uz napomenu da prečice ne rade dok je
dijalog otvoren ili dok je fokus u polju za unos.

---

## 6. Sitnije ispravke u ovoj fazi

| Šta | Zašto |
|---|---|
| Naziv grupe u planu krojenja navodi **sve** vrste komada | Zidna obloga i gornja maska u istom dekoru i debljini dijele ploču (ispravno), ali je naziv grupe uzimao samo prvi red pa je pisalo „Radna ploča Halifax hrast" za grupu koja sadrži i gornju masku |
| `parts.*` i `sheets.*` na **2 decimale** | `r1` (1 decimala) je davao 662,0 dok je zbir stavki bio 667,01 — prikaz se nije slagao sa sabircima |
| `HDF_GROUP_ID` za leđa | HDF se u cjenovniku vodi zasebno, ne po dekoru — bez ovoga je cijena bila 0 |
| `sheetPriceM2` po redu BOM-a | Završne maske se u `surfacesCost` računaju po `FRONT_PRICE.MDF_F` (MDF), pa se ista cijena mora koristiti i kod obračuna po pločama — inače bi dva načina polazila od različitih osnova |
| `boardType: 'radna_ploca'` za radne ploče | Bez toga bi format 4100×600 bio prepoznat samo po debljini, što je krhko |

---

## Stanje

| Provjera | Faza 5 | Faza 6 |
|---|---|---|
| `npm test` | 324 | **361** (16 fajlova) |
| `npm run lint` | 3 upozorenja | **3 upozorenja, 0 grešaka** |
| `npm run build` | ✅ 442 kB | ✅ **449 kB** početni + 3 lijena chunka |
| CI | nije postojao | GitHub Actions (lint → test → build) |
| Auto-save | nije postojao | debounce 2,5 s, zaseban ključ |

### Preostala 3 upozorenja lintera — sva namjerna

| | Zašto ostaje |
|---|---|
| `set-state-in-effect` u `Controls.jsx:77` | Sinhronizacija draft stanja numeričkog polja sa vanjskom vrijednošću |
| `unnecessary dependency: decorVersion` u `App.jsx` | Cache-bust za mutaciju modula `DECORS` pri registraciji dekora |
| `missing dependency: room` u `Viewport3D.jsx` | Efekat namjerno prati samo `room.width/depth/height` |

---

## Šta je ostalo (nije blokirano, ali vrijedi znati)

| Prioritet | Stavka |
|---|---|
| Srednji | **Postaviti `boardType: 'medijapan_sjaj'`** na dekore koji se stvarno kupuju kao medijapan visoki sjaj — trenutno ga nijedan dekor u `DECOR_DB` nema |
| Srednji | **Cijena po ploči** umjesto izvedene iz KM/m² — sada se računa kao `KM/m² × površina ploče`, što je tačno samo ako dobavljač ne naplaćuje format drugačije |
| Nizak | PDF za krojnu listu (ponuda ga ima; krojna lista ima samo CSV) |
| Nizak | Više prostorija / cijeli stan u jednom projektu |
| Nizak | Dijeljenje projekta linkom (`window.storage` polyfill je imao polje `shared: false` — namjera je postojala) |

### Konstante koje ste potvrdili da ostanu kako jesu
```js
GOLA_METERS_PER_FRONT     = 1.0
DRAWER_BOX_HEIGHT_MM      = 140
SLIDING_HW_PER_LEAF_KM    = 90
HINGE_DOOR_HW_PER_LEAF_KM = 6
SLIDING_LEAF_LIMITS       = 600–1500
SAW_KERF_MM               = 4      ← potvrđeno
```
Sve su u `src/data/wardrobe.js` i `src/data/tech.js` — kad ih budete korigovali,
zlatni testovi u `golden.test.js` i `wardrobePricing.test.js` odmah padnu i pokazu
tačno koji broj se pomjerio.
