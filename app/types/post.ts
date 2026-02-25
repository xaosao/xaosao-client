export interface PostItem {
  id: string;
  content: string;
  images: string[];
  authorType: string;
  targetGender?: string;
  targetCount?: number;
  targetAgeMin?: number;
  targetAgeMax?: number;
  preferredDate?: string;
  preferredTime?: string;
  location?: string;
  interestedCount: number;
  isInterested: boolean;
  expiresAt: string;
  createdAt: string;
  status: string;
  service?: { id: string; name: string } | null;
  author?: {
    id: string;
    firstName: string;
    lastName?: string;
    profile?: string;
    gender?: string;
    dob?: string;
    whatsapp?: number | null;
  } | null;
  _count?: { interests: number };
}

export interface UserProfile {
  id?: string;
  firstName: string;
  lastName?: string | null;
  profile?: string | null;
}
