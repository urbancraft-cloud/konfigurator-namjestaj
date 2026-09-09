// src/components/app/OfferModal.jsx
import React from 'react';
import { Printer } from 'lucide-react';
import { C, mono, card } from '../../data/theme';
import { decorById } from '../../data/decors';
import { WASTE_FACTOR } from '../../data/tech';
import { templateById } from '../../data/catalog';
import { computePrice } from '../../engine/pricing';
import { fmt } from '../../utils/formatters';
import { Modal } from '../ui/Modal';
import { Row } from '../ui/DataDisplay';
import { Btn } from '../ui/Controls';
import { printOffer } from '../../utils/exportImport';
import { useUiStore } from '../../store/uiStore';

export function OfferModal({ project, room, totals, onClose }) {
  const flash = useUiStore((s) => s.flash);

  /**
   * Štampanje / izvoz u PDF preko sistemskog dijaloga. Bez biblioteke za PDF:
   * radi u svakom pregledniku, ne vuče ~500 kB, a prelom je za A4.
   */
  const stampaj = () => {
    const rows = project.elements.map((el, i) => {
      const t = templateById(el.templateId);
      return {
        pos: `${t.short}${i + 1}`,
        element: `${t.name} · ${decorById(el.corpus.decorId).name} / front ${decorById(el.front.decorId).name}`,
        dims: `${el.dims.width}×${el.dims.height}×${el.dims.depth}`,
        net: computePrice(el, project).net,
      };
    });
    const res = printOffer({ project, room, totals, rows });
    if (!res.ok) flash(res.reason);
  };

  return (
    <Modal title="Ponuda za kupca" onClose={onClose}
      subtitle={`${project.name} · prostorija ${room.width}×${room.depth}×${room.height} mm`}>
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
        <table className="w-full text-xs">
          <thead style={{ background: C.paper3, color: C.dim }}>
            <tr>
              <th className="text-left px-3 py-2 font-medium">Poz</th>
              <th className="text-left px-3 py-2 font-medium">Element</th>
              <th className="text-right px-3 py-2 font-medium">Dimenzije</th>
              <th className="text-right px-3 py-2 font-medium">Cijena</th>
            </tr>
          </thead>
          <tbody>
            {project.elements.map((el, i) => {
              const t = templateById(el.templateId);
              const p = computePrice(el, project);
              return (
                <tr key={el.instanceId} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-3 py-2" style={mono}>{t.short}{i + 1}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{t.name}</span>
                    <span className="block" style={{ color: C.faint }}>
                      {decorById(el.corpus.decorId).name} / front {decorById(el.front.decorId).name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right" style={mono}>{el.dims.width}×{el.dims.height}×{el.dims.depth}</td>
                  <td className="px-3 py-2 text-right font-medium" style={mono}>{fmt(p.net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={card} className="p-3 mb-3">
        {Object.entries(totals.parts).map(([k, v]) => <Row key={k} label={k} value={`${fmt(v)} KM`} />)}
      </div>
      <div style={card} className="p-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span style={{ color: C.dim }}>Osnovica</span><span style={mono}>{fmt(totals.net)} KM</span>
        </div>
        <div className="flex items-center justify-between text-sm mb-2">
          <span style={{ color: C.dim }}>PDV 17%</span><span style={mono}>{fmt(totals.vat)} KM</span>
        </div>
        <div className="flex items-center justify-between pt-2" style={{ borderTop: `2px solid ${C.ink}` }}>
          <span className="text-base font-semibold">Za uplatu</span>
          <span className="text-xl font-semibold" style={mono}>{fmt(totals.gross)} KM</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 mt-3">
        <p className="text-xs" style={{ color: C.faint }}>
          Cijena je informativna, sa koeficijentom otpada {WASTE_FACTOR}. Konačnu daje
          optimizacija krojenja u pogonu.
        </p>
        <Btn variant="primary" size="sm" onClick={stampaj} title="Otvori verziju za štampu (Ctrl+P → Sačuvaj kao PDF)">
          <Printer size={13} /> Štampaj / PDF
        </Btn>
      </div>
    </Modal>
  );
}