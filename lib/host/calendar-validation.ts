import { Temporal } from "@js-temporal/polyfill";
import { miamiLocalToUtc, validateAvailability } from "./validation.ts";

const DAY_MS = 86_400_000;

export function validateCalendarBlock(start: string, end: string, now = Date.now()) {
  const startsAt = miamiLocalToUtc(start);
  const endsAt = miamiLocalToUtc(end);
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (endMs <= now) throw new Error("The blocked time must end in the future.");
  if (startMs < now - 366 * DAY_MS)
    throw new Error("Choose a start within the past year or in the future.");
  if (endMs <= startMs) throw new Error("The end must be later than the start.");
  if (endMs - startMs > 366 * DAY_MS) throw new Error("Block up to one year at a time.");
  return { startsAt, endsAt };
}

/** Materialize a short weekly pattern; never keep an unbounded scheduling rule. */
export function expandWeeklyAvailability(
  input: {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    weekdays: string[];
  },
  durationMinutes: number,
  now = Date.now(),
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate))
    throw new Error("Choose the first and last dates for this schedule.");
  let first: Temporal.PlainDate;
  let last: Temporal.PlainDate;
  try {
    first = Temporal.PlainDate.from(input.startDate);
    last = Temporal.PlainDate.from(input.endDate);
  } catch {
    throw new Error("Choose valid calendar dates.");
  }
  if (first.until(last).days < 0 || first.until(last).days >= 90)
    throw new Error("Choose a date range of up to 90 days.");
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime)
  )
    throw new Error("Choose a start and end time.");
  if (input.endTime <= input.startTime)
    throw new Error(
      "Weekly times must end later on the same day. Use a single window for an overnight session.",
    );
  const weekdays = new Set(input.weekdays);
  if (!weekdays.size || [...weekdays].some((value) => !/^[0-6]$/.test(value)))
    throw new Error("Select at least one day of the week.");
  const windows: { starts_at: string; ends_at: string }[] = [];
  for (let day = first; Temporal.PlainDate.compare(day, last) <= 0; day = day.add({ days: 1 })) {
    if (!weekdays.has(String(day.dayOfWeek % 7))) continue;
    const date = day.toString();
    const { startsAt, endsAt } = validateAvailability(
      `${date}T${input.startTime}`,
      `${date}T${input.endTime}`,
      durationMinutes,
      now,
    );
    windows.push({ starts_at: startsAt, ends_at: endsAt });
    if (windows.length > 40)
      throw new Error("Add up to 40 windows at once. Choose fewer days or a shorter range.");
  }
  if (!windows.length) throw new Error("The selected weekdays do not occur in that date range.");
  return windows;
}
