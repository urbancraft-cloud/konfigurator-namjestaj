// src/components/app/LoadProjectModal.jsx
import React, { useState } from 'react';
import { FolderOpen, Trash2 } from 'lucide-react';
import { C } from '../../data/theme';
import { Modal } from '../ui/Modal';
import { Btn } from '../ui/Controls';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';

export function LoadProjectModal({ onClose }) {
  const listProjects = useProjectStore((s) => s.listProjects);
  /* Lazy inicijalizator umjesto `useState([])` + `useEffect(setState)`:
     `listProjects` je sinhron, pa se lista izračuna odmah pri prvom renderu —
     bez jednog praznog kadra i bez `set-state-in-effect` upozorenja. */
  const [projects, setProjects] = useState(() => listProjects().items);
  const [corrupt, setCorrupt] = useState(() => listProjects().corrupt);
  const loadProjectByName = useProjectStore((s) => s.loadProjectByName);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const activeProjectName = useProjectStore((s) => s.activeProjectName);
  const flash = useUiStore((s) => s.flash);

  const handleLoad = (name) => {
    const res = loadProjectByName(name);
    if (res && res.ok) {
      const n = (res.notes || []).length;
      flash(n
        ? `Projekat „${name}" učitan uz ${n} ispravki — provjerite napomene.`
        : `Projekat „${name}" učitan.`);
      onClose();
    } else {
      flash(res && res.reason ? res.reason : 'Greška pri učitavanju projekta.');
    }
  };

  const handleDelete = (name, e) => {
    e.stopPropagation();
    if (!window.confirm(`Obrisati projekat „${name}"? Ovo se ne može poništiti.`)) return;
    const res = deleteProject(name);
    if (res && res.ok) {
      setProjects((p) => p.filter((x) => x.name !== name));
      flash(`Projekat „${name}" obrisan.`);
    } else {
      flash(res && res.reason ? res.reason : 'Brisanje nije uspjelo.');
    }
  };

  const handleDeleteCorrupt = (name) => {
    if (!window.confirm(`Obrisati nečitljiv zapis „${name}"?`)) return;
    const res = deleteProject(name);
    if (res && res.ok) setCorrupt((c) => c.filter((x) => x !== name));
  };

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('bs-BA', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  return (
    <Modal title="Učitaj projekat" subtitle="Odaberite spremljeni projekat" onClose={onClose}>
      {projects.length === 0 ? (
        <div className="text-center py-8 text-sm" style={{ color: C.faint }}>
          Nema spremljenih projekata.<br />
          Koristite „Sačuvaj kao…" da spremite trenutni projekat.
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {projects.map((p) => (
            <div
              key={p.name}
              onClick={() => handleLoad(p.name)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLoad(p.name); } }}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
              style={{
                background: C.paper2,
                border: `1px solid ${p.name === activeProjectName ? C.accent : C.line}`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.accentSoft; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.paper2; }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: C.text }}>
                  {p.name}
                  {p.name === activeProjectName && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs font-medium rounded"
                      style={{ background: C.accentSoft, color: C.accentText }}>aktivan</span>
                  )}
                </div>
                <div className="text-xs" style={{ color: C.faint }}>{formatDate(p.savedAt)}</div>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <Btn size="sm" variant="ghost" ariaLabel={`Učitaj ${p.name}`}
                  onClick={(e) => { e.stopPropagation(); handleLoad(p.name); }}>
                  <FolderOpen size={13} />
                </Btn>
                <Btn size="sm" variant="danger" ariaLabel={`Obriši ${p.name}`}
                  onClick={(e) => handleDelete(p.name, e)}>
                  <Trash2 size={13} />
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {corrupt.length > 0 && (
        <div className="mt-3 p-2.5 rounded-lg text-xs" style={{ background: C.warnBg, color: C.warn }}>
          <b>{corrupt.length} zapis(a) se ne može pročitati</b> i nije prikazano na listi:
          <div className="mt-1.5 space-y-1">
            {corrupt.map((name) => (
              <div key={name} className="flex items-center justify-between gap-2">
                <span className="truncate">{name}</span>
                <button type="button" onClick={() => handleDeleteCorrupt(name)}
                  className="px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: '#fff', color: C.warn }}>obriši</button>
              </div>
            ))}
          </div>
          <p className="mt-1.5" style={{ color: C.warn }}>
            Najčešće su to projekti sačuvani sa starijom verzijom programa ili
            prekinuto čuvanje.
          </p>
        </div>
      )}

      <p className="text-xs mt-3" style={{ color: C.faint }}>
        Učitani projekat postaje <b>aktivan</b>: dugme „Sačuvaj" u zaglavlju od tada
        ažurira taj zapis, a ne zasebni brzi snimak. Projekti žive u memoriji ovog
        preglednika — za prenos na drugi računar koristite <b>Izvezi / Uvezi</b>.
      </p>

      <div className="flex justify-end mt-4">
        <Btn onClick={onClose}>Zatvori</Btn>
      </div>
    </Modal>
  );
}
