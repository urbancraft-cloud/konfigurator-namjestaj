// src/engine/geometry.js

import { templateById } from '../data/catalog';
import { CORPUS_BASE_H, WORKTOP, LEDMASK } from '../data/tech';

export const wallLength = (w, room) => (w === 'top' || w === 'bottom' ? room.width : room.depth);

/** Dubina koju element stvarno zauzima: distancer L-blende viri naprijed. */
export function occupiedDepth(el) {
  const tpl = templateById(el.templateId) || {};
  if (!tpl.blindCorner) return el.dims.depth;
  const tb = el.back.thicknessMm || 3;
  const tf = el.front.thicknessMm || 18;
  const cb = (tpl.cornerDistancer || {}).widthMm || 0;
  return el.dims.depth + tb + tf + cb;
}

export function elementAABB(el, room) {
  const W = el.dims.width, D = occupiedDepth(el), H = el.dims.height;
  const off = el.offset, m = el.mountOffsetMm || 0;
  let x0, x1, z0, z1;
  switch (el.wall) {
    case 'top':    x0 = off; x1 = off + W; z0 = m; z1 = m + D; break;
    case 'bottom': x0 = off; x1 = off + W; z0 = room.depth - D - m; z1 = room.depth - m; break;
    case 'left':   z0 = off; z1 = off + W; x0 = m; x1 = m + D; break;
    default:       z0 = off; z1 = off + W; x0 = room.width - D - m; x1 = room.width - m; break;
  }
  const ledDrop = el.upperBottomDetail === 'led_mask_18' ? 18 : 0;
  return { x0, x1, z0, z1, y0: el.elevation - ledDrop, y1: el.elevation + H, wallFootprintMm: D + m };
}

export function obstacleAABB(ob, room) {
  const d = 120;
  switch (ob.wall) {
    case 'top':    return { x0: ob.offset, x1: ob.offset + ob.width, z0: 0, z1: d, y0: ob.sill, y1: ob.sill + ob.height };
    case 'bottom': return { x0: ob.offset, x1: ob.offset + ob.width, z0: room.depth - d, z1: room.depth, y0: ob.sill, y1: ob.sill + ob.height };
    case 'left':   return { z0: ob.offset, z1: ob.offset + ob.width, x0: 0, x1: d, y0: ob.sill, y1: ob.sill + ob.height };
    default:       return { z0: ob.offset, z1: ob.offset + ob.width, x0: room.width - d, x1: room.width, y0: ob.sill, y1: ob.sill + ob.height };
  }
}

export const overlaps = (a, b, eps = 1) =>
  a.x0 < b.x1 - eps && b.x0 < a.x1 - eps &&
  a.z0 < b.z1 - eps && b.z0 < a.z1 - eps &&
  a.y0 < b.y1 - eps && b.y0 < a.y1 - eps;

export function collidesWithAny(el, project, room, ignoreId) {
  const a = elementAABB(el, room);
  if (a.x0 < -1 || a.z0 < -1 || a.x1 > room.width + 1 || a.z1 > room.depth + 1) return 'ZID';
  for (const o of project.elements) {
    if (o.instanceId === (ignoreId || el.instanceId)) continue;
    if (overlaps(a, elementAABB(o, room))) return o.instanceId;
  }
  for (const ob of project.obstacles) if (overlaps(a, obstacleAABB(ob, room))) return ob.id;
  return null;
}

export const perpendicular = (a, b) => ((a === 'top' || a === 'bottom') !== (b === 'top' || b === 'bottom'));

export function snapCandidates(el, project, room) {
  const len = wallLength(el.wall, room);
  const c = [0, len - el.dims.width];
  project.elements.forEach((o) => {
    if (o.instanceId === el.instanceId) return;
    if (o.wall === el.wall) { c.push(o.offset + o.dims.width); c.push(o.offset - el.dims.width); }
    else if (perpendicular(el.wall, o.wall)) {
      const od = occupiedDepth(o) + (o.mountOffsetMm || 0);
      const nearStart = (o.wall === 'top' && (el.wall === 'left' || el.wall === 'right')) ||
                        (o.wall === 'left' && (el.wall === 'top' || el.wall === 'bottom'));
      if (nearStart) { c.push(od); c.push(od - el.dims.width); }
      else { c.push(len - od - el.dims.width); c.push(len - od); }
    }
  });
  return c.filter((x) => x >= 0 && x <= len - el.dims.width);
}

export function applySnap(v, cands, tol = 40) {
  let best = v, d = tol;
  cands.forEach((c) => { const x = Math.abs(c - v); if (x < d) { d = x; best = c; } });
  return Math.round(best);
}

/** Pravougaonik u pojasu [fromWall, toWall] mjereno od zida. */
export function bandRect(wall, start, end, room, fromWall, toWall) {
  switch (wall) {
    case 'top':    return { x0: start, x1: end, z0: fromWall, z1: toWall };
    case 'bottom': return { x0: start, x1: end, z0: room.depth - toWall, z1: room.depth - fromWall };
    case 'left':   return { z0: start, z1: end, x0: fromWall, x1: toWall };
    default:       return { z0: start, z1: end, x0: room.width - toWall, x1: room.width - fromWall };
  }
}

export function spanRect(wall, start, end, room, depth) {
  switch (wall) {
    case 'top':    return { x0: start, x1: end, z0: 0, z1: depth };
    case 'bottom': return { x0: start, x1: end, z0: room.depth - depth, z1: room.depth };
    case 'left':   return { z0: start, z1: end, x0: 0, x1: depth };
    default:       return { z0: start, z1: end, x0: room.width - depth, x1: room.width };
  }
}

export const rectOverlap = (a, b) => {
  const x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1);
  const z0 = Math.max(a.z0, b.z0), z1 = Math.min(a.z1, b.z1);
  return (x1 - x0 > 0.5 && z1 - z0 > 0.5) ? { x0, x1, z0, z1 } : null;
};

/** Gornja kota zidne obloge — na nju sjeda LED maska, pa onda viseći. */
export function wallPanelTopOf(project) {
  const leg = project.legHeightMm || 150;
  return leg + CORPUS_BASE_H + WORKTOP.thicknessMm + (project.wallPanelHeightMm || 600);
}

export const ledThicknessOf = (project) => (project.ledMask ? LEDMASK.thicknessMm : 0);

/** Donja kota visećih: iznad obloge i, ako je ima, iznad LED maske. */
export function wallElevationOf(project) {
  return wallPanelTopOf(project) + ledThicknessOf(project);
}

/** Vrh visećeg niza je fiksan bez obzira na LED masku. */
export function wallTopOf(project) {
  return wallPanelTopOf(project) + templateById('V-ELEMENT').dims.height.default;
}