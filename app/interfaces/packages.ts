export interface ISubscriptionPlanWithCurrentResponse {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  durationDays: number;
  features?: Record<string, string>;
  status: string;
  isPopular: boolean;
  createdAt: Date;
  current: boolean; // new field indicating if this is the customer's current plan
}

export interface ISubscriptionCredentials {
  planId: string;
  amount: number;
  paymentSlip: string;
}
