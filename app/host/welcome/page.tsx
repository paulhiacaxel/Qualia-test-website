import Image from "next/image";
import Link from "next/link";
import { requireAdultAccount } from "@/lib/auth/session";
import { getAssistedHostListing } from "@/lib/host/assisted/data";
import { assistedHost } from "@/lib/host/assisted/catalog";
import { ActionForm } from "@/components/host/action-form";
import { claimPreparedListing } from "./actions";
export const metadata = {
  title: "Your prepared experience",
  robots: { index: false, follow: false },
};
export default async function HostWelcomePage() {
  await requireAdultAccount("/host/welcome");
  const setup = await getAssistedHostListing();
  const prepared = assistedHost(setup?.source_key);
  if (!setup || !prepared)
    return (
      <main id="main-content" className="container dashboard">
        <h1>Your host workspace</h1>
        <p>No prepared experience is attached to this account.</p>
        <Link href="/host/start">Open your host workspace</Link>
      </main>
    );
  return (
    <main id="main-content" className="container dashboard">
      <div className="host-page-heading">
        <div>
          <p className="eyebrow">Prepared for {prepared.name}</p>
          <h1>Your page is ready to make yours.</h1>
          <p>
            We’ve written the copy and selected your photos. Confirm a few details below, then add
            your meeting point, available times and activity requirements. We’ll review it together
            before bookings open.
          </p>
        </div>
      </div>
      <section className="panel profile-editor">
        <h2>{setup.listing.title}</h2>
        <p>{setup.listing.duration_minutes} minutes · Bring your own camera · 15–20 images each</p>
        <p>
          <Link href={prepared.previewPath} target="_blank" rel="noopener noreferrer">
            See the full preview ↗
          </Link>
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
            gap: 12,
            marginBlock: 24,
          }}
        >
          {prepared.photos.map((photo) => (
            <Image
              key={photo.src}
              {...photo}
              unoptimized
              style={{ width: "100%", height: 150, objectFit: "cover" }}
            />
          ))}
        </div>
        <details>
          <summary>Read the prepared description</summary>
          <p style={{ whiteSpace: "pre-line" }}>{setup.listing.description}</p>
          <h3>Your host introduction</h3>
          <p>{prepared.profile.bio}</p>
        </details>
        <ActionForm
          action={claimPreparedListing}
          label={setup.confirmed_at ? "Continue to finish" : "Confirm and open my listing"}
        >
          {!setup.confirmed_at ? (
            <>
              <div>
                <label className="field-label" htmlFor="pricingMode">
                  How should guests book? *
                </label>
                <select
                  id="pricingMode"
                  name="pricingMode"
                  className="field-input"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choose your format and price basis
                  </option>
                  <option value="private_group">
                    Private session — one total price for the group
                  </option>
                  <option value="private_per_guest">
                    Private session — price per guest in their party
                  </option>
                  <option value="shared_per_guest">
                    Shared session — price per guest, separate parties can join
                  </option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="price">
                  Your price in USD *
                </label>
                <input
                  id="price"
                  name="price"
                  className="field-input"
                  inputMode="decimal"
                  required
                  defaultValue={(setup.listing.price_cents / 100).toFixed(2)}
                />
                <p className="field-hint">
                  The discussed $300 is prefilled. Confirm or change it; it applies to the pricing
                  option you choose above.
                </p>
              </div>
              <div>
                <label className="field-label" htmlFor="maxGuests">
                  Maximum guests per session *
                </label>
                <input
                  id="maxGuests"
                  name="maxGuests"
                  className="field-input"
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  required
                  placeholder="Your comfortable group size"
                />
              </div>
              <label>
                <input type="checkbox" name="copyApproved" required /> I approve this description
                and host introduction, and authorize Qualia to use these photos for my listing. *
              </label>
              <p className="field-hint">
                You can edit your draft after this. This step does not publish it or open bookings.
              </p>
            </>
          ) : (
            <p>
              Your choices are saved. Continue to finish copying any remaining photos and open your
              listing.
            </p>
          )}
        </ActionForm>
        <p>
          Need a change first? <a href="mailto:contact@bookqualia.com">Let us help</a>.
        </p>
      </section>
    </main>
  );
}
