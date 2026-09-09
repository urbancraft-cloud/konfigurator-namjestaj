// src/components/app/DecorModal.jsx
import React, { useState, useRef } from 'react';
import { Plus, Check, Upload, Pencil, Search } from 'lucide-react';
import { C, mono } from '../../data/theme';
import {
  DECORS, registerDecor, TEX_FAMILY, EDGE_TYPES, PRICE_LIST,
  parseDecorCSV, applyDecorRows,
} from '../../data/decors';
import { BOARD_TYPES } from '../../data/tech';
import { Modal } from '../ui/Modal';
import { Note } from '../ui/DataDisplay';
import { Label } from '../ui/Panel';
import { Btn } from '../ui/Controls';

const CSV_PRIMJER = `šifra;naziv;struktura;porodica;debljina;cijena_m2;debljina2;cijena2
U732;Prašnjavo siva;ST9;siva;18;36,60;25;46,75
H1180;Halifax hrast natur;ST36;hrast;18;42,10`;

/** Preuzima primjer CSV formata da korisnik vidi tačan raspored kolona. */
function downloadCSVTemplate() {
  const blob = new Blob([`\uFEFF${CSV_PRIMJER}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'primjer_cjenovnik_dekora.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

export function DecorModal({ onClose, onSaved }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [struct, setStruct] = useState('ST9');
  const [fam, setFam] = useState('siva');
  const [board, setBoard] = useState([{ t: 18, p: '' }]);
  const [worktop, setWorktop] = useState([]);
  const [edge, setEdge] = useState({});
  /** Format ploče na kojoj se dekor kupuje — određuje broj ploča i iskorištenje. */
  const [boardType, setBoardType] = useState('');
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);
  /** `null` = unos novog dekora; string = šifra dekora koji se UREĐUJE. */
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');
  const fileRef = useRef(null);

  const save = () => {
    const clean = code.trim().toUpperCase();
    if (!clean) { setErr('Šifra dekora je obavezna.'); return; }
    /* Pri uređivanju postojećeg dekora šifra se ne smije mijenjati — inače bi
       nastao novi artikal, a stari ostao u bazi sa starom cijenom. */
    if (!editing && DECORS[clean]) {
      setErr(`Dekor „${clean}" već postoji. Otvorite ga kroz „Uredi postojeći" da mu izmijenite cijenu.`);
      return;
    }
    if (editing && clean !== editing) {
      setErr(`Pri uređivanju šifra se ne može mijenjati (zadano „${editing}"). Napravite novi dekor ako vam treba druga šifra.`);
      return;
    }
    if (!board.some((r) => Number(r.t) > 0 && Number(r.p) > 0)) { setErr('Unesite bar jednu debljinu sa cijenom.'); return; }
    const id = registerDecor({
      code: clean, name: name || clean, struct, fam, board, worktop, edge,
      boardType: boardType || null,
    });
    if (id) onSaved(id, editing ? 'updated' : 'added');
  };

  /** Popuni formu podacima postojećeg dekora. */
  const edit = (decorId) => {
    const d = DECORS[decorId];
    if (!d) return;
    setEditing(d.code);
    setCode(d.code);
    setName(d.shortName || '');
    setStruct(d.struct || '');
    setFam(d.fam || 'siva');
    setBoard(Object.entries(d.board || {}).map(([t, p]) => ({ t: Number(t), p: String(p) })));
    setWorktop(d.worktop ? Object.entries(d.worktop).map(([w, p]) => ({ w: Number(w), p: String(p) })) : []);
    setEdge(Object.fromEntries(Object.entries(d.edge || {}).map(([k, v]) => [k, String(v)])));
    setBoardType(d.boardType || '');
    setErr(null);
    setInfo(`Uređujete „${d.name}". Izmjena važi odmah za sve nove kalkulacije.`);
  };

  const noviUnos = () => {
    setEditing(null);
    setCode(''); setName(''); setStruct('ST9'); setFam('siva');
    setBoard([{ t: 18, p: '' }]); setWorktop([]); setEdge({}); setBoardType('');
    setErr(null); setInfo(null);
  };

  /**
   * Uvoz cjenovnika iz CSV-a.
   * `DECOR_DB` je 636 linija hardkodovanog koda — svaka izmjena cijene značila je
   * diranje izvornog koda i ponovno build-ovanje. Sada se cjenovnik može uvesti
   * iz tabele koju dobijete od dobavljača.
   */
  const importCSV = async (file) => {
    try {
      const text = await file.text();
      const { items, errors } = parseDecorCSV(text);
      if (!items.length) {
        setErr(errors.length
          ? `Nijedan red nije prihvaćen. ${errors.slice(0, 3).join(' ')}`
          : 'Datoteka ne sadrži nijedan dekor.');
        return;
      }
      const res = applyDecorRows(items);
      setInfo(`Uvezeno ${res.total} dekora (${res.added} novih, ${res.updated} izmijenjenih).`);
      setErr(errors.length ? `${errors.length} redova preskočeno: ${errors.slice(0, 3).join(' ')}` : null);
      if (onSaved) onSaved(null, 'imported', res);
    } catch (e) {
      setErr(`Datoteka se ne može pročitati: ${e && e.message ? e.message : 'nepoznata greška'}`);
    }
  };

  const needle = q.trim().toLowerCase();
  const postojeći = Object.values(DECORS)
    .filter((d) => !needle || `${d.code} ${d.shortName} ${d.struct}`.toLowerCase().indexOf(needle) >= 0)
    .slice(0, 60);
  const row = (arr, set, i, key, v) => set(arr.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  return (
    <Modal wide title="Cjenovnik dekora" onClose={onClose}
      subtitle={`Važeći cjenovnik: ${PRICE_LIST.label} · ${Object.keys(DECORS).length} dekora u bazi`}>
      {err && <Note kind="error">{err}</Note>}
      {info && <Note kind="ok">{info}</Note>}

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Btn size="sm" variant={editing ? 'ghost' : 'primary'} onClick={noviUnos}>
          <Plus size={13} /> Novi dekor
        </Btn>
        <Btn size="sm" onClick={() => fileRef.current && fileRef.current.click()}
          title="Uvezi cjenovnik iz CSV tabele (šifra;naziv;struktura;porodica;debljina;cijena…)">
          <Upload size={13} /> Uvezi CSV cjenovnik
        </Btn>
        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden"
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (f) importCSV(f);
            e.target.value = '';
          }} />
        <Btn size="sm" onClick={() => downloadCSVTemplate()} title="Preuzmi primjer CSV formata">
          Primjer CSV formata
        </Btn>
      </div>

      <div className="mb-4 rounded-xl p-3" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
        <Label>Uredi postojeći dekor</Label>
        <div className="flex items-center gap-2 mb-2">
          <Search size={13} style={{ color: C.faint }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="traži po šifri ili nazivu…"
            className="flex-1 px-2 py-1.5 text-xs rounded-lg outline-none"
            style={{ ...mono, background: C.paper2, border: `1px solid ${C.line}` }} />
        </div>
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {postojeći.map((d) => (
            <div key={d.code} className="flex items-center gap-2 px-2 py-1 rounded-lg"
              style={{ background: editing === d.code ? C.accentSoft : 'transparent' }}>
              <span className="w-4 h-4 rounded shrink-0" style={{ background: d.color, border: `1px solid ${C.line}` }} />
              <b style={{ ...mono, fontSize: 11, width: 62, flexShrink: 0 }}>{d.code}</b>
              <span className="flex-1 text-xs truncate">{d.shortName}</span>
              <span style={{ ...mono, fontSize: 11, color: C.dim }}>{d.pricePerM2} KM/m²</span>
              {d.userEdited && <span className="px-1 rounded text-xs" style={{ background: C.warnBg, color: C.warn }}>izmijenjen</span>}
              <button type="button" onClick={() => edit(d.code)} aria-label={`Uredi ${d.code}`}
                className="p-1 rounded shrink-0" style={{ background: C.paper2, color: C.dim }}>
                <Pencil size={12} />
              </button>
            </div>
          ))}
          {!postojeći.length && <div className="text-xs px-2 py-3" style={{ color: C.faint }}>nema pogodaka</div>}
        </div>
      </div>

      <div className="text-xs font-semibold uppercase mb-2" style={{ color: C.dim, letterSpacing: '0.06em' }}>
        {editing ? `Uređivanje: ${editing}` : 'Podaci dekora'}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <label className="text-xs" style={{ color: C.dim }}>Šifra
          <input value={code} disabled={!!editing} onChange={(e) => setCode(e.target.value)} placeholder="npr. U732"
            className="w-full px-2 py-2 text-sm rounded-lg outline-none"
            style={{ ...mono, background: C.paper2, border: `1px solid ${C.line}`, color: C.text }} />
        </label>
        <label className="text-xs col-span-2" style={{ color: C.dim }}>Naziv
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Prašnjavo siva"
            className="w-full px-2 py-2 text-sm rounded-lg outline-none"
            style={{ background: C.paper2, border: `1px solid ${C.line}`, color: C.text }} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="text-xs" style={{ color: C.dim }}>Struktura
          <input value={struct} onChange={(e) => setStruct(e.target.value)}
            className="w-full px-2 py-2 text-sm rounded-lg outline-none"
            style={{ ...mono, background: C.paper2, border: `1px solid ${C.line}`, color: C.text }} />
        </label>
        <label className="text-xs" style={{ color: C.dim }}>Izgled (tekstura)
          <select value={fam} onChange={(e) => setFam(e.target.value)}
            className="w-full px-2 py-2 text-sm rounded-lg outline-none"
            style={{ background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>
            {Object.keys(TEX_FAMILY).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
      </div>

      <div className="mb-3">
        <div className="text-xs mb-1.5" style={{ color: C.dim }}>
          Format ploče — određuje broj ploča i iskorištenje u planu krojenja
        </div>
        <select value={boardType} onChange={(e) => setBoardType(e.target.value)}
          className="w-full px-2 py-2 text-sm rounded-lg outline-none"
          style={{ ...mono, background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}
          aria-label="Format ploče">
          <option value="">Automatski po debljini (18 mm → iverica 2800×2070)</option>
          {BOARD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <p className="text-xs mt-1" style={{ color: C.faint }}>
          Medijapan visoki sjaj ide na format 2800×1220. Ako se ostavi „automatski",
          plan krojenja računa po 2800×2070 i daje pogrešan broj ploča.
        </p>
      </div>
      <Label>Debljine i cijena ploče (KM/m²)</Label>
      {board.map((r, i) => (
        <div key={i} className="grid grid-cols-3 gap-2 mb-2 items-center">
          <input type="number" value={r.t} onChange={(e) => row(board, setBoard, i, 't', e.target.value)}
            placeholder="mm" className="px-2 py-1.5 text-sm rounded-lg outline-none"
            style={{ ...mono, background: C.paper2, border: `1px solid ${C.line}` }} />
          <input type="number" step="0.01" value={r.p} onChange={(e) => row(board, setBoard, i, 'p', e.target.value)}
            placeholder="KM/m²" className="px-2 py-1.5 text-sm rounded-lg outline-none"
            style={{ ...mono, background: C.paper2, border: `1px solid ${C.line}` }} />
          <button onClick={() => setBoard(board.filter((_, j) => j !== i))}
            className="px-2 py-1.5 text-xs rounded-lg" style={{ background: C.dangerBg, color: C.danger }}>ukloni</button>
        </div>
      ))}
      <Btn size="sm" onClick={() => setBoard(board.concat([{ t: '', p: '' }]))}><Plus size={12} /> debljina</Btn>
      <div className="mt-4"><Label>Radna ploča 38 mm (KM/m')</Label></div>
      {worktop.map((r, i) => (
        <div key={i} className="grid grid-cols-3 gap-2 mb-2 items-center">
          <input type="number" value={r.w} onChange={(e) => row(worktop, setWorktop, i, 'w', e.target.value)}
            placeholder="širina mm" className="px-2 py-1.5 text-sm rounded-lg outline-none"
            style={{ ...mono, background: C.paper2, border: `1px solid ${C.line}` }} />
          <input type="number" step="0.01" value={r.p} onChange={(e) => row(worktop, setWorktop, i, 'p', e.target.value)}
            placeholder="KM/m'" className="px-2 py-1.5 text-sm rounded-lg outline-none"
            style={{ ...mono, background: C.paper2, border: `1px solid ${C.line}` }} />
          <button onClick={() => setWorktop(worktop.filter((_, j) => j !== i))}
            className="px-2 py-1.5 text-xs rounded-lg" style={{ background: C.dangerBg, color: C.danger }}>ukloni</button>
        </div>
      ))}
      <Btn size="sm" onClick={() => setWorktop(worktop.concat([{ w: 600, p: '' }]))}><Plus size={12} /> širina</Btn>
      <div className="mt-4"><Label>ABS trake (KM/m')</Label></div>
      <div className="grid grid-cols-2 gap-2">
        {Object.values(EDGE_TYPES).filter((e) => e.key).map((e) => (
          <label key={e.id} className="text-xs" style={{ color: C.dim }}>{e.name}
            <input type="number" step="0.01" value={edge[e.key] || ''}
              onChange={(ev) => setEdge({ ...edge, [e.key]: ev.target.value })}
              className="w-full px-2 py-1.5 text-sm rounded-lg outline-none"
              style={{ ...mono, background: C.paper2, border: `1px solid ${C.line}` }} />
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Btn onClick={onClose}>Zatvori</Btn>
        <Btn variant="primary" onClick={save}>
          <Check size={14} /> {editing ? 'Sačuvaj izmjene' : 'Dodaj dekor'}
        </Btn>
      </div>
    </Modal>
  );
}