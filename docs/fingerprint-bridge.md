# Fingerprint Bridge

The app talks to a small native helper running on the local machine that owns
the USB fingerprint reader. We deliberately do NOT use WebAuthn or native
mobile biometrics — those can be enrolled on a personal device and would let a
waiter check in from anywhere. Requiring a USB reader that is physically
installed in the store closes that loophole.

## HTTP contract (default: `http://localhost:8765`)

| Method | Path      | Response                                                       |
|--------|-----------|----------------------------------------------------------------|
| GET    | `/status` | `{ ok: true, reader_connected: boolean, version?: string }`    |
| POST   | `/enroll` | `{ ok: true, template_hash: string }` after capturing 1 finger |
| POST   | `/verify` | `{ ok: true, template_hash: string }` after capturing 1 finger |

`template_hash` is an opaque, stable hash of the captured template derived
locally by the bridge. The raw biometric template never leaves the local
machine. The server only stores and compares these hashes
(`public.user_fingerprints.template_hash`).

## Reference bridge implementations

Any tool that wraps the vendor SDK is fine. Recommended starting points:

- **DigitalPersona U.are.U** — wrap the DPFP SDK in a tiny Go or Node
  service.
- **ZKTeco / ZK4500** — wrap `libzkfp` similarly.

The bridge must:
- Listen only on `127.0.0.1` (never bind to `0.0.0.0`).
- Emit a consistent template hash for the same finger across sessions.
- Return `reader_connected: false` (not an error) when the USB reader is
  unplugged so the app can show the "reader unavailable" screen.

## Behavior in the app

- The check-in screen polls `/status` every 5s.
- If the bridge or reader is missing, the user sees a blocking screen with
  the local clock plus a Retry button. There is no way past it.
- Dedicated time-clock devices (`/time-clock`) show the same blocking screen
  if the bridge disappears.
