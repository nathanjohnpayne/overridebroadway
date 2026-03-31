"use client";

import { useEffect, useState, useCallback } from "react";
import { getDealInputs, saveDealInputs } from "@/lib/firestore";
import { toast } from "sonner";
import type { DealInputs } from "@/types/deal";

export function useDealInputs(productionId: string | null) {
  const [dealInputs, setDealInputs] = useState<DealInputs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!productionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getDealInputs(productionId)
      .then((inputs) => {
        setDealInputs(inputs);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load deal inputs:", err);
        toast.error("Failed to load deal inputs");
        setLoading(false);
      });
  }, [productionId]);

  const save = useCallback(
    async (inputs: DealInputs) => {
      if (!productionId) return;
      setSaving(true);
      try {
        await saveDealInputs(productionId, inputs);
        setDealInputs(inputs);
      } finally {
        setSaving(false);
      }
    },
    [productionId]
  );

  return { dealInputs, loading, saving, save };
}
