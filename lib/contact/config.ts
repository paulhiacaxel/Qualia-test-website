import "server-only";
import { emailSchema } from "@/lib/auth/validation";

/** Set only after the mailbox is ready. Missing/invalid configuration stays hidden. */
export function getContactEmail(): string | null {
  const parsed = emailSchema.safeParse({ email: process.env.CONTACT_EMAIL });
  return parsed.success ? parsed.data.email : null;
}
