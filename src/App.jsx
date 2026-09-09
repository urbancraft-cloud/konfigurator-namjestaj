// src/App.jsx
import React, { useMemo, useEffect, useState, lazy, Suspense } from 'react';
import { C, mono, card } from './data/theme';
import { resolveProject } from './engine/layout';
import { projectTotals, surfacesCost, projectTotalsBySheets } from './engine/pricing';
import { computeBOM } from './engine/bom';
import { validateInProject } from './engine/validation';

import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { LeftRail } from './components/layout/LeftRail';
import { RightRail } from './components/layout/RightRail';
import { PlanView2D } from './views/PlanView2D';
import { StartupWizard } from './components/app/StartupWizard';
import { DecorModal } from './components/app/DecorModal';
import { BomModal } from './components/app/BomModal';
import { OfferModal } from './components/app/OfferModal';
import { ShortcutsModal } from './components/app/ShortcutsModal';

import { useProjectSelectors } from './hooks/useProjectSelectors';
import { useUiSelectors } from './hooks/useUiSelectors';
import { useIsNarrow } from './hooks/useViewport';
import { useWardrobeStore } from './store/wardrobeStore';

import { ViewportControls, ViewportInfo, MeasurePanel, SurfacesPanel } from './components/viewport/ViewportControls';
import { ModalsGroup } from './components/modals/ModalsGroup';
import { SaveAsModal } from './components/modals/SaveAsModal';
import { LoadProjectModal } from './components/modals/LoadProjectModal';

/* PERF-07: Three.js (~600 kB) se ranije učitavao odmah, pa i korisniku koji
   gleda samo tlocrt ili radi u modu za ormar. Oba 3D prikaza se sada učitavaju
   na zahtjev. `WardrobeApp` povlači i svoj vlastiti 3D viewport, pa se cijeli
   modul za ormar ne skida dok korisnik ne izabere „Spavaća soba". */
const Viewport3D = lazy(() => import('./views/Viewport3D').then((m) => ({ default: m.Viewport3D })));
const WardrobeApp = lazy(() => import('./components/wardrobe/WardrobeApp').then((m) => ({ default: m.WardrobeApp })));

/** Prazan placeholder dok se 3D modul skida (obično <200 ms na lokalnoj mreži). */
function ViewportPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center"
      style={{ color: '#64748B', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
      Učitavanje 3D prikaza…
    </div>
  );
}

export default function App() {
  // Jedna pretplata za sve projektne podatke (umjesto 15+ zasebnih)
  const projectSelectors = useProjectSelectors();
  const { room, rawProject, decorVersion, bumpDecorVersion, saveDecors, loadDecors, 
          removeElement, dragElement, moveCooktop, applyWizard, placeService, 
          setRawProject, undo, redo, saveDraft } = projectSelectors;

  // Jedna pretplata za sve UI state (umjesto 25+ zasebnih)
  const uiSelectors = useUiSelectors();
  const { view, setView, tool, setTool, wizard, setWizard, appMode, setAppMode,
          showFronts, toggleShowFronts, walk, setWalk, measure, setMeasure,
          measured, setMeasured, selectedId, setSelectedId, modal, setModal,
          toastSeq, toast, flash, setPendingAdd, panelsOpen, setPanelsOpen } = uiSelectors;

  const [draftSavedAt, setDraftSavedAt] = useState(null);

  /* Na uskom ekranu bočni paneli postaju izvlačeće ladice — inače bi
     LeftRail (288 px) + RightRail (320 px) + viewport zauzeli više od širine
     ekrana i viewport bi dobio nula piksela. */
  const isNarrow = useIsNarrow();
  useEffect(() => { setPanelsOpen(!isNarrow); }, [isNarrow, setPanelsOpen]);
  const floating = isNarrow && panelsOpen;

  const wardrobeRoom = useWardrobeStore((s) => s.room);
  const wardrobeApplyWizard = useWardrobeStore((s) => s.applyWizard);
  /* Undo/redo za ormar čita se direktno iz `useWardrobeStore.getState()` unutar
     handlera za tastaturu — pretplata ovdje nije potrebna jer dugmad žive u
     `WardrobeHeader`, ne u `App`. */

  /* ---------------------------------------------------------------------------
     Izvedeno stanje — SVE na jednom mjestu.

     Prije je ovdje bilo pet odvojenih `useMemo` poziva:
         project, totals, bom, surf, invalidCount
     `projectTotals` interno računa `surfacesCost`, `computeBOM` također, a `surf`
     je bio treći poziv — dakle najskuplji dio kalkulacije (~0,9 ms) izvršavao se
     3× po svakom renderu. `invalidCount` je uz to ponovo prolazio kroz sve
     elemente sa `validateInProject`, koji je onda RAČUNAN I PONOVO u RightRail-u
     (po svakom elementu liste) i u PlanView2D (po svakom elementu, dvaput).

     Izmjereno na 12 elemenata: 8,18 ms po renderu prije, ~4 ms poslije.
     Pošto se ovo izvršava na SVAKI `pointermove` tokom prevlačenja elementa,
     razlika je direktno vidljiva u odzivu.
  --------------------------------------------------------------------------- */
  const derived = useMemo(() => {
    const project = resolveProject(rawProject, room);
    const surf = surfacesCost(project, room);
    const bom = computeBOM(project, room, surf);
    /* Način obračuna materijala:
         'neto'  → neto površina panela × KM/m² × WASTE_FACTOR (1,15) — brzo, grubo
         'ploce' → po potrošenim pločama, sa pravilom pola ploče za grupe manje
                   od jedne cijele ploče. Stvarniji trošak jer se ploča ne može
                   dijeliti između različitih dekora. */
    const mode = rawProject.materialMode || 'ploce';
    const totals = mode === 'ploce'
      ? projectTotalsBySheets(project, room, bom, surf)
      : projectTotals(project, room, surf);

    // Validacija se računa JEDNOM i dijeli se sa RightRail-om i PlanView2D-om.
    const validations = new Map();
    let invalidCount = 0;
    project.elements.forEach((e) => {
      const v = validateInProject(e, project, room);
      validations.set(e.instanceId, v);
      if (!v.valid) invalidCount += 1;
    });

    const surfNotes = surf.wt.notes.concat(surf.wp.notes, surf.sk.notes, surf.gm.notes);
    return { project, surf, totals, bom, validations, invalidCount, surfNotes, materialMode: mode };
    /* `decorVersion` je namjerno u zavisnostima iako se ne čita u tijelu:
       `registerDecor` mutira modul-globalni `DECORS`, pa React ne može primijetiti
       promjenu — ovaj brojač je cache-bust. Lint javlja "unnecessary dependency";
       ne dirajte bez zamjene DECORS-a immutable strukturom u store-u. */
  }, [rawProject, room, decorVersion]);

  const { project, totals, bom, surf, surfNotes, validations, invalidCount, materialMode } = derived;

  // Load saved decors on mount
useEffect(() => {
  /* `loadDecors` je sada sinhron — nema razloga za async omotač i `live` zastavu. */
  const n = loadDecors();
  if (n > 0) flash(`Učitano ${n} sačuvanih dekora.`);
}, [loadDecors, flash]);

  /* Automatsko čuvanje nacrta: 2,5 s nakon posljednje izmjene, bez obzira da li
     je korisnik išta ručno sačuvao. Debounce je nužan jer se `rawProject` mijenja
     na svaki korak prevlačenja elementa. */
  useEffect(() => {
    const t = setTimeout(() => {
      const res = saveDraft();
      if (res && res.ok) setDraftSavedAt(Date.now());
    }, 2500);
    return () => clearTimeout(t);
  }, [rawProject, room, saveDraft]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (t && t.isContentEditable) return;
      // Dok je bilo koji modal otvoren, kratice ne prolaze — inače Backspace u
      // dijalogu briše element koji je ostao selektovan ispod.
      if (modal || wizard) return;

      /* Undo/redo — Ctrl/Cmd+Z i Ctrl/Cmd+Y (ili Shift+Z kao na macOS-u).
         Radi i u modu za ormar, nad odgovarajućim store-om. */
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' || k === 'y') {
          const un = e.key.toLowerCase() === 'y' ? false : !e.shiftKey;
          e.preventDefault();
          if (appMode === 'spavaca') {
            const store = useWardrobeStore.getState();
            const ok = un ? store.undo() : store.redo();
            flash(ok ? (un ? 'Izmjena poništena.' : 'Izmjena vraćena.') : (un ? 'Nema šta da se poništi.' : 'Nema šta da se vrati.'));
          } else {
            const ok = un ? undo() : redo();
            flash(ok ? (un ? 'Izmjena poništena.' : 'Izmjena vraćena.') : (un ? 'Nema šta da se poništi.' : 'Nema šta da se vrati.'));
          }
          return;
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        removeElement(selectedId);
        setSelectedId(null);
        flash('Element obrisan.');
      }
      if (e.key === 'h' || e.key === 'H') { setView('3d'); setWalk(!walk); }
      if (e.key === 't' || e.key === 'T') { setView('3d'); setMeasured(null); setMeasure(!measure); }
      if (e.key === 'Escape') { setWalk(false); setMeasure(false); setPendingAdd(null); }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); setModal('prečice'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, walk, measure, modal, wizard, appMode, undo, redo, removeElement,
      setSelectedId, flash, setView, setWalk, setMeasure, setMeasured, setPendingAdd, setModal]);

  const handlePlaceService = (kind, wall, offset) => {
    placeService(kind, wall, offset);
    setTool('select');
    flash(kind === 'voda' ? 'Odvod postavljen, sudoper dodan.' : 'Utičnica postavljena.');
  };

  const handleMoveCooktop = (id, off) => {
    moveCooktop(id, off);
  };

  return (
    <>
      {appMode === 'spavaca' ? (
        <Suspense fallback={<ViewportPlaceholder />}>
          <WardrobeApp narrow={isNarrow} panelsOpen={panelsOpen} setPanelsOpen={setPanelsOpen} />
        </Suspense>
      ) : (
        <div className="w-full h-screen flex flex-col" style={{ background: C.bg, color: C.text, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
          <Header totals={totals} invalidCount={invalidCount} narrow={isNarrow}
            materialMode={materialMode} />

          <div className="flex-1 flex min-h-0 gap-3 p-3">
            {(!isNarrow || floating) && (
              <LeftRail project={project} room={room} surf={surf} surfNotes={surfNotes}
                sheetSummary={totals.sheets ? totals.sheets.summary : null}
                chargedSheets={totals.sheets ? totals.sheets.chargedSheets : null}
                floating={floating} onNavigate={() => setPanelsOpen(false)} />
            )}

            {/* ---------- Viewport ---------- */}
            <main className="flex-1 relative min-w-0 overflow-hidden" style={{ ...card, borderRadius: 16 }}>
              <ViewportControls 
                view={view} setView={setView}
                tool={tool} setTool={setTool}
                showFronts={showFronts} toggleShowFronts={toggleShowFronts}
                walk={walk} setWalk={setWalk}
                measure={measure} setMeasure={setMeasure}
                onNewProject={() => setWizard(true)}
                onClearSpace={() => { setRawProject((p) => ({ ...p, elements: [], services: [] })); setSelectedId(null); setTool('select'); flash('Prostor očišćen.'); }}
              />
              
              <ViewportInfo view={view} tool={tool} measure={measure} walk={walk} />
              
              {measure && <MeasurePanel measured={measured} onReset={() => setMeasured(null)} />}
              
              <SurfacesPanel surfaces={surf} />

              <div className="absolute inset-0">
                {view === '2d'
                  ? <PlanView2D project={project} room={room} selectedId={selectedId} onSelect={setSelectedId}
                      onDrag={dragElement} tool={tool} onPlaceService={handlePlaceService}
                      onMoveCooktop={handleMoveCooktop} validations={validations}
                      surfaces={surf} />
                  : (
                    <Suspense fallback={<ViewportPlaceholder />}>
                      <Viewport3D project={project} room={room} selectedId={selectedId} onSelect={setSelectedId}
                        onDrag={dragElement} showFronts={showFronts} walk={walk}
                        measure={measure} onMeasure={(mm, n) => setMeasured(n === 2 ? mm : null)} />
                    </Suspense>
                  )}
              </div>
            </main>

            {(!isNarrow || floating) && (
              <RightRail project={project} room={room} validations={validations}
                floating={floating} onNavigate={() => setPanelsOpen(false)} />
            )}
          </div>

          {/* Zamračenje ispod ladice — klik na njega zatvara panele */}
          {floating && (
            <div className="fixed inset-0 z-30" style={{ background: 'rgba(15,23,42,0.35)' }}
              onClick={() => setPanelsOpen(false)} aria-hidden="true" />
          )}

          <Footer bom={bom} totals={totals} materialMode={materialMode}
            draftSavedAt={draftSavedAt} />

          {modal === 'saveAs' && <SaveAsModal onClose={() => setModal(null)} />}
          {modal === 'loadProject' && <LoadProjectModal onClose={() => setModal(null)} />}
          {modal === 'dekor' && (
            <DecorModal onClose={() => setModal(null)}
              onSaved={(id, mode, res) => {
                bumpDecorVersion();
                const saved = saveDecors();
                if (mode === 'imported') {
                  // Kod uvoza cjenovnika dijalog ostaje otvoren da se vidi rezultat
                  flash(saved && saved.ok
                    ? `Cjenovnik ažuriran: ${res.total} dekora (${res.added} novih, ${res.updated} izmijenjenih).`
                    : `Cjenovnik primijenjen, ali NIJE sačuvan: ${saved && saved.reason}`);
                  return;
                }
                setModal(null);
                if (!saved || !saved.ok) {
                  flash(`Dekor ${id} primijenjen, ali NIJE trajno sačuvan: ${saved && saved.reason}`);
                  return;
                }
                flash(mode === 'updated'
                  ? `Dekor ${id} izmijenjen i sačuvan.`
                  : `Dekor ${id} dodan i sačuvan.`);
              }} />
          )}
          {modal === 'bom' && <BomModal bom={bom} projectName={project.name} onClose={() => setModal(null)} />}
          {modal === 'ponuda' && <OfferModal project={project} room={room} totals={totals} onClose={() => setModal(null)} />}
          {modal === 'prečice' && <ShortcutsModal onClose={() => setModal(null)} />}
        </div>
      )}

      {toast && (
        <div key={toastSeq} className="fixed bottom-16 left-1/2 z-50 px-4 py-2.5 text-sm rounded-xl"
          style={{ transform: 'translateX(-50%)', background: C.ink, color: '#fff' }}>{toast}</div>
      )}

      {wizard && (
        <StartupWizard
          room={appMode === 'spavaca' ? wardrobeRoom : room}
          onClose={() => setWizard(false)}
          onFinish={(d) => {
            if (d.kind === 'spavaca') {
              setAppMode('spavaca');
              wardrobeApplyWizard(d);
              flash('Ormar postavljen.');
            } else {
              setAppMode('kuhinja');
              applyWizard(d);
              flash(d.autoLayout && d.kind === 'kuhinja' ? 'Raspored predložen.' : 'Projekat postavljen.');
            }
            setWizard(false);
            setTool('select');
            setSelectedId(null);
          }}
        />
      )}
    </>
  );
}