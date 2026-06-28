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
    /* Native lock only works in installed PWA / fullscreen on supported
       browsers (Android Chrome typically; iOS Safari does not support it).
       In unsupported contexts we let the device decide — we do NOT rotate
       via CSS because that breaks scrolling, hit-testing and layout. */
  }
}

function applyPreference(pref: OrientationPreference) {
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
  // Clean up any leftover CSS-rotation attribute from previous versions.
  try {
    document.documentElement.removeAttribute("data-force-orientation");
  } catch {}
  applyPreference(readStored());
}
