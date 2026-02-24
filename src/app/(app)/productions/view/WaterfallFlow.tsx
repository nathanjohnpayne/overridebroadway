"use client";

import { useState } from "react";
import { Info, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, formatPercent } from "@/lib/model/formatters";
import {
  deriveWaterfallPhaseState,
  WaterfallPhase,
  getPhaseLabel,
  getPhaseColors,
} from "@/lib/model/waterfallPhase";
import type { ModelOutput } from "@/types/model";
import type { DealInputs } from "@/types/deal";

// ─── InfoTip ──────────────────────────────────────────────────────────────────

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StageRow {
  type: "value" | "deduction" | "subtotal" | "split";
  label: string;
  tooltip: string;
  amount: number;
  borderColor: string;
  amountColor: string;
  bgColor?: string;
}

interface WaterfallFlowProps {
  modelOutput: ModelOutput;
  dealInputs: DealInputs;
}

// ─── WaterfallFlow ────────────────────────────────────────────────────────────

export function WaterfallFlow({ modelOutput, dealInputs }: WaterfallFlowProps) {
  const [viewMode, setViewMode] = useState<"pre" | "post">("pre");

  // ── Derive phase state from engine output (never from toggle state) ─────────
  const phaseState = deriveWaterfallPhaseState(modelOutput, dealInputs);
  const phaseColors = getPhaseColors(phaseState.phase);

  // Representative weeks
  const openWeeks = modelOutput.weeks.filter((w) => !w.isPreview);
  const preRecoupWeek =
    openWeeks.find((w) => !w.isRecouped) ?? openWeeks[0] ?? modelOutput.weeks[0];
  const postRecoupWeek = openWeeks.find((w) => w.isRecouped) ?? null;
  const activeWeek =
    viewMode === "post" && postRecoupWeek ? postRecoupWeek : preRecoupWeek;

  // Recoupment progress
  const lastWeek = modelOutput.weeks[modelOutput.weeks.length - 1];
  const finalRecoupPercent = lastWeek
    ? Math.min(1, Math.max(0, lastWeek.cumulativeProfit / dealInputs.totalCapitalization))
    : 0;
  const finalCumulativeProfit = lastWeek?.cumulativeProfit ?? 0;
  const remainingBalance = Math.max(0, dealInputs.totalCapitalization - finalCumulativeProfit);

  // Run-total distributions (for Section C)
  // LP investor distributions include both capital-return and profit-distribution portions.
  // We separate them using phaseState.capitalReturned / profitDistributions.
  const totalLpDist = modelOutput.weeks.reduce((s, w) => s + w.investorDistribution, 0);
  const totalGpDist = modelOutput.weeks.reduce((s, w) => s + w.gpDistribution, 0);
  const totalCreativeDist = modelOutput.weeks.reduce((s, w) => s + w.creativeDistribution, 0);

  // Post-recoup split percentages (from deal config — not from toggle)
  const investorSplit = dealInputs.postRecoupInvestorSplit; // e.g. 0.667
  const gpCarve = dealInputs.gpShareOfInvestorPool; // e.g. 0.10
  const netLpPct = investorSplit * (1 - gpCarve); // e.g. 0.60
  const gpCarvePct = investorSplit * gpCarve; // e.g. 0.067
  const creativePct = 1 - investorSplit; // e.g. 0.333

  // ── Build stage rows ───────────────────────────────────────────────────────

  const w = activeWeek;

  if (!w) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          No model data available. Adjust run parameters to see results.
        </CardContent>
      </Card>
    );
  }

  const grossBo = w.grossBoxOffice;
  const gpFees = w.gpFee + (w.gpFlatPayment ?? 0);
  const preGpOperatingProfit = w.operatingProfit + gpFees;

  const isLossWeek = w.operatingProfit < 0;

  // Distribution label depends on view mode:
  // pre-recoup → "Investor Recoupment" (returning capital, not profit)
  // post-recoup → "Investor Profit Distribution" (true profit sharing)
  const distributionLabel =
    viewMode === "pre" ? "→ Investor Recoupment" : "→ Investor Profit Distribution";
  const distributionTooltip =
    viewMode === "pre"
      ? "Pre-recoupment: 100% of distributable profit goes toward returning investor capital. This is return of capital — not a profit distribution — until the full capitalization is recovered."
      : "Post-recoupment: LP investors receive their profit-sharing percentage of distributable profit. This is after the GP carve is extracted from the investor pool. Capital has been fully returned.";

  const coreStages: StageRow[] = [
    {
      type: "value",
      label: "Gross Box Office",
      tooltip:
        "Capacity × performances per week × blended ticket price (full-price and discounted seat mix). The total revenue ceiling before any deductions.",
      amount: grossBo,
      borderColor: "border-l-gray-400",
      amountColor: "text-gray-900",
    },
    {
      type: "deduction",
      label: "− CC Fees + House Deduction",
      tooltip:
        "Credit card and ticketing fees (typically 2.5–3.5% of gross) plus the house's percentage of gross receipts (typically 5–7%). Both are taken off the top before royalty calculations.",
      amount: w.creditCardFees + w.houseDeduction,
      borderColor: "border-l-red-400",
      amountColor: "text-red-700",
    },
    {
      type: "subtotal",
      label: "Adjusted Gross",
      tooltip:
        "Gross Box Office minus credit card fees and house deductions. This is the base amount used for calculating royalties (in fixed-% mode).",
      amount: w.adjustedGross,
      borderColor: "border-l-blue-500",
      amountColor: "text-blue-700",
      bgColor: "bg-blue-50/50",
    },
    {
      type: "deduction",
      label: "− Royalties",
      tooltip:
        "Weekly royalty payments to creative participants: authors, composers, lyricists, directors, choreographers, designers, and any star participation. Applied to adjusted gross.",
      amount: w.totalRoyalties,
      borderColor: "border-l-amber-400",
      amountColor: "text-amber-700",
    },
    {
      type: "deduction",
      label: "− Weekly Nut",
      tooltip:
        "Fixed weekly operating costs including cast, crew, musicians, marketing, general management, theater rent (flat component), and administration. Paid regardless of revenue.",
      amount: w.weeklyNut,
      borderColor: "border-l-red-500",
      amountColor: "text-red-700",
    },
    {
      type: "subtotal",
      label: "Operating Profit",
      tooltip:
        "Net box office minus the weekly nut. This is the profit available for GP fees and waterfall distributions. A negative number means the show lost money this week.",
      amount: preGpOperatingProfit,
      borderColor: preGpOperatingProfit >= 0 ? "border-l-indigo-500" : "border-l-red-500",
      amountColor: preGpOperatingProfit >= 0 ? "text-indigo-700" : "text-red-700",
      bgColor: preGpOperatingProfit >= 0 ? "bg-indigo-50/50" : "bg-red-50/50",
    },
  ];

  const distributionStages: StageRow[] = [];

  if (!isLossWeek) {
    if (gpFees > 0) {
      distributionStages.push({
        type: "deduction",
        label: "− GP Management Fees",
        tooltip:
          "GP management fee (% of profit before waterfall) plus any fixed weekly payment or profit-% override. These come off before the waterfall distributes to investors and creatives.",
        amount: gpFees,
        borderColor: "border-l-violet-400",
        amountColor: "text-violet-700",
      });
    }

    if (viewMode === "pre") {
      distributionStages.push({
        type: "subtotal",
        label: distributionLabel,
        tooltip: distributionTooltip,
        amount: w.toRecoupmentPool,
        borderColor: "border-l-green-500",
        amountColor: "text-green-700",
        bgColor: "bg-green-50/50",
      });
    } else {
      distributionStages.push({
        type: "subtotal",
        label: distributionLabel,
        tooltip: distributionTooltip,
        amount: w.investorDistribution,
        borderColor: "border-l-green-500",
        amountColor: "text-green-700",
        bgColor: "bg-green-50/50",
      });

      if (w.gpDistribution > 0) {
        distributionStages.push({
          type: "split",
          label: "→ GP Carve (from Investor Pool)",
          tooltip:
            "The GP receives a carved percentage of the investor pool as a performance fee. This is extracted from the investor pool before LP distributions, not from the creative pool.",
          amount: w.gpDistribution,
          borderColor: "border-l-violet-500",
          amountColor: "text-violet-700",
        });
      }

      if (w.creativeDistribution > 0) {
        distributionStages.push({
          type: "split",
          label: "→ Creative Participants",
          tooltip:
            "Post-recoupment profit share paid to creative participants. This is separate from and in addition to their weekly royalties — it's their share of the ongoing profit split.",
          amount: w.creativeDistribution,
          borderColor: "border-l-teal-500",
          amountColor: "text-teal-700",
        });
      }
    }
  }

  const allStages = [...coreStages, ...distributionStages];

  return (
    <div className="space-y-5">
      {/* ── Phase Banner ─────────────────────────────────────────────────── */}
      <div
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${phaseColors.banner}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">
              Waterfall Phase:
            </span>
            <Badge className={`text-xs font-medium border ${phaseColors.badge} bg-transparent`}>
              {getPhaseLabel(phaseState.phase)}
            </Badge>
          </div>
          <p className="text-xs mt-1 opacity-80">
            {phaseState.phase === WaterfallPhase.PRE_REVENUE &&
              "No profitable weeks in the estimated run. No distributions to investors or creatives occur."}
            {phaseState.phase === WaterfallPhase.RECOUPMENT &&
              `Generating profit but capitalization not yet returned. ${phaseState.recoupWeek ? `Recoupment projected at Week ${phaseState.recoupWeek}.` : "Show does not recoup within the estimated run."}`}
            {phaseState.phase === WaterfallPhase.POST_RECOUP_PROFIT_SHARING &&
              `Capitalization returned at Week ${phaseState.recoupWeek}. Post-recoup profit sharing active — LP investors, GP, and creatives all participate.`}
            {phaseState.phase === WaterfallPhase.CLOSED &&
              `Capitalization returned at Week ${phaseState.recoupWeek}. Investor pool takes 100% of post-recoup profit — no creative participation configured.`}
          </p>
        </div>

        {/* Waterfall ordering legend */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs opacity-75 shrink-0">
          <span className="font-medium">Order:</span>
          <span className="rounded px-1.5 py-0.5 bg-violet-100 text-violet-800 border border-violet-200 text-[10px] font-medium">
            GP Fees
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-medium">
            Recoupment
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded px-1.5 py-0.5 bg-green-100 text-green-800 border border-green-200 text-[10px] font-medium">
            Profit Share
          </span>
        </div>
      </div>

      {/* ── Section A: Vertical Flow Diagram ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">
              Weekly Revenue Flow
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">View week:</span>
              <button
                onClick={() => setViewMode("pre")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === "pre"
                    ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Pre-Recoup
              </button>
              <button
                onClick={() => setViewMode("post")}
                disabled={!postRecoupWeek}
                title={
                  !postRecoupWeek
                    ? "Show does not recoup within the estimated run"
                    : undefined
                }
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  viewMode === "post"
                    ? "bg-green-100 text-green-800 border border-green-200"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Post-Recoup
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Showing{" "}
            {viewMode === "pre"
              ? postRecoupWeek
                ? `Week ${preRecoupWeek?.week ?? "—"} (first pre-recoup open week)`
                : `Week ${preRecoupWeek?.week ?? "—"} (open week)`
              : `Week ${postRecoupWeek?.week ?? "—"} (first post-recoup week)`}
            {" "}· Occupancy{" "}
            {formatPercent(activeWeek.occupancyRate)}
          </p>
        </CardHeader>
        <CardContent className="space-y-0 pb-5">
          {allStages.map((stage, i) => {
            const isSubtotal = stage.type === "subtotal";
            const isSplit = stage.type === "split";
            const isDeduction = stage.type === "deduction";
            const showSeparator =
              i > 0 && (isSubtotal || allStages[i - 1]?.type === "subtotal");

            return (
              <div key={i}>
                {showSeparator && <Separator className="my-1" />}

                <div
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border-l-4 ${stage.borderColor} ${
                    stage.bgColor ?? ""
                  } ${isSubtotal ? "my-1" : ""}`}
                >
                  {/* Left: label + tooltip */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-sm ${
                          isSubtotal ? "font-semibold" : isSplit ? "font-medium pl-2" : "font-medium"
                        }`}
                      >
                        {stage.label}
                      </span>
                      <InfoTip>{stage.tooltip}</InfoTip>
                    </div>
                    {isDeduction && grossBo > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatPercent(stage.amount / grossBo)} of gross
                      </p>
                    )}
                  </div>

                  {/* Right: amount */}
                  <div className="text-right shrink-0">
                    <p
                      className={`font-mono ${
                        isSubtotal ? "text-base font-bold" : "text-sm font-medium"
                      } ${stage.amountColor}`}
                    >
                      {isDeduction ? "−" : ""}{formatCurrency(stage.amount)}
                    </p>
                    {isSubtotal && grossBo > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatPercent(stage.amount / grossBo)} of gross
                      </p>
                    )}
                  </div>
                </div>

                {/* Arrow connector (between non-subtotal stages) */}
                {i < allStages.length - 1 &&
                  !isSubtotal &&
                  allStages[i + 1]?.type !== "subtotal" && (
                    <div className="flex justify-center py-0.5">
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  )}
              </div>
            );
          })}

          {/* Loss week callout */}
          {isLossWeek && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <strong>Loss week:</strong> Operating profit is negative — no waterfall distributions occur. All losses are borne by the production.
            </div>
          )}

          {/* Waterfall type note */}
          <div className="mt-4 px-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-1.5">
            <InfoTip>
              {dealInputs.waterfallType === "recoup_first"
                ? "Recoup-First: 100% of weekly operating profit is allocated to investor recoupment until the full capitalization is returned. Post-recoup profit sharing only activates after the threshold is crossed."
                : "Share From Dollar One: Post-recoup profit sharing applies from week one. Investor distributions count simultaneously toward recoupment tracking."}
            </InfoTip>
            <span>
              Waterfall type:{" "}
              <strong>
                {dealInputs.waterfallType === "recoup_first"
                  ? "Recoup-First"
                  : "Share From Dollar One"}
              </strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Section B: Recoupment Progress ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            Recoupment Progress
            {modelOutput.recoupWeek ? (
              <Badge className="bg-green-100 text-green-800 border-green-200 font-medium">
                Recouped Week {modelOutput.recoupWeek}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-700 border-amber-300 font-medium">
                No Recoup in Estimated Run
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>$0</span>
              <span>{formatCurrency(dealInputs.totalCapitalization)}</span>
            </div>
            <Progress
              value={finalRecoupPercent * 100}
              className={`h-3 ${modelOutput.recoupWeek ? "[&>div]:bg-green-500" : "[&>div]:bg-amber-400"}`}
            />
            <p className="text-xs text-center text-muted-foreground">
              {formatPercent(finalRecoupPercent)} of capitalization returned by end of run
            </p>
          </div>

          {/* Stat chips — separated into capital-return vs. profit-distribution */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Capitalization Target",
                value: formatCurrency(dealInputs.totalCapitalization),
              },
              {
                label: "Recoup Week",
                value: modelOutput.recoupWeek ? `Week ${modelOutput.recoupWeek}` : "Never",
                valueClass: modelOutput.recoupWeek ? "text-green-700" : "text-amber-700",
              },
              {
                label: "Capital Returned",
                value: formatCurrency(phaseState.capitalReturned),
                tooltip: "The portion of investor distributions that represents return of original capital — up to the full capitalization amount.",
                valueClass: phaseState.capitalReturned >= dealInputs.totalCapitalization ? "text-green-700" : undefined,
              },
              {
                label: "Profit Distributions",
                value: phaseState.profitDistributions > 0
                  ? formatCurrency(phaseState.profitDistributions)
                  : modelOutput.recoupWeek
                    ? "$0"
                    : "—",
                tooltip: "Investor distributions beyond the capitalization amount. These are true profit distributions paid after capital is fully returned.",
                valueClass: phaseState.profitDistributions > 0 ? "text-green-700" : undefined,
              },
            ].map(({ label, value, valueClass, tooltip }) => (
              <div key={label} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {tooltip && <InfoTip>{tooltip}</InfoTip>}
                </div>
                <p className={`text-base font-bold mt-0.5 font-mono ${valueClass ?? ""}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Capital balance row */}
          {!modelOutput.recoupWeek && remainingBalance > 0 && (
            <div className="rounded-md border bg-amber-50 border-amber-200 px-3 py-2.5 flex items-center justify-between text-sm">
              <span className="text-amber-800 font-medium">Remaining Capital Balance</span>
              <span className="font-mono font-bold text-amber-700">{formatCurrency(remainingBalance)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section C: Post-Recoup Profit Distribution ───────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            Post-Recoup Profit Distribution
            {!phaseState.profitSharingEnabled && (
              <Badge variant="outline" className="text-muted-foreground border-muted text-[10px] font-normal">
                No creative pool
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Disabled state: derived from config ratios, NOT from toggle */}
          {!phaseState.profitSharingEnabled ? (
            <div className="rounded-lg bg-muted/50 border p-4 text-sm text-muted-foreground">
              <strong className="text-foreground">No post-recoup creative participation is configured.</strong>{" "}
              The investor pool is set to 100% of post-recoup profit, leaving no share for creative
              participants. Investors receive all post-recoup distributions. To enable profit sharing,
              reduce the Investor Pool percentage in Deal Inputs → Waterfall & Fees.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Segmented bar */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Per $100 of post-recoup distributable profit</p>
                <div className="flex h-9 rounded-lg overflow-hidden w-full border border-border/50">
                  <div
                    style={{ flex: netLpPct }}
                    className="bg-green-500 flex items-center justify-center text-white text-xs font-semibold px-1"
                  >
                    {formatPercent(netLpPct)}
                  </div>
                  {gpCarvePct > 0.005 && (
                    <div
                      style={{ flex: gpCarvePct }}
                      className="bg-violet-500 flex items-center justify-center text-white text-xs font-semibold px-1"
                    >
                      {formatPercent(gpCarvePct)}
                    </div>
                  )}
                  <div
                    style={{ flex: creativePct }}
                    className="bg-teal-500 flex items-center justify-center text-white text-xs font-semibold px-1"
                  >
                    {formatPercent(creativePct)}
                  </div>
                </div>
              </div>

              {/* Three-column breakdown */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center space-y-1">
                  <div className="h-1 rounded-full bg-green-500 mx-4" />
                  <p className="text-xs text-muted-foreground font-medium">LP Investors</p>
                  <p className="text-xl font-bold text-green-700">{formatPercent(netLpPct)}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalLpDist > 0 ? formatCurrency(totalLpDist) : "—"} over run
                  </p>
                  {phaseState.capitalReturned < dealInputs.totalCapitalization && totalLpDist > 0 && (
                    <p className="text-[10px] text-muted-foreground/70 leading-tight">
                      (incl. capital return)
                    </p>
                  )}
                </div>
                <div className="text-center space-y-1">
                  <div className="h-1 rounded-full bg-violet-500 mx-4" />
                  <p className="text-xs text-muted-foreground font-medium">GP Carve</p>
                  <p className="text-xl font-bold text-violet-700">{formatPercent(gpCarvePct)}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalGpDist > 0 ? formatCurrency(totalGpDist) : "—"} over run
                  </p>
                </div>
                <div className="text-center space-y-1">
                  <div className="h-1 rounded-full bg-teal-500 mx-4" />
                  <p className="text-xs text-muted-foreground font-medium">Creatives</p>
                  <p className="text-xl font-bold text-teal-700">{formatPercent(creativePct)}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalCreativeDist > 0 ? formatCurrency(totalCreativeDist) : "—"} over run
                  </p>
                </div>
              </div>

              {/* Context note: show doesn't recoup */}
              {!modelOutput.recoupWeek && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  The show does not recoup within the estimated run — post-recoup profit distributions are $0. The split above shows the contractual structure that would apply if recoupment were achieved.
                </div>
              )}

              {/* Context note: in recoupment (show does recoup but post-recoup dists are partial) */}
              {modelOutput.recoupWeek && phaseState.profitDistributions === 0 && totalLpDist > 0 && (
                <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                  All investor distributions represent return of capital — no post-recoup profit distributions yet in this run length.
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-1 border-t flex items-center gap-1.5">
                <InfoTip>
                  LP investors receive {formatPercent(netLpPct)} of post-recoup operating profit. The GP carve ({formatPercent(gpCarvePct)}) is extracted from the investor pool before LP distributions — not from the creative pool. Creatives receive {formatPercent(creativePct)} as their ongoing profit participation, which is separate from and in addition to their weekly royalties.
                </InfoTip>
                <span>
                  Investor pool {formatPercent(investorSplit)} total → LP {formatPercent(netLpPct)} + GP carve {formatPercent(gpCarvePct)} · Creatives {formatPercent(creativePct)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
