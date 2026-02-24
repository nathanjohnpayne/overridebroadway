import type { DealInputs } from "./deal";
import type { ProductionStatus } from "./production";

/**
 * Configuration for what the producer wants to expose in the Deal Room.
 * All sections default to false — producer opts in per section.
 */
export interface DealRoomConfig {
  showFinancialModel: boolean;     // Bear / Base / Bull scenario cards
  showWaterfall: boolean;          // Waterfall distribution visualization
  showCapitalizationProgress: boolean; // % raised bar (aggregate only — no individual investor data)
  showDocuments: boolean;          // Links to uploaded docs (PPM, operating agreement, etc.)
  showWeeklyBreakdown: boolean;    // Per-week earnings table (Base scenario only)
  producerNote?: string;           // Optional free-form note from producer (max 500 chars)
}

/**
 * A snapshot of production data shared with investors via a unique token URL.
 *
 * The token is the Firestore document ID — knowing the token grants read access.
 * Individual investor data is NEVER stored here — only aggregate deal economics.
 *
 * Data is snapshotted at share time; edits to DealInputs after sharing do NOT
 * automatically update the deal room (producer must re-share or update explicitly).
 */
export interface DealRoom {
  /** Firestore document ID — also serves as the share token (UUID v4) */
  id: string;

  /** The production this deal room represents */
  productionId: string;

  /** UID of the producer who created this deal room */
  ownedByUserId: string;

  /** Snapshot of production metadata at share time */
  production: {
    name: string;
    subtitle?: string;
    venue?: string;
    status: ProductionStatus;
    artworkUrl?: string;
    showUrl?: string;
    // Document URLs (Firebase Storage signed URLs — publicly accessible)
    investorInstructionLetterUrl?: string;
    memberSignaturePageUrl?: string;
    subscriptionAgreementUrl?: string;
    operatingAgreementUrl?: string;
    investorInstructionLetterName?: string;
    memberSignaturePageName?: string;
    subscriptionAgreementName?: string;
    operatingAgreementName?: string;
  };

  /** Snapshot of deal inputs at share time — used to run scenarios for investors */
  dealInputs: DealInputs;

  /** Producer-controlled display configuration */
  config: DealRoomConfig;

  /** When false, the deal room URL returns a 404-equivalent (rule blocks read) */
  isActive: boolean;

  /** Firestore server timestamp (serialized as ISO string after fetch) */
  createdAt: Date;
  updatedAt: Date;

  /** Optional expiry — if set, producer should deactivate after this date */
  expiresAt?: Date;
}

/**
 * Subset of DealRoom for creating a new deal room (omit server-generated fields).
 */
export type CreateDealRoomPayload = Omit<DealRoom, "id" | "createdAt" | "updatedAt">;

/**
 * Fields that can be updated after creation.
 */
export type UpdateDealRoomPayload = Partial<
  Pick<DealRoom, "config" | "isActive" | "expiresAt" | "dealInputs" | "production">
>;

/**
 * Default deal room configuration — conservative defaults.
 * Producer enables sections explicitly.
 */
export const DEFAULT_DEAL_ROOM_CONFIG: DealRoomConfig = {
  showFinancialModel: true,
  showWaterfall: true,
  showCapitalizationProgress: false,
  showDocuments: false,
  showWeeklyBreakdown: false,
  producerNote: "",
};
