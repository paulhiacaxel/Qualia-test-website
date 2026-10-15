import { LegalDocument } from "@/components/legal/legal-document";
import { privacyNotice } from "@/lib/legal/documents";

export const metadata = { title: "Privacy notice" };

export default function Page() {
  return <LegalDocument document={privacyNotice} />;
}
