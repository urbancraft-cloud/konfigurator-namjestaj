// src/utils/canvas.js

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Natpis zida kao tekstura na tankoj ploči u 3D-u. */
export function makeLabelCanvas(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0F172A';
  g.globalAlpha = 0.82;
  g.beginPath();
  const r = 26, w = 512, h = 128;
  g.moveTo(r, 0); g.lineTo(w - r, 0); g.quadraticCurveTo(w, 0, w, r);
  g.lineTo(w, h - r); g.quadraticCurveTo(w, h, w - r, h);
  g.lineTo(r, h); g.quadraticCurveTo(0, h, 0, h - r);
  g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = '#FFFFFF';
  g.font = '600 52px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  return c;
}

export function makeDecorCanvas(d) {
  const T = d.tex;
  const N = T.kind === 'drvo' ? 1024 : 512;
  const c = document.createElement('canvas');
  c.width = N; c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = T.base;
  g.fillRect(0, 0, N, N);
  let seed = 20260830;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  if (T.kind === 'drvo') {
    for (let i = 0; i < 14; i++) {
      const x = rnd() * N, w = N * (0.04 + rnd() * 0.12);
      g.fillStyle = rgba(rnd() > 0.5 ? T.light : T.grain, 0.05 + rnd() * 0.07);
      g.fillRect(x, 0, w, N);
    }
    for (let i = 0; i < T.lines; i++) {
      const x = rnd() * N;
      const amp = 1.5 + rnd() * 9;
      const freq = 0.003 + rnd() * 0.012;
      const phase = rnd() * Math.PI * 2;
      g.strokeStyle = rgba(rnd() > 0.82 ? T.dark : T.grain, 0.035 + rnd() * 0.16);
      g.lineWidth = 0.5 + rnd() * 2.4;
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y <= N; y += 14) g.lineTo(x + Math.sin(y * freq + phase) * amp, y);
      g.stroke();
    }
    for (let i = 0; i < T.knots; i++) {
      const kx = rnd() * N, ky = rnd() * N;
      const r0 = 6 + rnd() * 12;
      for (let r = r0; r > 1.5; r -= 1.4 + rnd() * 1.6) {
        g.strokeStyle = rgba(T.dark, 0.10 + rnd() * 0.22);
        g.lineWidth = 0.7 + rnd() * 1.3;
        g.beginPath();
        g.ellipse(kx, ky, r * (0.5 + rnd() * 0.25), r * (1.5 + rnd() * 0.7), 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    for (let i = 0; i < T.cracks; i++) {
      const x = rnd() * N, y = rnd() * N, len = 12 + rnd() * 90;
      g.strokeStyle = rgba(T.dark, 0.22 + rnd() * 0.3);
      g.lineWidth = 0.5 + rnd() * 1.1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 5, y + len);
      g.stroke();
    }
  } else {
    const img = g.getImageData(0, 0, N, N);
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const n = (rnd() - 0.5) * T.noise * 2;
      px[i] += n; px[i + 1] += n; px[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * N, y = rnd() * N;
      g.strokeStyle = rgba(T.accent, T.pore * (0.3 + rnd()));
      g.lineWidth = 0.5 + rnd();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 3, y + 3 + rnd() * 12);
      g.stroke();
    }
  }
  return c;
}

/**
 * UV u stvarnom mjerilu. Umjesto normalizovanih 0..1 po strani kocke,
 * svaka strana dobija UV = svjetska_pozicija / veličina_motiva, a V osa
 * se poravnava sa smjerom teksture panela.
 */
export function applyWorldUV(geo, texWorldM, grainAxis) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const inv = 1 / texWorldM;
  for (let i = 0; i < pos.count; i++) {
    const f = Math.floor(i / 4);
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u, v;
    if (f < 2)      { if (grainAxis === 'z') { u = y; v = z; } else { u = z; v = y; } }
    else if (f < 4) { if (grainAxis === 'x') { u = z; v = x; } else { u = x; v = z; } }
    else            { if (grainAxis === 'x') { u = y; v = x; } else { u = x; v = y; } }
    uv.setXY(i, u * inv, v * inv);
  }
  uv.needsUpdate = true;
}