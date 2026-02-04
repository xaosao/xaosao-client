import { UserStatus } from "./base";

export interface IWalletCredentials {
  totalBalance: number;
  totalRecharge: number;
  // New wallet schema fields
  totalWithdraw: number;
  totalSpend: number;
  totalRefunded: number;
  totalPending: number;
  // Deprecated field (kept for backwards compatibility)
  totalDeposit?: number;
  status: UserStatus;
  model?: string;
  customer?: string;
  updatedBy?: string;
}

export interface IWalletResponse {
  id: string;
  totalBalance: number;
  totalRecharge: number;
  // New wallet schema fields
  totalWithdraw: number;
  totalSpend: number;
  totalRefunded: number;
  totalPending: number;
  // Calculated fields from getCustomerWalletSummary
  totalRecharged?: number;  // Same as totalBalance (all approved recharges)
  totalAvailable?: number;  // totalBalance - totalSpend + totalRefunded
  totalSpent?: number;      // Same as totalSpend
  // Deprecated field (kept for backwards compatibility)
  totalDeposit?: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  updatedById: string | null;
  bannedById: string | null;
  deletedById: string | null;
  modelId: string | null;
  customerId: string | null;
}
