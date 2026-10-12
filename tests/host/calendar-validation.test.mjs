import assert from "node:assert/strict";
import { test } from "node:test";
import {
  expandWeeklyAvailability,
  validateCalendarBlock,
} from "../../lib/host/calendar-validation.ts";
import { parseCalendarBusyTimes } from "../../lib/host/calendar-ical.ts";

const now = Date.parse("2026-10-12T18:00:00Z");
const event = (body, uid = "lesson") => `BEGIN:VEVENT\nUID:${uid}\n${body}\nEND:VEVENT`;
const calendar = (...events) => `BEGIN:VCALENDAR\nVERSION:2.0\n${events.join("\n")}\nEND:VCALENDAR`;
const parse = (...events) => parseCalendarBusyTimes(calendar(...events), now).blocks;

test("manual blocks accept ongoing absences, preserve Miami DST and bound the range", () => {
  assert.deepEqual(validateCalendarBlock("2026-10-12T12:00", "2026-10-13T12:00", now), {
    startsAt: "2026-10-12T16:00:00Z",
    endsAt: "2026-10-13T16:00:00Z",
  });
  for (const [start, end] of [
    ["2026-10-11T12:00", "2026-10-12T12:00"],
    ["2026-11-01T01:30", "2026-11-01T04:00"],
    ["2026-10-13T12:00", "2027-12-01T12:00"],
  ])
    assert.throws(() => validateCalendarBlock(start, end, now));
});

test("weekly availability crosses DST at the same Miami wall time and validates the whole batch", () => {
  const input = {
    startDate: "2026-10-20",
    endDate: "2026-11-03",
    startTime: "10:00",
    endTime: "12:00",
    weekdays: ["2"],
  };
  const times = expandWeeklyAvailability(input, 60, now);
  assert.equal(times.length, 3);
  assert.equal(times[0].starts_at, "2026-10-20T14:00:00Z");
  assert.equal(times[2].starts_at, "2026-11-03T15:00:00Z");
  for (const overrides of [
    { weekdays: [] },
    { weekdays: ["8"] },
    { endTime: "09:00" },
    { endDate: "2027-03-01" },
    { startDate: "2026-02-30" },
    { startDate: "2026-11-01", endDate: "2026-11-01", startTime: "01:30", weekdays: ["0"] },
  ])
    assert.throws(() => expandWeeklyAvailability({ ...input, ...overrides }, 60, now));
  assert.throws(
    () =>
      expandWeeklyAvailability(
        {
          ...input,
          startDate: "2026-10-13",
          endDate: "2026-12-01",
          weekdays: ["0", "1", "2", "3", "4", "5", "6"],
        },
        60,
        now,
      ),
    /40 windows/,
  );
});

test("ICS supports UTC, IANA zones without VTIMEZONE and floating Miami times", () => {
  assert.deepEqual(parse(event("DTSTART:20261013T140000Z\nDTEND:20261013T150000Z")), [
    { starts_at: "2026-10-13T14:00:00.000Z", ends_at: "2026-10-13T15:00:00.000Z" },
  ]);
  assert.deepEqual(
    parse(
      event(
        "DTSTART;TZID=America/New_York:20261013T100000\nDTEND;TZID=America/New_York:20261013T110000",
      ),
    ),
    parse(event("DTSTART:20261013T100000\nDTEND:20261013T110000")),
  );
  assert.equal(
    parse(
      event("DTSTART;TZID=Europe/Paris:20261013T160000\nDTEND;TZID=Europe/Paris:20261013T170000"),
    )[0].starts_at,
    "2026-10-13T14:00:00.000Z",
  );
});

test("all-day events have an exclusive next-day boundary and correctly span DST", () => {
  assert.deepEqual(parse(event("DTSTART;VALUE=DATE:20261101\nDTEND;VALUE=DATE:20261102")), [
    { starts_at: "2026-11-01T04:00:00.000Z", ends_at: "2026-11-02T05:00:00.000Z" },
  ]);
  assert.deepEqual(
    parse(event("DTSTART;VALUE=DATE:20261101")),
    parse(event("DTSTART;VALUE=DATE:20261101\nDTEND;VALUE=DATE:20261102")),
  );
});

test("weekly recurrence honors local DST, EXDATE and added RDATE", () => {
  const blocks = parse(
    event(
      "DTSTART;TZID=America/New_York:20261020T100000\nDTEND;TZID=America/New_York:20261020T110000\nRRULE:FREQ=WEEKLY;COUNT=3\nEXDATE;TZID=America/New_York:20261027T100000\nRDATE;TZID=America/New_York:20261105T100000",
    ),
  );
  assert.deepEqual(
    blocks.map((block) => block.starts_at),
    ["2026-10-20T14:00:00.000Z", "2026-11-03T15:00:00.000Z", "2026-11-05T15:00:00.000Z"],
  );
});

test("modified and cancelled recurrence exceptions replace the original busy interval", () => {
  const blocks = parse(
    event(
      "DTSTART;TZID=America/New_York:20261020T100000\nDTEND;TZID=America/New_York:20261020T110000\nRRULE:FREQ=WEEKLY;COUNT=3",
    ),
    event(
      "RECURRENCE-ID;TZID=America/New_York:20261027T100000\nDTSTART;TZID=America/New_York:20261028T120000\nDTEND;TZID=America/New_York:20261028T130000",
    ),
    event("RECURRENCE-ID;TZID=America/New_York:20261103T100000\nSTATUS:CANCELLED"),
  );
  assert.deepEqual(
    blocks.map((block) => block.starts_at),
    ["2026-10-20T14:00:00.000Z", "2026-10-28T16:00:00.000Z"],
  );
});

test("private event details and transparent/cancelled events are not retained", () => {
  const blocks = parse(
    event(
      "DTSTART:20261013T140000Z\nDTEND:20261013T150000Z\nSUMMARY:PRIVATE PATIENT\nDESCRIPTION:PRIVATE DETAILS\nLOCATION:HOME",
    ),
    event("DTSTART:20261013T150000Z\nDTEND:20261013T160000Z", "adjacent"),
    event("DTSTART:20261014T140000Z\nDTEND:20261014T150000Z\nTRANSP:TRANSPARENT", "free"),
    event("DTSTART:20261015T140000Z\nDTEND:20261015T150000Z\nSTATUS:CANCELLED", "cancelled"),
  );
  assert.deepEqual(blocks, [
    { starts_at: "2026-10-13T14:00:00.000Z", ends_at: "2026-10-13T16:00:00.000Z" },
  ]);
  assert.doesNotMatch(JSON.stringify(blocks), /PRIVATE|HOME/);
});

test("unsupported or ambiguous ICS features reject the entire import rather than dropping busy time", () => {
  const valid = event("DTSTART:20261013T140000Z\nDTEND:20261013T150000Z", "valid");
  for (const body of [
    "DTSTART;TZID=Unknown/Private:20261014T100000\nDTEND;TZID=Unknown/Private:20261014T110000",
    "DTSTART;TZID=America/New_York:20261101T013000\nDTEND;TZID=America/New_York:20261101T033000",
    "DTSTART:20270230T140000Z\nDTEND:20270301T160000Z",
    "DTSTART:20261014T140000Z\nDTEND:20261014T150000Z\nRRULE:FREQ=SECONDLY",
    "DTSTART:20261014T140000Z\nDTEND:20261014T150000Z\nRRULE:FREQ=DAILY;COUNT=-1",
    "DTSTART:20261014T140000Z\nDTEND:20261014T150000Z\nRRULE:FREQ=DAILY;UNTIL=20260230T100000Z",
    "DTSTART:20261014T140000Z\nDTEND:20261014T150000Z\nRRULE:FREQ=DAILY;BOGUS=1",
    "DTSTART;TZID=America/New_York:20261014T100000\nDTEND;TZID=America/New_York:20261014T110000\nRDATE:20261015T140000Z",
    "DTSTART:20261014T140000Z\nDTEND:20261014T150000Z\nRDATE;VALUE=PERIOD:20261014T140000Z/PT1H",
    "DTSTART:20261014T140000Z\nDTEND:20261014T150000Z\nRECURRENCE-ID;RANGE=THISANDFUTURE:20261014T140000Z",
  ])
    assert.throws(() => parse(valid, event(body)), /Nothing was imported/);
  assert.throws(
    () =>
      parseCalendarBusyTimes(
        calendar(valid).replace("VERSION:2.0", "VERSION:2.0\nMETHOD:CANCEL"),
        now,
      ),
    /calendar export/,
  );
  assert.throws(() => parseCalendarBusyTimes("x".repeat(512 * 1024 + 1), now), /512 KB/);
});

test("infinite recurrence is bounded to the imported horizon and monthly rules work", () => {
  const result = parseCalendarBusyTimes(
    calendar(event("DTSTART:20261013T140000Z\nDTEND:20261013T150000Z\nRRULE:FREQ=DAILY")),
    now,
  );
  assert.equal(result.blocks.length, 366);
  assert.ok(result.blocks.every((block) => block.ends_at <= result.rangeEndsAt));
  assert.deepEqual(
    parse(
      event("DTSTART:20261015T140000Z\nDTEND:20261015T150000Z\nRRULE:FREQ=MONTHLY;COUNT=3"),
    ).map((block) => block.starts_at),
    ["2026-10-15T14:00:00.000Z", "2026-11-15T14:00:00.000Z", "2026-12-15T14:00:00.000Z"],
  );
});

test("UTC UNTIL includes the final IANA-local occurrence even without VTIMEZONE", () => {
  const blocks = parse(
    event(
      "DTSTART;TZID=Europe/Paris:20261013T160000\nDTEND;TZID=Europe/Paris:20261013T170000\nRRULE:FREQ=DAILY;UNTIL=20261014T140000Z",
    ),
  );
  assert.deepEqual(
    blocks.map((block) => block.starts_at),
    ["2026-10-13T14:00:00.000Z", "2026-10-14T14:00:00.000Z"],
  );
});

test("an added recurrence date after RRULE UNTIL remains busy", () => {
  const blocks = parse(
    event(
      "DTSTART;TZID=Europe/Paris:20261013T160000\nDTEND;TZID=Europe/Paris:20261013T170000\nRRULE:FREQ=DAILY;UNTIL=20261014T140000Z\nRDATE;TZID=Europe/Paris:20261016T160000",
    ),
  );
  assert.deepEqual(
    blocks.map((block) => block.starts_at),
    ["2026-10-13T14:00:00.000Z", "2026-10-14T14:00:00.000Z", "2026-10-16T14:00:00.000Z"],
  );
});
