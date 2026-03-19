

# Loyalty Program

## Overview
A loyalty system with three parts: (1) a public-facing registration page where customers sign up and get a scannable member ID, (2) a waiter-facing scanner to register visits and redeem coupons, and (3) an admin panel to manage members, coupons, and view loyalty analytics.

## Database Schema

**New tables:**

1. **`loyalty_members`** -- public customers (no link to auth.users)
   - `id` uuid PK
   - `name` text NOT NULL
   - `email` text UNIQUE NOT NULL
   - `phone` text DEFAULT ''
   - `member_code` text UNIQUE NOT NULL (short alphanumeric, used for QR)
   - `total_visits` integer DEFAULT 0
   - `is_active` boolean DEFAULT true
   - `created_at` timestamptz DEFAULT now()

2. **`loyalty_visits`** -- visit log
   - `id` uuid PK
   - `member_id` uuid FK -> loyalty_members
   - `registered_by` uuid (staff user who scanned)
   - `created_at` timestamptz DEFAULT now()
   - `notes` text DEFAULT ''

3. **`loyalty_coupons`** -- coupon templates created by admin
   - `id` uuid PK
   - `title` text NOT NULL
   - `title_en` text DEFAULT ''
   - `description` text DEFAULT ''
   - `description_en` text DEFAULT ''
   - `discount_type` text ('percentage' | 'fixed' | 'free_item')
   - `discount_value` numeric DEFAULT 0
   - `min_visits` integer DEFAULT 0 (auto-grant after N visits)
   - `is_active` boolean DEFAULT true
   - `created_at` timestamptz DEFAULT now()

4. **`loyalty_member_coupons`** -- coupons assigned to members
   - `id` uuid PK
   - `member_id` uuid FK -> loyalty_members
   - `coupon_id` uuid FK -> loyalty_coupons
   - `is_redeemed` boolean DEFAULT false
   - `redeemed_at` timestamptz NULL
   - `redeemed_by` uuid NULL (staff who redeemed)
   - `granted_at` timestamptz DEFAULT now()

**RLS policies:**
- `loyalty_members`: anon can INSERT (public signup); authenticated can SELECT/UPDATE
- `loyalty_visits`: authenticated can INSERT/SELECT
- `loyalty_coupons`: authenticated can SELECT; admin can INSERT/UPDATE/DELETE
- `loyalty_member_coupons`: authenticated can SELECT/UPDATE; admin can INSERT/DELETE

**Realtime:** Enable for `loyalty_visits` so waiter UI updates live.

## Pages & Routes

### 1. Public Loyalty Registration (`/loyalty`)
- Public route (no auth required)
- Form: name, email, phone
- On submit: inserts into `loyalty_members`, generates a `member_code` (6-char alphanumeric)
- After registration: shows a QR code (encoding the `member_code`) that the customer can screenshot/save
- Also shows their member code as text
- Uses `qrcode.react` library for QR generation

### 2. Loyalty Member Card (`/loyalty/:memberCode`)
- Public route showing the member's QR code and visit count
- Displays any active (unredeemed) coupons
- Customer can bookmark this page as their "loyalty card"

### 3. Admin Loyalty Management (`/loyalty-admin`)
- Protected route, admin only
- **Members tab**: table of all members with name, email, visits, status; search/filter
- **Coupons tab**: CRUD for coupon templates (title, type, value, min_visits threshold)
- **Assign coupons**: manually grant coupons to members
- **Analytics**: top visitors, coupon redemption rates

### 4. Waiter Loyalty Scanner (`/loyalty-scan`)
- Protected route, visible to admin + waiter roles
- Camera-based QR scanner (using `html5-qrcode` library)
- On scan: looks up member by `member_code`
- Shows member info, visit count
- Two actions: "Register Visit" (inserts into `loyalty_visits`, increments `total_visits`) and "View/Redeem Coupons" (shows available coupons, mark as redeemed)
- Manual code entry fallback if camera unavailable

## Navigation Updates

- **Sidebar + BottomNav**: Add "Loyalty" item for admin role pointing to `/loyalty-admin`; add "Scan" item for waiter+admin pointing to `/loyalty-scan`
- **Public menu/footer**: Link to `/loyalty` for customer self-registration

## File Changes

| File | Action |
|------|--------|
| `supabase migration` | Create 4 tables + RLS + realtime |
| `src/pages/LoyaltyPublicPage.tsx` | New -- public registration + QR display |
| `src/pages/LoyaltyMemberPage.tsx` | New -- public member card |
| `src/pages/LoyaltyAdminPage.tsx` | New -- admin management |
| `src/pages/LoyaltyScanPage.tsx` | New -- waiter QR scanner |
| `src/hooks/useLoyalty.ts` | New -- queries for members, visits, coupons |
| `src/App.tsx` | Add 4 new routes |
| `src/components/AppSidebar.tsx` | Add loyalty nav items |
| `src/components/BottomNav.tsx` | Add loyalty nav items |
| `src/i18n/translations.ts` | Add ~40 loyalty translation keys |
| `package.json` | Add `qrcode.react`, `html5-qrcode` |

## Technical Details

- **QR Code content**: The QR encodes the URL `{origin}/loyalty/{memberCode}` so scanning with any QR reader opens the member card, while the in-app scanner extracts the `memberCode` from it
- **Member code generation**: 6-character uppercase alphanumeric, generated client-side with collision check via unique constraint
- **Visit auto-coupon**: After registering a visit, check if `total_visits` meets any coupon's `min_visits` threshold and auto-grant if not already granted
- **No new auth needed**: Public pages use anon access; staff pages use existing auth system

