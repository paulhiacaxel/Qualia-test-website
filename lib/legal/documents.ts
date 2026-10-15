import {
  guestTerms,
  hostTerms as originalHostTerms,
  cancellationPolicy,
  privacyNotice,
} from "./archive/2026-10-13";
import { hostTerms } from "./archive/2026-10-13-host-v2";

export type { LegalDocumentContent, LegalSection } from "./types";
export { guestTerms, hostTerms, cancellationPolicy, privacyNotice };

export const legalDocuments = [guestTerms, hostTerms, cancellationPolicy, privacyNotice];

// Add future versions alongside these records; existing acceptance links must keep working.
export const archivedLegalDocuments = [...legalDocuments, originalHostTerms];

export function getArchivedLegalDocument(version: string) {
  return archivedLegalDocuments.find((document) => document.version === version) ?? null;
}
