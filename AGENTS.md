# Financial summaries
- Calculate Budget totals in authenticated, business-scoped database functions independently of paginated ledgers; transaction pages must never determine balances.
- Budget and Till use the same signed Till transaction formula for cash; do not count mirrored Budget cash entries again.
- Cache summaries by business and user, refresh after writes and synchronization, and retain timestamped confirmed balances offline without merging unconfirmed payments.
- Keep delivery receivables separate from available card funds until an explicit payout is recorded; elapsed payout dates do not prove a deposit.
- Hypnos TV integration: per-business API keys live in a server-only table and are used only by the `hypnos-tv` function; the client sees just `has_api_key`, so keys never reach browsers.
- Render the existing tenant-scoped tap ordering editor within Menu's configured-category view; reuse menu invalidation for automatic TV synchronization rather than introducing a second ordering store.
