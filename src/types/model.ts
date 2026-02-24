import type { DealInputs, Investor } from "./deal";

export interface WeeklyResult {
  week: number;
  isPreview: boolean;
  occupancyRate: number;
  grossBoxOffice: number;
  creditCardFees: number;
  houseDeduction: number;
  adjustedGross: number;
  totalRoyalties: number;
  royaltyBreakdown: Record<string, number>;
  netBoxOffice: number;
  weeklyNut: number;
  gpFee: number;        // GP management fee (% of profit before waterfall)
  gpFlatPayment: number; // GP flat override (weekly fixed + % of net profit, before waterfall split)
  operatingProfit: number;
  cumulativeProfit: number;
  recoupPercent: number;
  isRecouped: boolean;
  // Waterfall
  toRecoupmentPool: number;
  investorDistribution: number;
  creativeDistribution: number;
  gpDistribution: number;
}

export interface InvestorReturn {
  investor: Investor;
  investmentAmount: number;
  poolPercent: number;
  recoupmentAllocation: number;
  postRecoupDistributions: number;
  totalReceived: number;
  roi: number;
  cashOnCashMultiple: number;
  recoupWeek: number | null;
}

export interface ModelOutput {
  dealInputs: DealInputs;
  occupancyRate: number;
  weeks: WeeklyResult[];
  recoupWeek: number | null;
  totalGrossBoxOffice: number;
  totalRoyalties: number;
  totalOperatingProfit: number;
  totalInvestorDistributions: number;
  investorReturns: InvestorReturn[];
  approximateIRR: number | null;
  weeklyBreakeven: number | null;
}

export interface Scenario {
  id?: string;
  name: string;
  occupancyRate: number;
  avgTicketPrice: number;
  estimatedWeeks: number;
}

export interface ScenarioComparison {
  scenario: Scenario;
  output: ModelOutput;
}

export interface SensitivityCell {
  occupancyRate: number;
  weeks: number;
  // Recoup timing
  recoupWeek: number | null;
  recoupAchieved: boolean;
  // Investor outcome — all computed by the engine, never derived in the UI layer
  investorDistributions: number;
  investorMultiple: number;   // totalInvestorDistributions / totalCapitalization
  investorROI: number;        // (distributions - cap) / cap  — negative when partial
  // Gross summary (for tooltip)
  totalGrossBoxOffice: number;
  totalOperatingProfit: number;
}

export type SensitivityGrid = SensitivityCell[][];
