import type { Gender } from "./base";

export interface ICustomerSigninCredentials {
  rememberMe: boolean;
  whatsapp: number;
  password: string;
}

export interface ICustomerSignupCredentials {
  firstName: string;
  lastName: string;
  whatsapp: number;
  gender: Gender;
  dob: string;
  password: string;
  profile: string;
}

export interface ICustomerForgotCredentials {
  whatsapp: number;
}

export interface IOTPCredentials {
  otp: string;
}

export interface IResetPasswordCredentials {
  password: string;
}

// Backend interfaces:
export interface TelbizResponse {
  response: {
    code: string;
    message: string;
    success: boolean;
    detail: string;
  };
  key?: {
    partitionKey: string;
    rangeKey: string;
  };
}

export interface TelbizError {
  code: string;
  message: string;
  success: boolean;
  detail: string;
}
