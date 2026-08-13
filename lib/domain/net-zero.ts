export interface NetZeroSummary {
  pointsBalance: number;
  totalCo2SavedKg: number;
}

// The soonest still-unexpired batch of earned points and when it expires —
// see net-zero.repository.ts's getNextExpiry(). Null when the customer has
// no unexpired earn history to show a date for (e.g. balance is entirely
// from a manual/demo adjustment rather than a real order, or genuinely no
// points earned yet).
export interface NetZeroExpiry {
  date: string;
  points: number;
}
