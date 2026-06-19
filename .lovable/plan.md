# Offline-First Mode

Make Hypnos Cafe usable without internet for the critical flows (orders, payments, till X/Z, attendance, menu/stock browsing). Show a clear offline indicator, queue mutations locally, and auto-sync when back online.

## What the user will see

- **Connection pill** in the top header (mobile + desktop): `Online` (subtle), `Offline` (amber), `Syncing N…` (blue with spinner), `Sync error` (red, opens log).
- **Sync Log page** (Settings → Sync) listing every offline mutation: status (pending / synced / failed / discarded), timestamp, target (e.g. "Add item to order #1234"), and per-row **Retry** / **Discard** buttons. Bulk "Retry all" / "Clear synced".
- **Per-record badges**: orders/payments/sessions created offline show a small "Pending sync" dot until confirmed.
- **Last-fetch timestamp** on each cached dataset ("Menu cached 12 min ago").
- **First-run install banner**: "Preparing offline mode…" while initial datasets prefetch.

## Scope of offline features

| Feature | Read offline | Mutate offline |
|---|---|---|
| Menu, categories, combos, addons, prices | ✓ | ✗ (admin-only, requires online) |
| Tables, active orders, order items | ✓ | ✓ create/update/cancel orders & items, discounts, status changes |
| Payments (cash + card-as-record) | ✓ history (cached) | ✓ record payment, mark paid |
| Till sessions (open/close, X/Z reports) | ✓ current session + X report snapshot | ✓ open session, close session (Z report generated from local data), PDF export |
| Attendance check-in / check-out | ✓ own schedule + open session | ✓ queue check-in/out (fingerprint validated against cached hash) |
| Stock counts | ✓ | ✗ (write-heavy admin) |
| Mercado Pago card terminal | n/a | ✗ network required — UI disables card option offline; only "cash" + "card (manual)" allowed |
| Push notifications, analytics, backoffice | ✗ | ✗ |

## Technical approach

### Storage
- **IndexedDB** via `idb-keyval` (lightweight) for: (a) React Query persisted cache, (b) mutation queue, (c) sync log.
- Three logical stores: `rq-cache`, `mutation-queue`, `sync-log`.

### React Query persistence
- Add `@tanstack/react-query-persist-client` + custom `idb-keyval` persister.
- `persistQueryClient` with `maxAge: 7 days`, `buster` keyed to app version + `currentBusinessId` (clears cache on business switch / deploy).
- Per-query `gcTime: Infinity` for offline-critical keys (`menu_items`, `menu_categories`, `combos`, `tables`, `orders`, `payments`, `till_session`, `till_x_report`, `attendance/me`, `user_shift_schedules`).
- Other queries keep current behavior.
- Tag each persisted query with `dataUpdatedAt` (React Query already tracks) and surface as "last fetch".

### Mutation queue
- New `useOfflineMutation` wrapper around `useMutation` that:
  1. Generates client UUID for inserts (`crypto.randomUUID()`).
  2. Applies **optimistic update** to React Query cache immediately.
  3. If online → fires Supabase call; on success updates log entry to `synced`; on failure keeps in queue with `failed` + error.
  4. If offline → only enqueues; UI already reflects optimistic state.
- Queue entry shape:
  ```ts
  { id, createdAt, kind: 'order.create'|'order_item.insert'|'payment.create'|'till.open'|'till.close'|'attendance.check_in'|..., payload, status, error?, retries, dependsOn?: string[] }
  ```
- **Dependency chain**: items reference local order id via `dependsOn`. Sync runner processes queue in FIFO with a topo sort so parent inserts succeed before children.
- **Sync runner** triggers on: `window online` event, app focus, manual "Retry all", and 30s poll while pending entries exist.
- On success, invalidates the related React Query keys to reconcile with server truth.

### Conflict handling (hybrid)
- Classify Postgres / app errors:
  - **Auto-discard** (terminal): `order already paid`, `session_already_open`, `fingerprint_mismatch`, RLS `forbidden`, FK conflicts. Toast + sync-log entry marked `discarded` with reason; optimistic state is rolled back via query invalidation.
  - **Keep for retry**: network errors, 5xx, timeouts, `429`. Stays `failed`, user can retry/cancel from Sync Log.
- Rollback strategy: on terminal failure, refetch affected query (e.g. that order) so UI re-syncs to server truth.

### Client UUIDs
- Use client-generated UUIDs for `orders.id`, `order_items.id`, `payments.id`, `till_sessions.id`, `attendance_sessions.id`. All these tables already use `gen_random_uuid()` defaults — DB accepts explicit UUIDs, no migration needed.
- For RPCs that return rows (`open_till_session`, `close_till_session`, `attempt_check_in/out`), pass the client UUID as a new parameter so the RPC uses it. **Minor migration** adds optional `_id uuid` params with `DEFAULT gen_random_uuid()` to those four functions.

### Service worker
- Use `vite-plugin-pwa` (`generateSW`) per the PWA skill, with guarded registration (never in Lovable preview/iframe/dev).
- Strategies:
  - HTML navigations: `NetworkFirst`.
  - Hashed assets: `CacheFirst`.
  - Supabase REST/RPC (`/rest/v1/*`, `/functions/v1/*`): **no SW caching** — React Query owns offline reads. SW just lets the app shell load offline.
- Excludes `/~oauth`, existing `push-sw.js` left untouched.
- Reuse existing manifest.

### Initial prefetch ("install")
- On first authenticated load (and after business switch), kick off parallel prefetch of: menu_items, categories, combos, addons, tables, active orders, current till session + X report, user schedule, recent payments (last 50). Show non-blocking banner with progress; the app is usable as data arrives.

### UI plumbing
- New `OfflineProvider` (uses `navigator.onLine` + `online`/`offline` events + Supabase ping every 30s).
- `<ConnectionPill />` mounted in `AppLayout` header / `BottomNav`.
- `SettingsPage` → new "Sync" tab → `<SyncLog />`.
- Disable / hide actions that strictly require server (admin menu edits, MP card, push subscribe) when offline with explanatory tooltip.
- i18n keys added for ES/EN.

## Files

### New
- `src/offline/idbStorage.ts` — IndexedDB wrapper (queue, log, RQ persister).
- `src/offline/persister.ts` — React Query persister + `persistQueryClient` setup.
- `src/offline/mutationQueue.ts` — enqueue / dequeue / dependency resolution.
- `src/offline/syncRunner.ts` — drains queue, classifies errors, updates log.
- `src/offline/useOfflineMutation.ts` — hook replacing `useMutation` for offline-capable writes.
- `src/offline/OfflineProvider.tsx` — connection + sync state context.
- `src/components/offline/ConnectionPill.tsx`
- `src/components/offline/SyncLog.tsx`
- `src/components/offline/PendingBadge.tsx`
- `src/hooks/useOfflineStatus.ts`
- `src/i18n` keys.
- `vite-plugin-pwa` config in `vite.config.ts` + guarded `src/offline/registerSW.ts`.
- One migration: optional `_id uuid` params on `open_till_session`, `close_till_session`, `attempt_check_in`, `attempt_check_out`.

### Edited
- `src/main.tsx` — wrap QueryClientProvider with persister; register SW via guarded wrapper.
- `src/App.tsx` / `src/components/AppLayout.tsx` — mount `OfflineProvider` + `ConnectionPill`.
- `src/hooks/useOrders.ts`, `usePayments.ts`, `useTillSessions.ts`, `useAttendance.ts` — switch critical mutations to `useOfflineMutation`, accept client UUIDs.
- `src/pages/SettingsPage.tsx` — new Sync tab.
- `src/components/billing/CloseTillDialog.tsx` — Z PDF generation already client-side, will keep working offline; download triggers from optimistic close.
- Dependencies: `bun add idb-keyval @tanstack/react-query-persist-client vite-plugin-pwa workbox-window`.

## Out of scope (v1)
- Real-time multi-device merge of concurrent offline edits (we rely on last-write + conflict discard).
- Offline admin CRUD (menu / users / settings).
- Mercado Pago card terminal offline (network required by gateway).
- Offline image uploads.

## Validation
- Playwright: load app online → go offline (CDP) → create order, add items, pay cash, close till → back online → verify Supabase rows match local state and sync log shows all `synced`.
- Manual: kill network mid-mutation, confirm queue retries and `failed` entries appear in Sync Log with retry button.
