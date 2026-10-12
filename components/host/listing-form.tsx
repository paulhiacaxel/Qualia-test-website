import { ActionForm } from "./action-form";
import { RequiredFieldLegend, RequiredMark } from "./required-field";
import { createListing, saveListing } from "@/app/host/actions";
import { categories, cities } from "@/lib/host/validation";
import type { Listing } from "@/lib/host/types";

export function ListingForm({
  listing,
  defaultCity = "Miami",
  disabled = false,
}: {
  listing?: Listing;
  defaultCity?: string;
  disabled?: boolean;
}) {
  return (
    <ActionForm
      action={listing ? saveListing : createListing}
      label={listing ? "Save experience details" : "Create draft & continue"}
      disabled={disabled}
    >
      {listing ? <input type="hidden" name="listingId" value={listing.id} /> : null}
      <RequiredFieldLegend allowDraft />
      <div>
        <label className="field-label" htmlFor="listing-title">
          Experience title <RequiredMark />
        </label>
        <input
          id="listing-title"
          name="title"
          className="field-input"
          defaultValue={listing?.title ?? ""}
          minLength={3}
          maxLength={160}
          required
          placeholder="What will you share with your guest?"
        />
      </div>
      <div>
        <label className="field-label" htmlFor="description">
          What the experience is like (before review)
        </label>
        <textarea
          id="description"
          name="description"
          rows={8}
          className="field-input field-textarea"
          defaultValue={listing?.description ?? ""}
          maxLength={20000}
          aria-describedby="description-help"
        />
        <p id="description-help" className="field-hint">
          Describe what you&apos;ll do together, who it&apos;s for, what&apos;s included, and
          anything a guest should bring or know. Save a draft now and add detail before review.
        </p>
      </div>
      <div className="field-row">
        <div>
          <label className="field-label" htmlFor="category">
            Category <RequiredMark />
          </label>
          <select
            id="category"
            name="category"
            className="field-input"
            defaultValue={listing?.category ?? ""}
            required
          >
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category[0].toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="duration">
            Duration in minutes <RequiredMark />
          </label>
          <input
            id="duration"
            name="durationMinutes"
            type="number"
            className="field-input"
            defaultValue={listing?.duration_minutes ?? 60}
            min={1}
            max={1440}
            step={1}
            required
            aria-describedby="duration-help"
          />
          <p id="duration-help" className="field-hint">
            The full time you&apos;ll spend with one guest, including setup and wrap-up. Your
            availability must fit this entire session.
          </p>
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="price">
          Price per one-on-one session (USD) <RequiredMark />
        </label>
        <input
          id="price"
          name="price"
          type="text"
          inputMode="decimal"
          className="field-input"
          defaultValue={listing ? (listing.price_cents / 100).toFixed(2) : ""}
          placeholder="150.00"
          pattern="[0-9]+(\.[0-9]{1,2})?"
          maxLength={10}
          required
          aria-describedby="price-help"
        />
        <p id="price-help" className="field-hint">
          Set the total experience price for one guest, in US dollars. Enter a number such as
          150.00, without a dollar sign.
        </p>
      </div>
      <div className="field-row">
        <div>
          <label className="field-label" htmlFor="listing-city">
            City <RequiredMark />
          </label>
          <select
            id="listing-city"
            name="city"
            className="field-input"
            defaultValue={listing?.city ?? defaultCity}
            required
          >
            {cities.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="neighborhood">
            Neighborhood or broad meeting area (before review)
          </label>
          <input
            id="neighborhood"
            name="neighborhood"
            className="field-input"
            defaultValue={listing?.neighborhood ?? ""}
            maxLength={120}
            placeholder="For example, Coconut Grove"
            aria-describedby="area-help"
          />
          <p id="area-help" className="field-hint">
            Public on your listing. Keep your exact street address out of this field.
          </p>
        </div>
      </div>
    </ActionForm>
  );
}
