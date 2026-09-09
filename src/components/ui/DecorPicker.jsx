// src/components/ui/DecorPicker.jsx
import React, { useState, useRef, useEffect, useId } from 'react';
import { Search } from 'lucide-react';
import { C, mono } from '../../data/theme';
import { DECORS, boardPriceOf } from '../../data/decors';
import { fmt } from '../../utils/formatters';

/**
 * Izbor dekora sa pretragom.
 *
 * Pristupačnost: ranije je ovo bio `<button>` + lista `<button>`-a bez ikakvih
 * ARIA uloga — čitač ekrana nije mogao reći da je riječ o listi opcija, niti
 * koja je izabrana. Nije se moglo ni upravljati tastaturom (samo Tab kroz svih
 * ~200 dekora), a lista je ostajala otvorena nakon klika van nje i prekrivala
 * kontrole ispod.
 *
 * Sada: `combobox` + `listbox` + `option` sa `aria-selected`, navigacija
 * strelicama, Enter za odabir, Esc i klik van za zatvaranje.
 */
export function DecorPicker({ label, value, onChange, filter, hint }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(-1);
  const rootRef = useRef(null);
  const uid = useId();
  const listId = `dekori-${uid}`;

  const list = Object.values(DECORS).filter((d) => (filter ? filter(d) : true));
  const needle = q.trim().toLowerCase();
  const hits = needle
    ? list.filter((d) => (`${d.code} ${d.shortName} ${d.struct}`).toLowerCase().indexOf(needle) >= 0)
    : list;
  const sel = DECORS[value];

  const pick = (id) => { onChange(id); setOpen(false); setActive(-1); };

  /* Klik van komponente i Esc zatvaraju listu. */
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onEsc, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onEsc, true);
    };
  }, [open]);

  const onSearchKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(hits.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && active >= 0 && hits[active]) {
      e.preventDefault();
      pick(hits[active].id);
    }
  };

  const btnStyle = (i, d) => ({
    background: d.id === value ? C.accentSoft : (i === active ? C.paper3 : 'transparent'),
  });

  return (
    <div className="mb-3" ref={rootRef}>
      {label && <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>{label}</div>}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setQ(''); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label ? `${label}: ${sel ? `${sel.code} ${sel.shortName}` : 'nije odabran'}` : undefined}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg text-left"
        style={{ background: C.paper2, border: `1px solid ${open ? C.accent : C.line}`, color: C.text }}>
        <span className="w-4 h-4 rounded shrink-0" aria-hidden="true"
          style={{ background: sel ? sel.color : C.line, border: `1px solid ${C.line}` }} />
        <span className="flex-1 min-w-0 truncate">
          {sel ? <><b style={mono}>{sel.code}</b> {sel.shortName}</> : 'odaberi dekor'}
        </span>
        <Search size={13} aria-hidden="true" style={{ color: C.faint }} />
      </button>

      {open && (
        <div className="mt-1.5 rounded-lg overflow-hidden" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <input
            autoFocus value={q}
            onChange={(e) => { setQ(e.target.value); setActive(-1); }}
            onKeyDown={onSearchKey}
            placeholder="traži po šifri ili nazivu…"
            aria-label="Pretraga dekora"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={active >= 0 && hits[active] ? `${listId}-opt-${active}` : undefined}
            className="w-full px-2.5 py-2 text-sm outline-none"
            style={{ background: C.paper2, borderBottom: `1px solid ${C.line}`, color: C.text }} />
          <div className="max-h-56 overflow-y-auto" id={listId} role="listbox" aria-label={label || 'Dekori'}>
            {hits.map((d, i) => (
              <button
                type="button"
                key={d.id}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={d.id === value}
                onClick={() => pick(d.id)}
                onMouseEnter={() => setActive(i)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left"
                style={btnStyle(i, d)}>
                <span className="w-4 h-4 rounded shrink-0" aria-hidden="true"
                  style={{ background: d.color, border: `1px solid ${C.line}` }} />
                <b style={{ ...mono, width: 58 }}>{d.code}</b>
                <span className="flex-1 truncate">{d.shortName}</span>
                <span style={{ ...mono, color: C.faint }}>{d.struct}</span>
                <span style={{ ...mono, color: C.dim }}>{fmt(boardPriceOf(d.id, 18))}</span>
                {d.custom && (
                  <span className="px-1 rounded" style={{ background: C.accentSoft, color: C.accentText }}>
                    {d.userEdited ? 'izmijenjen' : 'novi'}
                  </span>
                )}
              </button>
            ))}
            {!hits.length && (
              <div className="px-2.5 py-3 text-xs" style={{ color: C.faint }}>nema pogodaka za „{q}”</div>
            )}
          </div>
        </div>
      )}
      {hint && <p className="text-xs mt-1" style={{ color: C.faint }}>{hint}</p>}
    </div>
  );
}

export default DecorPicker;
