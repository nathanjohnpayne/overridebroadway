"use client";

import { Controller } from "react-hook-form";
import type { Control, UseFormWatch, UseFormSetValue } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PercentInput, InfoTip } from "../shared/FormFields";
import type { DealInputs } from "@/types/deal";
import type { ModelOutput } from "@/types/model";

interface SectionProps {
  control: Control<DealInputs>;
  watch: UseFormWatch<DealInputs>;
  setValue: UseFormSetValue<DealInputs>;
  modelOutput: ModelOutput | null;
  dealInputs: DealInputs | null;
}

export function RevenueSection({ control }: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Drivers</CardTitle>
        <CardDescription>
          House deal structure and the fees deducted from gross box office before royalties are
          calculated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              Credit Card Fee Rate
              <InfoTip>Typically 2.5–3.5% of gross box office.</InfoTip>
            </Label>
            <Controller
              name="creditCardFeeRate"
              control={control}
              render={({ field }) => (
                <PercentInput value={field.value} onChange={field.onChange} />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>
              House Percentage
              <InfoTip>Theatre&apos;s % of gross box office. Typically 5–8%.</InfoTip>
            </Label>
            <Controller
              name="housePercentage"
              control={control}
              render={({ field }) => (
                <PercentInput value={field.value} onChange={field.onChange} />
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
