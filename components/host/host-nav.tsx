import Link from "next/link";

export function HostNav({
  current,
}: {
  current?: "dashboard" | "profile" | "calendar" | "payments";
}) {
  return (
    <nav className="host-nav" aria-label="Host workspace navigation">
      <Link href="/host/dashboard" aria-current={current === "dashboard" ? "page" : undefined}>
        My experiences
      </Link>
      <Link href="/host/profile" aria-current={current === "profile" ? "page" : undefined}>
        Host profile
      </Link>
      <Link href="/host/calendar" aria-current={current === "calendar" ? "page" : undefined}>
        Calendar &amp; requests
      </Link>
      <Link href="/host/payments" aria-current={current === "payments" ? "page" : undefined}>
        Payouts
      </Link>
      <Link href="/account/dashboard">Guest account</Link>
    </nav>
  );
}
