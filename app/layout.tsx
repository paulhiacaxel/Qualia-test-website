import type { Metadata } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/fraunces/standard-italic.css";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { getContactEmail } from "@/lib/contact/config";

export const metadata: Metadata = {
  title: { default: "Qualia — One person. A whole new world.", template: "%s — Qualia" },
  description: "One-on-one experiences with independent hosts. Launching in Miami and Miami Beach.",
  icons: { icon: "/brand_assets/qualia-mark.svg" },
  robots: { index: false, follow: false },
};

// Authenticated navigation and session refresh must never be statically cached.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const contactEmail = getContactEmail();
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <footer className="site-footer">
          <div className="container footer-inner">
            <span className="wordmark">Qualia</span>
            <span className="eyebrow">One-on-one. Human to human.</span>
            <span className="footer-note">Pre-launch · Miami / Miami Beach</span>
            <nav className="footer-links" aria-label="Footer navigation">
              <Link href="/discover">Discover</Link>
              <Link href="/host/start">Host with Qualia</Link>
              <Link href="/help">Help &amp; concierge</Link>
              <Link href="/contact">Contact us</Link>
              <a href="https://www.instagram.com/bookqualia/" aria-label="Qualia on Instagram">
                Instagram
              </a>
              <a
                href="https://www.linkedin.com/company/bookqualia/"
                aria-label="Qualia on LinkedIn"
              >
                LinkedIn
              </a>
              {contactEmail ? (
                <a href={`mailto:${encodeURIComponent(contactEmail)}`}>{contactEmail}</a>
              ) : null}
            </nav>
          </div>
          <nav className="container footer-policy-links" aria-label="Policies">
            <Link href="/terms">Guest terms</Link>
            <Link href="/host-terms">Host terms</Link>
            <Link href="/cancellation-policy">Cancellation policy</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
