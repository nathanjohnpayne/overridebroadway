"use client";

/**
 * DealRoomSetup — producer-facing Deal Room configuration panel.
 *
 * Lets the producer:
 *  1. Create a new deal room (snapshots current DealInputs + production metadata)
 *  2. Configure what sections investors can see
 *  3. Copy the shareable link
 *  4. Refresh the snapshot (re-snapshot from latest DealInputs)
 *  5. Deactivate / revoke the link
 *
 * Lives inside the "Deal Room" tab in ProductionHubClient.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Link2,
  LinkIcon,
  Check,
  RefreshCw,
  EyeOff,
  ExternalLink,
  Share2,
  Sparkles,
  AlertTriangle,
  Eye,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  createDealRoom,
  getDealRoom,
  updateDealRoom,
  deactivateDealRoom,
  getProductionDealRooms,
  updateProduction,
} from "@/lib/firestore";
import { Analytics } from "@/lib/analytics";
import { DEFAULT_DEAL_ROOM_CONFIG } from "@/types/dealRoom";
import type { DealRoomConfig, DealRoom } from "@/types/dealRoom";
import type { DealInputs } from "@/types/deal";
import type { Production } from "@/types/production";

// ─── Props ────────────────────────────────────────────────────────────────────

interface DealRoomSetupProps {
  production: Production;
  dealInputs: DealInputs | null;
  userId: string;
  /** Called after production record is mutated (dealRoomEnabled/dealRoomToken) */
  onProductionUpdated: (updated: Partial<Production>) => void;
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DealRoomSetup({
  production,
  dealInputs,
  userId,
  onProductionUpdated,
}: DealRoomSetupProps) {
  const [dealRoom, setDealRoom] = useState<DealRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Local config — synced from dealRoom, editable by producer
  const [config, setConfig] = useState<DealRoomConfig>(DEFAULT_DEAL_ROOM_CONFIG);

  // ── Load existing deal room on mount ─────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (production.dealRoomToken) {
          const room = await getDealRoom(production.dealRoomToken);
          if (room && room.ownedByUserId === userId) {
            setDealRoom(room);
            setConfig(room.config);
          }
        } else {
          // No token set — check if there are any deal rooms for this production
          // (handles edge case where token wasn't saved back to the production doc)
          const rooms = await getProductionDealRooms(production.id, userId);
          const active = rooms.find((r) => r.isActive) ?? rooms[0] ?? null;
          if (active) {
            setDealRoom(active);
            setConfig(active.config);
            // Sync token back to production record if missing
            if (!production.dealRoomToken) {
              await updateProduction(production.id, {
                dealRoomEnabled: active.isActive,
                dealRoomToken: active.id,
              });
              onProductionUpdated({ dealRoomEnabled: active.isActive, dealRoomToken: active.id });
            }
          }
        }
      } catch (err) {
        console.error("Failed to load deal room:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [production.id, production.dealRoomToken, userId]);

  // ── Share URL ─────────────────────────────────────────────────────────────
  const shareUrl = dealRoom
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/deal-room?token=${dealRoom.id}`
    : null;

  // ── Copy link ─────────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    Analytics.dealRoomLinkCopied(production.id);
  }, [shareUrl, production.id]);

  // ── Create deal room ──────────────────────────────────────────────────────
  async function handleCreate() {
    if (!dealInputs) {
      toast.error("Save your deal inputs before creating a deal room.");
      return;
    }
    if (dealInputs.totalCapitalization <= 0 || dealInputs.capacity <= 0) {
      toast.error("Complete your deal structure (capitalization + capacity) before sharing.");
      return;
    }

    setCreating(true);
    try {
      const token = await createDealRoom({
        productionId: production.id,
        ownedByUserId: userId,
        production: {
          name: production.name,
          subtitle: production.subtitle,
          venue: production.venue,
          status: production.status,
          artworkUrl: production.artworkUrl,
          showUrl: production.showUrl,
          investorInstructionLetterUrl: production.investorInstructionLetterUrl,
          memberSignaturePageUrl: production.memberSignaturePageUrl,
          subscriptionAgreementUrl: production.subscriptionAgreementUrl,
          operatingAgreementUrl: production.operatingAgreementUrl,
          investorInstructionLetterName: production.investorInstructionLetterName,
          memberSignaturePageName: production.memberSignaturePageName,
          subscriptionAgreementName: production.subscriptionAgreementName,
          operatingAgreementName: production.operatingAgreementName,
        },
        dealInputs,
        config,
        isActive: true,
      });

      // Save token back to production record for quick lookup
      await updateProduction(production.id, {
        dealRoomEnabled: true,
        dealRoomToken: token,
      });
      onProductionUpdated({ dealRoomEnabled: true, dealRoomToken: token });

      // Fetch the full record back so we have createdAt / updatedAt
      const room = await getDealRoom(token);
      setDealRoom(room);
      if (room) setConfig(room.config);

      Analytics.dealRoomCreated(production.id);
      toast.success("Deal room created! Your share link is ready.");
    } catch (err) {
      console.error("Failed to create deal room:", err);
      toast.error("Failed to create deal room. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  // ── Save config ───────────────────────────────────────────────────────────
  async function handleSaveConfig() {
    if (!dealRoom) return;
    setSaving(true);
    try {
      await updateDealRoom(dealRoom.id, { config });
      setDealRoom((prev) => (prev ? { ...prev, config } : prev));
      Analytics.dealRoomUpdated(production.id);
      toast.success("Deal room settings saved.");
    } catch (err) {
      console.error("Failed to save deal room config:", err);
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  // ── Refresh snapshot ──────────────────────────────────────────────────────
  async function handleRefreshSnapshot() {
    if (!dealRoom || !dealInputs) return;
    setRefreshing(true);
    try {
      await updateDealRoom(dealRoom.id, {
        dealInputs,
        production: {
          name: production.name,
          subtitle: production.subtitle,
          venue: production.venue,
          status: production.status,
          artworkUrl: production.artworkUrl,
          showUrl: production.showUrl,
          investorInstructionLetterUrl: production.investorInstructionLetterUrl,
          memberSignaturePageUrl: production.memberSignaturePageUrl,
          subscriptionAgreementUrl: production.subscriptionAgreementUrl,
          operatingAgreementUrl: production.operatingAgreementUrl,
          investorInstructionLetterName: production.investorInstructionLetterName,
          memberSignaturePageName: production.memberSignaturePageName,
          subscriptionAgreementName: production.subscriptionAgreementName,
          operatingAgreementName: production.operatingAgreementName,
        },
        config,
      });
      setDealRoom((prev) =>
        prev ? { ...prev, dealInputs: dealInputs!, config, updatedAt: new Date() } : prev
      );
      Analytics.dealRoomUpdated(production.id);
      toast.success("Deal room updated with latest deal structure.");
    } catch (err) {
      console.error("Failed to refresh snapshot:", err);
      toast.error("Failed to update deal room.");
    } finally {
      setRefreshing(false);
    }
  }

  // ── Deactivate ────────────────────────────────────────────────────────────
  async function handleDeactivate() {
    if (!dealRoom) return;
    setDeactivating(true);
    try {
      await deactivateDealRoom(dealRoom.id);
      await updateProduction(production.id, {
        dealRoomEnabled: false,
      });
      onProductionUpdated({ dealRoomEnabled: false });
      setDealRoom((prev) => (prev ? { ...prev, isActive: false } : prev));
      Analytics.dealRoomDeactivated(production.id);
      toast.success("Deal room deactivated. The link no longer works for investors.");
    } catch (err) {
      console.error("Failed to deactivate deal room:", err);
      toast.error("Failed to deactivate deal room.");
    } finally {
      setDeactivating(false);
    }
  }

  // ── Reactivate ────────────────────────────────────────────────────────────
  async function handleReactivate() {
    if (!dealRoom) return;
    setSaving(true);
    try {
      await updateDealRoom(dealRoom.id, { isActive: true });
      await updateProduction(production.id, { dealRoomEnabled: true });
      onProductionUpdated({ dealRoomEnabled: true });
      setDealRoom((prev) => (prev ? { ...prev, isActive: true } : prev));
      toast.success("Deal room reactivated. Investors can access the link again.");
    } catch (err) {
      console.error("Failed to reactivate deal room:", err);
      toast.error("Failed to reactivate deal room.");
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 rounded-lg bg-muted/50" />
        <div className="h-48 rounded-lg bg-muted/50" />
      </div>
    );
  }

  // ── No deal room yet ──────────────────────────────────────────────────────
  if (!dealRoom) {
    const hasMinData =
      dealInputs &&
      dealInputs.totalCapitalization > 0 &&
      dealInputs.capacity > 0;

    return (
      <div className="space-y-6">
        {/* Hero CTA */}
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-2.5 shrink-0">
                <Share2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base">
                  Share your deal with investors
                </h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4 leading-relaxed">
                  Create a secure, read-only Deal Room — a private link that gives investors
                  a professional view of your financial model, waterfall structure, and key
                  deal terms. No login required for investors.
                </p>

                {!hasMinData && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700 mb-4">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Complete your deal structure first — capitalization and house capacity
                      are required before creating a deal room.
                    </span>
                  </div>
                )}

                <Button
                  onClick={handleCreate}
                  disabled={creating || !hasMinData}
                  className="gap-2"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Create Deal Room
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What's included */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">What investors will see</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { label: "Financial Scenarios", desc: "Bear, Base, and Bull case projections with investor multiples and IRR" },
              { label: "Revenue Waterfall", desc: "Visual breakdown of how revenue flows from box office to distributions" },
              { label: "Deal Terms", desc: "Capitalization, weekly nut, ticket prices, waterfall type, and post-recoup splits" },
              { label: "Documents (optional)", desc: "Links to uploaded PPMs, operating agreements, and subscription docs" },
              { label: "Producer Note (optional)", desc: "A personal message or context for prospective investors" },
            ].map(({ label, desc }) => (
              <div key={label} className="flex items-start gap-2.5">
                <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-medium">{label}</span>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Existing deal room ────────────────────────────────────────────────────
  const isActive = dealRoom.isActive;

  return (
    <div className="space-y-6">
      {/* ── Status + Share link ─────────────────────────────────────────── */}
      <Card className={isActive ? "border-green-200" : "border-muted"}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
              Deal Room Link
            </CardTitle>
            <Badge
              className={
                isActive
                  ? "bg-green-100 text-green-800 border-green-200"
                  : "bg-gray-100 text-gray-600 border-gray-200"
              }
            >
              {isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <CardDescription>
            {isActive
              ? "This link is live. Anyone with it can view your deal room."
              : "This link is deactivated. Investors can no longer access it."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Link display + copy */}
          <div className="flex items-center gap-2">
            <div className="flex-1 font-mono text-xs bg-muted/50 rounded-md border px-3 py-2 truncate text-muted-foreground">
              {shareUrl}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!isActive}
              className="shrink-0 gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5" />
                  Copy Link
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              disabled={!isActive}
              className="shrink-0"
            >
              <a href={shareUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>

          {/* Snapshot date */}
          <p className="text-xs text-muted-foreground">
            Snapshot taken{" "}
            {dealRoom.updatedAt.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshSnapshot}
              disabled={refreshing || !isActive || !dealInputs}
              className="gap-1.5"
              title="Re-snapshot your current deal structure. Investors will see the updated numbers."
            >
              {refreshing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Update Snapshot
            </Button>

            {isActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeactivate}
                disabled={deactivating}
                className="gap-1.5 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
              >
                {deactivating ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
                Deactivate Link
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReactivate}
                disabled={saving}
                className="gap-1.5 text-green-700 hover:text-green-800 border-green-200 hover:border-green-300 hover:bg-green-50"
              >
                {saving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                Reactivate Link
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Investor view configuration ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Investor View</CardTitle>
          <CardDescription>
            Control what investors see. Financial scenarios and the waterfall are on by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            id="showFinancialModel"
            label="Financial Scenarios"
            description="Bear, Base, and Bull case projections — investor multiples, recoup week, breakeven occupancy, and IRR."
            checked={config.showFinancialModel}
            onChange={(v) => setConfig((c) => ({ ...c, showFinancialModel: v }))}
          />
          <Separator />
          <ToggleRow
            id="showWaterfall"
            label="Revenue Waterfall"
            description="Visual breakdown of how revenue flows from box office through royalties, the nut, and into investor distributions."
            checked={config.showWaterfall}
            onChange={(v) => setConfig((c) => ({ ...c, showWaterfall: v }))}
          />
          <Separator />
          <ToggleRow
            id="showWeeklyBreakdown"
            label="Week-by-Week Breakdown"
            description="Per-week earnings table for the Base scenario. Shows occupancy, gross, operating profit, and investor distributions."
            checked={config.showWeeklyBreakdown}
            onChange={(v) => setConfig((c) => ({ ...c, showWeeklyBreakdown: v }))}
          />
          <Separator />
          <ToggleRow
            id="showCapitalizationProgress"
            label="Capitalization Structure"
            description="Shows total cap, unit price, and unit count. Individual investor details are never exposed."
            checked={config.showCapitalizationProgress}
            onChange={(v) => setConfig((c) => ({ ...c, showCapitalizationProgress: v }))}
          />
          <Separator />
          <ToggleRow
            id="showDocuments"
            label="Documents"
            description="Links to uploaded investor documents (PPM, operating agreement, subscription docs). Requires documents uploaded in Overview."
            checked={config.showDocuments}
            onChange={(v) => setConfig((c) => ({ ...c, showDocuments: v }))}
          />

          {/* Producer note */}
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="producerNote" className="text-sm font-medium">
              Producer Note{" "}
              <span className="text-xs text-muted-foreground font-normal">(optional · max 500 chars)</span>
            </Label>
            <Textarea
              id="producerNote"
              placeholder="Add a personal message or context for prospective investors…"
              value={config.producerNote ?? ""}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  producerNote: e.target.value.slice(0, 500),
                }))
              }
              rows={3}
              className="text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {(config.producerNote ?? "").length} / 500
            </p>
          </div>

          {/* Save config */}
          <div className="pt-2">
            <Button onClick={handleSaveConfig} disabled={saving} size="sm" className="gap-2">
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Snapshot note ───────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">About snapshots</p>
        <p>
          The deal room captures a snapshot of your deal structure at creation time.
          If you update your deal inputs, click <strong>Update Snapshot</strong> above
          to push the latest numbers to investors. This prevents accidental disclosure
          of draft changes.
        </p>
      </div>
    </div>
  );
}
