"use client";

import { useState } from "react";
import { ActionForm } from "./action-form";
import { RequiredFieldLegend, RequiredMark } from "./required-field";
import { createListing, saveListing, saveHostResource } from "@/app/host/actions";
import { categories, cities, MAX_LISTING_GUESTS, resourceKinds } from "@/lib/host/options";
import type { Listing, HostResource } from "@/lib/host/types";

export function ListingForm({
  listing,
  defaultCity = "Miami",
  disabled = false,
  resources = [],
  selectedResourceIds = [],
}: {
  listing?: Listing;
  defaultCity?: string;
  disabled?: boolean;
  resources?: HostResource[];
  selectedResourceIds?: string[];
}) {
  const [format, setFormat] = useState<Listing["booking_format"]>(
    listing?.booking_format ?? "private",
  );
  const [priceBasis, setPriceBasis] = useState<Listing["private_price_basis"]>(
    listing?.private_price_basis ?? "group",
  );
  const [privatePrice, setPrivatePrice] = useState(
    listing ? (listing.price_cents / 100).toFixed(2) : "",
  );
  const [sharedPrice, setSharedPrice] = useState(
    listing?.shared_price_cents ? (listing.shared_price_cents / 100).toFixed(2) : "",
  );
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
          placeholder="What will your guests experience?"
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
            The full session time, including setup and wrap-up. Your availability must fit this
            entire session.
          </p>
        </div>
      </div>
      <fieldset className="unstyled-fieldset form-stack" aria-describedby="booking-format-help">
        <legend className="field-label">Guests &amp; booking options</legend>
        <div className="field-row">
          <div>
            <label className="field-label" htmlFor="booking-format">
              How guests can book <RequiredMark />
            </label>
            <select
              id="booking-format"
              name="bookingFormat"
              className="field-input"
              value={format}
              onChange={(event) => setFormat(event.target.value as Listing["booking_format"])}
              required
            >
              <option value="private">Private only</option>
              <option value="shared">Shared only</option>
              <option value="both">Private or shared</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="max-guests">
              Maximum guests per session <RequiredMark />
            </label>
            <input
              id="max-guests"
              name="maxGuests"
              type="number"
              className="field-input"
              defaultValue={listing?.max_guests ?? 1}
              min={1}
              max={MAX_LISTING_GUESTS}
              step={1}
              required
              aria-describedby="capacity-help"
            />
          </div>
        </div>
        <p id="booking-format-help" className="field-hint">
          Private reserves the entire session for one person or their group. Shared lets separate
          bookings join the same session, up to your guest limit. With both, a private booking
          closes the session to others; once shared seats are reserved, that time can only accept
          more shared guests.
        </p>
        <p id="capacity-help" className="field-hint">
          Count all guests taking part, across every booking for that session. Set a limit your
          space, equipment and supervision can safely support. One-on-one experiences can keep a
          limit of 1.
        </p>
        {format !== "shared" ? (
          <div className="form-stack">
            <div>
              <label className="field-label" htmlFor="private-price-basis">
                How you price private bookings <RequiredMark />
              </label>
              <select
                id="private-price-basis"
                name="privatePriceBasis"
                className="field-input"
                value={priceBasis}
                onChange={(event) =>
                  setPriceBasis(event.target.value as Listing["private_price_basis"])
                }
                required
              >
                <option value="group">One price for the whole private group</option>
                <option value="per_guest">Price per guest in the private group</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="price">
                {priceBasis === "group"
                  ? "Private group price (USD)"
                  : "Private price per guest (USD)"}{" "}
                <RequiredMark />
              </label>
              <input
                id="price"
                name="price"
                type="text"
                inputMode="decimal"
                className="field-input"
                value={privatePrice}
                onChange={(event) => setPrivatePrice(event.target.value)}
                placeholder="150.00"
                pattern="[0-9]+(\.[0-9]{1,2})?"
                maxLength={10}
                required
                aria-describedby="private-price-help"
              />
              <p id="private-price-help" className="field-hint">
                {priceBasis === "group"
                  ? "The same total covers a private party of 1 up to your maximum guest count. Useful for a charter or an exclusive session."
                  : "The total is this amount multiplied by the number of guests in the private party. The session remains exclusive to their group."}
              </p>
            </div>
          </div>
        ) : null}
        {format !== "private" ? (
          <div>
            <label className="field-label" htmlFor="shared-price">
              Shared price per guest (USD) <RequiredMark />
            </label>
            <input
              id="shared-price"
              name="sharedPrice"
              type="text"
              inputMode="decimal"
              className="field-input"
              value={sharedPrice}
              onChange={(event) => setSharedPrice(event.target.value)}
              placeholder="50.00"
              pattern="[0-9]+(\.[0-9]{1,2})?"
              maxLength={10}
              required
              aria-describedby="shared-price-help"
            />
            <p id="shared-price-help" className="field-hint">
              Each booking pays this amount for every guest it brings. Guests may share the session
              with people from other bookings. Your limit applies to the whole session, not to each
              booking.
            </p>
          </div>
        ) : null}
      </fieldset>
      <fieldset className="unstyled-fieldset form-stack" aria-describedby="resource-help">
        <legend className="field-label">People, spaces &amp; equipment needed</legend>
        <p id="resource-help" className="field-hint">
          Select everything this experience needs. Reuse the same boat, captain, instructor or space
          on your other listings to keep it from being reserved twice at the same time. These names
          are for your own planning and are not shown to guests. Choose up to 10 resources.
        </p>
        {resources.length ? (
          resources.map((resource) => (
            <label className="checkbox-label" key={resource.id}>
              <input
                type="checkbox"
                name="resourceIds"
                value={resource.id}
                defaultChecked={selectedResourceIds.includes(resource.id)}
              />
              <span>
                {resource.label} <span className="muted">({resource.kind})</span>
              </span>
            </label>
          ))
        ) : (
          <p className="field-hint">
            No resources added yet. Save your draft, then add a boat, person or space below the
            experience form.
          </p>
        )}
        <p className="field-hint">
          If you select none, Qualia treats you as the shared host and prevents overlapping sessions
          across your listings. Resources protect Qualia bookings; keep bookings from other
          platforms blocked on your host calendar too.
        </p>
      </fieldset>
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

/** Kept separate from ListingForm so saving a resource never submits a partial listing. */
export function HostResourceForm({
  listingId,
  disabled = false,
}: {
  listingId: string;
  disabled?: boolean;
}) {
  return (
    <ActionForm action={saveHostResource} label="Add resource" disabled={disabled}>
      <input type="hidden" name="listingId" value={listingId} />
      <p className="field-hint">
        Save any experience edits above first. After adding a resource, select it above and save
        your experience to link them.
      </p>
      <RequiredFieldLegend />
      <div className="field-row">
        <div>
          <label className="field-label" htmlFor="resource-label">
            Resource name <RequiredMark />
          </label>
          <input
            id="resource-label"
            name="label"
            className="field-input"
            minLength={2}
            maxLength={120}
            required
            placeholder="For example, Sea Breeze or Captain Alex"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="resource-kind">
            Resource type <RequiredMark />
          </label>
          <select id="resource-kind" name="kind" className="field-input" required defaultValue="">
            <option value="" disabled>
              Choose a type
            </option>
            {resourceKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind[0].toUpperCase() + kind.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </ActionForm>
  );
}
