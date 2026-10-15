import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/legal/legal-document";
import { getArchivedLegalDocument } from "@/lib/legal/documents";

export const metadata = { title: "Policy archive" };

export default async function PolicyArchivePage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  const document = getArchivedLegalDocument(version);
  if (!document) notFound();
  return <LegalDocument document={document} archived />;
}
