import type { DealInputs, Royalties, RoyaltyPoolType, RoyaltyBase } from "@/types/deal";
import type { WeeklyResult } from "@/types/model";

export function calculateWeeklyGross(
  capacity: number,
  occupancyRate: number,
  avgTicketPrice: number,
  discountRate: number,
  discountedTicketPrice: number,
  performances: number
): number {
  const ticketsSold = capacity * performances * occupancyRate;
  const fullPriceTickets = ticketsSold * (1 - discountRate);
  const discountTickets = ticketsSold * discountRate;
  return fullPriceTickets * avgTicketPrice + discountTickets * discountedTicketPrice;
}

export function calculateAdjustedGross(
  grossBoxOffice: number,
  creditCardFeeRate: number,
  housePercentage: number,
  houseProfitsThreshold?: number,
  houseProfitsSplitAbove?: number
): { adjustedGross: number; creditCardFees: number; houseDeduction: number } {
  const creditCardFees = grossBoxOffice * creditCardFeeRate;
  let houseDeduction = grossBoxOffice * housePercentage;

  if (houseProfitsThreshold != null && houseProfitsSplitAbove != null) {
    const aboveThreshold = Math.max(0, grossBoxOffice - houseProfitsThreshold);
    houseDeduction += aboveThreshold * houseProfitsSplitAbove;
  }

  const adjustedGross = grossBoxOffice - creditCardFees - houseDeduction;
  return { adjustedGross, creditCardFees, houseDeduction };
}

function distributeRoyaltyPool(
  poolTotal: number,
  royalties: Royalties
): { totalRoyalties: number; breakdown: Record<string, number> } {
  // Sum all non-zero rates to get proportional weights
  const entries = Object.entries(royalties) as [keyof Royalties, number][];
  const totalWeight = entries.reduce((s, [, rate]) => s + rate, 0);

  if (totalWeight === 0) {
    return { totalRoyalties: 0, breakdown: {} };
  }

  const breakdown: Record<string, number> = {};
  for (const [key, rate] of entries) {
    breakdown[key] = (rate / totalWeight) * poolTotal;
  }
  return { totalRoyalties: poolTotal, breakdown };
}

export function calculateRoyalties(
  adjustedGross: number,
  netBoxOffice: number,
  royalties: Royalties,
  royaltyBase: RoyaltyBase,
  royaltyPoolType: RoyaltyPoolType,
  royaltyPoolPercentage: number | undefined,
  isRecouped: boolean,
  runningRoyaltyOffset: boolean,
  royaltyOffsetAmount: number | undefined
): { totalRoyalties: number; breakdown: Record<string, number> } {
  // The royalty offset is a fixed weekly dollar amount subtracted from the gross
  // royalty obligation during recoupment only. It reduces what royalty participants
  // receive pre-recoup, improving weekly profit available to investors. It does NOT
  // affect post-recoup creative participation percentages.
  const weeklyOffset = !isRecouped && runningRoyaltyOffset ? (royaltyOffsetAmount ?? 0) : 0;

  if (royaltyPoolType === "pool" && royaltyPoolPercentage != null) {
    const poolGross = adjustedGross * royaltyPoolPercentage;
    const poolTotal = Math.max(0, poolGross - weeklyOffset);
    return distributeRoyaltyPool(poolTotal, royalties);
  }

  const base = royaltyBase === "adjusted_gross" ? adjustedGross : netBoxOffice;
  const breakdown: Record<string, number> = {};
  let total = 0;

  for (const [key, rate] of Object.entries(royalties)) {
    const amount = base * (rate as number);
    breakdown[key] = amount;
    total += amount;
  }

  // Subtract the fixed offset from the total royalty bill, floor at zero
  const offsetTotal = Math.max(0, total - weeklyOffset);
  // Scale each participant's share proportionally so they still sum to offsetTotal
  const scale = total > 0 ? offsetTotal / total : 1;
  for (const key of Object.keys(breakdown)) {
    breakdown[key] = breakdown[key] * scale;
  }

  return { totalRoyalties: offsetTotal, breakdown };
}

export function calculateWaterfallAllocation(
  operatingProfit: number,
  cumulativeProfitBeforeThisWeek: number,
  totalCapitalization: number,
  waterfallType: "recoup_first" | "share_from_dollar_one",
  postRecoupInvestorSplit: number,
  gpShareOfInvestorPool: number
): {
  toRecoupmentPool: number;
  investorDistribution: number;
  creativeDistribution: number;
  gpDistribution: number;
} {
  if (operatingProfit <= 0) {
    return {
      toRecoupmentPool: operatingProfit,
      investorDistribution: 0,
      creativeDistribution: 0,
      gpDistribution: 0,
    };
  }

  const creativeParticipantSplit = 1 - postRecoupInvestorSplit;
  const isCurrentlyRecouped = cumulativeProfitBeforeThisWeek >= totalCapitalization;

  if (waterfallType === "recoup_first") {
    if (isCurrentlyRecouped) {
      const investorPool = operatingProfit * postRecoupInvestorSplit;
      const gpShare = investorPool * gpShareOfInvestorPool;
      return {
        toRecoupmentPool: 0,
        investorDistribution: investorPool - gpShare,
        creativeDistribution: operatingProfit * creativeParticipantSplit,
        gpDistribution: gpShare,
      };
    }

    const remainingToRecoup = totalCapitalization - cumulativeProfitBeforeThisWeek;

    if (operatingProfit <= remainingToRecoup) {
      return {
        toRecoupmentPool: operatingProfit,
        investorDistribution: 0,
        creativeDistribution: 0,
        gpDistribution: 0,
      };
    }

    // Crosses recoupment threshold this week
    const toRecoup = remainingToRecoup;
    const postRecoupProfit = operatingProfit - remainingToRecoup;
    const investorPool = postRecoupProfit * postRecoupInvestorSplit;
    const gpShare = investorPool * gpShareOfInvestorPool;

    return {
      toRecoupmentPool: toRecoup,
      investorDistribution: investorPool - gpShare,
      creativeDistribution: postRecoupProfit * creativeParticipantSplit,
      gpDistribution: gpShare,
    };
  }

  // share_from_dollar_one: distributions flow simultaneously with recoupment
  const investorPool = operatingProfit * postRecoupInvestorSplit;
  const gpShare = investorPool * gpShareOfInvestorPool;
  return {
    toRecoupmentPool: investorPool,
    investorDistribution: investorPool - gpShare,
    creativeDistribution: operatingProfit * creativeParticipantSplit,
    gpDistribution: gpShare,
  };
}

export function calculateWeeklyResult(
  deal: DealInputs,
  weekNumber: number,
  occupancyRate: number,
  cumulativeProfitBeforeThisWeek: number
): WeeklyResult {
  const isPreview = weekNumber <= deal.previewWeeks;
  const isRecouped = cumulativeProfitBeforeThisWeek >= deal.totalCapitalization;

  const grossBoxOffice = calculateWeeklyGross(
    deal.capacity,
    occupancyRate,
    deal.avgTicketPrice,
    deal.discountRate,
    deal.discountedTicketPrice,
    deal.performances
  );

  const { adjustedGross, creditCardFees, houseDeduction } = calculateAdjustedGross(
    grossBoxOffice,
    deal.creditCardFeeRate,
    deal.housePercentage,
    deal.houseProfitsThreshold,
    deal.houseProfitsSplitAbove
  );

  const preliminaryNet = adjustedGross - deal.weeklyNut;

  const { totalRoyalties, breakdown: royaltyBreakdown } = calculateRoyalties(
    adjustedGross,
    preliminaryNet,
    deal.royalties,
    deal.royaltyBase,
    deal.royaltyPoolType,
    deal.royaltyPoolPercentage,
    isRecouped,
    deal.runningRoyaltyOffset,
    deal.royaltyOffsetAmount
  );

  const netBoxOffice = adjustedGross - totalRoyalties;
  // weeklyNut includes all operating costs (including any office charge).
  const profitBeforeFees = netBoxOffice - deal.weeklyNut;

  // GP management fee: % of positive profit before waterfall split
  const gpFee = profitBeforeFees > 0 ? profitBeforeFees * deal.gpFeeRate : 0;
  const profitAfterGpFee = profitBeforeFees - gpFee;

  // GP flat overrides: fixed weekly + optional % of net profit, applied before waterfall
  // Only applied when there is positive distributable profit
  const gpFlatFixed = (profitAfterGpFee > 0 && deal.gpFlatWeekly) ? Math.min(deal.gpFlatWeekly, profitAfterGpFee) : 0;
  const profitAfterFlatFixed = profitAfterGpFee - gpFlatFixed;
  const gpFlatProfit = (profitAfterFlatFixed > 0 && deal.gpFlatProfitPercent) ? profitAfterFlatFixed * deal.gpFlatProfitPercent : 0;
  const gpFlatPayment = gpFlatFixed + gpFlatProfit;

  // Distributable profit enters the waterfall after all GP deductions
  const operatingProfit = profitAfterGpFee - gpFlatPayment;

  // When hasProfitSharing is false, investors receive 0% post-recoup (no profit share)
  const effectiveInvestorSplit = (deal.hasProfitSharing ?? true) ? deal.postRecoupInvestorSplit : 0;

  const waterfall = calculateWaterfallAllocation(
    operatingProfit,
    cumulativeProfitBeforeThisWeek,
    deal.totalCapitalization,
    deal.waterfallType,
    effectiveInvestorSplit,
    deal.gpShareOfInvestorPool
  );

  const cumulativeProfit = cumulativeProfitBeforeThisWeek + operatingProfit;
  const recoupPercent = Math.min(
    1,
    Math.max(0, cumulativeProfit / deal.totalCapitalization)
  );
  const nowRecouped = cumulativeProfit >= deal.totalCapitalization;

  return {
    week: weekNumber,
    isPreview,
    occupancyRate,
    grossBoxOffice,
    creditCardFees,
    houseDeduction,
    adjustedGross,
    totalRoyalties,
    royaltyBreakdown,
    netBoxOffice,
    weeklyNut: deal.weeklyNut,
    gpFee,
    gpFlatPayment,
    operatingProfit,
    cumulativeProfit,
    recoupPercent,
    isRecouped: nowRecouped,
    toRecoupmentPool: waterfall.toRecoupmentPool,
    investorDistribution: waterfall.investorDistribution,
    creativeDistribution: waterfall.creativeDistribution,
    gpDistribution: waterfall.gpDistribution,
  };
}

export function calculateIRR(
  initialInvestment: number,
  weeklyDistributions: number[]
): number | null {
  if (weeklyDistributions.every((d) => d === 0)) return null;

  let rate = 0.1 / 52; // initial guess: ~10% annual in weekly terms

  for (let iteration = 0; iteration < 1000; iteration++) {
    let npv = -initialInvestment;
    let dnpv = 0;

    weeklyDistributions.forEach((cf, t) => {
      const discount = Math.pow(1 + rate, t + 1);
      npv += cf / discount;
      dnpv -= ((t + 1) * cf) / (discount * (1 + rate));
    });

    if (Math.abs(npv) < 0.01) break;
    if (Math.abs(dnpv) < 1e-10) return null;

    const newRate = rate - npv / dnpv;
    if (newRate < -1) return null;
    rate = newRate;
  }

  // Convert weekly rate to annual
  return Math.pow(1 + rate, 52) - 1;
}

export function calculateWeeklyBreakeven(deal: DealInputs): number | null {
  // Find the occupancy at which weekly operating profit = 0
  // Binary search between 0% and 150% occupancy
  let low = 0;
  let high = 1.5;

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const result = calculateWeeklyResult(deal, deal.openingWeek, mid, 0);
    if (Math.abs(result.operatingProfit) < 10) return mid;
    if (result.operatingProfit < 0) low = mid;
    else high = mid;
  }

  return (low + high) / 2;
}
