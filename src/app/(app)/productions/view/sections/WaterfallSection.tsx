"use client";

import { Controller } from "react-hook-form";
import type { Control, UseFormWatch, UseFormSetValue } from "react-hook-form";
import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { PercentInput, CurrencyInput, InfoTip } from "../shared/FormFields";
import { formatCurrency } from "@/lib/model/formatters";
import {
  deriveWaterfallPhaseState,
  WaterfallPhase as WPhase,
  getPhaseLabel as getWaterfallPhaseLabel,
  getPhaseColors as getWaterfallPhaseColors,
} from "@/lib/model/waterfallPhase";
import type { DealInputs } from "@/types/deal";
import type { ModelOutput } from "@/types/model";

interface SectionProps {
  control: Control<DealInputs>;
  watch: UseFormWatch<DealInputs>;
  setValue: UseFormSetValue<DealInputs>;
  modelOutput: ModelOutput | null;
  dealInputs: DealInputs | null;
}

export function WaterfallSection({ control, watch, setValue, modelOutput, dealInputs }: SectionProps) {
  const watchedWaterfallType      = watch("waterfallType");
  const watchedInvestorSplit      = watch("postRecoupInvestorSplit");
  const watchedGpShare            = watch("gpShareOfInvestorPool");
  const watchedGpFeeRate          = watch("gpFeeRate");
  const watchedGpFlatWeekly       = watch("gpFlatWeekly");
  const watchedGpFlatProfitPercent = watch("gpFlatProfitPercent");
  const watchedRoyaltyOffset      = watch("runningRoyaltyOffset");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waterfall &amp; Fee Structure</CardTitle>
        <CardDescription>
          Configure the order and terms under which revenue is distributed — from recoupment
          through profit sharing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ── PHASE INDICATOR ── */}
        {(() => {
          if (!modelOutput || !dealInputs) {
            return (
              <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Current Waterfall Phase
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Adjust deal inputs to see live phase status.
                </p>
              </div>
            );
          }

          const phaseState = deriveWaterfallPhaseState(modelOutput, dealInputs);
          const colors = getWaterfallPhaseColors(phaseState.phase);
          const isRecoupFirst = watchedWaterfallType === "recoup_first";
          const totalWeeks = modelOutput.weeks.length;

          return (
            <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                Current Waterfall Phase
              </p>
              {isRecoupFirst ? (
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Phase 1: Recoupment */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        phaseState.phase === WPhase.RECOUPMENT ||
                        phaseState.phase === WPhase.PRE_REVENUE
                          ? "bg-indigo-500"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        phaseState.phase === WPhase.RECOUPMENT ||
                        phaseState.phase === WPhase.PRE_REVENUE
                          ? "text-indigo-700"
                          : "text-muted-foreground"
                      }`}
                    >
                      Recoupment
                    </span>
                    {(phaseState.phase === WPhase.RECOUPMENT ||
                      phaseState.phase === WPhase.PRE_REVENUE) && (
                      <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">→</span>
                  {/* Phase 2: Profit Sharing */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        phaseState.phase === WPhase.POST_RECOUP_PROFIT_SHARING ||
                        phaseState.phase === WPhase.CLOSED
                          ? "bg-green-500"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        phaseState.phase === WPhase.POST_RECOUP_PROFIT_SHARING ||
                        phaseState.phase === WPhase.CLOSED
                          ? "text-green-700"
                          : "text-muted-foreground"
                      }`}
                    >
                      Profit Sharing
                    </span>
                    {phaseState.phase === WPhase.POST_RECOUP_PROFIT_SHARING ||
                    phaseState.phase === WPhase.CLOSED ? (
                      <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                        ACTIVE from Wk {phaseState.recoupWeek}
                      </span>
                    ) : phaseState.profitSharingEnabled ? (
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        PENDING — activates after recoupment
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground bg-muted border rounded px-1.5 py-0.5">
                        NOT CONFIGURED
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* Share From Dollar One: both phases concurrent */
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0" />
                    <span className="text-sm font-medium text-indigo-700">
                      Recoupment + Profit Sharing — concurrent from week 1
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {phaseState.recoupWeek
                      ? `Recouped Week ${phaseState.recoupWeek} of ${totalWeeks}`
                      : `Not yet recouped across ${totalWeeks}-week run`}
                  </span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 border text-[10px] font-medium ${colors.badge}`}
                >
                  {getWaterfallPhaseLabel(phaseState.phase)}
                </span>
                {" · "}
                {phaseState.recoupWeek
                  ? `Capital returned at Week ${phaseState.recoupWeek} of ${totalWeeks}`
                  : `Capital not returned across ${totalWeeks}-week run`}
              </p>
            </div>
          );
        })()}

        <Separator />

        {/* ── 1. Recoupment Structure ── */}
        <div className="space-y-3">
          <div>
            <Label className="text-base">Recoupment Structure</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Controls <em>when</em> profit participation begins — this governs the timing of
              distributions, not whether they exist.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                {
                  value: "recoup_first",
                  label: "Recoup First",
                  desc: "100% of weekly operating profit flows to investor recoupment until the full capitalization is returned. Profit participation (configured below) activates only after investors are fully repaid.",
                },
                {
                  value: "share_from_dollar_one",
                  label: "Share From Dollar One",
                  desc: "Distributable profit is split by profit participation percentages starting from the first profitable week. The investor portion simultaneously reduces the unrecouped capitalization balance.",
                },
              ] as const
            ).map((opt) => (
              <div
                key={opt.value}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  watchedWaterfallType === opt.value
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => setValue("waterfallType", opt.value, { shouldDirty: true })}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={`h-3 w-3 rounded-full border-2 shrink-0 ${
                      watchedWaterfallType === opt.value
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    }`}
                  />
                  <span className="font-medium text-sm">{opt.label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* ── 2. Post-Recoup Profit Participation ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">
                {watchedWaterfallType === "recoup_first"
                  ? "Post-Recoup Profit Participation"
                  : "Investor Profit Participation"}
                <InfoTip>
                  {watchedWaterfallType === "recoup_first"
                    ? "Whether investors share in ongoing profits after capitalization is returned. If disabled, all post-recoup operating profit goes to creatives. Most Broadway musicals include this — disabling is rare and typically applies to straight plays or limited runs."
                    : "Whether investors participate in profit distributions. Under Share From Dollar One, participation is concurrent with recoupment — disable this only if investors receive 100% of operating profit until recouped, with no creative participation."}
                </InfoTip>
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {watchedWaterfallType === "recoup_first"
                  ? "Configures participation — inactive during recoupment, activates after capitalization is fully returned"
                  : "Investors and creatives share distributable profit from week one"}
              </p>
            </div>
            <Controller
              name="hasProfitSharing"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value ?? true}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          {/* Inactive-during-recoupment notice — derived from waterfallType, not toggle */}
          {watchedWaterfallType === "recoup_first" && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>Inactive during recoupment.</strong> This distribution applies only after
                investors are fully repaid.
                {modelOutput?.recoupWeek
                  ? ` Based on current assumptions, profit sharing activates at Week ${modelOutput.recoupWeek}.`
                  : " Based on current assumptions, the show does not recoup within the estimated run — profit sharing will not activate."}
              </span>
            </div>
          )}

          {(() => {
            const investorPoolPct = (watchedInvestorSplit ?? 0.5) * 100;
            const gpCarvePct      = (watchedGpShare ?? 0.1) * 100;
            const netLpPct        = investorPoolPct * (1 - (watchedGpShare ?? 0.1));
            const gpFromPoolPct   = investorPoolPct * (watchedGpShare ?? 0.1);
            const creativePct     = 100 - investorPoolPct;
            const grandTotal      = netLpPct + gpFromPoolPct + creativePct;
            const valid           = Math.abs(grandTotal - 100) < 0.01;

            // Suppress unused-variable warning for gpCarvePct
            void gpCarvePct;

            return (
              <div className="space-y-5 pl-4 border-l-2 border-muted">
                {/* Input fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>
                      Investor Pool (Total, incl. GP carve)
                      <InfoTip>
                        The combined % of post-recoup distributable profit allocated to the entire
                        investor pool — LP investors plus the GP&apos;s carved share. The GP&apos;s
                        portion is extracted from this pool first; LP investors receive the
                        remainder. Standard: 50%. The remaining % goes to creative participants.
                      </InfoTip>
                    </Label>
                    <Controller
                      name="postRecoupInvestorSplit"
                      control={control}
                      render={({ field }) => (
                        <PercentInput value={field.value} onChange={field.onChange} />
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      Combined LP + GP carve · remainder to creatives
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      GP Carve (% of Investor Pool)
                      <InfoTip>
                        The GP receives this % of the investor pool as a performance fee, carved out
                        before LP investors are paid. Example: 10% GP carve of a 50% investor pool
                        means GP gets 5% of total profit, LPs get 45%. Typically 10–20%. This is a
                        percentage of the investor pool, not of total distributable profit.
                      </InfoTip>
                    </Label>
                    <Controller
                      name="gpShareOfInvestorPool"
                      control={control}
                      render={({ field }) => (
                        <PercentInput value={field.value} onChange={field.onChange} />
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      % of investor pool only — not of total profit
                    </p>
                  </div>
                </div>

                {/* Investor pool breakdown + Distribution summary */}
                <div
                  className={`rounded-lg border text-sm overflow-hidden ${valid ? "" : "border-red-200"}`}
                >
                  {/* Header */}
                  <div
                    className={`px-4 pt-3 pb-2.5 border-b ${valid ? "bg-muted/30" : "bg-red-50"}`}
                  >
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                      Post-Recoup Distribution
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {watchedWaterfallType === "recoup_first"
                        ? "Activated only after capitalization is fully returned"
                        : "Applied from the first profitable week"}
                    </p>
                  </div>

                  {/* Nested breakdown */}
                  <div className="px-4 py-3 space-y-1.5 text-xs border-b bg-background">
                    <div className="flex justify-between font-medium">
                      <span className="text-foreground">Investor Pool (Total)</span>
                      <span className="font-mono">{investorPoolPct.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between pl-5 text-muted-foreground">
                      <span>├ LP Investors (Net)</span>
                      <span className="font-mono text-green-700">{netLpPct.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between pl-5 text-muted-foreground">
                      <span>└ GP Carve (from Investor Pool)</span>
                      <span className="font-mono text-violet-700">{gpFromPoolPct.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between font-medium pt-0.5">
                      <span className="text-foreground">Creative Participants</span>
                      <span className="font-mono">{creativePct.toFixed(2)}%</span>
                    </div>
                  </div>

                  {/* Three-column summary */}
                  <div className="grid grid-cols-3 divide-x">
                    <div className="text-center px-3 py-3">
                      <p className="text-base font-bold text-green-700 font-mono">
                        {netLpPct.toFixed(2)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">LP Investors</p>
                    </div>
                    <div className="text-center px-3 py-3">
                      <p className="text-base font-bold text-violet-700 font-mono">
                        {gpFromPoolPct.toFixed(2)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">GP Carve</p>
                    </div>
                    <div className="text-center px-3 py-3">
                      <p className="text-base font-bold text-blue-700 font-mono">
                        {creativePct.toFixed(2)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Creatives</p>
                    </div>
                  </div>

                  {/* Total allocation row */}
                  <div
                    className={`flex justify-between items-center px-4 py-2 border-t text-xs ${
                      valid ? "bg-muted/40" : "bg-red-100"
                    }`}
                  >
                    <span className="text-muted-foreground font-medium">Total Allocation</span>
                    <span
                      className={`font-mono font-semibold ${
                        valid ? "text-foreground" : "text-red-700"
                      }`}
                    >
                      {grandTotal.toFixed(2)}%{valid ? " ✓" : " ⚠ must equal 100.00%"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Profit participation info when investor pool = 100% */}
          {(watchedInvestorSplit ?? 0.5) >= 1.0 && (
            <div className="pl-4 border-l-2 border-muted text-xs text-muted-foreground py-2 space-y-1">
              <p>
                Investor pool is set to 100% — no creative participation pool is configured.
              </p>
              <p>
                All post-recoup distributable profit goes to the investor pool (LP investors + GP
                carve). To enable creative participation, reduce the Investor Pool percentage.
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* ── 3. GP Compensation ── */}
        <div className="space-y-4">
          <div>
            <Label className="text-base">
              GP Compensation
              <InfoTip>
                GP fees are deducted from weekly operating profit before the waterfall split. Under
                standard Broadway structure, GP compensation applies every profitable week regardless
                of recoupment status — i.e., before investors recoup. This ordering is fixed in the
                calculation engine.
              </InfoTip>
            </Label>
            {/* Ordering display */}
            <div className="mt-2 flex items-center gap-0 text-xs text-muted-foreground flex-wrap">
              <span className="rounded px-2 py-0.5 bg-violet-50 border border-violet-200 text-violet-700 font-medium">
                GP Fees
              </span>
              <span className="px-1.5">→</span>
              <span className="rounded px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium">
                Recoupment
              </span>
              <span className="px-1.5">→</span>
              <span className="rounded px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 font-medium">
                Profit Sharing
              </span>
              <span className="ml-2 text-muted-foreground/70 italic">
                · applied in this order every profitable week
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">
                GP Management Fee Rate
                <InfoTip>
                  Weekly % of positive operating profit paid to the GP as a management/production
                  fee. Typical range: 1–3%. Applied before both recoupment and profit sharing —
                  active every profitable week.
                </InfoTip>
              </Label>
              <Controller
                name="gpFeeRate"
                control={control}
                render={({ field }) => (
                  <PercentInput value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">
              GP Flat Overrides{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Additional fixed compensation applied in sequence:{" "}
              <strong>fixed weekly → % of remaining profit → remainder enters waterfall.</strong>
            </p>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Fixed Weekly Payment
                  <InfoTip>
                    A flat dollar amount paid to the GP each week from operating profit, applied
                    before percentage fees. Capped at available profit — cannot create a loss.
                  </InfoTip>
                </Label>
                <Controller
                  name="gpFlatWeekly"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value ?? 0}
                      onChange={(v) => field.onChange(v || undefined)}
                      placeholder="0"
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Flat % of Net Profit
                  <InfoTip>
                    A fixed % of operating profit paid to the GP after the fixed weekly payment.
                    Applied before the waterfall split.
                  </InfoTip>
                </Label>
                <Controller
                  name="gpFlatProfitPercent"
                  control={control}
                  render={({ field }) => (
                    <PercentInput
                      value={field.value ?? 0}
                      onChange={(v) => field.onChange(v || undefined)}
                    />
                  )}
                />
              </div>
            </div>
          </div>

          {/* Effective GP Economics summary */}
          {(() => {
            const gpFeeRatePct      = (watchedGpFeeRate ?? 0) * 100;
            const gpFlatW           = watchedGpFlatWeekly ?? 0;
            const gpFlatProfitPct   = (watchedGpFlatProfitPercent ?? 0) * 100;
            const gpInvestorCarvePct = (watchedInvestorSplit ?? 0.5) * (watchedGpShare ?? 0.1) * 100;
            const activeChannels    = [
              gpFeeRatePct > 0,
              gpFlatW > 0,
              gpFlatProfitPct > 0,
              gpInvestorCarvePct > 0,
            ].filter(Boolean).length;
            const hasMultiple = activeChannels > 1;
            const hasAny      = activeChannels > 0;
            if (!hasAny) return null;
            return (
              <div
                className={`rounded-lg border text-xs overflow-hidden ${
                  hasMultiple ? "border-amber-200" : "border-border"
                }`}
              >
                <div
                  className={`px-3 pt-2.5 pb-2 border-b flex items-center gap-1.5 ${
                    hasMultiple ? "bg-amber-50" : "bg-muted/30"
                  }`}
                >
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Effective GP Economics — all channels
                  </p>
                  {hasMultiple && (
                    <InfoTip>
                      Multiple GP compensation channels are active simultaneously. Ensure this is
                      intentional — the aggregate take will be higher than any single rate suggests.
                    </InfoTip>
                  )}
                </div>
                <div className="px-3 py-2.5 space-y-1.5 bg-background">
                  {gpFeeRatePct > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Management fee</span>
                      <span className="font-mono text-violet-700">
                        {gpFeeRatePct.toFixed(2)}% of operating profit (pre-waterfall)
                      </span>
                    </div>
                  )}
                  {gpFlatW > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Fixed weekly</span>
                      <span className="font-mono text-violet-700">
                        {formatCurrency(gpFlatW)}/week (pre-waterfall)
                      </span>
                    </div>
                  )}
                  {gpFlatProfitPct > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Flat % of profit</span>
                      <span className="font-mono text-violet-700">
                        {gpFlatProfitPct.toFixed(2)}% of remaining profit (pre-waterfall)
                      </span>
                    </div>
                  )}
                  {gpInvestorCarvePct > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Post-recoup carve</span>
                      <span className="font-mono text-violet-700">
                        {gpInvestorCarvePct.toFixed(2)}% of distributable profit (post-recoup)
                      </span>
                    </div>
                  )}
                  {hasMultiple && (
                    <div className="pt-1.5 border-t border-amber-200 text-amber-700">
                      ⚠ {activeChannels} GP channels active — verify the aggregate is intentional
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        <Separator />

        {/* ── 4. Running Royalty Offset ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>
                Running Royalty Offset
                <InfoTip>
                  A negotiated reduction to the total weekly royalty obligation, active during
                  recoupment only. Reduces the aggregate royalty bill by a fixed dollar amount each
                  week, increasing operating profit available for investor recoupment. Has no effect
                  after recoupment — it does not change post-recoup creative participation
                  percentages.
                </InfoTip>
              </Label>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>
                  Applies to: <strong>total royalties</strong>
                </span>
                <span>·</span>
                <span>
                  Active: <strong>during recoupment only</strong>
                </span>
                <span>·</span>
                <span>
                  Post-recoupment: <strong>no effect</strong>
                </span>
              </div>
            </div>
            <Controller
              name="runningRoyaltyOffset"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
          {watchedRoyaltyOffset && (
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              <Label className="text-sm">
                Weekly Offset Amount
                <InfoTip>
                  The fixed dollar amount subtracted from total royalties each week during
                  recoupment. The royalty bill is floored at $0 — if royalties are below the
                  offset, the excess does not carry forward to subsequent weeks.
                </InfoTip>
              </Label>
              <div className="max-w-48">
                <Controller
                  name="royaltyOffsetAmount"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value ?? 3500}
                      onChange={field.onChange}
                      placeholder="3,500"
                    />
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Industry range: $15,000–$50,000/week · Floor: $0 (no negative royalties · no
                carryforward)
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
