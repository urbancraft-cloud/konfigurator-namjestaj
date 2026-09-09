// src/components/wardrobe/WardrobeFooter.jsx
import React from 'react';
import { C, mono } from '../../data/theme';
import { fmt } from '../../utils/formatters';

export function WardrobeFooter({ price }) {
  return (
    <footer className="flex items-center justify-between px-4 py-2 shrink-0 text-xs"
      style={{ background: C.paper, borderTop: `1px solid ${C.line}` }}>
      <div className="flex gap-5" style={{ color: C.dim }}>
        <span>ladica <b style={{ ...mono, color: C.text }}>{price.meta.drawerCount}</b></span>
        <span>šipke <b style={{ ...mono, color: C.text }}>{price.meta.railCount}</b></span>
        <span>police <b style={{ ...mono, color: C.text }}>{price.meta.shelfCount}</b></span>
        <span>nogice <b style={{ ...mono, color: C.text }}>{price.meta.legCount}</b></span>
        <span>ploča <b style={{ ...mono, color: C.text }}>{price.meta.corpusBoardM2.toFixed(2)} m²</b></span>
      </div>
      <div className="flex items-center gap-5" style={{ color: C.dim }}>
        <span>osnovica <b style={{ ...mono, color: C.text }}>{fmt(price.net)} KM</b></span>
        <span>PDV 17% <b style={{ ...mono, color: C.text }}>{fmt(price.vat)} KM</b></span>
        <span className="px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.accent, color: '#fff' }}>
          {fmt(price.gross)} KM
        </span>
      </div>
    </footer>
  );
}
