import Link from "next/link";
import { Temporal } from "@js-temporal/polyfill";
import { ActionForm } from "./action-form";
import { AvailabilityEditor } from "./availability-editor";
import { RequiredFieldLegend } from "./required-field";
import { removeAvailability } from "@/app/host/actions";
import { formatMiamiDate } from "@/lib/host/validation";
import type { AvailabilityWindow } from "@/lib/host/types";
import "./calendar.css";

function localInput(value: string) {
  return Temporal.Instant.from(value)
    .toZonedDateTimeISO("America/New_York")
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}

export function AvailabilityManager({
  listingId,
  windows,
  editable,
  canAdd = editable,
  durationMinutes,
}: {
  listingId: string;
  windows: AvailabilityWindow[];
  editable: boolean;
  canAdd?: boolean;
  durationMinutes: number;
}) {
  const now = Date.now();
  const today = Temporal.Now.instant()
    .toZonedDateTimeISO("America/New_York")
    .toPlainDate()
    .toString();
  const upcoming = windows
    .filter((window) => Date.parse(window.ends_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = windows.filter((window) => Date.parse(window.ends_at) <= now);
  return (
    <div className="availability-workspace">
      <div className="availability-intro">
        <span className="calendar-time-zone">Miami · America/New_York</span>
        <p>
          Choose when you can teach this experience. Guests request a{" "}
          <strong>{durationMinutes}-minute session</strong> within your saved hours.
        </p>
        <RequiredFieldLegend />
        <p className="field-hint">Saving hours does not publish your listing.</p>
      </div>
      {canAdd && !editable ? (
        <p className="notice">
          You can add hours during review. Existing hours stay locked until review is complete.
        </p>
      ) : null}
      {canAdd ? (
        <section className="availability-add" aria-labelledby={`add-hours-${listingId}`}>
          <h3 id={`add-hours-${listingId}`}>Add hosting hours</h3>
          <AvailabilityEditor
            listingId={listingId}
            durationMinutes={durationMinutes}
            today={today}
          />
        </section>
      ) : null}
      <section aria-labelledby={`saved-hours-${listingId}`}>
        <div className="availability-saved-heading">
          <h3 id={`saved-hours-${listingId}`}>Saved hours</h3>
          <span>
            {upcoming.length} upcoming {upcoming.length === 1 ? "window" : "windows"}
          </span>
        </div>
        {upcoming.length ? (
          <ul className="availability-window-list">
            {upcoming.map((window) => (
              <li key={window.id}>
                <div className="availability-window-summary">
                  <div>
                    <time dateTime={window.starts_at}>{formatMiamiDate(window.starts_at)}</time>
                    <span className="availability-window-end">
                      until <time dateTime={window.ends_at}>{formatMiamiDate(window.ends_at)}</time>
                    </span>
                  </div>
                  {editable ? (
                    <ActionForm action={removeAvailability} label="Remove hours" danger>
                      <input type="hidden" name="listingId" value={listingId} />
                      <input type="hidden" name="windowId" value={window.id} />
                    </ActionForm>
                  ) : null}
                </div>
                {editable && Date.parse(window.starts_at) > now ? (
                  <details className="availability-edit">
                    <summary>Edit these hours</summary>
                    <AvailabilityEditor
                      listingId={listingId}
                      durationMinutes={durationMinutes}
                      today={today}
                      initialWindow={{
                        id: window.id,
                        startsAt: localInput(window.starts_at),
                        endsAt: localInput(window.ends_at),
                      }}
                    />
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="host-empty">
            No upcoming hours yet. Add at least one future window long enough for a full session
            before submitting for review.
          </p>
        )}
        <p className="field-hint">
          Bookings and blocked time take priority over these hours. You cannot change or remove
          hours needed by an active request or booking.
        </p>
      </section>
      <div className="availability-block-help">
        <h3>Need time off or booked elsewhere?</h3>
        <p>
          Block a day or a date range across all your experiences. You can also upload an external
          calendar to block its busy times.
        </p>
        <Link className="text-link" href="/host/calendar#blocked-time">
          Manage blocked time &amp; external calendars →
        </Link>
      </div>
      {past.length ? (
        <details className="availability-past">
          <summary>Past hosting windows ({past.length})</summary>
          <ul>
            {past.map((window) => (
              <li key={window.id}>
                {formatMiamiDate(window.starts_at)} — {formatMiamiDate(window.ends_at)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
