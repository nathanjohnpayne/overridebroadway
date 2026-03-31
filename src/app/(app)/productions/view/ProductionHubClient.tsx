"use client";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm, Controller } from "react-hook-form";
import { useAuth } from "@/contexts/AuthContext";
import { useDealInputs } from "@/hooks/useDealInputs";
import { useInvestors } from "@/hooks/useInvestors";
import { useProducerPools } from "@/hooks/useProducerPools";
import { getProduction, updateProduction } from "@/lib/firestore";
import { computeOwnershipRollup } from "@/lib/model/ownershipRollup";
import { uploadProductionArtwork, uploadOperatingAgreement, uploadProductionDocument } from "@/lib/storage";
import type { ProductionDocType } from "@/lib/storage";
import { runScenario, generateSensitivityGrid, DEFAULT_SCENARIOS } from "@/lib/model/scenarios";
import { formatCurrency, formatPercent, formatMultiple, formatWeek } from "@/lib/model/formatters";
import { Analytics } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, ImageIcon, FileText, ExternalLink, Info,
  Plus, Trash2, BarChart3, RefreshCw, TrendingUp, DollarSign, Clock, Users, Wand2, Pencil, Sparkles
} from "lucide-react";
import { DealBuilder } from "./DealBuilder";
import { WaterfallFlow } from "./WaterfallFlow";
import { DealRoomSetup } from "./DealRoomSetup";
import { useDealStore } from "@/stores/dealStore";
import { InvestorSheet } from "./InvestorSheet";
import { InvestorStatusBadge } from "./InvestorStatusBadge";
import { ProducerLedger } from "./ProducerLedger";
import { PoolDialog } from "./PoolDialog";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, Legend
} from "recharts";
import type { Production, ProductionStatus } from "@/types/production";
import type { DealInputs } from "@/types/deal";
import { DEFAULT_DEAL_INPUTS } from "@/types/deal";
import type { Scenario, ModelOutput, SensitivityCell } from "@/types/model";
import type { CapitalizationInvestor, ProducerPool } from "@/types/capitalization";

// \u2500\u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline ml-1" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs">{children}</TooltipContent>
    </Tooltip>
  );
}

function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState(() => (value * 100).toFixed(2));

  // Sync display when parent value changes (e.g. form reset or wizard apply)
  useEffect(() => {
    setRaw((value * 100).toFixed(2));
  }, [value]);

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={e => {
          setRaw(e.target.value);
          const parsed = parseFloat(e.target.value);
          if (!isNaN(parsed)) onChange(parsed / 100);
        }}
        onBlur={() => {
          const parsed = parseFloat(raw);
          if (!isNaN(parsed)) {
            setRaw(parsed.toFixed(2));
            onChange(parsed / 100);
          }
        }}
        className="pr-8"
        placeholder="0.00"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
    </div>
  );
}

function formatWithCommas(n: number): string {
  return n.toLocaleString("en-US");
}

function CurrencyInput({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  const [raw, setRaw] = useState(() => value ? formatWithCommas(value) : "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setRaw(value ? formatWithCommas(value) : "");
    }
  }, [value, focused]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
      <Input
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={e => {
          // Allow digits, commas, dots only
          const v = e.target.value.replace(/[^\d,]/g, "");
          setRaw(v);
          const parsed = parseFloat(v.replace(/,/g, ""));
          if (!isNaN(parsed)) onChange(parsed);
        }}
        onFocus={() => {
          setFocused(true);
          // Show plain number while editing
          setRaw(value ? value.toString() : "");
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parseFloat(raw.replace(/,/g, ""));
          if (!isNaN(parsed)) {
            setRaw(formatWithCommas(parsed));
            onChange(parsed);
          } else {
            setRaw(value ? formatWithCommas(value) : "");
          }
        }}
        placeholder={placeholder ?? "0"}
        className="pl-7"
      />
    </div>
  );
}

const STATUS_COLORS: Record<ProductionStatus, string> = {
  development: "bg-yellow-100 text-yellow-800",
  preview: "bg-blue-100 text-blue-800",
  open: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const SCENARIO_COLORS = ["#ef4444", "#6366f1", "#10b981"];
const OCCUPANCY_ROWS = [0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0];
const WEEK_COLS = [10, 16, 20, 26, 32, 40, 52, 65, 78];

// ── Sensitivity grid outcome resolvers ────────────────────────────────────────
// Both functions are pure — no financial math, only presentation decisions.
// All numeric inputs come from the engine via SensitivityCell.

function outcomeColor(roi: number, recoupAchieved: boolean): string {
  if (!recoupAchieved || roi < 0)  return "bg-red-100   text-red-800";
  if (roi <= 0.05)                  return "bg-yellow-100 text-yellow-800";
  const multiple = roi + 1; // multiple = 1 + ROI
  if (multiple <= 1.5)              return "bg-green-100  text-green-800";
  return                                   "bg-green-200  text-green-900";
}

function outcomeDisplay(
  recoupAchieved: boolean,
  recoupWeek: number | null,
  roi: number,
  multiple: number,
): { line1: string; line2: string } {
  if (!recoupAchieved) {
    return {
      line1: "No Recoup",
      line2: `${roi >= 0 ? "+" : ""}${(roi * 100).toFixed(0)}% ROI`,
    };
  }
  if (roi <= 0.05) {
    return {
      line1: `Wk ${recoupWeek}`,
      line2: "Break-even",
    };
  }
  return {
    line1: `Wk ${recoupWeek}`,
    line2: `${multiple.toFixed(2)}×`,
  };
}

// ── OutcomeSensitivityGrid ────────────────────────────────────────────────────
// Self-contained component so the grid tooltip hover state is isolated and
// does not cause ProductionHubClient to re-render on every mouseover.

interface OutcomeSensitivityGridProps {
  sensitivityVisible: boolean;
  onGenerate: () => void;
  sensitivityGrid: import("@/types/model").SensitivityGrid | null;
  dealInputs: DealInputs | null;
}

function OutcomeSensitivityGrid({
  sensitivityVisible,
  onGenerate,
  sensitivityGrid,
  dealInputs,
}: OutcomeSensitivityGridProps) {
  const [hoveredCell, setHoveredCell] = useState<SensitivityCell | null>(null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base">Investor Outcome Sensitivity</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Occupancy &times; Run Length &mdash; colored by investor ROI, not recoup timing
            </p>
          </div>
          {!sensitivityVisible ? (
            <Button size="sm" variant="outline" onClick={onGenerate}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Generate Grid
            </Button>
          ) : (
            /* Legend — outcome-based colors only */
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-200 inline-block border border-green-300" />
                <span>&gt;1.5&times; return</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-100 inline-block border border-green-200" />
                <span>1.0&ndash;1.5&times; return</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-yellow-100 inline-block border border-yellow-200" />
                <span>Break-even</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-100 inline-block border border-red-200" />
                <span>Loss</span>
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      {sensitivityVisible && sensitivityGrid && (
        <CardContent className="p-0">
          {/* Tooltip strip — always rendered to prevent layout reflow on hover */}
          <div className="mx-4 mb-3 h-9 flex items-center">
            {hoveredCell ? (
              <div className="w-full rounded-md border bg-muted/60 px-3 py-1.5 text-xs flex flex-wrap gap-x-5 gap-y-1">
                <span><strong>Occ:</strong> {formatPercent(hoveredCell.occupancyRate)}</span>
                <span><strong>Run:</strong> {hoveredCell.weeks}w</span>
                <span><strong>Recoup:</strong> {hoveredCell.recoupAchieved ? `Wk ${hoveredCell.recoupWeek}` : "No recoup"}</span>
                <span><strong>Gross BO:</strong> {formatCurrency(hoveredCell.totalGrossBoxOffice, true)}</span>
                <span><strong>Op. Profit:</strong> {formatCurrency(hoveredCell.totalOperatingProfit, true)}</span>
                <span><strong>Investor Dist.:</strong> {formatCurrency(hoveredCell.investorDistributions, true)}</span>
                <span><strong>ROI:</strong> {hoveredCell.investorROI >= 0 ? "+" : ""}{formatPercent(hoveredCell.investorROI)}</span>
                <span>
                  <strong>Multiple:</strong>{" "}
                  {dealInputs && dealInputs.totalCapitalization > 0
                    ? `${hoveredCell.investorMultiple.toFixed(2)}×`
                    : "—"}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Hover a cell to see scenario detail</p>
            )}
          </div>

          <div className="overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="p-2 border text-left bg-muted font-medium whitespace-nowrap">
                    Occ. ╲ Weeks
                  </th>
                  {WEEK_COLS.map(w => (
                    <th key={w} className="p-2 border text-center bg-muted font-medium w-[72px]">
                      {w}w
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {OCCUPANCY_ROWS.map((occ, ri) => (
                  <tr key={occ}>
                    <td className="p-2 border font-medium bg-muted/50 whitespace-nowrap">
                      {formatPercent(occ)}
                    </td>
                    {sensitivityGrid[ri].map((cell, ci) => {
                      const display = outcomeDisplay(
                        cell.recoupAchieved,
                        cell.recoupWeek,
                        cell.investorROI,
                        cell.investorMultiple,
                      );
                      const color = outcomeColor(cell.investorROI, cell.recoupAchieved);
                      return (
                        <td
                          key={ci}
                          className={`p-1.5 border text-center leading-tight cursor-default select-none transition-opacity ${color}`}
                          onMouseEnter={() => setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div className="font-semibold">{display.line1}</div>
                          <div className="text-[10px] font-normal opacity-80">{display.line2}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <p className="text-[10px] text-muted-foreground px-4 py-2 border-t">
            Color reflects investor outcome only—recoup timing does not determine color.
            Hover any cell for full scenario detail.
            {dealInputs && dealInputs.totalCapitalization > 0
              ? ` Cap: ${formatCurrency(dealInputs.totalCapitalization, true)}.`
              : ""}
          </p>
        </CardContent>
      )}
    </Card>
  );
}


// \u2500\u2500\u2500 Main Component \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export default function ProductionHubClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  // Stable ref so async handlers (wizard apply, saves) always have the real
  // production ID even if searchParams re-evaluates after router.replace.
  const idRef = useRef(id);
  useEffect(() => { idRef.current = id; }, [id]);
  const { user } = useAuth();
  const router = useRouter();
  const { dealInputs, loading: dealLoading, saving, save } = useDealInputs(id);
  const { investors, loading: investorsLoading, add: addInvestor, update: updateInvestorData, remove: removeInvestorFn } = useInvestors(id || null);
  const { pools, loading: poolsLoading, defaultPoolId, add: addPool, update: updatePool, remove: removePool } = useProducerPools(id || null, user?.uid ?? null);
  const [production, setProduction] = useState<Production | null>(null);
  const [prodLoading, setProdLoading] = useState(true);
  const [investorSheetOpen, setInvestorSheetOpen] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<CapitalizationInvestor | null>(null);
  // Capitalization view state
  const [capView, setCapView] = useState<"all" | "byProducer" | "mine">("all");
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<ProducerPool | null>(null);
  const [defaultPoolIdOverride, setDefaultPoolIdOverride] = useState<string | null>(null);
  const [artworkProgress, setArtworkProgress] = useState<number | null>(null);
  const [letterProgress, setLetterProgress] = useState<number | null>(null);
  const [signatureProgress, setSignatureProgress] = useState<number | null>(null);
  const [subscriptionProgress, setSubscriptionProgress] = useState<number | null>(null);
  const [agreementProgress, setAgreementProgress] = useState<number | null>(null);
  const artworkRef = useRef<HTMLInputElement>(null);
  const letterRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<HTMLInputElement>(null);
  const subscriptionRef = useRef<HTMLInputElement>(null);
  const agreementRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showUrlEdit, setShowUrlEdit] = useState("");
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [subtitleEdit, setSubtitleEdit] = useState<string | null>(null);
  const [venueEdit, setVenueEdit] = useState<string | null>(null);

  // Model scenario state
  const [modelScenario, setModelScenario] = useState<Scenario>({
    name: "Base", occupancyRate: 0.75, avgTicketPrice: 115, estimatedWeeks: 36,
  });

  // Scenarios state
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);
  const [sensitivityVisible, setSensitivityVisible] = useState(false);

  // Deal form
  const { control, handleSubmit, watch, setValue, reset, getValues, formState: { isDirty } } = useForm<DealInputs>({
    defaultValues: DEFAULT_DEAL_INPUTS,
  });

  // Load production with timeout and error handling.
  // Firestore can stall for 30-60s when the WebSocket channel drops (Safari 503s).
  // A 15s timeout surfaces the problem to the user instead of showing skeletons forever.
  useEffect(() => {
    if (!user) return;
    const TIMEOUT_MS = 15_000;
    let cancelled = false;
    const timeout = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
    );
    Promise.race([getProduction(id), timeout])
      .then((prod) => {
        if (cancelled) return;
        if (!prod || prod.userId !== user.uid) { router.push("/dashboard"); return; }
        setProduction(prod);
        setProdLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.message === "timeout"
          ? "Loading timed out — please try again"
          : "Failed to load production";
        toast.error(msg);
        router.push("/dashboard");
      });
    return () => { cancelled = true; };
  }, [id, user, router]);

  // Load deal inputs into form
  useEffect(() => {
    if (dealInputs) {
      reset(dealInputs);
      // Seed scenario ATP from deal; keep occupancy/weeks as user-adjustable what-if controls
      setScenarios(DEFAULT_SCENARIOS.map(s => ({ ...s, avgTicketPrice: dealInputs.avgTicketPrice })));
      // Seed the financial model scenario fully from deal values so it starts in sync
      setModelScenario({
        name: "Base",
        avgTicketPrice: dealInputs.avgTicketPrice,
        occupancyRate: 0.85,
        estimatedWeeks: dealInputs.estimatedWeeks,
      });
    }
  }, [dealInputs, reset]);

  // isNew flag — used to show the empty-state banner on first visit
  const isNew = searchParams.get("new") === "1";

  // Auto-compute Total Units from Capitalization ÷ Unit Price
  const watchedCap = watch("totalCapitalization");
  const watchedUnitPrice = watch("unitPrice");
  const watchedUnits = watch("units");
  useEffect(() => {
    if (watchedCap > 0 && watchedUnitPrice > 0) {
      const computed = Math.round(watchedCap / watchedUnitPrice);
      if (computed !== watchedUnits) {
        setValue("units", computed, { shouldDirty: false });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedCap, watchedUnitPrice, setValue]);

  // Deal Builder guided mode state (from Zustand)
  const { guidedModeActive, setGuidedMode } = useDealStore();

  // Watch all form values so the financial model reflects live edits, not just saved state
  const liveFormValues = watch();

  // Model output — uses live form values so the model stays in sync with deal input edits.
  // ATP is always driven from the deal inputs (live form), not from modelScenario.
  // CapitalizationInvestor records (from Firestore) are bridged into the simplified Investor[]
  // type so the financial engine can compute per-investor returns. DealInputs.investors is not
  // used for this — it's a legacy field that is always empty.
  const modelOutput = useMemo(() => {
    if (!dealInputs) return null;
    const bridgedInvestors = investors
      .filter((inv) => inv.amountCommitted > 0)
      .map((inv) => ({
        id: inv.id,
        name: inv.name,
        amount: inv.amountCommitted,
        units: inv.shares,
      }));
    const liveDeal = { ...dealInputs, ...liveFormValues, investors: bridgedInvestors };
    return runScenario(liveDeal, {
      ...modelScenario,
      avgTicketPrice: liveDeal.avgTicketPrice,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealInputs, liveFormValues, modelScenario, investors]);

  // Scenario outputs
  const scenarioOutputs: { scenario: Scenario; output: ModelOutput }[] = useMemo(() => {
    if (!dealInputs) return [];
    return scenarios.map(s => ({ scenario: s, output: runScenario(dealInputs, s) }));
  }, [dealInputs, scenarios]);

  const sensitivityGrid = useMemo(() => {
    if (!dealInputs || !sensitivityVisible) return null;
    return generateSensitivityGrid(dealInputs, OCCUPANCY_ROWS, WEEK_COLS);
  }, [dealInputs, sensitivityVisible]);

  const scenarioChartData = useMemo(() => {
    if (scenarioOutputs.length === 0) return [];
    const maxWeeks = Math.max(...scenarioOutputs.map(s => s.output.weeks.length));
    return Array.from({ length: maxWeeks }, (_, i) => {
      const row: Record<string, number | null> = { week: i + 1 };
      scenarioOutputs.forEach(({ scenario, output }) => {
        row[scenario.name] = output.weeks[i]?.cumulativeProfit ?? null;
      });
      return row;
    });
  }, [scenarioOutputs]);

  // Ownership rollup engine — single source of truth for all cap table math
  const ownershipRollup = useMemo(() => {
    if (!dealInputs) return null;
    return computeOwnershipRollup(investors, pools, dealInputs.totalCapitalization);
  }, [investors, pools, dealInputs]);

  // Capitalization summary (derived from rollup)
  const capitalizationSummary = useMemo(() => ({
    totalTarget: dealInputs?.totalCapitalization ?? 0,
    totalCommitted: ownershipRollup?.totalCommitted ?? 0,
    totalFunded: ownershipRollup?.totalFunded ?? 0,
    remainingRaise: ownershipRollup?.remainingRaise ?? 0,
    investorCount: ownershipRollup?.investorCount ?? 0,
  }), [ownershipRollup, dealInputs]);

  // Analytics: track capitalization tab views
  useEffect(() => {
    if (activeTab === "capitalization") Analytics.capitalizationViewed(id);
  }, [activeTab, id]);

  // Handlers
  async function handleStatusChange(status: ProductionStatus) {
    if (!production) return;
    await updateProduction(id, { status });
    setProduction(prev => prev ? { ...prev, status } : prev);
    toast.success("Status updated.");
  }

  async function handleArtworkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setArtworkProgress(0);
    try {
      const url = await uploadProductionArtwork(user.uid, id, file, setArtworkProgress);
      await updateProduction(id, { artworkUrl: url });
      setProduction(prev => prev ? { ...prev, artworkUrl: url } : prev);
      Analytics.artworkUploaded();
      toast.success("Artwork uploaded!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setArtworkProgress(null);
      if (artworkRef.current) artworkRef.current.value = "";
    }
  }

  async function handleAgreementUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAgreementProgress(0);
    try {
      const url = await uploadOperatingAgreement(user.uid, id, file, setAgreementProgress);
      await updateProduction(id, { operatingAgreementUrl: url, operatingAgreementName: file.name });
      setProduction(prev => prev ? { ...prev, operatingAgreementUrl: url, operatingAgreementName: file.name } : prev);
      Analytics.agreementUploaded();
      toast.success("Operating agreement uploaded!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAgreementProgress(null);
      if (agreementRef.current) agreementRef.current.value = "";
    }
  }

  async function handleDocumentUpload(
    docType: ProductionDocType,
    urlField: keyof Production,
    nameField: keyof Production,
    setProgress: (n: number | null) => void,
    fileInputRef: React.RefObject<HTMLInputElement | null>,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setProgress(0);
    try {
      const url = await uploadProductionDocument(user.uid, id, docType, file, setProgress);
      await updateProduction(id, { [urlField]: url, [nameField]: file.name } as Partial<Production>);
      setProduction(prev => prev ? { ...prev, [urlField]: url, [nameField]: file.name } : prev);
      toast.success("Document uploaded!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onDealSubmit(data: DealInputs) {
    try {
      await save(data);
      Analytics.dealInputsSaved(id);
      toast.success("Deal inputs saved!");
    } catch {
      toast.error("Failed to save deal inputs.");
    }
  }

  function updateScenario(index: number, field: keyof Scenario, value: string | number) {
    setScenarios(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  if (prodLoading || dealLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!production) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back + Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" />Dashboard</Link>
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {nameEdit !== null ? (
            <form className="flex items-center gap-2" onSubmit={async (e) => {
              e.preventDefault();
              const name = nameEdit.trim();
              if (!name) return;
              await updateProduction(id, { name });
              setProduction(prev => prev ? { ...prev, name } : prev);
              setNameEdit(null);
              toast.success("Name saved.");
            }}>
              <Input
                value={nameEdit}
                onChange={e => setNameEdit(e.target.value)}
                className="h-8 text-lg font-bold w-56"
                autoFocus
                onBlur={() => setNameEdit(null)}
                onKeyDown={e => e.key === "Escape" && setNameEdit(null)}
              />
              {/* onMouseDown preventDefault prevents the input from losing focus (which
                  would trigger onBlur and cancel the form) before onSubmit fires */}
              <Button
                type="submit"
                size="sm"
                className="h-7 text-xs px-2"
                onMouseDown={e => e.preventDefault()}
              >Save</Button>
            </form>
          ) : (
            <h1
              className="text-xl font-bold truncate cursor-pointer hover:text-primary transition-colors"
              title="Click to edit name"
              onClick={() => setNameEdit(production.name)}
            >{production.name}</h1>
          )}
          <Select value={production.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-32 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["development", "preview", "open", "closed"] as ProductionStatus[]).map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 grid grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="capitalization">Capitalization</TabsTrigger>
          <TabsTrigger value="deal">Deal Inputs</TabsTrigger>
          <TabsTrigger value="model">Financial Model</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="dealroom" className="flex items-center gap-1.5">
            Deal Room
            {production?.dealRoomEnabled && (
              <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 OVERVIEW \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        <TabsContent value="overview">
          <div className="flex gap-6 mb-6">
            {/* Artwork */}
            <div className="relative shrink-0">
              <div className="w-48 rounded-xl overflow-hidden border bg-muted flex items-center justify-center min-h-16">
                {production.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={production.artworkUrl} alt={production.name} className="w-full h-auto max-h-48 object-contain block" />
                ) : (
                  <span className="text-4xl py-6">🎭</span>
                )}
              </div>
              <button
                onClick={() => artworkRef.current?.click()}
                className="absolute bottom-1 right-1 bg-background border rounded-md p-1 shadow-sm hover:bg-muted"
                title="Upload artwork"
              >
                <ImageIcon className="h-3 w-3" />
              </button>
              <input ref={artworkRef} type="file" accept="image/*" className="hidden" onChange={handleArtworkUpload} />
              {artworkProgress !== null && <Progress value={artworkProgress} className="h-1 mt-1" />}
            </div>

            {/* Info */}
            <div className="flex-1">
              {/* Subtitle / tagline */}
              {subtitleEdit !== null ? (
                <form className="flex items-center gap-2 mb-1" onSubmit={async (e) => {
                  e.preventDefault();
                  const subtitle = subtitleEdit.trim() || undefined;
                  await updateProduction(id, { subtitle });
                  setProduction(prev => prev ? { ...prev, subtitle } : prev);
                  setSubtitleEdit(null);
                  toast.success("Tagline saved.");
                }}>
                  <Input value={subtitleEdit} onChange={e => setSubtitleEdit(e.target.value)} className="h-7 text-xs w-72" autoFocus placeholder="Tagline or subtitle" onKeyDown={e => e.key === "Escape" && setSubtitleEdit(null)} />
                  <Button type="submit" size="sm" className="h-7 text-xs px-2">Save</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setSubtitleEdit(null)}>✕</Button>
                </form>
              ) : production.subtitle ? (
                <p className="text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors" title="Click to edit tagline" onClick={() => setSubtitleEdit(production.subtitle ?? "")}>{production.subtitle}</p>
              ) : (
                <button className="text-xs text-muted-foreground hover:text-primary mb-1" onClick={() => setSubtitleEdit("")}>+ Add tagline</button>
              )}
              {/* Venue / theater */}
              {venueEdit !== null ? (
                <form className="flex items-center gap-2 mb-1" onSubmit={async (e) => {
                  e.preventDefault();
                  const venue = venueEdit.trim() || undefined;
                  await updateProduction(id, { venue });
                  setProduction(prev => prev ? { ...prev, venue } : prev);
                  setVenueEdit(null);
                  toast.success("Venue saved.");
                }}>
                  <Input value={venueEdit} onChange={e => setVenueEdit(e.target.value)} className="h-7 text-xs w-72" autoFocus placeholder="Theatre name" onKeyDown={e => e.key === "Escape" && setVenueEdit(null)} />
                  <Button type="submit" size="sm" className="h-7 text-xs px-2">Save</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setVenueEdit(null)}>✕</Button>
                </form>
              ) : production.venue ? (
                <p className="text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors" title="Click to edit venue" onClick={() => setVenueEdit(production.venue ?? "")}>{production.venue}</p>
              ) : (
                <button className="text-xs text-muted-foreground hover:text-primary mb-1" onClick={() => setVenueEdit("")}>+ Add theatre</button>
              )}
              {/* Show URL display + inline edit */}
              {production.showUrl ? (
                <div className="flex items-center gap-2 mt-1">
                  <a href={production.showUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                    {production.showUrl} <ExternalLink className="h-3 w-3" />
                  </a>
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowUrlEdit(production.showUrl ?? "")}>Edit</button>
                </div>
              ) : (
                <button className="text-xs text-muted-foreground hover:text-primary mt-1 flex items-center gap-1" onClick={() => setShowUrlEdit(" ")}>
                  <ExternalLink className="h-3 w-3" />Add show website
                </button>
              )}
              {showUrlEdit !== "" && (
                <form
                  className="flex items-center gap-2 mt-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const url = showUrlEdit.trim();
                    await updateProduction(id, { showUrl: url || undefined });
                    setProduction(prev => prev ? { ...prev, showUrl: url || undefined } : prev);
                    setShowUrlEdit("");
                    toast.success("Website saved.");
                  }}
                >
                  <Input
                    type="url"
                    value={showUrlEdit.trim()}
                    onChange={e => setShowUrlEdit(e.target.value)}
                    placeholder="https://hamiltonmusical.com"
                    className="h-7 text-xs"
                    autoFocus
                  />
                  <Button type="submit" size="sm" className="h-7 text-xs px-2">Save</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setShowUrlEdit("")}>✕</Button>
                </form>
              )}
              {dealInputs && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Capitalization: </span>
                    <span className="font-medium">{formatCurrency(dealInputs.totalCapitalization)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Weekly Nut: </span>
                    <span className="font-medium">{formatCurrency(dealInputs.weeklyNut)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Investors: </span>
                    <span className="font-medium">{investors.length}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Waterfall: </span>
                    <span className="font-medium capitalize">{dealInputs.waterfallType.replace(/_/g, " ")}</span>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">Updated {production.updatedAt.toLocaleDateString()}</p>
            </div>
          </div>

          {/* Quick nav */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { tab: "capitalization", label: "Capitalization", desc: "Investor ledger, commitments, documents" },
              { tab: "deal", label: "Deal Inputs", desc: "Capitalization, royalties, waterfall" },
              { tab: "model", label: "Financial Model", desc: "Cash flows, recoupment, returns" },
              { tab: "scenarios", label: "Scenarios", desc: "Bear/Base/Bull & sensitivity grid" },
            ].map(({ tab, label, desc }) => (
              <Card key={tab} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveTab(tab)}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{label}</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground">{desc}</CardContent>
              </Card>
            ))}
          </div>

          {/* Documents */}
          <Card>
            <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {([
                {
                  label: "Investor Instruction Letter",
                  urlKey: "investorInstructionLetterUrl" as const,
                  nameKey: "investorInstructionLetterName" as const,
                  ref: letterRef,
                  progress: letterProgress,
                  onUpload: (e: React.ChangeEvent<HTMLInputElement>) =>
                    handleDocumentUpload("instruction-letter", "investorInstructionLetterUrl", "investorInstructionLetterName", setLetterProgress, letterRef, e),
                },
                {
                  label: "Member Signature Page",
                  urlKey: "memberSignaturePageUrl" as const,
                  nameKey: "memberSignaturePageName" as const,
                  ref: signatureRef,
                  progress: signatureProgress,
                  onUpload: (e: React.ChangeEvent<HTMLInputElement>) =>
                    handleDocumentUpload("member-signature-page", "memberSignaturePageUrl", "memberSignaturePageName", setSignatureProgress, signatureRef, e),
                },
                {
                  label: "Subscription Agreement & Tax Documents",
                  urlKey: "subscriptionAgreementUrl" as const,
                  nameKey: "subscriptionAgreementName" as const,
                  ref: subscriptionRef,
                  progress: subscriptionProgress,
                  onUpload: (e: React.ChangeEvent<HTMLInputElement>) =>
                    handleDocumentUpload("subscription-agreement", "subscriptionAgreementUrl", "subscriptionAgreementName", setSubscriptionProgress, subscriptionRef, e),
                },
                {
                  label: "Broadway Operating Agreement",
                  urlKey: "operatingAgreementUrl" as const,
                  nameKey: "operatingAgreementName" as const,
                  ref: agreementRef,
                  progress: agreementProgress,
                  onUpload: handleAgreementUpload,
                },
              ] as {
                label: string;
                urlKey: keyof Production;
                nameKey: keyof Production;
                ref: React.RefObject<HTMLInputElement | null>;
                progress: number | null;
                onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
              }[]).map(({ label, urlKey, nameKey, ref, progress, onUpload }) => {
                const url = production[urlKey] as string | undefined;
                const name = production[nameKey] as string | undefined;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{label}</p>
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 truncate">
                              {name ?? "View PDF"} <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <p className="text-xs text-muted-foreground">No file uploaded</p>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0 ml-3" onClick={() => ref.current?.click()}>
                        <Upload className="h-3 w-3 mr-1.5" />
                        {url ? "Replace" : "Upload PDF"}
                      </Button>
                      <input ref={ref} type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
                    </div>
                    {progress !== null && <Progress value={progress} className="h-1 mt-1" />}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>


        {/* ════════════════════════════════ CAPITALIZATION ════════════════════════════════════════════════════ */}
        <TabsContent value="capitalization">
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Raise Target</p>
                <p className="text-xl font-bold">{formatCurrency(capitalizationSummary.totalTarget)}</p>
                <p className="text-xs text-muted-foreground mt-1">{capitalizationSummary.investorCount} investor{capitalizationSummary.investorCount !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Committed</p>
                <p className="text-xl font-bold">{formatCurrency(capitalizationSummary.totalCommitted)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {capitalizationSummary.totalTarget > 0
                    ? formatPercent(capitalizationSummary.totalCommitted / capitalizationSummary.totalTarget)
                    : "\u2014"} of target
                </p>
                {capitalizationSummary.totalTarget > 0 && (
                  <Progress
                    value={Math.min(100, (capitalizationSummary.totalCommitted / capitalizationSummary.totalTarget) * 100)}
                    className="h-1.5 mt-2"
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Funded</p>
                <p className="text-xl font-bold">{formatCurrency(capitalizationSummary.totalFunded)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {capitalizationSummary.totalCommitted > 0
                    ? formatPercent(capitalizationSummary.totalFunded / capitalizationSummary.totalCommitted)
                    : "\u2014"} of committed
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Remaining Raise</p>
                {capitalizationSummary.remainingRaise <= 0 ? (
                  <p className="text-xl font-bold text-green-600">Fully raised</p>
                ) : (
                  <p className="text-xl font-bold">{formatCurrency(capitalizationSummary.remainingRaise)}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {capitalizationSummary.totalTarget > 0 && capitalizationSummary.remainingRaise > 0
                    ? formatPercent(capitalizationSummary.remainingRaise / capitalizationSummary.totalTarget) + " remaining"
                    : "\u00a0"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* View selector + actions */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-1 rounded-lg border p-1">
              {([
                { key: "all", label: "All Investors" },
                { key: "byProducer", label: "By Producer" },
                { key: "mine", label: "My Investments" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setCapView(key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    capView === key
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {capView === "byProducer" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditingPool(null); setPoolDialogOpen(true); }}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Pool
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => { setEditingInvestor(null); setDefaultPoolIdOverride(null); setInvestorSheetOpen(true); }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Investor
              </Button>
            </div>
          </div>

          {/* Ledger card */}
          <Card>
            <CardContent className="p-0">
              {investorsLoading || poolsLoading ? (
                <div className="p-6 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : capView === "all" ? (
                investors.length === 0 ? (
                  <div className="text-center py-10">
                    <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">No investors tracked yet.</p>
                    <Button variant="outline" onClick={() => { setEditingInvestor(null); setInvestorSheetOpen(true); }}>
                      <Plus className="h-4 w-4 mr-1.5" />Add First Investor
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Shares</TableHead>
                          <TableHead className="text-right">Committed</TableHead>
                          <TableHead className="text-right">Funded</TableHead>
                          <TableHead className="text-right">Ownership %</TableHead>
                          <TableHead className="w-16" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {investors.map(inv => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium">
                              {inv.name}
                              {inv.isPersonalInvestment && (
                                <Badge variant="outline" className="ml-2 text-xs bg-indigo-50 text-indigo-700 border-indigo-200">Me</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{inv.email}</TableCell>
                            <TableCell><InvestorStatusBadge status={inv.status} /></TableCell>
                            <TableCell className="text-right font-mono text-sm">{inv.shares.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatCurrency(inv.amountCommitted)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatCurrency(inv.amountFunded)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {capitalizationSummary.totalTarget > 0
                                ? formatPercent(inv.amountCommitted / capitalizationSummary.totalTarget)
                                : "\u2014"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={() => { setEditingInvestor(inv); setInvestorSheetOpen(true); }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={async () => {
                                    if (!window.confirm(`Delete investor "${inv.name}"? This cannot be undone.`)) return;
                                    await removeInvestorFn(inv.id);
                                    const remaining = investors.filter(i => i.id !== inv.id);
                                    const anyPersonal = remaining.some(i => i.isPersonalInvestment);
                                    if (inv.isPersonalInvestment) {
                                      await updateProduction(id, { hasPersonalInvestment: anyPersonal });
                                      setProduction(prev => prev ? { ...prev, hasPersonalInvestment: anyPersonal } : prev);
                                    }
                                    toast.success("Investor removed.");
                                  }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              ) : capView === "byProducer" ? (
                ownershipRollup ? (
                  <ProducerLedger
                    rollup={ownershipRollup}
                    onEditInvestor={(inv) => { setEditingInvestor(inv); setInvestorSheetOpen(true); }}
                    onDeleteInvestor={async (inv) => {
                      if (!window.confirm(`Delete investor "${inv.name}"? This cannot be undone.`)) return;
                      await removeInvestorFn(inv.id);
                      const remaining = investors.filter(i => i.id !== inv.id);
                      const anyPersonal = remaining.some(i => i.isPersonalInvestment);
                      if (inv.isPersonalInvestment) {
                        await updateProduction(id, { hasPersonalInvestment: anyPersonal });
                        setProduction(prev => prev ? { ...prev, hasPersonalInvestment: anyPersonal } : prev);
                      }
                      toast.success("Investor removed.");
                    }}
                    onAddInvestorToPool={(poolId) => {
                      setDefaultPoolIdOverride(poolId);
                      setEditingInvestor(null);
                      setInvestorSheetOpen(true);
                    }}
                    onEditPool={(poolId) => {
                      setEditingPool(pools.find((p) => p.id === poolId) ?? null);
                      setPoolDialogOpen(true);
                    }}
                    onDeletePool={async (poolId) => {
                      const pool = pools.find((p) => p.id === poolId);
                      if (!pool || !window.confirm(`Delete pool "${pool.name}"? Investors in this pool will become unassigned.`)) return;
                      await removePool(poolId);
                      toast.success("Pool deleted.");
                    }}
                  />
                ) : null
              ) : (
                /* My Investments — filtered flat view */
                (() => {
                  const mine = investors.filter(inv => inv.isPersonalInvestment);
                  return mine.length === 0 ? (
                    <div className="text-center py-10">
                      <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No investors marked as your personal investment. Edit an investor and check &ldquo;This is my personal investment.&rdquo;
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Committed</TableHead>
                            <TableHead className="text-right">Funded</TableHead>
                            <TableHead className="text-right">Ownership %</TableHead>
                            <TableHead className="w-16" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mine.map(inv => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium">{inv.name}</TableCell>
                              <TableCell><InvestorStatusBadge status={inv.status} /></TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatCurrency(inv.amountCommitted)}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatCurrency(inv.amountFunded)}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {capitalizationSummary.totalTarget > 0
                                  ? formatPercent(inv.amountCommitted / capitalizationSummary.totalTarget)
                                  : "\u2014"}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={() => { setEditingInvestor(inv); setInvestorSheetOpen(true); }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>

          {/* InvestorSheet */}
          <InvestorSheet
            open={investorSheetOpen}
            onOpenChange={(open) => {
              setInvestorSheetOpen(open);
              if (!open) setDefaultPoolIdOverride(null);
            }}
            investor={editingInvestor}
            totalCapitalization={dealInputs?.totalCapitalization ?? 0}
            productionId={id}
            userId={user?.uid ?? ""}
            pools={pools}
            defaultPoolId={defaultPoolIdOverride ?? defaultPoolId}
            onSave={async (data) => {
              if (editingInvestor) {
                await updateInvestorData(editingInvestor.id, data);
                if (data.isPersonalInvestment !== editingInvestor.isPersonalInvestment) {
                  const anyPersonal = investors.some(inv =>
                    inv.id === editingInvestor.id ? data.isPersonalInvestment : inv.isPersonalInvestment
                  );
                  await updateProduction(id, { hasPersonalInvestment: anyPersonal });
                  setProduction(prev => prev ? { ...prev, hasPersonalInvestment: anyPersonal } : prev);
                }
                toast.success("Investor updated.");
              } else {
                const newId = await addInvestor(data);
                Analytics.investorAdded();
                toast.success("Investor added.");
                if (data.isPersonalInvestment) {
                  await updateProduction(id, { hasPersonalInvestment: true });
                  setProduction(prev => prev ? { ...prev, hasPersonalInvestment: true } : prev);
                }
                setEditingInvestor({
                  ...(data as CapitalizationInvestor),
                  id: newId,
                  productionId: id,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }
            }}
            onDocUploaded={async (field, url) => {
              if (!editingInvestor) return;
              await updateInvestorData(editingInvestor.id, { [field]: url });
              setEditingInvestor(prev => prev ? { ...prev, [field]: url } : prev);
              Analytics.investorDocUploaded(String(field));
            }}
          />

          {/* PoolDialog */}
          <PoolDialog
            open={poolDialogOpen}
            onOpenChange={setPoolDialogOpen}
            pool={editingPool}
            onSave={async (data) => {
              if (editingPool) {
                await updatePool(editingPool.id, data);
                toast.success("Pool updated.");
              } else {
                await addPool({ productionId: id, ownerUserId: user?.uid ?? "", ...data });
                Analytics.producerPoolCreated();
                toast.success("Pool created.");
              }
            }}
          />
        </TabsContent>

        <TabsContent value="deal">
          {/* ── Empty-state banner for new productions ── */}
          {isNew && !((dealInputs?.totalCapitalization ?? 0) > 0 || (dealInputs?.capacity ?? 0) > 0) && (
            <Card className="border-2 border-primary/20 bg-primary/5 mb-6">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start gap-4">
                  <Sparkles className="h-8 w-8 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-base">Welcome to your new production</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">
                      Configure your deal structure below. Start with guided setup for step-by-step
                      help, or jump directly to any section.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        onClick={() => {
                          setGuidedMode(true);
                          router.replace(`/productions/view?id=${id}`);
                        }}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        Start Guided Setup
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.replace(`/productions/view?id=${id}`)}
                      >
                        Configure Manually
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Deal Builder workspace ── */}
          <DealBuilder
            control={control}
            watch={watch}
            setValue={setValue}
            getValues={getValues}
            handleSubmit={handleSubmit}
            isDirty={isDirty}
            saving={saving}
            modelOutput={modelOutput}
            dealInputs={dealInputs}
            onSave={onDealSubmit}
            initialGuidedMode={guidedModeActive}
            onGuidedModeChange={setGuidedMode}
          />
        </TabsContent>

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 FINANCIAL MODEL \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        <TabsContent value="model">
          {!dealInputs ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="mb-4">No deal inputs saved yet.</p>
              <Button onClick={() => setActiveTab("deal")}>Enter Deal Inputs</Button>
            </div>
          ) : (
            <>
              {/* Controls */}
              <Card className="mb-6">
                <CardContent className="pt-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Occupancy Rate</Label>
                      <div className="relative">
                        <Input type="number" min="0" max="100" step="1" value={Math.round(modelScenario.occupancyRate * 100)} onChange={e => setModelScenario(s => ({ ...s, occupancyRate: parseFloat(e.target.value || "0") / 100 }))} className="pr-6" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1">
                        Blended ATP
                        <InfoTip>
                          Weighted average ticket price: (full-price × {formatPercent(1 - (liveFormValues.discountRate ?? 0))}) + (discounted × {formatPercent(liveFormValues.discountRate ?? 0)}).
                          Full-price ATP from Deal Inputs: {formatCurrency(liveFormValues.avgTicketPrice ?? 0)}.
                        </InfoTip>
                      </Label>
                      <div className="h-10 flex items-center gap-1 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                        <span className="text-xs">$</span>
                        <span className="font-medium text-foreground">
                          {(() => {
                            const full = liveFormValues.avgTicketPrice ?? dealInputs?.avgTicketPrice ?? 0;
                            const discounted = liveFormValues.discountedTicketPrice ?? dealInputs?.discountedTicketPrice ?? 0;
                            const rate = liveFormValues.discountRate ?? dealInputs?.discountRate ?? 0;
                            const blended = full * (1 - rate) + discounted * rate;
                            return blended.toFixed(2);
                          })()}
                        </span>
                        <span className="ml-auto text-[10px] leading-tight text-muted-foreground/60">blended</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Run Length (weeks)</Label>
                      <Input type="number" min="1" max="520" value={modelScenario.estimatedWeeks} onChange={e => setModelScenario(s => ({ ...s, estimatedWeeks: parseInt(e.target.value || "1") }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Weekly Breakeven</Label>
                      <div className="h-10 flex items-center">
                        <Badge variant={modelOutput?.weeklyBreakeven && modelOutput.weeklyBreakeven <= modelScenario.occupancyRate ? "default" : "destructive"} className="text-sm">
                          {modelOutput?.weeklyBreakeven ? formatPercent(modelOutput.weeklyBreakeven) : "N/A"} occ.
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {modelOutput && (
                <>
                  {/* KPI cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[
                      { icon: Clock, label: "Weeks to Recoup", value: formatWeek(modelOutput.recoupWeek), sub: modelOutput.recoupWeek ? `of ${modelScenario.estimatedWeeks} wk run` : "No recoup" },
                      { icon: DollarSign, label: "Total Gross BO", value: formatCurrency(modelOutput.totalGrossBoxOffice, true) },
                      { icon: TrendingUp, label: "Investor Distributions", value: formatCurrency(modelOutput.totalInvestorDistributions, true) },
                      { icon: Users, label: "Investor Pool ROI", value: dealInputs && dealInputs.totalCapitalization > 0 ? formatPercent((modelOutput.totalInvestorDistributions - dealInputs.totalCapitalization) / dealInputs.totalCapitalization) : "—" },
                    ].map(({ icon: Icon, label, value, sub }) => (
                      <Card key={label}><CardContent className="pt-5">
                        <div className="flex items-start justify-between">
                          <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}</div>
                          <Icon className="h-5 w-5 text-muted-foreground mt-1" />
                        </div>
                      </CardContent></Card>
                    ))}
                  </div>

                  {/* Charts + Tables */}
                  <Tabs defaultValue="cashflow">
                    <TabsList className="mb-4">
                      <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
                      <TabsTrigger value="weekly">Weekly Table</TabsTrigger>
                      <TabsTrigger value="investors">Investor Returns</TabsTrigger>
                      <TabsTrigger value="waterfall">Waterfall</TabsTrigger>
                    </TabsList>

                    <TabsContent value="cashflow">
                      <Card>
                        <CardHeader><CardTitle className="text-base">Cumulative P&L vs Recoupment Threshold</CardTitle></CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={360}>
                            <LineChart data={modelOutput.weeks} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="week" label={{ value: "Week", position: "insideBottom", offset: -2 }} tick={{ fontSize: 11 }} />
                              <YAxis tickFormatter={v => formatCurrency(Number(v), true)} tick={{ fontSize: 11 }} width={80} />
                              <RechartsTooltip formatter={(v: unknown) => [formatCurrency(Number(v)), "Cumulative P&L"]} labelFormatter={l => `Week ${l}`} />
                              <ReferenceLine y={dealInputs.totalCapitalization} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Recoup Target", position: "insideTopRight", fontSize: 10, fill: "#ef4444" }} />
                              <ReferenceLine y={0} stroke="#9ca3af" />
                              {modelOutput.recoupWeek && <ReferenceLine x={modelOutput.recoupWeek} stroke="#ef4444" strokeDasharray="3 3" />}
                              <Line type="monotone" dataKey="cumulativeProfit" stroke="#6366f1" strokeWidth={2.5} dot={false} name="Cumulative P&L" />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="weekly">
                      <Card>
                        <CardHeader><CardTitle className="text-base">Week-by-Week Results</CardTitle></CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-auto max-h-[480px]">
                            <Table>
                              <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                  <TableHead className="text-xs w-10">Wk</TableHead>
                                  <TableHead className="text-xs">Type</TableHead>
                                  <TableHead className="text-xs text-right">Gross BO</TableHead>
                                  <TableHead className="text-xs text-right">Adj. Gross</TableHead>
                                  <TableHead className="text-xs text-right">Royalties</TableHead>
                                  <TableHead className="text-xs text-right">Nut</TableHead>
                                  <TableHead className="text-xs text-right">Op. Profit</TableHead>
                                  <TableHead className="text-xs text-right text-violet-700">GP Total</TableHead>
                                  <TableHead className="text-xs text-right text-green-700">LP Dist.</TableHead>
                                  <TableHead className="text-xs text-right text-blue-700">Creative</TableHead>
                                  <TableHead className="text-xs text-right">Recoup%</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {modelOutput.weeks.map(w => {
                                  const gpTotal = w.gpFee + (w.gpFlatPayment ?? 0) + w.gpDistribution;
                                  return (
                                    <TableRow key={w.week} className={w.isRecouped && !modelOutput.weeks[w.week - 2]?.isRecouped ? "bg-green-50 font-medium" : w.isPreview ? "bg-blue-50/40" : ""}>
                                      <TableCell className="text-xs font-mono">{w.week}</TableCell>
                                      <TableCell className="text-xs">{w.isPreview ? <Badge variant="outline" className="text-xs py-0 bg-blue-50">Preview</Badge> : "Open"}</TableCell>
                                      <TableCell className="text-xs text-right font-mono">{formatCurrency(w.grossBoxOffice)}</TableCell>
                                      <TableCell className="text-xs text-right font-mono">{formatCurrency(w.adjustedGross)}</TableCell>
                                      <TableCell className="text-xs text-right font-mono text-amber-700">{formatCurrency(w.totalRoyalties)}</TableCell>
                                      <TableCell className="text-xs text-right font-mono text-red-700">{formatCurrency(w.weeklyNut)}</TableCell>
                                      <TableCell className={`text-xs text-right font-mono font-medium ${w.operatingProfit >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(w.operatingProfit)}</TableCell>
                                      <TableCell className="text-xs text-right font-mono text-violet-700">{gpTotal > 0 ? formatCurrency(gpTotal) : "—"}</TableCell>
                                      <TableCell className="text-xs text-right font-mono text-green-700">{w.investorDistribution > 0 ? formatCurrency(w.investorDistribution) : "—"}</TableCell>
                                      <TableCell className="text-xs text-right font-mono text-blue-700">{w.creativeDistribution > 0 ? formatCurrency(w.creativeDistribution) : "—"}</TableCell>
                                      <TableCell className="text-xs text-right">{formatPercent(w.recoupPercent)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="investors">
                      <Card>
                        <CardHeader><CardTitle className="text-base">Per-Investor Return Profile</CardTitle></CardHeader>
                        <CardContent className="p-0">
                          {modelOutput.investorReturns.length === 0 ? (
                            <div className="p-6 space-y-4">
                              <p className="text-sm text-muted-foreground text-center">
                                No individual investors entered. Showing full investor pool returns against total capitalization.{" "}
                                <button className="text-primary underline" onClick={() => setActiveTab("cap")}>Add investors</button> to see per-investor breakdowns.
                              </p>
                              {dealInputs && dealInputs.totalCapitalization > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  {[
                                    { label: "Total Capitalization", value: formatCurrency(dealInputs.totalCapitalization) },
                                    { label: "Total Investor Distributions", value: formatCurrency(modelOutput.totalInvestorDistributions) },
                                    { label: "Pool ROI", value: formatPercent((modelOutput.totalInvestorDistributions - dealInputs.totalCapitalization) / dealInputs.totalCapitalization) },
                                    { label: "Cash-on-Cash Multiple", value: formatMultiple(dealInputs.totalCapitalization > 0 ? modelOutput.totalInvestorDistributions / dealInputs.totalCapitalization : 0) },
                                  ].map(({ label, value }) => (
                                    <div key={label} className="rounded-lg border bg-muted/30 p-3">
                                      <p className="text-xs text-muted-foreground">{label}</p>
                                      <p className="text-lg font-bold mt-0.5">{value}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="overflow-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Investor</TableHead>
                                    <TableHead className="text-xs text-right">Investment</TableHead>
                                    <TableHead className="text-xs text-right">Pool %</TableHead>
                                    <TableHead className="text-xs text-right">Total Received</TableHead>
                                    <TableHead className="text-xs text-right">ROI</TableHead>
                                    <TableHead className="text-xs text-right">Multiple</TableHead>
                                    <TableHead className="text-xs text-right">Recoup Wk</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {modelOutput.investorReturns.map((r, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="text-sm font-medium">{r.investor.name || `Investor ${i + 1}`}</TableCell>
                                      <TableCell className="text-xs text-right font-mono">{formatCurrency(r.investmentAmount)}</TableCell>
                                      <TableCell className="text-xs text-right">{formatPercent(r.poolPercent)}</TableCell>
                                      <TableCell className="text-xs text-right font-mono font-medium">{formatCurrency(r.totalReceived)}</TableCell>
                                      <TableCell className={`text-xs text-right font-medium ${r.roi >= 0 ? "text-green-700" : "text-red-700"}`}>{formatPercent(r.roi)}</TableCell>
                                      <TableCell className="text-xs text-right">{formatMultiple(r.cashOnCashMultiple)}</TableCell>
                                      <TableCell className="text-xs text-right">{formatWeek(r.recoupWeek)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="waterfall">
                      <WaterfallFlow modelOutput={modelOutput} dealInputs={dealInputs} />
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 SCENARIOS \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        <TabsContent value="scenarios">
          {!dealInputs ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="mb-4">No deal inputs saved yet.</p>
              <Button onClick={() => setActiveTab("deal")}>Enter Deal Inputs</Button>
            </div>
          ) : (
            <>
              {/* Scenario Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {scenarios.map((scenario, i) => (
                  <Card key={scenario.name} className="border-t-4" style={{ borderTopColor: SCENARIO_COLORS[i] }}>
                    <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[i] }} />{scenario.name}</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Occupancy</Label>
                        <div className="relative">
                          <Input type="number" min="0" max="100" step="5" value={Math.round(scenario.occupancyRate * 100)} onChange={e => updateScenario(i, "occupancyRate", parseFloat(e.target.value || "0") / 100)} className="pr-6 text-sm h-8" />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Avg Ticket</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <Input type="number" min="1" step="5" value={scenario.avgTicketPrice} onChange={e => updateScenario(i, "avgTicketPrice", parseFloat(e.target.value || "0"))} className="pl-6 text-sm h-8" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Run (weeks)</Label>
                        <Input type="number" min="1" value={scenario.estimatedWeeks} onChange={e => updateScenario(i, "estimatedWeeks", parseInt(e.target.value || "1"))} className="text-sm h-8" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Comparison Table */}
              <Card className="mb-6">
                <CardHeader><CardTitle className="text-base">Scenario Comparison</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Metric</TableHead>
                        {scenarios.map((s, i) => (<TableHead key={s.name} className="text-xs" style={{ color: SCENARIO_COLORS[i] }}>{s.name}</TableHead>))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: "Occupancy", fn: (o: ModelOutput) => formatPercent(o.occupancyRate) },
                        { label: "Weeks to Recoup", fn: (o: ModelOutput) => formatWeek(o.recoupWeek) },
                        { label: "Total Gross BO", fn: (o: ModelOutput) => formatCurrency(o.totalGrossBoxOffice, true) },
                        { label: "Total Op. Profit", fn: (o: ModelOutput) => formatCurrency(o.totalOperatingProfit, true) },
                        { label: "Investor Distributions", fn: (o: ModelOutput) => formatCurrency(o.totalInvestorDistributions, true) },
                        { label: "Investor Pool ROI", fn: (o: ModelOutput) => o.dealInputs.totalCapitalization > 0 ? formatPercent((o.totalInvestorDistributions - o.dealInputs.totalCapitalization) / o.dealInputs.totalCapitalization) : "—" },
                        { label: "Cash-on-Cash Multiple", fn: (o: ModelOutput) => o.dealInputs.totalCapitalization > 0 ? formatMultiple(o.totalInvestorDistributions / o.dealInputs.totalCapitalization) : "—" },
                      ].map(({ label, fn }) => (
                        <TableRow key={label}>
                          <TableCell className="text-xs font-medium">{label}</TableCell>
                          {scenarioOutputs.map(({ output }, i) => (<TableCell key={i} className="text-xs font-mono">{fn(output)}</TableCell>))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Multi-scenario chart */}
              <Card className="mb-6">
                <CardHeader><CardTitle className="text-base">Cumulative P&L—All Scenarios</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={scenarioChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={v => formatCurrency(Number(v), true)} tick={{ fontSize: 10 }} width={80} />
                      <RechartsTooltip formatter={(v: unknown, name: unknown) => [formatCurrency(Number(v)), String(name)]} labelFormatter={l => `Week ${l}`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine y={dealInputs.totalCapitalization} stroke="#9ca3af" strokeDasharray="4 4" />
                      <ReferenceLine y={0} stroke="#e5e7eb" />
                      {scenarios.map((s, i) => (<Line key={s.name} type="monotone" dataKey={s.name} stroke={SCENARIO_COLORS[i]} strokeWidth={2} dot={false} connectNulls />))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Investor Outcome Sensitivity */}
              <OutcomeSensitivityGrid
                sensitivityVisible={sensitivityVisible}
                onGenerate={() => setSensitivityVisible(true)}
                sensitivityGrid={sensitivityGrid}
                dealInputs={dealInputs}
              />
            </>
          )}
        </TabsContent>

        {/* ══════════════════════════════ DEAL ROOM ══════════════════════════════ */}
        <TabsContent value="dealroom">
          {production && user ? (
            <div className="max-w-2xl">
              <div className="mb-5">
                <h2 className="text-lg font-semibold">Deal Room</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Share a secure, investor-facing view of your deal with a private link.
                  No investor login required.
                </p>
              </div>
              <DealRoomSetup
                production={production}
                dealInputs={dealInputs}
                userId={user.uid}
                onProductionUpdated={(updates) =>
                  setProduction((prev) => (prev ? { ...prev, ...updates } : prev))
                }
              />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Loading production…
            </div>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}
