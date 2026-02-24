"use client";

/**
 * DealRoomView — investor-facing display of a shared deal room.
 *
 * Receives the fully hydrated DealRoom document and renders it based on
 * the producer's DealRoomConfig. No editing, no auth required.
 *
 * Financial model is computed client-side by running runScenario() against
 * the snapshotted DealInputs — identical to the producer's own view.
 */

import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  ExternalLink,
  Building2,
  Calendar,
  Users,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { runScenario } from "@/lib/model/scenarios";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/model/formatters";
import { WaterfallFlow } from "@/app/(app)/productions/view/WaterfallFlow";
import type { DealRoom } from "@/types/dealRoom";
import type { ModelOutput } from "@/types/model";
import type { Scenario } from "@/types/model";

// ─── Scenario definitions for investor view ───────────────────────────────────

const INVESTOR_SCENARIOS: Scenario[] = [
  { name: "Bear", occupancyRate: 0.60, avgTicketPrice: 100, estimatedWeeks: 20 },
  { name: "Base", occupancyRate: 0.75, avgTicketPrice: 115, estimatedWeeks: 36 },
  { name: "Bull", occupancyRate: 0.90, avgTicketPrice: 135, estimatedWeeks: 52 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    development: "bg-purple-100 text-purple-800 border-purple-200",
    preview:     "bg-blue-100   text-blue-800   border-blue-200",
    open:        "bg-green-100  text-green-800  border-green-200",
    closed:      "bg-gray-100   text-gray-700   border-gray-200",
  };
  const labels: Record<string, string> = {
    development: "In Development",
    preview:     "In Preview",
    open:        "Open",
    closed:      "Closed",
  };
  return (
    <Badge className={`border font-medium text-xs ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {labels[status] ?? status}
    </Badge>
  );
}

// ─── Scenario Card ────────────────────────────────────────────────────────────

function ScenarioCard({
  scenario,
  output,
  totalCap,
}: {
  scenario: Scenario;
  output: ModelOutput;
  totalCap: number;
}) {
  const multiple = totalCap > 0 ? output.totalInvestorDistributions / totalCap : null;
  const recouped = output.recoupWeek !== null;
  const isBull = scenario.name === "Bull";
  const isBear = scenario.name === "Bear";

  const accent = isBull
    ? "border-t-green-500"
    : isBear
    ? "border-t-red-400"
    : "border-t-primary";
  const multipleBadge = multiple !== null && multiple >= 1
    ? "text-green-700"
    : "text-red-700";

  return (
    <Card className={`border-t-4 ${accent}`}>
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{scenario.name} Case</CardTitle>
          {isBull ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : isBear ? (
            <TrendingDown className="h-4 w-4 text-red-500" />
          ) : (
            <BarChart3 className="h-4 w-4 text-primary/70" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatPercent(scenario.occupancyRate)} occ · {scenario.estimatedWeeks} weeks · ${scenario.avgTicketPrice} ATP
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Total Gross"
            value={formatCurrency(output.totalGrossBoxOffice, true)}
          />
          <Stat
            label="Investor Multiple"
            value={multiple !== null ? `${multiple.toFixed(2)}×` : "—"}
            valueClass={multipleBadge}
          />
          <Stat
            label="Recoup Week"
            value={output.recoupWeek ? `Week ${output.recoupWeek}` : "No Recoup"}
            valueClass={recouped ? "text-green-700" : "text-amber-700"}
          />
          <Stat
            label="Breakeven Occ."
            value={
              output.weeklyBreakeven !== null
                ? formatPercent(output.weeklyBreakeven)
                : "Never"
            }
            valueClass={
              output.weeklyBreakeven === null || output.weeklyBreakeven > 0.9
                ? "text-red-700"
                : output.weeklyBreakeven > 0.7
                ? "text-amber-700"
                : "text-green-700"
            }
          />
        </div>

        {/* Investor distribution */}
        <div className="rounded-md bg-muted/40 border px-3 py-2 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
            Total Investor Distributions
          </p>
          <p className={`text-lg font-bold font-mono tabular-nums ${multipleBadge}`}>
            {formatCurrency(output.totalInvestorDistributions)}
          </p>
          {output.approximateIRR !== null && (
            <p className="text-xs text-muted-foreground">
              ≈ {formatPercent(output.approximateIRR)} annualized IRR
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold font-mono tabular-nums mt-0.5 ${valueClass ?? ""}`}>
        {value}
      </p>
    </div>
  );
}

// ─── Weekly breakdown table ───────────────────────────────────────────────────

function WeeklyBreakdownTable({ output }: { output: ModelOutput }) {
  const openWeeks = output.weeks.filter((w) => !w.isPreview).slice(0, 20);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Week</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Occ.</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Gross</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Op. Profit</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Investor</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Recoup %</th>
          </tr>
        </thead>
        <tbody>
          {openWeeks.map((w) => (
            <tr
              key={w.week}
              className={`border-b last:border-0 ${
                w.isRecouped ? "bg-green-50/50" : ""
              }`}
            >
              <td className="px-3 py-2 font-medium">{w.week}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                {formatPercent(w.occupancyRate)}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatCurrency(w.grossBoxOffice, true)}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono ${
                  w.operatingProfit >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {formatCurrency(w.operatingProfit, true)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-blue-700">
                {formatCurrency(w.investorDistribution + w.toRecoupmentPool, true)}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                {formatPercent(Math.min(1, w.recoupPercent))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {output.weeks.filter((w) => !w.isPreview).length > 20 && (
        <p className="text-xs text-muted-foreground text-center py-2 border-t">
          Showing first 20 open weeks of {output.weeks.filter((w) => !w.isPreview).length}
        </p>
      )}
    </div>
  );
}

// ─── Document link ────────────────────────────────────────────────────────────

function DocLink({ url, name }: { url: string; name: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-lg border bg-card px-4 py-3 hover:bg-muted/50 transition-colors group"
    >
      <FileText className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
      <span className="flex-1 text-sm font-medium truncate">{name}</span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

// ─── Main DealRoomView ────────────────────────────────────────────────────────

interface DealRoomViewProps {
  dealRoom: DealRoom;
}

export default function DealRoomView({ dealRoom }: DealRoomViewProps) {
  const { production, dealInputs, config } = dealRoom;

  // Run all three scenarios client-side against the snapshotted deal inputs.
  // runScenario() is pure — identical to the producer's own Financial Model tab.
  const scenarioOutputs = useMemo(() => {
    // Use deal inputs' own ATP and week values as override for Base;
    // Bear and Bull use their own parameters.
    return INVESTOR_SCENARIOS.map((s) => ({
      scenario: s,
      output: runScenario(dealInputs, s),
    }));
  }, [dealInputs]);

  const baseOutput = scenarioOutputs.find((s) => s.scenario.name === "Base")!.output;

  // Documents to show (only if config.showDocuments = true)
  const docs: { url: string; name: string }[] = [];
  if (production.investorInstructionLetterUrl) {
    docs.push({
      url: production.investorInstructionLetterUrl,
      name: production.investorInstructionLetterName ?? "Investor Instruction Letter",
    });
  }
  if (production.memberSignaturePageUrl) {
    docs.push({
      url: production.memberSignaturePageUrl,
      name: production.memberSignaturePageName ?? "Member Signature Page",
    });
  }
  if (production.subscriptionAgreementUrl) {
    docs.push({
      url: production.subscriptionAgreementUrl,
      name: production.subscriptionAgreementName ?? "Subscription Agreement",
    });
  }
  if (production.operatingAgreementUrl) {
    docs.push({
      url: production.operatingAgreementUrl,
      name: production.operatingAgreementName ?? "Operating Agreement",
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <span className="text-sm font-bold tracking-tight text-foreground">Override</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
            <span>Secure investor view · Read-only</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* ── Production header ────────────────────────────────────────── */}
        <section className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Artwork */}
          {production.artworkUrl && (
            <img
              src={production.artworkUrl}
              alt={production.name}
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-xl object-cover border shadow-sm shrink-0"
            />
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                {production.name}
              </h1>
              <StatusBadge status={production.status} />
            </div>
            {production.subtitle && (
              <p className="text-base text-muted-foreground">{production.subtitle}</p>
            )}
            <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
              {production.venue && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {production.venue}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Shared {new Date(dealRoom.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              {production.showUrl && (
                <a
                  href={production.showUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  Production website
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ── Producer note ────────────────────────────────────────────── */}
        {config.producerNote && (
          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-medium text-primary mb-1 uppercase tracking-wide">
                Note from the Producer
              </p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {config.producerNote}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Key deal terms ───────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Deal Structure</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DealTermCard
              label="Total Capitalization"
              value={formatCurrency(dealInputs.totalCapitalization)}
              icon={<Users className="h-4 w-4" />}
            />
            <DealTermCard
              label="Unit Price"
              value={formatCurrency(dealInputs.unitPrice)}
              sub={`${dealInputs.units.toLocaleString()} units total`}
            />
            <DealTermCard
              label="Weekly Nut"
              value={formatCurrency(dealInputs.weeklyNut)}
              sub="Operating costs/week"
            />
            <DealTermCard
              label="House Capacity"
              value={`${dealInputs.capacity.toLocaleString()} seats`}
              sub={`${dealInputs.performances} perfs/week`}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DealTermCard
              label="Avg Ticket Price"
              value={`$${dealInputs.avgTicketPrice.toFixed(0)}`}
              sub={`${formatPercent(dealInputs.discountRate)} discounted`}
            />
            <DealTermCard
              label="Waterfall Type"
              value={
                dealInputs.waterfallType === "recoup_first"
                  ? "Recoup First"
                  : "Share from $1"
              }
            />
            <DealTermCard
              label="Investor Pool (post-recoup)"
              value={formatPercent(dealInputs.postRecoupInvestorSplit)}
              sub="of distributable profit"
            />
            <DealTermCard
              label="Breakeven Occupancy"
              value={
                baseOutput.weeklyBreakeven !== null
                  ? formatPercent(baseOutput.weeklyBreakeven)
                  : "Never"
              }
              sub="Base scenario"
              valueClass={
                baseOutput.weeklyBreakeven === null
                  ? "text-red-700"
                  : baseOutput.weeklyBreakeven > 0.9
                  ? "text-red-700"
                  : baseOutput.weeklyBreakeven > 0.7
                  ? "text-amber-700"
                  : "text-green-700"
              }
            />
          </div>
        </section>

        {/* ── Scenario cards ───────────────────────────────────────────── */}
        {config.showFinancialModel && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">Financial Scenarios</h2>
              <p className="text-xs text-muted-foreground">
                Modeled against the snapshotted deal structure · {new Date(dealRoom.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {scenarioOutputs.map(({ scenario, output }) => (
                <ScenarioCard
                  key={scenario.name}
                  scenario={scenario}
                  output={output}
                  totalCap={dealInputs.totalCapitalization}
                />
              ))}
            </div>

            {/* Scenario assumption note */}
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Scenario Assumptions</p>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {INVESTOR_SCENARIOS.map((s) => (
                  <p key={s.name}>
                    <strong>{s.name}:</strong> {formatPercent(s.occupancyRate)} occ ·{" "}
                    {s.estimatedWeeks}wks · ${s.avgTicketPrice} ATP
                  </p>
                ))}
              </div>
              <p className="pt-1">
                All projections use the deal structure above. Actual results will vary.
                These scenarios are illustrative, not a guarantee of performance.
              </p>
            </div>
          </section>
        )}

        {/* ── Waterfall ────────────────────────────────────────────────── */}
        {config.showWaterfall && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Revenue Waterfall (Base Case)</h2>
            <WaterfallFlow modelOutput={baseOutput} dealInputs={dealInputs} />
          </section>
        )}

        {/* ── Weekly breakdown ─────────────────────────────────────────── */}
        {config.showWeeklyBreakdown && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Week-by-Week Breakdown (Base Case)</h2>
            <WeeklyBreakdownTable output={baseOutput} />
          </section>
        )}

        {/* ── Capitalization progress ──────────────────────────────────── */}
        {config.showCapitalizationProgress && (
          <CapitalizationProgressSection
            totalCapitalization={dealInputs.totalCapitalization}
            unitPrice={dealInputs.unitPrice}
            units={dealInputs.units}
          />
        )}

        {/* ── Documents ────────────────────────────────────────────────── */}
        {config.showDocuments && docs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Documents</h2>
            <p className="text-sm text-muted-foreground">
              Review these documents carefully before making any investment decision.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {docs.map((d) => (
                <DocLink key={d.url} url={d.url} name={d.name} />
              ))}
            </div>
          </section>
        )}

        {/* ── Disclaimer ───────────────────────────────────────────────── */}
        <Separator />
        <footer className="space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Important Disclosures</p>
          <p>
            This deal room is provided for informational purposes only and does not constitute
            an offer to sell or a solicitation of an offer to buy any securities. All financial
            projections are forward-looking statements based on the deal structure above and are
            not guarantees of future performance. Investing in theatrical productions involves
            significant risk, including the possible loss of the entire investment.
          </p>
          <p>
            Only {formatPercent(0.20, 0)}–{formatPercent(0.25, 0)} of Broadway musicals fully
            recoup their capitalization. Past performance of other productions is not indicative
            of future results. Consult your financial and legal advisors before investing.
          </p>
          <p className="pt-1">
            Powered by{" "}
            <span className="font-medium text-foreground">Override</span>
            {" — "}the financial operating platform for Broadway producers.
          </p>
        </footer>
      </main>
    </div>
  );
}

// ─── DealTermCard ─────────────────────────────────────────────────────────────

function DealTermCard({
  label,
  value,
  sub,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <p className="text-[10px] uppercase tracking-wide font-medium">{label}</p>
      </div>
      <p className={`text-base font-bold font-mono tabular-nums leading-tight ${valueClass ?? ""}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Capitalization progress ──────────────────────────────────────────────────

function CapitalizationProgressSection({
  totalCapitalization,
  unitPrice,
  units,
}: {
  totalCapitalization: number;
  unitPrice: number;
  units: number;
}) {
  // We show the deal structure only — no individual investor data is ever exposed
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Capitalization Structure</h2>
      <Card>
        <CardContent className="pt-5 pb-5 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Cap</p>
              <p className="text-xl font-bold font-mono">{formatCurrency(totalCapitalization)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Unit Price</p>
              <p className="text-xl font-bold font-mono">{formatCurrency(unitPrice)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Units</p>
              <p className="text-xl font-bold font-mono">{units.toLocaleString()}</p>
            </div>
          </div>
          <div className="rounded-md bg-muted/40 border px-3 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            Individual investor details are kept confidential and are not displayed here.
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
