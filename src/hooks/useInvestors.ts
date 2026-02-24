"use client";

import { useEffect, useState, useCallback } from "react";
import {
  subscribeToInvestors,
  createInvestor,
  updateInvestor,
  deleteInvestor,
} from "@/lib/firestore";
import type { CapitalizationInvestor } from "@/types/capitalization";

export function useInvestors(productionId: string | null) {
  const [investors, setInvestors] = useState<CapitalizationInvestor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productionId) {
      setInvestors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToInvestors(productionId, (inv) => {
      setInvestors(inv);
      setLoading(false);
    });
    return unsubscribe;
  }, [productionId]);

  const add = useCallback(
    async (
      data: Omit<CapitalizationInvestor, "id" | "productionId" | "createdAt" | "updatedAt">
    ): Promise<string> => {
      if (!productionId) throw new Error("No productionId");
      return createInvestor(productionId, { ...data, productionId });
    },
    [productionId]
  );

  const update = useCallback(
    async (
      investorId: string,
      data: Partial<Omit<CapitalizationInvestor, "id" | "productionId" | "createdAt">>
    ): Promise<void> => {
      if (!productionId) return;
      return updateInvestor(productionId, investorId, data);
    },
    [productionId]
  );

  const remove = useCallback(
    async (investorId: string): Promise<void> => {
      if (!productionId) return;
      return deleteInvestor(productionId, investorId);
    },
    [productionId]
  );

  return { investors, loading, add, update, remove };
}
