"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdultHost } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOwnedListing } from "@/lib/host/data";
import { idSchema, validateAvailability } from "@/lib/host/validation";
import { expandWeeklyAvailability, validateCalendarBlock } from "@/lib/host/calendar-validation";
import { MAX_CALENDAR_FILE_BYTES, parseCalendarBusyTimes } from "@/lib/host/calendar-ical";
import type { HostActionState } from "@/lib/host/types";

const connectionError = {
  error: "Your calendar could not be saved. Please try again in a moment.",
};
const labelSchema = z.string().trim().max(120, "Use a label under 120 characters.");

function refreshCalendar(listingId?: string) {
  revalidatePath("/host/calendar");
  revalidatePath("/host/dashboard");
  revalidatePath("/experiences/[id]", "page");
  if (listingId) {
    revalidatePath(`/host/listings/${listingId}/edit`);
    revalidatePath(`/host/listings/${listingId}/preview`);
  }
}

function calendarError(error: { code?: string }): HostActionState {
  if (error.code === "QL002")
    return {
      error:
        "This time overlaps an active Qualia request or booking. Open it in your calendar and resolve it before blocking this time. Nothing was changed.",
    };
  if (error.code === "23P01")
    return {
      error:
        "Some times overlap availability you already saved. Adjust the range and try again. Nothing was changed.",
    };
  if (error.code === "54000")
    return {
      error:
        "Your calendar has reached its limit. Remove an unused block or replace an existing import.",
    };
  if (error.code === "55000")
    return {
      error:
        "This availability is locked by review, a pause, or an active booking. You can block other times from your host calendar.",
    };
  return connectionError;
}

export async function addCalendarBlock(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireAdultHost();
  const label = labelSchema.safeParse(formData.get("label") ?? "");
  if (!label.success) return { error: label.error.issues[0].message };
  let range: ReturnType<typeof validateCalendarBlock>;
  try {
    range = validateCalendarBlock(
      String(formData.get("startsAt") ?? ""),
      String(formData.get("endsAt") ?? ""),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Choose a valid busy range." };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_host_calendar_block", {
      p_starts_at: range.startsAt,
      p_ends_at: range.endsAt,
      p_label: label.data,
    });
    if (error) return calendarError(error);
  } catch {
    return connectionError;
  }
  refreshCalendar();
  return {
    success:
      "This time is blocked across all your experiences. Existing bookings were not changed.",
  };
}

export async function removeCalendarBlock(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireAdultHost();
  const id = idSchema.safeParse(formData.get("blockId"));
  if (!id.success) return { error: "This block could not be found." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_host_calendar_block", { p_block_id: id.data });
    if (error) return calendarError(error);
  } catch {
    return connectionError;
  }
  refreshCalendar();
  return {
    success: "Block removed. Your saved availability determines which times guests can request.",
  };
}

export async function importCalendarFile(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireAdultHost();
  const label = labelSchema
    .min(1, "Name this calendar so you can find it later.")
    .safeParse(formData.get("calendarLabel"));
  if (!label.success) return { error: label.error.issues[0].message };
  const idValue = formData.get("importId");
  const id = idValue ? idSchema.safeParse(idValue) : null;
  if (id && !id.success) return { error: "This calendar import could not be found." };
  const file = formData.get("calendarFile");
  if (!(file instanceof File) || !file.size || !/\.ics$/i.test(file.name))
    return { error: "Choose an .ics file exported from your other calendar." };
  if (file.size > MAX_CALENDAR_FILE_BYTES)
    return { error: "Choose a calendar file no larger than 512 KB." };
  let parsed: ReturnType<typeof parseCalendarBusyTimes>;
  try {
    parsed = parseCalendarBusyTimes(await file.text());
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "This calendar could not be read. Nothing was changed.",
    };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_host_calendar_import", {
      p_import_id: id?.success ? id.data : null,
      p_label: label.data,
      p_range_starts_at: parsed.rangeStartsAt,
      p_range_ends_at: parsed.rangeEndsAt,
      p_blocks: parsed.blocks,
    });
    if (error) return calendarError(error);
  } catch {
    return connectionError;
  }
  refreshCalendar();
  return {
    success: `Calendar snapshot saved with ${parsed.blocks.length} busy range${parsed.blocks.length === 1 ? "" : "s"} for the next 12 months. Upload a fresh export whenever your other calendar changes.`,
  };
}

export async function removeCalendarImport(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireAdultHost();
  const id = idSchema.safeParse(formData.get("importId"));
  if (!id.success) return { error: "This calendar import could not be found." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_host_calendar_import", { p_import_id: id.data });
    if (error) return calendarError(error);
  } catch {
    return connectionError;
  }
  refreshCalendar();
  return {
    success:
      "Imported calendar and its busy times removed. Your manual blocks and Qualia bookings remain.",
  };
}

export async function addWeeklyAvailability(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireAdultHost();
  const id = idSchema.safeParse(formData.get("listingId"));
  if (!id.success) return { error: "This experience could not be found." };
  const listing = await getOwnedListing(id.data);
  let windows: ReturnType<typeof expandWeeklyAvailability>;
  try {
    windows = expandWeeklyAvailability(
      {
        startDate: String(formData.get("startDate") ?? ""),
        endDate: String(formData.get("endDate") ?? ""),
        startTime: String(formData.get("startTime") ?? ""),
        endTime: String(formData.get("endTime") ?? ""),
        weekdays: formData.getAll("weekdays").map(String),
      },
      listing.duration_minutes,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Choose a valid weekly schedule." };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_availability_windows", {
      p_listing_id: id.data,
      p_windows: windows,
    });
    if (error) return calendarError(error);
  } catch {
    return connectionError;
  }
  refreshCalendar(id.data);
  return {
    success: `${windows.length} availability windows saved in Miami time. Blocked times and existing bookings remain unavailable to guests.`,
  };
}

export async function editAvailability(
  _state: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  await requireAdultHost();
  const id = idSchema.safeParse(formData.get("listingId"));
  const windowId = idSchema.safeParse(formData.get("windowId"));
  if (!id.success || !windowId.success) return { error: "This availability could not be found." };
  const listing = await getOwnedListing(id.data);
  let range: ReturnType<typeof validateAvailability>;
  try {
    range = validateAvailability(
      String(formData.get("startsAt") ?? ""),
      String(formData.get("endsAt") ?? ""),
      listing.duration_minutes,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Choose valid availability times." };
  }
  try {
    const supabase = await createClient();
    const { data, error: readError } = await supabase
      .from("availability_windows")
      .select("id")
      .eq("id", windowId.data)
      .eq("listing_id", id.data)
      .single();
    if (readError || !data) return { error: "This availability could not be found." };
    const { error } = await supabase.rpc("edit_availability_window", {
      p_window_id: windowId.data,
      p_starts_at: range.startsAt,
      p_ends_at: range.endsAt,
    });
    if (error) return calendarError(error);
  } catch {
    return connectionError;
  }
  refreshCalendar(id.data);
  return { success: "Availability updated in Miami time." };
}
