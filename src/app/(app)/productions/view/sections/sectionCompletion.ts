/**
 * Section definitions and completion contracts for the Deal Builder.
 * Each section declares:
 *   - id: unique string key
 *   - label: display name
 *   - isComplete(): derived from live form values — determines guided mode progression
 *
 * These are pure functions — no React, no side effects.
 */

import type { DealInputs } from "@/types/deal";

export interface SectionDef {
  id: string;
  label: string;
  description: string;
  /** Returns true when the section has enough data to be considered complete */
  isComplete: (inputs: Partial<DealInputs>) => boolean;
  /** Fields that must be nonzero for the section to be complete (for UI hints) */
  requiredFields: (keyof DealInputs)[];
}

export const DEAL_SECTIONS: SectionDef[] = [
  {
    id: "capitalization",
    label: "Capitalization",
    description: "Total equity raised, unit price, and investor structure",
    isComplete: (d) =>
      (d.totalCapitalization ?? 0) > 0 && (d.unitPrice ?? 0) > 0,
    requiredFields: ["totalCapitalization", "unitPrice"],
  },
  {
    id: "weekly-economics",
    label: "Weekly Economics",
    description: "Operating costs, performance schedule, and run length",
    isComplete: (d) =>
      (d.weeklyNut ?? 0) > 0 &&
      (d.performances ?? 0) > 0 &&
      (d.estimatedWeeks ?? 0) > 0,
    requiredFields: ["weeklyNut", "performances", "estimatedWeeks"],
  },
  {
    id: "revenue",
    label: "Revenue Drivers",
    description: "Seat capacity, ticket pricing, and house deal structure",
    isComplete: (d) =>
      (d.capacity ?? 0) > 0 && (d.avgTicketPrice ?? 0) > 0,
    requiredFields: ["capacity", "avgTicketPrice"],
  },
  {
    id: "royalties",
    label: "Royalties & Fees",
    description: "Creative royalties, GP management fee, and royalty offset",
    isComplete: (d) => {
      const r = d.royalties;
      if (!r) return false;
      const total = (Object.values(r) as number[]).reduce((s, v) => s + v, 0);
      return total > 0;
    },
    requiredFields: [],
  },
  {
    id: "waterfall",
    label: "Waterfall & Fees",
    description: "Distribution structure, recoupment order, and profit sharing",
    isComplete: (d) =>
      d.waterfallType !== undefined && (d.postRecoupInvestorSplit ?? 0) > 0,
    requiredFields: ["waterfallType", "postRecoupInvestorSplit"],
  },
];

/**
 * Returns "complete" | "partial" | "empty" for a given section.
 * Used for section status dots in DealBuilderNav.
 */
export function getSectionStatus(
  section: SectionDef,
  inputs: Partial<DealInputs>
): "complete" | "partial" | "empty" {
  if (section.isComplete(inputs)) return "complete";

  // Check if any required field has a nonzero value
  const anyFilled = section.requiredFields.some((field) => {
    const v = inputs[field];
    return v !== undefined && v !== null && v !== 0 && v !== false;
  });

  // For royalties, check if any royalty value is set
  if (section.id === "royalties") {
    const r = inputs.royalties;
    if (r && (Object.values(r) as number[]).some((v) => v > 0)) return "partial";
    return "empty";
  }

  return anyFilled ? "partial" : "empty";
}
