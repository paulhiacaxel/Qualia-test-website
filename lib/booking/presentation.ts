/** Display only the immutable booking quote; never calculate a charge from these labels. */
export type BookingPresentation = {
  booking_mode?: "private" | "shared";
  party_size?: number;
  price_basis_snapshot?: "group" | "per_guest";
  unit_price_cents_snapshot?: number;
  amount_cents?: number;
};

export function bookingModeLabel(mode: BookingPresentation["booking_mode"]): string {
  return mode === "shared" ? "Shared experience" : "Private experience";
}

export function bookingPartyLabel(size: BookingPresentation["party_size"]): string {
  const count =
    typeof size === "number" && Number.isInteger(size) && size >= 1 && size <= 50 ? size : 1;
  return `${count} ${count === 1 ? "guest" : "guests"}`;
}

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** Legacy notifications may not carry a price snapshot; don't invent one. */
export function bookingPriceLabel(booking: BookingPresentation): string | null {
  const total = booking.amount_cents;
  if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) return null;
  const unit = booking.unit_price_cents_snapshot;
  const size = booking.party_size;
  if (
    booking.price_basis_snapshot === "per_guest" &&
    typeof unit === "number" &&
    Number.isSafeInteger(unit) &&
    unit >= 0 &&
    typeof size === "number" &&
    Number.isInteger(size) &&
    size >= 1 &&
    size <= 50 &&
    unit * size === total
  ) {
    return `${money(unit)} × ${bookingPartyLabel(size)} = ${money(total)} total`;
  }
  if (booking.price_basis_snapshot === "group") return `${money(total)} for the whole group`;
  return `${money(total)} total`;
}
