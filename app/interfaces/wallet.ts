import { UserStatus } from "./base";

export interface IWalletCredentials {
  totalBalance: number;
  totalRecharge: number;
  totalDeposit: number;
  status: UserStatus;
  model?: string;
  customer?: string;
  updatedBy?: string;
}

export interface IWalletResponse {
  id: string;
  totalBalance: number;
  totalRecharge: number;
  totalDeposit: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  updatedById: string | null;
  bannedById: string | null;
  deletedById: string | null;
  modelId: string | null;
  customerId: string | null;
}
