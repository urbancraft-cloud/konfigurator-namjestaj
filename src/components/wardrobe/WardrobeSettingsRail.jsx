// src/components/wardrobe/WardrobeSettingsRail.jsx
import React from 'react';
import { C } from '../../data/theme';
import {
  DOOR_TYPES, SEGMENT_COUNTS, SEGMENT_LIMITS, WARDROBE_LIMITS, LEG_HEIGHTS,
  MIN_UPPER_CORPUS_MM, SLIDING_LEAF_LIMITS, WARDROBE_LEGS_PER_SEGMENT,
  SIDE_MASK_T, PANEL_T, BACK_T, DOOR_T, DOOR_REVEAL_PER_SIDE_MM,
} from '../../data/wardrobe';
import { Panel } from '../ui/Panel';
import { Field } from '../ui/Controls';
import { Row, Note } from '../ui/DataDisplay';
import { DecorPicker } from '../ui/DecorPicker';
import { useWardrobeStore } from '../../store/wardrobeStore';
import {
  upperCorpusHeightMm, isUpperCorpusValid, segmentWidthMm, segmentInteriorWidthMm,
  carcassWidthMm, totalCorpusHeightMm, topMaskHeightMm, bottomMaskHeightMm,
  lowerCorpusHeightMm, sideMaskDepthMm, computedSideMaskDepthMm, sideMaskIsManual,
  sideMaskHeightMm, doorHeightMm, hingedLeafWidthMm, hingedLeavesPerSegment,
  hingesPerLeaf, slidingLeafCount, slidingLeafWidthMm, maxSlidingLeafOf,
  drawerUnitWidthMm, heightChecksum,
} from '../../engine/wardrobeLayout';
import { legCountOf } from '../../engine/wardrobePricing';

export function WardrobeSettingsRail({ floating = false, onNavigate }) {
  const room = useWardrobeStore((s) => s.room);
  const setRoom = useWardrobeStore((s) => s.setRoom);
  const wardrobe = useWardrobeStore((s) => s.wardrobe);
  const setWardrobeDims = useWardrobeStore((s) => s.setWardrobeDims);
  const setLegHeight = useWardrobeStore((s) => s.setLegHeight);
  const setLowerCorpusHeight = useWardrobeStore((s) => s.setLowerCorpusHeight);
  const setTopMaskHeight = useWardrobeStore((s) => s.setTopMaskHeight);
  const setSideMaskDepth = useWardrobeStore((s) => s.setSideMaskDepth);
  const setDoorHeight = useWardrobeStore((s) => s.setDoorHeight);
  const setDoorType = useWardrobeStore((s) => s.setDoorType);
  const setSegmentCount = useWardrobeStore((s) => s.setSegmentCount);
  const setMaxSlidingLeafWidthMm = useWardrobeStore((s) => s.setMaxSlidingLeafWidthMm);
  const setCorpusDecorId = useWardrobeStore((s) => s.setCorpusDecorId);
  const setDoorDecorId = useWardrobeStore((s) => s.setDoorDecorId);

  const w = wardrobe;
  const hProstor = Number(w.roomHeightMm) || 2600;
  const hUpper = Math.round(upperCorpusHeightMm(w));
  const valid = isUpperCorpusValid(w, MIN_UPPER_CORPUS_MM);
  const check = heightChecksum(w);
  const klizna = w.doorType === 'klizna';

  return (
    <aside
      className={floating
        ? 'fixed top-0 bottom-0 left-0 z-40 w-80 max-w-[86vw] overflow-y-auto shadow-2xl p-3'
        : 'w-72 shrink-0 overflow-y-auto pr-1'}
      style={floating ? { background: C.bg } : undefined}
      aria-label="Postavke ormara">

      {floating && onNavigate && (
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={onNavigate} className="px-2.5 py-1.5 text-xs rounded-lg"
            style={{ background: C.paper, border: `1px solid ${C.line}` }}>Zatvori panel</button>
        </div>
      )}

      <Panel title="Prostorija">
        <Field label="Širina prostora" unit="mm" value={room.width} min={1500} max={9000} step={50}
          onChange={(v) => setRoom({ ...room, width: v })} />
        <Field label="Dubina prostora" unit="mm" value={room.depth} min={1500} max={9000} step={50}
          onChange={(v) => setRoom({ ...room, depth: v })} />
        <Field label="Visina prostora (H_prostor)" unit="mm" strong
          value={hProstor}
          min={WARDROBE_LIMITS.height.min} max={WARDROBE_LIMITS.height.max} step={WARDROBE_LIMITS.height.step}
          onChange={(v) => setWardrobeDims({ roomHeightMm: v })} />
        {w.widthMm > room.width && (
          <p className="text-xs mb-2" style={{ color: C.danger }}>
            Ormar ({w.widthMm} mm) je širi od prostorije ({room.width} mm).
          </p>
        )}
      </Panel>

      <Panel title="Konstrukcija — visine">
        <div className="mb-3">
          <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>
            Nogice = donja maska
          </div>
          <div className="flex gap-2 mb-2">
            {LEG_HEIGHTS.map((v) => (
              <button key={v} type="button" onClick={() => setLegHeight(v)}
                className="flex-1 px-3 py-2 text-sm font-medium rounded-xl transition-colors"
                style={w.legHeightMm === v
                  ? { background: C.accent, color: '#fff' }
                  : { background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>
                {v} mm
              </button>
            ))}
          </div>
        </div>

        <Field label="Donji korpus" unit="mm" strong
          value={lowerCorpusHeightMm(w)} min={500} max={Math.max(600, hProstor - 200)} step={10}
          onChange={setLowerCorpusHeight} />
        <Field label="Gornja maska" unit="mm"
          value={topMaskHeightMm(w)} min={20} max={400} step={5}
          onChange={setTopMaskHeight} />

        <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
          <Row label="nogice / donja maska" value={`${Math.round(bottomMaskHeightMm(w))} mm`} />
          <Row label="donji korpus" value={`${Math.round(lowerCorpusHeightMm(w))} mm`} tone={C.accentText} />
          <Row label="gornji korpus (izvedeno)" value={`${hUpper} mm`} tone={valid ? null : C.danger} />
          <Row label="gornja maska" value={`${Math.round(topMaskHeightMm(w))} mm`} />
          <Row label="korpusi ukupno" value={`${Math.round(totalCorpusHeightMm(w))} mm`} />
        </div>

        {!check.ok && (
          <Note kind="error">
            Visine se ne slažu: sastav daje {check.sumMm} mm, a prostor je {check.roomHeightMm} mm.
          </Note>
        )}
        {hUpper <= 0 ? (
          <Note kind="error">
            Gornji korpus je {hUpper} mm — donji korpus je previsok za ovaj prostor.
            Smanjite donji korpus ili nogice, odnosno povećajte visinu prostora.
          </Note>
        ) : !valid ? (
          <Note kind="warn">
            Gornji korpus je samo {hUpper} mm (ispod preporučenih {MIN_UPPER_CORPUS_MM} mm) —
            provjerite da li je izvodiv.
          </Note>
        ) : null}
      </Panel>

      <Panel title="Dimenzije ormara">
        <Field label="Širina ormara (sa maskama)" unit="mm" strong
          value={w.widthMm}
          min={WARDROBE_LIMITS.width.min} max={WARDROBE_LIMITS.width.max} step={WARDROBE_LIMITS.width.step}
          onChange={(v) => setWardrobeDims({ widthMm: v })} />
        <Field label="Dubina korpusa" unit="mm" strong
          value={w.depthMm}
          min={WARDROBE_LIMITS.depth.min} max={WARDROBE_LIMITS.depth.max} step={WARDROBE_LIMITS.depth.step}
          onChange={(v) => setWardrobeDims({ depthMm: v })} />
        <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
          <Row label="širina korpusa (bez maski)" value={`${Math.round(carcassWidthMm(w))} mm`} />
          <Row label="bočna maska L" value={`${SIDE_MASK_T} mm`} />
          <Row label="bočna maska D" value={`${SIDE_MASK_T} mm`} />
        </div>
        <p className="text-xs mt-1.5" style={{ color: C.faint }}>
          Bočne maske stoje VAN korpusa, pa je širina korpusa za 36 mm manja od
          ukupne širine ormara.
        </p>
      </Panel>

      <Panel title="Bočne maske">
        <div className="rounded-lg px-2.5 py-2 mb-3" style={{ background: C.paper2 }}>
          <Row label="izračunata dubina" value={`${BACK_T} + ${w.depthMm} + ${DOOR_T} = ${Math.round(computedSideMaskDepthMm(w))} mm`} />
          <Row label="visina" value={`${Math.round(sideMaskHeightMm(w))} mm (H_prostor)`} />
          <Row label="debljina" value={`${SIDE_MASK_T} mm`} />
        </div>
        {(['left', 'right']).map((side) => {
          const naziv = side === 'left' ? 'Lijeva maska' : 'Desna maska';
          const manual = sideMaskIsManual(w, side);
          const value = sideMaskDepthMm(w, side);
          return (
            <div key={side} className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: C.text }}>{naziv}</span>
                {manual && (
                  <button type="button"
                    onClick={() => setSideMaskDepth(side, null)}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: C.warnBg, color: C.warn }}>vrati na auto</button>
                )}
              </div>
              <Field label="Dubina maske" unit="mm" value={Math.round(value)}
                min={50} max={Math.round(computedSideMaskDepthMm(w))} step={5}
                onChange={(v) => setSideMaskDepth(side, v)} />
            </div>
          );
        })}
        <p className="text-xs" style={{ color: C.faint }}>
          Kad je maska uz sam zid, ne ide puna dubina — prepišite je ručno za tu
          stranu.
        </p>
      </Panel>

      <Panel title="Segmenti">
        <div className="flex gap-2 mb-2">
          {SEGMENT_COUNTS.map((v) => (
            <button key={v} type="button" onClick={() => setSegmentCount(v)}
              className="flex-1 px-3 py-2 text-sm font-medium rounded-xl transition-colors"
              style={w.segmentCount === v
                ? { background: C.accent, color: '#fff' }
                : { background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>
              {v}
            </button>
          ))}
        </div>
        <Field label="Broj segmenata" unit="kom" value={w.segmentCount}
          min={SEGMENT_LIMITS.min} max={SEGMENT_LIMITS.max} step={1}
          onChange={(v) => setSegmentCount(Math.round(v))} />
        <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
          <Row label="širina segmenta" value={`${Math.round(segmentWidthMm(w))} mm`} tone={C.accentText} />
          <Row label="svijetla širina segmenta" value={`${Math.round(segmentInteriorWidthMm(w))} mm`} />
          <Row label="širina ladičara (−100)" value={`${Math.round(drawerUnitWidthMm(w))} mm`} />
        </div>
        <p className="text-xs mt-1.5" style={{ color: C.faint }}>
          Smanjenje broja segmenata briše raspored u uklonjenim segmentima.
        </p>
      </Panel>

      <Panel title="Vrata">
        <div className="flex flex-col gap-1.5 mb-3">
          {DOOR_TYPES.map((d) => (
            <button key={d.id} type="button" onClick={() => setDoorType(d.id)}
              className="px-3 py-2.5 text-sm font-medium rounded-xl text-left transition-colors"
              style={w.doorType === d.id
                ? { background: C.accentSoft, border: `1.5px solid ${C.accent}`, color: C.accentText }
                : { background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>
              {d.label}
            </button>
          ))}
        </div>

        <Field label="Visina vrata" unit="mm" strong value={Math.round(doorHeightMm(w))}
          min={500} max={Math.max(600, Math.round(totalCorpusHeightMm(w)))} step={2}
          onChange={setDoorHeight} />
        <p className="text-xs mb-3" style={{ color: C.faint }}>
          Automatski: {Math.round(totalCorpusHeightMm(w))} − {2 * DOOR_REVEAL_PER_SIDE_MM} mm fuge =
          {' '}{Math.round(totalCorpusHeightMm(w) - 2 * DOOR_REVEAL_PER_SIDE_MM)} mm.
          Vrata prekrivaju samo vertikalu korpusa, bez gornje i donje maske.
        </p>

        <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
          {klizna ? (
            <>
              <Row label="broj krila" value={`${slidingLeafCount(w)} kom`} tone={C.accentText} />
              <Row label="krojna širina krila" value={`${slidingLeafWidthMm(w)} mm`} />
              <Row label="svjetlo po krilu" value={`${Math.round(carcassWidthMm(w) / slidingLeafCount(w))} mm`} />
            </>
          ) : (
            <>
              <Row label="krila po segmentu" value={`${hingedLeavesPerSegment(w)} kom`} tone={C.accentText} />
              <Row label="širina krila" value={`${hingedLeafWidthMm(w)} mm`} />
              <Row label="ukupno krila" value={`${hingedLeavesPerSegment(w) * w.segmentCount} kom`} />
              <Row label="šarke po krilu" value={`${hingesPerLeaf(w)} kom`} />
            </>
          )}
          <Row label="visina vrata" value={`${Math.round(doorHeightMm(w))} mm`} />
        </div>

        {klizna && (
          <div className="mt-3">
            <Field label="Najšire krilo" unit="mm" strong
              value={maxSlidingLeafOf(w)}
              min={SLIDING_LEAF_LIMITS.min} max={SLIDING_LEAF_LIMITS.max} step={SLIDING_LEAF_LIMITS.step}
              onChange={setMaxSlidingLeafWidthMm} />
          </div>
        )}
      </Panel>

      <Panel title="Nogice (okov)">
        <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
          <Row label="ukupno nogica" value={`${legCountOf(w)} kom`} tone={C.accentText} />
          <Row label="po segmentu" value={`${WARDROBE_LEGS_PER_SEGMENT} kom`} />
          <Row label="visina" value={`${Math.round(bottomMaskHeightMm(w))} mm`} />
        </div>
      </Panel>

      <Panel title="Materijali">
        <DecorPicker label="Dekor korpusa i maski" value={w.corpusDecorId} onChange={setCorpusDecorId} />
        <DecorPicker label="Dekor vrata" value={w.doorDecorId} onChange={setDoorDecorId} />
        <div className="rounded-lg px-2.5 py-2" style={{ background: C.paper2 }}>
          <Row label="korpus / maske" value={`${PANEL_T} mm`} />
          <Row label="leđa (lesomal)" value={`${BACK_T} mm`} />
          <Row label="vrata" value={`${DOOR_T} mm`} />
        </div>
      </Panel>
    </aside>
  );
}
