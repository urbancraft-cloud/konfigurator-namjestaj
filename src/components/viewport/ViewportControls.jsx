// src/components/viewport/ViewportControls.jsx
import React from 'react';
import { Eye, EyeOff, Footprints, Ruler, Wand2, Trash2 } from 'lucide-react';
import { C } from '../../data/theme';
import { Btn, Segmented } from '../ui/Controls';

const mono = { fontFamily: 'monospace' };

/**
 * Kontrolna traka iznad viewport-a (alati, prikaz, modovi).
 * Izdvojeno iz App.jsx radi smanjenja kompleksnosti i boljeg testiranja.
 */
export function ViewportControls({ 
  view, setView, 
  tool, setTool, 
  showFronts, toggleShowFronts,
  walk, setWalk, 
  measure, setMeasure,
  onNewProject,
  onClearSpace 
}) {
  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
      <Segmented 
        value={view} 
        onChange={setView}
        options={[
          { value: '2d', label: 'Tlocrt' }, 
          { value: '3d', label: '3D prikaz' }
        ]} 
      />
      <Segmented 
        value={tool} 
        onChange={(v) => { 
          setTool(v); 
          if (v !== 'select') setView('2d'); 
        }}
        options={[
          { value: 'select', label: 'Odabir' }, 
          { value: 'voda', label: 'Voda' }, 
          { value: 'struja', label: 'Struja' }
        ]} 
      />
      <Btn size="sm" variant={showFronts ? 'ghost' : 'dark'} onClick={toggleShowFronts}>
        {showFronts ? <EyeOff size={13} /> : <Eye size={13} />} 
        {showFronts ? 'Sakrij fronte' : 'Prikaži fronte'}
      </Btn>
      <Btn 
        size="sm" 
        variant={walk ? 'primary' : 'ghost'}
        onClick={() => { setView('3d'); setWalk(!walk); }}
      >
        <Footprints size={13} /> {walk ? 'Izađi (H)' : 'Hodanje (H)'}
      </Btn>
      <Btn 
        size="sm" 
        variant={measure ? 'primary' : 'ghost'}
        onClick={() => { setView('3d'); setMeasure(!measure); }}
      >
        <Ruler size={13} /> {measure ? 'Metar aktivan (T)' : 'Metar (T)'}
      </Btn>
      <Btn size="sm" onClick={onNewProject}>
        <Wand2 size={13} /> Novi projekat
      </Btn>
      <Btn size="sm" onClick={onClearSpace}>
        <Trash2 size={13} /> Očisti prostor
      </Btn>
    </div>
  );
}

/**
 * Info traka sa uputstvima za trenutni mod.
 */
export function ViewportInfo({ view, tool, measure, walk }) {
  const getMessage = () => {
    if (measure) return 'klikni dvije tačke — udaljenost u mm · T ili Esc — izlaz';
    if (walk) return 'W A S D / strelice — hodanje · povuci mišem — pogled · H ili Esc — izlaz';
    if (tool !== 'select') {
      return `klikni na zid gdje je ${tool === 'voda' ? 'odvod za vodu' : 'utičnica'}`;
    }
    if (view === '3d') {
      return 'klik odabire · povuci odabrani — pomjeranje uz zid · Delete briše · H — hodanje';
    }
    return 'povuci element — pomjeranje uz zid · Delete briše';
  };

  return (
    <div 
      className="absolute top-3 right-3 z-10 px-3 py-1.5 text-xs rounded-lg"
      style={{ background: 'rgba(255,255,255,0.92)', border: `1px solid ${C.line}`, color: C.dim }}
    >
      {getMessage()}
    </div>
  );
}

/**
 * Panel sa mjerenjima (prikazuje rezultat mjerenja).
 */
export function MeasurePanel({ measured, onReset }) {
  if (!measured) return null;
  
  return (
    <div 
      className="absolute bottom-14 left-1/2 z-20 px-4 py-2.5 rounded-xl text-sm"
      style={{ transform: 'translateX(-50%)', background: C.ink, color: '#fff' }}
      onClick={onReset}
    >
      Izmjereno: <b style={mono}>{measured} mm</b> · klikni za novo mjerenje
    </div>
  );
}

/**
 * Panel sa površinama materijala (lijevo dole).
 */
export function SurfacesPanel({ surfaces }) {
  const items = [
    ['radna ploča', `${(surfaces.wt.lengthMm / 1000).toFixed(2)} m`],
    ['obloga', `${(surfaces.wp.lengthMm / 1000).toFixed(2)} m`],
    ['coklo', `${(surfaces.sk.lengthMm / 1000).toFixed(2)} m`],
    ['maska', `${(surfaces.gm.lengthMm / 1000).toFixed(2)} m`],
    ['zav. maske', `${surfaces.zm.pieces.length}`]
  ];

  return (
    <div className="absolute bottom-3 left-3 z-10 flex gap-2">
      {items.map(([k, v]) => (
        <span 
          key={k} 
          className="px-2.5 py-1.5 text-xs rounded-lg"
          style={{ 
            background: 'rgba(255,255,255,0.92)', 
            border: `1px solid ${C.line}`, 
            color: C.dim 
          }}
        >
          {k} <b style={{ ...mono, color: C.text }}>{v}</b>
        </span>
      ))}
    </div>
  );
}
