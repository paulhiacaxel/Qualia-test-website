import { ActionForm } from "./action-form";
import { addAvailability, removeAvailability } from "@/app/host/actions";
import { formatMiamiDate } from "@/lib/host/validation";
import type { AvailabilityWindow } from "@/lib/host/types";

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
  return (
    <>
      <p>
        Add the times you can host. Each window should fit at least one {durationMinutes}-minute
        session. All times below are in <strong>Miami time (America/New_York)</strong>.
      </p>
      {windows.length ? (
        <ul className="availability-list">
          {windows.map((window) => (
            <li key={window.id}>
              <div>
                <time dateTime={window.starts_at}>{formatMiamiDate(window.starts_at)}</time>
                <span className="availability-separator">to</span>
                <time dateTime={window.ends_at}>{formatMiamiDate(window.ends_at)}</time>
              </div>
              {editable ? (
                <ActionForm action={removeAvailability} label="Remove" danger>
                  <input type="hidden" name="listingId" value={listingId} />
                  <input type="hidden" name="windowId" value={window.id} />
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="host-empty">No availability yet. Add a future window before submitting.</p>
      )}
      {canAdd && !editable ? (
        <p className="field-hint">
          You can add future times while your listing is being reviewed. Existing times and
          experience details remain locked.
        </p>
      ) : null}
      {canAdd ? (
        <ActionForm action={addAvailability} label="Add availability">
          <input type="hidden" name="listingId" value={listingId} />
          <div className="field-row">
            <div>
              <label htmlFor={`starts-at-${listingId}`} className="field-label">
                Start — Miami time
              </label>
              <input
                id={`starts-at-${listingId}`}
                name="startsAt"
                type="datetime-local"
                className="field-input"
                required
              />
            </div>
            <div>
              <label htmlFor={`ends-at-${listingId}`} className="field-label">
                End — Miami time
              </label>
              <input
                id={`ends-at-${listingId}`}
                name="endsAt"
                type="datetime-local"
                className="field-input"
                required
              />
            </div>
          </div>
          <p className="field-hint">
            Use a future window of up to 24 hours. Times that repeat or don&apos;t exist during
            daylight-saving changes cannot be selected.
          </p>
        </ActionForm>
      ) : null}
    </>
  );
}
