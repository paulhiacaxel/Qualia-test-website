export type LegalScope = "guest" | "host";

export type LegalAcceptanceStatus = {
  guest_accepted: boolean;
  host_accepted: boolean;
  guest_version: string;
  host_version: string;
  records: Array<{
    scope: LegalScope;
    version: string;
    document_versions: Record<string, string>;
    accepted_at: string;
  }>;
};

export type LegalSection = {
  heading?: string;
  blocks: ({ type: "paragraph"; text: string } | { type: "list"; items: string[] })[];
};

export type LegalDocumentContent = {
  title: string;
  href: string;
  version: string;
  effectiveDate: string;
  sections: LegalSection[];
};
