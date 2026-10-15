import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";

export const reviewActions = [
  "start_review",
  "approve_safety",
  "reject",
  "require_consultation",
  "schedule_consultation",
  "complete_consultation",
  "waive_consultation",
  "publish",
  "pause",
] as const;
export const reviewSchema = z
  .object({
    listingId: z.uuid(),
    action: z.enum(reviewActions),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    note: z.string().trim().min(3, "Record a short reason for this decision.").max(3000),
    hostFeedback: z.string().trim().max(3000).default(""),
    riskNotes: z.string().trim().max(4000).default(""),
    scheduledLocal: z.string().max(30).default(""),
    profile: z.boolean().default(false),
    experience: z.boolean().default(false),
    location: z.boolean().default(false),
    risks: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (["reject", "pause"].includes(value.action) && value.hostFeedback.length < 3) {
      context.addIssue({
        code: "custom",
        path: ["hostFeedback"],
        message: "Tell the host why the listing needs changes or has been paused.",
      });
    }
    if (
      value.action === "approve_safety" &&
      (!value.profile || !value.experience || !value.location || !value.risks || !value.riskNotes)
    ) {
      context.addIssue({
        code: "custom",
        path: ["riskNotes"],
        message: "Complete every review check and record the relevant risks.",
      });
    }
    if (value.action === "schedule_consultation") {
      try {
        miamiDateTime(value.scheduledLocal);
      } catch {
        context.addIssue({
          code: "custom",
          path: ["scheduledLocal"],
          message: "Choose an unambiguous Miami date and time.",
        });
      }
    }
  });

/** Never interpret a Miami appointment in the server's or browser's time zone. */
export function miamiDateTime(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Invalid local time");
  return Temporal.PlainDateTime.from(value)
    .toZonedDateTime("America/New_York", { disambiguation: "reject" })
    .toInstant()
    .toString();
}

export function formatMiamiDate(value: string | null): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(value));
}
