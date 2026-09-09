// src/utils/exportImport.js
//
// Izvoz i uvoz projekata i krojnih lista kao DATOTEKE.
//
// Zašto je ovo bilo važno: projekti su živjeli isključivo u `localStorage`.
// Promjena preglednika, čišćenje keša, drugi računar ili profil — i sve je
// nestajalo, bez upozorenja i bez mogućnosti oporavka. Izvoz u JSON to rješava,
// a uvoz prolazi kroz ISTU normalizaciju kao i učitavanje iz localStorage-a, pa
// stariji ili oštećeni fajl ne može srušiti aplikaciju.

import { normalizeProject } from './projectSchema';
import { adoptProjectIds } from '../data/catalog';

/** Format i verzija — za buduće migracije pri uvozu. */
export const EXPORT_FORMAT = 'kuhinja-konfigurator/projekat';
export const EXPORT_VERSION = 1;

/* BOM za UTF-8: bez njega Excel na Windowsima prikazuje „šđčćž" kao šifre. */
const UTF8_BOM = '\uFEFF';

/** Sigurno ime datoteke iz proizvoljnog teksta. */
export function safeFilename(name, ext = 'json') {
  const base = String(name || 'projekat').trim()
    .replace(/\s+/g, '_')                   // razmaci → donja crta
    .replace(/[\\/:*?"<>|]+/g, '-')         // znakovi nedozvoljeni u imenima datoteka
    .replace(/_{2,}/g, '_')                 // sažmi višestruke donje crte
    .replace(/-{2,}/g, '-')                 // sažmi višestruke crtice
    .replace(/[-_]{2,}/g, '_')              // sažmi mješovite nizove
    .replace(/^[-_]+|[-_]+$/g, '');         // bez vodećih/završnih crta
  const clean = base || 'projekat';
  return clean.toLowerCase().endsWith(`.${ext}`) ? clean : `${clean}.${ext}`;
}

/**
 * Pokreće preuzimanje datoteke u pregledniku.
 * Radi bez ijedne biblioteke: Blob + privremeni <a download>.
 */
export function downloadFile(content, filename, mime = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  // Bez odlaganja bi Firefox u dijelu slučajeva ignorisao klik.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  return filename;
}

export function downloadJSON(data, filename) {
  return downloadFile(JSON.stringify(data, null, 2), safeFilename(filename, 'json'));
}

export function downloadCSV(text, filename) {
  return downloadFile(UTF8_BOM + text, safeFilename(filename, 'csv'), 'text/csv;charset=utf-8');
}

/** Izvoz projekta u prenosivi JSON. */
export function projectToJSON(room, project) {
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    name: project.name || 'projekat',
    room,
    project,
  };
}

/**
 * Uvoz projekta iz JSON teksta.
 *
 * Ne dira store — vraća `{ ok, room, project, notes, name }` da pozivalac odluči
 * šta će sa rezultatom (time se izbjegava kružna zavisnost sa `projectStore`).
 *
 * Prihvata i „goli" oblik `{ room, project }` koji koristi brzi snimak, i
 * imenovani oblik `{ name, room, project, savedAt }`.
 */
export function importProjectFromJSON(text) {
  if (!text || !String(text).trim()) {
    return { ok: false, reason: 'Datoteka je prazna.' };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: `Datoteka nije ispravan JSON: ${e.message}` };
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, reason: 'Datoteka ne sadrži objekat projekta.' };
  }
  if (!data.project || typeof data.project !== 'object') {
    return { ok: false, reason: 'Datoteka nema polje "project" — ovo nije fajl ovog konfiguratora.' };
  }
  if (data.format && data.format !== EXPORT_FORMAT) {
    return { ok: false, reason: `Nepoznat format datoteke: ${data.format}` };
  }
  if (data.formatVersion != null && Number(data.formatVersion) > EXPORT_VERSION) {
    return {
      ok: false,
      reason: `Datoteka je iz novije verzije programa (format v${data.formatVersion}, program poznaje v${EXPORT_VERSION}).`,
    };
  }

  const { room, project, notes } = normalizeProject(data.project, data.room);
  adoptProjectIds(project);
  const name = data.name || project.name || 'Uvezeni projekat';
  return { ok: true, room, project: { ...project, name }, notes, name };
}

/* Krojnu listu u CSV pretvara `bomToCSV` iz `engine/bom.js` (sa escaping-om
   polja); za preuzimanje se koristi `downloadCSV(bomToCSV(bom), ime)` iznad —
   on dodaje UTF-8 BOM da Excel ispravno prikaže šđčćž. */

/**
 * Ponuda kao HTML dokument za štampanje.
 *
 * Bez biblioteke za PDF: otvori se sistemski dijalog za štampu, gdje korisnik
 * bira „Sačuvaj kao PDF". Ovo radi u svakom pregledniku, ne vuče ~500 kB
 * biblioteke i daje rezultat koji je prelomljen za A4.
 */
export function offerToHTML({ project, room, totals, rows }) {
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = (n) => Number(n || 0).toLocaleString('bs-BA', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  const stavke = (rows || []).map((r) => `
      <tr>
        <td class="pos">${esc(r.pos)}</td>
        <td>${esc(r.element)}</td>
        <td class="dim">${esc(r.dims)}</td>
        <td class="num">${money(r.net)}</td>
      </tr>`).join('');

  const dijelovi = Object.entries(totals.parts || {}).map(([k, v]) => `
      <tr><td>${esc(k)}</td><td class="num">${money(v)}</td></tr>`).join('');

  return `<!doctype html>
<html lang="bs">
<head>
<meta charset="utf-8" />
<title>Ponuda — ${esc(project.name)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0F172A;
         margin: 0; font-size: 11pt; }
  h1 { font-size: 17pt; margin: 0 0 2mm; }
  .meta { color: #64748B; font-size: 9pt; margin-bottom: 6mm; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6mm; }
  th, td { text-align: left; padding: 2mm 2.5mm; border-bottom: 1px solid #E2E8F0; font-size: 9.5pt; }
  th { background: #F1F5F9; color: #475569; font-weight: 600; text-transform: uppercase;
       font-size: 8pt; letter-spacing: .04em; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.dim { font-variant-numeric: tabular-nums; color: #475569; }
  td.pos { color: #94A3B8; width: 10mm; }
  .totals { width: 70mm; margin-left: auto; }
  .totals td { border: none; padding: 1.4mm 2.5mm; }
  .grand td { border-top: 2px solid #0F172A; font-weight: 700; font-size: 12pt; padding-top: 2.5mm; }
  .note { color: #64748B; font-size: 8.5pt; margin-top: 8mm; line-height: 1.5; }
  @media print { .noprint { display: none; } }
  .noprint { position: fixed; top: 8px; right: 8px; }
  .noprint button { padding: 8px 16px; border-radius: 8px; border: 1px solid #0D9488;
                    background: #0D9488; color: #fff; font-size: 12pt; cursor: pointer; }
</style>
</head>
<body>
  <div class="noprint"><button onclick="window.print()">Štampaj / Sačuvaj kao PDF</button></div>
  <h1>Ponuda</h1>
  <div class="meta">
    ${esc(project.name)} · prostorija ${esc(room.width)}×${esc(room.depth)}×${esc(room.height)} mm
    · datum ${esc(new Date().toLocaleDateString('bs-BA'))}
  </div>

  <table>
    <thead><tr><th>Poz</th><th>Element</th><th>Dimenzije (mm)</th><th class="num">Cijena (KM)</th></tr></thead>
    <tbody>${stavke}</tbody>
  </table>

  <table class="totals">
    <tbody>
      ${dijelovi}
      <tr><td>Osnovica</td><td class="num">${money(totals.net)}</td></tr>
      <tr><td>PDV 17%</td><td class="num">${money(totals.vat)}</td></tr>
      <tr class="grand"><td>Za uplatu</td><td class="num">${money(totals.gross)} KM</td></tr>
    </tbody>
  </table>

  <p class="note">
    Cijena je informativna, sa koeficijentom otpada 1,15. Konačnu cijenu daje
    optimizacija krojenja u pogonu. Sve mjere su u milimetrima, cijene u KM.
  </p>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 400); });</script>
</body>
</html>`;
}

/** Otvara ponudu u novom prozoru i pokreće štampanje. */
export function printOffer(payload) {
  const html = offerToHTML(payload);
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) {
    return { ok: false, reason: 'Preglednik je blokirao novi prozor — dozvolite iskačuće prozore za ovu stranicu.' };
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  return { ok: true };
}
