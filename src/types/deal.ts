export interface Investor {
  id: string;
  name: string;
  amount: number;
  units: number;
}

export interface Royalties {
  author: number;
  music: number;
  lyricist: number;
  director: number;
  choreographer: number;
  setDesigner: number;
  costumeDesigner: number;
  lightingDesigner: number;
  soundDesigner: number;
  starParticipation: number;
  productionCompany: number;
}

export type RoyaltyPoolType = "fixed" | "pool";
export type WaterfallType = "recoup_first" | "share_from_dollar_one";
export type RoyaltyBase = "adjusted_gross" | "net";

export interface DealInputs {
  id?: string;

  // Capitalization
  totalCapitalization: number;
  units: number;
  unitPrice: number;
  investors: Investor[];

  // Weekly operations
  weeklyNut: number;
  capacity: number;
  performances: number;
  avgTicketPrice: number;
  discountRate: number;
  discountedTicketPrice: number;

  // Revenue splits
  creditCardFeeRate: number;
  housePercentage: number;
  houseProfitsThreshold?: number;
  houseProfitsSplitAbove?: number;

  // Royalties
  royalties: Royalties;
  royaltyBase: RoyaltyBase;
  royaltyPoolType: RoyaltyPoolType;
  royaltyPoolPercentage?: number;

  // Office & fees
  weeklyOfficeCharge: number;
  gpFeeRate: number;         // % of weekly operating profit taken as GP management fee (before waterfall)
  gpShareOfInvestorPool: number; // GP's carved % of the investor distribution pool (post-recoup)

  // GP flat overrides (optional, applied before waterfall)
  gpFlatWeekly?: number;        // Fixed weekly dollar payment to GP (before profit-sharing split)
  gpFlatProfitPercent?: number; // Fixed % of net operating profit to GP (before profit-sharing split)

  // Waterfall
  waterfallType: WaterfallType;
  hasProfitSharing: boolean; // Whether investors receive a post-recoup profit share at all
  postRecoupInvestorSplit: number; // Investors' % of distributable profit post-recoup (hasProfitSharing must be true)
  runningRoyaltyOffset: boolean;
  royaltyOffsetAmount?: number; // Fixed weekly dollar amount subtracted from royalty obligation during recoupment

  // Run parameters
  estimatedWeeks: number;
  previewWeeks: number;
  openingWeek: number;
}

export const DEFAULT_DEAL_INPUTS: DealInputs = {
  totalCapitalization: 2000000,
  units: 100,
  unitPrice: 20000,
  investors: [],

  weeklyNut: 450000,
  capacity: 1200,
  performances: 8,
  avgTicketPrice: 125,
  discountRate: 0.2,
  discountedTicketPrice: 75,

  creditCardFeeRate: 0.03,
  housePercentage: 0.06,
  houseProfitsThreshold: undefined,
  houseProfitsSplitAbove: undefined,

  royalties: {
    author: 0.045,      // Book writer: 4.5% of adjusted gross (APC standard)
    music: 0.03,        // Composer: 3.0% (shares pool with lyricist)
    lyricist: 0.0225,   // Lyricist: 2.25% (1/2 of composer rate in typical splits)
    director: 0.02,     // Director: 2.0%
    choreographer: 0.015, // Choreographer: 1.5%
    setDesigner: 0.005,   // Set designer: 0.5%
    costumeDesigner: 0.005,
    lightingDesigner: 0.005,
    soundDesigner: 0.005,
    starParticipation: 0, // Star/name talent overage, deal-specific
    productionCompany: 0.01, // Production company royalty: 1.0%
  },
  royaltyBase: "adjusted_gross",
  royaltyPoolType: "fixed",
  royaltyPoolPercentage: undefined,

  weeklyOfficeCharge: 0,
  gpFeeRate: 0,
  gpShareOfInvestorPool: 0.1,
  gpFlatWeekly: undefined,
  gpFlatProfitPercent: undefined,

  waterfallType: "recoup_first",
  hasProfitSharing: true,
  postRecoupInvestorSplit: 0.5,
  runningRoyaltyOffset: false,
  royaltyOffsetAmount: 3500,

  estimatedWeeks: 52,
  previewWeeks: 4,
  openingWeek: 5,
};
