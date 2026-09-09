// test/setup.js
// Zajednički setup za Vitest. Engine testovi (environment: 'node') prolaze kroz
// ovaj fajl bez efekta; integracijski testovi (jsdom) dobijaju mock-ove za API-je
// koje preglednik ima, a jsdom ne.

import { vi } from 'vitest';

const isBrowser = typeof globalThis.document !== 'undefined';

if (isBrowser) {
  // ---- canvas 2D kontekst (utils/canvas.js generiše teksture dekora) --------
  const noop = () => {};
  const ctx2d = () => ({
    canvas: { width: 512, height: 512 },
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1,
    textAlign: '', textBaseline: '',
    fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, ellipse: noop, arc: noop,
    fill: noop, stroke: noop, fillText: noop, strokeText: noop,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    drawImage: noop, putImageData: noop,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
    createLinearGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 10 }),
  });

  if (!globalThis.HTMLCanvasElement.prototype.getContext.__isMock) {
    const mockGetContext = function (type) {
      if (type === '2d') return ctx2d();
      return null;                       // 'webgl'/'webgl2' — Three.js ne radi u jsdom-u
    };
    mockGetContext.__isMock = true;
    globalThis.HTMLCanvasElement.prototype.getContext = mockGetContext;
  }

  // ---- ResizeObserver (Viewport3D) ------------------------------------------
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }

  // ---- SVG mjerenje (PlanView2D.toMM) ---------------------------------------
  if (globalThis.SVGElement) {
    globalThis.SVGElement.prototype.createSVGPoint = function () {
      return { x: 0, y: 0, matrixTransform: () => ({ x: 0, y: 0 }) };
    };
    globalThis.SVGElement.prototype.getScreenCTM = function () {
      return { inverse: () => ({}) };
    };
  }

  /* jsdom po difoltu ima `window.innerWidth = 1024`, što je ISPOD praga za
     uski ekran (NARROW_PX = 1100) — bočni paneli bi bili skriveni i svi
     integracijski testovi koji klikću po LeftRail-u bi padali. Postavljamo
     širinu realnog desktop preglednika; test za uski ekran je eksplicitan i
     sam mijenja širinu. */
  Object.defineProperty(globalThis.window, 'innerWidth', {
    writable: true, configurable: true, value: 1600,
  });
  Object.defineProperty(globalThis.window, 'innerHeight', {
    writable: true, configurable: true, value: 1000,
  });

  // ---- matchMedia (neke komponente ga znaju dirati) --------------------------
  if (!globalThis.matchMedia) {
    globalThis.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }

  // ---- localStorage polyfill iz projekta očekuje `window.storage` ------------
  // (utils/storage.js to već postavlja pri importu; ovdje samo osiguravamo window)
  if (!globalThis.window) globalThis.window = globalThis;
}

// Tiši očekivane React warninge koji ne utiču na ishod testova
if (typeof console !== 'undefined') {
  const origError = console.error;
  console.error = (...args) => {
    const msg = String(args[0] || '');
    if (/not wrapped in act|useLayoutEffect does nothing on the server|WebGL|THREE\./.test(msg)) return;
    origError(...args);
  };
}

vi.stubGlobal('__TEST_ENV__', isBrowser ? 'jsdom' : 'node');
