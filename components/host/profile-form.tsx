import { ActionForm } from "./action-form";
import { RequiredFieldLegend, RequiredMark } from "./required-field";
import { saveHostProfile } from "@/app/host/actions";
import { cities } from "@/lib/host/validation";
import type { HostProfile } from "@/lib/host/types";

export function ProfileForm({
  profile,
  defaultName,
  disabled = false,
}: {
  profile: HostProfile | null;
  defaultName: string;
  disabled?: boolean;
}) {
  return (
    <ActionForm action={saveHostProfile} label="Save host profile" disabled={disabled}>
      <RequiredFieldLegend allowDraft />
      <div>
        <label className="field-label" htmlFor="display-name">
          Name guests will see <RequiredMark />
        </label>
        <input
          id="display-name"
          name="displayName"
          className="field-input"
          defaultValue={profile?.display_name ?? defaultName}
          minLength={2}
          maxLength={120}
          required
          autoComplete="name"
        />
      </div>
      <div>
        <label className="field-label" htmlFor="bio">
          About you (before review)
        </label>
        <textarea
          id="bio"
          name="bio"
          className="field-input field-textarea"
          rows={7}
          defaultValue={profile?.bio ?? ""}
          maxLength={5000}
          aria-describedby="bio-help"
          placeholder="What do you love doing? What have you learned along the way, and what could you share with a guest?"
        />
        <p className="field-hint" id="bio-help">
          Describe your experience and what makes your perspective personal. This will appear on
          your published listings.
        </p>
      </div>
      <div className="field-row">
        <div>
          <label className="field-label" htmlFor="host-city">
            Your city <RequiredMark />
          </label>
          <select
            id="host-city"
            className="field-input"
            name="city"
            defaultValue={profile?.city ?? "Miami"}
            required
          >
            {cities.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="portfolio">
            Your work or portfolio (optional)
          </label>
          <input
            id="portfolio"
            name="portfolioUrl"
            type="url"
            className="field-input"
            defaultValue={profile?.portfolio_url ?? ""}
            placeholder="https://"
            maxLength={2048}
            aria-describedby="portfolio-help"
          />
          <p className="field-hint" id="portfolio-help">
            Optional website, portfolio, or professional social profile.
          </p>
        </div>
      </div>
    </ActionForm>
  );
}
