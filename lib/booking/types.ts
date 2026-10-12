import type { HostProfile, Listing } from "@/lib/host/types";

export type PublicExperience = Listing & {
  coverUrl?: string;
  coverAlt?: string;
  host?: Pick<HostProfile, "user_id" | "display_name" | "bio" | "city" | "portfolio_url">;
};

export type BookingSlot = {
  starts_at: string;
  ends_at: string;
  price_cents: number;
  currency: "usd";
};

export type BookingPolicy = {
  enabled: boolean;
  request_expiry_minutes: number | null;
  payment_deadline_minutes: number | null;
};

export type BookingStatus =
  | "requested"
  | "awaiting_payment"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed"
  | "expired";

export type Booking = {
  id: string;
  listing_id: string;
  host_id: string;
  guest_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  amount_cents: number;
  currency: "usd";
  guest_message: string;
  request_expires_at: string | null;
  payment_deadline_at: string | null;
  /** Present on booking details; list summaries may omit the policy snapshot. */
  policy_payment_deadline_minutes?: number | null;
  /** Server-derived: a checkout/payment can still settle after its booking deadline. */
  payment_hold_active?: boolean;
  created_at: string;
};

export type BookingSummary = Booking & {
  listing_title: string;
  listing_category: string;
  listing_city: string;
  host_name: string;
  guest_name: string;
};

export type BookingMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type BookingDetails = {
  booking: Booking;
  listing: Pick<
    Listing,
    "title" | "category" | "city" | "neighborhood" | "time_zone" | "duration_minutes"
  >;
  host: Pick<HostProfile, "user_id" | "display_name" | "bio">;
  guest_name: string;
  meeting_location: {
    address_line1: string;
    address_line2: string;
    postal_code: string;
    meeting_instructions: string;
  } | null;
  messages: BookingMessage[];
};

export type BookingActionState = { error?: string; success?: string };
