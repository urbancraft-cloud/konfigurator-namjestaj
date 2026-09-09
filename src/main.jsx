// src/main.jsx
/* `storage.js` je ranije morao biti PRVI import jer je na `window` kačio
   polyfill koji su store-ovi koristili. Sada je to običan modul sa funkcijama
   koji se importuje tamo gdje treba, pa redoslijed importovanja više nije
   kritičan. */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);