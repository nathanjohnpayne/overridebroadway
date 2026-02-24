"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProducerPool } from "@/types/capitalization";

interface PoolFormValues {
  name: string;
  allocationLimit: string;
}

interface PoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: ProducerPool | null; // null = create mode
  onSave: (data: { name: string; allocationLimit?: number }) => Promise<void>;
}

export function PoolDialog({ open, onOpenChange, pool, onSave }: PoolDialogProps) {
  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } =
    useForm<PoolFormValues>({ defaultValues: { name: "", allocationLimit: "" } });

  useEffect(() => {
    if (open) {
      reset({
        name: pool?.name ?? "",
        allocationLimit: pool?.allocationLimit?.toString() ?? "",
      });
    }
  }, [open, pool, reset]);

  async function onSubmit(values: PoolFormValues) {
    const raw = values.allocationLimit.trim();
    const allocationLimit = raw ? parseFloat(raw) : undefined;
    await onSave({ name: values.name.trim(), allocationLimit });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pool ? "Edit Producer Pool" : "New Producer Pool"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="pool-name">Pool Name *</Label>
            <Input
              id="pool-name"
              {...register("name", { required: "Pool name is required" })}
              placeholder="e.g. East Coast Investors"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pool-limit">Allocation Limit <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                id="pool-limit"
                type="number"
                min={0}
                step={1000}
                {...register("allocationLimit")}
                placeholder="Leave blank for no limit"
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">Maximum total committed amount this pool can raise.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : pool ? "Save Changes" : "Create Pool"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
