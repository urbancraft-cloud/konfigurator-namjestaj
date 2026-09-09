// src/components/wardrobe/WardrobeHeader.jsx
import React from 'react';
import { Box as BoxIcon, Wand2, Save, FolderOpen, Package, Eye, EyeOff, Undo2, Redo2, PanelLeft } from 'lucide-react';
import { C, mono } from '../../data/theme';
import { fmt } from '../../utils/formatters';
import { Btn } from '../ui/Controls';
import { useUiStore } from '../../store/uiStore';
import { useWardrobeStore } from '../../store/wardrobeStore';

export function WardrobeHeader({ price, showInterior, onToggleInterior, narrow = false, onTogglePanels }) {
  const wardrobe = useWardrobeStore((s) => s.wardrobe);
  const saveWardrobeProject = useWardrobeStore((s) => s.saveWardrobeProject);
  const loadWardrobeProject = useWardrobeStore((s) => s.loadWardrobeProject);
  const undo = useWardrobeStore((s) => s.undo);
  const redo = useWardrobeStore((s) => s.redo);
  const canUndo = useWardrobeStore((s) => s.canUndo);
  const canRedo = useWardrobeStore((s) => s.canRedo);
  const setWizard = useUiStore((s) => s.setWizard);
  const setModal = useUiStore((s) => s.setModal);
  const flash = useUiStore((s) => s.flash);

  const save = () => {
    const res = saveWardrobeProject();
    flash(res && res.ok ? 'Projekat ormara sačuvan.'
      : (res && res.reason ? res.reason : 'Greška pri čuvanju.'));
  };

  /**
   * BUG-17: `loadWardrobeProject` je postojao u store-u ali ga NIJEDAN dio UI-a
   * nije zvao — ormar se mogao sačuvati ali nikad ponovo učitati, a pokretanje
   * čarobnjaka ga je resetovalo na `DEFAULT_WARDROBE()`.
   */
  const load = () => {
    const res = loadWardrobeProject();
    if (res && res.ok) {
      const n = (res.notes || []).length;
      flash(n
        ? `Projekat ormara učitan uz ${n} ispravki.`
        : 'Projekat ormara učitan.');
    } else {
      flash(res && res.reason ? res.reason : 'Greška pri učitavanju projekta ormara.');
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-2.5 shrink-0"
      style={{ background: C.paper, borderBottom: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: C.accent }}>
          <BoxIcon size={18} color="#fff" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">{wardrobe.name}</div>
          <div className="text-xs leading-tight" style={{ color: C.faint }}>
            Spavaća soba · {wardrobe.segmentCount} segmenta · {wardrobe.widthMm}×{wardrobe.roomHeightMm}×{wardrobe.depthMm} mm · nogice {wardrobe.legHeightMm} mm · donji korpus {wardrobe.lowerCorpusHeightMm} mm
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right leading-tight">
          <div className="text-xs" style={{ color: C.faint }}>Ukupno sa PDV-om</div>
          <div className="text-lg font-semibold" style={{ ...mono, color: C.text }}>{fmt(price.gross)} KM</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {onTogglePanels && (
            <Btn onClick={onTogglePanels} size="sm" ariaLabel="Bočni paneli"
              title="Prikaži ili sakrij bočne panele">
              <PanelLeft size={13} />{narrow ? null : ' Paneli'}
            </Btn>
          )}
          <Btn onClick={onToggleInterior} size="sm" variant={showInterior ? 'primary' : 'ghost'}>
            {showInterior ? <Eye size={13} /> : <EyeOff size={13} />} {showInterior ? 'Enterijer' : 'Vrata zatvorena'}
          </Btn>
          <Btn onClick={() => (undo() ? flash('Izmjena poništena.') : null)} size="sm"
            disabled={!canUndo} title="Poništi zadnju izmjenu (Ctrl+Z)" ariaLabel="Poništi">
            <Undo2 size={13} />
          </Btn>
          <Btn onClick={() => (redo() ? flash('Izmjena vraćena.') : null)} size="sm"
            disabled={!canRedo} title="Vrati poništenu izmjenu (Ctrl+Y)" ariaLabel="Vrati">
            <Redo2 size={13} />
          </Btn>
          <Btn onClick={load} size="sm"><FolderOpen size={13} /> Učitaj</Btn>
          <Btn onClick={save} size="sm"><Save size={13} /> Sačuvaj</Btn>
          <Btn onClick={() => setModal('wardrobeBom')} size="sm" variant="primary">
            <Package size={13} /> Krojna lista
          </Btn>
          <Btn onClick={() => setWizard(true)} size="sm"><Wand2 size={13} /> Novi projekat</Btn>
        </div>
      </div>
    </header>
  );
}
