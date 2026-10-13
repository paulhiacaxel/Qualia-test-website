import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm } from "@/components/host/action-form";
import { getAccountEligibility, getLegalAcceptance, requireUser } from "@/lib/auth/session";
import { firstValue, safeNext, eligibilityPath } from "@/lib/auth/validation";
import {
  GUEST_TERMS_VERSION,
  PRIVACY_VERSION,
  CANCELLATION_POLICY_VERSION,
  HOST_TERMS_VERSION,
  LEGAL_EFFECTIVE_DATE,
} from "@/lib/legal/versions";
import { acceptLegalTerms } from "./actions";
import "@/components/auth-checkbox.css";

export const metadata = { title: "Review your Qualia agreements" };

export default async function AccountAgreementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const scope = firstValue(query.scope) === "host" ? "host" : "guest";
  const destination = safeNext(firstValue(query.next));
  const next =
    destination.startsWith("/account/agreements") || destination.startsWith("/account/eligibility")
      ? "/account/dashboard"
      : destination;
  await requireUser(`/account/agreements?scope=${scope}&next=${encodeURIComponent(next)}`);
  if (!(await getAccountEligibility())?.eligible) redirect(eligibilityPath(next));
  const status = await getLegalAcceptance();
  if (scope === "host" ? status.host_accepted : status.guest_accepted) redirect(next);
  return (
    <AuthShell
      eyebrow={scope === "host" ? "Host agreement" : "Your account"}
      title="Clear terms, before you begin."
      description="Read how bookings, payments and responsibilities work on Qualia."
    >
      <div className="auth-card">
        <p>
          Effective {LEGAL_EFFECTIVE_DATE}. Please open and read each document before confirming.
        </p>
        <ul>
          <li>
            <Link href={`/legal/${GUEST_TERMS_VERSION}`} target="_blank" rel="noopener noreferrer">
              Qualia terms
            </Link>
          </li>
          {scope === "host" && (
            <li>
              <Link href={`/legal/${HOST_TERMS_VERSION}`} target="_blank" rel="noopener noreferrer">
                Host agreement and commercial schedule
              </Link>
            </li>
          )}
          <li>
            <Link
              href={`/legal/${CANCELLATION_POLICY_VERSION}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Cancellation and refund policy
            </Link>
          </li>
          <li>
            <Link href={`/legal/${PRIVACY_VERSION}`} target="_blank" rel="noopener noreferrer">
              Privacy notice
            </Link>
          </li>
        </ul>
        {scope === "host" && (
          <p>
            The host agreement covers commissions, processing costs, release timing, cancellations
            and the eligibility rules for founding and referral offers. Accepting it does not
            automatically enroll you in an incentive.
          </p>
        )}
        <ActionForm action={acceptLegalTerms} label="Accept and continue">
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="guestVersion" value={GUEST_TERMS_VERSION} />
          {scope === "host" && (
            <input type="hidden" name="hostVersion" value={HOST_TERMS_VERSION} />
          )}
          <input type="hidden" name="next" value={next} />
          <label className="auth-checkbox">
            <input type="checkbox" name="termsAccepted" required />I have read and agree to the
            Qualia terms{scope === "host" ? ", host agreement and commercial schedule," : ""} and
            cancellation and refund policy.
          </label>
          <label className="auth-checkbox">
            <input type="checkbox" name="privacyAcknowledged" required />I have read the privacy
            notice.
          </label>
          <p className="field-hint">
            We record the document versions and the time you accept them on your signed-in account.
            This is not consent to marketing emails or a release for a particular activity.
          </p>
        </ActionForm>
        <p>
          <Link href="/account/dashboard">Return to your account</Link> ·{" "}
          <Link href="/contact">Ask a question</Link>
        </p>
      </div>
    </AuthShell>
  );
}
