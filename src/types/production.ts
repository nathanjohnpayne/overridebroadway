export type ProductionStatus = "development" | "preview" | "open" | "closed";

export interface Production {
  id: string;
  userId: string;
  name: string;
  subtitle?: string;
  venue?: string;
  status: ProductionStatus;
  showUrl?: string;
  artworkUrl?: string;
  // Documents — in display order
  investorInstructionLetterUrl?: string;
  investorInstructionLetterName?: string;
  memberSignaturePageUrl?: string;
  memberSignaturePageName?: string;
  subscriptionAgreementUrl?: string;
  subscriptionAgreementName?: string;
  operatingAgreementUrl?: string;
  operatingAgreementName?: string;
  hasPersonalInvestment?: boolean; // true when any investor in the cap table has isPersonalInvestment=true
  // Deal Room sharing
  dealRoomEnabled?: boolean;  // true when a deal room has been created and is active
  dealRoomToken?: string;     // the deal room document ID / share token
  createdAt: Date;
  updatedAt: Date;
}
