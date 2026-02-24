"use client";

/**
 * Shared form field primitives used across all Deal Builder sections.
 * These are lifted from ProductionHubClient.tsx so section components
 * can import them without coupling to the parent.
 */

import { useState, useEffect } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── InfoTip ─────────────────────────────────────────────────────────────────

export function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-xs">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── PercentInput ─────────────────────────────────────────────────────────────
// Displays decimal (0–1) as a percentage string (0.00–100.00 %).
// Stores and fires changes as decimal.

export function PercentInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [raw, setRaw] = useState(() => (value * 100).toFixed(2));

  useEffect(() => {
    setRaw((value * 100).toFixed(2));
  }, [value]);

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={(e) => {
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
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
        %
      </span>
    </div>
  );
}

// ─── CurrencyInput ───────────────────────────────────────────────────────────
// Displays a plain number as a comma-formatted dollar value.
// Stores and fires changes as a raw number.

function formatWithCommas(n: number): string {
  return n.toLocaleString("en-US");
}

export function CurrencyInput({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(() => (value ? formatWithCommas(value) : ""));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setRaw(value ? formatWithCommas(value) : "");
    }
  }, [value, focused]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
        $
      </span>
      <Input
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d,]/g, "");
          setRaw(v);
          const parsed = parseFloat(v.replace(/,/g, ""));
          if (!isNaN(parsed)) onChange(parsed);
        }}
        onFocus={() => {
          setFocused(true);
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
