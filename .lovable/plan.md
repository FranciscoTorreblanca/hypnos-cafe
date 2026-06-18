
# Time & Attendance — Revised Plan

Builds on the previously approved scope (USB fingerprint, block-everything gate, per-till X/Z, PO from menu_items low stock). This revision adds shift windows, fingerprint-only enforcement, and dedicated time-clock devices. Everything stays behind the `time_attendance` feature flag.

## 1. Per-user shift schedule

New table `user_shift_schedules` (per business + user, optionally per weekday):
- `check_in_time` (local time, e.g. 08:00)
- `check_out_time` (local time, e.g. 16:00)
- `early_window_minutes` (default 15) — how early a user may check in
- `late_window_minutes` (default 30) — grace after scheduled check-in
- `auto_logout_offset_minutes` (default 60) — past `check_out_time`, system force-closes the session
- `weekday_mask` (bitmask Mon–Sun) or one row per weekday — pick simplest: one row per (user, weekday) plus a default fallback row
- `active` flag

Rules enforced server-side via SECURITY DEFINER RPC `attempt_check_in(user_id, device_id, fingerprint_token)`:
- Reject if `now()` is before `check_in_time − early_window`
- Reject if there is already an open session today
- Reject if a previous session was force-closed and the next window has not opened
- Allow late check-in (logged with `late = true`), no upper bound besides next window
- On success → insert `attendance_sessions` row

Auto-logout: scheduled job (pg_cron or a lightweight trigger checked on each app heartbeat) closes any session past `check_out_time + auto_logout_offset_minutes` with `check_out_method = 'auto'`.

Admins (in Users → Schedule tab) manage each user's schedule. Default seed: Mon–Fri 09:00–18:00, 15/30/60 minute windows.

## 2. Fingerprint-only enforcement

The `/check-in` screen detects the local fingerprint bridge (`GET http://localhost:8765/status`):

- **Bridge present + reader connected** → show user picker + "Place finger" prompt. Submit fingerprint template hash to `attempt_check_in`. PIN fallback only if admin enables `allow_pin_fallback` in business settings (default OFF — keeps the anti-fraud guarantee).
- **Bridge missing / reader disconnected** → display a blocking message:
  - Big live clock (local time + server time, refreshes each second)
  - Text: "This device cannot start a shift. Check in on the time-clock device before entering the floor."
  - **Retry** button (re-probes the bridge) and **Reload** button
  - No user list, no PIN, no way past the gate
- WebAuthn / native mobile biometrics are explicitly NOT accepted — flagged as fraud risk in the requirements doc.

The bridge probe runs every 5s while the gate is visible so a freshly-plugged reader unlocks the screen without manual reload.

## 3. Dedicated time-clock devices

New table `attendance_devices`:
- `label` (e.g. "Front desk clock")
- `device_token` (random secret, shown once on enrollment)
- `is_time_clock` (boolean — when true the device runs in clock mode)
- `last_seen_at`, `fingerprint_bridge_version`

Device pairing flow (Admin → Settings → Time Clock Devices):
1. Admin clicks "Add device", names it, downloads a small JSON config containing the `device_token`.
2. On the target machine, open `/check-in?device=<token>`. The app stores the token in `localStorage` and from then on identifies itself as that device.
3. Admin can revoke a device, view last seen, and toggle `is_time_clock`.

**Clock mode UI** (`is_time_clock = true`):
- Full-screen kiosk view: big clock, business logo, list of users currently scheduled within their check-in window
- Tap a user → "Place finger on reader" → bridge verifies → success animation + sound, session opens (or closes if user already checked in)
- No navigation to the rest of the app from this device; reloading stays in clock mode
- Requires bridge + reader; without them the screen shows the same blocking warning as section 2 but tailored ("Time clock unavailable — reconnect the fingerprint reader")

**Normal devices** (`is_time_clock = false` or no token): behave as section 2 — user must already have an open session, otherwise the blocking warning appears.

## 4. Data model (additions to previously approved migration)

```text
attendance_devices(id, business_id, label, device_token_hash, is_time_clock,
                   last_seen_at, allow_pin_fallback, created_at)
user_shift_schedules(id, business_id, user_id, weekday, check_in_time,
                     check_out_time, early_window_minutes,
                     late_window_minutes, auto_logout_offset_minutes,
                     active, created_at, updated_at)
attendance_sessions  -- already planned, add columns:
  device_id (fk attendance_devices, nullable)
  scheduled_check_in (timestamptz, snapshot)
  late boolean default false
  check_out_method text  -- 'fingerprint' | 'auto' | 'admin'
```

All tables: business-scoped RLS via `current_business_id()`, GRANTs to `authenticated` and `service_role`. Standard `update_updated_at` trigger where applicable.

RPCs (SECURITY DEFINER, business-scoped):
- `attempt_check_in(user_id, device_id, fp_token)` — validates window, opens session
- `attempt_check_out(user_id, device_id, fp_token)` — closes session
- `close_expired_sessions()` — invoked by pg_cron every minute

## 5. UI surface

- `AttendanceGate` (wraps `AppLayout`): when `time_attendance` flag ON and user is non-admin → redirect to `/check-in` unless an open session exists. Admins bypass.
- `/check-in` route: three states — fingerprint ready, bridge missing (warning + retry), already checked in (shows shift info + "Go to app").
- `/time-clock` route: kiosk mode, no sidebar, no bottom nav.
- Users page → "Schedule" tab per user (admin only).
- Settings → "Time Clock Devices" tab (admin only).
- Backoffice business feature toggle for `time_attendance` already covered.

## 6. Out of scope for this iteration

- Cash closing X/Z reports and purchase orders (still planned, separate build steps as previously agreed — this revision only restates attendance scope).
- Payroll exports, geofencing, photo capture on check-in.

## Technical notes

- Fingerprint bridge contract documented in `docs/fingerprint-bridge.md`: `GET /status`, `POST /enroll`, `POST /verify` returning `{ ok, template_hash }`. Template never leaves the local machine; only the hash hits the server.
- Time comparisons run in the business timezone (`businesses.timezone`); shift schedules store wall-clock times.
- `device_token` stored hashed (sha256) at rest; raw token only returned once during enrollment.
- `close_expired_sessions` uses `pg_cron`; if unavailable, an edge function `cron-attendance` invoked from a heartbeat in `AppLayout` handles it.
