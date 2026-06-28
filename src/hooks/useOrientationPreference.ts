import * as React from "react";

export type OrientationPreference = "auto" | "portrait" | "landscape";

const STORAGE_KEY = "app.orientationPreference";

function readStored(): OrientationPreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "portrait" || v === "landscape" || v === "auto") return v;
  } catch {}
  return "auto";
}

async function applyLock(pref: OrientationPreference) {
  const so: any = (screen as any).orientation;
  if (!so) return;
  try {
    if (pref === "auto") {
      so.unlock?.();
      return;
    }
    // Lock requires fullscreen on most browsers; ignore failures silently
    // (the user already chose; CSS still adapts via media queries).
    await so.lock?.(pref);
  } catch {
    /* not supported (e.g. iOS Safari, non-fullscreen) — no-op */
  }
}

/**
 * Reads, persists and applies the user's per-device orientation preference.
 * Returns the current preference and a setter.
 *
 * Note: native orientation locking only works in installed PWAs / fullscreen
 * on most browsers (notably iOS Safari ignores it). The app layout itself
 * adapts to both orientations regardless.
 */
export function useOrientationPreference() {
  const [preference, setPreferenceState] = React.useState<OrientationPreference>(readStored);

  React.useEffect(() => {
    applyLock(preference);
  }, [preference]);

  const setPreference = React.useCallback((p: OrientationPreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {}
    setPreferenceState(p);
  }, []);

  return { preference, setPreference };
}

/** Apply stored preference once at boot (called from main.tsx). */
export function applyStoredOrientation() {
  void applyLock(readStored());
}
