// src/components/app/StartupWizard.jsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { C, mono } from '../../data/theme';
import { WALLS, LEG_HEIGHTS } from '../../data/tech';
import { SHAPES, shapeWalls, ROOM_KINDS } from '../../data/catalog';
import {
  DOOR_TYPES, SEGMENT_COUNTS, SEGMENT_LIMITS, WARDROBE_LIMITS,
  LEG_HEIGHTS as WARDROBE_LEG_HEIGHTS,
  DEFAULT_LOWER_CORPUS_H, DEFAULT_MAX_SLIDING_LEAF_MM, SLIDING_LEAF_LIMITS,
  SIDE_MASK_T, TOP_MASK_H, DOOR_REVEAL_PER_SIDE_MM, MIN_UPPER_CORPUS_MM, PANEL_T,
} from '../../data/wardrobe';
import { Btn, Field, Select } from '../ui/Controls';

function WizChoice({ options, value, onChange, cols }) {
  return (
    <div className={`grid ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)}
          className="px-3 py-3 text-sm font-medium rounded-xl text-left transition-colors"
          style={value === o.id
            ? { background: C.accentSoft, border: `1.5px solid ${C.accent}`, color: C.accentText }
            : { background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function NumCell({ label, value, onChange, step }) {
  return (
    <label className="text-xs block" style={{ color: C.dim }}>
      {label}
      <input type="number" value={value} step={step || 10}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
        style={{ ...mono, background: C.paper, border: `1px solid ${C.line}`, color: C.text }} />
    </label>
  );
}

function OpeningRows({ items, onChange, kind, walls }) {
  return (
    <div className="space-y-2 max-h-56 overflow-y-auto">
      {items.map((o, i) => (
        <div key={i} className="p-2.5 rounded-xl" style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
          <div className="text-xs font-semibold mb-1.5" style={{ color: C.dim }}>
            {kind === 'prozor' ? 'Prozor' : 'Vrata'} {i + 1}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="text-xs block" style={{ color: C.dim }}>
              zid
              <select value={o.wall}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, wall: e.target.value } : x)))}
                className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                style={{ background: C.paper, border: `1px solid ${C.line}` }}>
                {walls.map((wl) => <option key={wl.id} value={wl.id}>{wl.label}</option>)}
              </select>
            </label>
            <NumCell label="od početka zida" value={o.offset}
              onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, offset: v } : x)))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumCell label="širina" value={o.width}
              onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, width: v } : x)))} />
            <NumCell label="visina" value={o.height}
              onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, height: v } : x)))} />
            {kind === 'prozor'
              ? <NumCell label="parapet" value={o.sill}
                  onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, sill: v } : x)))} />
              : <div className="text-xs flex items-end pb-1.5" style={{ color: C.faint }}>od poda</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StartupWizard({ room, onFinish, onClose }) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState('kuhinja');
  const [shape, setShape] = useState('L');
  const [upperCorners, setUpperCorners] = useState(true);
  const [autoLayout, setAutoLayout] = useState(true);
  const [dishW, setDishW] = useState(600);
  const [ledMask, setLedMask] = useState(true);
  const [wallPanel, setWallPanel] = useState(true);
  const [wallPanelH, setWallPanelH] = useState(600);
  const [ovenType, setOvenType] = useState('base');
  const [hOrientBase, setHOrientBase] = useState('vertical');
  const [hOrientWall, setHOrientWall] = useState('horizontal');
  const [legHeight, setLegHeight] = useState(150);
  const [w, setW] = useState(room.width);
  const [d, setD] = useState(room.depth);
  const [h, setH] = useState(room.height);
  const [nWin, setNWin] = useState(1);
  const [wins, setWins] = useState([{ wall: 'top', offset: 3000, width: 1200, height: 1200, sill: 900 }]);
  const [nDoor, setNDoor] = useState(1);
  const [doors, setDoors] = useState([{ wall: 'bottom', offset: 300, width: 900, height: 2050, sill: 0 }]);
  const [water, setWater] = useState({ on: true, wall: 'top', offset: 1400, height: 500 });
  const [nOut, setNOut] = useState(2);
  const [outlets, setOutlets] = useState([
    { wall: 'top', offset: 1200, height: 1150 },
    { wall: 'top', offset: 2400, height: 1150 },
  ]);
  const [wardrobeW, setWardrobeW] = useState(WARDROBE_LIMITS.width.default);
  const [wardrobeH, setWardrobeH] = useState(WARDROBE_LIMITS.height.default);
  const [wardrobeD, setWardrobeD] = useState(WARDROBE_LIMITS.depth.default);
  const [doorType, setDoorType] = useState('baglame');
  const [segmentCount, setSegmentCount] = useState(3);
  const [legHeightMm, setLegHeightMm] = useState(WARDROBE_LEG_HEIGHTS[1]);
  const [lowerCorpusHeightMm, setLowerCorpusHeightMm] = useState(DEFAULT_LOWER_CORPUS_H);
  const [topMaskHeightMm, setTopMaskHeightMm] = useState(TOP_MASK_H);
  const [maxSlidingLeafWidthMm, setMaxSlidingLeafWidthMm] = useState(DEFAULT_MAX_SLIDING_LEAF_MM);

  /* Izvedene veličine novog modela — računaju se ovdje samo za prikaz u
     čarobnjaku; engine ih računa isto tako u `wardrobeLayout.js`. */
  const wKorpusa = wardrobeW - 2 * SIDE_MASK_T;
  const wSegmenta = Math.round(wKorpusa / Math.max(1, segmentCount));
  const wSvijetlo = wSegmenta - 2 * PANEL_T;
  const wLadicar = wSvijetlo - 100;
  const hKorpusi = wardrobeH - legHeightMm - topMaskHeightMm;
  const hGornji = hKorpusi - lowerCorpusHeightMm;
  const hVrata = hKorpusi - 2 * DOOR_REVEAL_PER_SIDE_MM;
  const ids = kind === 'kuhinja'
    ? ['tip', 'oblik', 'zidovi', 'otvori', 'voda', 'struja']
    : kind === 'spavaca'
      ? ['tip', 'zidovi', 'ormar', 'vrata']
      : ['tip', 'zidovi', 'otvori'];
  const cur = ids[step];
  const titles = {
    tip: 'Tip prostorije', oblik: 'Oblik kuhinje', zidovi: 'Prostorija', otvori: 'Prozori i vrata',
    voda: 'Voda', struja: 'Struja', ormar: 'Dimenzije ormara', vrata: 'Vrata i segmenti',
  };
  const grow = (arr, n, seed) => {
    const out = arr.slice(0, n);
    while (out.length < n) out.push({ ...seed, offset: seed.offset + 1500 * out.length });
    return out;
  };
  const finish = (skip) => onFinish({
    kind,
    shape: kind === 'kuhinja' ? shape : 'ravna',
    upperCorners, autoLayout, legHeight, dishW, ledMask, ovenType, hOrientBase, hOrientWall, wallPanel, wallPanelH,
    room: { width: w, depth: d, height: h },
    windows: (skip === 'otvori') ? [] : wins.slice(0, nWin),
    doors: (skip === 'otvori') ? [] : doors.slice(0, nDoor),
    water: (skip === 'voda' || !water.on) ? null : water,
    outlets: (skip === 'struja') ? [] : outlets.slice(0, nOut),
    wardrobeW, wardrobeH, wardrobeD, doorType, segmentCount, legHeightMm,
    lowerCorpusHeightMm, topMaskHeightMm, maxSlidingLeafWidthMm,
  });
  const wallOpts = WALLS;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(15,23,42,0.5)' }}>
      <div className="w-full max-w-lg" style={{ background: C.bg, borderRadius: 18 }}>
        <div className="px-5 py-4" style={{ background: C.paper, borderBottom: `1px solid ${C.line}`, borderRadius: '18px 18px 0 0' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Novi projekat</div>
              <div className="text-xs" style={{ color: C.faint }}>Korak {step + 1} od {ids.length} · {titles[cur]}</div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: C.paper2 }} aria-label="Zatvori">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-1.5">
            {ids.map((_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full" style={{ background: i <= step ? C.accent : C.line }} />
            ))}
          </div>
        </div>
        <div className="p-5" style={{ minHeight: 300 }}>
          {cur === 'tip' && (
            <>
              <p className="text-xs mb-3" style={{ color: C.dim }}>Za koju prostoriju radimo projekat?</p>
              <WizChoice options={ROOM_KINDS} value={kind}
                onChange={(v) => { setKind(v); setStep(0); }} />
            </>
          )}
          {cur === 'oblik' && (
            <>
              <p className="text-xs mb-3" style={{ color: C.dim }}>
                Oblik određuje koji zidovi ostaju vidljivi i gdje idu ugaoni elementi.
              </p>
              <WizChoice options={SHAPES} value={shape} onChange={setShape} cols={3} />
              <p className="text-xs mt-3 mb-3" style={{ color: C.faint }}>
                Aktivni zidovi: {shapeWalls(shape).map((id) => WALLS.find((x) => x.id === id).label).join(', ')}
              </p>
              <div className="space-y-2">
                {shape !== 'ravna' && (
                  <label className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl cursor-pointer"
                    style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
                    <input type="checkbox" checked={upperCorners} onChange={(e) => setUpperCorners(e.target.checked)}
                      style={{ accentColor: C.accent }} />
                    Dodaj i gornje (viseće) ugaone elemente
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl cursor-pointer"
                  style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
                  <input type="checkbox" checked={autoLayout} onChange={(e) => setAutoLayout(e.target.checked)}
                    style={{ accentColor: C.accent }} />
                  Automatski predloži raspored (radni trokut)
                </label>
                <div>
                  <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>Mašina za suđe</div>
                  <div className="flex gap-2">
                    {[600, 450].map((v) => (
                      <button key={v} onClick={() => setDishW(v)}
                        className="flex-1 px-3 py-2 text-sm font-medium rounded-xl"
                        style={dishW === v ? { background: C.accent, color: '#fff' }
                          : { background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>
                        {v} mm
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl cursor-pointer"
                  style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
                  <input type="checkbox" checked={ledMask} onChange={(e) => setLedMask(e.target.checked)}
                    style={{ accentColor: C.accent }} />
                  LED maska ispod visećih elemenata (20 mm, bez nape)
                </label>
                <label className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl cursor-pointer"
                  style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
                  <input type="checkbox" checked={wallPanel} onChange={(e) => setWallPanel(e.target.checked)}
                    style={{ accentColor: C.accent }} />
                  Zidna obloga između radne ploče i visećih
                </label>
                {wallPanel && (
                  <Field label="Visina zidne obloge" unit="mm" value={wallPanelH} min={200} max={1200} step={10}
                    onChange={setWallPanelH} />
                )}
                <div>
                  <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>Pećnica</div>
                  <div className="flex gap-2">
                    {[['base', 'Donji element'], ['tall', 'Visoki ormar']].map(([v, l]) => (
                      <button key={v} onClick={() => setOvenType(v)}
                        className="flex-1 px-3 py-2 text-sm font-medium rounded-xl"
                        style={ovenType === v ? { background: C.accent, color: '#fff' }
                          : { background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[['Ručke donjih', hOrientBase, setHOrientBase], ['Ručke visećih', hOrientWall, setHOrientWall]].map(([lbl, val, set]) => (
                    <div key={lbl}>
                      <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>{lbl}</div>
                      <div className="flex gap-1.5">
                        {[['vertical', 'Uspravno'], ['horizontal', 'Položeno']].map(([v, l]) => (
                          <button key={v} onClick={() => set(v)}
                            className="flex-1 px-2 py-2 text-xs font-medium rounded-lg"
                            style={val === v ? { background: C.accent, color: '#fff' }
                              : { background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>{l}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {cur === 'zidovi' && (
            <>
              <p className="text-xs mb-3" style={{ color: C.dim }}>
                Dužine zidova. Nasuprotni zidovi su jednaki jer je prostorija pravougaona.
              </p>
              <Field label="Gornji i donji zid" unit="mm" value={w} min={1000} max={12000} step={10} strong onChange={setW} />
              <Field label="Lijevi i desni zid" unit="mm" value={d} min={1000} max={12000} step={10} strong onChange={setD} />
              <Field label="Visina prostorije" unit="mm" value={h} min={2000} max={3600} step={10} onChange={setH} />
              {kind === 'kuhinja' && (
                <div className="mt-1">
                  <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>Visina nogica</div>
                  <div className="flex gap-2">
                    {LEG_HEIGHTS.map((v) => (
                      <button key={v} onClick={() => setLegHeight(v)}
                        className="flex-1 px-3 py-2 text-sm font-medium rounded-xl"
                        style={legHeight === v
                          ? { background: C.accent, color: '#fff' }
                          : { background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>
                        {v} mm
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {cur === 'ormar' && (
            <>
              <p className="text-xs mb-3" style={{ color: C.dim }}>
                Širina ormara UKLJUČUJE bočne maske (2 × {SIDE_MASK_T} mm), a visina je
                visina PROSTORA — iz nje se izvode korpusi i maske. Dubina korpusa je
                editabilna i utiče na krojnu listu, cijenu i dubinu bočnih maski.
              </p>
              <Field label="Širina ormara (sa maskama)" unit="mm" value={wardrobeW}
                min={WARDROBE_LIMITS.width.min} max={WARDROBE_LIMITS.width.max} step={WARDROBE_LIMITS.width.step}
                strong onChange={setWardrobeW} />
              <Field label="Visina prostora" unit="mm" value={wardrobeH}
                min={WARDROBE_LIMITS.height.min} max={WARDROBE_LIMITS.height.max} step={WARDROBE_LIMITS.height.step}
                strong onChange={setWardrobeH} />
              <Field label="Dubina korpusa" unit="mm" value={wardrobeD}
                min={WARDROBE_LIMITS.depth.min} max={WARDROBE_LIMITS.depth.max} step={WARDROBE_LIMITS.depth.step}
                onChange={setWardrobeD} />
              <Field label="Donji korpus" unit="mm" value={lowerCorpusHeightMm} strong
                min={500} max={Math.max(600, hKorpusi - 50)} step={10}
                onChange={setLowerCorpusHeightMm} />
              <Field label="Gornja maska" unit="mm" value={topMaskHeightMm}
                min={20} max={400} step={5} onChange={setTopMaskHeightMm} />
              <div className="rounded-lg px-2.5 py-2 mb-3" style={{ background: C.paper2 }}>
                <div className="flex justify-between text-xs py-0.5">
                  <span style={{ color: C.dim }}>gornji korpus (izvedeno)</span>
                  <b style={{ ...mono, color: hGornji < MIN_UPPER_CORPUS_MM ? C.danger : C.text }}>{hGornji} mm</b>
                </div>
                <div className="flex justify-between text-xs py-0.5">
                  <span style={{ color: C.dim }}>visina vrata</span>
                  <b style={mono}>{hVrata} mm</b>
                </div>
                <div className="flex justify-between text-xs py-0.5">
                  <span style={{ color: C.dim }}>dubina bočne maske</span>
                  <b style={mono}>{3 + wardrobeD + 18} mm</b>
                </div>
              </div>
              {hGornji < MIN_UPPER_CORPUS_MM && (
                <p className="text-xs mb-3" style={{ color: C.danger }}>
                  Gornji korpus ispada {hGornji} mm (ispod preporučenih {MIN_UPPER_CORPUS_MM} mm) —
                  smanjite donji korpus ili povećajte visinu prostora.
                </p>
              )}
              {wardrobeW > w && (
                <p className="text-xs mt-2" style={{ color: C.danger }}>
                  Širina ormara je veća od zida prostorije ({w} mm) — vrati se na prethodni korak i uskladi dimenzije.
                </p>
              )}
            </>
          )}
          {cur === 'vrata' && (
            <>
              <p className="text-xs mb-3" style={{ color: C.dim }}>Tip vrata i broj vertikalnih segmenata (korpusa) ormara.</p>
              <div className="mb-4">
                <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>Tip vrata</div>
                <WizChoice options={DOOR_TYPES} value={doorType} onChange={setDoorType} />
              </div>
              <div className="mb-4">
                <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>Visina nogica</div>
                <div className="flex gap-2">
                  {WARDROBE_LEG_HEIGHTS.map((v) => (
                    <button key={v} onClick={() => setLegHeightMm(v)}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-xl"
                      style={legHeightMm === v
                        ? { background: C.accent, color: '#fff' }
                        : { background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>
                      {v} mm
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs mb-1.5 font-medium" style={{ color: C.dim }}>
                  Broj segmenata ({SEGMENT_LIMITS.min}–{SEGMENT_LIMITS.max})
                </div>
                <div className="flex gap-2">
                  {SEGMENT_COUNTS.map((v) => (
                    <button key={v} onClick={() => setSegmentCount(v)}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-xl"
                      style={segmentCount === v
                        ? { background: C.accent, color: '#fff' }
                        : { background: C.paper2, border: `1px solid ${C.line}`, color: C.text }}>
                      {v} dijela
                    </button>
                  ))}
                </div>
                <div className="rounded-lg px-2.5 py-2 mt-2 mb-2" style={{ background: C.paper2 }}>
                  <div className="flex justify-between text-xs py-0.5">
                    <span style={{ color: C.dim }}>širina korpusa (bez maski)</span><b style={mono}>{wKorpusa} mm</b>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span style={{ color: C.dim }}>širina segmenta</span><b style={{ ...mono, color: C.accentText }}>{wSegmenta} mm</b>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span style={{ color: C.dim }}>svijetla širina segmenta</span><b style={mono}>{wSvijetlo} mm</b>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span style={{ color: C.dim }}>širina ladičara (−100)</span><b style={mono}>{wLadicar} mm</b>
                  </div>
                </div>
                <p className="text-xs mt-1" style={{ color: C.faint }}>
                  Konstrukcija: nogice {legHeightMm} + donji korpus {lowerCorpusHeightMm}
                  {' '}+ gornji korpus <b style={mono}>{hGornji}</b> + gornja maska {topMaskHeightMm}
                  {' '}= {wardrobeH} mm.
                </p>
                {doorType === 'klizna' && (
                  <div className="mt-3">
                    <Field label="Najšire klizno krilo" unit="mm" strong value={maxSlidingLeafWidthMm}
                      min={SLIDING_LEAF_LIMITS.min} max={SLIDING_LEAF_LIMITS.max} step={SLIDING_LEAF_LIMITS.step}
                      onChange={setMaxSlidingLeafWidthMm} />
                    <p className="text-xs" style={{ color: C.faint }}>
                      Broj krila: <b style={mono}>{Math.max(2, Math.ceil(wKorpusa / maxSlidingLeafWidthMm))}</b> za
                      širinu korpusa {wKorpusa} mm.
                    </p>
                  </div>
                )}
                {doorType === 'baglame' && (
                  <p className="text-xs mt-2" style={{ color: C.faint }}>
                    Vrata: <b style={mono}>{wSegmenta - 2 * DOOR_REVEAL_PER_SIDE_MM} mm</b> široko
                    (jedno krilo po segmentu) × <b style={mono}>{hVrata} mm</b> visoko.
                  </p>
                )}
                <p className="text-xs mt-2" style={{ color: C.faint }}>
                  Raspored ladičara, šipki i polica po korpusu (donji/gornji) podešava se u sljedećem koraku.
                </p>
              </div>
            </>
          )}
          {cur === 'otvori' && (
            <>
              <p className="text-xs mb-3" style={{ color: C.dim }}>
                Otvori se crtaju u 3D-u i tlocrtu, a kolizija ne dozvoljava element preko njih.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Broj prozora" unit="kom" value={nWin} min={0} max={6} step={1}
                  onChange={(n) => { setNWin(n); setWins((a) => grow(a, n, { wall: 'top', offset: 3000, width: 1200, height: 1200, sill: 900 })); }} />
                <Field label="Broj vrata" unit="kom" value={nDoor} min={0} max={4} step={1}
                  onChange={(n) => { setNDoor(n); setDoors((a) => grow(a, n, { wall: 'bottom', offset: 300, width: 900, height: 2050, sill: 0 })); }} />
              </div>
              {nWin > 0 && <OpeningRows items={wins.slice(0, nWin)} onChange={setWins} kind="prozor" walls={wallOpts} />}
              {nDoor > 0 && <div className="mt-2"><OpeningRows items={doors.slice(0, nDoor)} onChange={setDoors} kind="vrata" walls={wallOpts} /></div>}
            </>
          )}
          {cur === 'voda' && (
            <>
              <p className="text-xs mb-3" style={{ color: C.dim }}>
                Gdje je odvod? Sistem će tu automatski postaviti donji element za sudoper.
              </p>
              <Select label="Zid" value={water.wall} options={wallOpts.map((x) => ({ value: x.id, label: x.label }))}
                onChange={(v) => setWater({ ...water, on: true, wall: v })} />
              <Field label="Udaljenost od početka zida" unit="mm" value={water.offset} min={0} max={12000} step={10} strong
                onChange={(v) => setWater({ ...water, on: true, offset: v })} />
              <Field label="Visina od poda" unit="mm" value={water.height} min={0} max={2000} step={10}
                onChange={(v) => setWater({ ...water, on: true, height: v })} />
            </>
          )}
          {cur === 'struja' && (
            <>
              <p className="text-xs mb-3" style={{ color: C.dim }}>
                Utičnice govore gdje idu aparati i gdje se izbijaju leđa.
              </p>
              <Field label="Broj utičnica" unit="kom" value={nOut} min={0} max={8} step={1} strong
                onChange={(n) => { setNOut(n); setOutlets((a) => grow(a, n, { wall: 'top', offset: 600, height: 1150 })); }} />
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {outlets.slice(0, nOut).map((o, i) => (
                  <div key={i} className="p-2.5 rounded-xl" style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
                    <div className="text-xs font-semibold mb-1.5" style={{ color: C.dim }}>Utičnica {i + 1}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-xs block" style={{ color: C.dim }}>
                        zid
                        <select value={o.wall}
                          onChange={(e) => setOutlets(outlets.map((x, j) => (j === i ? { ...x, wall: e.target.value } : x)))}
                          className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                          style={{ background: C.paper, border: `1px solid ${C.line}` }}>
                          {wallOpts.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                      </label>
                      <NumCell label="od zida" value={o.offset}
                        onChange={(v) => setOutlets(outlets.map((x, j) => (j === i ? { ...x, offset: v } : x)))} />
                      <NumCell label="visina" value={o.height}
                        onChange={(v) => setOutlets(outlets.map((x, j) => (j === i ? { ...x, height: v } : x)))} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ background: C.paper, borderTop: `1px solid ${C.line}`, borderRadius: '0 0 18px 18px' }}>
          <Btn size="sm" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
            {step === 0 ? 'Odustani' : 'Nazad'}
          </Btn>
          <div className="flex gap-2">
            <Btn size="sm" onClick={() => {
              const rest = ids.length - 1 - step;
              if (rest > 0 && !window.confirm(
                `Završiti sada i preskočiti preostalih ${rest} koraka?\n`
                + 'Podaci iz ovog i preostalih koraka neće biti uneseni — koriste se podrazumijevane vrijednosti.')) return;
              finish(cur);
            }}>
              {step >= ids.length - 1 ? 'Preskoči ovaj korak' : 'Završi, preskoči ostalo'}
            </Btn>
            <Btn size="sm" variant="primary" onClick={() => (step >= ids.length - 1 ? finish() : setStep(step + 1))}>
              {step >= ids.length - 1 ? 'Završi' : 'Dalje'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}