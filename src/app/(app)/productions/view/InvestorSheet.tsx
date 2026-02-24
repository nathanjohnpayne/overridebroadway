"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Upload, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { uploadInvestorDocument } from "@/lib/storage";
import type { InvestorDocType } from "@/lib/storage";
import type { CapitalizationInvestor, InvestorStatus, ProducerPool } from "@/types/capitalization";

// ─── Document slots ─────────────────────────────────────────────────────────

const INVESTOR_DOC_SLOTS = [
  {
    category: "Distributed to Investor",
    label: "Instruction Letter",
    docType: "distributed/instruction-letter" as InvestorDocType,
    field: "distributedInstructionLetterUrl" as keyof CapitalizationInvestor,
  },
  {
    category: "Distributed to Investor",
    label: "Signature Page",
    docType: "distributed/signature-page" as InvestorDocType,
    field: "distributedSignaturePageUrl" as keyof CapitalizationInvestor,
  },
  {
    category: "Distributed to Investor",
    label: "Subscription Agreement",
    docType: "distributed/subscription-agreement" as InvestorDocType,
    field: "distributedSubscriptionAgreementUrl" as keyof CapitalizationInvestor,
  },
  {
    category: "Signed by Investor",
    label: "Signature Page",
    docType: "signed/signature-page" as InvestorDocType,
    field: "signedSignaturePageUrl" as keyof CapitalizationInvestor,
  },
  {
    category: "Signed by Investor",
    label: "Subscription Agreement",
    docType: "signed/subscription-agreement" as InvestorDocType,
    field: "signedSubscriptionAgreementUrl" as keyof CapitalizationInvestor,
  },
  {
    category: "Fully Executed (Countersigned)",
    label: "Signature Page",
    docType: "executed/signature-page" as InvestorDocType,
    field: "executedSignaturePageUrl" as keyof CapitalizationInvestor,
  },
  {
    category: "Fully Executed (Countersigned)",
    label: "Subscription Agreement",
    docType: "executed/subscription-agreement" as InvestorDocType,
    field: "executedSubscriptionAgreementUrl" as keyof CapitalizationInvestor,
  },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface InvestorFormValues {
  name: string;
  email: string;
  phone: string;
  address: string;
  shares: number;
  amountCommitted: number;
  amountFunded: number;
  status: InvestorStatus;
  notes: string;
  isPersonalInvestment: boolean;
  producerPoolId: string;
}

export interface InvestorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investor: CapitalizationInvestor | null; // null = create mode
  totalCapitalization: number;
  productionId: string;
  userId: string;
  pools: ProducerPool[];
  defaultPoolId: string | null;
  onSave: (
    data: Omit<CapitalizationInvestor, "id" | "productionId" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  onDocUploaded: (
    field: keyof CapitalizationInvestor,
    url: string
  ) => Promise<void>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function InvestorSheet({
  open,
  onOpenChange,
  investor,
  totalCapitalization,
  productionId,
  userId,
  pools,
  defaultPoolId,
  onSave,
  onDocUploaded,
}: InvestorSheetProps) {
  const [saving, setSaving] = useState(false);
  const [docProgress, setDocProgress] = useState<Record<string, number | null>>({});
  // Track local doc URLs for immediate feedback after upload
  const [localDocUrls, setLocalDocUrls] = useState<Partial<Record<keyof CapitalizationInvestor, string>>>({});

  const { register, control, handleSubmit, reset, watch, formState: { errors } } =
    useForm<InvestorFormValues>({
      defaultValues: {
        name: "",
        email: "",
        phone: "",
        address: "",
        shares: 0,
        amountCommitted: 0,
        amountFunded: 0,
        status: "invited",
        notes: "",
        isPersonalInvestment: false,
        producerPoolId: "",
      },
    });

  // Reset form when investor changes or sheet opens
  useEffect(() => {
    if (open) {
      if (investor) {
        reset({
          name: investor.name,
          email: investor.email,
          phone: investor.phone ?? "",
          address: investor.address ?? "",
          shares: investor.shares,
          amountCommitted: investor.amountCommitted,
          amountFunded: investor.amountFunded,
          status: investor.status,
          notes: investor.notes ?? "",
          isPersonalInvestment: investor.isPersonalInvestment ?? false,
          producerPoolId: investor.producerPoolId ?? defaultPoolId ?? "",
        });
        // Seed local doc URLs from investor
        const urls: Partial<Record<keyof CapitalizationInvestor, string>> = {};
        for (const slot of INVESTOR_DOC_SLOTS) {
          const val = investor[slot.field];
          if (typeof val === "string") urls[slot.field] = val;
        }
        setLocalDocUrls(urls);
      } else {
        reset({
          name: "", email: "", phone: "", address: "",
          shares: 0, amountCommitted: 0, amountFunded: 0,
          status: "invited", notes: "", isPersonalInvestment: false,
          producerPoolId: defaultPoolId ?? "",
        });
        setLocalDocUrls({});
      }
    }
  }, [open, investor, reset]);

  const watchedCommitted = watch("amountCommitted");
  const computedOwnership =
    totalCapitalization > 0 ? watchedCommitted / totalCapitalization : 0;

  async function onSubmit(values: InvestorFormValues) {
    setSaving(true);
    try {
      await onSave({
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        address: values.address || undefined,
        shares: Number(values.shares) || 0,
        amountCommitted: Number(values.amountCommitted) || 0,
        amountFunded: Number(values.amountFunded) || 0,
        ownershipPercent: computedOwnership,
        status: values.status,
        notes: values.notes || undefined,
        isPersonalInvestment: values.isPersonalInvestment || undefined,
        producerPoolId: values.producerPoolId || defaultPoolId || undefined,
        // Preserve existing doc URLs
        distributedInstructionLetterUrl: investor?.distributedInstructionLetterUrl,
        distributedSignaturePageUrl: investor?.distributedSignaturePageUrl,
        distributedSubscriptionAgreementUrl: investor?.distributedSubscriptionAgreementUrl,
        signedSignaturePageUrl: investor?.signedSignaturePageUrl,
        signedSubscriptionAgreementUrl: investor?.signedSubscriptionAgreementUrl,
        executedSignaturePageUrl: investor?.executedSignaturePageUrl,
        executedSubscriptionAgreementUrl: investor?.executedSubscriptionAgreementUrl,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save investor.");
    } finally {
      setSaving(false);
    }
  }

  // Per-doc file input refs (7 slots)
  const docRefs = INVESTOR_DOC_SLOTS.map(() => useRef<HTMLInputElement>(null)); // eslint-disable-line react-hooks/rules-of-hooks

  async function handleDocUpload(
    slot: typeof INVESTOR_DOC_SLOTS[number],
    slotIndex: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file || !investor) return;
    const progressKey = slot.docType;
    setDocProgress((prev) => ({ ...prev, [progressKey]: 0 }));
    try {
      const url = await uploadInvestorDocument(
        userId,
        productionId,
        investor.id,
        slot.docType,
        file,
        (pct) => setDocProgress((prev) => ({ ...prev, [progressKey]: pct }))
      );
      await onDocUploaded(slot.field, url);
      setLocalDocUrls((prev) => ({ ...prev, [slot.field]: url }));
      toast.success("Document uploaded!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setDocProgress((prev) => ({ ...prev, [progressKey]: null }));
      const ref = docRefs[slotIndex];
      if (ref.current) ref.current.value = "";
    }
  }

  // Group doc slots by category
  const categories = Array.from(new Set(INVESTOR_DOC_SLOTS.map((s) => s.category)));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[520px] sm:max-w-[520px] overflow-y-auto flex flex-col p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>
            {investor ? investor.name : "Add Investor"}
          </SheetTitle>
          {investor && (
            <p className="text-xs text-muted-foreground">
              {(investor.ownershipPercent * 100).toFixed(2)}% ownership
              {investor.status !== "invited" && (
                <span className="ml-2 capitalize">· {investor.status.replace("_", " ")}</span>
              )}
            </p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <form id="investor-form" onSubmit={handleSubmit(onSubmit)}>
            {/* Section: Identity */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identity</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="inv-name" className="text-sm">Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="inv-name"
                    {...register("name", { required: true })}
                    placeholder="Jane Smith"
                    className={errors.name ? "border-destructive" : ""}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="inv-email" className="text-sm">Email <span className="text-destructive">*</span></Label>
                  <Input
                    id="inv-email"
                    type="email"
                    {...register("email", { required: true })}
                    placeholder="jane@example.com"
                    className={errors.email ? "border-destructive" : ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-phone" className="text-sm">Phone</Label>
                  <Input id="inv-phone" type="tel" {...register("phone")} placeholder="+1 (555) 000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-status" className="text-sm">Status</Label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="inv-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="invited">Invited</SelectItem>
                          <SelectItem value="docs_sent">Docs Sent</SelectItem>
                          <SelectItem value="signed">Signed</SelectItem>
                          <SelectItem value="funded">Funded</SelectItem>
                          <SelectItem value="admitted">Admitted</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                {pools.length > 0 && (
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="inv-pool" className="text-sm">Producer Pool</Label>
                    <Controller
                      name="producerPoolId"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="inv-pool">
                            <SelectValue placeholder="Select a pool" />
                          </SelectTrigger>
                          <SelectContent>
                            {pools.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                )}
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="inv-address" className="text-sm">Address</Label>
                  <Textarea
                    id="inv-address"
                    {...register("address")}
                    placeholder="123 Main St, New York, NY 10001"
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Section: Investment */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Investment</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-shares" className="text-sm">Shares</Label>
                  <Input
                    id="inv-shares"
                    type="number"
                    min={0}
                    step={0.5}
                    {...register("shares", { valueAsNumber: true })}
                    placeholder="10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Ownership %
                    <span className="text-xs text-muted-foreground font-normal ml-1">(auto)</span>
                  </Label>
                  <div className="h-10 flex items-center px-3 rounded-md border bg-muted/40 text-sm font-mono">
                    {totalCapitalization > 0
                      ? `${(computedOwnership * 100).toFixed(2)}%`
                      : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-committed" className="text-sm">Amount Committed</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="inv-committed"
                      type="number"
                      min={0}
                      step={1000}
                      {...register("amountCommitted", { valueAsNumber: true })}
                      placeholder="25000"
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-funded" className="text-sm">Amount Funded</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="inv-funded"
                      type="number"
                      min={0}
                      step={1000}
                      {...register("amountFunded", { valueAsNumber: true })}
                      placeholder="25000"
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="inv-notes" className="text-sm">Notes</Label>
                  <Textarea
                    id="inv-notes"
                    {...register("notes")}
                    placeholder="Any relevant notes about this investor or subscription..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <input
                    id="inv-personal"
                    type="checkbox"
                    {...register("isPersonalInvestment")}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <div>
                    <Label htmlFor="inv-personal" className="text-sm cursor-pointer">
                      This is my personal investment
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Mark this to track it under &ldquo;My Investments&rdquo; on the dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Documents — only shown when editing an existing investor */}
            {investor && (
              <>
                <Separator />
                <div className="px-6 py-5 space-y-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documents</p>
                  {categories.map((category) => {
                    const slots = INVESTOR_DOC_SLOTS.filter((s) => s.category === category);
                    return (
                      <div key={category} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-2">{category}</p>
                        <div className="rounded-lg border overflow-hidden">
                          {slots.map((slot, slotIdx) => {
                            const globalIdx = INVESTOR_DOC_SLOTS.findIndex(
                              (s) => s.docType === slot.docType
                            );
                            const url = localDocUrls[slot.field] as string | undefined;
                            const progress = docProgress[slot.docType];
                            return (
                              <div key={slot.docType} className="border-b last:border-0">
                                <div className="flex items-start gap-3 px-3 py-2.5">
                                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{slot.label}</p>
                                    {url ? (
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                                      >
                                        View PDF <ExternalLink className="h-3 w-3 shrink-0" />
                                      </a>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">Not uploaded</p>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs shrink-0"
                                    onClick={() => docRefs[globalIdx].current?.click()}
                                  >
                                    <Upload className="h-3 w-3 mr-1" />
                                    {url ? "Replace" : "Upload"}
                                  </Button>
                                  <input
                                    ref={docRefs[globalIdx]}
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={(e) => handleDocUpload(slot, globalIdx, e)}
                                  />
                                </div>
                                {progress !== null && (
                                  <Progress value={progress} className="h-1 rounded-none" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </form>
        </div>

        <SheetFooter className="border-t px-6 py-4 bg-muted/20 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {investor ? "Close" : "Cancel"}
          </Button>
          <Button type="submit" form="investor-form" disabled={saving}>
            {saving ? "Saving..." : investor ? "Save Changes" : "Add Investor"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
