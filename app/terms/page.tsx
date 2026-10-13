import { LegalDocument } from "@/components/legal/legal-document";
import { guestTerms } from "@/lib/legal/documents";

export const metadata = { title: "Guest terms" };

export default function Page() {
  return <LegalDocument document={guestTerms} />;
}
