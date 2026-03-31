// hotmodel show on landing page type.
export interface HotModel {
  id: string;
  firstName: string;
  lastName: string | null;
  dob: Date;
  gender: string;
  bio: string | null;
  profile: string | null;
  rating: number;
  total_review: number;
  address: string | null;
  available_status: string;
  Images: { id: string; name: string }[];
}
