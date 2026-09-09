import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    /* PERF-07: chunkove dijeli `React.lazy` u App.jsx — `Viewport3D` i
       `WardrobeApp` (koji povlači svoj 3D viewport i Three.js) se skidaju tek
       kad korisnik zaista ode u taj prikaz.

       Napomena: Vite 8 koristi rolldown, gdje `output.manualChunks` mora biti
       FUNKCIJA (ne objekat kao u rollup-u). Za sada nije potrebna — dinamički
       importi sami stvaraju zasebne chunkove. */
    chunkSizeWarningLimit: 700,
  },
  /* Importi u ovom projektu pišu se bez ekstenzije (npr. '../data/hardware'),
     što Vite rješava sam, ali čisti Node ESM ne. Zato testovi idu kroz Vitest,
     koji koristi isti rezolver. */
  resolve: { extensions: ['.mjs', '.js', '.jsx', '.json'] },
  test: {
    /* Engine testovi idu u čistom Node-u (brzo, bez DOM-a).
       Integracijski testovi komponenti trebaju jsdom. */
    environment: 'node',
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
    /* Testovi komponenti nose `@vitest-environment jsdom` docblock na vrhu fajla
       (environmentMatchGlobs je uklonjen u Vitestu 4). */
    setupFiles: ['./test/setup.js'],
    restoreMocks: true,
    globals: true,
    /* Integracijski testovi renderuju cijelu aplikaciju (3 store-a, ~70 panela)
       pa jedan klik kroz jsdom traje znatno duže nego u pregledniku. */
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
