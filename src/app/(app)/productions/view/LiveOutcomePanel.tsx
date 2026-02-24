"use client";

/**
 * LiveOutcomePanel — read-only financial outcome card.
 * Reads from modelOutput only. Zero business logic — all computation
 * is done upstream in runScenario(). Displays skeleton when modelOutput is null.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/model/formatters";
import {
  deriveWaterfallPhaseState,
  getPhaseLabel,
  getPhaseColors,
} from "@/lib/model/waterfallPhase";
import type { ModelOutput } from "@/types/model";
import type { DealInputs } from "@/types/deal";

interface LiveOutcomePanelProps {
  modelOutput: ModelOutput | null;
  dealInputs: DealInputs | null;
  /** Live form values from watch() — used to compute investor multiple against live cap */
  liveValues: Partial<DealInputs>;
}

function MetricRow({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="text-xs text-muted-foreground leading-tight">{label}</div>
      <div className="text-right">
        <div className={`text-sm font-semibold font-mono tabular-nums ${valueClass ?? ""}`}>
          {value}
        </div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function SkeletonPanel() {
  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-primary">Live Outcome</CardTitle>
        <p className="text-[10px] text-muted-foreground">Updates as you type</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
        <Skeleton className="h-6 w-full mt-2" />
      </CardContent>
    </Card>
  );
}

export function LiveOutcomePanel({
  modelOutput,
  dealInputs,
  liveValues,
}: LiveOutcomePanelProps) {
  if (!modelOutput || !dealInputs) {
    return <SkeletonPanel />;
  }

  // Find first open (non-preview) week
  const openWeek = modelOutput.weeks.find((w) => !w.isPreview) ?? modelOutput.weeks[0];

  const weeklyGross  = openWeek?.grossBoxOffice ?? 0;
  const weeklyProfit = openWeek?.operatingProfit ?? 0;
  const breakeven    = modelOutput.weeklyBreakeven; // occupancy rate 0–1
  const recoupWeek   = modelOutput.recoupWeek;
  const totalCap     = (liveValues.totalCapitalization ?? dealInputs.totalCapitalization) || 1;

  // ── Capital recovery — derived from model output, no engine changes ────────
  // totalInvestorDistributions already combines recoupment-pool payments and
  // post-recoup LP distributions, so it is the correct "total returned to
  // investors" figure regardless of waterfall type.
  const totalReturned       = modelOutput.totalInvestorDistributions;
  const capitalRecoveryPct  = totalCap > 0 ? totalReturned / totalCap : 0;
  const fullyRecouped       = recoupWeek !== null;
  const hasAnyRecovery      = totalReturned > 0;

  // Investor multiple is only meaningful after full recoupment.
  // Pre-recoupment it would be < 1 and implies total loss — suppress it.
  const investorMult = fullyRecouped && totalCap > 0
    ? totalReturned / totalCap
    : null;

  // Risk band based on breakeven occupancy
  const riskLabel =
    breakeven === null
      ? { text: "No Breakeven", color: "text-red-700 bg-red-50 border-red-200" }
      : breakeven > 0.9
      ? { text: "High Risk", color: "text-red-700 bg-red-50 border-red-200" }
      : breakeven > 0.7
      ? { text: "Medium Risk", color: "text-amber-700 bg-amber-50 border-amber-200" }
      : { text: "Low Risk", color: "text-green-700 bg-green-50 border-green-200" };

  // Phase
  const phaseState = deriveWaterfallPhaseState(modelOutput, dealInputs);
  const phaseColors = getPhaseColors(phaseState.phase);
  const phaseLabel  = getPhaseLabel(phaseState.phase);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-primary">Live Outcome</CardTitle>
        <p className="text-[10px] text-muted-foreground">Updates as you type</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <MetricRow
          label="Weekly Gross (open wk)"
          value={formatCurrency(weeklyGross)}
        />
        <MetricRow
          label="Weekly Profit (open wk)"
          value={formatCurrency(weeklyProfit)}
          valueClass={weeklyProfit >= 0 ? "text-green-700" : "text-red-700"}
        />

        <div className="border-t pt-3 space-y-3">
          <MetricRow
            label="Breakeven Occupancy"
            value={breakeven !== null ? formatPercent(breakeven) : "Never"}
            valueClass={
              breakeven === null || breakeven > 0.9
                ? "text-red-700"
                : breakeven > 0.7
                ? "text-amber-700"
                : "text-green-700"
            }
          />

          {/* ── Recoup status — three cases ──────────────────────────── */}
          {fullyRecouped ? (
            // CASE 1: Full recoup — show week + investor multiple
            <>
              <MetricRow
                label="Recoup Week"
                value={`Week ${recoupWeek}`}
                sub={`of ${modelOutput.weeks.length}-week run`}
                valueClass="text-green-700"
              />
              <MetricRow
                label="Investor Multiple"
                value={`${investorMult!.toFixed(2)}×`}
                valueClass={investorMult! >= 1 ? "text-green-700" : "text-red-700"}
              />
            </>
          ) : hasAnyRecovery ? (
            // CASE 2: Partial recoup — show recovery %, not a misleading 0.00×
            <>
              <MetricRow
                label="Recoup Status"
                value="Full Recoup Not Reached"
                valueClass="text-amber-700"
              />
              <MetricRow
                label="Capital Returned"
                value={formatCurrency(totalReturned)}
                sub={`${formatPercent(capitalRecoveryPct)} of capitalization`}
                valueClass="text-amber-700"
              />
            </>
          ) : (
            // CASE 3: No capital recovery at all
            <>
              <MetricRow
                label="Recoup Status"
                value="No Capital Recovery Modeled"
                valueClass="text-red-700"
              />
              <MetricRow
                label="Capital Returned"
                value="$0"
                sub="0% of capitalization"
                valueClass="text-red-700"
              />
            </>
          )}
        </div>

        {/* Risk band */}
        <div className={`rounded-md border px-3 py-2 text-center text-xs font-semibold ${riskLabel.color}`}>
          {riskLabel.text}
          {breakeven !== null && (
            <span className="font-normal ml-1 text-[10px]">
              · breakeven at {formatPercent(breakeven)} occ.
            </span>
          )}
        </div>

        {/* Phase badge */}
        <div
          className={`rounded-md border px-3 py-2 text-center text-[10px] font-medium ${phaseColors.badge}`}
        >
          {phaseLabel}
        </div>
      </CardContent>
    </Card>
  );
}
