export interface IModelProfileCredentials {
  firstName: string;
  lastName?: string;
  dob: string;
  gender: string;
  whatsapp: number;
  address?: string;
  relationshipStatus?: string;
  bio?: string;
  career?: string;
  education?: string;
  profile?: string;
  interests?: Record<string, string>;
  available_status?: string;
}

export interface IModelSettingCredentials {
  twofactorEnabled?: boolean;
  defaultLanguage?: string;
  defaultTheme?: string;
  notifications_email?: boolean;
  notifications_push?: boolean;
  notifications_sms?: boolean;
}

export interface IModelOwnProfileResponse {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string;
  dob: Date;
  gender: string;
  bio: string;
  whatsapp: number;
  address: string | null;
  available_status: string;
  profile: string | null;
  latitude: number | null;
  longitude: number | null;
  location: any;
  hourly_rate_talking: number | null;
  hourly_rate_video: number | null;
  rating: number;
  total_review: number;
  interests: Record<string, string> | null;
  relationshipStatus: string | null;
  career: string | null;
  education: string | null;
  sendMailNoti: boolean;
  sendSMSNoti: boolean;
  sendPushNoti: boolean;
  defaultLanguage: string;
  defaultTheme: string;
  twofactorEnabled: boolean | null;
  status: string;
  createdAt: Date;
  Images: { id: string; name: string }[];
  ModelService: {
    id: string;
    customRate: number | null;
    customHourlyRate: number | null;
    customOneTimePrice: number | null;
    customOneNightPrice: number | null;
    isAvailable: boolean;
    minSessionDuration: number;
    maxSessionDuration: number;
    service: {
      id: string;
      name: string;
      description: string | null;
      baseRate: number;
      billingType: 'per_day' | 'per_hour' | 'per_session';
      hourlyRate: number | null;
      oneTimePrice: number | null;
      oneNightPrice: number | null;
    };
  }[];
  totalLikes: number;
  totalFriends: number;
}

export interface IModelBank {
  id: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  qr_code: string | null;
  status: string;
  createdAt: Date;
}