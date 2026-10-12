export type HostCalendarBlock = {
  id: string;
  starts_at: string;
  ends_at: string;
  label: string;
  source: "manual" | "ical";
  import_id: string | null;
};

export type HostCalendarImport = {
  id: string;
  label: string;
  imported_at: string;
  range_starts_at: string;
  range_ends_at: string;
  event_count: number;
};

export type CalendarBusyRange = { starts_at: string; ends_at: string };
