"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  subscribeToProducerPools,
  createProducerPool,
  updateProducerPool,
  deleteProducerPool,
  ensureDefaultPool,
  assignInvestorsToDefaultPool,
  DEFAULT_POOL_ID,
  DEFAULT_POOL_NAME,
} from "@/lib/firestore";
import type { ProducerPool } from "@/types/capitalization";

export function useProducerPools(
  productionId: string | null,
  ownerUserId: string | null
) {
  const [pools, setPools] = useState<ProducerPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
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
    // Drop the previous production's data so it can never render under this id.
    setPools([]);
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeToProducerPools(
      productionId,
      (p) => {
        setPools(p);
        setError(null);
        setLoading(false);
        // Keep defaultPoolId in sync with the "Direct Investors" pool id
        // (fixed id for new productions, auto id for legacy ones).
        const direct =
          p.find((pool) => pool.id === DEFAULT_POOL_ID) ??
          p.find((pool) => pool.name === DEFAULT_POOL_NAME);
        if (direct) setDefaultPoolId(direct.id);
      },
      (err) => {
        console.error("Failed to load producer pools:", err);
        setError(err);
        setLoading(false);
      }
    );
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

  return { pools, loading, error, defaultPoolId, add, update, remove };
}
