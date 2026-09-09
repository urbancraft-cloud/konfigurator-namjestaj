/**
 * @vitest-environment jsdom
 */
// src/store/undo.test.js
//
// Undo/redo je bio najveći funkcionalni nedostatak: „Očisti prostor" briše SVE
// elemente i instalacije bez potvrde, `Delete` briše element, a promjena dekora
// fronti prepisuje cijeli projekat — i ništa se nije moglo vratiti.

import { describe, it, expect, beforeEach } from 'vitest';
import '../utils/storage.js';
import { useProjectStore } from './projectStore';
import { useWardrobeStore } from './wardrobeStore';
import { UNDO_LIMIT, COALESCE_MS } from './withUndo';

beforeEach(() => {
  localStorage.clear();
  const st = useProjectStore.getState();
  st.clearHistory();
  st.setRawProject((p) => ({ ...p, elements: p.elements.slice() }));
  st.clearHistory();
  useWardrobeStore.getState().clearHistory();
});

const brojElemenata = () => useProjectStore.getState().rawProject.elements.length;

describe('undo/redo — osnove', () => {
  it('na početku nema ničega za poništiti', () => {
    expect(useProjectStore.getState().canUndo).toBe(false);
    expect(useProjectStore.getState().canRedo).toBe(false);
    expect(useProjectStore.getState().undo()).toBe(false);
    expect(useProjectStore.getState().redo()).toBe(false);
  });

  it('brisanje elementa se može poništiti', () => {
    const st = useProjectStore.getState();
    const id = st.rawProject.elements[0].instanceId;
    const prije = brojElemenata();
    expect(prije).toBeGreaterThan(0);

    st.removeElement(id);
    expect(brojElemenata()).toBe(prije - 1);
    expect(useProjectStore.getState().canUndo).toBe(true);

    useProjectStore.getState().undo();
    expect(brojElemenata()).toBe(prije);
    expect(useProjectStore.getState().canRedo).toBe(true);

    useProjectStore.getState().redo();
    expect(brojElemenata()).toBe(prije - 1);
  });

  it('„Očisti prostor" se može poništiti jednim korakom', () => {
    const st = useProjectStore.getState();
    const prije = brojElemenata();
    expect(prije).toBeGreaterThan(3);

    st.setRawProject((p) => ({ ...p, elements: [], services: [] }));
    expect(brojElemenata()).toBe(0);

    useProjectStore.getState().undo();
    expect(brojElemenata()).toBe(prije);      // ← sve se vratilo odjednom
  });

  it('promjena dimenzija prostorije se poništava', () => {
    const st = useProjectStore.getState();
    const prije = st.room.width;
    st.setRoom({ ...st.room, width: 4000 });
    expect(useProjectStore.getState().room.width).toBe(4000);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().room.width).toBe(prije);
  });

  it('nova izmjena nakon undo briše redo granu', () => {
    const st = useProjectStore.getState();
    const id = st.rawProject.elements[0].instanceId;
    st.removeElement(id);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().canRedo).toBe(true);

    // nova, nepovezana izmjena
    useProjectStore.getState().setRoom({ width: 4200, depth: 3000, height: 2600 });
    expect(useProjectStore.getState().canRedo).toBe(false);
    expect(useProjectStore.getState().redo()).toBe(false);
  });

  it('više koraka unazad i naprijed', () => {
    const st = useProjectStore.getState();
    const ids = st.rawProject.elements.slice(0, 3).map((e) => e.instanceId);
    const pocetak = brojElemenata();

    ids.forEach((id) => useProjectStore.getState().removeElement(id));
    expect(brojElemenata()).toBe(pocetak - 3);

    useProjectStore.getState().undo();
    expect(brojElemenata()).toBe(pocetak - 2);
    useProjectStore.getState().undo();
    expect(brojElemenata()).toBe(pocetak - 1);
    useProjectStore.getState().redo();
    expect(brojElemenata()).toBe(pocetak - 2);
    useProjectStore.getState().undo();
    useProjectStore.getState().undo();
    expect(brojElemenata()).toBe(pocetak);
  });

  it('istorija je ograničena (ne raste neograničeno)', () => {
    for (let i = 0; i < UNDO_LIMIT + 40; i++) {
      useProjectStore.getState().setRoom({ width: 2000 + i, depth: 3000, height: 2600 });
    }
    expect(useProjectStore.getState().undoDepth()).toBeLessThanOrEqual(UNDO_LIMIT);
  });
});

describe('koalescencija — kontinuirane izmjene su JEDAN korak', () => {
  it('dvadeset uzastopnih pomjeranja kliznika = jedan undo', () => {
    const st = useProjectStore.getState();
    const pocetak = st.room.width;
    for (let i = 1; i <= 20; i++) {
      useProjectStore.getState().setRoom({ ...st.room, width: pocetak + i * 50 });
    }
    expect(useProjectStore.getState().room.width).toBe(pocetak + 1000);
    expect(useProjectStore.getState().undoDepth()).toBeLessThanOrEqual(3);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().room.width).toBe(pocetak);   // ← odjednom nazad
  });

  it('diskretne izmjene se NE grupišu (svaka je svoj korak)', () => {
    const st = useProjectStore.getState();
    const ids = st.rawProject.elements.slice(0, 3).map((e) => e.instanceId);
    ids.forEach((id) => useProjectStore.getState().removeElement(id));
    expect(useProjectStore.getState().undoDepth()).toBe(3);
  });

  it('mix: diskretna izmjena prekida lanac grupisanja', () => {
    const st = useProjectStore.getState();
    st.setRoom({ ...st.room, width: 4000 });
    st.setRoom({ ...st.room, width: 4100 });
    const id = st.rawProject.elements[0].instanceId;
    st.removeElement(id);                                    // diskretna
    st.setRoom({ ...st.room, width: 4200 });                 // novi lanac
    const dubina = useProjectStore.getState().undoDepth();
    expect(dubina).toBeGreaterThanOrEqual(2);
    expect(dubina).toBeLessThanOrEqual(4);
  });

  it('COALESCE_MS je razumna vrijednost (ne preduga, ne prekratka)', () => {
    expect(COALESCE_MS).toBeGreaterThanOrEqual(300);
    expect(COALESCE_MS).toBeLessThanOrEqual(1500);
  });
});

describe('clearHistory — učitavanje projekta nije korak koji se poništava', () => {
  it('loadProjectByName čisti istoriju', async () => {
    const st = useProjectStore.getState();
    st.setRoom({ ...st.room, width: 4321 });
    expect(useProjectStore.getState().canUndo).toBe(true);

    await useProjectStore.getState().saveProjectAs('UndoTest');
    useProjectStore.getState().setRoom({ width: 3000, depth: 3000, height: 2600 });
    await useProjectStore.getState().loadProjectByName('UndoTest');

    expect(useProjectStore.getState().canUndo).toBe(false);
    expect(useProjectStore.getState().canRedo).toBe(false);
  });

  it('undo NE vraća activeProjectName (inače bi „Sačuvaj" ciljao pogrešan zapis)', async () => {
    await useProjectStore.getState().saveProjectAs('AktivniTest');
    expect(useProjectStore.getState().activeProjectName).toBe('AktivniTest');

    useProjectStore.getState().setRoom({ width: 3210, depth: 3000, height: 2600 });
    useProjectStore.getState().undo();

    expect(useProjectStore.getState().room.width).not.toBe(3210);
    expect(useProjectStore.getState().activeProjectName).toBe('AktivniTest');
  });
});

describe('undo/redo za ormar', () => {
  const postaviOrmar = () => useWardrobeStore.getState().applyWizard({
    room: { width: 4000, depth: 3200, height: 2600 },
    wardrobeW: 2400, wardrobeH: 2500, wardrobeD: 580,
    legHeightMm: 100, doorType: 'klizna', segmentCount: 3,
  });

  it('brisanje unutrašnjeg elementa se poništava', () => {
    postaviOrmar();
    useWardrobeStore.getState().clearHistory();

    const a = useWardrobeStore.getState().addItem(0, 'lower', 'polica');
    expect(a.ok).toBe(true);
    expect(useWardrobeStore.getState().wardrobe.segments[0].lower.items).toHaveLength(1);

    useWardrobeStore.getState().removeItem(0, 'lower', a.id);
    expect(useWardrobeStore.getState().wardrobe.segments[0].lower.items).toHaveLength(0);

    useWardrobeStore.getState().undo();
    expect(useWardrobeStore.getState().wardrobe.segments[0].lower.items).toHaveLength(1);

    useWardrobeStore.getState().redo();
    expect(useWardrobeStore.getState().wardrobe.segments[0].lower.items).toHaveLength(0);
  });

  it('smanjenje broja segmenata (koje briše raspored) se poništava', () => {
    postaviOrmar();
    const a = useWardrobeStore.getState().addItem(2, 'lower', 'sipka');
    expect(a.ok).toBe(true);
    useWardrobeStore.getState().clearHistory();

    useWardrobeStore.getState().setSegmentCount(2);
    expect(useWardrobeStore.getState().wardrobe.segments).toHaveLength(2);

    useWardrobeStore.getState().undo();
    expect(useWardrobeStore.getState().wardrobe.segments).toHaveLength(3);
    expect(useWardrobeStore.getState().wardrobe.segments[2].lower.items).toHaveLength(1);
  });

  it('istorija ormara je nezavisna od istorije kuhinje', () => {
    postaviOrmar();
    useWardrobeStore.getState().clearHistory();
    useProjectStore.getState().clearHistory();

    useWardrobeStore.getState().setDoorType('baglame');
    expect(useWardrobeStore.getState().canUndo).toBe(true);
    expect(useProjectStore.getState().canUndo).toBe(false);   // ← nije procurelo
  });
});
