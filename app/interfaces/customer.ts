import type { Gender, IUserImages } from "./base";

export interface ICustomerResponse {
  id: string;
  number: string;
  firstName: string;
  lastName: string;
  dob: Date;
  gender: Gender;
  latitude: string;
  longitude: string;
  country: string;
  ip: string;
  whatsapp: string;
  profile: string;
  status: string;
  interests: Record<string, string> | null;
  relationshipStatus: string | null;
  bio: string | null;
  career: string | null;
  education: string | null;
  createdAt: Date;
  sendMailNoti: boolean;
  sendSMSNoti: boolean;
  sendPushNoti: boolean;
  defaultLanguage: string;
  twofactorEnabled: string;
  defaultTheme: string;
  Images: IUserImages[];
  interactions: {
    likeCount: number;
    passCount: number;
  };
}

export interface ICustomerCredentials {
  firstName: string;
  lastName: string;
  dob: Date;
  gender: Gender;
  whatsapp: number;
  profile: string;
  interests: Record<string, string> | null;
  relationshipStatus: string | null;
  bio: string | null;
  career: string | null;
  education: string | null;
}

export interface ICustomerSettingCredentials {
  twofactorEnabled: boolean;
  notifications_email: boolean;
  notifications_push: boolean;
  notifications_sms: boolean;
  defaultLanguage: string;
  defaultTheme: string;
}

// CustomerCard Props:
export interface CustomerCardProps {
  customer: {
    id: string;
    firstName: string;
    lastName?: string;
    profile?: string;
    dob?: string;
    location?: any;
    latitude?: number;
    longitude?: number;
    gender?: string;
    relationshipStatus?: string;
    bio?: string;
    whatsapp?: number | null;
    Images?: Array<{ id: string; name: string }>;
    isContact?: boolean;
    modelAction?: "LIKE" | "PASS" | null;
  };
  modelLatitude?: number;
  modelLongitude?: number;
  onViewProfile?: (customerId: string) => void;
}
