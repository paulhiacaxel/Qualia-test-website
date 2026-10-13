export type ReviewAction =
  | "start_review"
  | "approve_safety"
  | "reject"
  | "require_consultation"
  | "schedule_consultation"
  | "complete_consultation"
  | "waive_consultation"
  | "publish"
  | "pause";

export type ReviewState = { error?: string; success?: string };
export type ReviewListing = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  category: string;
  price_cents: number;
  booking_format: "private" | "shared" | "both";
  max_guests: number;
  private_price_basis: "group" | "per_guest";
  shared_price_cents: number | null;
  duration_minutes: number;
  city: string;
  neighborhood: string;
  status: string;
  safety_status: string;
  consultation_status: string;
  submitted_at: string | null;
  updated_at: string;
};
export type ReviewDetail = {
  listing: ReviewListing;
  host: { display_name: string; bio: string; city: string; portfolio_url: string | null };
  location: {
    address_line1: string;
    address_line2: string;
    postal_code: string;
    meeting_instructions: string;
  } | null;
  photos: { id: string; storage_path: string; alt_text: string; signedUrl?: string }[];
  availability: { id: string; starts_at: string; ends_at: string }[];
  review: {
    profile_checked: boolean;
    experience_checked: boolean;
    location_checked: boolean;
    risks_checked: boolean;
    risk_notes: string;
    consultation_scheduled_at: string | null;
    host_feedback: string;
    reviewed_at: string;
  } | null;
  history: {
    stage: string;
    outcome: string;
    internal_note: string;
    reviewer_id: string;
    created_at: string;
  }[];
  photoError?: boolean;
};
