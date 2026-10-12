import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm } from "@/components/host/action-form";
import { requireUser } from "@/lib/auth/session";
import { firstValue, safeNext } from "@/lib/auth/validation";
import { getAccountEligibility } from "@/lib/participation/data";
import { confirmAdultAccount } from "./actions";
import "@/components/auth-checkbox.css";

export const metadata = { title: "Confirm your account eligibility" };

export default async function AccountEligibilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const destination = safeNext(firstValue(query.next));
  const next = destination.startsWith("/account/eligibility") ? "/account/dashboard" : destination;
  await requireUser(`/account/eligibility?next=${encodeURIComponent(next)}`);
  const eligibility = await getAccountEligibility();
  if (eligibility?.eligible) redirect(next);
  return (
    <AuthShell
      eyebrow="Your account"
      title="An account of your own."
      description="Qualia accounts are for adults aged 18 or older."
    >
      <div className="auth-card">
        <ActionForm action={confirmAdultAccount} label="Confirm and continue">
          <input type="hidden" name="next" value={next} />
          <label className="auth-checkbox">
            <input type="checkbox" name="adultConfirmed" required />I confirm that I am 18 or older
            and this is my own account.
          </label>
          <p className="field-hint">
            We record this confirmation on your account. We do not ask for your birth date here.
          </p>
        </ActionForm>
        <p>
          A minor can participate only when the experience&apos;s approved age range allows it.
          Their parent or legal guardian must book from their own adult account and follow the
          activity&apos;s supervision requirements.
        </p>
        <p className="muted">
          If you are under 18, do not continue with an account of your own. Ask your parent or legal
          guardian to use theirs.
        </p>
        <Link className="text-link" href="/contact">
          Questions? Contact Qualia
        </Link>
      </div>
    </AuthShell>
  );
}
