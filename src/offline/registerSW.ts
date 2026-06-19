// Guarded service-worker registration per Lovable PWA skill.
// Never registers in dev, preview, iframes, or with ?sw=off.

function isPreviewOrDev(): boolean {
  try {
    if (!import.meta.env.PROD) return true;
    if (window.self !== window.top) return true;
    const host = window.location.hostname;
    if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
    if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
    if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
    if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
    if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  } catch { return true; }
  return false;
}

async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (r) => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
        // Leave push-sw.js alone
        if (url.endsWith("/push-sw.js")) return;
        if (url.endsWith("/sw.js") || url.endsWith("/service-worker.js") || url.includes("workbox")) {
          await r.unregister();
        }
      })
    );
  } catch {}
}

export async function registerAppSW() {
  if (typeof window === "undefined") return;
  if (isPreviewOrDev()) {
    await unregisterAppSW();
    return;
  }
  // Dynamic import so dev/preview never even pulls workbox-window.
  try {
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox("/sw.js");
    wb.addEventListener("waiting", () => {
      wb.messageSkipWaiting();
    });
    wb.addEventListener("controlling", () => {
      // New SW took control — soft reload to pick up new assets.
      window.location.reload();
    });
    await wb.register();
  } catch (e) {
    // silent — offline still works via React Query persisted cache
    console.warn("[offline] SW register failed", e);
  }
}
