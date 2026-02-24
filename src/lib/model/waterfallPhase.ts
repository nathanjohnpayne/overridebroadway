import type { ModelOutput } from "@/types/model";
import type { DealInputs } from "@/types/deal";

// ─── WaterfallPhase Enum ──────────────────────────────────────────────────────
//
// Derived entirely from model output + deal config ratios.
// Never reads toggle state (hasProfitSharing). That field controls whether
// postRecoupInvestorSplit < 1.0 — the economic condition is what matters here.

export enum WaterfallPhase {
  /** Show generates no positive operating profit in any modeled week */
  PRE_REVENUE = "PRE_REVENUE",
  /** Show generates profit but has not returned full capitalization */
  RECOUPMENT = "RECOUPMENT",
  /** Full capitalization returned; post-recoup profit sharing is active */
  POST_RECOUP_PROFIT_SHARING = "POST_RECOUP_PROFIT_SHARING",
  /**
   * Full capitalization returned but profit sharing is effectively disabled
   * (postRecoupInvestorSplit === 1.0, meaning investors take 100% and there
   * is no creative participation pool configured)
   */
  CLOSED = "CLOSED",
}

// ─── WaterfallPhaseState ──────────────────────────────────────────────────────

export interface WaterfallPhaseState {
  /** The current economic phase of this waterfall */
  phase: WaterfallPhase;

  /**
   * True when postRecoupInvestorSplit < 1.0, meaning creative participants
   * and/or the GP receive a share of post-recoup profit.
   * Derived from deal config ratios — NOT from the hasProfitSharing toggle.
   */
  profitSharingEnabled: boolean;

  /**
   * Capital actually returned to investors.
   * = MIN(totalInvestorDistributions, totalCapitalization)
   * Represents the recoupment portion of investor payments.
   */
  capitalReturned: number;

  /**
   * Investor distributions beyond the capitalization amount.
   * = MAX(0, totalInvestorDistributions − totalCapitalization)
   * These are true profit distributions, not return of capital.
   */
  profitDistributions: number;

  /** Week number when recoupment was achieved, or null */
  recoupWeek: number | null;

  /** Total weeks in the modeled run */
  totalWeeks: number;
}

// ─── deriveWaterfallPhaseState ────────────────────────────────────────────────

/**
 * Pure function — derives the current waterfall phase and associated metrics
 * from model output and deal configuration.
 *
 * Rules:
 * 1. PRE_REVENUE   — no week in the run generates positive operating profit
 * 2. RECOUPMENT    — some profit exists but cumulative < totalCapitalization
 * 3. POST_RECOUP_PROFIT_SHARING — recouped AND postRecoupInvestorSplit < 1.0
 * 4. CLOSED        — recouped AND postRecoupInvestorSplit === 1.0 (no creative pool)
 *
 * profitSharingEnabled = postRecoupInvestorSplit < 1.0
 *   (any creative participation or GP post-recoup carve indicates profit sharing)
 *   This is derived from config ratios, never from the hasProfitSharing toggle.
 */
export function deriveWaterfallPhaseState(
  modelOutput: ModelOutput,
  dealInputs: DealInputs
): WaterfallPhaseState {
  const cap = dealInputs.totalCapitalization;

  // Total investor payments across the run (from investorReturns or computed directly)
  const totalInvestorDist = modelOutput.weeks.reduce(
    (s, w) => s + w.investorDistribution,
    0
  );

  // Split into capital-return vs. profit-distribution portions
  const capitalReturned = Math.min(totalInvestorDist, cap);
  const profitDistributions = Math.max(0, totalInvestorDist - cap);

  // Profit sharing is a structural config question: does the deal give creatives
  // any post-recoup share? Check the ratio, not the toggle.
  // If postRecoupInvestorSplit < 1.0, the remaining (1 - split) goes to creatives.
  const profitSharingEnabled = dealInputs.postRecoupInvestorSplit < 1.0;

  // Does the run generate any positive operating profit at all?
  const hasPositiveProfit = modelOutput.weeks.some((w) => w.operatingProfit > 0);

  // Is the capitalization fully returned by end of run?
  const isRecouped = modelOutput.recoupWeek !== null;

  let phase: WaterfallPhase;

  if (!hasPositiveProfit) {
    phase = WaterfallPhase.PRE_REVENUE;
  } else if (!isRecouped) {
    phase = WaterfallPhase.RECOUPMENT;
  } else if (profitSharingEnabled) {
    phase = WaterfallPhase.POST_RECOUP_PROFIT_SHARING;
  } else {
    phase = WaterfallPhase.CLOSED;
  }

  return {
    phase,
    profitSharingEnabled,
    capitalReturned,
    profitDistributions,
    recoupWeek: modelOutput.recoupWeek,
    totalWeeks: modelOutput.weeks.length,
  };
}

// ─── Phase display helpers ────────────────────────────────────────────────────

export function getPhaseLabel(phase: WaterfallPhase): string {
  switch (phase) {
    case WaterfallPhase.PRE_REVENUE:
      return "Pre-Revenue";
    case WaterfallPhase.RECOUPMENT:
      return "In Recoupment";
    case WaterfallPhase.POST_RECOUP_PROFIT_SHARING:
      return "Post-Recoup · Profit Sharing Active";
    case WaterfallPhase.CLOSED:
      return "Post-Recoup · No Profit Sharing";
  }
}

export function getPhaseColors(phase: WaterfallPhase): {
  badge: string;
  banner: string;
} {
  switch (phase) {
    case WaterfallPhase.PRE_REVENUE:
      return {
        badge: "bg-red-100 text-red-800 border-red-200",
        banner: "bg-red-50 border-red-200 text-red-800",
      };
    case WaterfallPhase.RECOUPMENT:
      return {
        badge: "bg-amber-100 text-amber-800 border-amber-200",
        banner: "bg-amber-50 border-amber-200 text-amber-800",
      };
    case WaterfallPhase.POST_RECOUP_PROFIT_SHARING:
      return {
        badge: "bg-green-100 text-green-800 border-green-200",
        banner: "bg-green-50 border-green-200 text-green-800",
      };
    case WaterfallPhase.CLOSED:
      return {
        badge: "bg-blue-100 text-blue-800 border-blue-200",
        banner: "bg-blue-50 border-blue-200 text-blue-800",
      };
  }
}
