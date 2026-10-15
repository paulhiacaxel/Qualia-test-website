import type { ReactNode } from "react";
import Link from "next/link";

export function DashboardShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <main id="main-content" className="container dashboard">
      <div className="dashboard-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <nav className="dashboard-nav" aria-label="Account navigation">
        <Link href="/account/dashboard">My account</Link>
        <Link href="/bookings">My bookings</Link>
        <Link href="/host/dashboard">Host workspace</Link>
        <Link href="/account/update-password">Password</Link>
      </nav>
      {children}
    </main>
  );
}
