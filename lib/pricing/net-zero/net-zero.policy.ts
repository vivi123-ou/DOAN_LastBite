// Business policy constants for the Net Zero points program — plain data
// lookups, not a Strategy (see .claude/rules/stack-and-conventions.md: no
// runtime-varying algorithm here, just two tunable numbers). Recommended
// design (the user asked directly whether points should be flat-per-order
// or proportional-to-spend): proportional to the order's total amount, not
// a flat per-order count — a flat count rewards many small orders over
// fewer larger ones with no real difference in avoided food waste, and
// every comparable Vietnamese loyalty program (Shopee, Grab, ...) already
// works this way, so it needs no explanation for a new user.

// 1 điểm per 1,000đ spent (order.total_amount), rounded down.
const POINTS_PER_1000_VND = 1;

// 1 điểm = 100đ when redeemed as a discount at checkout.
export const VND_PER_POINT = 100;

export function calculatePointsEarned(totalAmount: number): number {
  return Math.floor((totalAmount / 1000) * POINTS_PER_1000_VND);
}

export function calculateRedemptionValue(points: number): number {
  return points * VND_PER_POINT;
}
