// src/components/modals/ModalsGroup.jsx
import React from 'react';
import { SaveAsModal } from './SaveAsModal';
import { LoadProjectModal } from './LoadProjectModal';
import { DecorModal } from '../app/DecorModal';
import { BomModal } from '../app/BomModal';
import { OfferModal } from '../app/OfferModal';
import { ShortcutsModal } from '../app/ShortcutsModal';

/**
 * Grupisani modalni dijalozi.
 * Izdvojeno iz App.jsx radi smanjenja kompleksnosti.
 */
export function ModalsGroup({ 
  modal, setModal, 
  project, room, totals, bom,
  onSaveProject,
  onLoadProject,
  onImportPriceList,
  flash
}) {
  return (
    <>
      {modal === 'saveAs' && <SaveAsModal onClose={() => setModal(null)} />}
      {modal === 'loadProject' && <LoadProjectModal onClose={() => setModal(null)} />}
      {modal === 'dekori' && (
        <DecorModal 
          onClose={() => setModal(null)} 
          onSave={(saved, id, mode) => {
            if (mode === 'import-cjenovnik') {
              const res = onImportPriceList(saved);
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
          }} 
        />
      )}
      {modal === 'bom' && <BomModal bom={bom} projectName={project.name} onClose={() => setModal(null)} />}
      {modal === 'ponuda' && <OfferModal project={project} room={room} totals={totals} onClose={() => setModal(null)} />}
      {modal === 'prečice' && <ShortcutsModal onClose={() => setModal(null)} />}
    </>
  );
}
