import type { categories, cities } from "./validation";

export type HostProfile = {
  user_id: string;
  display_name: string;
  bio: string;
  city: (typeof cities)[number];
  portfolio_url: string | null;
};

export type Listing = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  category: (typeof categories)[number];
  price_cents: number;
  currency: "usd";
  duration_minutes: number;
  city: (typeof cities)[number];
  neighborhood: string;
  time_zone: "America/New_York";
  status: "draft" | "submitted" | "in_review" | "approved" | "published" | "rejected" | "paused";
  safety_status: "pending" | "approved" | "rejected";
  consultation_status: "not_requested" | "required" | "scheduled" | "completed" | "waived";
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};

export type ListingLocation = {
  address_line1: string;
  address_line2: string;
  postal_code: string;
  meeting_instructions: string;
};

export type ListingPhoto = {
  id: string;
  listing_id: string;
  storage_path: string;
  alt_text: string;
  position: number;
  signedUrl?: string;
};

export type AvailabilityWindow = {
  id: string;
  listing_id: string;
  starts_at: string;
  ends_at: string;
};

export type HostActionState = { error?: string; success?: string };
