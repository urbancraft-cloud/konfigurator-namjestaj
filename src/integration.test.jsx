/**
 * @vitest-environment jsdom
 */
// src/integration.test.jsx
//
// INTEGRACIJSKI TEST — pokreće STVARNU aplikaciju (App + ErrorBoundary + store +
// LeftRail + DecorPicker) u jsdom-u i simulira klikove.
//
// Ovo je test koji dokazuje da je BUG-01 zaista popravljen: klik na
// „Sve fronte donjih elemenata" u lijevom panelu ranije je bacao
// `ReferenceError: thicknessesOf is not defined` iz Zustand akcije, a pošto
// ErrorBoundary nije postojao — cijela aplikacija je postajala bijeli ekran.
//
// WebGL (Three.js) ne radi u jsdom-u, pa je 3D viewport zamijenjen mock-om;
// sve ostalo je stvarni kod.

import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, within, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import './utils/storage.js';                    // window.storage polyfill
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { useUiStore } from './store/uiStore.js';
import { useProjectStore } from './store/projectStore.js';
import { importProjectFromJSON } from './utils/exportImport.js';

vi.mock('./views/Viewport3D.jsx', () => ({
  Viewport3D: () => <div data-testid="viewport3d-mock" />,
}));

const BOUNDARY_TEXT = /neočekivanu grešku/i;

/**
 * Dugme po TAČNOM tekstu. `getByRole(name)` ovdje nije pouzdan jer naši `<Btn>`
 * sadrže lucide SVG ikonu, pa pristupačno ime uključuje razmake oko teksta
 * (npr. "  Završi"), a regex sa ^/$ ne prolazi.
 */
function btn(tacno) {
  const found = screen
    .queryAllByRole('button')
    .filter((b) => (b.textContent || '').replace(/\s+/g, ' ').trim() === tacno);
  if (!found.length) {
    const sve = screen.queryAllByRole('button')
      .map((b) => JSON.stringify((b.textContent || '').replace(/\s+/g, ' ').trim()))
      .filter((t) => t !== '""');
    throw new Error(`Nema dugmeta "${tacno}". Dostupna: ${sve.slice(0, 30).join(', ')}`);
  }
  return found[0];
}

/** Klik na dugme po tačnom tekstu. */
async function klikni(user, tacno) {
  const el = btn(tacno);
  await user.click(el);
  return el;
}

/**
 * Dugme DecorPicker-a po njegovom naslovu.
 *
 * `DecorPicker` renderuje naslov kao `<div>` IZNAD `<button>`-a (nisu povezani
 * preko htmlFor/id), pa pristupačno ime dugmeta NE sadrži naslov —
 * `getByRole('button', { name: /Sve fronte.../ })` zato ne radi.
 */
function decorPicker(naslov) {
  const divovi = screen.queryAllByText(naslov, { exact: false });
  for (const d of divovi) {
    const b = d.nextElementSibling;
    if (b && b.tagName === 'BUTTON') return b;
  }
  throw new Error(`DecorPicker "${naslov}" nije pronađen (nađeno ${divovi.length} naslova).`);
}

/** Otvori DecorPicker i izaberi n-ti dekor iz liste. */
async function izaberiDekor(user, naslov, indeks = 2) {
  const okidac = decorPicker(naslov);
  await user.click(okidac);
  const opcije = okidac.parentElement.querySelectorAll('div.max-h-56 button');
  if (opcije.length <= indeks) {
    throw new Error(`Lista dekora ima samo ${opcije.length} stavki, tražen indeks ${indeks}.`);
  }
  await user.click(opcije[indeks]);
  return opcije.length;
}

/**
 * Čeka da se pojavi dugme sa TAČNIM tekstom (polling).
 *
 * `getByRole({ name })` je ovdje nepouzdan: naši `<Btn>` sadrže lucide SVG ikonu,
 * a nazivi koriste bosanske navodnike („…"), pa dom-accessibility-api izračuna
 * ime sa razmacima/kodnim tačkama koje se ne poklapaju sa očekivanjem.
 */
async function nadjiDugme(tacno, timeoutMs = 8000) {
  const kraj = Date.now() + timeoutMs;
  let zadnje = [];
  while (Date.now() < kraj) {
    const found = screen.queryAllByRole('button')
      .find((b) => (b.textContent || '').replace(/\s+/g, ' ').trim() === tacno);
    if (found) return found;
    zadnje = screen.queryAllByRole('button')
      .map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t && t.length < 40);
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
  }
  throw new Error(`Nije se pojavilo dugme "${tacno}". Dostupna: ${JSON.stringify(zadnje.slice(0, 25))}`);
}

/**
 * Zatvori startup wizard i ostavi aplikaciju u radnom stanju.
 *
 * Na prvom koraku dugme se zove „Završi, preskoči ostalo" (i pita za potvrdu jer
 * preskače preostalih 5 koraka), a tek na zadnjem koraku „Završi". Zato
 * `window.confirm` mock-ujemo na `true` i kliknemo prvo dostupno.
 */
async function zavrsiWizard(user) {
  const potvrda = vi.spyOn(window, 'confirm').mockReturnValue(true);
  try {
    const zadnji = screen.queryAllByRole('button')
      .find((b) => (b.textContent || '').replace(/\s+/g, ' ').trim() === 'Završi');
    if (zadnji) { await user.click(zadnji); return; }
    await klikni(user, 'Završi, preskoči ostalo');
  } finally {
    potvrda.mockRestore();
  }
}

function renderApp() {
  return render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

beforeEach(() => {
  // Vrati aplikaciju u poznato početno stanje između testova.
  act(() => {
    useUiStore.setState({
      view: '2d', tool: 'select', wizard: true, appMode: 'kuhinja',
      selectedId: null, modal: null, toast: null, walk: false, measure: false,
      measured: null, tab: 'katalog', pendingAdd: null,
    });
  });
  localStorage.clear();
  /* VAŽNO: i projectStore se mora vratiti na početno stanje, inače
     `activeProjectName` (i sačuvani projekti) cure iz prethodnog testa —
     zaglavlje tada prikazuje „Sačuvaj „X"" umjesto „Brzo sačuvaj". */
  useProjectStore.setState({ activeProjectName: null, room: { width: 5600, depth: 3600, height: 2600 } });
});

afterEach(() => cleanup());

describe('aplikacija se pokreće', () => {
  it('renderuje se bez pada i bez aktiviranog ErrorBoundary-ja', () => {
    renderApp();
    expect(screen.queryByText(BOUNDARY_TEXT)).toBeNull();
    expect(screen.getByText(/Tip prostorije/)).toBeTruthy();
  });

  it('nakon završetka wizarda prikazuje ukupnu cijenu koja nije NaN', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);

    /* Zaglavlje sada uz „Ukupno sa PDV-om" nosi i oznaku načina obračuna
       („· materijal po pločama"), pa se traži regex-om a ne tačnim tekstom. */
    const label = await screen.findByText(/Ukupno sa PDV-om/);
    const vrijednost = label.parentElement.textContent;
    expect(vrijednost).toMatch(/KM/);
    expect(vrijednost).not.toMatch(/NaN/);
    expect(vrijednost).toMatch(/materijal po (pločama|neto površini)/);
    expect(screen.queryByText(BOUNDARY_TEXT)).toBeNull();
  });
});

describe('BUG-01 — promjena dekora svih fronti (ranije: bijeli ekran)', () => {
  it('klik na „Sve fronte donjih elemenata" ne ruši aplikaciju', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);

    // Otvori DecorPicker za donje fronte i izaberi dekor iz liste
    const n = await izaberiDekor(user, 'Sve fronte donjih elemenata', 2);
    expect(n).toBeGreaterThan(5);

    // Aplikacija mora i dalje stajati
    expect(screen.queryByText(BOUNDARY_TEXT)).toBeNull();
    expect(screen.getByText(/Ukupno sa PDV-om/)).toBeTruthy();
    // I potvrda mora doći
    expect(await screen.findByText(/Dekor fronti donjih primijenjen/)).toBeTruthy();
  });

  it('dekor je stvarno upisan u projekat', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);

    await izaberiDekor(user, 'Sve fronte donjih elemenata', 3);

    const p = useProjectStore.getState().rawProject;
    expect(p.frontDecorBase).toBeTruthy();
    const donjih = p.elements.filter((e) => e.type !== 'wall');
    expect(donjih.length).toBeGreaterThan(0);
    expect(donjih.every((e) => e.front.decorId === p.frontDecorBase)).toBe(true);
  });

  it('klik na „Sve fronte visećih elemenata" također prolazi', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);

    await izaberiDekor(user, 'Sve fronte visećih elemenata', 1);

    expect(screen.queryByText(BOUNDARY_TEXT)).toBeNull();
    expect(await screen.findByText(/Dekor fronti visećih primijenjen/)).toBeTruthy();
  });
});

describe('BUG-18 — wizard se ne zaglavljuje pri promjeni tipa prostorije', () => {
  it('biranje „Spavaća soba" na zadnjem koraku vraća na korak 1', async () => {
    const user = userEvent.setup();
    renderApp();

    // Idi do zadnjeg koraka kuhinje (6 koraka: tip, oblik, zidovi, otvori, voda, struja)
    for (let i = 0; i < 5; i++) {
      if (screen.queryAllByRole('button').some((b) => b.textContent.trim() === 'Dalje')) await klikni(user, 'Dalje');
    }
    expect(screen.getByText(/Korak 6 od 6/)).toBeTruthy();

    // Nazad na prvi korak
    for (let i = 0; i < 5; i++) {
      if (screen.queryAllByRole('button').some((b) => b.textContent.trim() === 'Nazad')) await klikni(user, 'Nazad');
    }
    expect(screen.getByText(/Korak 1 od 6/)).toBeTruthy();

    // Promijeni tip prostorije — prija bi `step` ostao 5 uz `ids.length = 4`
    await user.click(screen.getByRole('button', { name: /Spavaća soba/i }));

    const korak = screen.getByText(/Korak \d+ od \d+/).textContent;
    const m = /Korak (\d+) od (\d+)/.exec(korak);
    expect(m).toBeTruthy();
    expect(Number(m[1])).toBeLessThanOrEqual(Number(m[2]));
    expect(korak).toMatch(/Korak 1 od 4/);
    // Sadržaj koraka mora postojati (ranije: prazan dijalog)
    expect(screen.getByText(/Dimenzije ormara|Vrata i segmenti|Prostorija/)).toBeTruthy();
  });
});

describe('BUG-06 — numerička polja ne šalju 0/NaN u store', () => {
  it('brisanje sadržaja polja „Dužina" ne postavlja širinu prostorije na 0', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);

    const prije = useProjectStore.getState().room.width;
    const input = screen.getByLabelText('Dužina');
    await user.clear(input);
    await user.type(input, 'abc');

    const poslije = useProjectStore.getState().room.width;
    expect(poslije).toBe(prije);
    expect(Number.isFinite(poslije)).toBe(true);
    expect(poslije).toBeGreaterThan(0);
  });

  it('upisana vrijednost se steže u granice', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);

    const input = screen.getByLabelText('Dužina');
    await user.clear(input);
    await user.type(input, '99999999');
    await user.tab();                                  // blur → commit

    const w = useProjectStore.getState().room.width;
    expect(w).toBeLessThanOrEqual(9000);
    expect(w).toBeGreaterThan(0);
  });
});

describe('ErrorBoundary hvata pad i nudi oporavak', () => {
  function Bomba() {
    throw new TypeError("Cannot read properties of undefined (reading 'name')");
  }

  it('prikazuje poruku umjesto bijelog ekrana', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomba />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/neočekivanu grešku/i)).toBeTruthy();
    expect(screen.getByText(/Cannot read properties of undefined/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pokušaj ponovo/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Kopiraj grešku/i })).toBeTruthy();
    spy.mockRestore();
  });
});

describe('BUG-03/05 — stari sačuvani projekat se učitava bez pada', () => {
  it('učitavanje projekta sa izbačenim tipom i dekorom ne ruši aplikaciju', async () => {
    localStorage.setItem('kuhinja:projects:StariProjekat', JSON.stringify({
      name: 'StariProjekat',
      savedAt: new Date().toISOString(),
      room: { width: 4000, depth: 3000, height: 2500 },
      project: {
        name: 'StariProjekat',
        legHeightMm: 'nan',
        worktopDecorId: 'DEKOR_KOJI_VISE_NE_POSTOJI',
        elements: [
          { instanceId: 'el_1', templateId: 'D-TIP-IZ-2019', wall: 'top', offset: 0,
            dims: { width: 600, height: 720, depth: 550 },
            corpus: { decorId: 'W1000', thicknessMm: 18 },
            front: { decorId: 'W1000', thicknessMm: 18 }, back: { thicknessMm: 3 } },
        ],
      },
    }));

    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    await user.click(await screen.findByRole('button', { name: /Učitaj projekat/i }));

    expect(await screen.findByText('StariProjekat')).toBeTruthy();
    await user.click(screen.getAllByText('StariProjekat')[0]);

    // Aplikacija radi, a napomena o ispravkama je prikazana
    expect(screen.queryByText(BOUNDARY_TEXT)).toBeNull();
    expect(await screen.findByText(/učitan uz/i)).toBeTruthy();
    const w = useProjectStore.getState().room.width;
    expect(w).toBe(4000);
  });
});

describe('BUG-23 — Modal: Esc, klik van dijaloga, zaključavanje skrola', () => {
  async function otvoriModniDijalog(user, nazivDugmeta) {
    renderApp();
    await zavrsiWizard(user);
    await user.click(screen.getByRole('button', { name: new RegExp(nazivDugmeta) }));
  }

  it('Esc zatvara dijalog', async () => {
    const user = userEvent.setup();
    await otvoriModniDijalog(user, 'Krojna lista');
    expect(screen.getByText(/Krojna lista i specifikacija/)).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');      // skrol pozadine zaključan

    await user.keyboard('{Escape}');
    expect(screen.queryByText(/Krojna lista i specifikacija/)).toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');   // otključan nakon zatvaranja
  });

  it('klik van dijaloga (na pozadinu) zatvara ga', async () => {
    const user = userEvent.setup();
    await otvoriModniDijalog(user, 'Ponuda');
    expect(screen.getByText(/Ponuda za kupca/)).toBeTruthy();

    const backdrop = screen.getByRole('dialog').parentElement;
    await user.click(backdrop, { position: { x: 3, y: 3 } });   // gornji lijevi ugao = pozadina
    expect(screen.queryByText(/Ponuda za kupca/)).toBeNull();
  });

  it('klik UNUTAR dijaloga ga NE zatvara', async () => {
    const user = userEvent.setup();
    await otvoriModniDijalog(user, 'Ponuda');
    const dialog = screen.getByRole('dialog');
    await user.click(dialog.querySelector('table') || dialog);
    expect(screen.getByText(/Ponuda za kupca/)).toBeTruthy();
  });

  it('dijalog ima role="dialog" i aria-modal', async () => {
    const user = userEvent.setup();
    await otvoriModniDijalog(user, 'Krojna lista');
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toMatch(/Krojna lista/);
  });

  it('X dugme zatvara dijalog', async () => {
    const user = userEvent.setup();
    await otvoriModniDijalog(user, 'Ponuda');
    await user.click(screen.getByRole('button', { name: 'Zatvori' }));
    expect(screen.queryByText(/Ponuda za kupca/)).toBeNull();
  });
});

describe('BUG-20 — tok čuvanja u UI-u', () => {
  /* Dugmad u zaglavlju („Brzo sačuvaj") i u modalu („Sačuvaj") završavaju istom
     riječju, pa `getByRole({ name: /Sačuvaj$/ })` hvata oba. Zato se upiti
     unutar dijaloga opsežu preko `within(dialog)`, a zaglavlje se traži po
     TAČNOM tekstu preko `nadjiDugme`. */
  const dijalog = () => within(screen.getByRole('dialog'));

  async function sacuvajKao(user, ime) {
    await user.click(await nadjiDugme('Sačuvaj kao...'));
    await screen.findByRole('dialog');
    await user.type(dijalog().getByPlaceholderText(/Hadžić/i), ime);
    await user.click(dijalog().getByRole('button', { name: /^Sačuvaj$/i }));
    // dijalog se zatvori nakon čuvanja
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
  }

  it('„Sačuvaj kao" postavlja aktivni projekat i mijenja natpis dugmeta', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    expect(await nadjiDugme('Brzo sačuvaj')).toBeTruthy();

    await sacuvajKao(user, 'Test projekat A');

    expect(useProjectStore.getState().activeProjectName).toBe('Test projekat A');
    expect(await nadjiDugme('Sačuvaj: Test projekat A')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('kuhinja:projects:Test projekat A')).name)
      .toBe('Test projekat A');
  });

  it('nakon „Sačuvaj kao", klik na „Sačuvaj" ažurira imenovani slot', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    await sacuvajKao(user, 'Projekat B');

    // Izmjena u projektu, pa „Sačuvaj" u zaglavlju
    useProjectStore.getState().setRawProject((p) => ({ ...p, worktopDepthMm: 640 }));
    await user.click(await nadjiDugme('Sačuvaj: Projekat B'));
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });

    const sacuvano = JSON.parse(localStorage.getItem('kuhinja:projects:Projekat B'));
    expect(sacuvano.project.worktopDepthMm).toBe(640);       // ← izmjena je u imenovanom slotu
    expect(localStorage.getItem('kuhinja:projekt')).toBeNull();   // ← brzi slot NIJE diran
  });

  it('„Učitaj projekat" označava aktivni projekat i objašnjava ponašanje', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    await sacuvajKao(user, 'Projekat C');

    await user.click(await nadjiDugme('Učitaj projekat'));
    const d = dijalog();
    expect(await d.findByText('Projekat C')).toBeTruthy();
    expect(d.getAllByText('aktivan').length).toBeGreaterThan(0);
    expect(d.getByText((_, el) => !!el && /postaje aktivan/i.test(el.textContent || '') && el.tagName === 'P')).toBeTruthy();
  });
});

describe('Undo/redo u UI-u', () => {
  it('dugmad postoje, imaju aria-label i title, i prate stanje historije', async () => {
    const user = userEvent.setup();
    useProjectStore.getState().clearHistory();
    renderApp();

    // Prije nego što išta izmijenimo: oba dugmeta su onemogućena
    let poništi = screen.getByRole('button', { name: 'Poništi' });
    let vrati = screen.getByRole('button', { name: 'Vrati' });
    expect(poništi.disabled).toBe(true);
    expect(vrati.disabled).toBe(true);
    expect(poništi.getAttribute('title')).toMatch(/Ctrl\+Z/);
    expect(vrati.getAttribute('title')).toMatch(/Ctrl\+Y/);

    // Završetak wizarda JE izmjena koju korisnik može poništiti
    await zavrsiWizard(user);
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(useProjectStore.getState().canUndo).toBe(true);

    poništi = screen.getByRole('button', { name: 'Poništi' });
    expect(poništi.disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Vrati' }).disabled).toBe(true);
  });

  it('nakon izmjene dugme „Poništi" postaje aktivno i vraća stanje', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);

    const prije = useProjectStore.getState().rawProject.elements.length;
    useProjectStore.getState().setRawProject((p) => ({ ...p, elements: [] }));
    expect(useProjectStore.getState().rawProject.elements).toHaveLength(0);

    const undoBtn = (await screen.findByRole('button', { name: 'Poništi' }));
    // React mora re-renderovati da `disabled` odražava novo stanje
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(undoBtn.disabled).toBe(false);

    await user.click(undoBtn);
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(useProjectStore.getState().rawProject.elements.length).toBe(prije);

    const redoBtn = screen.getByRole('button', { name: 'Vrati' });
    expect(redoBtn.disabled).toBe(false);
    await user.click(redoBtn);
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(useProjectStore.getState().rawProject.elements).toHaveLength(0);
  });

  it('Ctrl+Z poništava izmjenu', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);

    const prije = useProjectStore.getState().rawProject.elements.length;
    useProjectStore.getState().setRawProject((p) => ({ ...p, elements: [] }));
    await user.keyboard('{Control>}z{/Control}');
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(useProjectStore.getState().rawProject.elements.length).toBe(prije);
  });

  it('Ctrl+Z NE radi dok je modal otvoren', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);

    const prije = useProjectStore.getState().rawProject.elements.length;
    useProjectStore.getState().setRawProject((p) => ({ ...p, elements: [] }));
    await user.click(await nadjiDugme('Učitaj projekat'));
    await screen.findByRole('dialog');

    await user.keyboard('{Control>}z{/Control}');
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(useProjectStore.getState().rawProject.elements).toHaveLength(0);   // nije poništeno
    expect(prije).toBeGreaterThan(0);
  });
});

describe('Izvoz i uvoz projekta u UI-u', () => {
  it('zaglavlje ima dugmad „Izvezi" i „Uvezi"', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    expect(await nadjiDugme('Izvezi')).toBeTruthy();
    expect(await nadjiDugme('Uvezi')).toBeTruthy();
  });

  it('„Izvezi" preuzima JSON datoteku sa ispravnim sadržajem', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);

    let preuzeto = null;
    const origCreate = globalThis.Blob;
    globalThis.Blob = class extends origCreate {
      constructor(parts, opts) { super(parts, opts); preuzeto = { text: parts.join(''), type: opts && opts.type }; }
    };
    if (!URL.createObjectURL) { URL.createObjectURL = () => 'blob:mock'; URL.revokeObjectURL = () => {}; }
    const origClick = HTMLAnchorElement.prototype.click;
    let ime = null;
    HTMLAnchorElement.prototype.click = function () { ime = this.download; };

    try {
      await user.click(await nadjiDugme('Izvezi'));
    } finally {
      globalThis.Blob = origCreate;
      HTMLAnchorElement.prototype.click = origClick;
    }

    expect(ime).toMatch(/\.json$/);
    expect(preuzeto).toBeTruthy();
    const data = JSON.parse(preuzeto.text);
    expect(data.format).toBeTruthy();
    expect(data.room.width).toBeGreaterThan(1000);
    expect(Array.isArray(data.project.elements)).toBe(true);

    // i da se taj fajl može vratiti nazad
    const vrati = importProjectFromJSON(preuzeto.text);
    expect(vrati.ok).toBe(true);
    expect(vrati.project.elements.length).toBe(data.project.elements.length);
  });

  it('Krojna lista ima dugme „Preuzmi CSV"', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    await user.click(await nadjiDugme('Krojna lista'));
    const d = within(screen.getByRole('dialog'));
    expect(await d.findByText(/Preuzmi CSV/)).toBeTruthy();
    expect(d.getByText(/Kopiraj CSV|Kopirano/)).toBeTruthy();
  });
});

describe('Uski ekran (tablet/telefon)', () => {
  const postaviSirinu = async (px) => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: px });
    window.dispatchEvent(new Event('resize'));
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
  };

  it('na širokom ekranu oba panela su u toku rasporeda', async () => {
    const user = userEvent.setup();
    renderApp();
    await postaviSirinu(1600);
    await zavrsiWizard(user);
    const paneli = screen.queryAllByLabelText(/Postavke prostorije|Elementi u projektu/);
    expect(paneli).toHaveLength(2);
    paneli.forEach((p) => expect(p.className).toContain('shrink-0'));
  });

  it('na uskom ekranu paneli su skriveni dok se ne otvore', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    await postaviSirinu(800);
    expect(screen.queryAllByLabelText(/Postavke prostorije/)).toHaveLength(0);
    expect(screen.queryAllByLabelText(/Elementi u projektu/)).toHaveLength(0);
  });

  it('dugme „Paneli" otvara ladicu, a zamračenje je zatvara', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    await postaviSirinu(800);

    await user.click(screen.getByRole('button', { name: 'Bočni paneli' }));
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(screen.queryAllByLabelText(/Postavke prostorije/)).toHaveLength(1);

    const ladica = screen.getByLabelText(/Postavke prostorije/);
    expect(ladica.className).toContain('fixed');        // izvlačeća ladica, ne stupac

    // „Zatvori panel" unutar ladice
    await user.click(within(ladica).getByRole('button', { name: 'Zatvori panel' }));
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(screen.queryAllByLabelText(/Postavke prostorije/)).toHaveLength(0);
  });

  it('na širokom ekranu nema dugmeta za zatvaranje panela (nije ladica)', async () => {
    const user = userEvent.setup();
    renderApp();
    await postaviSirinu(1600);
    await zavrsiWizard(user);
    expect(screen.queryAllByRole('button', { name: 'Zatvori panel' })).toHaveLength(0);
  });
});

describe('DecorPicker — pristupačnost i tastatura', () => {
  it('okidač ima aria-haspopup, aria-expanded i čitljivu labelu', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    const okidac = decorPicker('Sve fronte donjih elemenata');
    expect(okidac.getAttribute('aria-haspopup')).toBe('listbox');
    expect(okidac.getAttribute('aria-expanded')).toBe('false');
    expect(okidac.getAttribute('aria-label')).toMatch(/Sve fronte donjih elemenata/);
  });

  it('otvaranje postavlja listbox sa option elementima i aria-selected', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    const okidac = decorPicker('Sve fronte donjih elemenata');
    await user.click(okidac);
    expect(okidac.getAttribute('aria-expanded')).toBe('true');

    const listbox = within(okidac.parentElement).getByRole('listbox');
    expect(listbox).toBeTruthy();
    const opcije = within(listbox).queryAllByRole('option');
    expect(opcije.length).toBeGreaterThan(50);
    expect(opcije.filter((o) => o.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('strelice pomjeraju izbor, Enter bira', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    const okidac = decorPicker('Sve fronte donjih elemenata');
    await user.click(okidac);
    const pretraga = within(okidac.parentElement).getByRole('combobox');
    const prije = useProjectStore.getState().rawProject.frontDecorBase;

    await user.click(pretraga);
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });

    const poslije = useProjectStore.getState().rawProject.frontDecorBase;
    expect(poslije).toBeTruthy();
    expect(poslije).not.toBe(prije);
  });

  it('pretraga sužava listu', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    const okidac = decorPicker('Sve fronte donjih elemenata');
    await user.click(okidac);
    const kontejner = okidac.parentElement;
    const prije = within(kontejner).queryAllByRole('option').length;
    await user.type(within(kontejner).getByRole('combobox'), 'W1000');
    const poslije = within(kontejner).queryAllByRole('option').length;
    expect(poslije).toBeLessThan(prije);
    expect(poslije).toBeGreaterThan(0);
  });
});

describe('Krojna lista — optimizacija krojenja u UI-u', () => {
  it('prikazuje broj ploča, iskorištenje i SVG prikaz po formatu', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    await user.click(await nadjiDugme('Krojna lista'));
    const d = within(screen.getByRole('dialog'));

    expect(await d.findByText(/Optimizacija krojenja/)).toBeTruthy();
    expect(d.getByText(/Iskorištenje/)).toBeTruthy();
    expect(d.getByText(/Ploča ukupno/)).toBeTruthy();
    expect(d.getByRole('button', { name: /Plan \(CSV\)/ })).toBeTruthy();

    const svgovi = d.queryAllByRole('img');
    expect(svgovi.length).toBeGreaterThan(0);
    expect(svgovi[0].getAttribute('aria-label')).toMatch(/Ploča \d+, iskorištenje \d+%/);
  });

  it('napomena o guillotine rezovima i teksturi je prisutna', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    await user.click(await nadjiDugme('Krojna lista'));
    const d = within(screen.getByRole('dialog'));
    expect(d.getByText(/guillotine/i)).toBeTruthy();
    expect(d.getByText(/ne rotiraju/i)).toBeTruthy();
  });
});

describe('Cjenovnik — verzija i uvoz', () => {
  it('zaglavlje dijaloga navodi važeći cjenovnik', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    await user.click(await nadjiDugme('Ubaci dekor'));
    const d = within(screen.getByRole('dialog'));
    expect(await d.findByText(/Važeći cjenovnik: ELGRAD/)).toBeTruthy();
    expect(d.getByText(/dekora u bazi/)).toBeTruthy();
  });

  it('dijalog nudi uvoz CSV cjenovnika i primjer formata', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    await user.click(await nadjiDugme('Ubaci dekor'));
    const d = within(screen.getByRole('dialog'));
    expect(d.getByRole('button', { name: /Uvezi CSV cjenovnik/ })).toBeTruthy();
    expect(d.getByRole('button', { name: /Primjer CSV formata/ })).toBeTruthy();
  });

  it('lista postojećih dekora ima dugme za uređivanje', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    await user.click(await nadjiDugme('Ubaci dekor'));
    const d = within(screen.getByRole('dialog'));
    expect(await d.findByText(/Uredi postojeći dekor/)).toBeTruthy();
    expect(d.queryAllByRole('button', { name: /^Uredi / }).length).toBeGreaterThan(10);
  });

  it('unošenje postojeće šifre se odbija sa jasnom porukom', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    await user.click(await nadjiDugme('Ubaci dekor'));
    const d = within(screen.getByRole('dialog'));
    await user.type(d.getByPlaceholderText(/npr\. U732/), 'W1000');
    await user.click(d.getByRole('button', { name: /Dodaj dekor/ }));
    expect(d.getByText(/već postoji/)).toBeTruthy();
  });
});

describe('Automatsko čuvanje nacrta u UI-u', () => {
  it('nakon izmjene se u podnožju pojavi oznaka da je nacrt sačuvan', async () => {
    const user = userEvent.setup();
    renderApp();
    await zavrsiWizard(user);
    expect(screen.queryByText(/nacrt sačuvan/i)).toBeNull();

    // debounce je 2,5 s — čekamo da istekne
    useProjectStore.getState().setRawProject((p) => ({ ...p, worktopDepthMm: 655 }));
    await act(async () => { await new Promise((r) => setTimeout(r, 3000)); });

    expect(screen.getByText(/nacrt sačuvan/i)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('kuhinja:nacrt')).project.worktopDepthMm).toBe(655);
  }, 15000);
});
