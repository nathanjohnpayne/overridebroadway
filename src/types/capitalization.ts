export type InvestorStatus =
  | "invited"
  | "docs_sent"
  | "signed"
  | "funded"
  | "admitted";

export type ProductionRoleType = "Producer" | "Investor";

export interface ProducerPool {
  id: string;
  productionId: string;
  ownerUserId: string;        // UID of the producer managing this pool
  name: string;
  allocationLimit?: number;   // optional cap on total committed to this pool
  createdAt: Date;
  updatedAt: Date;
}

export interface CapitalizationInvestor {
  id: string;
  productionId: string;
  producerPoolId?: string;    // which pool this investor belongs to
  // Identity
  name: string;
  email: string;
  phone?: string;
  address?: string;
  // Investment
  shares: number;
  amountCommitted: number;
  amountFunded: number;
  ownershipPercent: number; // stored; computed as amountCommitted / totalCapitalization before save
  status: InvestorStatus;
  notes?: string;
  isPersonalInvestment?: boolean; // user has flagged this as their own investment
  // Per-investor document URLs (all optional)
  // Distributed to investor:
  distributedInstructionLetterUrl?: string;
  distributedSignaturePageUrl?: string;
  distributedSubscriptionAgreementUrl?: string;
  // Signed by investor:
  signedSignaturePageUrl?: string;
  signedSubscriptionAgreementUrl?: string;
  // Fully executed (countersigned):
  executedSignaturePageUrl?: string;
  executedSubscriptionAgreementUrl?: string;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
