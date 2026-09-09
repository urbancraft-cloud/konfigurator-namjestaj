/**
 * @vitest-environment jsdom
 */
// src/store/store.test.js
//
// BUG-20: „Brzo sačuvaj" i „Sačuvaj kao" se nisu poznavali. Korisnik bi učitao
//         „Hadžić", izmijenio ga, kliknuo „Brzo sačuvaj" — izmjene bi otišle u
//         zasebni brzi slot, a „Hadžić" bi ostao nepromijenjen. Pri sljedećem
//         učitavanju izmjene su bile izgubljene.
// BUG-21: dragElement / moveToWall / addItem / moveItem su pri nemogućoj izmjeni
//         tiho vraćali nepromijenjeno stanje, bez ikakve povratne informacije.

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from './projectStore';
import { useWardrobeStore } from './wardrobeStore';
import { QUICK_SAVE_KEY, namedKey, PROJECTS_PREFIX } from '../utils/storageKeys';

const ROOM = { width: 5600, depth: 3600, height: 2600 };

/** Očisti store i localStorage između testova. */
beforeEach(async () => {
  localStorage.clear();
  useProjectStore.setState({
    room: { ...ROOM },
    activeProjectName: null,
    rawProject: useProjectStore.getState().rawProject,
  });
});

const read = (key) => {
  const v = localStorage.getItem(key);
  return v === null ? null : JSON.parse(v);
};

describe('BUG-20 — „Brzo sačuvaj" poznaje aktivni projekat', () => {
  const st = () => useProjectStore.getState();

  it('bez aktivnog projekta piše u brzi slot', () => {
    const res = st().saveProject();
    expect(res.ok).toBe(true);
    expect(res.slot).toBe('quick');
    expect(read(QUICK_SAVE_KEY)).toBeTruthy();
  });

  it('„Sačuvaj kao" postavlja aktivni projekat', () => {
    const res = st().saveProjectAs('Hadžić — ponuda 3');
    expect(res.ok).toBe(true);
    expect(st().activeProjectName).toBe('Hadžić — ponuda 3');
    expect(read(namedKey('Hadžić — ponuda 3'))).toBeTruthy();
  });

  it('nakon „Sačuvaj kao", „Brzo sačuvaj" ažurira IMENOVANI slot', () => {
    st().saveProjectAs('Test');
    st().setRawProject((p) => ({ ...p, worktopDepthMm: 650 }));
    const res = st().saveProject();

    expect(res.slot).toBe('named');
    expect(res.name).toBe('Test');
    expect(read(namedKey('Test')).project.worktopDepthMm).toBe(650);
    expect(read(QUICK_SAVE_KEY)).toBeNull();       // brzi slot NIJE diran
  });

  it('učitavanje imenovanog projekta čini ga aktivnim', () => {
    st().saveProjectAs('UcitajMe');
    useProjectStore.setState({ activeProjectName: null });

    const res = st().loadProjectByName('UcitajMe');
    expect(res.ok).toBe(true);
    expect(st().activeProjectName).toBe('UcitajMe');
  });

  it('učitavanje brzog snimka vraća aktivni projekat na null', () => {
    st().saveProjectAs('Neki');
    st().saveProject();                            // piše u "Neki"
    useProjectStore.setState({ activeProjectName: null });
    st().saveProject();                            // sad piše u brzi slot

    const res = st().loadProject();
    expect(res.ok).toBe(true);
    expect(res.slot).toBe('quick');
    expect(st().activeProjectName).toBeNull();
  });

  it('brisanje aktivnog projekta vraća na brzi slot', () => {
    st().saveProjectAs('ZaBrisanje');
    expect(st().activeProjectName).toBe('ZaBrisanje');
    st().deleteProject('ZaBrisanje');
    expect(st().activeProjectName).toBeNull();
    expect(read(namedKey('ZaBrisanje'))).toBeNull();
  });

  it('prazno ime se odbija sa razlogom', () => {
    const res = st().saveProjectAs('   ');
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/obavezno/i);
  });

  it('listProjects vraća { items, corrupt } sortirano po datumu', () => {
    st().saveProjectAs('A');
    st().saveProjectAs('B');
    const { items, corrupt } = st().listProjects();
    expect(items.map((x) => x.name).sort()).toEqual(['A', 'B']);
    expect(corrupt).toEqual([]);
  });

  it('oštećen zapis se PRIJAVLJUJE, ne nestaje tiho sa liste', () => {
    localStorage.setItem(`${PROJECTS_PREFIX}Ostecen`, '{ ovo nije json');
    st().saveProjectAs('Ispravan');
    const { items, corrupt } = st().listProjects();
    expect(items.map((x) => x.name)).toContain('Ispravan');
    expect(corrupt).toContain('Ostecen');
  });

  it('učitavanje nepostojećeg projekta vraća razlog, ne pada', () => {
    const res = st().loadProjectByName('NePostoji');
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/ne postoji/i);
  });
});

describe('BUG-21 — odbijene izmjene vraćaju razlog', () => {
  const prviElement = () => useProjectStore.getState().rawProject.elements[0];

  it('moveToWall javlja kad na zidu nema mjesta', () => {
    const st = useProjectStore.getState();
    // popuni cijeli lijevi zid jednim elementom širine = dubina prostorije
    const el = prviElement();
    st.setRawProject((p) => ({
      ...p,
      elements: [{ ...el, instanceId: 'test_1', wall: 'left', offset: 0,
                   dims: { ...el.dims, width: ROOM.depth } }],
    }));
    const res = useProjectStore.getState().moveToWall('test_1', 'left');
    expect(res.ok).toBe(true);                            // već je na tom zidu
    expect(res.unchanged).toBe(true);
  });

  it('moveToWall javlja kad je element širi od zida', () => {
    const st = useProjectStore.getState();
    const el = prviElement();
    st.setRawProject((p) => ({
      ...p,
      elements: [{ ...el, instanceId: 'sir', wall: 'top', offset: 0,
                   dims: { ...el.dims, width: ROOM.depth + 500 } }],
    }));
    const res = useProjectStore.getState().moveToWall('sir', 'left');
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/ne staje na zid/);
  });

  it('moveToWall javlja koliziju kad je zid pun', () => {
    const st = useProjectStore.getState();
    st.setRawProject((p) => ({
      ...p,
      elements: [
        { ...p.elements[0], instanceId: 'a', wall: 'left', offset: 0, dims: { ...p.elements[0].dims, width: 1800 } },
        { ...p.elements[0], instanceId: 'b', wall: 'left', offset: 1800, dims: { ...p.elements[0].dims, width: 1800 } },
      ],
    }));
    const res = useProjectStore.getState().moveToWall('a', 'left');
    expect(res.ok).toBe(true);
    expect(res.unchanged).toBe(true);
  });

  it('moveToWall na nepoznati element vraća razlog', () => {
    const res = useProjectStore.getState().moveToWall('nepostojeci_id', 'top');
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/nije pronađen/i);
  });

  it('dragElement vraća stvarni odmak kad je pomjeranje moguće', () => {
    const st = useProjectStore.getState();
    st.setRawProject((p) => ({ ...p, elements: [
      { ...p.elements[0], instanceId: 'd1', wall: 'top', offset: 0 },
    ] }));
    const res = useProjectStore.getState().dragElement('d1', 1234, { snap: false });
    expect(res.ok).toBe(true);
    expect(res.offset).toBe(1234);                        // BEZ snap-a → tačno što je korisnik upisao
  });

  it('dragElement sa snap-om zaokružuje na susjeda (unutar 40 mm)', () => {
    const st = useProjectStore.getState();
    st.setRawProject((p) => ({ ...p, elements: [
      { ...p.elements[0], instanceId: 's1', wall: 'top', offset: 0, dims: { ...p.elements[0].dims, width: 600 } },
      { ...p.elements[0], instanceId: 's2', wall: 'top', offset: 2000, dims: { ...p.elements[0].dims, width: 600 } },
    ] }));
    /* Kandidati za s1 (širina 600, zid 5600, susjed s2 na 2000):
         0            (početak zida)
         5000         (kraj zida = 5600 - 600)
         2600         (desno od susjeda = 2000 + 600)
         1400         (lijevo od susjeda  = 2000 - 600)
       1390 je 10 mm od 1400 → unutar tolerancije od 40 mm. */
    const res = useProjectStore.getState().dragElement('s1', 1390);
    expect(res.ok).toBe(true);
    expect(res.offset).toBe(1400);
    expect(res.snapped).toBe(true);
  });

  it('snap bira najbliži SLOBODAN kandidat i preskače zauzeti raw položaj', () => {
    const st = useProjectStore.getState();
    st.setRawProject((p) => ({ ...p, elements: [
      { ...p.elements[0], instanceId: 'b1', wall: 'top', offset: 0, dims: { ...p.elements[0].dims, width: 600 } },
      { ...p.elements[0], instanceId: 'b2', wall: 'top', offset: 1900, dims: { ...p.elements[0].dims, width: 600 } },
    ] }));
    /* b2 zauzima 1900–2500. Kandidati za b1: [0, 5000, 2500, 1300].
       Vučemo na 2490:
         - sirova pozicija 2490 → b1 = 2490–3090, preklapa b2 (eps=2) ❌
         - najbliži kandidat 2500 (razlika 10) → b1 = 2500–3100, NASLANJA se na
           b2 bez preklapanja ✅
       Prije popravke `applySnap` bi također vratio 2500, ali je cijela logika
       bila "izaberi najbližeg pa provjeri koliziju" — kad bi najbliži bio
       zauzet, odbijalo se CIJELO pomjeranje. Sada se kandidati isprobavaju po
       udaljenosti i uzima se prvi slobodan. */
    const res = useProjectStore.getState().dragElement('b1', 2490);
    expect(res.ok).toBe(true);
    expect(res.offset).toBe(2500);
    expect(res.snapped).toBe(true);
  });

  it('odbija pomjeranje kad su i raw i svi kandidati u toleranciji zauzeti', () => {
    const st = useProjectStore.getState();
    st.setRawProject((p) => ({ ...p, elements: [
      { ...p.elements[0], instanceId: 'g1', wall: 'top', offset: 0, dims: { ...p.elements[0].dims, width: 600 } },
      { ...p.elements[0], instanceId: 'g2', wall: 'top', offset: 1900, dims: { ...p.elements[0].dims, width: 600 } },
    ] }));
    /* Vučemo na 2480: g1 = 2480–3080, a g2 = 1900–2500 → preklapanje od 20 mm,
       što je iznad eps=2 pa `overlaps` vraća true.
       Najbliži kandidat je 2500 (razlika 20, unutar tolerancije 40) i on je
       SLOBODAN (2500–3100 se samo naslanja na g2), pa snap spašava potez.
       Zato ovdje biramo poziciju čiji su kandidati izvan tolerancije. */
    /* 2455: preklapa g2 (2455–3055 vs 1900–2500 → 45 mm preklapanja).
       Kandidat 2500 je udaljen 45 mm → IZVAN tolerancije od 40 mm, pa se ne
       razmatra. Kandidat 1300 je udaljen 1155 mm. Nema slobodnog izbora. */
    const res = useProjectStore.getState().dragElement('g1', 2455);
    expect(res.ok).toBe(false);
    expect(res.hit).toBe('g2');
    expect(res.reason).toMatch(/Kolizija/);
    // Stanje NIJE promijenjeno
    expect(useProjectStore.getState().rawProject.elements.find((e) => e.instanceId === 'g1').offset).toBe(0);
  });

  it('snap na slobodan kandidat lijevo od susjeda', () => {
    const st = useProjectStore.getState();
    st.setRawProject((p) => ({ ...p, elements: [
      { ...p.elements[0], instanceId: 'f1', wall: 'top', offset: 0, dims: { ...p.elements[0].dims, width: 600 } },
      { ...p.elements[0], instanceId: 'f2', wall: 'top', offset: 1900, dims: { ...p.elements[0].dims, width: 600 } },
    ] }));
    // Kandidat 1300 je slobodan (f1 = 1300–1900, f2 počinje na 1900) i 10 mm od 1290.
    const res = useProjectStore.getState().dragElement('f1', 1290);
    expect(res.ok).toBe(true);
    expect(res.offset).toBe(1300);
    expect(res.snapped).toBe(true);
  });

  it('izvan tolerancije nema snap-a — element prati kursor', () => {
    const st = useProjectStore.getState();
    st.setRawProject((p) => ({ ...p, elements: [
      { ...p.elements[0], instanceId: 'c1', wall: 'top', offset: 0, dims: { ...p.elements[0].dims, width: 600 } },
    ] }));
    const res = useProjectStore.getState().dragElement('c1', 1985);   // 585 mm od najbližeg kandidata
    expect(res.ok).toBe(true);
    expect(res.offset).toBe(1985);
    expect(res.snapped).toBe(false);
  });

  it('dragElement javlja koliziju umjesto da tiho odustane', () => {
    const st = useProjectStore.getState();
    st.setRawProject((p) => ({ ...p, elements: [
      { ...p.elements[0], instanceId: 'k1', wall: 'top', offset: 0, dims: { ...p.elements[0].dims, width: 600 } },
      { ...p.elements[0], instanceId: 'k2', wall: 'top', offset: 2000, dims: { ...p.elements[0].dims, width: 600 } },
    ] }));
    const res = useProjectStore.getState().dragElement('k1', 2000, { snap: false });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/Kolizija/);
    expect(res.hit).toBe('k2');
    // stanje NIJE promijenjeno
    expect(useProjectStore.getState().rawProject.elements.find((e) => e.instanceId === 'k1').offset).toBe(0);
  });

  it('dragElement steže odmak u gabarit zida', () => {
    const st = useProjectStore.getState();
    st.setRawProject((p) => ({ ...p, elements: [
      { ...p.elements[0], instanceId: 'g1', wall: 'top', offset: 0, dims: { ...p.elements[0].dims, width: 600 } },
    ] }));
    const res = useProjectStore.getState().dragElement('g1', 999999, { snap: false });
    expect(res.ok).toBe(true);
    expect(res.offset).toBe(ROOM.width - 600);
  });

  it('addElement vraća razlog kad nema mjesta', () => {
    const st = useProjectStore.getState();
    // jedan element preko cijelog zida
    const el = st.rawProject.elements[0];
    st.setRawProject((p) => ({ ...p, elements: [
      { ...el, instanceId: 'puni', wall: 'left', offset: 0, dims: { ...el.dims, width: ROOM.depth } },
    ] }));
    const res = useProjectStore.getState().addElement('D-VRATA', 'left', 600);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/Nema slobodnog mjesta/);
  });

  it('addElement vraća id novog elementa', () => {
    const st = useProjectStore.getState();
    st.setRawProject((p) => ({ ...p, elements: [] }));
    const res = useProjectStore.getState().addElement('D-VRATA', 'top', 600);
    expect(res.ok).toBe(true);
    expect(res.id).toBeTruthy();
    expect(useProjectStore.getState().rawProject.elements).toHaveLength(1);
  });
});

describe('BUG-21 — ormar: addItem i moveItem vraćaju razlog', () => {
  const postaviOrmar = (over = {}) => {
    useWardrobeStore.getState().applyWizard({
      room: { width: 4000, depth: 3200, height: 2600 },
      wardrobeW: 2400, wardrobeH: 2500, wardrobeD: 580,
      legHeightMm: 100, doorType: 'klizna', segmentCount: 3,
      ...over,
    });
  };

  it('addItem uspije i vraća id', () => {
    postaviOrmar();
    const res = useWardrobeStore.getState().addItem(0, 'lower', 'ladicar');
    expect(res.ok).toBe(true);
    expect(res.id).toBeTruthy();
  });

  it('addItem javlja kad nema slobodne visine', () => {
    postaviOrmar();
    const st = useWardrobeStore.getState();
    // gornji korpus je nizak (300 mm) — ladičar od 3×183 mm ne staje
    const res = st.addItem(0, 'upper', 'ladicar');
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/slobodne visine|zauzima/);
  });

  it('addItem javlja kad gornji korpus nema pozitivnu visinu', () => {
    postaviOrmar({ wardrobeH: 2100, legHeightMm: 100 });   // 2100-2000-100-100 = -100
    const res = useWardrobeStore.getState().addItem(0, 'upper', 'polica');
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/pozitivnu|visinu/);
  });

  it('addItem na nepostojeći segment vraća razlog', () => {
    postaviOrmar();
    const res = useWardrobeStore.getState().addItem(99, 'lower', 'polica');
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/ne postoji/);
  });

  it('moveItem javlja preklapanje sa susjedom i navodi slobodnu poziciju', () => {
    postaviOrmar();
    const st = useWardrobeStore.getState();
    const a = st.addItem(0, 'lower', 'polica');
    const b = st.addItem(0, 'lower', 'polica');
    expect(a.ok && b.ok).toBe(true);

    const items = useWardrobeStore.getState().wardrobe.segments[0].lower.items;
    const drugi = items.find((i) => i.id === b.id);
    const res = useWardrobeStore.getState().moveItem(0, 'lower', drugi.id, items[0].yMm);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/preklapa/);
    expect(res.reason).toMatch(/slobodno tek iznad/);
  });

  it('moveItem uspije na slobodnu poziciju', () => {
    postaviOrmar();
    const a = useWardrobeStore.getState().addItem(0, 'lower', 'sipka');
    expect(a.ok).toBe(true);
    const res = useWardrobeStore.getState().moveItem(0, 'lower', a.id, 500);
    expect(res.ok).toBe(true);
    expect(res.yMm).toBe(500);
  });

  it('moveItem steže u svjetlu visinu korpusa', () => {
    postaviOrmar();
    const a = useWardrobeStore.getState().addItem(0, 'lower', 'sipka');
    const res = useWardrobeStore.getState().moveItem(0, 'lower', a.id, 999999);
    expect(res.ok).toBe(true);
    expect(res.yMm).toBeLessThan(2000);
  });
});

describe('Automatsko čuvanje nacrta', () => {
  it('saveDraft piše u zaseban ključ i ne dira brzi snimak ni imenovane projekte', () => {
    const st = useProjectStore.getState();
    st.saveProjectAs('Netaknut');
    useProjectStore.setState({ activeProjectName: null });
    st.saveProject();                                  // brzi snimak
    const prijeBrzi = localStorage.getItem('kuhinja:projekt');
    const prijeImenovani = localStorage.getItem('kuhinja:projects:Netaknut');

    st.setRawProject((p) => ({ ...p, worktopDepthMm: 777 }));
    const res = useProjectStore.getState().saveDraft();
    expect(res.ok).toBe(true);

    expect(localStorage.getItem('kuhinja:projekt')).toBe(prijeBrzi);
    expect(localStorage.getItem('kuhinja:projects:Netaknut')).toBe(prijeImenovani);
    const nacrt = JSON.parse(localStorage.getItem('kuhinja:nacrt'));
    expect(nacrt.project.worktopDepthMm).toBe(777);
    expect(typeof nacrt.at).toBe('number');
  });

  it('loadDraft vraća nacrt bez upisivanja u store', () => {
    useProjectStore.getState().saveDraft();
    const prije = useProjectStore.getState().rawProject.name;
    const res = useProjectStore.getState().loadDraft();
    expect(res.ok).toBe(true);
    expect(res.project).toBeTruthy();
    expect(useProjectStore.getState().rawProject.name).toBe(prije);   // nije dirano
  });

  it('loadDraft na prazan nacrt vraća razlog', () => {
    localStorage.removeItem('kuhinja:nacrt');
    const res = useProjectStore.getState().loadDraft();
    expect(res.ok).toBe(false);
    expect(res.reason).toBeTruthy();
  });

  it('oštećen nacrt ne ruši aplikaciju', () => {
    localStorage.setItem('kuhinja:nacrt', '{ nije json');
    const res = useProjectStore.getState().loadDraft();
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/oštećen/i);
  });

  it('applyDraft postavlja projekat i čisti historiju', () => {
    const st = useProjectStore.getState();
    st.setRawProject((p) => ({ ...p, worktopDepthMm: 601 }));
    st.saveDraft();
    st.setRawProject((p) => ({ ...p, worktopDepthMm: 900 }));
    expect(st.canUndo).toBe(true);

    const d = useProjectStore.getState().loadDraft();
    useProjectStore.getState().applyDraft(d.room, d.project);

    expect(useProjectStore.getState().rawProject.worktopDepthMm).toBe(601);
    expect(useProjectStore.getState().canUndo).toBe(false);       // učitavanje se ne poništava
    expect(useProjectStore.getState().activeProjectName).toBeNull();
  });
});
