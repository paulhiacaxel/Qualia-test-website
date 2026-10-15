import { ActionForm } from "./action-form";
import { CalendarBlockForm } from "./calendar-block-form";
import { RequiredFieldLegend, RequiredMark } from "./required-field";
import {
  importCalendarFile,
  removeCalendarBlock,
  removeCalendarImport,
} from "@/app/host/calendar-actions";
import { formatMiamiDate } from "@/lib/host/validation";
import type { HostCalendarBlock, HostCalendarImport } from "@/lib/host/calendar-types";

function CalendarUpload({ existing }: { existing?: HostCalendarImport }) {
  const id = existing?.id ?? "new";
  return (
    <ActionForm
      action={importCalendarFile}
      label={existing ? "Replace this calendar snapshot" : "Import busy times"}
    >
      {existing ? <input name="importId" type="hidden" value={existing.id} /> : null}
      <div>
        <label className="field-label" htmlFor={`calendar-label-${id}`}>
          Calendar name <RequiredMark />
        </label>
        <input
          className="field-input"
          name="calendarLabel"
          id={`calendar-label-${id}`}
          maxLength={120}
          defaultValue={existing?.label}
          placeholder="My other bookings"
          required
        />
      </div>
      <div>
        <label className="field-label" htmlFor={`calendar-file-${id}`}>
          Calendar file (.ics) <RequiredMark />
        </label>
        <input
          className="field-input"
          name="calendarFile"
          id={`calendar-file-${id}`}
          type="file"
          accept=".ics,text/calendar"
          aria-describedby={`calendar-file-help-${id}`}
          required
        />
        <p className="field-hint" id={`calendar-file-help-${id}`}>
          Export an iCalendar (.ics) file from your other calendar. Maximum 512 KB. Busy events
          within the next 12 months are imported; event titles are not saved. All-day events and
          times without a time zone use Miami time.
        </p>
      </div>
      <p className="field-hint">
        The whole upload is checked before saving. If a busy event overlaps an active Qualia booking
        or uses an unsupported calendar format, the import fails with guidance. Your existing blocks
        stay in place.
      </p>
    </ActionForm>
  );
}

export function CalendarBlockManager({
  blocks,
  imports,
  selectedDate,
}: {
  blocks: HostCalendarBlock[];
  imports: HostCalendarImport[];
  selectedDate: string;
}) {
  const manual = blocks.filter((block) => block.source === "manual");
  return (
    <section id="blocked-time" className="host-calendar-blocks" aria-labelledby="blocked-heading">
      <div className="calendar-section-heading">
        <div>
          <span className="eyebrow">Keep your time yours</span>
          <h2 id="blocked-heading">Blocked time &amp; other calendars</h2>
        </div>
        <span className="calendar-time-zone">Miami · America/New_York</span>
      </div>
      <div className="calendar-tools-grid">
        <div className="panel">
          <h3>Block dates or hours</h3>
          <RequiredFieldLegend />
          <CalendarBlockForm key={selectedDate} selectedDate={selectedDate} />
        </div>
        <div className="panel">
          <h3>Already taking bookings elsewhere?</h3>
          <p>
            Upload that calendar&apos;s busy times to block them on Qualia. Or add a block manually
            as soon as another booking arrives.
          </p>
          <p className="notice">
            <strong>Uploads are snapshots, not a live connection.</strong> New or changed bookings
            elsewhere will not appear automatically. Upload a fresh file whenever that calendar
            changes, and check both calendars before accepting a request.
          </p>
          <RequiredFieldLegend />
          <CalendarUpload />
        </div>
      </div>
      {manual.length ? (
        <div className="calendar-saved-blocks">
          <h3>Your blocked time ({manual.length})</h3>
          <ul className="availability-window-list">
            {manual.map((block) => (
              <li key={block.id}>
                <div className="availability-window-summary">
                  <div>
                    <strong>{block.label || "Unavailable"}</strong>
                    <span className="availability-window-end">
                      <time dateTime={block.starts_at}>{formatMiamiDate(block.starts_at)}</time> —{" "}
                      <time dateTime={block.ends_at}>{formatMiamiDate(block.ends_at)}</time>
                    </span>
                  </div>
                  <ActionForm action={removeCalendarBlock} label="Unblock time" danger>
                    <input type="hidden" name="blockId" value={block.id} />
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
          <p className="field-hint">
            Unblocking restores any saved hosting hours underneath. It does not create new hosting
            hours.
          </p>
        </div>
      ) : null}
      {imports.length ? (
        <div className="calendar-saved-imports">
          <h3>Imported calendars ({imports.length})</h3>
          {imports.map((item) => (
            <details className="panel calendar-import" key={item.id}>
              <summary>{item.label}</summary>
              <div>
                <p>
                  <strong>
                    {item.event_count} busy {item.event_count === 1 ? "range" : "ranges"}
                  </strong>{" "}
                  in this snapshot.
                </p>
                <p className="field-hint">
                  Last uploaded{" "}
                  <time dateTime={item.imported_at}>{formatMiamiDate(item.imported_at)}</time>.
                  Changes elsewhere since this upload are not included.
                </p>
                <p className="field-hint">
                  Import range: {formatMiamiDate(item.range_starts_at)} —{" "}
                  {formatMiamiDate(item.range_ends_at)}.
                </p>
                <h4>Update this snapshot</h4>
                <CalendarUpload existing={item} />
                <details className="calendar-import-remove">
                  <summary>Remove this imported calendar</summary>
                  <p>
                    Its busy times will be unblocked across all your experiences. Saved hosting
                    hours may become bookable again.
                  </p>
                  <ActionForm
                    action={removeCalendarImport}
                    label="Remove calendar & unblock its times"
                    danger
                  >
                    <input type="hidden" name="importId" value={item.id} />
                  </ActionForm>
                </details>
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}
