// src/hooks/useUiSelectors.js
import { useUiStore } from '../store/uiStore';

/**
 * Custom hook koji grupiše sve UI selektore u jednu pretplatu.
 * Smanjuje re-renderе tako što vraća stabilan objekat sa svim potrebnim vrijednostima.
 * Koristi individualne pretplate umjesto shallow poređenja da izbjegne infinite loop.
 */
export function useUiSelectors() {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const tool = useUiStore((s) => s.tool);
  const setTool = useUiStore((s) => s.setTool);
  const wizard = useUiStore((s) => s.wizard);
  const setWizard = useUiStore((s) => s.setWizard);
  const appMode = useUiStore((s) => s.appMode);
  const setAppMode = useUiStore((s) => s.setAppMode);
  const showFronts = useUiStore((s) => s.showFronts);
  const toggleShowFronts = useUiStore((s) => s.toggleShowFronts);
  const walk = useUiStore((s) => s.walk);
  const setWalk = useUiStore((s) => s.setWalk);
  const measure = useUiStore((s) => s.measure);
  const setMeasure = useUiStore((s) => s.setMeasure);
  const measured = useUiStore((s) => s.measured);
  const setMeasured = useUiStore((s) => s.setMeasured);
  const selectedId = useUiStore((s) => s.selectedId);
  const setSelectedId = useUiStore((s) => s.setSelectedId);
  const modal = useUiStore((s) => s.modal);
  const setModal = useUiStore((s) => s.setModal);
  const toastSeq = useUiStore((s) => s.toastSeq);
  const toast = useUiStore((s) => s.toast);
  const flash = useUiStore((s) => s.flash);
  const setPendingAdd = useUiStore((s) => s.setPendingAdd);
  const panelsOpen = useUiStore((s) => s.panelsOpen);
  const setPanelsOpen = useUiStore((s) => s.setPanelsOpen);
  
  return { view, setView, tool, setTool, wizard, setWizard, appMode, setAppMode,
           showFronts, toggleShowFronts, walk, setWalk, measure, setMeasure,
           measured, setMeasured, selectedId, setSelectedId, modal, setModal,
           toastSeq, toast, flash, setPendingAdd, panelsOpen, setPanelsOpen };
}
