# Multi-tenant + super-admin backoffice

Turn Hypnos into a multi-business platform. Every business (including branches) is fully isolated through a `business_id` on all operational tables and Row-Level Security. A super-admin backoffice — gated routes inside the same app — manages businesses, feature flags, central settings, and user provisioning.

## 1. Data model

Add two new tables:

- **`businesses`** — id, name, slug, legal name, tax id (RFC), address, phone, email, ticket header/footer text, logo url, currency (default `MXN`), default language, vat rate, mp_access_token, status (`active`/`suspended`), created_at.
- **`business_features`** — business_id + boolean flags: `tickets`, `calendar`, `loyalty`, `kitchen`, `cost_calculator`, `stock`, `budget`, `analytics`, `push_notifications`, `mercado_pago`, `menu_generator`, `wifi`. All default true for the seeded business so nothing breaks.
- **`business_members`** — user_id, business_id, role (`business_admin` | `waiter` | `billing` | `kitchen`), `is_default` flag. Replaces today's flat `user_roles` for business-scoped roles. A user can have multiple rows → multi-branch support (for now operational use stays single-business; cross-business is metrics-only later).

Add `business_id uuid NOT NULL REFERENCES businesses(id)` to every operational table:

`menu_items, menu_categories, menus, menu_entries, combos, combo_items, combo_choice_groups, combo_choice_options, ingredients, menu_item_ingredients, menu_item_skus, orders, order_items, payments, tickets, ticket_prints, till_transactions, balance_adjustments, budget_categories, expense_entries, recurring_expenses, reservations, events, event_cost_categories, event_cost_items, loyalty_members, loyalty_coupons, loyalty_coupon_items, loyalty_member_coupons, loyalty_visits, push_subscriptions, usage_events, restaurant_settings`.

Extend `app_role` enum with `super_admin` and `business_admin`. Keep `loyalty_member` global (loyalty members can belong to a specific business via `loyalty_members.business_id`).

## 2. Migration & backfill

One migration, in order:

1. Create `businesses`, `business_features`, `business_members` (with grants + RLS).
2. Insert the seed business **Hypnos Cafe** (carrying current settings: name, VAT, MP token, ticket data).
3. Add nullable `business_id` to every table listed above, backfill with the Hypnos id, then `ALTER … SET NOT NULL`.
4. Add `super_admin` and `business_admin` to the role enum.
5. Promote the current admin user to `super_admin` and copy existing `user_roles` rows into `business_members` scoped to Hypnos.
6. Replace existing RLS policies on all operational tables with policies that match on `business_id ∈ user's business_members` (via a new `public.is_member_of(business_id)` security-definer function) plus `super_admin` bypass.
7. Drop the legacy `table_count` / numeric-table settings rows; tables are dynamic.

## 3. Backoffice (super-admin only)

New gated section in this app at `/backoffice/*`, only visible when the current user has the `super_admin` role.

Screens:

- **Businesses list** — create / edit / suspend, search.
- **Business detail** — tabs:
  - *Profile*: name, legal data, tax id, address, currency, language, logo, ticket header/footer.
  - *Billing config*: VAT %, Mercado Pago access token (write-only field), commission %.
  - *Features*: switches for every flag in `business_features`.
  - *Users*: list `business_members`, invite new ones (reuses `create-user` edge function, now requires `business_id` and the caller being super_admin OR the target business's `business_admin`).
- **Super admins** — manage other super admins.

`AppLayout` / sidebar shows the backoffice entry only when `isSuperAdmin`. `ProtectedRoute` for `/backoffice` rejects everyone else.

## 4. App-side changes

- **Auth context** gains `currentBusinessId`, `currentBusinessRole`, `features`, `isSuperAdmin`, and a `switchBusiness(id)` action. The active business is persisted in `localStorage` and validated against `business_members` on load. If the user belongs to multiple businesses, a switcher appears in the top bar; otherwise it is hidden.
- **All hooks** (`useMenuItems`, `useOrders`, `usePayments`, `useTickets`, `useTill`, `useReservations`, `useEvents`, `useLoyalty`, `useIngredients`, `useCombos`, `useMenus`, `useMenuCategories`, `useTableNames`, budget hooks, `useUsageTracking`, `usePushNotifications`) include `business_id` in inserts and rely on RLS to filter selects. Query keys gain the business id so caching resets on switch.
- **Settings screen** is simplified — only day-to-day operational settings remain (table names/order, kitchen options, till denominations, loyalty config behaviour). Business profile, VAT, MP credentials, branding, feature toggles all disappear from `/settings` and live in backoffice only.
- **Feature gating**: a `useFeature("tickets" | "calendar" | …)` hook reads `business_features`. Sidebar entries, route guards, and the corresponding pages render a friendly "Not available on your plan" state when off.
- **Admin still manages own users in-app**: existing Users screen stays for `business_admin`; it scopes to the current business via `business_members` (waiter/billing/kitchen). Cross-business and super-admin creation only via backoffice.
- **Edge functions** (`create-user`, `loyalty-signup`, `loyalty-admin-action`, `mercadopago-payment`, `send-push-notification`, `save-mp-token`) accept/derive `business_id`, validate caller's membership, and read business-scoped settings (e.g. `mercadopago-payment` looks up the MP token for the order's business).
- **Tickets**: header/footer/logo/tax id pulled from the business row, not from generic restaurant settings.
- **Public routes** (`/public-menu/:menuId`, `/loyalty/:memberCode`) resolve the business from the parent row (menu → business, member → business). No auth user, but RLS allows anon `SELECT` on those specific tables filtered to `is_public` rows scoped to that business.

## 5. Cleanup

- Remove the legacy "number of tables" setting and any UI that depended on it.
- Remove the "business data" / "VAT" / "Mercado Pago" sections from `/settings`.
- Remove the global "restaurant name" usage in headers — pull from current business instead.

## 6. Additional considerations for true multi-tenancy

- **Slugs & deep links**: each business gets a slug used in public urls (`/m/<slug>/menu/<id>`, `/m/<slug>/loyalty`) so QR codes survive id changes.
- **Push subscriptions** are scoped per (user, business) to avoid cross-business pings.
- **Usage analytics dashboard** filters by business; super-admin sees all.
- **Audit log** (light): a `backoffice_audit` table recording super-admin actions (create business, toggle feature, rotate MP token). Cheap insurance.
- **Backups / exports**: a per-business CSV export action in backoffice so onboarding/offboarding is clean.
- **Time zone** per business (column on `businesses`) — order-history filtering already groups by local day; this makes it accurate per branch.
- **Rate limits**: nothing to add now, but feature flags leave room to attach plan/tier metadata later.

## Out of scope (deliberately deferred)

- Per-tier quantitative limits (max users/tables/items).
- A truly separate backoffice project.
- Cross-business consolidated metrics dashboard (just noted as a future use of `business_members` with multiple rows).
- Billing/subscriptions for businesses.

## Rollout order

1. Migration (tables, backfill, RLS, role enum, super-admin seed).
2. Auth context + business switcher + feature hook.
3. Hooks & edge functions updated to be business-aware.
4. Backoffice screens (businesses, features, users, settings).
5. Settings screen cleanup + dead-feature removal.
6. Public routes + tickets + push scoped per business.
7. QA pass: create a second test business, verify zero data leakage.

Shall I proceed?
