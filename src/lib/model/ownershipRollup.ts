import type { CapitalizationInvestor, ProducerPool } from "@/types/capitalization";

export interface PoolOwnership {
  pool: ProducerPool;
  investors: CapitalizationInvestor[];
  totalCommitted: number;
  totalFunded: number;
  poolOwnershipPercent: number; // totalCommitted / totalCapitalization
  investorCount: number;
}

export interface OwnershipRollup {
  totalCapitalization: number;
  totalCommitted: number;
  totalFunded: number;
  remainingRaise: number;
  investorCount: number;
  pools: PoolOwnership[];
  unassigned: CapitalizationInvestor[]; // investors not yet assigned to any pool
}

/**
 * Compute ownership rollup from subscriptions.
 * Ownership % is always derived from amountCommitted / totalCapitalization —
 * never from the stored ownershipPercent field.
 */
export function computeOwnershipRollup(
  investors: CapitalizationInvestor[],
  pools: ProducerPool[],
  totalCapitalization: number
): OwnershipRollup {
  const totalCommitted = investors.reduce((s, i) => s + (i.amountCommitted || 0), 0);
  const totalFunded = investors.reduce((s, i) => s + (i.amountFunded || 0), 0);

  // Build a map from poolId → investors in that pool
  const poolMap = new Map<string, CapitalizationInvestor[]>();
  for (const pool of pools) {
    poolMap.set(pool.id, []);
  }

  const unassigned: CapitalizationInvestor[] = [];
  for (const inv of investors) {
    if (inv.producerPoolId && poolMap.has(inv.producerPoolId)) {
      poolMap.get(inv.producerPoolId)!.push(inv);
    } else {
      unassigned.push(inv);
    }
  }

  const poolOwnership: PoolOwnership[] = pools.map((pool) => {
    const members = poolMap.get(pool.id) ?? [];
    const poolCommitted = members.reduce((s, i) => s + (i.amountCommitted || 0), 0);
    const poolFunded = members.reduce((s, i) => s + (i.amountFunded || 0), 0);
    return {
      pool,
      investors: members,
      totalCommitted: poolCommitted,
      totalFunded: poolFunded,
      poolOwnershipPercent: totalCapitalization > 0 ? poolCommitted / totalCapitalization : 0,
      investorCount: members.length,
    };
  });

  return {
    totalCapitalization,
    totalCommitted,
    totalFunded,
    remainingRaise: totalCapitalization - totalCommitted,
    investorCount: investors.length,
    pools: poolOwnership,
    unassigned,
  };
}
