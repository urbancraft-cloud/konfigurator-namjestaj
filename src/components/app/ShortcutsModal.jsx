// src/components/app/ShortcutsModal.jsx
import React from 'react';
import { C, mono } from '../../data/theme';
import { Modal } from '../ui/Modal';

const TASTATURA = [
  ['H', 'hodanje kroz prostor (3D) — W A S D ili strelice za kretanje, miš za pogled'],
  ['T', 'metar — klikni dvije tačke za udaljenost u mm'],
  ['Delete / Backspace', 'obriši odabrani element'],
  ['Esc', 'izađi iz hodanja, mjerenja ili dodavanja elementa'],
  ['Ctrl + Z', 'poništi zadnju izmjenu'],
  ['Ctrl + Y', 'vrati poništenu izmjenu'],
  ['Ctrl + Shift + Z', 'vrati poništenu izmjenu (macOS način)'],
  ['?', 'ova pomoć'],
];

const MIS = [
  ['klik', 'odaberi element'],
  ['prevuci odabrani', 'pomjeranje duž zida (uz snap na susjede)'],
  ['prevuci prazan prostor', 'rotacija pogleda (3D)'],
  ['Shift + prevuci', 'pomjeranje pogleda (pan)'],
  ['desni klik + prevuci', 'pomjeranje pogleda (pan)'],
  ['točkić', 'zoom'],
];

function Red({ k, v }) {
  return (
    <div className="flex items-start gap-3 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}>
      <kbd className="shrink-0 px-2 py-0.5 rounded text-xs"
        style={{ ...mono, background: C.paper2, border: `1px solid ${C.lineStrong}`, color: C.text, minWidth: 96, textAlign: 'center' }}>
        {k}
      </kbd>
      <span className="text-xs" style={{ color: C.dim }}>{v}</span>
    </div>
  );
}

export function ShortcutsModal({ onClose }) {
  return (
    <Modal title="Prečice" subtitle="Tastatura i miš" onClose={onClose}>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <div className="text-xs font-semibold uppercase mb-2"
            style={{ color: C.dim, letterSpacing: '0.06em' }}>Tastatura</div>
          {TASTATURA.map(([k, v]) => <Red key={k} k={k} v={v} />)}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase mb-2"
            style={{ color: C.dim, letterSpacing: '0.06em' }}>Miš</div>
          {MIS.map(([k, v]) => <Red key={k} k={k} v={v} />)}
        </div>
      </div>
      <p className="text-xs mt-4" style={{ color: C.faint }}>
        Prečice ne rade dok je otvoren dijalog ili dok je fokus u polju za unos —
        da se Backspace u tekstu ne bi pretvorio u brisanje elementa.
      </p>
    </Modal>
  );
}

export default ShortcutsModal;
