// src/components/ui/Controls.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { C, mono } from '../../data/theme';

export function Btn({ children, onClick, variant = 'ghost', size = 'md', full,
                       disabled = false, title, ariaLabel, type = 'button' }) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium transition-colors';
  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-xs rounded-lg' : 'px-3 py-2 text-sm rounded-lg';
  const st = variant === 'primary'
    ? { background: C.accent, color: '#fff' }
    : variant === 'dark'
    ? { background: C.ink, color: '#fff' }
    : variant === 'danger'
    ? { background: C.dangerBg, color: C.danger }
    : { background: C.paper, color: C.text, border: `1px solid ${C.line}` };
  if (disabled) {
    st.opacity = 0.45;
    st.cursor = 'not-allowed';
  }
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled}
      title={title} aria-label={ariaLabel} aria-disabled={disabled || undefined}
      className={`${base} ${pad} ${full ? 'w-full' : ''}`} style={st}>{children}</button>
  );
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="inline-flex p-1 rounded-xl" role="radiogroup"
      style={{ background: C.paper3, border: `1px solid ${C.line}` }}>
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          style={value === o.value
            ? { background: C.paper, color: C.text, boxShadow: '0 1px 2px rgba(15,23,42,0.08)' }
            : { background: 'transparent', color: C.dim }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ label, value, options, onChange }) {
  return (
    <div className="mb-3">
      {label && <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>{label}</div>}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg outline-none appearance-none"
        style={{ background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>
        {options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/**
 * Numerički input sa sliderom.
 *
 * Prije je `onChange` slao `Number(e.target.value)` direktno u store. To znači:
 *   - korisnik obriše broj da upiše novi → `Number("") === 0` → `room.width = 0`
 *     → `wallLength = 0` → geometrija crta besmislice ili puca;
 *   - upiše nešto što nije broj → `NaN` → `NaN` se propagira u cijene i u ponudi
 *     se ispiše "NaN KM".
 *
 * Sada se vrijednost drži u lokalnom "draft" stanju dok korisnik kuca, a u store
 * ide tek kad je broj konačan i unutar granica. Vanjske promjene (npr. drugo polje
 * koje povlači isto stanje) i dalje se sinhronizuju nazad u draft.
 */
export function NumberInput({ value, min, max, step, onChange, ariaLabel }) {
  const safeMax = Math.max(min, max);
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(Number.isFinite(value) ? String(value) : '');
  }, [value, focused]);

  const commit = useCallback((raw) => {
    if (raw === '') return;                                  // prazno = još kuca
    const n = Number(raw);
    if (!Number.isFinite(n)) return;                          // "abc" = ignoriši
    onChange(Math.min(safeMax, Math.max(min, n)));            // clamp u granice
  }, [min, safeMax, onChange]);

  return (
    <input
      type="number" min={min} max={safeMax} step={step}
      value={draft} aria-label={ariaLabel}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { setFocused(false); commit(e.target.value); }}
      onChange={(e) => { setDraft(e.target.value); commit(e.target.value); }}
      className="w-12 bg-transparent text-right text-xs font-medium outline-none"
      style={{ ...mono, color: C.text }}
    />
  );
}

export function Field({ label, value, min, max, step, unit, onChange, strong }) {
  const safeMax = Math.max(min, max);
  const sliderValue = Number.isFinite(value)
    ? Math.min(safeMax, Math.max(min, value))
    : min;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium" style={{ color: strong ? C.text : C.dim }}>{label}</span>
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
          <NumberInput value={value} min={min} max={safeMax} step={step}
            onChange={onChange} ariaLabel={label} />
          <span className="text-xs" style={{ color: C.faint }}>{unit}</span>
        </div>
      </div>
      <input type="range" min={min} max={safeMax} step={step} value={sliderValue}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label ? `${label} (kliznik)` : undefined}
        className="w-full" style={{ accentColor: C.accent }} />
    </div>
  );
}
