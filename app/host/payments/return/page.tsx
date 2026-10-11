import { redirect } from "next/navigation";
import { requireHost } from "@/lib/auth/session";
export default async function PaymentReturnPage() {
  await requireHost();
  redirect("/host/payments");
}
