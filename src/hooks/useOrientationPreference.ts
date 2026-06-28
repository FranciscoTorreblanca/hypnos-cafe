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

async function tryNativeLock(pref: OrientationPreference) {
  const so: any = (screen as any).orientation;
  if (!so) return;
  try {
    if (pref === "auto") {
      so.unlock?.();
      return;
    }
    await so.lock?.(pref);
  } catch {
    /* not supported (e.g. iOS Safari, non-fullscreen) — fall back to CSS rotation */
  }
}

/**
 * Apply CSS-based rotation fallback by tagging <html> with a data attribute.
 * CSS in index.css reads it and rotates <body> when the physical orientation
 * doesn't match the user's preference.
 */
function applyCssRotation(pref: OrientationPreference) {
  const root = document.documentElement;
  if (pref === "auto") {
    root.removeAttribute("data-force-orientation");
  } else {
    root.setAttribute("data-force-orientation", pref);
  }
}

function applyPreference(pref: OrientationPreference) {
  applyCssRotation(pref);
  void tryNativeLock(pref);
}

export function useOrientationPreference() {
  const [preference, setPreferenceState] = React.useState<OrientationPreference>(readStored);

  React.useEffect(() => {
    applyPreference(preference);
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
  applyPreference(readStored());
}
