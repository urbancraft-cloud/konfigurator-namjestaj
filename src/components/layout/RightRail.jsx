// src/components/layout/RightRail.jsx
import React, { useMemo } from 'react';
import { Trash2, AlertTriangle, Layers } from 'lucide-react';
import { C, mono } from '../../data/theme';
import { WALLS, MACHINE, TECH_PROFILES, profileOf } from '../../data/tech';
import { templateById, recipeOf } from '../../data/catalog';
import { thicknessesOf, boardPriceOf, EDGE_TYPES } from '../../data/decors';
import { RUNNER_SYSTEMS, CORNER_MECHANISMS, APPLIANCES, HANDLES, runnerCalibrated } from '../../data/hardware';
import { wallLength } from '../../engine/geometry';
import { validateInProject } from '../../engine/validation';

/** Prazan rezultat validacije za element kojeg nema u dijeljenoj mapi. */
const NO_VALIDATION = { errors: [], warnings: [], valid: true };
import { computePanels, resolveFrontStack, resolveFrontLayout } from '../../engine/panels';
import { computePrice } from '../../engine/pricing';
import { handlePlacements } from '../../engine/layout';
import { Panel } from '../ui/Panel';
import { Btn, Segmented, Select, Field } from '../ui/Controls';
import { Row, Note } from '../ui/DataDisplay';
import { DecorPicker } from '../ui/DecorPicker';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { fmt } from '../../utils/formatters';

export function RightRail({ project, room, validations, floating = false, onNavigate }) {
  const patch = useProjectStore((s) => s.patch);
  const removeElement = useProjectStore((s) => s.removeElement);
  const moveToWall = useProjectStore((s) => s.moveToWall);
  const dragElement = useProjectStore((s) => s.dragElement);

  const selectedId = useUiStore((s) => s.selectedId);
  const setSelectedId = useUiStore((s) => s.setSelectedId);
  const tab = useUiStore((s) => s.tab);
  const setTab = useUiStore((s) => s.setTab);
  const flash = useUiStore((s) => s.flash);
  const flashThrottled = useUiStore((s) => s.flashThrottled);

  const selected = project.elements.find((e) => e.instanceId === selectedId) || null;
  /* PERF-06: validacija se već računa jednom u `App.jsx` i dijeli kroz
     `validations` mapu. Ranije se ovdje računala ponovo za selektovani element,
     a u listi ispod još jednom za SVAKI element — ukupno 3 prolaza po renderu. */
  const validation = selected
    ? ((validations && validations.get(selected.instanceId)) || validateInProject(selected, project, room))
    : null;
  const selPanels = useMemo(() => selected ? computePanels(selected) : [], [selected]);
  const selPrice = useMemo(() => selected ? computePrice(selected, project) : null, [selected, project]);
  const selP = selected ? profileOf(selected) : null;
  const selStack = selected ? (resolveFrontStack(selected, selP) || []) : [];
  const selFronts = selected && !selStack.length ? resolveFrontLayout(selected, selP) : [];
  const selTpl = selected ? templateById(selected.templateId) : null;
  const selRC = selected ? recipeOf(selected) : null;
  const activeWalls = project.activeWalls && project.activeWalls.length ? project.activeWalls : WALLS.map((w) => w.id);

  const handleDelete = () => {
    removeElement(selected.instanceId);
    setSelectedId(null);
    flash('Element obrisan.');
  };

  /** BUG-21: premještanje na drugi zid ranije nije javljalo kad nema mjesta. */
  const handleMoveToWall = (wall) => {
    if (!selected) return;
    const res = moveToWall(selected.instanceId, wall);
    if (res && res.ok) {
      if (!res.unchanged) {
        flash(`Premješteno na ${WALLS.find((w) => w.id === wall).label.toLowerCase()} · odmak ${res.offset} mm.`);
      }
    } else {
      flash(res && res.reason ? res.reason : 'Premještanje nije uspjelo.');
    }
  };

  /**
   * Direktni upis odmaka: BEZ snap-a (inače korisnik upiše 1234 pa dobije 1240),
   * i sa prigušenom porukom kad pomjeranje nije moguće.
   */
  const handleSetOffset = (v) => {
    if (!selected) return;
    const res = dragElement(selected.instanceId, v, { snap: false });
    if (res && !res.ok) flashThrottled(res.reason);
  };

  const asideCls = floating
    ? 'fixed top-0 bottom-0 right-0 z-40 w-80 max-w-[86vw] overflow-y-auto shadow-2xl p-3'
    : 'w-80 shrink-0 overflow-y-auto pl-1';
  return (
    <aside className={asideCls} style={floating ? { background: C.bg } : undefined}
      aria-label="Elementi u projektu i detalji odabranog elementa">
      {floating && onNavigate && (
        <div className="mb-3 flex justify-end">
          <Btn size="sm" onClick={onNavigate} ariaLabel="Zatvori panel">Zatvori panel</Btn>
        </div>
      )}
      <div className="mb-3">
        <Segmented value={tab} onChange={setTab}
          options={[{ value: 'katalog', label: `Elementi (${project.elements.length})` }, { value: 'element', label: 'Detalji' }]} />
      </div>

      {tab === 'katalog' && (
        <Panel title="Elementi u projektu">
          <div className="space-y-1">
            {project.elements.map((e, i) => {
              const t = templateById(e.templateId);
              const bad = !((validations && validations.get(e.instanceId)) || NO_VALIDATION).valid;
              const sel = e.instanceId === selectedId;
              return (
                <button key={e.instanceId}
                  onClick={() => { setSelectedId(e.instanceId); setTab('element'); }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left"
                  style={{ background: sel ? C.accentSoft : C.paper2, border: `1px solid ${sel ? C.accent : C.line}` }}>
                  <span className="text-xs font-bold w-9 shrink-0" style={{ ...mono, color: bad ? C.danger : C.dim }}>
                    {t.short}{i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium truncate">{t.name}</span>
                    <span className="block text-xs" style={{ ...mono, color: C.faint }}>
                      {WALLS.find((w) => w.id === e.wall).label.split(' ')[0]} · {e.offset} mm
                    </span>
                  </span>
                  <span className="text-xs" style={{ ...mono, color: C.faint }}>{e.dims.width}</span>
                  {bad && <AlertTriangle size={13} style={{ color: C.danger }} />}
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      {tab === 'element' && !selected && (
        <Panel>
          <div className="text-sm py-10 text-center" style={{ color: C.faint }}>
            <Layers size={24} className="mx-auto mb-2 opacity-40" />
            Odaberite element u tlocrtu, 3D prikazu ili listi.
          </div>
        </Panel>
      )}

      {tab === 'element' && selected && (
        <>
          <Panel action={
            <Btn size="sm" variant="danger" onClick={handleDelete}>
              <Trash2 size={13} /> Obriši
            </Btn>
          } title={selTpl.name}>
            {validation.errors.map((e, i) => <Note key={`e${i}`} kind="error">{e}</Note>)}
            {validation.warnings.map((w, i) => <Note key={`w${i}`} kind="warn">{w}</Note>)}
            {validation.valid && !validation.warnings.length && <Note kind="ok">Proizvodno ispravno.</Note>}
          </Panel>

          <Panel title="Konstrukcija">
            <Select label="Tehnološka serija" value={selected.profileId}
              options={Object.values(TECH_PROFILES).map((p) => ({ value: p.id, label: p.name }))}
              onChange={(v) => patch(selected.instanceId, { profileId: v })} />

            {selTpl.blindCorner && (
              <label className="flex items-center gap-2 text-sm px-3 py-2.5 mb-3 rounded-xl cursor-pointer"
                style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
                <input type="checkbox" checked={!!selected.flipX}
                  onChange={(e) => patch(selected.instanceId, { flipX: e.target.checked })}
                  style={{ accentColor: C.accent }} />
                Zrcali element (blenda na drugu stranu)
              </label>
            )}

            {selTpl.frontVariants && (
              <Select label="Varijanta donjeg dijela" value={selected.frontVariant}
                options={Object.entries(selTpl.frontVariants).map(([k, v]) => ({ value: k, label: v.label }))}
                onChange={(v) => {
                  const nv = selTpl.frontVariants[v];
                  patch(selected.instanceId, {
                    frontVariant: v, shelves: nv.shelves,
                    frontStack: nv.frontStack.map((d) => ({ ...d })),
                  });
                }} />
            )}

            <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
              <Row label="leđa" value={
                selRC.back === 'none' ? 'nema'
                  : selRC.back === 'strips' ? `${(selRC.backStrips || []).length} trake`
                    : selRC.back === 'traverses' ? `${(selRC.backTraverses || []).length} traverze`
                      : selP.backMount === 'groove' ? `kanal ${selected.type === 'wall' ? 12 : selP.backGroove.insetMm} mm` : 'zakucana'} />
              <Row label="vrh" value={
                (selRC.top === 'auto' ? (selTpl.type === 'base' ? 'traverses' : 'full') : selRC.top) === 'traverses'
                  ? `traverze ${(selRC.traverses || [{ widthMm: selP.traverseWidthMm }]).map((x) => x.widthMm).join('/')} mm`
                  : selRC.top === 'none' ? 'otvoren' : 'plafon'} />
              <Row label="fuge" value={`${selP.reveals.perSideMm} / ${selP.reveals.betweenFrontsMm} mm`} />
              <Row label="kroj" value={MACHINE.premilling ? 'predglodalo · cut = final' : 'oduzima traku'} tone={C.accentText} />
            </div>
          </Panel>

          <Panel title="Dimenzije">
            {['width', 'height', 'depth'].map((k) => {
              const c = selTpl.dims[k];
              const lbl = { width: 'Širina', height: 'Visina', depth: 'Dubina' }[k];
              return (
                <Field key={k} label={lbl} strong={k === 'width'} unit="mm" value={selected.dims[k]}
                  min={c.min} max={c.max} step={c.step}
                  onChange={(v) => patch(selected.instanceId,
                    k === 'height' ? { dims: { height: v }, autoHeight: false } : { dims: { [k]: v } })} />
              );
            })}
          </Panel>

          <Panel title="Pozicija">
            <div className="mb-3">
              <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>Zid elementa</div>
              <div className="flex flex-wrap gap-1.5">
                {WALLS.map((w, i) => (
                  <button key={w.id} onClick={() => handleMoveToWall(w.id)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg"
                    style={selected.wall === w.id
                      ? { background: C.accent, color: '#fff' }
                      : { background: C.paper2, border: `1px solid ${C.line}`, color: activeWalls.indexOf(w.id) >= 0 ? C.dim : C.faint }}>
                    Zid {i + 1} · {w.label.split(' ')[0]}
                  </button>
                ))}
              </div>
              <p className="text-xs mt-1.5" style={{ color: C.faint }}>
                Promjena zida traži prvo slobodno mjesto, pa element ne može upasti u susjeda.
              </p>
            </div>

            <Field label="Odmak duž zida" unit="mm" value={selected.offset}
              min={0} max={Math.max(0, wallLength(selected.wall, room) - selected.dims.width)} step={10}
              onChange={handleSetOffset} />

            <Field label="Visina montaže" unit="mm" value={selected.elevation}
              min={0} max={room.height} step={10}
              onChange={(v) => patch(selected.instanceId, { elevation: v, autoElevation: false })} />

            {(selected.autoElevation === false || selected.autoHeight === false) && (
              <div className="flex items-center justify-between px-2.5 py-2 mb-3 rounded-lg text-xs"
                style={{ background: C.warnBg, color: C.warn }}>
                <span>Ručno zaključana kota — ne prati automatiku.</span>
                <button onClick={() => patch(selected.instanceId, { autoElevation: true, autoHeight: true })}
                  className="px-2 py-1 rounded font-medium" style={{ background: '#fff', color: C.warn }}>
                  Vrati
                </button>
              </div>
            )}

            <Field label="Odmak od zida" unit="mm" value={selected.mountOffsetMm || 0}
              min={0} max={120} step={1} onChange={(v) => patch(selected.instanceId, { mountOffsetMm: v })} />

            <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
              <Row label="zauzeće od zida" value={`${selected.dims.depth + (selected.mountOffsetMm || 0)} mm`} />
            </div>
          </Panel>

          <Panel title="Materijali">
            <DecorPicker label="Dekor korpusa" value={selected.corpus.decorId}
              hint={`${fmt(boardPriceOf(selected.corpus.decorId, selected.corpus.thicknessMm))} KM/m² na ${selected.corpus.thicknessMm} mm`}
              onChange={(v) => {
                const th = thicknessesOf(v);
                const t = th.indexOf(selected.corpus.thicknessMm) >= 0 ? selected.corpus.thicknessMm : (th.indexOf(18) >= 0 ? 18 : th[0]);
                patch(selected.instanceId, { corpus: { decorId: v, thicknessMm: t } });
              }} />

            <DecorPicker label="Dekor fronti" value={selected.front.decorId}
              onChange={(v) => {
                const th = thicknessesOf(v);
                const t = th.indexOf(selected.front.thicknessMm) >= 0 ? selected.front.thicknessMm : (th.indexOf(18) >= 0 ? 18 : th[0]);
                patch(selected.instanceId, { front: { decorId: v, thicknessMm: t } });
              }} />

            <Select label="Debljina korpusa" value={String(selected.corpus.thicknessMm)}
              options={thicknessesOf(selected.corpus.decorId).map((t) => ({
                value: String(t), label: `${t} mm · ${fmt(boardPriceOf(selected.corpus.decorId, t))} KM/m²`,
              }))}
              onChange={(v) => patch(selected.instanceId, { corpus: { thicknessMm: Number(v) } })} />

            <Select label="Rubna traka" value={selected.edge.visibleId}
              options={Object.values(EDGE_TYPES).map((e) => ({ value: e.id, label: e.name }))}
              onChange={(v) => patch(selected.instanceId, { edge: { visibleId: v, hiddenId: v } })} />

            {selTpl.runnerSystemId && (
              <Select label="Sistem vodilica" value={selected.runnerSystemId || ''}
                options={Object.values(RUNNER_SYSTEMS).map((r) => ({
                  value: r.id, label: r.name + (runnerCalibrated(r) ? '' : ' — nekalibrisan'),
                }))} onChange={(v) => patch(selected.instanceId, { runnerSystemId: v })} />
            )}

            {selected.shelves > 0 && !(CORNER_MECHANISMS[selected.cornerMechanism] || {}).replacesShelf && (
              <Field label="Broj polica" unit="kom" value={selected.shelves} min={0} max={6} step={1}
                onChange={(v) => patch(selected.instanceId, { shelves: v })} />
            )}

            {selTpl.cornerMechanism && (
              <Select label="Ugaoni mehanizam" value={selected.cornerMechanism || 'shelves'}
                options={Object.values(CORNER_MECHANISMS).map((m) => ({ value: m.id, label: `${m.name}${m.price ? ' · ' + m.price + ' KM' : ''}` }))}
                onChange={(v) => patch(selected.instanceId, { cornerMechanism: v })} />
            )}

            {selTpl.innerDrawerCapable && (
              <label className="flex items-center gap-2 text-sm px-3 py-2.5 mb-3 rounded-xl cursor-pointer"
                style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
                <input type="checkbox" checked={!!selected.hasInnerDrawer}
                  onChange={(e) => patch(selected.instanceId, { hasInnerDrawer: e.target.checked })}
                  style={{ accentColor: C.accent }} />
                Skrivena unutrašnja ladica
              </label>
            )}

            {selTpl.applianceChoices && (
              <Select label="Model aparata" value={selected.applianceId || selTpl.applianceSlot}
                options={selTpl.applianceChoices.map((id) => ({ value: id, label: APPLIANCES[id].name }))}
                onChange={(v) => patch(selected.instanceId, { applianceId: v })} />
            )}

            {selected.type === 'wall' && (
              <>
                <Select label="Dno visećeg" value={selected.upperBottomDetail || 'standard'}
                  options={[{ value: 'standard', label: 'Standardno dno' }, { value: 'led_mask_18', label: 'LED podložna maska 18 mm' }]}
                  onChange={(v) => patch(selected.instanceId, { upperBottomDetail: v })} />
                <Select label="Montaža" value={selected.mountingType || 'hangers'}
                  options={[{ value: 'hangers', label: 'Pojedinačni nosači' }, { value: 'rail', label: 'Kuhinjska šina' }]}
                  onChange={(v) => patch(selected.instanceId, { mountingType: v })} />
              </>
            )}

            <Select label="Otvaranje fronte" value={selected.doorHang || 'flush'}
              options={[{ value: 'flush', label: 'U ravni (sa ručkom)' }, { value: 'overhang', label: 'Produžena 20 mm (bez ručke)' }]}
              onChange={(v) => patch(selected.instanceId, { doorHang: v })} />

            <label className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl cursor-pointer"
              style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
              <input type="checkbox" checked={!!selected.isGlassDoor}
                onChange={(e) => patch(selected.instanceId, { isGlassDoor: e.target.checked })}
                style={{ accentColor: C.accent }} />
              Staklena ispuna fronte
            </label>
          </Panel>

          <Panel title="Okov i otvaranje">
            <Select label="Ručka" value={selected.handleId || 'RUCKA_160'}
              options={Object.values(HANDLES).map((h) => ({ value: h.id, label: `${h.name} · ${h.price} KM` }))}
              onChange={(v) => patch(selected.instanceId, { handleId: v })} />

            <Select label="Strana otvaranja" value={selected.hingeSide || 'left'}
              options={[{ value: 'left', label: 'Šarke lijevo (otvara desno)' }, { value: 'right', label: 'Šarke desno (otvara lijevo)' }]}
              onChange={(v) => patch(selected.instanceId, { hingeSide: v })} />

            <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
              {(() => {
                const h = HANDLES[selected.handleId || 'RUCKA_160'];
                return <>
                  <Row label="tip" value={h.kind} />
                  <Row label="dužina" value={h.lengthMm ? `${h.lengthMm} mm` : '—'} />
                  <Row label="komada" value={handlePlacements(selected, selPanels, project).length} />
                </>;
              })()}
            </div>
          </Panel>

          {(selFronts.length > 0 || selStack.length > 0) && (
            <Panel title="Raspored fronti">
              <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
                {selFronts.map((s, i) => (
                  <Row key={i} label={s.role} value={`${s.widthMm} × ${s.heightMm} · ${s.sizing}`}
                    tone={s.sizing === 'auto' ? C.accentText : null} />
                ))}
                {selStack.slice().reverse().map((s, i) => (
                  <Row key={i} label={s.label}
                    value={s.kind === 'appliance' ? `${s.frontHeightMm} · aparat`
                      : `${s.frontHeightMm} · ${s.kind === 'door' ? 'vrata' : 'sanduk ' + s.boxHeightMm}`} />
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Krojne mjere">
            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
              <table className="w-full text-xs" style={mono}>
                <thead>
                  <tr style={{ background: C.paper3, color: C.dim }}>
                    <th className="text-left px-2 py-1.5 font-medium">Panel</th>
                    <th className="text-right px-1 py-1.5 font-medium">kom</th>
                    <th className="text-right px-2 py-1.5 font-medium">mjera</th>
                    <th className="text-right px-2 py-1.5 font-medium">kant</th>
                  </tr>
                </thead>
                <tbody>
                  {selPanels.map((p, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td className="px-2 py-1 truncate" style={{ maxWidth: 110 }}>{p.role}</td>
                      <td className="text-right px-1 py-1">{p.qty}</td>
                      <td className="text-right px-2 py-1">{p.cutMm.length}×{p.cutMm.width}</td>
                      <td className="text-right px-2 py-1" style={{ color: C.faint }}>
                        {['L1', 'L2', 'W1', 'W2'].map((k) => (p.edges[k] ? '1' : '0')).join('')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-2" style={{ color: C.faint }}>
              Kanterica ima predglodalo, pa je krojna mjera jednaka gotovoj. Kolona „kant" govori mašini na koje ivice ide traka.
            </p>
          </Panel>

          <Panel title="Cijena elementa">
            {Object.entries(selPrice.breakdown).map(([k, v]) => (
              <Row key={k} label={k} value={`${fmt(v)} KM`} />
            ))}
            <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: `1px solid ${C.line}` }}>
              <span className="text-sm font-medium">Bez PDV-a</span>
              <span className="text-sm font-semibold" style={mono}>{fmt(selPrice.net)} KM</span>
            </div>
          </Panel>
        </>
      )}
    </aside>
  );
}