import "server-only";
import { requireHost } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { HostCalendarBlock, HostCalendarImport } from "./calendar-types";

export async function getHostCalendarBlocks() {
  const { user } = await requireHost();
  const supabase = await createClient();
  const { data: imports, error: importsError } = await supabase
    .from("host_calendar_imports")
    .select("id,label,imported_at,range_starts_at,range_ends_at,event_count")
    .eq("host_id", user.id)
    .order("imported_at", { ascending: false });
  if (importsError) throw new Error("Your blocked times could not be loaded. Please try again.");
  const blocks: HostCalendarBlock[] = [];
  // Explicit pages avoid Supabase's response-row cap silently hiding busy time.
  // The database bounds this to five 2000-range imports and 500 manual blocks.
  for (let offset = 0; offset <= 10500; offset += 500) {
    const { data, error } = await supabase
      .from("host_calendar_blocks")
      .select("id,starts_at,ends_at,label,source,import_id")
      .eq("host_id", user.id)
      .gt("ends_at", new Date().toISOString())
      .order("starts_at")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("Your blocked times could not be loaded. Please try again.");
    blocks.push(...((data ?? []) as HostCalendarBlock[]));
    if (!data || data.length < 500) break;
  }
  return {
    blocks,
    imports: (imports ?? []) as HostCalendarImport[],
  };
}
