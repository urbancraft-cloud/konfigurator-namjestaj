// src/components/ui/Panel.jsx
import React from 'react';
import { C, card } from '../../data/theme';

export function Panel({ title, action, children, tight }) {
  return (
    <section className="mb-3" style={card}>
      {title && (
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <h3 className="text-xs font-semibold uppercase" style={{ color: C.dim, letterSpacing: '0.06em' }}>{title}</h3>
          {action}
        </div>
      )}
      <div className={tight ? 'px-3 pb-3' : 'px-3 pb-3'}>{children}</div>
    </section>
  );
}

export function Label({ children }) {
  return <div className="text-xs font-semibold uppercase mb-2" style={{ color: C.dim, letterSpacing: '0.06em' }}>{children}</div>;
}