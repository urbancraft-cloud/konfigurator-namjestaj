// src/components/layout/Header.jsx
import React from 'react';
import {
  Box as BoxIcon, Save, Palette, FileText, Package, FolderOpen, FolderPlus,
  Undo2, Redo2, Download, Upload, PanelLeft, HelpCircle,
} from 'lucide-react';
import { C, mono } from '../../data/theme';
import { fmt } from '../../utils/formatters';
import { ROOM_KINDS, SHAPES } from '../../data/catalog';
import { Btn } from '../ui/Controls';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { downloadJSON, projectToJSON, importProjectFromJSON } from '../../utils/exportImport';

export function Header({ totals, invalidCount, narrow = false, materialMode }) {
  const rawProject = useProjectStore((s) => s.rawProject);
  const room = useProjectStore((s) => s.room);
  const activeProjectName = useProjectStore((s) => s.activeProjectName);
  const saveProject = useProjectStore((s) => s.saveProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.canUndo);
  const canRedo = useProjectStore((s) => s.canRedo);
  const setModal = useUiStore((s) => s.setModal);
  const togglePanels = useUiStore((s) => s.togglePanels);
  const panelsOpen = useUiStore((s) => s.panelsOpen);
  const flash = useUiStore((s) => s.flash);
  const fileRef = React.useRef(null);

  /** Izvoz projekta kao .json fajl — jedini način da se projekat iznese iz preglednika. */
  const exportProject = () => {
    const { room, rawProject: pr } = useProjectStore.getState();
    downloadJSON(projectToJSON(room, pr), pr.name || 'projekat');
    flash('Projekat izvezen kao JSON fajl.');
  };

  /**
   * Uvoz projekta iz fajla. Datoteka se čita, provjerava i normalizuje istim
   * putem kao i učitavanje iz localStorage-a (`normalizeProject`), pa stariji
   * ili oštećeni fajl ne može srušiti aplikaciju.
   */
  const importProjectFromFile = async (file) => {
    try {
      const text = await file.text();
      const res = importProjectFromJSON(text);
      if (!res.ok) { flash(res.reason || 'Uvoz nije uspio.'); return; }
      /* `importProjectFromJSON` ne dira store (da nema kružne zavisnosti),
         pa se stanje upisuje ovdje. Uvoz se NE bilježi u historiju — korisnik
         ne treba da može „poništiti" uvoz i tako se vratiti na pola projekta. */
      useProjectStore.setState({ room: res.room, rawProject: res.project, activeProjectName: null }, false, false);
      useProjectStore.getState().clearHistory();
      const n = (res.notes || []).length;
      flash(n
        ? `Projekat „${res.name}" uvezen uz ${n} ispravki.`
        : `Projekat „${res.name}" uvezen.`);
    } catch (e) {
      flash(`Datoteka se ne može pročitati: ${e && e.message ? e.message : 'nepoznata greška'}`);
    }
  };

  const save = () => {
    const res = saveProject();
    if (!res || !res.ok) {
      flash(res && res.reason ? `Čuvanje nije uspjelo: ${res.reason}` : 'Greška pri čuvanju projekta.');
      return;
    }
    flash(res.slot === 'named'
      ? `Projekat „${res.name}" sačuvan.`
      : 'Brzi snimak sačuvan (nije imenovani projekat — koristite „Sačuvaj kao" za trajno ime).');
  };

  return (
    <header className="flex items-center justify-between px-4 py-2.5 shrink-0"
      style={{ background: C.paper, borderBottom: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: C.accent }}>
          <BoxIcon size={18} color="#fff" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">
            {rawProject.name}
            {activeProjectName && (
              <span className="ml-2 px-1.5 py-0.5 text-xs font-medium rounded"
                style={{ background: C.accentSoft, color: C.accentText }}
                title={'Sačuvano pod ovim imenom — ovo dugme ažurira isti zapis.'}>
                aktivan
              </span>
            )}
          </div>
          <div className="text-xs leading-tight" style={{ color: C.faint }}>
            {rawProject.kind ? `${(ROOM_KINDS.find((k) => k.id === rawProject.kind) || { label: rawProject.kind }).label}${rawProject.shape ? ' · ' + (SHAPES.find((x) => x.id === rawProject.shape) || {}).label : ''} · ` : ''}
            {rawProject.elements.length} elemenata · {room.width}×{room.depth} mm
          </div>
        </div>
        {invalidCount > 0 && (
          <span className="ml-2 px-2 py-1 text-xs font-medium rounded-lg" style={{ background: C.dangerBg, color: C.danger }}>
            {invalidCount} sa greškom
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right leading-tight">
          <div className="text-xs" style={{ color: C.faint }}>
            Ukupno sa PDV-om
            {materialMode === 'ploce'
              ? ' · materijal po pločama'
              : ' · materijal po neto površini'}
          </div>
          <div className="text-lg font-semibold" style={{ ...mono, color: C.text }}>{fmt(totals.gross)} KM</div>
        </div>
        {/* Na uskom ekranu se natpisi dugmadi sakriju (ostaju ikone + title),
            jer 9 dugmadi sa tekstom ne staje ni na 1024 px. */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
  <Btn onClick={togglePanels} size="sm" ariaLabel="Bočni paneli"
    title={panelsOpen ? 'Sakrij bočne panele' : 'Prikaži bočne panele'}>
    <PanelLeft size={13} />{narrow ? null : ' Paneli'}
  </Btn>
  <Btn onClick={() => (undo() ? flash('Izmjena poništena.') : null)} size="sm"
    disabled={!canUndo} title="Poništi zadnju izmjenu (Ctrl+Z)" ariaLabel="Poništi">
    <Undo2 size={13} />
  </Btn>
  <Btn onClick={() => (redo() ? flash('Izmjena vraćena.') : null)} size="sm"
    disabled={!canRedo} title="Vrati poništenu izmjenu (Ctrl+Y)" ariaLabel="Vrati">
    <Redo2 size={13} />
  </Btn>
  <Btn onClick={exportProject} size="sm" title="Izvezi projekat kao JSON fajl">
    <Download size={13} /> Izvezi
  </Btn>
  <Btn onClick={() => fileRef.current && fileRef.current.click()} size="sm"
    title="Uvezi projekat iz JSON fajla">
    <Upload size={13} /> Uvezi
  </Btn>
  <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
    onChange={(e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importProjectFromFile(f);
      e.target.value = '';      // dozvoli ponovni odabir iste datoteke
    }} />
  <Btn onClick={() => setModal('loadProject')} size="sm">
    <FolderOpen size={13} /> Učitaj projekat
  </Btn>
  <Btn onClick={save} size="sm" >
    <Save size={13} /> {activeProjectName ? `Sačuvaj: ${activeProjectName}` : 'Brzo sačuvaj'}
  </Btn>
  <Btn onClick={() => setModal('saveAs')} size="sm">
  <FolderPlus size={13} /> Sačuvaj kao...
</Btn>
  <Btn onClick={() => setModal('dekor')} size="sm"><Palette size={13} /> Ubaci dekor</Btn>
  <Btn onClick={() => setModal('ponuda')} size="sm"><FileText size={13} /> Ponuda</Btn>
  <Btn onClick={() => setModal('bom')} size="sm" variant="primary"><Package size={13} /> Krojna lista</Btn>
  <Btn onClick={() => setModal('prečice')} size="sm" ariaLabel="Prečice"
    title="Prečice za tastaturu i miš (?)"><HelpCircle size={13} />{narrow ? null : ' Prečice'}</Btn>
</div>
      </div>
    </header>
  );
}