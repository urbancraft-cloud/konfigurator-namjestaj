// src/store/uiStore.js
import { create } from 'zustand';

export const useUiStore = create((set, get) => ({
  view: '3d',
  tool: 'select',
  wizard: true,
  appMode: 'kuhinja',
  showFronts: true,
  targetWall: 'top',
  pendingAdd: null,
  walk: false,
  measure: false,
  measured: null,
  selectedId: null,
  modal: null,
  /**
   * Da li su bočni paneli prikazani. Na širokom ekranu su uvijek vidljivi;
   * na uskom (< 1100 px) se sklapaju jer LeftRail (288 px) + RightRail (320 px)
   * + viewport ne staju — na tabletu u portretu viewport bi dobio nula širine.
   */
  panelsOpen: true,
  toast: null,
  toastSeq: 0,
  tab: 'katalog',

  setView: (v) => set({ view: v }),
  setTool: (v) => set({ tool: v }),
  setWizard: (v) => set({ wizard: v }),
  setAppMode: (v) => set({ appMode: v }),
  toggleShowFronts: () => set((s) => ({ showFronts: !s.showFronts })),
  setTargetWall: (v) => set({ targetWall: v }),
  setPendingAdd: (v) => set({ pendingAdd: v }),
  /* `toggleWalk`/`toggleMeasure` su obrisani: nijedan dio UI-a ih nije zvao —
     App.jsx koristi `setWalk`/`setMeasure` zajedno sa `setView('3d')`. */
  setMeasured: (v) => set({ measured: v }),
  setSelectedId: (v) => set({ selectedId: v }),
  setModal: (v) => set({ modal: v }),
  setPanelsOpen: (v) => set({ panelsOpen: !!v }),
  togglePanels: () => set((s) => ({ panelsOpen: !s.panelsOpen })),
  setTab: (v) => set({ tab: v }),
  setWalk: (v) => set({ walk: v }),
  setMeasure: (v) => set({ measure: v }),
  /* `toastTimer` i `toastSeq`: bez ovoga se dva brza flash-a preklapaju i prvi
     timeout ugasi i drugu poruku prije vremena. `toastSeq` također daje stabilan
     `key` za animaciju. */
  toastTimer: null,
  _lastThrottled: { msg: null, at: 0 },
  flash: (m) => {
    const prev = get().toastTimer;
    if (prev) clearTimeout(prev);
    const toastTimer = setTimeout(() => set({ toast: null, toastTimer: null }), 2600);
    set((s) => ({ toast: m, toastSeq: s.toastSeq + 1, toastTimer }));
  },
  /**
   * `flash` sa prigušenjem — za povratne informacije koje se mogu okinuti na
   * svaki `pointermove` (npr. odbijeno prevlačenje zbog kolizije). Istu poruku
   * ne prikazuje ponovo prije nego što istekne `ms`.
   */
  flashThrottled: (m, ms = 1400) => {
    const now = Date.now();
    const last = get()._lastThrottled;
    if (last && last.msg === m && now - last.at < ms) return false;
    set({ _lastThrottled: { msg: m, at: now } });
    get().flash(m);
    return true;
  },
}));