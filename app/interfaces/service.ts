import type { BookingStatus } from "./base";

export interface IServiceBookingResponse {
  id: string;
  customRate: number;
  isAvailable: false;
  service: {
    id: string;
    name: string;
    description: string;
    baseRate: number;
  };
}

export interface IServiceBookingCredentials {
  startDate: Date;
  endDate: Date;
  price: number;
  dayAmount: number;
  location: string;
  preferred?: string;
}

export interface IServiceBookingCredentials {
  startDate: Date;
  endDate: Date;
  price: number;
  dayAmount: number;
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
  dayAmount: number;
  completionToken: string | null;
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
    service: {
      id: string;
      name: string;
      description: string | null;
      baseRate: number;
    };
  };
  isContact: boolean;
};

export interface ISingleServiceBooking {
  id: string;
  startDate: Date;
  endDate?: Date;
  price: number;
  dayAmount: number;
  location: string;
  preferredAttire?: string;
  status: BookingStatus;
  modelId: string;
  modelServiceId: string;
}
