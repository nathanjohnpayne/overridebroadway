"use client";

import { Controller } from "react-hook-form";
import type { Control, UseFormWatch, UseFormSetValue } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput, PercentInput, InfoTip } from "../shared/FormFields";
import type { DealInputs } from "@/types/deal";
import type { ModelOutput } from "@/types/model";

interface SectionProps {
  control: Control<DealInputs>;
  watch: UseFormWatch<DealInputs>;
  setValue: UseFormSetValue<DealInputs>;
  modelOutput: ModelOutput | null;
  dealInputs: DealInputs | null;
}

export function WeeklyEconomicsSection({ control }: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Operating Economics</CardTitle>
        <CardDescription>House capacity, ticket pricing, and the weekly nut.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              Weekly Nut
              <InfoTip>
                Total weekly fixed costs including rent, payroll, union minimums, and marketing
                retainers.
              </InfoTip>
            </Label>
            <Controller
              name="weeklyNut"
              control={control}
              render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} placeholder="450,000" />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>
              Performances / Week
              <InfoTip>Typically 8 for a Broadway run.</InfoTip>
            </Label>
            <Input
              type="number"
              {...control.register("performances", { valueAsNumber: true })}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>House Capacity (seats)</Label>
            <Input
              type="number"
              {...control.register("capacity", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label>
              Full-Price Avg Ticket
              <InfoTip>Blended average across seat categories.</InfoTip>
            </Label>
            <Controller
              name="avgTicketPrice"
              control={control}
              render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} placeholder="125" />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>Discounted Ticket Price</Label>
            <Controller
              name="discountedTicketPrice"
              control={control}
              render={({ field }) => (
                <CurrencyInput value={field.value} onChange={field.onChange} placeholder="75" />
              )}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>
            Discount Rate
            <InfoTip>Fraction of tickets sold at discount price. 20% is typical.</InfoTip>
          </Label>
          <div className="max-w-40">
            <Controller
              name="discountRate"
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
