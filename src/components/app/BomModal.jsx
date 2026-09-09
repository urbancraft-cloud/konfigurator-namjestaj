// src/components/app/BomModal.jsx
import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Check, Copy, Download, Layers, AlertTriangle } from 'lucide-react';
import { C, mono, card } from '../../data/theme';
import { EDGE_TYPES } from '../../data/decors';
import { PROFILES } from '../../data/profiles';
import { bomToCSV } from '../../engine/bom';
import { optimizeCutList, summarizePlan, planToCSV } from '../../engine/cutting';
import { downloadCSV } from '../../utils/exportImport';
import { Modal } from '../ui/Modal';
import { Stat, Row, Note } from '../ui/DataDisplay';
import { Label } from '../ui/Panel';
import { Segmented, Btn } from '../ui/Controls';

export function BomModal({ bom, onClose, projectName }) {
  const csv = useMemo(() => bomToCSV(bom), [bom]);
  const plan = useMemo(() => optimizeCutList(bom), [bom]);
  const planSum = useMemo(() => summarizePlan(plan), [plan]);
  const planCsv = useMemo(() => planToCSV(plan), [plan]);
  const ta = useRef(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(null);
  const [filter, setFilter] = useState('sve');
  /**
   * `document.execCommand('copy')` je deprecated i u dijelu preglednika
   * (posebno izvan korisničke geste ili u iframe-u) tiho ne radi — dugme bi
   * pokazalo „Kopirano" a clipboard bi ostao prazan. Sada ide preko
   * Async Clipboard API-ja, sa starom metodom kao rezervom i sa stvarnom
   * provjerom uspjeha.
   */
  const markCopied = useCallback(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const copy = useCallback(async () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(csv);
        markCopied();
        setCopyError(null);
        return;
      } catch { /* nastavi na rezervnu metodu */ }
    }
    const t = ta.current;
    if (!t) { setCopyError('Kopiranje nije dostupno u ovom pregledniku.'); return; }
    t.style.display = 'block';
    t.select();
    let uspjelo = false;
    try { uspjelo = document.execCommand('copy'); } catch { uspjelo = false; }
    t.style.display = 'none';
    if (uspjelo) { markCopied(); setCopyError(null); }
    else setCopyError('Preglednik je odbio pristup clipboardu — označite tekst ručno (Ctrl+A u polju ispod).');
  }, [csv, markCopied]);
  const rows = bom.rows.filter((r) => filter === 'sve' || (filter === 'paneli' ? !r.surface : !!r.surface));
  return (
    <Modal title="Krojna lista i specifikacija" wide onClose={onClose}
      subtitle="Kanterica sa predglodalom — krojna mjera je jednaka gotovoj">
      <div className="grid grid-cols-4 gap-3 mb-3">
        <Stat label="Panela" value={bom.rows.reduce((s, r) => s + r.qty, 0)} />
        <Stat label="Rubna traka" value={`${Object.values(bom.bandTotals).reduce((a, b) => a + b, 0).toFixed(1)} m`} />
        <Stat label="Neto površina" value={`${Object.values(bom.boardTotals).reduce((a, b) => a + b, 0).toFixed(2)} m²`} />
        <Stat label="Alu lajsne" value={`${Object.values(bom.profileMeters).reduce((a, b) => a + b, 0).toFixed(2)} m`} accent />
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <Stat label="Radna ploča" value={`${(bom.worktop.lengthMm / 1000).toFixed(2)} m / ${bom.worktop.pieces.length}`} />
        <Stat label="Zidna obloga" value={`${(bom.wallPanel.lengthMm / 1000).toFixed(2)} m / ${bom.wallPanel.pieces.length}`} />
        <Stat label="Coklo" value={`${(bom.socle.lengthMm / 1000).toFixed(2)} m / ${bom.socle.pieces.length}`} />
        <Stat label="Gornja maska" value={`${(bom.topMask.lengthMm / 1000).toFixed(2)} m / ${bom.topMask.pieces.length}`} />
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <Stat label="Završne maske" value={`${bom.endPanels.pieces.length} kom`} accent />
        <Stat label="Površina maski" value={`${bom.endPanels.areaM2.toFixed(2)} m²`} />
        <Stat label="LED maska" value={`${(bom.ledMask.lengthMm / 1000).toFixed(2)} m / ${bom.ledMask.pieces.length}`} />
      </div>
      <div className="flex items-center justify-between mb-2">
        <Segmented value={filter} onChange={setFilter} options={[
          { value: 'sve', label: 'Sve' }, { value: 'paneli', label: 'Paneli' }, { value: 'povrsine', label: 'Ploče i obloge' },
        ]} />
        <div className="flex items-center gap-2">
          {copyError && <span className="text-xs" style={{ color: C.danger }}>{copyError}</span>}
          <Btn onClick={copy} size="sm" title="Kopiraj CSV u clipboard">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Kopirano' : 'Kopiraj CSV'}
          </Btn>
          <Btn variant="primary" size="sm" title="Preuzmi krojnu listu kao .csv datoteku"
            onClick={() => downloadCSV(csv, `krojna_lista_${projectName || 'projekat'}`)}>
            <Download size={13} /> Preuzmi CSV
          </Btn>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-xs" style={mono}>
            <thead className="sticky top-0" style={{ background: C.paper3 }}>
              <tr style={{ color: C.dim }}>
                {['Poz', 'Element', 'Panel', 'Kom', 'Materijal', 'Deb', 'Kroj D', 'Kroj Š', 'Kant L1/L2/W1/W2', 'Tekstura'].map((h) => (
                  <th key={h} className="text-left px-2.5 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ background: r.surface ? C.accentSoft : (i % 2 ? C.paper2 : C.paper), borderTop: `1px solid ${C.line}` }}>
                  <td className="px-2.5 py-1.5">{r.pos}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap">{r.element}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap">{r.role}</td>
                  <td className="px-2.5 py-1.5">{r.qty}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap">{r.material}</td>
                  <td className="px-2.5 py-1.5">{r.thickness}</td>
                  <td className="px-2.5 py-1.5 font-semibold">{r.cutL}</td>
                  <td className="px-2.5 py-1.5 font-semibold">{r.cutW}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap" style={{ color: C.dim }}>
                    {r.surface ? '—' : [r.edges.L1, r.edges.L2, r.edges.W1, r.edges.W2].map((e) => (e ? '1' : '0')).join(' / ')}
                  </td>
                  <td className="px-2.5 py-1.5" style={{ color: r.rotationAllowed ? C.faint : C.warn }}>
                    {r.rotationAllowed ? 'slobodno' : 'zaključano'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Optimizacija krojenja ---------- */}
      <div className="mb-4 rounded-xl p-3" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Layers size={14} style={{ color: C.accentText }} />
            <span className="text-xs font-semibold uppercase" style={{ color: C.dim, letterSpacing: '0.06em' }}>
              Optimizacija krojenja
            </span>
          </div>
          <Btn size="sm" title="Preuzmi plan krojenja po pločama (CSV)"
            onClick={() => downloadCSV(planCsv, `plan_krojenja_${projectName || 'projekat'}`)}>
            <Download size={13} /> Plan (CSV)
          </Btn>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-3">
          <Stat label="Ploča ukupno" value={planSum.sheets} accent />
          <Stat label="Iskorištenje" value={`${planSum.utilization}%`} />
          <Stat label="Otpad" value={`${planSum.wasteM2} m²`} />
          <Stat label="Formata" value={planSum.groups} />
        </div>

        {planSum.unfit > 0 && (
          <Note kind="warn">
            {planSum.unfit} komad(a) je duže od najvećeg dostupnog formata ploče i ne može
            se krojiti iz standardne ploče — naručuje se posebno ili se spoj planira ručno.
          </Note>
        )}

        {/* Stvarni otpad umjesto paušalnog koeficijenta. Ovo je poslovno najvažniji
            broj na ovoj kartici: cijena u ponudi koristi WASTE_FACTOR (1,15), ali
            ploča se ne može dijeliti između različitih dekora, pa svaka grupa sa
            par sitnih komada (završne maske, LED maska, coklo) troši cijelu ploču. */}
        {planSum.sheets > 0 && (
          <Note kind={planSum.utilization < 60 ? 'warn' : 'ok'}>
            Stvarno iskorištenje ploča je <b>{planSum.utilization}%</b> (otpad {planSum.wasteM2} m²
            od {planSum.sheetAreaM2} m²). Cijena u ponudi računa materijal po neto površini
            panela sa koeficijentom otpada 1,15 — ako je stvarno iskorištenje znatno niže,
            razliku treba uračunati u cijenu ili spojiti grupe u isti dekor.
          </Note>
        )}

        <p className="text-xs mb-2" style={{ color: C.faint }}>
          Rezovi su pravi (guillotine), pa se plan može izvesti na klasičnoj krojnoj pili.
          Paneli sa teksturom drveta se ne rotiraju — šara ide u istom smjeru.
          Razmak između panela je širina lista pile ({plan[0] ? plan[0].kerfMm : 4} mm).
        </p>

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {plan.map((g) => (
            <div key={g.key} className="rounded-lg p-2.5" style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="text-xs font-medium truncate" style={{ color: C.text }}>{g.material}</span>
                <span className="text-xs shrink-0" style={{ ...mono, color: C.dim }}>
                  {g.thicknessMm} mm · {g.sheetCount} {g.sheetCount === 1 ? 'ploča' : 'ploča'} {g.sheet.widthMm}×{g.sheet.heightMm}
                  {' · '}<b style={{ color: g.utilization < 50 ? C.warn : C.accentText }}>{g.utilization.toFixed(1)}%</b>
                  {g.panelCount <= 2 && g.sheetCount >= 1 && (
                    <span style={{ color: C.warn }}> · cijela ploča za {g.panelCount} kom</span>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.sheets.slice(0, 12).map((sh) => (
                  <svg key={sh.index} width={78} height={Math.round(78 * g.sheet.heightMm / g.sheet.widthMm)}
                    viewBox={`0 0 ${g.sheet.widthMm} ${g.sheet.heightMm}`}
                    role="img" aria-label={`Ploča ${sh.index + 1}, iskorištenje ${Math.round(sh.utilization * 100)}%`}
                    style={{ background: '#fff', border: `1px solid ${C.lineStrong}`, borderRadius: 3 }}>
                    {sh.shelves.map((shelf, si) => shelf.items.map((it, ii) => (
                      <rect key={`${si}-${ii}`} x={it.x} y={it.y} width={it.w} height={it.h}
                        fill={it.rotated ? '#CCFBF1' : '#E0F2F1'} stroke="#0B7F76" strokeWidth={12}
                        vectorEffect="non-scaling-stroke">
                        <title>{`${it.label} — ${it.w}×${it.h} mm na (${it.x}, ${it.y})${it.rotated ? ' · rotirano' : ''}`}</title>
                      </rect>
                    )))}
                  </svg>
                ))}
                {g.sheets.length > 12 && (
                  <span className="text-xs self-center" style={{ color: C.faint }}>
                    +{g.sheets.length - 12} ploča
                  </span>
                )}
              </div>
              {g.unfit.length > 0 && (
                <div className="flex items-start gap-1.5 mt-1.5 text-xs" style={{ color: C.warn }}>
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>Ne staje: {g.unfit.map((u) => `${u.label} (${u.w}×${u.h})`).join(', ')}</span>
                </div>
              )}
            </div>
          ))}
          {!plan.length && (
            <span className="text-xs" style={{ color: C.faint }}>Nema panela za krojenje.</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div style={card} className="p-3">
          <Label>Rubne trake</Label>
          {Object.entries(bom.bandTotals).map(([id, m]) => (
            <Row key={id} label={EDGE_TYPES[id].name} value={`${m.toFixed(2)} m`} />
          ))}
          <div className="mt-3" />
          <Label>Alu lajsne</Label>
          {Object.entries(bom.profileMeters).map(([id, m]) => (
            <Row key={id} label={PROFILES[id].name} value={`${m.toFixed(2)} m`} />
          ))}
        </div>
        <div style={card} className="p-3">
          <Label>Ploče po dekoru</Label>
          {Object.entries(bom.boardTotals).map(([k, a]) => (
            <Row key={k} label={k} value={`${a.toFixed(2)} m²`} />
          ))}
        </div>
        <div style={card} className="p-3">
          <Label>Okov</Label>
          {bom.hwTotals.map((h) => (
            <Row key={h.id} label={h.name} value={`${h.qty} ${h.unit}`} />
          ))}
        </div>
      </div>
      {bom.surfaceNotes.length > 0 && (
        <div className="mt-3">
          <Label>Napomene o rezovima</Label>
          {bom.surfaceNotes.map((n, i) => (
            <Note key={i} kind={n.indexOf('NE pada') >= 0 ? 'error' : 'warn'}>{n}</Note>
          ))}
        </div>
      )}
      {/* Rezerva za preglednike bez Async Clipboard API-ja. Vidljivo samo ako
          korisnik treba ručno označiti tekst. */}
      <textarea ref={ta} readOnly value={csv} aria-label="CSV krojne liste"
        onFocus={(e) => e.target.select()}
        style={{ display: copyError ? 'block' : 'none', width: '100%', height: 120,
                 marginTop: 12, fontSize: 11, fontFamily: 'ui-monospace, monospace' }} />
    </Modal>
  );
}