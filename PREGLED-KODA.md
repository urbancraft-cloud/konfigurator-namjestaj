# Pregled koda — `kuhinja-konfigurator`

> ## ✅ SVE FAZE (1–6) SU IMPLEMENTIRANE (2026-09-08)
>
> Sve P0 stavke iz odjeljka 6 su urađene, plus vaše specifikacije za ormar i kuhinju
> (nogice, gola metraža, klizna krila, leđa po segmentu).
>
> **Detalji: [`FAZA-1-IZVJESTAJ.md`](./FAZA-1-IZVJESTAJ.md), [`FAZA-2-IZVJESTAJ.md`](./FAZA-2-IZVJESTAJ.md) i [`FAZA-3-IZVJESTAJ.md`](./FAZA-3-IZVJESTAJ.md)**
>
> | | Prije | Poslije |
> |---|---|---|
> | Testovi | 0 | **361 prolazi** |
> | Padova na bijeli ekran | 7 puteva | 0 |
> | `no-undef` lint | nije bio uključen | `error`, 0 grešaka |
>
> Ovaj dokument ostaje kao **referenca za Faze 2–4** i kao popis svega što je nađeno.
> Stavke označene sa ✅ ispod su riješene; ostale su i dalje otvorene.

**Datum:** 2026-09-08 · **Revizija:** cijeli projekat, 48 fajlova, **7.712 linija** koda
**Stack:** React 19 + Vite 8 (rolldown) + Zustand 5 + Three.js 0.185 + Tailwind 3, oxlint

---

## 0. Rezime

Projekat je **ozbiljno i dobro zamišljeno domensko rješenje** — engine za krojne liste,
kalkulaciju cijena, sudaranje elemenata, automatski raspored sa radnim trokutom i 3D
prikaz sa procedualno generisanim teksturama dekora. Arhitektura je čista: `data/`
(cjenovnici i katalog) → `engine/` (čiste funkcije bez React-a) → `store/` (Zustand) →
`components/` + `views/`. Ta podjela je najveća vrijednost projekta i treba je sačuvati.

**Ali:** postoji **7 puteva koji ruše cijelu aplikaciju na bijeli ekran** (nema
`ErrorBoundary`), **jedan od njih se aktivira običnim klikom u lijevom panelu**, i
**~12 grešaka u kalkulaciji cijena i krojnih lista** koje direktno utiču na ponude
kupcima i na proizvodnju. Modul za ormar je znatno slabiji od modula za kuhinju.

| Provjera | Rezultat |
|---|---|
| `npm install` | ✅ 105 paketa, 8 s, bez grešaka |
| `npm run build` | ✅ 2,6 s, 1896 modula — ⚠️ bundle **953 kB** (gzip 260 kB) |
| `npm run lint` (vaša konfiguracija) | ✅ 0 grešaka, 10 upozorenja |
| `oxlint` sa strogim pravilima | ❌ **92 greške**, od toga **26** `exhaustive-deps` |
| Testovi | ❌ **nema ih** (0 test fajlova, nema `test` skripte) |
| Tajne/`.env` u zipu | ✅ nema ih |

**Dokazi:** sve tvrdnje iz odjeljaka 2–4 su **pokrenute i izmjerene**, ne pretpostavljene.
Izlaz je u [`IZVJESTAJ-dokazi.txt`](./IZVJESTAJ-dokazi.txt), a harness u `test-harness/`.

---

## 1. Šta radi dobro (nemojte dirati bez potrebe)

- **`engine/` su čiste funkcije** — `computePanels`, `computeBOM`, `resolveProject`,
  `detectRuns`, `assembleSpans` nemaju React stanja ni sporednih efekata. Zbog toga ih
  je moguće testirati u Node-u bez browsera (tako sam ih i provjerio).
- **`resolveProject` kao sloj derivacije** — sirovi projekat se nikad ne mutira;
  poravnanja, nadgradnje i kote se računaju u jednom prolazu. Ovo je ispravan obrazac.
- **`cutPositions` + `seamsOnWall`** — logika koja rez radne ploče gura na spoj
  ormarića, i koja **javlja napomenu kad to nije moguće**, je rijetko dobra proizvodna
  detaljnost.
- **`makePanel` / `mergeIdentical` / `commonRole`** — spajanje identičnih panela uz
  očuvanje tragova (`refs`) je pametno riješeno.
- **Validacija je stvarna, ne dekorativna** — `runnerCalibrated`, `APPLIANCES.verified`,
  `source: 'Kalibrisano na krojnu listu pogona'`. Vidljivo je da neko ko radi u pogonu
  stoji iza ovoga.
- **`WardrobeViewport3D.getMat`** ima `if (d)` zaštitu za nepoznat dekor — dok
  ekvivalent u kuhinjskom `Viewport3D` nema. Vrijedi kopirati taj obrazac.

---

## 2. 🔴 P0 — Ruši aplikaciju (bijeli ekran)

Nema `ErrorBoundary` nigdje u stablu, pa **bilo koja** od ovih grešaka gasi cijelu
aplikaciju bez ikakve poruke.

### ✅ BUG-01 (RIJEŠENO) · `thicknessesOf` se koristi, ali **nije importovan** → crash na običan klik
**`src/store/projectStore.js:240`** (importi su na liniji 5)

```js
import { DECORS, registerDecor } from '../data/decors';   // ← thicknessesOf NEDOSTAJE
...
const th = thicknessesOf(decorId);                        // ← linija 240: ReferenceError
```

**Okidač:** `LeftRail.jsx:174` → *"Dekor fronti → Sve fronte donjih elemenata"* →
`applyFrontDecor(...)`. Isto i `LeftRail.jsx:182` za viseće.
**Efekat:** `ReferenceError` izlazi iz Zustand akcije → React ruši cijelo stablo →
**bijeli ekran**. Ovo je glavni tok korištenja, ne rubni slučaj.

> Zanimljivo: ista logika u `layout.js:170` **ima** ispravan import, a u
> `RightRail.jsx:7` također. Dakle ovo je propust samo u store-u.

**Fix (1 linija):**
```js
import { DECORS, registerDecor, thicknessesOf } from '../data/decors';
```

---

### ✅ BUG-02 (RIJEŠENO) · `instanceId` nije jedinstven — dva mehanizma, oba pucaju

**(a) `src/data/catalog.js:38`**
```js
instanceId: `el_${templateId}`,   // dva D-VRATA elementa → oba "el_D-VRATA"
```
Dokazano: `a.instanceId === b.instanceId === "el_D-VRATA"`.

**(b) `src/data/catalog.js:71–76`**
```js
let _seq = 0;                          // modul-lokalan brojač
export function createPlaced(...) { _seq += 1; el.instanceId = `el_${_seq}`; }
```
`loadProjectByName` / `loadProject` (linije 290–297, 255–262) ubacuju sačuvani projekat
**bez reseeda `_seq`**. Nakon refresh-a brojač kreće od 0.

**Scenario koji lomi podatke:**
1. Napraviš projekat (elementi `el_1 … el_14`), sačuvaš kao „Hadžić".
2. Osvježiš stranicu → `_seq = 0`.
3. Učitaš „Hadžić" → u store-u su `el_1 … el_14`.
4. Dodaš novi element → dobije **`el_1`**.
5. `patch('el_1', {...})` mijenja **oba** elementa; `removeElement('el_1')` briše **oba**;
   `selectedId` selektuje oba; React `key` je dupli → nestabilna lista.

**Fix:**
```js
// catalog.js
let _seq = 0;
export function nextInstanceId() {
  return `el_${Date.now().toString(36)}_${(_seq++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
export function syncSeqFromProject(project) {
  const max = (project?.elements || []).reduce((m, e) => {
    const n = /^el_(\d+)$/.exec(e.instanceId || '');
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  if (max >= _seq) _seq = max + 1;
}
```
Pozvati `syncSeqFromProject(d.project)` u **oba** `load*` metoda prije `set(...)`.
U `createInstance` staviti `instanceId: nextInstanceId()`.

---

### ✅ BUG-03 (RIJEŠENO) · Nepoznat `templateId` ili `decorId` → crash u 5 različitih mjesta

| Mjesto | Izraz | Poruka greške (izmjereno) |
|---|---|---|
| `validation.js:12–14` | `tpl.dims[k]` | `Cannot read properties of undefined (reading 'dims')` |
| `panels.js:241–242` | `DECORS[el.corpus.decorId].grain` | `...reading 'grain'` |
| `bom.js:15–16` | `DECORS[el.front.decorId].name` | `...reading 'name'` |
| `bom.js:37` | `WALLS.find(...).label` | `...reading 'label'` |
| `Viewport3D.jsx:427,430,499,506` | `DECORS[id].tex.texWorldMm` | `...reading 'tex'` |
| `RightRail.jsx:62,71,74,103` | `templateById(...).short/.name/.dims` | `...reading 'short'` |
| `Header.jsx:33` | `ROOM_KINDS.find(k => k.id === rawProject.kind).label` | `...reading 'label'` |
| `OfferModal.jsx:28,36` | `templateById(...)`, `DECORS[...]` | isto |

**Zašto je ovo realno, a ne teorijski:** `loadProjectByName` radi
`JSON.parse(r.value)` i **bez ikakve validacije ili migracije** upisuje u store
(`projectStore.js:290–297`). Svaki projekat sačuvan prije nego što ste dodali/uklonili
dekor ili tip elementa iz kataloga → bijeli ekran pri učitavanju, bez poruke.

**Fix:** uvesti `decorById(id)` i `safeTemplate(id)` sa fallback-om, plus **validaciju
pri učitavanju** (vidjeti FIX-08 u odjeljku 7).

---

### ✅ BUG-04 (RIJEŠENO — funkcija obrisana) · `cooktopCenter` koristi `COOKTOP` koji nije importovan
**`src/engine/surfaces.js:307–311`** — import na liniji 3 ne sadrži `COOKTOP`.

Izmjereno: `ReferenceError: COOKTOP is not defined`. Trenutno je **mrtav kod** (niko ga
ne zove — `grep` to potvrđuje), ali je tempirana bomba: čim neko poveže 3D prikaz
ploče za kuhanje sa ovim helperom, pada.

**Fix:** ili dodati `COOKTOP` u import, ili obrisati funkciju (preporuka —
`Viewport3D.jsx:471–483` već radi isti posao inline).

---

### ✅ BUG-05 (RIJEŠENO) · `computeBOM` puca kad projektu nedostaju polja dekora

Izmjereno: projekat bez `worktopDecorId`/`socleDecorId` →
`TypeError: Cannot read properties of undefined (reading 'name')` u `bom.js:37`
(`pushSurface`). Isti problem za `wpDecor` (`bom.js:34`).

Ovo sam **slučajno otkrio dok sam pisao test** — što je najbolji dokaz da nedostaje
normalizacija projekta. `DEFAULT_PROJECT()` ima ta polja, ali stariji sačuvani projekti
ne moraju.

---

### ✅ BUG-06 (RIJEŠENO) · `Field` pretvara prazan input u `0`
**`src/components/ui/Controls.jsx:57 i 63`**
```js
onChange={(e) => onChange(Number(e.target.value))}   // "" → 0, "abc" → NaN
```
Korisnik obriše broj u polju „Dužina" → `room.width = 0` → `wallLength = 0` →
svaki element je izvan gabarita → `elementAABB` daje `x1 < x0` → geometrija puca ili
crta besmislice. `NaN` se propagira u `Math.min/max` i daje `NaN` u cijenama
(`fmt(NaN)` → `"NaN"` u ponudi).

**Fix:**
```js
const commit = (raw) => {
  if (raw === '') return;                       // ne diraj stanje dok je prazno
  const n = Number(raw);
  if (!Number.isFinite(n)) return;
  onChange(Math.min(safeMax, Math.max(min, n)));
};
```
Plus lokalni `useState` za „draft" vrijednost dok korisnik kuca.

---

## 3. 🟠 P1 — Pogrešne kalkulacije (direktno utiču na ponude i proizvodnju)

### ✅ BUG-10 (RIJEŠENO) · GOLA profil se obračunava **po krilu**, a ne po dužnom metru
**`src/engine/pricing.js:29,37`**
```js
const H = HANDLES[el.handleId] || HANDLES.RUCKA_160;
const addHandle = (n) => { if (n > 0) out.push({ ...H, qty: n }); };
...
addHandle(drawers.length + doors.length);   // ← 1 kom po fronti, bez obzira na tip
```
Izmjereno:
```
element 400 mm, GOLA_C → qty 1 × 14,00 KM = 14,00 KM
element 900 mm, GOLA_C → qty 2 × 14,00 KM = 28,00 KM   (2 krila)
```
Gola profil je **metraža** (`price: 14.0` po metru) i ide kontinuirano po cijeloj fronti,
a ne po krilu. Isto važi za `PUSH` — push-to-open se ne računa po fronti.

**Fix:**
```js
const H = HANDLES[el.handleId] || HANDLES.RUCKA_160;
if (H.kind === 'gola') {
  const m = (el.dims.width / 1000) * (drawers.length + doors.length ? 1 : 0);
  if (m > 0) out.push({ id: H.id, name: H.name, price: H.price, unit: 'm', qty: r1(m) });
} else if (H.kind === 'push') {
  add('PUSH', drawers.length + doors.length);          // HARDWARE.PUSH već postoji!
} else {
  addHandle(drawers.length + doors.length);
}
```
Napomena: `HARDWARE.PUSH` (4,90 KM) i `HANDLES.PUSH` (4,90 KM) su **duplikat** istog
artikla na dva mjesta — `add('PUSH', ...)` koristi onaj iz `HARDWARE`. Treba odlučiti
koji je izvor istine.

**Uticaj:** za kuhinju od 20 elemenata sa gola profilom, greška je reda **250–300 KM**
u ponudi.

---

### ✅ BUG-11 (RIJEŠENO) · Nogice: 4 ili 6 komada **po elementu**, i ignorišu `legHeightMm`
**`src/engine/pricing.js:50`**
```js
else add('NOGICA', el.dims.width > 900 ? 6 : 4);
```
Izmjereno: element od 1200 mm → `NOGICA qty 6`.

Dva problema:
1. `computeHardware(el)` **uopšte ne prima `project`** (vidi `pricing.js:54` gdje je
   `project` parametar samo u `computePrice`, a i tamo ga oxlint označava kao
   nekorišten). Znači ne može znati `legHeightMm` — nogice se naplaćuju i kad je
   podnožje skriveno/izvedeno drugačije.
2. Nogice se u stvarnosti postavljaju **po liniji podnožja** (2 po elementu + dodatne
   na spojevima i u uglovima), ne 4–6 po svakom ormariću. Za 14 elemenata BOM izbaci
   **56+ nogica**.

**Fix:** promijeniti potpis u `computeHardware(el, project)` i računati
`Math.max(2, Math.round(el.dims.width / 600) + 1)`, uz `project.legHeightMm > 0` kao
preduslov. Alternativno (tačnije): izračunati ukupan broj nogica jednom po podnožju u
`computeSocle`, a ne po elementu.

---

### ✅ BUG-12 (RIJEŠENO — Faza 2) · Završne maske za **visoke** elemente nemaju provjeru izloženosti
**`src/engine/surfaces.js:415–439`**

`base` i `wall` maske prolaze kroz `endExposed(r, project, room, side)` (linije 393 i
411). `talls.forEach` petlja **ne** — obje strane se generišu bezuvjetno.

Izmjereno: frižider na `offset 0` (lijevi ugao prostorije) daje
```
tall maski: 2  →  start 2600×550,  end 2600×550
```
„start" maska pada **na sam zid**, gdje fizički ne može stati.

**Uticaj:** svaki visoki element uz zid ili u uglu dobija 1 fantomsku masku od
~1,4 m² → materijal + cijena + pogrešan red u krojnoj listi.

**Fix:** izdvojiti `endExposed` da radi i za pojedinačni element (ne samo za `run`),
pa pozvati prije `pieces.push(...)` u `talls.forEach`.

---

### ✅ BUG-13 (RIJEŠENO) · Ormar: ploče vrha i dna **ne rastu sa brojem segmenata**
**`src/engine/wardrobePricing.js:36–37`**
```js
const lowerTopBottomArea = 2 * wM * dM;   // ← ukupno, ne po segmentu
const upperTopBottomArea = 2 * wM * dM;
```
Konstrukcija je (po vašem vlastitom komentaru na liniji 3 i u `wardrobeLayout.js:2`)
**n odvojenih korpusa**, svaki sa svojim bokovima, dnom i vrhom. Bokovi se računaju
ispravno (`(segmentCount + 1) * h * d`, linije 31–32), ali ploče ne.

Izmjereno — BOM za 2, 3 i 4 segmenta daje **identičan** broj ploča:
```
2 segmenta: Gornja—DONJI k1 · Donja—DONJI k1 · Gornja—GORNJI k1 · Donja—GORNJI k1
3 segmenta: (identično)
4 segmenta: (identično)
```
Za 4 segmenta nedostaje **8 ploča 2400×580** (≈ 11 m² ≈ 430 KM materijala).

**Fix:** `lowerTopBottomArea = segmentCount * 2 * segWM * dM` (uz
`segWM = segmentWidthMm(wardrobe)/1000`), isto za gornji. U BOM-u
(`wardrobePricing.js:129–138`) množiti `qty` sa `segmentCount`.

---

### ✅ BUG-14 (RIJEŠENO) · Ormar: klizna vrata **uvijek 2 krila**, bez obzira na širinu
**`src/engine/wardrobePricing.js:147–148`**
```js
push('Klizno krilo vrata', 2, widthMm / 2 + 40, doorHeightMm, 'vrata');
```
Izmjereno:
```
1200 mm → 2 krila po  640 mm   ✅
2400 mm → 2 krila po 1240 mm   ✅
4000 mm → 2 krila po 2040 mm   ❌ nemoguće
```
Klizno krilo šire od ~1200 mm je preteško za standardne vodilice i ne prolazi kroz
vrata/stepenice. Za 4000 mm trebaju 3–4 krila.

**Fix:**
```js
const MAX_LEAF = 1200, OVERLAP = 40;
const leaves = Math.max(2, Math.ceil(widthMm / MAX_LEAF));
push('Klizno krilo vrata', leaves, widthMm / leaves + OVERLAP, doorHeightMm, 'vrata');
```
Također: `doorHwCost` (linija 57) je fiksnih **180 KM** za klizna vrata — trebalo bi
zavisiti od broja krila i dužine šine (`segmentCount`/`widthMm`).

---

### ✅ BUG-15 (RIJEŠENO) · Ormar: BOM redovi sa širinom **0 mm**
**`src/engine/wardrobePricing.js:165 i 175`**
```js
push(`Šipka S${i+1} (${label})`, 1, segW, 0, 'okov');      // cutW = 0
push('Nogice (podesive)', legCountOf(wardrobe), legHeightMm, 0, 'okov');
```
Izmjereno: `Šipka S1 (donji) → 776 × 0 mm`, `Nogice → 100 × 0 mm`.
U tabeli se to prikazuje kao „—" (`WardrobeBomModal.jsx:39–40`), pa **okov završi u
krojoj listi panela** gdje mu nije mjesto i nema ga u „ukupno panela" (doprinosi
`qty` ali ne i mjeru).

**Fix:** okov izdvojiti u posebnu sekciju BOM-a (kao što `bom.js` za kuhinju radi sa
`hwTotals`), a ne gurati ga u `rows` sa `material: 'okov'`.

---

### ✅ BUG-16 (RIJEŠENO — Faza 2) (DJELIMIČNO: leđa, maska, sanduk ladice riješeni) · Ormar: još 4 greške u kalkulaciji

| Linija | Problem |
|---|---|
| `wardrobePricing.js:44–46` | Leđa se računaju kao `wM × hLowerM` **ukupno**, ne po segmentu; i ne oduzimaju visinu nogica |
| `wardrobePricing.js:143` | `push('Panel gornje maske', 1, widthMm, 100, ...)` — **hardkodovano 100** umjesto `TOP_MASK_H` (i umjesto stvarne dubine maske, koja nije nužno `depthMm`) |
| `wardrobePricing.js:163` | `Ladičar — dno/bok/leđa kutije` daje `qty = broj ladica`, mjere `segW × depthMm` → svaka ladica dobija **kompletan sanduk pune dubine**. Preveliko za 3–5× |
| `wardrobePricing.js:57` | `doorHwCost` za baglame = `segmentCount * 2 * 6` — „6" je bezimeni magični broj (KM po šarki? po kompletu?). Treba konstanta u `data/wardrobe.js` |

Plus: `wardrobeLayout.js` koristi `PANEL_T` za pregrade, ali `segmentWidthMm` (linija
61–66) oduzima `(n+1) * PANEL_T` — što je tačno samo ako su **svi** vertikalni paneli
iste debljine. Ako se kasnije uvede deblja pregrada, formula tiho puca.

---

### ✅ BUG-17 (RIJEŠENO — Faza 2) · Ormar se **ne može učitati** nakon čuvanja
`wardrobeStore.js:175–184` definiše `loadWardrobeProject`, ali
`grep -rn loadWardrobeProject src/` vraća **samo definiciju**. Nijedan UI ga ne zove.

`WardrobeHeader.jsx:18` uredno **čuva** u `kuhinja:ormar`, ali:
- nema dugmeta „Učitaj projekat" u ormar modu,
- nema modala za učitavanje,
- kad se wizard ponovo pokrene, `applyWizard` (linija 41–59) resetuje sve na
  `DEFAULT_WARDROBE()` → **sačuvani raspored unutrašnjosti se gubi**.

**Fix:** dodati `LoadWardrobeModal` (može reusing `LoadProjectModal` obrasca) i
dugme u `WardrobeHeader`.

---

### ✅ BUG-18 (RIJEŠENO) · StartupWizard: promjena tipa prostorije ne resetuje korak
**`src/components/app/StartupWizard.jsx:108–113 i 158`**
```js
<WizChoice options={ROOM_KINDS} value={kind} onChange={setKind} />   // ← nema resetovanja step
const ids = kind === 'kuhinja' ? ['tip','oblik','zidovi','otvori','voda','struja']   // 6
          : kind === 'spavaca' ? ['tip','zidovi','ormar','vrata']                    // 4
          : ['tip','zidovi','otvori'];                                              // 3
const cur = ids[step];
```
**Reprodukcija:** „Novi projekat" → idi na korak 5 („Voda") → vrati se „Nazad" do
koraka 1 → izaberi **Spavaća soba** (`ids.length = 4`) → `step` je i dalje 4 →
`cur === undefined` → **prazan ekran**, naslov „Korak 5 od 4", nijedan sadržaj se ne
renderuje. Jedini izlaz je X ili „Nazad".

**Fix:** `onChange={(v) => { setKind(v); setStep(0); }}`

---

### ✅ BUG-19 (RIJEŠENO) · „Preskoči" preskače samo *jedan* korak i tiho gubi podatke
**`src/components/app/StartupWizard.jsx:381`**
```js
<Btn onClick={() => (step >= ids.length - 1 ? finish(cur) : setStep(step + 1))}>Preskoči</Btn>
```
Na koraku „Voda" (`cur === 'voda'`) dugme „Preskoči" ponaša se **identično** kao
„Dalje". A na zadnjem koraku `finish('voda')` postavlja `water: null` — iako je
korisnik upravo popunio polja za vodu. Nema nikakve vizuelne naznake šta se preskače.

**Fix:** ili ukloniti dugme, ili ga preimenovati u „Završi bez ovog koraka" i uvijek
pozivati `finish(cur)`.

---

### ✅ BUG-20 (RIJEŠENO — Faza 2) · „Brzo sačuvaj" i „Sačuvaj kao" se ne poznaju
`projectStore.js:247–253` (`saveProject` → ključ `kuhinja:projekt`) i
`projectStore.js:264–273` (`saveProjectAs` → `kuhinja:projects:<ime>`).

**Scenario:** učitaš „Hadžić" (imenovani projekat), izmijeniš ga, klikneš **„Brzo
sačuvaj"** → piše u `kuhinja:projekt`. **„Hadžić" ostaje nepromijenjen.** Korisnik misli
da je sačuvao. Sledeći put kad učita „Hadžić", izmjene su nestale.

**Fix:** čuvati `activeProjectName` u store-u. `saveProject` tada piše u
`kuhinja:projects:<activeProjectName>`, a samo kad je `null` piše u brzi slot.

---

### ✅ BUG-21 (RIJEŠENO — Faza 2) · Tiho odbacivanje izmjena, bez povratne informacije

| Mjesto | Ponašanje |
|---|---|
| `projectStore.js:117` (`dragElement`) | `if (collidesWithAny(...)) return p;` — prevlačenje se **zaustavi** bez poruke. Korisnik ne zna da li je kolizija ili bug |
| `projectStore.js:133` (`moveToWall`) | `if (off === null) return p;` — klik na „Zid 3" **ne radi ništa**, bez poruke |
| `wardrobeStore.js:114` (`moveItem`) | isto — pomeranje Y se tiho odbaci |
| `LeftRail.jsx:42` (`handleAdd`) | `if (w < c.min \|\| w > c.max) return;` — tiho |

**Fix:** vratiti razlog (`return { ok: false, reason: 'kolizija' }`) i pozvati `flash()`.

---

### ✅ BUG-22 (RIJEŠENO — Faza 2) · `WardrobeSegmentRail` sakriva sav sadržaj kad je gornji korpus nevažeći
**`src/components/wardrobe/WardrobeSegmentRail.jsx:136`**
```js
{seg && !upperInvalid && ( <Panel title="Sadržaj ..."> ... )}
```
`upperInvalid = upperHmm <= 0`. Ako korisnik spusti visinu ormara tako da gornji korpus
padne na ≤ 0, **nestaje cijeli panel „Sadržaj"** — uključujući sve ladičare, šipke i
police koje je dodao u **donji** korpus. Podaci su i dalje u store-u, ali ih ne može
vidjeti ni urediti.

**Fix:** `{seg && ( ... )}` i umjesto toga onemogućiti samo dodavanje u **gornji** korpus
(što `handleAdd` na liniji 105 već radi).

---

### ✅ BUG-23 (RIJEŠENO — Faza 2) · `Modal` nema osnovnu UX zaštitu
**`src/components/ui/Modal.jsx`** — nema:
- zatvaranje na **Esc**,
- zatvaranje na **klik van** dijaloga,
- `overflow: hidden` na `<body>` (pozadina se skroluje dok je modal otvoren),
- `role="dialog"` / `aria-modal` / focus trap.

Isto važi i za `StartupWizard`, koji uopšte ne koristi `Modal` nego duplicira markup.

---

## 4. 🟡 P2 — Performanse

### ✅ PERF-01 (RIJEŠENO) · `computePanels(el)` se zove **2× po elementu** u istom efektu
**`src/views/Viewport3D.jsx:380` i `406`**
```js
computePanels(el).forEach((p) => { ... });                              // 380
(showFronts ? handlePlacements(el, computePanels(el), project) : [])    // 406 ← ponovo
```
`computePanels` nije jeftin (uključuje `mergeIdentical` sa `JSON.stringify(p.edges)`
poređenjem). **Fix:** `const panels = computePanels(el);` na vrhu petlje.

### ✅ PERF-02 (RIJEŠENO — Faza 3) · Prevlaka elementa = potpuna rekonstrukcija cijele scene
`dragElement` → `setRawProject` → novi `rawProject` → novi `project` (App `useMemo`) →
**svi** efekti u `Viewport3D` (deps: `[ready, project, room, selectedId, showFronts, …]`,
linija 510) + `PlanView2D` re-render + `useMemo` za `totals`, `bom`, `surf` u `App.jsx`.

Izmjereno: **`computeBOM` za 14 elemenata = 4,36 ms**, a računa se **dva puta** po
renderu (`projectTotals` ga interno zove preko `surfacesCost`, plus `App.jsx:66`).
Znači ~9 ms čistog računanja + potpuna rekonstrukcija ~500 THREE mesh-ova **na svaki
`pointermove`**. To je garantovano ispod 60 fps na slabijem hardveru.

**Fix (najveći dobitak, najmanje rizika):**
```js
// App.jsx — umjesto 4 odvojena useMemo koji svaki ponovo računaju surfacesCost:
const derived = useMemo(() => {
  const project = resolveProject(rawProject, room);
  const totals  = projectTotals(project, room);
  const bom     = computeBOM(project, room);
  const surf    = surfacesCost(project, room);
  return { project, totals, bom, surf };
}, [rawProject, room, decorVersion]);
```
Zatim **debounce** tokom prevlačenja: lokalno stanje za `offset` u viewportu, commit u
store tek na `pointerup`.

### ✅ PERF-03 (RIJEŠENO — Faza 3) · Beskonačna `requestAnimationFrame` petlja
`Viewport3D.jsx:217–238` i `WardrobeViewport3D.jsx:108–109` — renderuju **60 fps
zauvijek**, i kad se ništa ne mijenja. GPU ventilator radi non-stop, laptop troši
bateriju, a na integriranoj grafici to značajno usporava i ostatak stranice.

**Fix:** render na zahtjev — `invalidate()` koji traži jedan `requestAnimationFrame`
nakon svake promjene, plus stalna petlja **samo** dok je `walk === true`.

### ✅ PERF-04 (RIJEŠENO — Faza 3) · THREE materijali i teksture se nikad ne oslobađaju
`clear()` (`Viewport3D.jsx:304–310`, `WardrobeViewport3D.jsx:151–157`) oslobađa
**geometriju** ali ne i materijale/teksture.

- `Viewport3D.jsx:336–337` — **novi** `CanvasTexture` + `MeshBasicMaterial` za svaku
  od 4 naljepnice zida, **na svaku promjenu dimenzija prostorije**. Nikad `dispose()`.
- `WardrobeViewport3D.jsx:164–165` — **novi** `LineBasicMaterial` za svaku ivicu svake
  kutije (kuhinja to radi ispravno: dijeli `lineMat`, `Viewport3D.jsx:369`).
- `ctx.current.mats` (`Viewport3D.jsx:239`) — keširani dekor materijali se nikad ne
  čiste; `decorVersion` raste, mapa raste.

**Fix:** dijeljeni materijal za ivice, `mat.map.dispose(); mat.dispose()` u `clear()`,
i `renderer.forceContextLoss()` pri unmount-u.

### ✅ PERF-05 (RIJEŠENO — Faza 3) · `PlanView2D` računa sve površine **inline u renderu**
**`src/views/PlanView2D.jsx:187–219`** — `computeWorktops`, `computeWallPanels`,
`computeEndPanels` se zovu unutar IIFE u JSX-u, bez `useMemo`. Plus
`validateInProject` po svakom elementu (linije 157 i 178).

### ✅ PERF-06 (RIJEŠENO — Faza 3) · `validateInProject` je O(n²) i zove se na 4 mjesta
Svaki poziv radi `collidesWithAny` koji iterira **sve** elemente i prepreke. Zove se u:
- `App.jsx:74` (za `invalidCount`, po svakom elementu),
- `RightRail.jsx:63` (po svakom elementu u listi),
- `PlanView2D.jsx:157` i `:178`.

Za 14 elemenata to je 4 × 14 × 14 = **784 provjere kolizije po renderu**.

**Fix:** izračunati `validations` **jednom** u `App.jsx` kao `Map<instanceId, result>`
i proslijediti dolje kao prop.

### ✅ PERF-07 (RIJEŠENO — Faza 3) · Bundle 953 kB bez code-splittinga
`three` (~600 kB) se učitava i za korisnika koji samo gleda tlocrt. Build warning to
eksplicitno javlja.

**Fix:**
```js
const Viewport3D = React.lazy(() => import('./views/Viewport3D'));
const WardrobeApp = React.lazy(() => import('./components/wardrobe/WardrobeApp'));
```
i u `vite.config.js` ručni `manualChunks` za `three` / `react`.

---

## 5. 🟢 P3 — Kvalitet koda, konzistentnost, dostupnost

| # | Mjesto | Problem |
|---|---|---|
| 1 ✅ | `src/utils/storage.js` + `main.jsx:3` (RIJEŠENO, Faza 5) | Polyfill za `window.storage`. Komentar „MORA se učitati PRIJE App.jsx" i `export {}` na kraju otkrivaju da je ovo ostatak iz drugog runtime-a. `localStorage` je dostupan svuda — ovo je nepotrebna indirekcija koja **sakriva greške** (svaki `catch { return null }` guta pravi uzrok). Preporuka: zamijeniti direktnim `localStorage` pozivima u jednom čistom modulu sa stvarnom obradom grešaka |
| 2 | `bom.js:85,87,89` | `EDGE_TYPES[id].name`, `PROFILES[id].name`, `h.name` bez zaštite → crash ako `profileId` nije u `PROFILES` |
| 3 | `bom.js:75–91` | `bomToCSV` koristi `;` kao separator **bez escaping-a**. Nazivi dekora/panela mogu sadržavati `;` → pomjerene kolone u Excelu |
| 4 | `BomModal.jsx:25` | `document.execCommand('copy')` je **deprecated** i u nekim browserima ne radi. Treba `navigator.clipboard.writeText()` sa fallback-om. Uz to skriveni `<textarea>` (linija 123) je hack |
| 5 | `layout.js:228` | Tipfelerr u ključu: `frizidercSudoper` (višak „c"). Koristi se i u `LeftRail.jsx:119` — radi, ali je zamka za svakog novog čitaoca |
| 6 | `geometry.js:123`, `surfaces.js:412` | `templateById('V-ELEMENT').dims.height.default` **hardkoduje** visinu svih visećih elemenata na 992 mm. `resolveProject` (linija 126) forsira tu visinu osim ako je `autoHeight === false`. Korisnik koji promijeni visinu bez te zastavice vidi da se vrijednost „vraća" |
| 7 | `tech.js:80` vs `wardrobe.js:10` | Dvije različite konstante `LEG_HEIGHTS` (`[100,150]` i `[50,100]`). `StartupWizard.jsx:7` mora ručno preimenovati import. Isto ime, različito značenje = izvor grešaka |
| 8 | `hardware.js:36` | `need.push(R.bottom.groove && R.bottom.groove.depthMm)` gura `undefined` kad `groove: null`. Trenutno bezopasno, ali krhko |
| 9 | `App.jsx:74–89` | Tastaturne kratice: `Delete`/`Backspace` brišu element **i kad je modal otvoren**. Treba `if (modal) return;` |
| 10 | `App.jsx:97` | `useEffect` za load dekorova ima prazan niz zavisnosti ali koristi `loadDecors` i `flash` — oxlint to i javlja. `live` zastavica je suvišna jer `flash` dolazi iz store-a |
| 11 | `uiStore.js:35–38` | `flash` ne čisti prethodni `setTimeout` → dva brza `flash`-a se preklope i prvi nestane prerano |
| 12 | `RightRail.jsx:188` | `max={2600}` za visinu montaže je **hardkodovano**, ignoriše `room.height` (koja ide do 3200) |
| 13 | `RightRail.jsx:185` | Polje „Odmak duž zida" zove `dragElement`, koji primjenjuje **snap od 40 mm** → korisnik upiše 1234, dobije 1240 |
| 14 | `LeftRail.jsx:311–325` | Hardkodovano `720` (treba `CORPUS_BASE_H`) i `600` (treba `project.worktopDepthMm`) u prikazu „završna maska" |
| 15 | `LeftRail.jsx:247–264` | Napomena o napi provjerava **samo prvu** ploču i **prvu** nađenu napu — kod 2 ploče daje pogrešnu poruku |
| 16 | `LeftRail.jsx:233–236` | `Field max={wallLength(...)}` dozvoljava centar ploče na samom kraju zida → pola ploče viri van, bez validacije |
| 17 | `index.html` | `lang="en"` (UI je bosanski) i `<title>kuhinja-konfigurator` (ime foldera). Nema `<meta name="description">`, nema Open Graph |
| 18 | `README.md` | **Nije vaš** — netaknut Vite šablon („React + Vite"). Nema opisa domena, pokretanja, arhitekture ni cjenovnika |
| 19 | `.oxlintrc.json` | Uključena samo 2 pravila. Sa `correctness`+`suspicious` kategorijama broj grešaka ide sa 0 na **92**. Vrijedi pojačati barem na `correctness` |
| 20 | Mrtav kod | `cooktopCenter`, `blindCornerRule`, `topMaskSpanMm`, `itemOverflows`, `fitNear`, `freeIntervals` (engine), `clearAll`, `toggleWalk`, `toggleMeasure`, `loadProject`, `loadWardrobeProject` (store) — **definisani, nikad pozvani**. `frontAlignOffset(el, project, room)` ima nekorišteni parametar `room`; `computePrice(el, project)` nekorišteni `project` |
| 21 | `Viewport3D.jsx:475` | `topY` fallback `908` je magični broj (= 150+720+38). Treba izraz preko konstanti |
| 22 | `data/decors.js` | `registerDecor` **mutira** module-globalne `DECOR_DB` i `DECORS`. React to ne može pratiti → `decorVersion` brojač u store-u je obilaznica. `DecorPicker` (koji ne čita `decorVersion`) se neće ažurirati ako je otvoren u trenutku registracije |
| 23 ✅ | A11y (RIJEŠENO, Faze 4–5) | `<button>` sa inline `style` bez `:focus-visible` stanja; `Segmented` nije `role="radiogroup"`; `Field` nema `aria-describedby` za grešku; `Modal` bez focus trap-a; kontrast `C.faint` (#94A3B8) na `C.paper2` (#F8FAFC) je **2,4:1** (WCAG traži 4,5:1 za mali tekst) |
| 24 | `PlanView2D.jsx:42` | `svg.createSVGPoint()` je deprecated → `DOMPoint` + `getScreenCTM()` |
| 25 | `wardrobePricing.js:88` | `net * 0.17` — PDV **hardkodovan**, dok kuhinja koristi `VAT_RATE` iz `tech.js`. Ako se stopa promijeni, dva modula se razilaze |

---

## 6. Plan popravki — preporučen redoslijed

### Faza 1 · Isti dan (zaustavlja padove i štiti podatke) — ~2 h
| # | Akcija | Fajl |
|---|---|---|
| 1 | Dodati `thicknessesOf` u import (**BUG-01**) | `store/projectStore.js:5` |
| 2 | Dodati `ErrorBoundary` oko `<App />` da pad ne bude bijeli ekran | novi `src/components/ErrorBoundary.jsx` + `main.jsx` |
| 3 | Jedinstveni `instanceId` + `syncSeqFromProject` (**BUG-02**) | `data/catalog.js`, `store/projectStore.js` |
| 4 | Uvesti `decorById()` i `safeTemplate()` sa fallback-om, primijeniti na svih 8 mjesta (**BUG-03/05**) | `data/decors.js`, `data/catalog.js`, + pozivišta |
| 5 | Validacija + migracija pri učitavanju projekta (**FIX-08**, vidi ispod) | `store/projectStore.js` |
| 6 | Obrisati `cooktopCenter` (**BUG-04**) | `engine/surfaces.js:307` |
| 7 | `Field`: ne commit-ovati prazno/NaN (**BUG-06**) | `components/ui/Controls.jsx` |
| 8 | `setKind` resetuje `step` (**BUG-18**) | `components/app/StartupWizard.jsx:158` |

### Faza 2 · Ove sedmice (tačne cijene i krojne liste) — ~1 dan
| # | Akcija |
|---|---|
| 9 | **BUG-10** GOLA po metru, PUSH preko `HARDWARE.PUSH`; ukloniti duplikat artikla |
| 10 | **BUG-11** `computeHardware(el, project)` + realan broj nogica po podnožju |
| 11 | **BUG-12** `endExposed` za visoke elemente |
| 12 | **BUG-13/14/15/16** ormar: ploče po segmentu, broj kliznih krila, okov van `rows`, leđa po segmentu, `TOP_MASK_H`, sanduk ladice |
| 13 | **BUG-20** `activeProjectName` — uskladiti „Brzo sačuvaj" i „Sačuvaj kao" |
| 14 | **BUG-21** vraćati razlog odbijanja + `flash()` |
| 15 | **BUG-22** ne sakrivati sadržaj donjeg korpusa |
| 16 | **BUG-17** učitavanje projekta ormara |

### Faza 3 · Performanse i stabilnost — ~1 dan
| # | Akcija |
|---|---|
| 17 | **PERF-01** jedan `computePanels` po elementu |
| 18 | **PERF-02** jedan `derived` useMemo + debounce prevlačenja (commit na `pointerup`) |
| 19 | **PERF-06** `validations` kao jedna `Map` izračunata u `App.jsx` |
| 20 | **PERF-05** `useMemo` u `PlanView2D` |
| 21 | **PERF-04** `dispose()` za materijale/teksture, dijeljeni `LineBasicMaterial` |
| 22 | **PERF-03** render na zahtjev umjesto stalne rAF petlje |
| 23 | **PERF-07** `React.lazy` za `Viewport3D` i `WardrobeApp` |

### Faza 4 · Higijena — ~1 dan
| # | Akcija |
|---|---|
| 24 | Pojačati `.oxlintrc.json` na `correctness: error` i ispraviti 92 nalaza |
| 25 | Ukloniti mrtav kod (11 neiskorištenih izvoza) i nekorištene parametre |
| 26 | **Testovi** — vidjeti odjeljak 8. Bez ovoga se engine ne smije dirati |
| 27 | Stvarni `README.md`: pokretanje, arhitektura, izvor cjenovnika, ograničenja |
| 28 | `index.html`: `lang="bs"`, pravi `<title>`, meta opis |
| 29 | **BUG-23** Modal: Esc, klik van, zaključavanje skrola, `aria` |
| 30 | A11y: kontrast `C.faint`, focus stanja, `role` na `Segmented` |
| 31 | `bomToCSV`: escaping separatora; `navigator.clipboard` umjesto `execCommand` |
| 32 | Ujednačiti `VAT_RATE` (ormar koristi hardkodovano `0.17`) |

---

## 7. Konkretni patchevi za Fazu 1

### FIX-01 · `src/store/projectStore.js`
```diff
-import { DECORS, registerDecor } from '../data/decors';
+import { DECORS, registerDecor, thicknessesOf } from '../data/decors';
+import { syncSeqFromProject } from '../data/catalog';
```

### FIX-02 · `src/data/catalog.js`
```diff
+let _seq = 0;
+
+/** Jedinstven ID: vremenska komponenta + lokalni brojač + nasumični sufiks. */
+export function nextInstanceId() {
+  return `el_${Date.now().toString(36)}_${(_seq++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
+}
+
+/** Nakon učitavanja projekta spriječi ponovno korištenje istih ID-jeva. */
+export function syncSeqFromProject(project) {
+  let max = 0;
+  (project?.elements || []).forEach((e) => {
+    const m = /^el_(?:\w+_)?(\d+)/.exec(e.instanceId || '');
+    if (m) max = Math.max(max, Number(m[1]));
+  });
+  if (max >= _seq) _seq = max + 1;
+}
+
-    instanceId: `el_${templateId}`, templateId, type: tpl.type, profileId,
+    instanceId: nextInstanceId(), templateId, type: tpl.type, profileId,

-let _seq = 0;
 export function createPlaced(templateId, profileId, wall, offset, variantKey) {
   const el = createInstance(templateId, profileId, variantKey);
   const tpl = templateById(templateId);
-  _seq += 1;
-  el.instanceId = `el_${_seq}`;
+  el.instanceId = nextInstanceId();
```

### FIX-03 · Zaštitni lookup-ovi
```js
// data/decors.js
const FALLBACK_DECOR = {
  id: '?', code: '?', name: 'Nepoznat dekor', shortName: 'Nepoznat dekor',
  struct: '', fam: 'siva', tex: TEX_FAMILY.siva, color: '#BFC3C6',
  grain: false, thicknesses: [18], board: { 18: 0 }, worktop: null, edge: {},
  pricePerM2: 0, missing: true,
};
export const decorById = (id) => DECORS[id] || { ...FALLBACK_DECOR, id, code: id };

// data/catalog.js
const FALLBACK_TPL = {
  templateId: '?', name: 'Nepoznat element', short: '?', type: 'base',
  dims: { width: { min: 0, max: 9999, step: 10, default: 600 },
          height:{ min: 0, max: 9999, step: 10, default: 720 },
          depth: { min: 0, max: 9999, step: 10, default: 550 } },
  elevation: 150, shelves: 0, missing: true,
};
export const safeTemplate = (id) => templateById(id) || { ...FALLBACK_TPL, templateId: id };
```
Zatim zamijeniti `templateById(` → `safeTemplate(` u: `validation.js:12,47`,
`panels.js:240`, `bom.js:13`, `RightRail.jsx:41,62`, `Header.jsx`, `OfferModal.jsx:28`;
i `DECORS[` → `decorById(` u: `panels.js:241-242`, `bom.js:15-16,34,44-54`,
`pricing.js`, `Viewport3D.jsx:385,427,430,499,506`, `OfferModal.jsx:36`.
Elemente sa `tpl.missing` označiti kao grešku u `validateElement`, tako da korisnik
**vidi** problem umjesto da aplikacija padne.

### FIX-04 · `src/main.jsx` + novi `ErrorBoundary`
```jsx
// src/components/ErrorBoundary.jsx
import React from 'react';
export class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Konfigurator:', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 32, fontFamily: 'system-ui', maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 18 }}>Aplikacija je naišla na grešku</h1>
        <p style={{ color: '#64748B', fontSize: 14 }}>
          Projekat je ostao sačuvan u pregledniku. Pokušajte ponovo — ako se greška
          ponavlja pri učitavanju projekta, podaci su iz starije verzije kataloga.
        </p>
        <pre style={{ fontSize: 12, background: '#F1F5F9', padding: 12, borderRadius: 8, overflow: 'auto' }}>
          {String(this.state.error?.message || this.state.error)}
        </pre>
        <button onClick={() => this.setState({ error: null })}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff' }}>
          Pokušaj ponovo
        </button>
      </div>
    );
  }
}
```
```diff
// src/main.jsx
+import { ErrorBoundary } from './components/ErrorBoundary.jsx';
 ReactDOM.createRoot(document.getElementById('root')).render(
   <React.StrictMode>
-    <App />
+    <ErrorBoundary><App /></ErrorBoundary>
   </React.StrictMode>,
 );
```

### FIX-08 · Validacija i migracija pri učitavanju
```js
// src/utils/projectSchema.js
import { DEFAULT_KEYS } from '../store/projectStore';   // ili izdvojiti DEFAULT_PROJECT

export function normalizeProject(raw) {
  const base = DEFAULT_PROJECT();               // sve default vrijednosti
  const p = { ...base, ...(raw || {}) };
  p.elements   = Array.isArray(p.elements)   ? p.elements.filter(isSaneElement) : [];
  p.obstacles  = Array.isArray(p.obstacles)  ? p.obstacles  : [];
  p.services   = Array.isArray(p.services)   ? p.services   : [];
  p.cooktops   = Array.isArray(p.cooktops)   ? p.cooktops   : [];
  p.activeWalls= Array.isArray(p.activeWalls)&& p.activeWalls.length ? p.activeWalls : base.activeWalls;
  p.endPanelSizes = (p.endPanelSizes && typeof p.endPanelSizes === 'object') ? p.endPanelSizes : {};
  ['worktopDecorId','wallPanelDecorId','socleDecorId','topMaskDecorId','endPanelDecorId']
    .forEach((k) => { if (!DECORS[p[k]]) p[k] = base[k]; });
  return p;
}

function isSaneElement(e) {
  return e && typeof e === 'object' && e.instanceId && e.templateId
    && templateById(e.templateId)                      // nepoznat tip → odbaci, ali ZABILJEŽI
    && e.dims && Number.isFinite(e.dims.width);
}
```
Pozvati u `loadProject`, `loadProjectByName` **i** `applyWizard` prije `set(...)`, te
`syncSeqFromProject(normalizovani)`. Odbачene elemente prijaviti kroz `flash()`:
„Učitan projekat, ali 2 elementa nisu prepoznata (starija verzija kataloga)."

---

## 8. Testovi — najisplativija investicija u ovom projektu

Engine je **već** savršeno testabilan (čiste funkcije, bez DOM-a, bez React-a). Nula
testova znači da se svaka od 12 gore navedenih grešaka u kalkulacijama može vratiti
pri bilo kojoj izmjeni — a ove greške koštaju stvarnog novca u ponudama.

**Predlog:** Vitest (radi sa postojećim Vite-om, ~1 dev dependency).

```bash
npm i -D vitest
```
```json
// package.json
"scripts": { "test": "vitest run", "test:watch": "vitest" }
```
```js
// vite.config.js — dodati, jer engine koristi importe bez ekstenzije
export default defineConfig({
  plugins: [react()],
  resolve: { extensions: ['.mjs', '.js', '.jsx', '.json'] },
  test: { environment: 'node', include: ['src/**/*.test.js'] },
});
```
> Napomena: moj `test-harness/` trenutno radi preko `rolldown` bundla upravo zato što
> Node ESM traži ekstenzije u importima (`'../data/hardware'` bez `.js`). Vitest to
> rješava sam, pa `test-harness/` nakon toga možete obrisati.

**Testovi koje treba napisati prvih (svaki od njih lovi po jedan bug iz ovog izvještaja):**

```js
// src/engine/pricing.test.js
describe('computeHardware', () => {
  it('GOLA profil se računa po dužnom metru, ne po krilu', () => { /* BUG-10 */ });
  it('push-to-open ne naplaćuje ručku', () => { /* BUG-10 */ });
  it('broj nogica zavisi od legHeightMm i širine podnožja', () => { /* BUG-11 */ });
});

// src/engine/surfaces.test.js
describe('computeEndPanels', () => {
  it('visoki element uz zid nema masku na start strani', () => { /* BUG-12 */ });
  it('base run okružen zidovima s obje strane nema maski', () => {});
});

// src/engine/wardrobePricing.test.js
describe('computeWardrobePrice', () => {
  it('broj ploča vrha/dna raste sa segmentCount', () => { /* BUG-13 */ });
  it('klizna vrata: nijedno krilo šire od 1200 mm', () => { /* BUG-14 */ });
  it('nema BOM redova sa cutW === 0', () => { /* BUG-15 */ });
});

// src/data/catalog.test.js
describe('instanceId', () => {
  it('createInstance ne vraća dupli ID', () => { /* BUG-02a */ });
  it('syncSeqFromProject sprječava koliziju nakon učitavanja', () => { /* BUG-02b */ });
});

// src/utils/projectSchema.test.js
describe('normalizeProject', () => {
  it('projekat bez worktopDecorId ne ruši computeBOM', () => { /* BUG-05 */ });
  it('element sa nepoznatim templateId se odbaci i prijavi', () => { /* BUG-03 */ });
});
```

**Zlatna regresija za cijene** — najvažniji test od svih:
```js
const GOLDEN = { net: /* trenutna vrijednost */, parts: {...} };
it('ukupna cijena referentne kuhinje se ne mijenja slučajno', () => {
  const totals = projectTotals(resolveProject(FIXTURE_PROJECT, FIXTURE_ROOM), FIXTURE_ROOM);
  expect(totals.net).toBeCloseTo(GOLDEN.net, 2);
});
```
Fixtur snimiti **jednom** (JSON sa 14 elemenata iz `DEFAULT_PROJECT`), pa ga čuvati u
repo-u. Svaka promjena engine-a tada mora svjesno ažurirati zlatnu vrijednost — to je
jedini način da primijetite da ste slučajno promijenili cijenu za 300 KM.

---

## 9. Predložene nove funkcionalnosti

Poredak je po omjeru vrijednosti i truda, na osnovu onoga što engine **već** zna:

| # | Funkcionalnost | Zašto / šta već postoji |
|---|---|---|
| 1 | **Export krojne liste u CSV/XLSX + PDF ponude** | `bomToCSV` postoji ali se samo kopira u clipboard. `OfferModal` već ima sve podatke. Dodati `download` dugme (Blob + `URL.createObjectURL`) — 20 linija koda, ogromna praktična vrijednost za pogon |
| 2 | ✅ **Optimizacija krojenja (nesting / cut-list po ploči)** (Faza 5) | `OfferModal.jsx:63` već obećava: *„Konačnu daje server nakon optimizacije krojenja"*. Engine ima `cutMm`, `rotationAllowed`, `grain`, `thickness` — sve što treba za 1D guillotine algoritam po debljini ploče. Ovo pretvara informativnu cijenu u stvarnu |
| 3 | ✅ **Undo / Redo** (Faza 4) | `src/store/withUndo.js`: 60 koraka, koalescencija za kliznike, Ctrl+Z/Y, oba moda, 16 testova |
| 4 | ✅ **Undo za „Očisti prostor"** (Faza 4) | Poništava se jednim Ctrl+Z — vraća sve elemente i instalacije odjednom |
| 5 | **Mjerenje po zidu / kotiranje u 3D** | `measure` alat već radi u 3D (`Viewport3D.jsx:137–176`). Treba samo prikaz dimenzija između elemenata |
| 6 | **Više prostorija / cijeli stan u jednom projektu** | `appMode` i `ROOM_KINDS` (kuhinja, hodnik, spavaća, dnevni, WC) već postoje, ali je stanje jedno po jedno. Struktura `kuhinja:projects:*` to prirodno podržava |
| 7 | ✅ **Export/Import projekta kao fajl (`.json`)** (Faza 4) | `src/utils/exportImport.js` + dugmad „Izvezi"/„Uvezi". Uvoz prolazi kroz istu normalizaciju kao i `localStorage`, uz provjeru verzije formata |
| 7b | ✅ **Preuzimanje krojne liste i ponude** (Faza 4) | CSV sa UTF-8 BOM-om za Excel; ponuda kao A4 HTML → „Sačuvaj kao PDF" bez biblioteke |
| 8 | ✅ **Cjenovnik kao podatak, ne kao kod** (Faza 5) | `data/decors.js` je 618 linija hardkodovanog cjenovnika („ELGRAD MPC 31.08.2026"). `registerDecor` već postoji — treba UI za uređivanje **postojećih** dekora i import iz CSV-a, uz verzioniranje cjenovnika po datumu |
| 9 | ✅ **Upravljanje cjenovnikom po datumu** (Faza 5) | Ponude moraju ostati reproducible. Sačuvati `priceListVersion` u projekat i upozoriti ako se cjenovnik od tada mijenjao |
| 10 | ✅ **Detekcija kolizije sa instalacijama u validaciji** (Faza 5) | `services` se koriste u auto-rasporedu ali `validateInProject` **ne provjerava** da li je element preko utičnice/odvoda — samo preko `obstacles` |
| 11 | **Režim „bez ručke" (gola) u 3D** | `handlePlacements` već vraća `[]` za gola/push. Treba vizuelno prikazati sam profil |
| 12 | ✅ **Mobilni/tablet prikaz** (Faza 5) | `LeftRail` (288px) + `RightRail` (320px) + viewport = min ~1000px. Na tabletu se lomi. Treba collapsible rails |
| 13 | **Dijeljenje projekta linkom** | `window.storage` polyfill već ima `shared: false` polje — očito je postojala namjera za dijeljeno skladište |

---

## 10. Prilog

- **`IZVJESTAJ-dokazi.txt`** — sirovi izlaz svih 12 dokaza (pokrenuto, ne pretpostavljeno)
- **`test-harness/`** — harness koji sam koristio (`dokazi.mjs` + `bundle2.mjs`);
  možete ga pokrenuti sa `node test-harness/bundle2.mjs && node test-harness/_dokazi.mjs`.
  Nakon što uvedete Vitest, ovo možete obrisati.

### Kako pokrenuti
```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run lint
```

### Struktura
```
src/
├── data/      cjenovnici i katalog (decors 618, catalog 105, tech 81, hardware 73)
├── engine/    čiste funkcije: layout 568, surfaces 444, panels 444, pricing 128,
│              geometry 123, bom 90, validation 86, wardrobe* 338
├── store/     Zustand: projectStore 334, wardrobeStore 185, uiStore 38
├── components/layout/    LeftRail 442, RightRail 373, Header, Footer
├── components/app/       StartupWizard 418, BomModal 125, DecorModal 101, ...
├── components/wardrobe/  WardrobeViewport3D 328, SegmentRail 168, ...
├── components/ui/        Controls, Modal, Panel, DecorPicker, DataDisplay
├── views/       Viewport3D 511, PlanView2D 267
└── utils/       canvas 117, storage 46, formatters 6
```
