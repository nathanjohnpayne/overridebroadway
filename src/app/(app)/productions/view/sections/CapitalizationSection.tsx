"use client";

import { Controller } from "react-hook-form";
import type { Control, UseFormWatch, UseFormSetValue } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CurrencyInput, InfoTip } from "../shared/FormFields";
import type { DealInputs } from "@/types/deal";
import type { ModelOutput } from "@/types/model";

interface SectionProps {
  control: Control<DealInputs>;
  watch: UseFormWatch<DealInputs>;
  setValue: UseFormSetValue<DealInputs>;
  modelOutput: ModelOutput | null;
  dealInputs: DealInputs | null;
}

export function CapitalizationSection({ control, watch }: SectionProps) {
  const watchedCap = watch("totalCapitalization");
  const watchedUnitPrice = watch("unitPrice");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capitalization</CardTitle>
        <CardDescription>Total capital raised and investor breakdown.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>
              Total Capitalization
              <InfoTip>Total amount raised from all limited partners.</InfoTip>
            </Label>
            <Controller
              name="totalCapitalization"
              control={control}
              render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} placeholder="2,000,000" />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>
              Unit Price
              <InfoTip>Price per LP unit. Total units auto-calculate from cap ÷ unit price.</InfoTip>
            </Label>
            <Controller
              name="unitPrice"
              control={control}
              render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} placeholder="25,000" />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Total Units{" "}
              <span className="text-xs text-muted-foreground font-normal">(auto)</span>
            </Label>
            <div className="h-10 flex items-center px-3 rounded-md border bg-muted/40 text-sm font-mono">
              {watchedCap > 0 && watchedUnitPrice > 0 ? (
                Math.round(watchedCap / watchedUnitPrice).toLocaleString()
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
