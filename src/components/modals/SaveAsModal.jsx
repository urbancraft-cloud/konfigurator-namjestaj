// src/components/app/SaveAsModal.jsx
import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { C } from '../../data/theme';
import { Modal } from '../ui/Modal';
import { Btn } from '../ui/Controls';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';

export function SaveAsModal({ onClose }) {
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const saveProjectAs = useProjectStore((s) => s.saveProjectAs);
  const flash = useUiStore((s) => s.flash);

  const handleSave = () => {
    if (!name.trim()) {
      setError('Unesite ime projekta.');
      return;
    }
    setSaving(true);
    const res = saveProjectAs(name.trim());
    setSaving(false);
    if (res && res.ok) {
      // Od sada je ovaj projekat „aktivan": dugme u zaglavlju ažurira njega.
      flash(`Projekat „${res.name}" sačuvan. Dugme „Sačuvaj" od sada ažurira njega.`);
      onClose();
    } else {
      setError(res && res.reason ? res.reason : 'Greška pri čuvanju projekta.');
    }
  };

  return (
    <Modal title="Sačuvaj projekat kao..." subtitle="Unesite ime pod kojim želite sačuvati projekat" onClose={onClose}>
      <div className="mb-4">
        <label className="text-xs mb-1.5 block font-medium" style={{ color: C.dim }}>
          Ime projekta
        </label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          placeholder="npr. Kuhinja Hadžić - ponuda 3"
          className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
          style={{ background: C.paper2, border: `1px solid ${error ? C.danger : C.line}`, color: C.text }}
        />
        {error && (
          <p className="text-xs mt-1.5" style={{ color: C.danger }}>{error}</p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Btn onClick={onClose}>Odustani</Btn>
        <Btn variant="primary" onClick={handleSave}>
          <Check size={14} /> {saving ? 'Čuvanje...' : 'Sačuvaj'}
        </Btn>
      </div>
    </Modal>
  );
}