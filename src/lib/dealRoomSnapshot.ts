/**
 * Builders for the data a producer publishes into a public `dealRooms/{token}`
 * document.
 *
 * A deal room document is readable by anyone holding the share token, so it
 * must contain only what the producer opted into via `DealRoomConfig`:
 *
 *  - Document download URLs and file names are included only when
 *    `config.showDocuments` is true. The toggle is not just a UI switch —
 *    when it is off, the URLs are never written to the public document.
 *  - Deal inputs are copied through an explicit allowlist of model
 *    parameters. Anything else that happens to be on the loaded object
 *    (Firestore metadata, the legacy `investors` array with names and
 *    amounts) is dropped, and `investors` is always published as `[]`.
 *
 * The model parameters themselves are published in full because the
 * always-visible Deal Structure section (including Base-case breakeven
 * occupancy) is computed client-side from them via `runScenario()`.
 */

import type { DealInputs } from "@/types/deal";
import type { DealRoom, DealRoomConfig } from "@/types/dealRoom";
import type { Production } from "@/types/production";

export type DealRoomProductionSnapshot = DealRoom["production"];

/** Maximum producer note length — mirrored in firestore.rules. */
export const PRODUCER_NOTE_MAX_LENGTH = 500;

/**
 * Every DealInputs field that is a model parameter. `id` and `investors` are
 * deliberately absent. The compile-time check below fails if a new field is
 * added to DealInputs without a decision here.
 */
const DEAL_ROOM_INPUT_KEYS = [
  "totalCapitalization",
  "units",
  "unitPrice",
  "weeklyNut",
  "capacity",
  "performances",
  "avgTicketPrice",
  "discountRate",
  "discountedTicketPrice",
  "creditCardFeeRate",
  "housePercentage",
  "houseProfitsThreshold",
  "houseProfitsSplitAbove",
  "royalties",
  "royaltyBase",
  "royaltyPoolType",
  "royaltyPoolPercentage",
  "weeklyOfficeCharge",
  "gpFeeRate",
  "gpShareOfInvestorPool",
  "gpFlatWeekly",
  "gpFlatProfitPercent",
  "waterfallType",
  "hasProfitSharing",
  "postRecoupInvestorSplit",
  "runningRoyaltyOffset",
  "royaltyOffsetAmount",
  "estimatedWeeks",
  "previewWeeks",
  "openingWeek",
] as const satisfies readonly (keyof DealInputs)[];

type ExcludedDealInputKeys = "id" | "investors";
type UnclassifiedDealInputKeys = Exclude<
  keyof DealInputs,
  (typeof DEAL_ROOM_INPUT_KEYS)[number] | ExcludedDealInputKeys
>;
// If this line fails to compile, a DealInputs field was added without being
// classified as publishable (DEAL_ROOM_INPUT_KEYS) or excluded.
const _exhaustiveDealInputKeys: [UnclassifiedDealInputKeys] extends [never] ? true : never = true;
void _exhaustiveDealInputKeys;

/**
 * Returns a copy of `inputs` containing only allowlisted model parameters,
 * with `investors` forced to an empty array.
 */
export function sanitizeDealInputsForDealRoom(inputs: DealInputs): DealInputs {
  const out: Record<string, unknown> = {};
  for (const key of DEAL_ROOM_INPUT_KEYS) {
    const value = inputs[key];
    if (value !== undefined) out[key] = value;
  }
  out.investors = [];
  return out as unknown as DealInputs;
}

/**
 * Builds the production metadata snapshot for a deal room, honoring the
 * producer's `showDocuments` opt-in.
 */
export function buildDealRoomProductionSnapshot(
  production: Pick<
    Production,
    | "name"
    | "subtitle"
    | "venue"
    | "status"
    | "artworkUrl"
    | "showUrl"
    | "investorInstructionLetterUrl"
    | "investorInstructionLetterName"
    | "memberSignaturePageUrl"
    | "memberSignaturePageName"
    | "subscriptionAgreementUrl"
    | "subscriptionAgreementName"
    | "operatingAgreementUrl"
    | "operatingAgreementName"
  >,
  config: Pick<DealRoomConfig, "showDocuments">
): DealRoomProductionSnapshot {
  const snapshot: DealRoomProductionSnapshot = {
    name: production.name,
    subtitle: production.subtitle,
    venue: production.venue,
    status: production.status,
    artworkUrl: production.artworkUrl,
    showUrl: production.showUrl,
  };
  if (config.showDocuments) {
    snapshot.investorInstructionLetterUrl = production.investorInstructionLetterUrl;
    snapshot.investorInstructionLetterName = production.investorInstructionLetterName;
    snapshot.memberSignaturePageUrl = production.memberSignaturePageUrl;
    snapshot.memberSignaturePageName = production.memberSignaturePageName;
    snapshot.subscriptionAgreementUrl = production.subscriptionAgreementUrl;
    snapshot.subscriptionAgreementName = production.subscriptionAgreementName;
    snapshot.operatingAgreementUrl = production.operatingAgreementUrl;
    snapshot.operatingAgreementName = production.operatingAgreementName;
  }
  // Drop undefined values so the shape matches what Firestore stores.
  return Object.fromEntries(
    Object.entries(snapshot).filter(([, v]) => v !== undefined)
  ) as DealRoomProductionSnapshot;
}

/** Normalizes a config for publishing (clamps the producer note). */
export function normalizeDealRoomConfig(config: DealRoomConfig): DealRoomConfig {
  return {
    showFinancialModel: !!config.showFinancialModel,
    showWaterfall: !!config.showWaterfall,
    showCapitalizationProgress: !!config.showCapitalizationProgress,
    showDocuments: !!config.showDocuments,
    showWeeklyBreakdown: !!config.showWeeklyBreakdown,
    producerNote: (config.producerNote ?? "").slice(0, PRODUCER_NOTE_MAX_LENGTH),
  };
}
