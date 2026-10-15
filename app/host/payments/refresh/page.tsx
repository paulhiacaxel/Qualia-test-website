import { redirect } from "next/navigation";
import { requireHost } from "@/lib/auth/session";
export default async function PaymentRefreshPage() {
  await requireHost();
  redirect("/host/payments");
}
