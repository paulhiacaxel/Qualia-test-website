import Link from "next/link";

/** Shared operator navigation; every destination must keep its own admin guard. */
export function AdminNav({
  active,
}: {
  active: "reviews" | "settings" | "support" | "commercial" | "payments" | "email";
}) {
  return (
    <nav className="dashboard-nav" aria-label="Administration">
      <Link href="/admin" aria-current={active === "reviews" ? "page" : undefined}>
        Listing reviews
      </Link>
      <Link href="/admin/settings" aria-current={active === "settings" ? "page" : undefined}>
        Booking settings
      </Link>
      <Link href="/admin/support" aria-current={active === "support" ? "page" : undefined}>
        Booking support
      </Link>
      <Link href="/admin/commercial" aria-current={active === "commercial" ? "page" : undefined}>
        Commercial policy
      </Link>
      <Link href="/admin/payments" aria-current={active === "payments" ? "page" : undefined}>
        Payments
      </Link>
      <Link href="/admin/email" aria-current={active === "email" ? "page" : undefined}>
        Email test
      </Link>
    </nav>
  );
}
