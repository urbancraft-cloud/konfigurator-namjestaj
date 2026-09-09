// src/components/ErrorBoundary.jsx
// Hvata greške u renderu i životnom ciklusu bilo koje komponente ispod sebe.
//
// Bez ovoga je svaki `TypeError` u engine-u (nepoznat dekor, stari sačuvani
// projekat, nedostajuće polje) značio bijeli ekran bez ijedne riječi objašnjenja —
// a projekat je ostao netaknut u localStorage-u, pa je korisnik mislio da je
// izgubio podatke. Sada se greška prikaže, može se kopirati, i može se pokušati
// ponovo bez gubljenja stanja.

import React from 'react';

const S = {
  wrap: { minHeight: '100vh', background: '#F1F5F9', color: '#0F172A',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16,
    padding: 28, maxWidth: 680, width: '100%' },
  badge: { display: 'inline-block', background: '#FEE2E2', color: '#B91C1C',
    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, marginBottom: 12 },
  h1: { fontSize: 19, fontWeight: 600, margin: '0 0 8px' },
  p: { fontSize: 14, color: '#64748B', margin: '0 0 16px', lineHeight: 1.55 },
  pre: { fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 12, borderRadius: 10,
    overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 },
  row: { display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' },
  btn: { padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
    border: '1px solid #CBD5E1', background: '#fff', color: '#0F172A', cursor: 'pointer' },
  btnPrimary: { padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
    border: '1px solid #0D9488', background: '#0D9488', color: '#fff', cursor: 'pointer' },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 14, lineHeight: 1.5 },
};

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error('[Konfigurator] Greška u renderu:', error, info?.componentStack);
  }

  handleCopy = () => {
    const text = `${this.state.error?.message || this.state.error}\n\n${this.state.info?.componentStack || ''}`;
    const done = () => this.setState({ copied: true }, () => setTimeout(() => this.setState({ copied: false }), 2000));
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch { /* ignoriši */ }
      document.body.removeChild(ta);
    }
  };

  handleReload = () => {
    // Projekat je u localStorage-u, reload ne gubi podatke.
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ error: null, info: null });
  };

  render() {
    const { error, info, copied } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={S.wrap}>
        <div style={S.card}>
          <span style={S.badge}>Greška u prikazu</span>
          <h1 style={S.h1}>Konfigurator je naišao na neočekivanu grešku</h1>
          <p style={S.p}>
            Sačuvani projekti <b>nisu izgubljeni</b> — nalaze se u memoriji preglednika.
            Pokušajte ponovo; ako se greška vraća pri učitavanju projekta, taj projekat je
            sačuvan sa starijom verzijom kataloga ili cjenovnika.
          </p>
          <pre style={S.pre}>{String(error?.message || error)}</pre>
          <div style={S.row}>
            <button type="button" style={S.btnPrimary} onClick={this.handleReset}>Pokušaj ponovo</button>
            <button type="button" style={S.btn} onClick={this.handleReload}>Ponovo učitaj stranicu</button>
            <button type="button" style={S.btn} onClick={this.handleCopy}>
              {copied ? 'Kopirano ✓' : 'Kopiraj grešku'}
            </button>
          </div>
          {info?.componentStack ? (
            <details style={{ marginTop: 14 }}>
              <summary style={{ fontSize: 12, color: '#64748B', cursor: 'pointer' }}>
                Komponenta u kojoj je greška nastala
              </summary>
              <pre style={{ ...S.pre, marginTop: 8 }}>{info.componentStack}</pre>
            </details>
          ) : null}
          <p style={S.hint}>
            Tip greške: <code>{error?.name || 'Error'}</code>
            {' · '}Ako se ovo ponavlja, kopirajte poruku i pošaljite je uz opis koraka koji su je izazvali.
          </p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
