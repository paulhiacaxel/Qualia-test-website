import { ActionForm } from "./action-form";
import { RequiredFieldLegend, RequiredMark } from "./required-field";
import { saveLocation } from "@/app/host/actions";
import type { ListingLocation } from "@/lib/host/types";

export function LocationForm({
  listingId,
  location,
  disabled,
}: {
  listingId: string;
  location: ListingLocation | null;
  disabled: boolean;
}) {
  return (
    <ActionForm action={saveLocation} label="Save private meeting details" disabled={disabled}>
      <input type="hidden" name="listingId" value={listingId} />
      <RequiredFieldLegend />
      <div>
        <label htmlFor="address-line-1" className="field-label">
          Meeting address <RequiredMark />
        </label>
        <input
          id="address-line-1"
          name="addressLine1"
          className="field-input"
          defaultValue={location?.address_line1 ?? ""}
          autoComplete="address-line1"
          minLength={3}
          maxLength={250}
          required
        />
      </div>
      <div className="field-row">
        <div>
          <label htmlFor="address-line-2" className="field-label">
            Unit, slip, or suite (optional)
          </label>
          <input
            id="address-line-2"
            name="addressLine2"
            className="field-input"
            defaultValue={location?.address_line2 ?? ""}
            autoComplete="address-line2"
            maxLength={250}
          />
        </div>
        <div>
          <label htmlFor="postal-code" className="field-label">
            ZIP code <RequiredMark />
          </label>
          <input
            id="postal-code"
            name="postalCode"
            className="field-input"
            defaultValue={location?.postal_code ?? ""}
            autoComplete="postal-code"
            inputMode="numeric"
            pattern="[0-9]{5}(-[0-9]{4})?"
            required
          />
        </div>
      </div>
      <div>
        <label htmlFor="meeting-instructions" className="field-label">
          Meeting instructions (optional)
        </label>
        <textarea
          id="meeting-instructions"
          name="meetingInstructions"
          rows={4}
          className="field-input field-textarea"
          defaultValue={location?.meeting_instructions ?? ""}
          maxLength={3000}
          placeholder="Where should a confirmed guest meet you?"
        />
      </div>
    </ActionForm>
  );
}
