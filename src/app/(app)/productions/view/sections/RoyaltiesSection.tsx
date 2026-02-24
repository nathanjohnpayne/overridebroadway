"use client";

import { Controller } from "react-hook-form";
import type { Control, UseFormWatch, UseFormSetValue } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export function RoyaltiesSection({ control, watch }: SectionProps) {
  const watchedRoyaltyPoolType = watch("royaltyPoolType");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Royalties &amp; Fees</CardTitle>
        <CardDescription>
          Creative royalties paid from adjusted gross box office, and optional royalty pool
          arrangement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pool arrangement toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Pool Arrangement</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, a single pool % is split among all participants proportionally.
            </p>
          </div>
          <Controller
            name="royaltyPoolType"
            control={control}
            render={({ field }) => (
              <Switch
                checked={field.value === "pool"}
                onCheckedChange={(v) => field.onChange(v ? "pool" : "fixed")}
              />
            )}
          />
        </div>

        {watchedRoyaltyPoolType === "pool" && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <Label>
              Pool % of Adjusted Gross
              <InfoTip>
                APC royalty pool: this % is divided among all participants proportionally by their
                relative rates.
              </InfoTip>
            </Label>
            <div className="max-w-40">
              <Controller
                name="royaltyPoolPercentage"
                control={control}
                render={({ field }) => (
                  <PercentInput value={field.value ?? 0.06} onChange={field.onChange} />
                )}
              />
            </div>
          </div>
        )}

        {/* Individual royalty rates */}
        <div>
          <h3 className="font-medium text-sm mb-3">
            {watchedRoyaltyPoolType === "pool"
              ? "Participant Shares (relative weights for pool allocation)"
              : "Individual Royalty Rates (% of adjusted gross)"}
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {(
              [
                ["author", "Book/Author", "Typically 4–5%"],
                ["music", "Music", "Typically 4–5%"],
                ["lyricist", "Lyrics", "Typically 4–5%"],
                ["director", "Director", "Typically 2–3%"],
                ["choreographer", "Choreographer", "Typically 1.5–2%"],
                ["setDesigner", "Set Designer", "Typically 0.5–0.75%"],
                ["costumeDesigner", "Costume Designer", "Typically 0.5–0.75%"],
                ["lightingDesigner", "Lighting Designer", "Typically 0.5–0.75%"],
                ["soundDesigner", "Sound Designer", "Typically 0.5–0.75%"],
                ["starParticipation", "Star Participation", "0% if none"],
                ["productionCompany", "Production Company", "Typically 1–2%"],
              ] as const
            ).map(([key, label, tip]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">
                  {label}
                  <InfoTip>{tip}</InfoTip>
                </Label>
                <Controller
                  name={`royalties.${key}`}
                  control={control}
                  render={({ field }) => (
                    <PercentInput value={field.value} onChange={field.onChange} />
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
