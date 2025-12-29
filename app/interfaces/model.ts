import type { Gender, IAvailableStatus, IUserImages } from "./base";

export interface IFriendsRes {
  contactId: string;
  contactType: string;
}

export interface ImodelsResponse {
  id: string;
  firstName: string;
  lastName: string | null;
  dob: Date;
  gender: Gender;
  bio: string;
  whatsapp: number;
  address: string | null;
  available_status: IAvailableStatus;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  profile: string | null;
  createdAt: Date;
  customerAction: string | null;
  Images: IUserImages[];
  friends?: IFriendsRes[];
  isContact: boolean;
}

export interface IHotmodelsResponse {
  id: string;
  firstName: string;
  lastName: string | null;
  dob: Date;
  latitude: number | null;
  longitude: number | null;
  profile: string | null;
  whatsapp?: number | null;
  Images: IUserImages[];
  friends?: IFriendsRes[];
  isContact: boolean;
}

// For model profile
export type BillingType = 'per_day' | 'per_hour' | 'per_session';

export interface IService {
  id: string;
  name: string;
  description: string;
  baseRate: string;
  billingType: BillingType;
  hourlyRate: number | null;
  oneTimePrice: number | null;
  oneNightPrice: number | null;
}

export interface IModelService {
  id: string;
  customRate: number;
  customHourlyRate: number | null;
  customOneTimePrice: number | null;
  customOneNightPrice: number | null;
  isAvailable: boolean;
  minSessionDuration: number;
  maxSessionDuration: number;
  service: IService;
}

export interface ICustomerInteraction {
  action: "LIKE" | "PASS";
}

export interface IReviewResponse {
  id: string;
  rating: number;
  title: string | null;
  reviewText: string | null;
  isAnonymous: boolean;
  createdAt: Date;
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    profile: string | null;
  } | null;
}

export interface IReviewData {
  reviews: IReviewResponse[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  canReview: boolean;
  reviewReason?: string;
  customerReview?: IReviewResponse | null;
}

export interface ISinglemodelProfileResponse {
  id: string;
  firstName: string;
  lastName: string | null;
  dob: Date;
  gender: Gender;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  available_status: IAvailableStatus;
  rating: number;
  profile: string | null;
  status: string;
  total_review: number;
  createdAt: Date;
  career: string;
  education: string;
  relationshipStatus: string;
  bio: string;
  whatsapp?: number | null;
  interests: Record<string, string> | null;
  Images: IUserImages[];
  ModelService: IModelService[];
  customer_interactions: ICustomerInteraction[] | null;
  isContact: boolean;
  totalFriends: number;
  totalLikes: number;
  reviewData?: IReviewData;
}

export interface ISinglemodelResponse {
  id: string;
  firstName: string;
  lastName: string | null;
}

// ======== For you model:
export interface IForYouModelResponse {
  id: string;
  firstName: string;
  lastName: string | null;
  dob: Date;
  profile: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  bio: string | null;
  whatsapp?: number | null;
  available_status: IAvailableStatus;
  Images: IUserImages[];
  model_interactions?: ICustomerInteraction[] | null;
  customer_interactions?: ICustomerInteraction[] | null;
  isContact?: boolean;
}

// ======== For you model:
export interface INearbyModelResponse extends IForYouModelResponse {
  distance: number;
}

// ======== Message model:
export interface IMessageModelResponse {
  id: string;
  model: IModel;
}

// ======== Message model:
export interface IModel {
  id: string;
  firstName: string;
  lastName: string;
  profile: string;
  status: string;
}
