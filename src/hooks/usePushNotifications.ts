import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const VAPID_PUBLIC_KEY = "BOzQCrR469uQJhAI46zlEFhIuAlqvay3HiMCjz6SwfJms58mURMuk7ZbVtforAq_a9VvgCG1HN-XcZF4MNnX1F0";

/**
 * Catalog of notification event types a user can opt into per device/business.
 * Add new entries here as the platform grows — UI is rendered from this list.
 */
export type NotificationEventType =
  | "order_paid"
  | "order_cancelled"
  | "low_stock"
  | "out_of_stock";

export const NOTIFICATION_EVENTS: {
  key: NotificationEventType;
  label: string;
  description: string;
}[] = [
  { key: "order_paid",      label: "Orden cobrada",        description: "Cuando se registra un pago de una orden." },
  { key: "order_cancelled", label: "Orden cancelada",      description: "Cuando una orden es cancelada." },
  { key: "low_stock",       label: "Inventario bajo",      description: "Cuando un producto baja del umbral configurado." },
  { key: "out_of_stock",    label: "Producto agotado",     description: "Cuando se vende la última unidad de un producto." },
];

export const DEFAULT_ENABLED_EVENTS: NotificationEventType[] =
  NOTIFICATION_EVENTS.map((e) => e.key);

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Push notifications are per-business and per-device. A user subscribes once per
 * business and chooses which events they want delivered to that device.
 */
export const usePushNotifications = () => {
  const { user, currentBusinessId } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [enabledEvents, setEnabledEventsState] = useState<NotificationEventType[]>(DEFAULT_ENABLED_EVENTS);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported) setPermission(Notification.permission);
  }, []);

  const checkExistingSubscription = useCallback(async () => {
    if (!user || !currentBusinessId) { setIsSubscribed(false); setSubscriptionId(null); return; }
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (!sub) { setIsSubscribed(false); setSubscriptionId(null); return; }
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id, enabled_events")
        .eq("user_id", user.id)
        .eq("business_id", currentBusinessId)
        .eq("endpoint", sub.endpoint)
        .maybeSingle();
      if (data) {
        setIsSubscribed(true);
        setSubscriptionId(data.id);
        setEnabledEventsState(((data as any).enabled_events ?? DEFAULT_ENABLED_EVENTS) as NotificationEventType[]);
      } else {
        setIsSubscribed(false);
        setSubscriptionId(null);
      }
    } catch {
      setIsSubscribed(false);
      setSubscriptionId(null);
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

      const { data } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          business_id: currentBusinessId,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
          enabled_events: DEFAULT_ENABLED_EVENTS,
        },
        { onConflict: "user_id,endpoint,business_id" },
      ).select("id, enabled_events").maybeSingle();

      if (data) {
        setSubscriptionId(data.id);
        setEnabledEventsState(((data as any).enabled_events ?? DEFAULT_ENABLED_EVENTS) as NotificationEventType[]);
      }
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
      setSubscriptionId(null);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    }
    setLoading(false);
  }, [user, currentBusinessId]);

  const setEnabledEvents = useCallback(async (events: NotificationEventType[]) => {
    if (!subscriptionId) {
      setEnabledEventsState(events);
      return;
    }
    setEnabledEventsState(events);
    await supabase
      .from("push_subscriptions")
      .update({ enabled_events: events })
      .eq("id", subscriptionId);
  }, [subscriptionId]);

  const toggleEvent = useCallback(async (key: NotificationEventType, on: boolean) => {
    const next = on
      ? Array.from(new Set([...enabledEvents, key]))
      : enabledEvents.filter((k) => k !== key);
    await setEnabledEvents(next);
  }, [enabledEvents, setEnabledEvents]);

  return {
    isSubscribed, isSupported, permission, loading,
    subscribe, unsubscribe,
    enabledEvents, setEnabledEvents, toggleEvent,
  };
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
