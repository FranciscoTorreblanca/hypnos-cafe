# Add fixed-amount discounts (per item + general)

Today, discounts are percentage-only on `order_items.discount` and `orders.general_discount`. We'll add a parallel **fixed amount (MXN)** discount on both, applied **after** the percentage. Both can be used together; either can be 0.

## Calculation rules

- **Per item line total**: `qty * unit_price * (1 - pct/100) - fixedAmount` (clamped ≥ 0)
- **Order subtotal**: sum of line totals
- **General discount**: `subtotal * (1 - generalPct/100) - generalFixed` (clamped ≥ 0) → final total

## Database

Add two nullable numeric columns (default 0):
- `order_items.discount_amount NUMERIC NOT NULL DEFAULT 0`
- `orders.general_discount_amount NUMERIC NOT NULL DEFAULT 0`

No RLS changes (existing policies cover all columns). Trigger-recomputed totals already happen client-side in `useOrders.ts`, just need updating.

## UI changes

**OrderDialog (`src/components/orders/OrderDialog.tsx`)**
- Cart row: next to the % popover, add a **$** popover for fixed MXN discount per item.
- Existing item row (sent to kitchen): same — add **$** popover next to the existing % control.
- General discount section: add a fixed **$** input next to the existing % input.
- Update local `cart` state type to include `discountAmount`.
- Update subtotal/total computations and ticket-snapshot payload.

**TablesPage**: show small badge `-$X` next to the `-Y%` badge when fixed discount > 0.

**BillingPage**: include the new fields when computing what to charge & when snapshotting the ticket.

**OrderHistoryPage**: same — apply fixed discounts to the displayed totals and ticket snapshot.

**Ticket snapshot/print** (`utils/ticketSnapshot.ts`, `tickets/TicketView.tsx`, `PrintTicketDialog.tsx`): persist & render `discount_amount` per line and `general_discount_amount` on order; show `-$X` line in summary.

**Hooks**:
- `useOrders.ts`: extend `OrderItem` and `Order` types; `addItem` / `updateItemDiscount` accept optional `discount_amount`; recalc total using both pct+fixed; new `updateItemDiscountAmount` and `updateGeneralDiscountAmount` mutations.
- `usePayments.ts`: when finalizing a paid order, also reset `general_discount_amount` to 0 (matches existing pattern).

## i18n
Add labels: "Descuento fijo" / "Fixed discount", "Monto" / "Amount" in `translations.ts`.

## Out of scope
- No analytics changes (Performance/Dashboard already use `orders.total` which we'll keep authoritative by recomputing on every mutation, just like today).

## Files touched
- migration (new columns)
- `src/hooks/useOrders.ts`
- `src/hooks/usePayments.ts`
- `src/components/orders/OrderDialog.tsx`
- `src/components/tickets/PrintTicketDialog.tsx`
- `src/components/tickets/TicketView.tsx`
- `src/utils/ticketSnapshot.ts`
- `src/pages/BillingPage.tsx`
- `src/pages/TablesPage.tsx`
- `src/pages/OrderHistoryPage.tsx`
- `src/i18n/translations.ts`
