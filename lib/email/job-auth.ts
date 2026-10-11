import { timingSafeEqual } from "node:crypto";
/** A missing secret disables the endpoint, never opens it. */
export function isEmailJobAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(header);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
