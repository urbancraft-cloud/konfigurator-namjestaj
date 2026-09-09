// src/components/wardrobe/WardrobeApp.jsx
import React, { useMemo, useState } from 'react';
import { C, card } from '../../data/theme';
import { useWardrobeStore } from '../../store/wardrobeStore';
import { useUiStore } from '../../store/uiStore';
import { computeWardrobePrice } from '../../engine/wardrobePricing';
import { WardrobeHeader } from './WardrobeHeader';
import { WardrobeFooter } from './WardrobeFooter';
import { WardrobeSettingsRail } from './WardrobeSettingsRail';
import { WardrobeSegmentRail } from './WardrobeSegmentRail';
import { WardrobeViewport3D } from './WardrobeViewport3D';
import { WardrobeBomModal } from './WardrobeBomModal';

export function WardrobeApp({ narrow = false, panelsOpen = true, setPanelsOpen }) {
  const room = useWardrobeStore((s) => s.room);
  const wardrobe = useWardrobeStore((s) => s.wardrobe);
  const selectedSegmentIdx = useWardrobeStore((s) => s.selectedSegmentIdx);
  const selectedCorpus = useWardrobeStore((s) => s.selectedCorpus);
  const modal = useUiStore((s) => s.modal);
  const setModal = useUiStore((s) => s.setModal);
  const [showInterior, setShowInterior] = useState(true);

  const price = useMemo(() => computeWardrobePrice(wardrobe), [wardrobe]);

  return (
    <div className="w-full h-screen flex flex-col" style={{ background: C.bg, color: C.text, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      <WardrobeHeader price={price} showInterior={showInterior} narrow={narrow}
        onTogglePanels={setPanelsOpen ? () => setPanelsOpen(!panelsOpen) : null}
        onToggleInterior={() => setShowInterior((v) => !v)} />

      <div className="flex-1 flex min-h-0 gap-3 p-3">
        {(!narrow || panelsOpen) && (
          <WardrobeSettingsRail floating={narrow && panelsOpen}
            onNavigate={setPanelsOpen ? () => setPanelsOpen(false) : undefined} />
        )}

        <main className="flex-1 relative min-w-0 overflow-hidden" style={{ ...card, borderRadius: 16 }}>
          <div className="absolute top-3 left-3 z-10 px-3 py-1.5 text-xs rounded-lg"
            style={{ background: 'rgba(255,255,255,0.92)', border: `1px solid ${C.line}`, color: C.dim }}>
            Segment {selectedSegmentIdx + 1} od {wardrobe.segmentCount} · prevuci — rotacija · shift+prevuci — pomjeranje · točkić — zoom
          </div>
          <div className="absolute inset-0">
            <WardrobeViewport3D room={room} wardrobe={wardrobe} showInterior={showInterior} selectedSegmentIdx={selectedSegmentIdx} selectedCorpus={selectedCorpus} />
          </div>
        </main>

        {(!narrow || panelsOpen) && (
          <WardrobeSegmentRail floating={narrow && panelsOpen}
            onNavigate={setPanelsOpen ? () => setPanelsOpen(false) : undefined} />
        )}
      </div>

      {narrow && panelsOpen && setPanelsOpen && (
        <div className="fixed inset-0 z-30" style={{ background: 'rgba(15,23,42,0.35)' }}
          onClick={() => setPanelsOpen(false)} aria-hidden="true" />
      )}

      <WardrobeFooter price={price} />

      {modal === 'wardrobeBom' && <WardrobeBomModal wardrobe={wardrobe} onClose={() => setModal(null)} />}
    </div>
  );
}
