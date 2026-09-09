// src/components/wardrobe/WardrobeSegmentRail.jsx
import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { C, mono } from '../../data/theme';
import { ITEM_TYPES } from '../../data/wardrobe';
import { Panel } from '../ui/Panel';
import { Btn, Segmented, Field, Select } from '../ui/Controls';
import { Note, Row } from '../ui/DataDisplay';
import {
  corpusInteriorHeightMm, segmentWidthMm, segmentInteriorWidthMm, itemSpan,
  itemOccupiedHeightMm, segmentHasCollisions, collidesInSegment,
  upperCorpusHeightMm, lowerCorpusHeightMm, drawerUnitWidthMm, drawerFrontHeightsMm,
} from '../../engine/wardrobeLayout';
import { useWardrobeStore } from '../../store/wardrobeStore';
import { useUiStore } from '../../store/uiStore';

function ItemSchematic({ items, interiorH }) {
  return (
    <div className="relative w-16 rounded-md shrink-0" style={{ height: 220, background: C.paper2, border: `1px solid ${C.line}` }}>
      {interiorH <= 0 ? null : items.map((it) => {
        const { y0, y1 } = itemSpan(it);
        const top = 100 - (y1 / interiorH) * 100;
        const height = ((y1 - y0) / interiorH) * 100;
        const collides = collidesInSegment(it, items, it.id);
        const color = collides ? C.danger : it.type === 'ladicar' ? C.accent : it.type === 'sipka' ? C.warn : '#64748B';
        return (
          <div key={it.id} className="absolute left-0.5 right-0.5 rounded-sm"
            style={{ top: `${top}%`, height: `${Math.max(height, 1.5)}%`, background: color, opacity: 0.75 }} />
        );
      })}
    </div>
  );
}

function ItemRow({ segIdx, corpus, item, interiorH }) {
  const updateItem = useWardrobeStore((s) => s.updateItem);
  const moveItem = useWardrobeStore((s) => s.moveItem);
  const removeItem = useWardrobeStore((s) => s.removeItem);
  const flashThrottled = useUiStore((s) => s.flashThrottled);
  const h = itemOccupiedHeightMm(item);

  /** Pomjeranje po visini — prijavljuje razlog ako nije moguće (BUG-21). */
  const handleMove = (v) => {
    const res = moveItem(segIdx, corpus, item.id, v);
    if (res && !res.ok) flashThrottled(res.reason);
  };

  return (
    <div className="p-2.5 rounded-lg mb-2" style={{ background: C.paper2, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: C.dim }}>
          {ITEM_TYPES[item.type].label} <span style={{ ...mono, color: C.faint }}>· {h} mm</span>
        </span>
        <button onClick={() => removeItem(segIdx, corpus, item.id)}
          className="p-1 rounded" style={{ background: C.dangerBg, color: C.danger }} aria-label="Ukloni">
          <Trash2 size={12} />
        </button>
      </div>

      <Field label="Visina od dna korpusa (Y)" unit="mm" value={item.yMm} min={0} max={Math.max(0, interiorH - h)} step={5}
        onChange={handleMove} />

      {item.type === 'ladicar' && (
        <>
          {/* Visina ladičara je podesiva (default 700 mm); fronte se dijele
              automatski po toj visini, istom logikom kao u kuhinji. */}
          <Field label="Visina ladičara" unit="mm" strong
            value={item.heightMm || ITEM_TYPES.ladicar.defaultHeightMm}
            min={200} max={Math.max(300, interiorH)} step={10}
            onChange={(v) => updateItem(segIdx, corpus, item.id, { heightMm: v })} />
          <Field label="Broj ladica" unit="kom" value={item.drawerCount}
            min={ITEM_TYPES.ladicar.drawerCount.min} max={ITEM_TYPES.ladicar.drawerCount.max} step={1}
            onChange={(v) => updateItem(segIdx, corpus, item.id, { drawerCount: v })} />
          <div className="rounded-lg px-2.5 py-2 mb-3" style={{ background: C.paper2 }}>
            <Row label="širina ladičara" value={`${Math.round(item.widthMm || 0)} mm`} tone={C.accentText} />
            {drawerFrontHeightsMm(item).map((h, i) => (
              <Row key={i} label={`fronta ${i + 1}`} value={`${h} mm`} />
            ))}
          </div>
        </>
      )}

      {item.type === 'sipka' && (
        <Select label="Preporučeni razmak (informativno)" value={item.clearance}
          options={Object.entries(ITEM_TYPES.sipka.clearance).map(([k, v]) => ({ value: k, label: `${v.label} (≥ ${v.mm} mm ispod)` }))}
          onChange={(v) => updateItem(segIdx, corpus, item.id, { clearance: v })} />
      )}

      {item.type === 'polica' && (
        <>
          <Field label="Broj polica" unit="kom" value={item.shelfCount}
            min={ITEM_TYPES.polica.shelfCount.min} max={ITEM_TYPES.polica.shelfCount.max} step={1}
            onChange={(v) => updateItem(segIdx, corpus, item.id, { shelfCount: v })} />
          <Field label="Visina zone" unit="mm" value={item.zoneMm} min={150} max={2200} step={10}
            onChange={(v) => updateItem(segIdx, corpus, item.id, { zoneMm: v })} />
          <Select label="Tip polica" value={item.adjustable ? 'podesive' : 'fiksne'}
            options={[
              { value: 'podesive', label: 'Podesive (na rupičastim nosačima)' },
              { value: 'fiksne', label: 'Fiksne (uglavljene u korpus)' },
            ]}
            onChange={(v) => updateItem(segIdx, corpus, item.id, { adjustable: v === 'podesive' })} />
        </>
      )}
    </div>
  );
}

export function WardrobeSegmentRail({ floating = false, onNavigate }) {
  const wardrobe = useWardrobeStore((s) => s.wardrobe);
  const selectedSegmentIdx = useWardrobeStore((s) => s.selectedSegmentIdx);
  const setSelectedSegmentIdx = useWardrobeStore((s) => s.setSelectedSegmentIdx);
  const selectedCorpus = useWardrobeStore((s) => s.selectedCorpus);
  const setSelectedCorpus = useWardrobeStore((s) => s.setSelectedCorpus);
  const addItem = useWardrobeStore((s) => s.addItem);
  const flash = useUiStore((s) => s.flash);

  const seg = wardrobe.segments[selectedSegmentIdx];
  const segW = Math.round(segmentWidthMm(wardrobe));
  const upperHmm = Math.round(upperCorpusHeightMm(wardrobe));
  /* `LOWER_CORPUS_H` je bio fiksna konstanta 2000; donji korpus je sada ulazna
     veličina (default 1950) pa se čita iz ormara, ne iz data sloja. */
  const lowerHmm = Math.round(lowerCorpusHeightMm(wardrobe));
  const corpusHeightLabel = selectedCorpus === 'lower' ? lowerHmm : upperHmm;
  const interiorH = corpusInteriorHeightMm(wardrobe, selectedCorpus);
  const corpusItems = seg ? seg[selectedCorpus].items : [];
  /** Gornji korpus je neupotrebljiv kad mu visina nije pozitivna. */
  const corpusNeupotrebljiv = selectedCorpus === 'upper' && upperHmm <= 0;
  const hasCollision = useMemo(() => (seg ? segmentHasCollisions(seg[selectedCorpus].items) : false), [seg, selectedCorpus]);
  const upperInvalid = upperHmm <= 0;

  const handleAdd = (type) => {
    if (corpusNeupotrebljiv) {
      flash('Gornji korpus nema pozitivnu visinu — povećajte visinu ormara ili smanjite nogice.');
      return;
    }
    const res = addItem(selectedSegmentIdx, selectedCorpus, type);
    if (!res || !res.ok) {
      flash(res && res.reason
        ? res.reason
        : `Nema slobodne visine u ${selectedCorpus === 'lower' ? 'donjem' : 'gornjem'} korpusu segmenta ${selectedSegmentIdx + 1} za ${ITEM_TYPES[type].label.toLowerCase()}.`);
    }
  };

  return (
    <aside className={floating
        ? 'fixed top-0 bottom-0 right-0 z-40 w-80 max-w-[86vw] overflow-y-auto shadow-2xl p-3'
        : 'w-80 shrink-0 overflow-y-auto pl-1'}
      style={floating ? { background: C.bg } : undefined}
      aria-label="Segmenti i sadržaj ormara">
      {floating && onNavigate && (
        <div className="mb-3 flex justify-end">
          <Btn size="sm" onClick={onNavigate} ariaLabel="Zatvori panel">Zatvori panel</Btn>
        </div>
      )}
      <Panel title="Segmenti">
        <Segmented value={selectedSegmentIdx} onChange={setSelectedSegmentIdx}
          options={wardrobe.segments.map((s, i) => ({ value: i, label: `Segment ${i + 1}` }))} />
        <div className="rounded-lg px-2.5 py-2 mt-2" style={{ background: C.paper2 }}>
          <Row label="širina segmenta" value={`${segW} mm`} />
          <Row label="svijetla širina" value={`${Math.round(segmentInteriorWidthMm(wardrobe))} mm`} />
          <Row label="širina ladičara" value={`${Math.round(drawerUnitWidthMm(wardrobe))} mm`} tone={C.accentText} />
        </div>
      </Panel>

      <Panel title="Korpus">
        <Segmented value={selectedCorpus} onChange={setSelectedCorpus}
          options={[
            { value: 'lower', label: `Donji (${lowerHmm} mm)` },
            { value: 'upper', label: `Gornji (${upperHmm} mm)` },
          ]} />
        <p className="text-xs mt-2" style={{ color: C.faint }}>
          Svijetla visina korpusa <b style={mono}>{Math.max(0, interiorH)} mm</b> · fiksni: {corpusHeightLabel} mm
        </p>
        {selectedCorpus === 'upper' && upperInvalid && (
          <Note kind="error">
            Gornji korpus je nevalidan (visina ≤ 0). Smanjite nogice ili povećajte ukupnu visinu ormara.
          </Note>
        )}
      </Panel>

      {/* BUG-22: uvjet je ranije bio `seg && !upperInvalid`, pa bi cijeli panel
          „Sadržaj" NESTAO čim gornji korpus padne na ≤ 0 — uključujući sve
          ladičare, šipke i police koje je korisnik dodao u DONJI korpus. Podaci su
          ostajali u store-u ali ih se nije moglo ni vidjeti ni urediti.
          Sada je panel uvijek tu; onemogućeno je samo DODAVANJE u gornji korpus. */}
      {seg && (
        <Panel title={`Sadržaj — Segment ${selectedSegmentIdx + 1} · ${selectedCorpus === 'lower' ? 'donji' : 'gornji'} korpus`}>
          {corpusNeupotrebljiv ? (
            <Note kind="error">
              Gornji korpus nema pozitivnu visinu ({upperHmm} mm), pa se u njega ne može
              ništa dodati. Povećajte ukupnu visinu ormara ili smanjite nogice.
              Sadržaj <b>donjeg</b> korpusa je i dalje dostupan — prebacite se na njega
              dugmetom iznad.
            </Note>
          ) : (
            <>
              <div className="flex gap-2 mb-3">
                <div className="flex-1 space-y-1.5">
                  <Btn full size="sm" onClick={() => handleAdd('ladicar')}><Plus size={12} /> Ladičar</Btn>
                  <Btn full size="sm" onClick={() => handleAdd('sipka')}><Plus size={12} /> Šipka</Btn>
                  <Btn full size="sm" onClick={() => handleAdd('polica')}><Plus size={12} /> Police</Btn>
                </div>
                <ItemSchematic items={corpusItems} interiorH={interiorH} />
              </div>

              {corpusItems.length === 0 && (
                <Note kind="warn">Korpus je prazan — dodajte ladičar, šipku ili police.</Note>
              )}
            </>
          )}

          {/* Postojeći elementi se UVIJEK prikazuju i mogu se urediti/obrisati. */}
          {corpusItems
            .slice()
            .sort((a, b) => b.yMm - a.yMm)
            .map((it) => (
              <ItemRow key={it.id} segIdx={selectedSegmentIdx} corpus={selectedCorpus} item={it} interiorH={interiorH} />
            ))}
        </Panel>
      )}

      {hasCollision && (
        <Note kind="error">
          {selectedCorpus === 'lower' ? 'Donji' : 'Gornji'} korpus segmenta {selectedSegmentIdx + 1} sadrži elemente
          koji se preklapaju (obojeni crveno u šemi) — pomjerite ih ili smanjite.
        </Note>
      )}
    </aside>
  );
}
