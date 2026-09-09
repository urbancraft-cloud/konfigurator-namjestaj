// src/components/ui/Modal.jsx
import React, { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { C } from '../../data/theme';

/**
 * Modalni dijalog.
 *
 * BUG-23: ranije je ovo bio samo `<div className="fixed inset-0">` sa sadržajem —
 * bez zatvaranja na Esc, bez klika van dijaloga, bez zaključavanja skrola pozadine
 * i bez ikakvih ARIA atributa. Tastatura i čitači ekrana nisu mogli niti zatvoriti
 * dijalog niti znati da je otvoren.
 */
export function Modal({ title, subtitle, children, onClose, wide, dismissable = true }) {
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);

  // Esc zatvara dijalog
  const onKey = useCallback((e) => {
    if (e.key === 'Escape' && dismissable) {
      e.stopPropagation();
      onClose();
      return;
    }
    // Jednostavan focus-trap: Tab ostaje unutar dijaloga
    if (e.key === 'Tab' && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const items = Array.prototype.filter.call(focusable, (n) => !n.disabled && n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, [onClose, dismissable]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    document.addEventListener('keydown', onKey, true);

    // Zaključaj skrol pozadine dok je dijalog otvoren
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    // Premjesti fokus u dijalog
    const t = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const prvi = panel.querySelector('input:not([type=hidden]), textarea, select, button');
      if (prvi) prvi.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKey, true);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
      clearTimeout(t);
      if (restoreFocusRef.current && restoreFocusRef.current.focus) {
        try { restoreFocusRef.current.focus(); } catch { /* element je uklonjen */ }
      }
    };
  }, [onKey]);

  const onBackdrop = (e) => {
    if (!dismissable) return;
    // Zatvori samo ako je kliknut sam overlay, ne sadržaj unutar njega
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(15,23,42,0.45)' }}
      onPointerDown={onBackdrop}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`w-full ${wide ? 'max-w-6xl' : 'max-w-2xl'} max-h-full overflow-y-auto`}
        style={{ background: C.bg, borderRadius: 18, boxShadow: '0 24px 60px rgba(15,23,42,0.28)' }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 sticky top-0 z-10"
          style={{ background: C.paper, borderBottom: `1px solid ${C.line}`, borderRadius: '18px 18px 0 0' }}>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            {subtitle && <div className="text-xs" style={{ color: C.faint }}>{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Zatvori"
            className="p-1.5 rounded-lg" style={{ background: C.paper2 }}>
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
