import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 5203;
const URL_ = `http://localhost:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'], env: process.env,
});
let serverOut = '';
server.stdout.on('data', (d) => { serverOut += d; });
server.stderr.on('data', (d) => { serverOut += d; });

const errors = [];
const results = [];
const ok = (n, d = '') => results.push(`  ✅ ${n}${d ? ' — ' + d : ''}`);
const bad = (n, d = '') => { results.push(`  ❌ ${n}${d ? ' — ' + d : ''}`); errors.push(n); };

let ready = false;
for (let i = 0; i < 90; i++) {
  if (/ready in|Local:/.test(serverOut)) { ready = true; break; }
  await sleep(400);
}
if (!ready) { console.log('DEV SERVER NIJE KRENUO:\n' + serverOut); process.exit(1); }

const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--use-gl=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

try {
  await page.goto(URL_, { waitUntil: 'networkidle', timeout: 40000 });
  await sleep(2000);

  const len = await page.evaluate(() => document.getElementById('root').innerHTML.length);
  len > 5000 ? ok('Aplikacija se renderovala', `${len.toLocaleString('de')} znakova u #root`)
             : bad('Aplikacija se NIJE renderovala', `${len} znakova`);

  (await page.getByText('Tip prostorije').count()) > 0
    ? ok('Startup wizard je otvoren') : bad('Startup wizard nije pronađen');

  await page.getByRole('button', { name: 'Završi' }).first().click();
  await sleep(4000);
  (await page.getByText('Ukupno sa PDV-om').count()) > 0
    ? ok('Wizard završen, glavni prikaz učitan') : bad('Glavni prikaz nije učitan');

  const cijena = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => d.textContent === 'Ukupno sa PDV-om');
    return el && el.parentElement ? el.parentElement.textContent : '';
  });
  (cijena && !/NaN/.test(cijena))
    ? ok('Cijena izračunata, bez NaN', cijena.replace(/\s+/g, ' ').trim().slice(-24))
    : bad('Cijena je NaN ili prazna', cijena.slice(0, 60));

  /* ---- GLAVNI TEST: BUG-01 ------------------------------------------------
     Ranije je `thicknessesOf` bio nekorišten/neimportovan u projectStore.js, pa
     je akcija `applyFrontDecor` bacala ReferenceError. Bez ErrorBoundary-ja to
     je značiLO BIJELI EKRAN. Ovdje pozivamo TAČNU store akciju koju UI poziva
     iz LeftRail.jsx:174 (promjena dekora svih donjih fronti). */
  const before = await page.evaluate(() => document.getElementById('root').innerHTML.length);
  const rezultat = await page.evaluate(async () => {
    const mod = await import('/src/store/projectStore.js');
    try {
      mod.useProjectStore.getState().applyFrontDecor(
        (e, t) => t.type !== 'wall', 'U104', 'frontDecorBase');
      return { ok: true };
    } catch (err) {
      return { ok: false, msg: String(err && err.message || err), name: err && err.name };
    }
  });
  await sleep(1500);
  const after = await page.evaluate(() => document.getElementById('root').innerHTML.length);

  if (!rezultat.ok) {
    bad('BUG-01 NIJE POPRAVLJEN — applyFrontDecor i dalje baca', `${rezultat.name}: ${rezultat.msg}`);
  } else if (after < before * 0.5) {
    bad('BUG-01 — aplikacija se sružila nakon promjene dekora', `${before} → ${after} znakova`);
  } else {
    ok('BUG-01 POPRAVLJEN — applyFrontDecor prolazi bez ReferenceError', 'UI i dalje renderuje');
  }

  // dekor je stvarno primijenjen?
  const primijenjeno = await page.evaluate(async () => {
    const mod = await import('/src/store/projectStore.js');
    const p = mod.useProjectStore.getState().rawProject;
    return { key: p.frontDecorBase, fronti: p.elements.filter((e) => e.front.decorId === 'U104').length };
  });
  primijenjeno.key === 'U104' && primijenjeno.fronti > 0
    ? ok('Dekor stvarno primijenjen na elemente', `${primijenjeno.fronti} fronti na U104`)
    : bad('Dekor nije primijenjen', JSON.stringify(primijenjeno));

  (await page.getByText('Konfigurator je naišao na neočekivanu grešku').count()) === 0
    ? ok('ErrorBoundary se nije aktivirao') : bad('ErrorBoundary je aktiviran');

  /* ---- BUG-18: wizard se ne zaglavljuje kad se promijeni tip prostorije --- */
  await page.getByRole('button', { name: 'Novi projekat' }).first().click();
  await sleep(800);
  for (let i = 0; i < 5; i++) { await page.getByRole('button', { name: 'Dalje' }).first().click().catch(() => {}); await sleep(250); }
  for (let i = 0; i < 6; i++) { await page.getByRole('button', { name: 'Nazad' }).first().click().catch(() => {}); await sleep(180); }
  await page.getByRole('button', { name: 'Spavaća soba' }).first().click();
  await sleep(700);
  const txt = ((await page.getByText(/Korak \d+ od \d+/).textContent().catch(() => '')) || '').trim();
  const m = /Korak (\d+) od (\d+)/.exec(txt);
  (m && Number(m[1]) <= Number(m[2]))
    ? ok('BUG-18 POPRAVLJEN — promjena tipa prostorije resetuje korak', txt)
    : bad('BUG-18 — wizard zaglavljen', txt || 'nije pronađen tekst koraka');

  // ormar mod se učita
  await page.getByRole('button', { name: 'Završi' }).first().click();
  await sleep(3000);
  const ormar = await page.getByText(/Segment \d+ od \d+/).count();
  ormar > 0 ? ok('Ormar mod se učita i renderuje') : bad('Ormar mod se nije učitao');

  const stvarne = consoleErrors.filter((e) => !/favicon|React DevTools|404|DevTools|WebGL|GPU/i.test(e));
  stvarne.length === 0 ? ok('Nema grešaka u browser konzoli')
                       : bad(`${stvarne.length} grešaka u konzoli`, stvarne.slice(0, 2).join(' | ').slice(0, 170));

  await page.screenshot({ path: 'e2e/smoke-screenshot.png' });
  ok('Snimljen screenshot', 'e2e/smoke-screenshot.png');
} catch (e) {
  bad('E2E tok pukao', String(e.message).slice(0, 180));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}

console.log('\n' + '='.repeat(68));
console.log('E2E SMOKE TEST — kuhinja-konfigurator (Chromium, stvarna aplikacija)');
console.log('='.repeat(68));
results.forEach((r) => console.log(r));
console.log('-'.repeat(68));
console.log(errors.length ? `❌ ${errors.length} problema` : '✅ SVE PROLAZI');
process.exit(errors.length ? 1 : 0);
