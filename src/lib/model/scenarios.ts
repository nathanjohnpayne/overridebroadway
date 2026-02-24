import type { DealInputs } from "@/types/deal";
import type {
  ModelOutput,
  WeeklyResult,
  Scenario,
  SensitivityGrid,
  InvestorReturn,
} from "@/types/model";
import {
  calculateWeeklyResult,
  calculateIRR,
  calculateWeeklyBreakeven,
} from "./calculations";

export function runScenario(deal: DealInputs, scenario: Scenario): ModelOutput {
  const scenarioDeal: DealInputs = {
    ...deal,
    avgTicketPrice: scenario.avgTicketPrice,
    estimatedWeeks: scenario.estimatedWeeks,
  };

  const weeks: WeeklyResult[] = [];
  let cumulativeProfit = 0;

  for (let week = 1; week <= scenarioDeal.estimatedWeeks; week++) {
    const result = calculateWeeklyResult(
      scenarioDeal,
      week,
      scenario.occupancyRate,
      cumulativeProfit
    );
    cumulativeProfit = result.cumulativeProfit;
    weeks.push(result);
  }

  const recoupWeek = weeks.find((w) => w.isRecouped)?.week ?? null;

  // Per-investor returns
  // poolPercent is always relative to totalCapitalization so partial investor lists
  // (e.g. just your own block) produce accurate pro-rata returns against the full cap.
  const cap = deal.totalCapitalization;
  const investorReturns: InvestorReturn[] = deal.investors.map((investor) => {
    const poolPercent = cap > 0 ? investor.amount / cap : 0;

    let recoupmentAllocation = 0;
    let postRecoupDistributions = 0;
    let investorCumulative = 0;
    let recoupWeekForInvestor: number | null = null;

    for (const week of weeks) {
      const investorRecoup = week.toRecoupmentPool > 0
        ? week.toRecoupmentPool * poolPercent
        : 0;
      const investorDist = week.investorDistribution * poolPercent;

      recoupmentAllocation += investorRecoup;
      postRecoupDistributions += investorDist;
      investorCumulative += investorRecoup + investorDist;

      if (recoupWeekForInvestor === null && investorCumulative >= investor.amount) {
        recoupWeekForInvestor = week.week;
      }
    }

    const totalReceived = recoupmentAllocation + postRecoupDistributions;
    const roi = investor.amount > 0 ? (totalReceived - investor.amount) / investor.amount : 0;
    const cashOnCashMultiple = investor.amount > 0 ? totalReceived / investor.amount : 0;

    return {
      investor,
      investmentAmount: investor.amount,
      poolPercent,
      recoupmentAllocation,
      postRecoupDistributions,
      totalReceived,
      roi,
      cashOnCashMultiple,
      recoupWeek: recoupWeekForInvestor,
    };
  });

  const totalInvestorDistributions = weeks.reduce(
    (s, w) => s + w.investorDistribution,
    0
  );

  // Overall IRR modeled against the full capitalization (the whole investor pool)
  const poolWeeklyDists = weeks.map((w) => w.investorDistribution);
  const approximateIRR = cap > 0
    ? calculateIRR(cap, poolWeeklyDists)
    : null;

  const weeklyBreakeven = calculateWeeklyBreakeven(scenarioDeal);

  return {
    dealInputs: scenarioDeal,
    occupancyRate: scenario.occupancyRate,
    weeks,
    recoupWeek,
    totalGrossBoxOffice: weeks.reduce((s, w) => s + w.grossBoxOffice, 0),
    totalRoyalties: weeks.reduce((s, w) => s + w.totalRoyalties, 0),
    totalOperatingProfit: weeks.reduce((s, w) => s + w.operatingProfit, 0),
    totalInvestorDistributions,
    investorReturns,
    approximateIRR,
    weeklyBreakeven,
  };
}

export function generateSensitivityGrid(
  deal: DealInputs,
  occupancyRates: number[],
  weekCounts: number[]
): SensitivityGrid {
  const cap = deal.totalCapitalization;

  return occupancyRates.map((occ) =>
    weekCounts.map((weeks) => {
      const output = runScenario(deal, {
        name: "",
        occupancyRate: occ,
        avgTicketPrice: deal.avgTicketPrice,
        estimatedWeeks: weeks,
      });

      const dist = output.totalInvestorDistributions;
      // Multiple and ROI computed here in the engine — never re-derived in the UI layer.
      // When cap === 0 fall back to 0 to avoid division by zero.
      const investorMultiple = cap > 0 ? dist / cap : 0;
      const investorROI      = cap > 0 ? (dist - cap) / cap : 0;

      return {
        occupancyRate:         occ,
        weeks,
        recoupWeek:            output.recoupWeek,
        recoupAchieved:        output.recoupWeek !== null,
        investorDistributions: dist,
        investorMultiple,
        investorROI,
        totalGrossBoxOffice:   output.totalGrossBoxOffice,
        totalOperatingProfit:  output.totalOperatingProfit,
      };
    })
  );
}

export const DEFAULT_SCENARIOS: Scenario[] = [
  { name: "Bear", occupancyRate: 0.6, avgTicketPrice: 100, estimatedWeeks: 20 },
  { name: "Base", occupancyRate: 0.75, avgTicketPrice: 115, estimatedWeeks: 36 },
  { name: "Bull", occupancyRate: 0.9, avgTicketPrice: 135, estimatedWeeks: 52 },
];
