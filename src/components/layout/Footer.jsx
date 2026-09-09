// src/components/layout/Footer.jsx
import React from 'react';
import { C, mono } from '../../data/theme';
import { fmt } from '../../utils/formatters';

export function Footer({ bom, totals, materialMode, draftSavedAt }) {
  return (
    <footer className="flex items-center justify-between px-4 py-2 shrink-0 text-xs"
      style={{ background: C.paper, borderTop: `1px solid ${C.line}` }}>
      <div className="flex gap-5" style={{ color: C.dim }}>
        <span>panela <b style={{ ...mono, color: C.text }}>{bom.rows.reduce((s, r) => s + r.qty, 0)}</b></span>
        <span>kant <b style={{ ...mono, color: C.text }}>{Object.values(bom.bandTotals).reduce((a, b) => a + b, 0).toFixed(1)} m</b></span>
        <span>ploča <b style={{ ...mono, color: C.text }}>{Object.values(bom.boardTotals).reduce((a, b) => a + b, 0).toFixed(2)} m²</b></span>
        <span>lajsne <b style={{ ...mono, color: C.text }}>{Object.values(bom.profileMeters).reduce((a, b) => a + b, 0).toFixed(2)} m</b></span>
      </div>
      <div className="flex items-center gap-5" style={{ color: C.dim }}>
        {draftSavedAt ? (
          <span
            title={'Nacrt se automatski čuva u ovom pregledniku 2,5 s nakon svake izmjene. Za prenos na drugi računar koristite dugme „Izvezi".'}
            style={{ color: C.faint }}>
            nacrt sačuvan {new Date(draftSavedAt).toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : null}
        {materialMode === 'ploce' && totals.sheets && (
          <span title="Obračunato po potrošenim pločama (grupa manja od cijele ploče računa se kao pola ploče)">
            ploča <b style={{ ...mono, color: C.text }}>{totals.sheets.chargedSheets}</b>
            {' · '}iskor. <b style={{ ...mono, color: C.text }}>{totals.sheets.summary.utilization}%</b>
          </span>
        )}
        <span>osnovica <b style={{ ...mono, color: C.text }}>{fmt(totals.net)} KM</b></span>
        <span>PDV 17% <b style={{ ...mono, color: C.text }}>{fmt(totals.vat)} KM</b></span>
        <span className="px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.accent, color: '#fff' }}>
          {fmt(totals.gross)} KM
        </span>
      </div>
    </footer>
  );
}