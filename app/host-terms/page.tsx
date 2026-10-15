import { LegalDocument } from "@/components/legal/legal-document";
import { hostTerms } from "@/lib/legal/documents";

export const metadata = { title: "Host terms" };

export default function Page() {
  return <LegalDocument document={hostTerms} />;
}
