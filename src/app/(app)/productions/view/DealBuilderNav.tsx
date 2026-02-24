"use client";

/**
 * DealBuilderNav — section navigation for the Deal Builder.
 *
 * Guided mode:   vertical stepper, one section at a time, Next/Back buttons.
 * Direct mode:   horizontal tab bar, all sections accessible.
 *
 * Section status dots:
 *   gray  = empty (no required fields set)
 *   amber = partial (some fields set, but isComplete() = false)
 *   green = complete (isComplete() = true)
 */

import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSectionStatus } from "./sections/sectionCompletion";
import type { SectionDef } from "./sections/sectionCompletion";
import type { DealInputs } from "@/types/deal";

// ─── Status dot ──────────────────────────────────────────────────────────────

function StatusDot({
  status,
}: {
  status: "complete" | "partial" | "empty";
}) {
  if (status === "complete") {
    return (
      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-green-500 text-white shrink-0">
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="h-4 w-4 rounded-full border-2 border-amber-400 bg-amber-100 shrink-0" />
    );
  }
  return (
    <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 bg-muted/30 shrink-0" />
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DealBuilderNavProps {
  sections: SectionDef[];
  /** Live form values from watch() */
  liveValues: Partial<DealInputs>;
  /** Currently active section index */
  activeSectionIndex: number;
  /** Whether guided mode is active */
  guidedMode: boolean;
  onSectionChange: (index: number) => void;
  onToggleGuidedMode: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DealBuilderNav({
  sections,
  liveValues,
  activeSectionIndex,
  guidedMode,
  onSectionChange,
  onToggleGuidedMode,
}: DealBuilderNavProps) {
  const statuses = sections.map((s) => getSectionStatus(s, liveValues));
  const activeSection = sections[activeSectionIndex];
  const isFirst = activeSectionIndex === 0;
  const isLast = activeSectionIndex === sections.length - 1;
  const activeStatus = statuses[activeSectionIndex];

  if (guidedMode) {
    // ── Guided mode: vertical stepper ──────────────────────────────────────
    return (
      <div className="space-y-4">
        {/* Section progress list */}
        <div className="flex flex-col gap-1">
          {sections.map((section, i) => {
            const status = statuses[i];
            const isActive = i === activeSectionIndex;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(i)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors w-full ${
                  isActive
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-muted/50"
                }`}
              >
                <StatusDot status={status} />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium leading-tight truncate ${
                      isActive ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {section.label}
                  </p>
                  {isActive && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {section.description}
                    </p>
                  )}
                </div>
                {isActive && (
                  <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSectionChange(activeSectionIndex - 1)}
            disabled={isFirst}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => onSectionChange(activeSectionIndex + 1)}
            disabled={isLast || activeStatus !== "complete"}
            title={
              activeStatus !== "complete"
                ? `Complete ${activeSection.label} to continue`
                : undefined
            }
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-1.5 justify-center">
          {sections.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i < activeSectionIndex
                  ? "w-6 bg-green-500"
                  : i === activeSectionIndex
                  ? "w-8 bg-primary"
                  : "w-3 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Mode toggle */}
        <button
          type="button"
          onClick={onToggleGuidedMode}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          Switch to Direct Edit →
        </button>
      </div>
    );
  }

  // ── Direct mode: horizontal tabs ───────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {sections.map((section, i) => {
          const status = statuses[i];
          const isActive = i === activeSectionIndex;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(i)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md whitespace-nowrap text-sm transition-colors shrink-0 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <StatusDot status={isActive ? "empty" : status} />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* Mode toggle */}
      <button
        type="button"
        onClick={onToggleGuidedMode}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Switch to Guided Mode
      </button>
    </div>
  );
}
