import type { BookingStatus } from "./base";

// Billing types for services
export type BillingType = 'per_day' | 'per_hour' | 'per_session';
export type SessionType = 'one_time' | 'one_night';

export interface MassageVariant {
  id: string;
  name: string;
  pricePerHour: number;
}

export interface IServiceBookingResponse {
  id: string;
  customRate: number;
  customHourlyRate?: number;
  customOneTimePrice?: number;
  customOneNightPrice?: number;
  isAvailable: false;
  service: {
    id: string;
    name: string;
    description: string;
    baseRate: number;
    billingType: BillingType;
    hourlyRate?: number;
    oneTimePrice?: number;
    oneNightPrice?: number;
  };
  model?: {
    address?: string;
  };
  model_service_variant?: MassageVariant[];
}

export interface IServiceBookingCredentials {
  startDate: Date;
  endDate?: Date;
  price: number;
  dayAmount?: number;
  hours?: number;           // For per_hour services (drinkingFriend)
  sessionType?: SessionType; // For per_session services (sleepPartner)
  modelServiceVariantId?: string; // For massage service variants
  location: string;
  preferred?: string;
}

export type IServiceBooking = {
  id: string;
  price: number;
  location: string;
  preferredAttire: string | null;
  startDate: Date;
  endDate: Date | null;
  status: BookingStatus;
  dayAmount: number | null;
  hours: number | null;
  sessionType: SessionType | null;
  completionToken: string | null;
  modelCheckedInAt: Date | null;
  model: {
    id: string;
    firstName: string;
    lastName: string;
    profile: string | null;
    dob: Date | null;
    whatsapp: number | null;
  };

  modelService: {
    id: string;
    customRate: number | null;
    customHourlyRate: number | null;
    customOneTimePrice: number | null;
    customOneNightPrice: number | null;
    service: {
      id: string;
      name: string;
      description: string | null;
      baseRate: number;
      billingType: BillingType;
      hourlyRate: number | null;
      oneTimePrice: number | null;
      oneNightPrice: number | null;
    };
  };
  isContact: boolean;
};

export interface ISingleServiceBooking {
  id: string;
  startDate: Date;
  endDate?: Date;
  price: number;
  dayAmount?: number;
  hours?: number;
  sessionType?: SessionType;
  location: string;
  preferredAttire?: string;
  status: BookingStatus;
  modelId: string;
  modelServiceId: string;
}
