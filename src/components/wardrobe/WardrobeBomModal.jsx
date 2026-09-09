// src/components/wardrobe/WardrobeBomModal.jsx
import React, { useMemo } from 'react';
import { C, mono } from '../../data/theme';
import { Modal } from '../ui/Modal';
import { Stat } from '../ui/DataDisplay';
import { computeWardrobeBOM } from '../../engine/wardrobePricing';
import { upperCorpusHeightMm, lowerCorpusHeightMm, segmentWidthMm } from '../../engine/wardrobeLayout';
import { Note } from '../ui/DataDisplay';

export function WardrobeBomModal({ wardrobe, onClose }) {
  const bom = useMemo(() => computeWardrobeBOM(wardrobe), [wardrobe]);
  const totalPieces = bom.rows.reduce((s, r) => s + r.qty, 0);
  const totalArea = bom.rows.reduce((s, r) => s + (r.areaM2 || 0), 0);
  const upperH = Math.round(upperCorpusHeightMm(wardrobe));
  const lowerH = Math.round(lowerCorpusHeightMm(wardrobe));
  const segW = Math.round(segmentWidthMm(wardrobe));

  return (
    <Modal title="Krojna lista — ormar" wide onClose={onClose}
      subtitle={'Mjere su iz konstrukcijskog modela (nogice → donji korpus → gornji korpus → gornja maska; bočne maske van korpusa, pune visine prostora). Za finalnu proizvodnju provjeriti stvarne dimenzije okova.'}>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <Stat label="Ukupno panela" value={totalPieces} accent />
        <Stat label="Neto površina" value={`${totalArea.toFixed(2)} m²`} />
        <Stat label="Segmenata" value={`${wardrobe.segmentCount} × ${segW} mm`} />
        <Stat label="Donji / gornji korpus" value={`${lowerH} / ${upperH} mm`} />
      </div>
      {(bom.notes || []).map((n, i) => <Note key={i} kind="warn">{n}</Note>)}
      <div className="rounded-xl overflow-hidden" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-xs" style={mono}>
            <thead className="sticky top-0" style={{ background: C.paper3 }}>
              <tr style={{ color: C.dim }}>
                {['Poz', 'Panel', 'Kom', 'Kroj D (mm)', 'Kroj Š (mm)', 'm²', 'Materijal'].map((h) => (
                  <th key={h} className="text-left px-2.5 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bom.rows.map((r) => (
                <tr key={r.pos} style={{ borderTop: `1px solid ${C.line}`, background: r.pos % 2 ? C.paper2 : C.paper }}>
                  <td className="px-2.5 py-1.5">{r.pos}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap">{r.role}</td>
                  <td className="px-2.5 py-1.5">{r.qty}</td>
                  <td className="px-2.5 py-1.5">{r.cutL}</td>
                  <td className="px-2.5 py-1.5">{r.cutW}</td>
                  <td className="px-2.5 py-1.5 text-right">{(r.areaM2 || 0).toFixed(2)}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap" style={{ color: C.dim }}>{r.material}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(bom.hardware || []).length > 0 && (
        <div className="mt-4 rounded-xl overflow-hidden" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <div className="px-3 py-2 text-xs font-semibold uppercase"
            style={{ background: C.paper3, color: C.dim, letterSpacing: '0.06em' }}>Okov</div>
          <table className="w-full text-xs" style={mono}>
            <tbody>
              {bom.hardware.map((h, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.line}`, background: i % 2 ? C.paper2 : C.paper }}>
                  <td className="px-2.5 py-1.5 whitespace-nowrap">{h.role}</td>
                  <td className="px-2.5 py-1.5 text-right font-semibold">{h.qty} kom</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap" style={{ color: C.faint }}>{h.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-2.5 py-2 text-xs" style={{ color: C.faint }}>
            Okov nije pločni materijal i ne ulazi u krojne mjere iznad.
          </p>
        </div>
      )}
    </Modal>
  );
}
