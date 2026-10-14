import { z } from "zod";
import { dollarsToCents } from "../validation.ts";
export const assistedConfirmationSchema = z.object({
  pricingMode: z.enum(["private_group", "private_per_guest", "shared_per_guest"], {
    error: "Choose how guests will book and how the price applies.",
  }),
  maxGuests: z.coerce.number().int().min(1, "Enter your maximum number of guests.").max(50),
  price: z.string().transform((value, ctx) => {
    try {
      return dollarsToCents(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid session price." });
      return z.NEVER;
    }
  }),
  copyApproved: z.literal("on", {
    error: "Review and approve the prepared copy and photos first.",
  }),
});
