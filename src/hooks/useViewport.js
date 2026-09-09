// src/hooks/useViewport.js
import { useState, useEffect } from 'react';

/**
 * Širina ispod koje se bočni paneli sklapaju u izvlačeće ladice.
 *
 * `LeftRail` je 288 px (w-72) a `RightRail` 320 px (w-80). Zajedno sa
 * minimalno upotrebljivim viewportom od ~420 px to znači da ispod ~1060 px
 * raspored puca: viewport dobije nula širine. Ranije nije bilo nikakvog
 * prilagođavanja — na tabletu u portretu (768 px) aplikacija je bila
 * neupotrebljiva.
 */
export const NARROW_PX = 1100;

/**
 * Prati širinu prozora.
 *
 * `resize` se ispaljuje desetinama puta u sekundi dok korisnik vuče rub prozora,
 * pa je mjerenje odgođeno kroz `requestAnimationFrame` — jedan izračun po frejmu,
 * ne jedan po događaju.
 */
export function useViewportWidth() {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1920 : window.innerWidth));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let raf = null;
    const onResize = () => {
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        setWidth(window.innerWidth);
      });
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, []);

  return width;
}

/**
 * `true` kad je ekran uzak. Koristi se za sklapanje bočnih panela.
 */
export function useIsNarrow(breakpoint = NARROW_PX) {
  const w = useViewportWidth();
  return w < breakpoint;
}
