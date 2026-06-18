// Client helper for the local USB fingerprint reader bridge.
// The bridge is a small native helper app (e.g. DigitalPersona / ZKTeco wrapper)
// that exposes HTTP endpoints on http://localhost:8765.
//
// Contract:
//   GET  /status   -> { ok: true, reader_connected: boolean, version?: string }
//   POST /enroll   -> { ok: true, template_hash: string }
//   POST /verify   -> { ok: true, template_hash: string }
//
// We never receive the raw biometric template — only an opaque template_hash
// that the bridge derives locally. The server checks the hash against
// user_fingerprints rows.

const BRIDGE_URL = "http://localhost:8765";
const TIMEOUT_MS = 2500;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BRIDGE_URL}${path}`, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Bridge HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface BridgeStatus {
  ok: true;
  reader_connected: boolean;
  version?: string;
}

export async function probeBridge(): Promise<BridgeStatus | null> {
  try {
    return await call<BridgeStatus>("/status");
  } catch {
    return null;
  }
}

export async function captureFingerprint(mode: "enroll" | "verify"): Promise<string> {
  const r = await call<{ ok: true; template_hash: string }>(`/${mode}`, { method: "POST" });
  if (!r.template_hash) throw new Error("No template returned");
  return r.template_hash;
}
