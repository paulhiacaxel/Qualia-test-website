"use client";

import { useId, useState } from "react";
import { addCalendarBlock } from "@/app/host/calendar-actions";
import { ActionForm } from "./action-form";
import { RequiredMark } from "./required-field";

function nextDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function CalendarBlockForm({ selectedDate }: { selectedDate: string }) {
  const id = useId();
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState(selectedDate);
  const [endDate, setEndDate] = useState(selectedDate);
  return (
    <div className="calendar-block-form">
      <fieldset className="availability-mode">
        <legend className="field-label">Block time — Miami time</legend>
        <label>
          <input
            type="radio"
            name={`${id}-mode`}
            checked={allDay}
            onChange={() => setAllDay(true)}
          />
          Whole days
        </label>
        <label>
          <input
            type="radio"
            name={`${id}-mode`}
            checked={!allDay}
            onChange={() => setAllDay(false)}
          />
          Specific times
        </label>
      </fieldset>
      <ActionForm
        key={allDay ? "days" : "times"}
        action={addCalendarBlock}
        label="Block across all experiences"
      >
        {allDay ? (
          <>
            <input type="hidden" name="startsAt" value={startDate ? `${startDate}T00:00` : ""} />
            <input
              type="hidden"
              name="endsAt"
              value={endDate ? `${nextDate(endDate)}T00:00` : ""}
            />
            <div className="field-row">
              <div>
                <label className="field-label" htmlFor={`${id}-from`}>
                  First day <RequiredMark />
                </label>
                <input
                  className="field-input"
                  id={`${id}-from`}
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor={`${id}-through`}>
                  Last day, included <RequiredMark />
                </label>
                <input
                  className="field-input"
                  id={`${id}-through`}
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </div>
            </div>
          </>
        ) : (
          <div className="field-row">
            <div>
              <label className="field-label" htmlFor={`${id}-from-time`}>
                From — Miami time <RequiredMark />
              </label>
              <input
                className="field-input"
                id={`${id}-from-time`}
                type="datetime-local"
                name="startsAt"
                defaultValue={`${selectedDate}T09:00`}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor={`${id}-until-time`}>
                Until — Miami time <RequiredMark />
              </label>
              <input
                className="field-input"
                id={`${id}-until-time`}
                type="datetime-local"
                name="endsAt"
                defaultValue={`${selectedDate}T17:00`}
                required
              />
            </div>
          </div>
        )}
        <div>
          <label className="field-label" htmlFor={`${id}-label`}>
            Private note (optional)
          </label>
          <input
            className="field-input"
            id={`${id}-label`}
            type="text"
            name="label"
            maxLength={120}
            placeholder="Booked elsewhere, time off, travel…"
          />
          <p className="field-hint">Only you see this note. Maximum 120 characters.</p>
        </div>
        <p className="field-hint">
          A block prevents new requests across every experience you host. It does not cancel an
          existing request or booking; resolve that booking first if the times overlap. Maximum 366
          days per block.
        </p>
      </ActionForm>
    </div>
  );
}
