export type SupportState = { error?: string; success?: string };
export type SupportRequest = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: "open" | "closed";
  response: string | null;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
};
