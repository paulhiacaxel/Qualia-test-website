/** Display only persisted policy/enrollment values; never invent an offer default. */
export function foundingOfferSummary(terms: {
  freeBookings: number;
  durationMonths: number;
  lifetimeFeeBps: number;
}): string {
  const rate = `${(terms.lifetimeFeeBps / 100).toFixed(2)}%`;
  if (terms.freeBookings === 0)
    return `Your founding commission is ${rate} for life from the agreed activation time, with no commission-free bookings.`;
  return `0% commission on your first ${terms.freeBookings} paid ${terms.freeBookings === 1 ? "booking" : "bookings"} or ${terms.durationMonths} calendar ${terms.durationMonths === 1 ? "month" : "months"} from the agreed activation time, whichever comes first; then ${rate} for life. Processing costs follow your agreed terms.`;
}
