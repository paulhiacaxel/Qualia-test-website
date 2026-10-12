import ICAL from "ical.js";
import { Temporal } from "@js-temporal/polyfill";
import { MIAMI_TIME_ZONE } from "./validation.ts";
import type { CalendarBusyRange } from "./calendar-types.ts";

export const MAX_CALENDAR_FILE_BYTES = 512 * 1024;
const DAY_MS = 86_400_000;
const MAX_OCCURRENCES = 20_000;

function unsupported(message: string): never {
  throw new Error(
    `${message} Nothing was imported. Export a simpler calendar or block those times manually.`,
  );
}

function zoneFor(property: ICAL.Property | null, fallback = MIAMI_TIME_ZONE) {
  const supplied = property?.getParameter("tzid");
  if (!supplied) return fallback;
  if (typeof supplied !== "string") unsupported("The calendar contains an invalid time zone.");
  try {
    // Do not silently treat an unknown TZID as a floating/UTC time.
    Temporal.Now.instant().toZonedDateTimeISO(supplied);
    return supplied;
  } catch {
    unsupported("The calendar uses a time zone this importer cannot verify.");
  }
}

function instant(time: ICAL.Time, zone: string) {
  try {
    const plain = Temporal.PlainDateTime.from(
      {
        year: time.year,
        month: time.month,
        day: time.day,
        hour: time.isDate ? 0 : time.hour,
        minute: time.isDate ? 0 : time.minute,
        second: time.isDate ? 0 : time.second,
      },
      { overflow: "reject" },
    );
    return plain.toZonedDateTime(time.zone.tzid === "UTC" ? "UTC" : zone, {
      disambiguation: "reject",
    }).epochMilliseconds;
  } catch {
    unsupported("A calendar event has an invalid or ambiguous daylight-saving time.");
  }
}

function isBusy(component: ICAL.Component) {
  return (
    String(component.getFirstPropertyValue("status") ?? "").toUpperCase() !== "CANCELLED" &&
    String(component.getFirstPropertyValue("transp") ?? "").toUpperCase() !== "TRANSPARENT"
  );
}

/** Import a bounded snapshot, never a subscription. No network or raw file storage.
 * ICAL handles recurrence arithmetic; Temporal verifies IANA zones and DST.
 * Custom VTIMEZONE definitions, subdaily rules, period-valued RDATE and
 * THISANDFUTURE exceptions fail closed rather than dropping potentially busy time.
 */
export function parseCalendarBusyTimes(source: string, now = Date.now()) {
  if (!source.trim() || Buffer.byteLength(source, "utf8") > MAX_CALENDAR_FILE_BYTES)
    throw new Error("Choose an .ics calendar file no larger than 512 KB.");
  let calendar: ICAL.Component;
  try {
    calendar = new ICAL.Component(ICAL.parse(source));
  } catch {
    throw new Error(
      "This file is not a readable .ics calendar. Export it again from your calendar app.",
    );
  }
  if (calendar.name !== "vcalendar" || calendar.getFirstPropertyValue("version") !== "2.0")
    unsupported("Use an iCalendar 2.0 file.");
  const method = String(calendar.getFirstPropertyValue("method") ?? "PUBLISH").toUpperCase();
  if (method !== "PUBLISH")
    unsupported("Upload a calendar export, not an invitation or cancellation message.");
  if (calendar.getAllSubcomponents().some((item) => !["vevent", "vtimezone"].includes(item.name)))
    unsupported("The file contains unsupported calendar components.");
  const calendarZoneValue = calendar.getFirstPropertyValue("x-wr-timezone");
  const calendarZone = typeof calendarZoneValue === "string" ? calendarZoneValue : MIAMI_TIME_ZONE;
  try {
    Temporal.Now.instant().toZonedDateTimeISO(calendarZone);
  } catch {
    unsupported("The calendar's default time zone is not recognized.");
  }

  // Avoid importing mutable/global timezone definitions from untrusted files.
  // Valid IANA TZIDs use the runtime's timezone database instead.
  calendar.removeAllSubcomponents("vtimezone");
  const components = calendar.getAllSubcomponents("vevent");
  if (components.length > 2000) unsupported("This export has more than 2000 events.");
  const until = now + 366 * DAY_MS;
  const ranges: { start: number; end: number }[] = [];
  const overrides = new Map<string, Set<number>>();
  const masters = new Set<string>();

  for (const component of components) {
    if (!component.getFirstPropertyValue("uid"))
      unsupported("An event is missing its unique identifier.");
    if (component.hasProperty("exrule"))
      unsupported("This calendar uses an unsupported recurrence exclusion rule.");
    for (const property of component.getAllProperties()) {
      if (["dtstart", "dtend", "rdate", "exdate", "recurrence-id"].includes(property.name)) {
        zoneFor(property, calendarZone);
        if (property.type !== "date" && property.type !== "date-time")
          unsupported("A calendar date uses an unsupported value type.");
        // Validate the unhydrated value: ICAL can normalize an invalid date.
        for (const value of property.toJSON().slice(3)) {
          try {
            if (typeof value !== "string" || /:60(?:Z)?$/.test(value)) throw new Error();
            if (property.type === "date") Temporal.PlainDate.from(value);
            else Temporal.PlainDateTime.from(value.replace(/Z$/, ""));
          } catch {
            unsupported("The file contains an invalid calendar date.");
          }
        }
      }
    }
    const seriesStart = component.getFirstProperty("dtstart");
    if (seriesStart) {
      const startTime = seriesStart.getFirstValue() as ICAL.Time;
      for (const property of [
        ...component.getAllProperties("rdate"),
        ...component.getAllProperties("exdate"),
      ]) {
        if (
          zoneFor(property, calendarZone) !== zoneFor(seriesStart, calendarZone) ||
          property
            .getValues()
            .some(
              (value: ICAL.Time) =>
                value.isDate !== startTime.isDate ||
                (value.zone.tzid === "UTC") !== (startTime.zone.tzid === "UTC"),
            )
        )
          unsupported(
            "Added or excluded recurrence dates use a different time zone from the series.",
          );
      }
    }
    const recurrenceId = component.getFirstProperty("recurrence-id");
    if (recurrenceId?.getParameter("range"))
      unsupported("This calendar changes all future occurrences at once.");
    const uid = String(component.getFirstPropertyValue("uid"));
    if (recurrenceId) {
      const key = instant(
        recurrenceId.getFirstValue() as ICAL.Time,
        zoneFor(recurrenceId, calendarZone),
      );
      const values = overrides.get(uid) ?? new Set<number>();
      if (values.has(key)) unsupported("The export contains duplicate updates for one occurrence.");
      values.add(key);
      overrides.set(uid, values);
    } else {
      if (masters.has(uid)) unsupported("The export contains multiple versions of one event.");
      masters.add(uid);
    }
    if (component.getAllProperties("rrule").length > 1)
      unsupported("An event uses more than one recurrence rule.");
    for (const property of component.getAllProperties("rrule")) {
      const raw = property.toJSON()[3] as Record<string, unknown>;
      if (
        Object.keys(raw).some(
          (key) =>
            ![
              "freq",
              "interval",
              "count",
              "until",
              "wkst",
              "byday",
              "bymonthday",
              "bymonth",
              "bysetpos",
              "byyearday",
              "byweekno",
            ].includes(key),
        ) ||
        (raw.count !== undefined && (!Number.isInteger(raw.count) || Number(raw.count) < 1)) ||
        (raw.count !== undefined && raw.until !== undefined)
      )
        unsupported("The calendar contains an invalid or unsupported recurrence rule.");
      if (raw.until !== undefined) {
        try {
          if (typeof raw.until !== "string") throw new Error();
          if (raw.until.includes("T")) Temporal.PlainDateTime.from(raw.until.replace(/Z$/, ""));
          else Temporal.PlainDate.from(raw.until);
        } catch {
          unsupported("A recurrence end date is invalid.");
        }
      }
      const rule = property.getFirstValue() as ICAL.Recur;
      if (
        !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(rule.freq) ||
        rule.interval < 1 ||
        rule.interval > 366 ||
        Object.keys(rule.parts).some(
          (part) =>
            !["BYDAY", "BYMONTHDAY", "BYMONTH", "BYSETPOS", "BYYEARDAY", "BYWEEKNO"].includes(part),
        )
      )
        unsupported("This calendar uses a recurrence pattern that is not supported.");
      if (Object.values(rule.parts).some((values) => values.length > 366))
        unsupported("A recurrence rule is too complex.");
      const startProperty = component.getFirstProperty("dtstart");
      if (!startProperty) unsupported("A recurring event is missing its start time.");
      const startTime = startProperty.getFirstValue() as ICAL.Time;
      const zone = startTime.zone.tzid === "UTC" ? "UTC" : zoneFor(startProperty, calendarZone);
      let limit = until + 2 * DAY_MS;
      if (rule.until) {
        const originalLimit = instant(rule.until, zone);
        if (originalLimit < instant(startTime, zone))
          unsupported("A recurrence ends before its first event starts.");
        limit = Math.min(limit, originalLimit);
      }
      // ICAL has no bundled IANA tzdata. Comparing its floating local values to
      // a UTC UNTIL can lose the last occurrence. Translate the verified cutoff
      // into the series' wall time. RDATE remains independent of RRULE's cutoff.
      const cutoff = Temporal.Instant.fromEpochMilliseconds(limit)
        .toZonedDateTimeISO(zone)
        .toPlainDateTime()
        .toString({ smallestUnit: "second" });
      rule.until = ICAL.Time.fromString(
        cutoff + (startTime.zone.tzid === "UTC" ? "Z" : ""),
        undefined,
      );
      property.setValue(rule);
    }
  }

  function addRange(start: ICAL.Time, end: ICAL.Time, component: ICAL.Component) {
    const startZone = zoneFor(component.getFirstProperty("dtstart"), calendarZone);
    const endZone = zoneFor(component.getFirstProperty("dtend"), startZone);
    const startMs = instant(start, startZone);
    const endMs = instant(end, endZone);
    if (endMs <= startMs) unsupported("A busy event has no positive duration.");
    if (endMs <= now || startMs >= until) return;
    ranges.push({ start: Math.max(startMs, now), end: Math.min(endMs, until) });
    if (ranges.length > 2000) unsupported("The next year has more than 2000 busy occurrences.");
  }

  let iterations = 0;
  try {
    for (const component of components) {
      if (!isBusy(component)) continue;
      if (!component.hasProperty("dtstart")) unsupported("A busy event is missing its start time.");
      const event = new ICAL.Event(component, { exceptions: [] });
      const uid = String(event.uid);
      if (!event.isRecurring() || event.isRecurrenceException()) {
        addRange(event.startDate, event.endDate, component);
        continue;
      }
      const startZone = zoneFor(component.getFirstProperty("dtstart"), calendarZone);
      const endProperty = component.getFirstProperty("dtend");
      if (
        endProperty &&
        (zoneFor(endProperty, startZone) !== startZone ||
          (event.startDate.zone.tzid === "UTC") !== (event.endDate.zone.tzid === "UTC"))
      )
        unsupported("A recurring event uses different start and end time zones.");
      const iterator = event.iterator();
      for (let occurrence = iterator.next(); occurrence; occurrence = iterator.next()) {
        if (++iterations > MAX_OCCURRENCES)
          unsupported("The recurrence history is too large. Export a more recent date range.");
        const occurrenceMs = instant(occurrence, startZone);
        if (occurrenceMs >= until) break;
        if (overrides.get(uid)?.has(occurrenceMs)) continue;
        const details = event.getOccurrenceDetails(occurrence);
        addRange(details.startDate, details.endDate, component);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Nothing was imported.")) throw error;
    unsupported("A calendar event could not be expanded safely.");
  }
  // Merge overlap and adjacency; shared external events never create duplicate
  // occupancy, and private descriptions do not survive this conversion.
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const prior = merged.at(-1);
    if (prior && range.start <= prior.end) prior.end = Math.max(prior.end, range.end);
    else merged.push({ ...range });
  }
  const blocks: CalendarBusyRange[] = merged.map(({ start, end }) => ({
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(end).toISOString(),
  }));
  return {
    blocks,
    rangeStartsAt: new Date(now).toISOString(),
    rangeEndsAt: new Date(until).toISOString(),
  };
}
