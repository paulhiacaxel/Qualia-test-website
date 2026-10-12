"use client";

import { useId, useState } from "react";
import { ActionForm } from "./action-form";
import { RequiredMark } from "./required-field";
import { addAvailability } from "@/app/host/actions";
import { addWeeklyAvailability, editAvailability } from "@/app/host/calendar-actions";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Keep input in Miami wall time; only server actions convert it to UTC. */
export function AvailabilityEditor({
  listingId,
  durationMinutes,
  today,
  initialWindow,
}: {
  listingId: string;
  durationMinutes: number;
  today: string;
  initialWindow?: { id: string; startsAt: string; endsAt: string };
}) {
  const id = useId();
  const [repeats, setRepeats] = useState(false);
  const [startDate, setStartDate] = useState(initialWindow?.startsAt.slice(0, 10) ?? "");
  const [startTime, setStartTime] = useState(initialWindow?.startsAt.slice(11, 16) ?? "");
  const [endDate, setEndDate] = useState(initialWindow?.endsAt.slice(0, 10) ?? "");
  const [endTime, setEndTime] = useState(initialWindow?.endsAt.slice(11, 16) ?? "");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  return (
    <div className="availability-editor">
      {!initialWindow ? (
        <fieldset className="availability-mode">
          <legend className="field-label">How often?</legend>
          <label>
            <input
              type="radio"
              name={`${id}-mode`}
              checked={!repeats}
              onChange={() => {
                setRepeats(false);
                setEndDate("");
              }}
            />
            One date
          </label>
          <label>
            <input
              type="radio"
              name={`${id}-mode`}
              checked={repeats}
              onChange={() => {
                setRepeats(true);
                setEndDate("");
              }}
            />
            Repeat weekly
          </label>
        </fieldset>
      ) : null}
      <ActionForm
        key={repeats ? "weekly" : "once"}
        action={
          initialWindow ? editAvailability : repeats ? addWeeklyAvailability : addAvailability
        }
        label={
          initialWindow ? "Save changed hours" : repeats ? "Add weekly hours" : "Add these hours"
        }
      >
        <input type="hidden" name="listingId" value={listingId} />
        {initialWindow ? <input type="hidden" name="windowId" value={initialWindow.id} /> : null}
        {!repeats ? (
          <>
            <input
              type="hidden"
              name="startsAt"
              value={startDate && startTime ? `${startDate}T${startTime}` : ""}
            />
            <input
              type="hidden"
              name="endsAt"
              value={(endDate || startDate) && endTime ? `${endDate || startDate}T${endTime}` : ""}
            />
          </>
        ) : null}
        <div className="field-row">
          <div>
            <label className="field-label" htmlFor={`${id}-start-date`}>
              {repeats ? "From date" : "Date"} <RequiredMark />
            </label>
            <input
              className="field-input"
              type="date"
              id={`${id}-start-date`}
              name={repeats ? "startDate" : undefined}
              min={today}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor={`${id}-end-date`}>
              {repeats ? "Through date" : "End date"} {repeats ? <RequiredMark /> : "(optional)"}
            </label>
            <input
              className="field-input"
              type="date"
              id={`${id}-end-date`}
              name={repeats ? "endDate" : undefined}
              min={startDate || today}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required={repeats}
              aria-describedby={!repeats ? `${id}-overnight` : undefined}
            />
            {!repeats ? (
              <p className="field-hint" id={`${id}-overnight`}>
                Leave blank for the same day. Choose the next day for overnight hours.
              </p>
            ) : null}
          </div>
        </div>
        {repeats ? (
          <fieldset className="availability-weekdays">
            <legend className="field-label">
              Repeat on <RequiredMark />
            </legend>
            <p className="field-hint">Choose at least one day.</p>
            <div>
              {weekdays.map((day, index) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={index}
                    checked={selectedWeekdays.includes(index)}
                    required={index === 0 && selectedWeekdays.length === 0}
                    onChange={(event) =>
                      setSelectedWeekdays((current) =>
                        event.target.checked
                          ? [...current, index]
                          : current.filter((dayIndex) => dayIndex !== index),
                      )
                    }
                  />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div className="field-row">
          <div>
            <label className="field-label" htmlFor={`${id}-start-time`}>
              Start time <RequiredMark />
            </label>
            <input
              className="field-input"
              type="time"
              id={`${id}-start-time`}
              name={repeats ? "startTime" : undefined}
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor={`${id}-end-time`}>
              End time <RequiredMark />
            </label>
            <input
              className="field-input"
              type="time"
              id={`${id}-end-time`}
              name={repeats ? "endTime" : undefined}
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              required
            />
          </div>
        </div>
        <p className="field-hint">
          All times are Miami time. Leave at least {durationMinutes} minutes for one full session.
          {repeats
            ? " Choose up to 90 days and no more than 40 windows. Each day must end after it starts. Weekly hours are saved as individual dates, so you can adjust them later."
            : " Each window can span up to 24 hours."}{" "}
          Times that repeat or do not exist during a daylight-saving change cannot be saved.
        </p>
      </ActionForm>
    </div>
  );
}
