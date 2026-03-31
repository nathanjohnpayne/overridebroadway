"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  subscribeToProducerPools,
  createProducerPool,
  updateProducerPool,
  deleteProducerPool,
  ensureDefaultPool,
  assignInvestorsToDefaultPool,
} from "@/lib/firestore";
import type { ProducerPool } from "@/types/capitalization";

export function useProducerPools(
  productionId: string | null,
  ownerUserId: string | null
) {
  const [pools, setPools] = useState<ProducerPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultPoolId, setDefaultPoolId] = useState<string | null>(null);
  const bootstrapped = useRef(false);

  // Lazy migration: create default pool + assign legacy investors once per mount
  useEffect(() => {
    if (!productionId || !ownerUserId || bootstrapped.current) return;
    bootstrapped.current = true;
    ensureDefaultPool(productionId, ownerUserId)
      .then((poolId) => {
        setDefaultPoolId(poolId);
        return assignInvestorsToDefaultPool(productionId, poolId);
      })
      .catch((err) => {
        console.error("Producer pool bootstrap failed:", err);
      });
  }, [productionId, ownerUserId]);

  // Real-time subscription to pools
  useEffect(() => {
    if (!productionId) {
      setPools([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToProducerPools(productionId, (p) => {
      setPools(p);
      setLoading(false);
      // Keep defaultPoolId in sync with the "Direct Investors" pool id
      const direct = p.find((pool) => pool.name === "Direct Investors");
      if (direct) setDefaultPoolId(direct.id);
    });
    return unsubscribe;
  }, [productionId]);

  const add = useCallback(
    async (data: Omit<ProducerPool, "id" | "createdAt" | "updatedAt">): Promise<string> => {
      if (!productionId) throw new Error("No productionId");
      return createProducerPool(productionId, data);
    },
    [productionId]
  );

  const update = useCallback(
    async (
      poolId: string,
      data: Partial<Omit<ProducerPool, "id" | "productionId" | "createdAt">>
    ): Promise<void> => {
      if (!productionId) return;
      return updateProducerPool(productionId, poolId, data);
    },
    [productionId]
  );

  const remove = useCallback(
    async (poolId: string): Promise<void> => {
      if (!productionId) return;
      return deleteProducerPool(productionId, poolId);
    },
    [productionId]
  );

  return { pools, loading, defaultPoolId, add, update, remove };
}
