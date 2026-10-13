import { LegalDocument } from "@/components/legal/legal-document";
import { cancellationPolicy } from "@/lib/legal/documents";

export const metadata = { title: "Cancellation and refund policy" };

export default function Page() {
  return <LegalDocument document={cancellationPolicy} />;
}
