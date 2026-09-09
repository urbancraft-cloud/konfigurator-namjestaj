// src/components/layout/LeftRail.jsx
import React from 'react';
import { Plus, Trash2, Droplet, Zap } from 'lucide-react';
import { C, mono } from '../../data/theme';
import { WALLS, LEG_HEIGHTS, CORPUS_BASE_H, WORKTOP } from '../../data/tech';
import { PROFILES } from '../../data/profiles';
import { CATALOG, GROUPS, templateById } from '../../data/catalog';
import { worktopPriceOf } from '../../data/decors';
import { wallLength, wallElevationOf } from '../../engine/geometry';
import { Panel } from '../ui/Panel';
import { Btn, Field, Select } from '../ui/Controls';
import { Row, Note } from '../ui/DataDisplay';
import { DecorPicker } from '../ui/DecorPicker';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { fmt } from '../../utils/formatters';

export function LeftRail({
  project, room, surf, surfNotes, floating = false, onNavigate,
  sheetSummary, chargedSheets,
}) {
  /* Sažetak obračuna po pločama dolazi iz `App.jsx` (gdje se već računa), da se
     `optimizeCutList` ne bi pokretao još jednom u lijevom panelu. */
  const surfSheetSummary = { ...(sheetSummary || {}), chargedSheets: chargedSheets || 0 };
  const setRoom = useProjectStore((s) => s.setRoom);
  const setRawProject = useProjectStore((s) => s.setRawProject);
  const addElement = useProjectStore((s) => s.addElement);
  const applyFrontDecor = useProjectStore((s) => s.applyFrontDecor);

  const tool = useUiStore((s) => s.tool);
  const setTool = useUiStore((s) => s.setTool);
  const setView = useUiStore((s) => s.setView);
  const targetWall = useUiStore((s) => s.targetWall);
  const setTargetWall = useUiStore((s) => s.setTargetWall);
  const pendingAdd = useUiStore((s) => s.pendingAdd);
  const setPendingAdd = useUiStore((s) => s.setPendingAdd);
  const setSelectedId = useUiStore((s) => s.setSelectedId);
  const setTab = useUiStore((s) => s.setTab);
  const flash = useUiStore((s) => s.flash);

  const activeWalls = project.activeWalls && project.activeWalls.length ? project.activeWalls : WALLS.map((w) => w.id);

  const handleAdd = (wallId, widthMm) => {
    if (!pendingAdd) return;
    const tpl = templateById(pendingAdd.templateId);
    const c = tpl.dims.width;
    const w = widthMm;
    if (!(w >= c.min && w <= c.max)) {
      // BUG-21: ranije tihi `return` — korisnik klikne i ne desi se ništa.
      flash(`Širina mora biti između ${c.min} i ${c.max} mm.`);
      return;
    }
    const res = addElement(pendingAdd.templateId, wallId, w);
    if (res && res.ok) {
      setSelectedId(res.id);
      setPendingAdd(null);
      setTab('element');
      flash(`${tpl.name} dodan na ${WALLS.find((x) => x.id === wallId).label.toLowerCase()}.`);
    } else {
      flash(res && res.reason
        ? `${WALLS.find((x) => x.id === wallId).label}: ${res.reason}`
        : `Nema slobodnog mjesta na zidu: ${WALLS.find((x) => x.id === wallId).label}.`);
    }
  };

  /* `floating` = uski ekran: panel postaje izvlačeća ladica preko viewporta,
     sa vlastitom pozadinom i sjenom, jer nema svog stupca u flex rasporedu. */
  const asideCls = floating
    ? 'fixed top-0 bottom-0 left-0 z-40 w-80 max-w-[86vw] overflow-y-auto bg-white shadow-2xl p-3'
    : 'w-72 shrink-0 overflow-y-auto pr-1';
  return (
    <aside className={asideCls} style={floating ? { background: C.bg } : undefined}
      aria-label="Postavke prostorije i katalog elemenata">
      {floating && onNavigate && (
        <div className="mb-3 flex justify-end">
          <Btn size="sm" onClick={onNavigate} ariaLabel="Zatvori panel">Zatvori panel</Btn>
        </div>
      )}
      <Panel title="Prostorija">
        <Field label="Dužina" unit="mm" value={room.width} min={1500} max={9000} step={50}
          onChange={(v) => setRoom({ ...room, width: v })} />
        <Field label="Širina" unit="mm" value={room.depth} min={1500} max={9000} step={50}
          onChange={(v) => setRoom({ ...room, depth: v })} />
        <Field label="Visina" unit="mm" value={room.height} min={2200} max={3200} step={10}
          onChange={(v) => setRoom({ ...room, height: v })} />
      </Panel>

      <Panel title="Dodaj element">
        <div className="mb-3">
          <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>Zid na koji ide novi element</div>
          <div className="flex flex-wrap gap-1.5">
            {WALLS.filter((w) => activeWalls.indexOf(w.id) >= 0).map((w) => (
              <button key={w.id} onClick={() => setTargetWall(w.id)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg"
                style={targetWall === w.id
                  ? { background: C.accent, color: '#fff' }
                  : { background: C.paper2, border: `1px solid ${C.line}`, color: C.dim }}>
                Zid {WALLS.findIndex((x) => x.id === w.id) + 1} · {w.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {pendingAdd && (() => {
          const tpl = templateById(pendingAdd.templateId);
          const c = tpl.dims.width;
          const w = pendingAdd.width;
          const bad = w < c.min || w > c.max;
          return (
            <div className="mb-3 p-2.5 rounded-xl" style={{ background: C.accentSoft, border: `1px solid ${C.accent}` }}>
              <div className="text-xs font-semibold mb-2" style={{ color: C.accentText }}>{tpl.name}</div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-medium" style={{ color: C.accentText }}>Širina</span>
                <input autoFocus type="number" value={w} min={c.min} max={c.max} step={c.step}
                  onChange={(e) => setPendingAdd({ ...pendingAdd, width: Number(e.target.value) })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !bad) handleAdd(targetWall, w); }}
                  className="w-20 px-2 py-1.5 text-sm rounded-lg outline-none text-right"
                  style={{ ...mono, background: C.paper, border: `1px solid ${bad ? C.danger : C.line}`, color: C.text }} />
                <span className="text-xs" style={{ color: C.accentText }}>mm</span>
                <span className="text-xs ml-auto" style={{ ...mono, color: C.dim }}>{c.min}–{c.max}</span>
              </div>
              <input type="range" min={c.min} max={c.max} step={c.step} value={Math.min(c.max, Math.max(c.min, w))}
                onChange={(e) => setPendingAdd({ ...pendingAdd, width: Number(e.target.value) })}
                className="w-full mb-2" style={{ accentColor: C.accent }} />
              {bad && <div className="text-xs mb-2" style={{ color: C.danger }}>Širina mora biti između {c.min} i {c.max} mm.</div>}
              <div className="text-xs font-semibold mb-1.5" style={{ color: C.accentText }}>Na koji zid?</div>
              <div className="flex flex-wrap gap-1.5">
                {WALLS.filter((x) => activeWalls.indexOf(x.id) >= 0).map((x) => (
                  <Btn key={x.id} size="sm" variant="primary" onClick={() => { if (!bad) handleAdd(x.id, w); }}>
                    Zid {WALLS.findIndex((y) => y.id === x.id) + 1} · {x.label.split(' ')[0]}
                  </Btn>
                ))}
                <Btn size="sm" onClick={() => setPendingAdd(null)}>Odustani</Btn>
              </div>
            </div>
          );
        })()}

        {GROUPS.map((g) => {
          const items = CATALOG.filter((t) => g.test(t));
          if (!items.length) return null;
          return (
            <div key={g.id} className="mb-3 last:mb-0">
              <div className="text-xs mb-1.5" style={{ color: C.faint }}>{g.label}</div>
              <div className="space-y-1.5">
                {items.map((t) => (
                  <button key={t.templateId}
                    onClick={() => setPendingAdd({ templateId: t.templateId, width: t.dims.width.default })}
                    className="w-full flex items-center gap-2.5 px-2 py-2 text-left rounded-xl transition-colors"
                    style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
                    <span className="flex items-center justify-center w-9 h-8 rounded-lg text-xs font-bold shrink-0"
                      style={{ ...mono, background: C.accentSoft, color: C.accentText }}>{t.short}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{t.name}</span>
                      <span className="block text-xs" style={{ ...mono, color: C.faint }}>
                        {t.dims.width.default}×{t.dims.height.default}×{t.dims.depth.default}
                      </span>
                    </span>
                    <Plus size={15} style={{ color: C.faint }} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </Panel>

      <Panel title="Instalacije" action={
        (project.services || []).length ? (
          <Btn size="sm" onClick={() => setRawProject((p) => ({ ...p, services: [] }))}>Očisti</Btn>
        ) : null
      }>
        <div className="flex gap-2 mb-2">
          <Btn size="sm" full variant={tool === 'voda' ? 'primary' : 'ghost'}
            onClick={() => { setTool(tool === 'voda' ? 'select' : 'voda'); setView('2d'); }}>
            <Droplet size={13} /> Odvod
          </Btn>
          <Btn size="sm" full variant={tool === 'struja' ? 'primary' : 'ghost'}
            onClick={() => { setTool(tool === 'struja' ? 'select' : 'struja'); setView('2d'); }}>
            <Zap size={13} /> Utičnica
          </Btn>
        </div>
        <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
          {(project.services || []).map((sv) => (
            <Row key={sv.id} label={`${sv.kind} · ${WALLS.find((w) => w.id === sv.wall).label.split(' ')[0].toLowerCase()}`}
              value={`${sv.offset} mm / h ${sv.heightMm}`} />
          ))}
          {!(project.services || []).length && (
            <span className="text-xs" style={{ color: C.faint }}>nema označenih instalacija</span>
          )}
        </div>
      </Panel>

      <Panel title="Dekor fronti">
        <DecorPicker label="Sve fronte donjih elemenata"
          value={project.frontDecorBase || 'W1000'}
          hint={`primjenjuje se na ${project.elements.filter((e) => (templateById(e.templateId) || {}).type !== 'wall').length} elemenata odjednom`}
          onChange={(v) => { applyFrontDecor((e, t) => t.type !== 'wall', v, 'frontDecorBase'); flash('Dekor fronti donjih primijenjen.'); }} />
        <DecorPicker label="Fronta iznad frižidera i pećnice"
          value={project.overheadFrontDecorId || project.frontDecorWall || 'W1000'}
          hint="nadgradnje iznad visokih elemenata"
          onChange={(v) => setRawProject((p) => ({ ...p, overheadFrontDecorId: v }))} />
        <DecorPicker label="Sve fronte visećih elemenata"
          value={project.frontDecorWall || 'W1000'}
          hint={`primjenjuje se na ${project.elements.filter((e) => (templateById(e.templateId) || {}).type === 'wall').length} elemenata odjednom`}
          onChange={(v) => { applyFrontDecor((e, t) => t.type === 'wall', v, 'frontDecorWall'); flash('Dekor fronti visećih primijenjen.'); }} />
      </Panel>

      <Panel title="Obračun materijala">
        <Select label="Način obračuna" value={project.materialMode || 'ploce'}
          options={[
            { value: 'ploce', label: 'Po potrošenim pločama (preporučeno)' },
            { value: 'neto', label: 'Neto površina × koeficijent otpada 1,15' },
          ]}
          onChange={(v) => setRawProject((p) => ({ ...p, materialMode: v }))} />
        <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
          {project.materialMode === 'neto' ? (
            <>
              <Row label="način" value="neto × 1,15" />
              <p className="text-xs mt-1.5" style={{ color: C.faint }}>
                Materijal se računa po neto površini panela uvećanoj za 15&nbsp;% otpada.
                Brzo i stabilno, ali ne odražava stvarnu potrošnju ploča.
              </p>
            </>
          ) : (
            <>
              <Row label="način" value="po pločama" tone={C.accentText} />
              <Row label="ploča (naplaćeno)" value={`${(surfSheetSummary.chargedSheets || 0)} kom`} />
              <Row label="iskorištenje" value={`${(surfSheetSummary.utilization || 0)} %`} />
              <Row label="otpad" value={`${(surfSheetSummary.wasteM2 || 0)} m²`} />
              <p className="text-xs mt-1.5" style={{ color: C.faint }}>
                Grupa koja zauzima manje od jedne cijele ploče računa se kao pola ploče.
                Radna ploča i alu lajsne ostaju po dužnom metru — ne kupuju se kao ploča.
              </p>
            </>
          )}
        </div>
      </Panel>

      <Panel title="Radna ploča i obloga">
        <DecorPicker label="Dekor radne ploče" value={project.worktopDecorId}
          filter={(d) => !!d.worktop}
          hint={worktopPriceOf(project.worktopDecorId, project.worktopDepthMm || 600) != null
            ? `${fmt(worktopPriceOf(project.worktopDecorId, project.worktopDepthMm || 600))} KM/m' za širinu ${project.worktopDepthMm || 600} mm`
            : 'dekor nije u ponudi radnih ploča — obračun ide po m²'}
          onChange={(v) => setRawProject((p) => ({ ...p, worktopDecorId: v }))} />
        <Field label="Dubina ploče" unit="mm" value={project.worktopDepthMm || 600} min={500} max={900} step={10}
          onChange={(v) => setRawProject((p) => ({ ...p, worktopDepthMm: v }))} />
        <label className="flex items-center gap-2 text-sm px-3 py-2.5 mb-2 rounded-xl cursor-pointer"
          style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
          <input type="checkbox" checked={project.wallPanelOn !== false}
            onChange={(e) => setRawProject((p) => ({ ...p, wallPanelOn: e.target.checked }))}
            style={{ accentColor: C.accent }} />
          Zidna obloga
        </label>
        {project.wallPanelOn !== false && (
          <>
            <DecorPicker label="Dekor obloge" value={project.wallPanelDecorId || project.worktopDecorId}
              onChange={(v) => setRawProject((p) => ({ ...p, wallPanelDecorId: v }))} />
            <Field label="Visina obloge" unit="mm" value={project.wallPanelHeightMm || 600} min={200} max={1200} step={10}
              onChange={(v) => setRawProject((p) => ({ ...p, wallPanelHeightMm: v }))} />
            <Field label="Debljina obloge" unit="mm" value={project.wallPanelThicknessMm || 10} min={4} max={30} step={1}
              onChange={(v) => setRawProject((p) => ({ ...p, wallPanelThicknessMm: v }))} />
            <p className="text-xs mb-2" style={{ color: C.faint }}>
              Obloga ne ide iza visokih elemenata — niz se tamo prekida.
            </p>
          </>
        )}
        <div className="rounded-lg px-2.5 py-2 mt-1" style={{ background: C.paper2 }}>
          {surf.wt.pieces.map((pc) => (
            <Row key={pc.id} label={`ploča ${pc.segId}`} value={`${pc.lengthMm} × ${pc.crossMm}`}
              tone={pc.onSeam ? null : C.danger} />
          ))}
          {surf.wp.pieces.map((pc) => (
            <Row key={pc.id} label={`obloga ${pc.segId}`} value={`${pc.lengthMm} × ${pc.crossMm}`} />
          ))}
          <Row label="spojevi" value={`${surf.wt.joints90 + surf.wp.joints90}×90° · ${surf.wt.jointsStraight + surf.wp.jointsStraight} ravni`} />
        </div>
      </Panel>

      <Panel title="Ploče za kuhanje" action={
        <Btn size="sm" onClick={() => setRawProject((p) => {
          const wl = (p.activeWalls || ['top'])[0];
          return {
            ...p,
            cooktops: (p.cooktops || []).concat([{
              id: `ct_${Date.now()}`, wall: wl,
              offset: Math.round(wallLength(wl, room) / 2), widthMm: 600,
            }]),
          };
        })}><Plus size={13} /> Dodaj</Btn>
      }>
        {(project.cooktops || []).map((ctp, i) => (
          <div key={ctp.id} className="p-2.5 mb-2 rounded-xl" style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold" style={{ color: C.dim }}>Ploča {i + 1}</span>
              <button onClick={() => setRawProject((p) => ({ ...p, cooktops: p.cooktops.filter((x) => x.id !== ctp.id) }))}
                className="p-1 rounded" style={{ color: C.danger }}><Trash2 size={12} /></button>
            </div>
            <Select label="Zid" value={ctp.wall} options={WALLS.map((w) => ({ value: w.id, label: w.label }))}
              onChange={(v) => setRawProject((p) => ({ ...p, cooktops: p.cooktops.map((x) => (x.id === ctp.id ? { ...x, wall: v } : x)) }))} />
            <Field label="Pozicija (centar)" unit="mm" value={ctp.offset} step={10}
              min={Math.round((ctp.widthMm || 600) / 2)}
              max={Math.max(0, wallLength(ctp.wall, room) - Math.round((ctp.widthMm || 600) / 2))}
              onChange={(v) => setRawProject((p) => ({ ...p, cooktops: p.cooktops.map((x) => (x.id === ctp.id ? { ...x, offset: v } : x)) }))} />
            <Field label="Širina" unit="mm" value={ctp.widthMm || 600} min={300} max={900} step={10}
              onChange={(v) => setRawProject((p) => ({ ...p, cooktops: p.cooktops.map((x) => (x.id === ctp.id ? { ...x, widthMm: v } : x)) }))} />
          </div>
        ))}
        {!(project.cooktops || []).length && (
          <span className="text-xs" style={{ color: C.faint }}>nema postavljene ploče</span>
        )}
        {(project.cooktops || []).length > 0 && (() => {
          const ctp = project.cooktops[0];
          const napa = project.elements.find((e) => e.templateId === 'V-NAPA');
          if (!napa) return <Note kind="warn">Nema nape iznad ploče za kuhanje.</Note>;
          const d = Math.abs(napa.offset + napa.dims.width / 2 - ctp.offset);
          return napa.wall === ctp.wall && d <= 100
            ? <Note kind="ok">Napa je centrirana iznad ploče ({d} mm odstupanja).</Note>
            : <Note kind="warn">Napa nije iznad ploče za kuhanje (odstupanje {d} mm).</Note>;
        })()}
      </Panel>

      <Panel title="Ručke — orijentacija">
        {[['Donji elementi', 'handleOrientBase'], ['Viseći elementi', 'handleOrientWall']].map(([lbl, key]) => (
          <div key={key} className="mb-2">
            <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>{lbl}</div>
            <div className="flex gap-1.5">
              {[['vertical', 'Uspravno'], ['horizontal', 'Položeno']].map(([v, l]) => (
                <button key={v} onClick={() => setRawProject((p) => ({ ...p, [key]: v }))}
                  className="flex-1 px-2 py-1.5 text-xs font-medium rounded-lg"
                  style={(project[key] || (key === 'handleOrientBase' ? 'vertical' : 'horizontal')) === v
                    ? { background: C.accent, color: '#fff' }
                    : { background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>{l}</button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs" style={{ color: C.faint }}>
          Donji: 40 mm od vrha fronte. Viseći: 40 mm od dna. Ladice i mašina uvijek na sredinu širine.
        </p>
      </Panel>

      <Panel title="LED maska">
        <label className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl cursor-pointer mb-2"
          style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
          <input type="checkbox" checked={!!project.ledMask}
            onChange={(e) => setRawProject((p) => ({ ...p, ledMask: e.target.checked }))}
            style={{ accentColor: C.accent }} />
          LED maska ispod visećih (20 mm)
        </label>
        {project.ledMask && (
          <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
            {surf.led.pieces.map((pc) => (
              <Row key={pc.id} label={`${WALLS.find((w) => w.id === pc.wall).label.split(' ')[0].toLowerCase()}`}
                value={`${pc.lengthMm} × ${pc.crossMm} × ${pc.thicknessMm}`} />
            ))}
            {!surf.led.pieces.length && <span className="text-xs" style={{ color: C.faint }}>nema visećih elemenata</span>}
            <Row label="ukupno" value={`${(surf.led.lengthMm / 1000).toFixed(2)} m`} />
          </div>
        )}
      </Panel>

      <Panel title="Podnožje">
        <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>Visina nogica</div>
        <div className="flex gap-2 mb-3">
          {LEG_HEIGHTS.map((v) => (
            <button key={v} onClick={() => setRawProject((p) => ({ ...p, legHeightMm: v }))}
              className="flex-1 px-3 py-2 text-sm font-medium rounded-lg"
              style={(project.legHeightMm || 150) === v
                ? { background: C.accent, color: '#fff' }
                : { background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>
              {v} mm
            </button>
          ))}
        </div>
        <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
          <Row label="donji elementi" value={`y = ${project.legHeightMm || 150} mm`} />
          <Row label="viseći elementi" value={`y = ${wallElevationOf(project)} mm`} />
          <Row label="visina korpusa" value={`${CORPUS_BASE_H} mm`} />
          <Row label="završna maska"
            value={`${CORPUS_BASE_H + (project.legHeightMm || 150)} × ${project.worktopDepthMm || WORKTOP.depthMm}`} />
        </div>
      </Panel>

      {project.triangle && (
        <Panel title="Radni trokut">
          <div className="rounded-lg px-2.5 py-2" style={{ background: project.triangle.ok ? C.okBg : C.warnBg }}>
            {project.triangle.legs && <>
              <Row label="sudoper – ploča" value={`${project.triangle.legs.sudoperPloca} mm`} />
              <Row label="ploča – frižider" value={`${project.triangle.legs.plocaFrizider} mm`} />
              <Row label="frižider – sudoper" value={`${project.triangle.legs.friziderSudoper} mm`} />
              <Row label="zbir" value={`${project.triangle.sum} mm`} />
            </>}
            <div className="text-xs mt-1" style={{ color: project.triangle.ok ? C.ok : C.warn }}>
              {project.triangle.ok ? 'U normi (kraci 1,2–2,7 m, zbir 4,0–7,9 m)' : project.triangle.reason}
            </div>
          </div>
        </Panel>
      )}

      {(project.layoutNotes || []).length > 0 && (
        <Panel title="Napomene rasporeda">
          {project.layoutNotes.map((n, i) => <Note key={i} kind="warn">{n}</Note>)}
        </Panel>
      )}

      <Panel title="Coklo i gornja maska">
        <DecorPicker label="Dekor cokla" value={project.socleDecorId || project.worktopDecorId}
          onChange={(v) => setRawProject((p) => ({ ...p, socleDecorId: v }))} />
        <Field label="Visina gornje maske" unit="mm" value={project.topMaskHeightMm || 100} min={50} max={300} step={10}
          onChange={(v) => setRawProject((p) => ({ ...p, topMaskHeightMm: v }))} />
        <DecorPicker label="Dekor gornje maske" value={project.topMaskDecorId || project.wallPanelDecorId || project.worktopDecorId}
          onChange={(v) => setRawProject((p) => ({ ...p, topMaskDecorId: v }))} />
        <div className="rounded-lg px-2.5 py-2 mt-1" style={{ background: C.paper2 }}>
          {surf.sk.pieces.map((pc) => (
            <Row key={pc.id} label={`coklo ${pc.runId}`} value={`${pc.lengthMm} × ${pc.crossMm}`} />
          ))}
          {surf.gm.pieces.map((pc) => (
            <Row key={pc.id} label={`maska ${pc.runId}`} value={`${pc.lengthMm} × ${pc.crossMm}`} />
          ))}
          {!surf.sk.pieces.length && !surf.gm.pieces.length && (
            <span className="text-xs" style={{ color: C.faint }}>nema nizova</span>
          )}
        </div>
      </Panel>

      <Panel title="Završne maske">
        <DecorPicker label="Dekor završnih maski" value={project.endPanelDecorId || project.worktopDecorId}
          onChange={(v) => setRawProject((p) => ({ ...p, endPanelDecorId: v }))} />
        <Select label="Način ubacivanja" value={project.endPanelMode || 'auto'}
          options={[
            { value: 'auto', label: 'Automatski (prema tipu niza)' },
            { value: 'full', label: 'Od poda do plafona — sve maske' },
          ]}
          onChange={(v) => setRawProject((p) => ({ ...p, endPanelMode: v }))} />
        <Field label="Debljina maske" unit="mm" value={project.endPanelThicknessMm || 18} min={10} max={40} step={1}
          onChange={(v) => setRawProject((p) => ({ ...p, endPanelThicknessMm: v }))} />
        <div className="space-y-2">
          {surf.zm.pieces.map((pc) => {
            const lbl = pc.kind === 'base' ? 'donja' : pc.kind === 'tall' ? 'visoka' : 'gornja';
            const setSize = (k, v) => setRawProject((p) => ({
              ...p,
              endPanelSizes: { ...(p.endPanelSizes || {}), [pc.id]: { ...((p.endPanelSizes || {})[pc.id] || {}), [k]: Number(v) || undefined } },
            }));
            return (
              <div key={pc.id} className="p-2 rounded-lg" style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold" style={{ color: C.dim }}>
                    {lbl} · {pc.side === 'start' ? 'lijevo' : 'desno'} · {WALLS.find((w) => w.id === pc.wall).label.split(' ')[0].toLowerCase()}
                  </span>
                  {pc.manual && (
                    <button onClick={() => setRawProject((p) => {
                      const n = { ...(p.endPanelSizes || {}) }; delete n[pc.id];
                      return { ...p, endPanelSizes: n };
                    })} className="text-xs px-1.5 py-0.5 rounded" style={{ background: C.warnBg, color: C.warn }}>auto</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs" style={{ color: C.dim }}>visina
                    <input type="number" value={pc.lengthMm} step={10}
                      onChange={(e) => setSize('lengthMm', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                      style={{ ...mono, background: C.paper, border: `1px solid ${C.line}` }} />
                  </label>
                  <label className="text-xs" style={{ color: C.dim }}>dubina
                    <input type="number" value={pc.crossMm} step={10}
                      onChange={(e) => setSize('crossMm', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                      style={{ ...mono, background: C.paper, border: `1px solid ${C.line}` }} />
                  </label>
                </div>
              </div>
            );
          })}
          {!surf.zm.pieces.length && (
            <span className="text-xs" style={{ color: C.faint }}>nema otvorenih krajeva</span>
          )}
        </div>
      </Panel>

      <Panel title="Alu lajsne">
        <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
          {Object.entries(surf.profileMeters).map(([id, m]) => (
            <Row key={id} label={PROFILES[id].name} value={`${m.toFixed(2)} m`} />
          ))}
          {!Object.keys(surf.profileMeters).length && (
            <span className="text-xs" style={{ color: C.faint }}>nema spojeva</span>
          )}
        </div>
      </Panel>

      {surfNotes.length > 0 && (
        <Panel title="Napomene o rezovima">
          {surfNotes.map((n, i) => (
            <Note key={i} kind={n.indexOf('NE pada') >= 0 ? 'error' : 'warn'}>{n}</Note>
          ))}
        </Panel>
      )}
    </aside>
  );
}