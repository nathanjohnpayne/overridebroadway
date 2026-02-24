import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * DealBuilder UI state — tracks guided mode progress only.
 * Deal data lives in Firestore via useDealInputs + react-hook-form.
 *
 * Persist key: "deal-builder-ui" (different from old "broadway-deal-draft"
 * to avoid stale localStorage conflicts).
 */

interface DealBuilderUIStore {
  guidedModeActive: boolean;
  currentSectionIndex: number;
  completedSections: string[];       // section IDs that pass isComplete()
  activeProductionId: string | null;

  setGuidedMode: (active: boolean) => void;
  setCurrentSection: (index: number) => void;
  markSectionComplete: (sectionId: string) => void;
  resetGuidedProgress: () => void;
  setActiveProduction: (id: string) => void;
}

export const useDealStore = create<DealBuilderUIStore>()(
  persist(
    (set) => ({
      guidedModeActive: false,
      currentSectionIndex: 0,
      completedSections: [],
      activeProductionId: null,

      setGuidedMode: (active) => set({ guidedModeActive: active }),
      setCurrentSection: (index) => set({ currentSectionIndex: index }),
      markSectionComplete: (sectionId) =>
        set((state) => ({
          completedSections: state.completedSections.includes(sectionId)
            ? state.completedSections
            : [...state.completedSections, sectionId],
        })),
      resetGuidedProgress: () =>
        set({ guidedModeActive: false, currentSectionIndex: 0, completedSections: [] }),
      setActiveProduction: (id) => set({ activeProductionId: id }),
    }),
    { name: "deal-builder-ui" }
  )
);
