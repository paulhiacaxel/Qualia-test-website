import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { signOut } from "@/app/auth/actions";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="site-header">
      <nav className="container nav" aria-label="Main navigation">
        <Link href="/" className="brand" aria-label="Qualia home">
          <Image
            src="/brand_assets/qualia-logo-horizontal.svg"
            alt="Qualia"
            width={90}
            height={32}
            priority
          />
        </Link>
        <div className="nav-center">
          <Link href="/discover">Discover</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#hosts">For hosts</Link>
        </div>
        <div className="nav-account">
          {user ? (
            <>
              <Link href="/account/dashboard">My account</Link>
              <form action={signOut}>
                <button className="btn btn-outline btn-sm" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link className="btn btn-primary btn-sm" href="/signup?role=host">
                Become a host
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
