// src/hooks/useProjectSelectors.js
import { useProjectStore } from '../store/projectStore';

/**
 * Custom hook koji grupiše sve projektne selektore u jednu pretplatu.
 * Smanjuje re-renderе tako što vraća stabilan objekat sa svim potrebnim vrijednostima.
 * Koristi individualne pretplate umjesto shallow poređenja da izbjegne infinite loop.
 */
export function useProjectSelectors() {
  const room = useProjectStore((s) => s.room);
  const rawProject = useProjectStore((s) => s.rawProject);
  const decorVersion = useProjectStore((s) => s.decorVersion);
  const bumpDecorVersion = useProjectStore((s) => s.bumpDecorVersion);
  const saveDecors = useProjectStore((s) => s.saveDecors);
  const loadDecors = useProjectStore((s) => s.loadDecors);
  const removeElement = useProjectStore((s) => s.removeElement);
  const dragElement = useProjectStore((s) => s.dragElement);
  const moveCooktop = useProjectStore((s) => s.moveCooktop);
  const applyWizard = useProjectStore((s) => s.applyWizard);
  const placeService = useProjectStore((s) => s.placeService);
  const setRawProject = useProjectStore((s) => s.setRawProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const saveDraft = useProjectStore((s) => s.saveDraft);
  
  return { room, rawProject, decorVersion, bumpDecorVersion, saveDecors, loadDecors, 
           removeElement, dragElement, moveCooktop, applyWizard, placeService, 
           setRawProject, undo, redo, saveDraft };
}
