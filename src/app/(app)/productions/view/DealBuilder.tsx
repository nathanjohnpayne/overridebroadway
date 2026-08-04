"use client";

/**
 * DealBuilder — two-pane workspace for configuring a deal.
 *
 * Left pane:  section navigation (guided stepper OR direct tab bar) + active section form
 * Right pane: Live Outcome panel (sticky)
 *
 * On mobile (< lg), the Live Outcome panel collapses to a horizontal strip above the inputs.
 *
 * This component owns NO form state — it receives control/watch/setValue/etc. from the
 * single useForm() in ProductionHubClient. No new form instances are created here.
 */

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import type {
  Control,
  UseFormWatch,
  UseFormSetValue,
  UseFormGetValues,
  UseFormHandleSubmit,
} from "react-hook-form";
import { DEAL_SECTIONS } from "./sections/sectionCompletion";
import { DealBuilderNav } from "./DealBuilderNav";
import { LiveOutcomePanel } from "./LiveOutcomePanel";
import { CapitalizationSection } from "./sections/CapitalizationSection";
import { WeeklyEconomicsSection } from "./sections/WeeklyEconomicsSection";
import { RevenueSection } from "./sections/RevenueSection";
import { RoyaltiesSection } from "./sections/RoyaltiesSection";
import { WaterfallSection } from "./sections/WaterfallSection";
import { useDebounce } from "@/hooks/useDebounce";
import type { DealInputs } from "@/types/deal";
import type { ModelOutput } from "@/types/model";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DealBuilderProps {
  control: Control<DealInputs>;
  watch: UseFormWatch<DealInputs>;
  setValue: UseFormSetValue<DealInputs>;
  getValues: UseFormGetValues<DealInputs>;
  handleSubmit: UseFormHandleSubmit<DealInputs>;
  isDirty: boolean;
  saving: boolean;
  modelOutput: ModelOutput | null;
  dealInputs: DealInputs | null;
  onSave: (data: DealInputs) => Promise<void>;
  /** Initial guided mode state — driven by useDealStore in parent */
  initialGuidedMode: boolean;
  onGuidedModeChange: (active: boolean) => void;
}

// ─── Section component map ────────────────────────────────────────────────────

const SECTION_COMPONENTS = [
  CapitalizationSection,
  WeeklyEconomicsSection,
  RevenueSection,
  RoyaltiesSection,
  WaterfallSection,
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function DealBuilder({
  control,
  watch,
  setValue,
  getValues: _getValues,
  handleSubmit,
  isDirty,
  saving,
  modelOutput,
  dealInputs,
  onSave,
  initialGuidedMode,
  onGuidedModeChange,
}: DealBuilderProps) {
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [guidedMode, setGuidedMode] = useState(initialGuidedMode);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Sync guided mode changes up to parent (so useDealStore can persist)
  useEffect(() => {
    onGuidedModeChange(guidedMode);
  }, [guidedMode, onGuidedModeChange]);

  // Live form values (needed for completion checks + LiveOutcomePanel)
  const liveValues = watch();

  // ── Autosave (1.5s debounce) ──────────────────────────────────────────────
  const debouncedValues = useDebounce(liveValues, 1500);

  useEffect(() => {
    if (!isDirty || !dealInputs) return;
    setAutoSaveStatus("saving");
    onSave(debouncedValues as DealInputs)
      .then(() => setAutoSaveStatus("saved"))
      .catch(() => setAutoSaveStatus("idle"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValues]);

  // Reset "saved" back to "idle" after 3s
  useEffect(() => {
    if (autoSaveStatus !== "saved") return;
    const t = setTimeout(() => setAutoSaveStatus("idle"), 3000);
    return () => clearTimeout(t);
  }, [autoSaveStatus]);

  // Toggle guided mode
  const handleToggleGuidedMode = () => {
    setGuidedMode((g) => !g);
  };

  // Active section component
  const ActiveSection = SECTION_COMPONENTS[activeSectionIndex];

  // Shared props for every section
  const sectionProps = {
    control,
    watch,
    setValue,
    modelOutput,
    dealInputs,
  };

  // ── Mobile live outcome strip (horizontal) ─────────────────────────────────
  const MobileOutcomeStrip = modelOutput && dealInputs ? (
    <div className="lg:hidden rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-6 flex-wrap text-xs mb-4">
      <div>
        <span className="text-muted-foreground">Weekly Gross</span>
        <span className="font-semibold font-mono ml-1.5">
          {/* First open week gross */}
          ${((modelOutput.weeks.find((w) => !w.isPreview) ?? modelOutput.weeks[0])?.grossBoxOffice ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground">Breakeven</span>
        <span className="font-semibold font-mono ml-1.5">
          {modelOutput.weeklyBreakeven !== null
            ? `${(modelOutput.weeklyBreakeven * 100).toFixed(0)}% occ.`
            : "Never"}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground">Recoup wk</span>
        <span className="font-semibold font-mono ml-1.5">
          {modelOutput.recoupWeek !== null ? `Wk ${modelOutput.recoupWeek}` : "—"}
        </span>
      </div>
    </div>
  ) : null;

  return (
    <div>
      {/* Mobile strip */}
      {MobileOutcomeStrip}

      <div className="flex gap-6 items-start">
        {/* ── Left pane ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Navigation */}
          <DealBuilderNav
            sections={DEAL_SECTIONS}
            liveValues={liveValues}
            activeSectionIndex={activeSectionIndex}
            guidedMode={guidedMode}
            onSectionChange={setActiveSectionIndex}
            onToggleGuidedMode={handleToggleGuidedMode}
          />

          {/* Active section form */}
          <form onSubmit={handleSubmit(onSave)}>
            <div className="space-y-4">
              <ActiveSection {...sectionProps} />
            </div>

            {/* Save bar */}
            <div className="sticky bottom-0 bg-background border-t mt-4 py-3 flex items-center justify-between">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {isDirty ? (
                  <Badge variant="outline">Unsaved changes</Badge>
                ) : autoSaveStatus === "saving" ? (
                  <span className="text-muted-foreground animate-pulse">Saving…</span>
                ) : autoSaveStatus === "saved" ? (
                  <span className="text-green-600">Saved ✓</span>
                ) : (
                  <span>Saved</span>
                )}
              </div>
              <Button type="submit" disabled={saving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Deal Inputs"}
              </Button>
            </div>
          </form>
        </div>

        {/* ── Right pane — sticky Live Outcome panel (desktop only) ──────── */}
        <div className="hidden lg:block w-72 xl:w-80 shrink-0 sticky top-4">
          <LiveOutcomePanel
            modelOutput={modelOutput}
            dealInputs={dealInputs}
            liveValues={liveValues}
          />
        </div>
      </div>
    </div>
  );
}
