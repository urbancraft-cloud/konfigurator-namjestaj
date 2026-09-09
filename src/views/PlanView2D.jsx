// src/views/PlanView2D.jsx
import React, { useRef, useState, useMemo } from 'react';
import { C, mono } from '../data/theme';
import { WALLS } from '../data/tech';
import { elementAABB, obstacleAABB, bandRect, wallLength } from '../engine/geometry';

const NO_VALIDATION = { errors: [], warnings: [], valid: true };
import { computeWorktops, computeWallPanels, computeEndPanels } from '../engine/surfaces';

const MARGIN = 900;

/**
 * Na koliko milimetara se prevlačenje upisuje u store.
 *
 * PERF-02: `onDrag` mijenja `rawProject`, što u `App.jsx` povlači ponovni
 * `resolveProject` + `surfacesCost` + `projectTotals` + `computeBOM` + validacije
 * (~3,6 ms izmjereno), plus ponovni render cijelog SVG-a. Bez praga se to
 * dešavalo na SVAKI piksel pomjeranja miša (60×/s ≈ 216 ms/s čistog računanja).
 *
 * Element i dalje prati kursor 1:1 — za to je zadužen lokalni `preview` ispod,
 * koji ne dira store.
 */
const DRAG_COMMIT_MM = 25;

function Tick({ x, y, color }) {
  return <line x1={x - 45} y1={y + 45} x2={x + 45} y2={y - 45} stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />;
}

function DimH({ x0, x1, y, label, color = C.ink }) {
  return (
    <g>
      <line x1={x0} y1={y} x2={x1} y2={y} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <Tick x={x0} y={y} color={color} /><Tick x={x1} y={y} color={color} />
      <rect x={(x0 + x1) / 2 - 200} y={y - 145} width={400} height={130} fill={C.paper} />
      <text x={(x0 + x1) / 2} y={y - 50} textAnchor="middle" fontSize="115" fill={color} style={mono}>{label}</text>
    </g>
  );
}

function DimV({ z0, z1, x, label, color = C.ink }) {
  return (
    <g>
      <line x1={x} y1={z0} x2={x} y2={z1} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <Tick x={x} y={z0} color={color} /><Tick x={x} y={z1} color={color} />
      <rect x={x - 260} y={(z0 + z1) / 2 - 70} width={250} height={140} fill={C.paper} />
      <text x={x - 30} y={(z0 + z1) / 2 + 40} textAnchor="end" fontSize="115" fill={color} style={mono}>{label}</text>
    </g>
  );
}

export function PlanView2D({
  project, room, selectedId, onSelect, onDrag, tool, onPlaceService, onMoveCooktop,
  validations, surfaces,
}) {
  const svgRef = useRef(null);
  const drag = useRef(null);
  /** Lokalni pregled pomjeranja — ne dira store, pa ne povlači preračunavanje. */
  const [preview, setPreview] = useState(null);
  const toMM = (evt) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x - MARGIN, z: p.y - MARGIN };
  };
  const wallAt = (p) => {
    const d = [
      { wall: 'top', dist: Math.abs(p.z), off: p.x },
      { wall: 'bottom', dist: Math.abs(room.depth - p.z), off: p.x },
      { wall: 'left', dist: Math.abs(p.x), off: p.z },
      { wall: 'right', dist: Math.abs(room.width - p.x), off: p.z },
    ].sort((a, b) => a.dist - b.dist)[0];
    const len = wallLength(d.wall, room);
    return { wall: d.wall, offset: Math.max(0, Math.min(len, Math.round(d.off))) };
  };
  const canvasClick = (evt) => {
    if (tool === 'select') { onSelect(null); return; }
    const w = wallAt(toMM(evt));
    onPlaceService(tool, w.wall, w.offset);
  };
  const down = (evt, el) => {
    if (tool !== 'select') return;
    evt.stopPropagation();
    onSelect(el.instanceId);
    const p = toMM(evt);
    const along = (el.wall === 'top' || el.wall === 'bottom') ? p.x : p.z;
    drag.current = { id: el.instanceId, grab: along - el.offset, last: el.offset };
    try { svgRef.current.setPointerCapture(evt.pointerId); } catch { /* ignorisano */ }
  };
  const move = (evt) => {
    if (!drag.current) return;
    if (drag.current.cooktop) {
      const ct = (project.cooktops || []).find((c) => c.id === drag.current.id);
      if (!ct) return;
      const p = toMM(evt);
      const along = (ct.wall === 'top' || ct.wall === 'bottom') ? p.x : p.z;
      onMoveCooktop(ct.id, Math.round(along - drag.current.grab));
      return;
    }
    const el = project.elements.find((e) => e.instanceId === drag.current.id);
    if (!el) return;
    const p = toMM(evt);
    const along = (el.wall === 'top' || el.wall === 'bottom') ? p.x : p.z;
    const raw = along - drag.current.grab;
    // Pregled ide lokalno (jeftino), a u store samo kad se pomakne za prag.
    setPreview({ id: el.instanceId, delta: Math.round(raw) - el.offset });
    if (Math.abs(raw - drag.current.last) >= DRAG_COMMIT_MM) {
      drag.current.last = raw;
      onDrag(el.instanceId, raw);
    }
  };
  const up = (evt) => {
    const svg = svgRef.current;
    if (svg && svg.hasPointerCapture && svg.hasPointerCapture(evt.pointerId)) svg.releasePointerCapture(evt.pointerId);
    // Konačna pozicija se upisuje tek na puštanje miša.
    if (drag.current && !drag.current.cooktop) {
      const el = project.elements.find((e) => e.instanceId === drag.current.id);
      if (el) {
        const p = toMM(evt);
        const along = (el.wall === 'top' || el.wall === 'bottom') ? p.x : p.z;
        onDrag(el.instanceId, along - drag.current.grab);
      }
    }
    drag.current = null;
    setPreview(null);
  };
  const rectFor = (el) => {
    const a = elementAABB(el, room);
    /* Za element koji se trenutno prevlači koristimo lokalni pregled, tako da
       prati kursor bez čekanja na store. Pomjeramo samo prikaz — validacija i
       kolizije se i dalje računaju iz stvarnog stanja u store-u. */
    const d = (preview && preview.id === el.instanceId) ? preview.delta : 0;
    if (!d) return { x: a.x0, y: a.z0, w: a.x1 - a.x0, h: a.z1 - a.z0 };
    const along = (el.wall === 'top' || el.wall === 'bottom');
    return {
      x: along ? a.x0 + d : a.x0,
      y: along ? a.z0 : a.z0 + d,
      w: a.x1 - a.x0,
      h: a.z1 - a.z0,
    };
  };
  /* PERF-05: sve tri kalkulacije površina su se ranije izvršavale INLINE U RENDERU
     (unutar IIFE u JSX-u), bez memoizacije — na svaki `pointermove` tokom
     prevlačenja. Izmjereno ~0,56 ms po prolazu.

     `App.jsx` već računa površine (treba ih za lijevi panel), pa ih prosljeđuje
     kroz `surfaces`. Hook se MORA zvati bezuvjetno (pravila hookova) — zato se
     poziva uvijek, ali kad `surfaces` postoji tijelo vrati `null` i ne računa
     ništa, pa je cijena jednaka nuli. */
  const localSurf = useMemo(
    () => (surfaces ? null : {
      wt: computeWorktops(project, room),
      wp: computeWallPanels(project, room),
      zm: computeEndPanels(project, room),
    }),
    [surfaces, project, room],
  );
  const wt = surfaces ? surfaces.wt : localSurf.wt;
  const wp = surfaces ? surfaces.wp : localSurf.wp;
  const zm = surfaces ? surfaces.zm : localSurf.zm;

  const isValid = (e) => ((validations && validations.get(e.instanceId)) || NO_VALIDATION).valid;

  const lower = project.elements.filter((e) => e.type !== 'wall');
  const upper = project.elements.filter((e) => e.type === 'wall');
  return (
    <svg ref={svgRef} viewBox={`0 0 ${room.width + 2 * MARGIN} ${room.depth + 2 * MARGIN}`}
      className="w-full h-full" style={{ background: C.paper, touchAction: 'none' }}
      onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerDown={canvasClick}>
      <defs>
        <pattern id="hatch" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="26" stroke={C.lineStrong} strokeWidth="6" />
        </pattern>
      </defs>
      <g transform={`translate(${MARGIN},${MARGIN})`}>
        <rect x={-120} y={-120} width={room.width + 240} height={room.depth + 240} fill="url(#hatch)" opacity="0.18" />
        <rect x={0} y={0} width={room.width} height={room.depth} fill={C.paper} />
        {(() => {
          const act = (project.activeWalls && project.activeWalls.length) ? project.activeWalls : WALLS.map((x) => x.id);
          const seg = {
            top: [0, 0, room.width, 0], bottom: [0, room.depth, room.width, room.depth],
            left: [0, 0, 0, room.depth], right: [room.width, 0, room.width, room.depth],
          };
          return WALLS.map((w, i) => {
            const on = act.indexOf(w.id) >= 0;
            const g = seg[w.id];
            const mx = (g[0] + g[2]) / 2, my = (g[1] + g[3]) / 2;
            const vert = w.id === 'left' || w.id === 'right';
            return (
              <g key={w.id}>
                <line x1={g[0]} y1={g[1]} x2={g[2]} y2={g[3]}
                  stroke={on ? C.ink : C.lineStrong} strokeWidth={on ? 3 : 1}
                  strokeDasharray={on ? undefined : '24 18'} vectorEffect="non-scaling-stroke" />
                {on && (
                  <text x={vert ? (w.id === 'left' ? 150 : room.width - 150) : mx}
                    y={vert ? my : (w.id === 'top' ? 190 : room.depth - 130)}
                    textAnchor="middle" fontSize="115" fill={C.dim} style={mono}
                    transform={vert ? `rotate(${w.id === 'left' ? -90 : 90} ${w.id === 'left' ? 150 : room.width - 150} ${my})` : undefined}>
                    Zid {i + 1} · {w.label.split(' ')[0]}
                  </text>
                )}
              </g>
            );
          });
        })()}
        {Array.from({ length: Math.floor(room.width / 500) }, (_, i) => (
          <line key={`gx${i}`} x1={(i + 1) * 500} y1={0} x2={(i + 1) * 500} y2={room.depth} stroke={C.line} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        {Array.from({ length: Math.floor(room.depth / 500) }, (_, i) => (
          <line key={`gz${i}`} x1={0} y1={(i + 1) * 500} x2={room.width} y2={(i + 1) * 500} stroke={C.line} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        {project.obstacles.map((ob) => {
          const a = obstacleAABB(ob, room);
          return (
            <g key={ob.id}>
              <rect x={a.x0} y={a.z0} width={a.x1 - a.x0} height={a.z1 - a.z0}
                fill={ob.kind === 'prozor' ? '#BFD7DA' : '#E3D3B8'} stroke={C.ink} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <text x={(a.x0 + a.x1) / 2} y={(a.z0 + a.z1) / 2 + 34} textAnchor="middle" fontSize="90" fill={C.ink} style={mono}>{ob.kind}</text>
            </g>
          );
        })}
        {lower.map((el) => {
          const r = rectFor(el);
          const sel = el.instanceId === selectedId;
          const bad = !isValid(el);
          const f = {
            top: [r.x, r.y + r.h, r.x + r.w, r.y + r.h], bottom: [r.x, r.y, r.x + r.w, r.y],
            left: [r.x + r.w, r.y, r.x + r.w, r.y + r.h], right: [r.x, r.y, r.x, r.y + r.h],
          }[el.wall];
          return (
            <g key={el.instanceId} onPointerDown={(e) => down(e, el)} style={{ cursor: 'grab' }}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h}
                fill={sel ? C.accentSoft : C.paper2}
                stroke={bad ? C.danger : sel ? C.accent : C.ink}
                strokeWidth={sel ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />
              <line x1={f[0]} y1={f[1]} x2={f[2]} y2={f[3]} stroke={C.accent} strokeWidth="3" vectorEffect="non-scaling-stroke" />
              {r.w > 350 && r.h > 250 && (
                <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 30} textAnchor="middle" fontSize="105" fill={C.text} style={mono}>{el.dims.width}</text>
              )}
            </g>
          );
        })}
        {upper.map((el) => {
          const r = rectFor(el);
          const sel = el.instanceId === selectedId;
          const bad = !isValid(el);
          return (
            <g key={el.instanceId} onPointerDown={(e) => down(e, el)} style={{ cursor: 'grab' }}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none"
                stroke={bad ? C.danger : sel ? C.accent : C.dim}
                strokeWidth={sel ? 2.5 : 1.5} strokeDasharray="14 10" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {(() => (
            <g>
              {wt.pieces.map((pc) => (
                <rect key={pc.id} x={pc.rect.x0} y={pc.rect.z0}
                  width={pc.rect.x1 - pc.rect.x0} height={pc.rect.z1 - pc.rect.z0}
                  fill="none" stroke={C.accent} strokeWidth="1.5" strokeDasharray="30 16"
                  vectorEffect="non-scaling-stroke" opacity="0.75" />
              ))}
              {wp.pieces.map((pc) => (
                <rect key={pc.id} x={pc.rect.x0} y={pc.rect.z0}
                  width={Math.max(pc.rect.x1 - pc.rect.x0, 30)} height={Math.max(pc.rect.z1 - pc.rect.z0, 30)}
                  fill={C.warn} opacity="0.8" />
              ))}
              {zm.pieces.map((pc) => (
                <rect key={pc.id} x={pc.rect.x0} y={pc.rect.z0}
                  width={Math.max(pc.rect.x1 - pc.rect.x0, 24)} height={Math.max(pc.rect.z1 - pc.rect.z0, 24)}
                  fill={C.ink} opacity="0.85" />
              ))}
              {wt.joints.filter((j) => j.kind === 'ravni').map((j, i) => {
                const horiz = j.wall === 'top' || j.wall === 'bottom';
                const z0 = j.wall === 'bottom' ? room.depth - wt.depthMm : 0;
                const x0 = j.wall === 'right' ? room.width - wt.depthMm : 0;
                return horiz
                  ? <line key={i} x1={j.atMm} y1={z0} x2={j.atMm} y2={z0 + wt.depthMm}
                      stroke={C.warn} strokeWidth="3" vectorEffect="non-scaling-stroke" />
                  : <line key={i} x1={x0} y1={j.atMm} x2={x0 + wt.depthMm} y2={j.atMm}
                      stroke={C.warn} strokeWidth="3" vectorEffect="non-scaling-stroke" />;
              })}
            </g>
        ))()}
        {(project.cooktops || []).map((ctp) => {
          const w = ctp.widthMm || 600;
          const r = bandRect(ctp.wall, ctp.offset - w / 2, ctp.offset + w / 2, room, 40, 560);
          return (
            <g key={ctp.id} style={{ cursor: 'grab' }}
              onPointerDown={(e) => {
                if (tool !== 'select') return;
                e.stopPropagation();
                const p = toMM(e);
                const along = (ctp.wall === 'top' || ctp.wall === 'bottom') ? p.x : p.z;
                drag.current = { id: ctp.id, cooktop: true, grab: along - ctp.offset };
                try { svgRef.current.setPointerCapture(e.pointerId); } catch { /* ignorisano */ }
              }}>
              <rect x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} fill="#1F2937" opacity="0.8" />
              <text x={(r.x0 + r.x1) / 2} y={(r.z0 + r.z1) / 2 + 36} textAnchor="middle"
                fontSize="100" fill="#fff" style={mono}>ploča {w}</text>
            </g>
          );
        })}
        {(project.services || []).map((sv) => {
          const r = bandRect(sv.wall, sv.offset - 60, sv.offset + 60, room, 0, 120);
          const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
          const col = sv.kind === 'voda' ? '#2563EB' : '#F59E0B';
          return (
            <g key={sv.id}>
              <circle cx={cx} cy={cz} r={95} fill={col} opacity="0.9" />
              <text x={cx} y={cz + 42} textAnchor="middle" fontSize="120" fill="#fff" style={mono}>
                {sv.kind === 'voda' ? 'V' : 'S'}
              </text>
            </g>
          );
        })}
        <DimH x0={0} x1={room.width} y={-460} label={String(room.width)} />
        <DimV z0={0} z1={room.depth} x={-460} label={String(room.depth)} />
        {(() => {
          const el = project.elements.find((e) => e.instanceId === selectedId);
          if (!el) return null;
          const a = elementAABB(el, room);
          if (el.wall === 'top' || el.wall === 'bottom') {
            const y = el.wall === 'top' ? a.z1 + 220 : a.z0 - 220;
            return <DimH x0={a.x0} x1={a.x1} y={y} label={String(el.dims.width)} color={C.accent} />;
          }
          const x = el.wall === 'left' ? a.x1 + 220 : a.x0 - 220;
          return <DimV z0={a.z0} z1={a.z1} x={x} label={String(el.dims.width)} color={C.accent} />;
        })()}
      </g>
    </svg>
  );
}