import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const VAPID_PUBLIC_KEY = "BOzQCrR469uQJhAI46zlEFhIuAlqvay3HiMCjz6SwfJms58mURMuk7ZbVtforAq_a9VvgCG1HN-XcZF4MNnX1F0";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Push notifications are per-business. A user must subscribe once per business
 * they want to receive notifications for. The browser registers a single
 * endpoint, but we store one row per (user, endpoint, business) so the edge
 * function can scope delivery by tenant.
 */
export const usePushNotifications = () => {
  const { user, currentBusinessId } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported) setPermission(Notification.permission);
  }, []);

  const checkExistingSubscription = useCallback(async () => {
    if (!user || !currentBusinessId) { setIsSubscribed(false); return; }
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (!sub) { setIsSubscribed(false); return; }
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("business_id", currentBusinessId)
        .eq("endpoint", sub.endpoint)
        .maybeSingle();
      setIsSubscribed(!!data);
    } catch {
      setIsSubscribed(false);
    }
  }, [user, currentBusinessId]);

  useEffect(() => { void checkExistingSubscription(); }, [checkExistingSubscription]);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported || !currentBusinessId) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") { setLoading(false); return false; }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
        });
      }
      const subJson = subscription.toJSON();

      await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          business_id: currentBusinessId,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
        },
        { onConflict: "user_id,endpoint,business_id" },
      );

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
      setLoading(false);
      return false;
    }
  }, [user, isSupported, currentBusinessId]);

  const unsubscribe = useCallback(async () => {
    if (!user || !currentBusinessId) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("business_id", currentBusinessId)
          .eq("endpoint", sub.endpoint);

        // Only unsubscribe the browser endpoint if no other businesses still use it
        const { data: remaining } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("endpoint", sub.endpoint)
          .limit(1);
        if (!remaining || remaining.length === 0) {
          await sub.unsubscribe();
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    }
    setLoading(false);
  }, [user, currentBusinessId]);

  return { isSubscribed, isSupported, permission, loading, subscribe, unsubscribe };
};

/** Fire-and-forget: send a push notification to admins of a business. */
export async function triggerPushNotification(
  type: string,
  data: Record<string, unknown>,
  businessId: string | null | undefined,
) {
  if (!businessId) return;
  try {
    await supabase.functions.invoke("send-push-notification", {
      body: { type, data, business_id: businessId },
    });
  } catch (err) {
    console.error("Failed to trigger push notification:", err);
  }
}
