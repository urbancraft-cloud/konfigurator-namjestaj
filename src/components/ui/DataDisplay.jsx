// src/components/ui/DataDisplay.jsx
import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { C, mono } from '../../data/theme';

export function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span style={{ color: C.dim }}>{label}</span>
      <span style={{ ...mono, color: tone || C.text, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export function Note({ kind, children }) {
  const st = kind === 'error' ? { background: C.dangerBg, color: C.danger }
    : kind === 'ok' ? { background: C.okBg, color: C.ok }
    : { background: C.warnBg, color: C.warn };
  return (
    <div className="flex gap-2 items-start px-2.5 py-2 mb-1.5 text-xs rounded-lg" style={st}>
      {kind === 'ok' ? <Check size={13} className="shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="shrink-0 mt-0.5" />}
      <span>{children}</span>
    </div>
  );
}

export function Stat({ label, value, accent }) {
  return (
    <div className="px-3 py-2.5 rounded-xl" style={{ background: accent ? C.accentSoft : C.paper2, border: `1px solid ${accent ? C.accentSoft : C.line}` }}>
      <div className="text-xs mb-0.5" style={{ color: accent ? C.accentText : C.dim }}>{label}</div>
      <div className="text-base font-semibold" style={{ ...mono, color: accent ? C.accentText : C.text }}>{value}</div>
    </div>
  );
}