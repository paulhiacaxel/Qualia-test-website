import type { EmailPayload } from "./render";
export type SendResult =
  { accepted: true; id: string } | { accepted: false; retryable: boolean; code: string };

/** Resend acceptance is not proof of delivery. No real API call occurs in tests. */
export async function sendWithResend(
  payload: EmailPayload,
  idempotencyKey: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<SendResult> {
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await response.json().catch(() => null)) as {
      id?: unknown;
      name?: unknown;
    } | null;
    if (response.ok && typeof data?.id === "string" && data.id.length > 0)
      return { accepted: true, id: data.id };
    if (response.ok) return { accepted: false, retryable: true, code: "provider_missing_id" };
    // Store only known error codes/statuses, never provider bodies containing PII.
    const concurrent = response.status === 409 && data?.name === "concurrent_idempotent_requests";
    return {
      accepted: false,
      retryable: response.status === 429 || response.status >= 500 || concurrent,
      code: concurrent ? "provider_concurrent_request" : `provider_http_${response.status}`,
    };
  } catch {
    // The server may have accepted a timed-out request. Retry the FROZEN payload
    // with the same key; the database stops retries before Resend's 24h expiry.
    return { accepted: false, retryable: true, code: "provider_network_or_timeout" };
  }
}
