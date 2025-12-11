export interface ITransactionResponse {
  id: string;
  identifier: string;
  amount: number;
  paymentSlip: string;
  status: string;
  comission: number;
  fee: number;
  rejectReason: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
  approvedById: string | null;
  rejectedById: string | null;
  modelId: string | null;
  customerId: string | null;
  userId: string | null;
}

export interface ITransactionCredentials {
  amount: number;
  paymentSlip: string;
}
