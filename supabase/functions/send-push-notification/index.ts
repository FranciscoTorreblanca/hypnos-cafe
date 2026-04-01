import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

// Web Push: send notification using VAPID
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
) {
  const { endpoint, p256dh, auth } = subscription;

  // Import web-push compatible module
  const webPush = await import("npm:web-push@3.6.7");

  webPush.setVapidDetails(
    "mailto:admin@hypnos.cafe",
    vapidPublicKey,
    vapidPrivateKey,
  );

  const pushSubscription = {
    endpoint,
    keys: { p256dh, auth },
  };

  await webPush.sendNotification(
    pushSubscription,
    JSON.stringify(payload),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, data } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if push notifications are enabled
    const { data: settingsData } = await supabase
      .from("restaurant_settings")
      .select("key, value")
      .eq("key", "push_enabled");

    const pushEnabled = settingsData?.[0]?.value === "true";
    if (!pushEnabled) {
      return new Response(
        JSON.stringify({ ok: true, message: "Push notifications disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get all admin user IDs
    const { data: adminRoles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    console.log("Admin roles query:", { adminRoles, rolesErr });

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No admins to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminIds = adminRoles.map((r) => r.user_id);

    // Get push subscriptions for admins
    const { data: subscriptions, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .in("user_id", adminIds);

    console.log("Subscriptions query:", { count: subscriptions?.length, subsErr, adminIds });

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No admin subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build notification payload based on type
    let payload: PushPayload;

    switch (type) {
      case "order_paid": {
        const { amount, tip, payment_method, waiter_name, table_number, order_id } = data;
        const methodLabel = payment_method === "cash" ? "Efectivo" : "Tarjeta";
        const tipText = tip > 0 ? ` | Propina: $${Number(tip).toFixed(2)}` : "";
        payload = {
          title: `💰 Orden cobrada - Mesa ${table_number}`,
          body: `$${Number(amount).toFixed(2)} ${methodLabel}${tipText} — ${waiter_name}`,
          tag: `order-paid-${order_id}`,
          data: { type: "order_paid", order_id },
        };
        break;
      }
      default:
        payload = {
          title: data.title || "Notificación",
          body: data.body || "",
          tag: type,
        };
    }

    // Send to all admin subscriptions
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey)
      ),
    );

    // Log errors and clean up invalid subscriptions (410 Gone)
    const invalidEndpoints: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const err = r.reason;
        console.error(`Push send failed for ${subscriptions[i].endpoint}:`, err?.message || err, "statusCode:", err?.statusCode);
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          invalidEndpoints.push(subscriptions[i].endpoint);
        }
      }
    });

    if (invalidEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", invalidEndpoints);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;

    return new Response(
      JSON.stringify({ ok: true, sent, cleaned: invalidEndpoints.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
