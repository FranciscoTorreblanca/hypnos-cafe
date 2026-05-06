/** Apply percentage then fixed-amount discount to a gross line value, never below 0. */
export function applyLineDiscount(
  gross: number,
  pct: number = 0,
  fixed: number = 0,
): number {
  const afterPct = gross * (1 - (pct || 0) / 100);
  return Math.max(0, afterPct - (fixed || 0));
}

/** Apply percentage then fixed general discount to an order subtotal. */
export function applyGeneralDiscount(
  subtotal: number,
  pct: number = 0,
  fixed: number = 0,
): number {
  const afterPct = subtotal * (1 - (pct || 0) / 100);
  return Math.max(0, afterPct - (fixed || 0));
}
