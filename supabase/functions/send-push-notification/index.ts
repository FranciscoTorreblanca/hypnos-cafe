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

// ── Base64url helpers ──
function b64urlDecode(str: string): Uint8Array {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concat(...bufs: Uint8Array[]): Uint8Array {
  const len = bufs.reduce((s, b) => s + b.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const b of bufs) { out.set(b, off); off += b.length; }
  return out;
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array) { return hmacSha256(salt, ikm); }
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, len: number) {
  const result = await hmacSha256(prk, concat(info, new Uint8Array([1])));
  return result.slice(0, len);
}

async function createVapidJwt(
  audience: string, subject: string, pubKeyB64: string, privKeyB64: string,
): Promise<string> {
  const rawPriv = b64urlDecode(privKeyB64);
  const rawPub = b64urlDecode(pubKeyB64);
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: b64urlEncode(rawPriv), x: b64urlEncode(rawPub.slice(1, 33)), y: b64urlEncode(rawPub.slice(33, 65)) },
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const hdr = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const pay = b64urlEncode(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })));
  const unsigned = `${hdr}.${pay}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${b64urlEncode(sig)}`;
}

async function encryptPayload(p256dhB64: string, authB64: string, payload: Uint8Array): Promise<Uint8Array> {
  const clientPub = b64urlDecode(p256dhB64);
  const clientAuth = b64urlDecode(authB64);
  const serverKP = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const clientKey = await crypto.subtle.importKey("raw", clientPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, serverKP.privateKey, 256));
  const serverPub = new Uint8Array(await crypto.subtle.exportKey("raw", serverKP.publicKey));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikmPrk = await hkdfExtract(clientAuth, sharedSecret);
  const ikmInfo = concat(new TextEncoder().encode("WebPush: info\0"), clientPub, serverPub);
  const ikm = await hkdfExpand(ikmPrk, ikmInfo, 32);
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const padded = concat(payload, new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded));
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([serverPub.length]), serverPub, ciphertext);
}

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload, vapidPub: string, vapidPriv: string,
) {
  const body = await encryptPayload(sub.p256dh, sub.auth, new TextEncoder().encode(JSON.stringify(payload)));
  const url = new URL(sub.endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const jwt = await createVapidJwt(aud, "mailto:admin@hypnos.cafe", vapidPub, vapidPriv);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${vapidPub}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    const err: any = new Error(`Push ${res.status}: ${text}`);
    err.statusCode = res.status;
    throw err;
  }
  await res.text();
}

function fmtTime(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function buildPayload(type: string, data: any): PushPayload {
  switch (type) {
    case "order_paid": {
      const { amount, tip, payment_method, waiter_name, table_number, order_id, paid_at } = data;
      const methodMap: Record<string, string> = { cash: "Efectivo", card: "Tarjeta", split: "Mixto" };
      const method = methodMap[payment_method] || payment_method || "";
      const tipText = Number(tip) > 0 ? ` +$${Number(tip).toFixed(2)} prop.` : "";
      return {
        title: `💰 Orden cobrada · Mesa ${table_number}`,
        body: `$${Number(amount).toFixed(2)} ${method}${tipText} · ${waiter_name} · ${fmtTime(paid_at)}`,
        tag: `order-paid-${order_id}`,
        data: { type, order_id, url: "/order-history" },
      };
    }
    case "order_cancelled": {
      const { table_number, total, reason, waiter_name, order_id, cancelled_at } = data;
      const reasonText = reason ? ` · ${reason}` : "";
      return {
        title: `❌ Orden cancelada · Mesa ${table_number}`,
        body: `$${Number(total).toFixed(2)} · ${waiter_name} · ${fmtTime(cancelled_at)}${reasonText}`,
        tag: `order-cancelled-${order_id}`,
        data: { type, order_id, url: "/order-history" },
      };
    }
    case "low_stock": {
      const { item_name, item_id, inventory_count, threshold } = data;
      return {
        title: `📉 Inventario bajo`,
        body: `"${item_name}" tiene ${inventory_count} unidades (umbral ${threshold}). Reabastece pronto.`,
        tag: `low-stock-${item_id}`,
        data: { type, item_id, url: "/stock" },
      };
    }
    case "out_of_stock": {
      const { item_name, item_id } = data;
      return {
        title: `⚠️ Producto agotado`,
        body: `Se vendió la última unidad de "${item_name}". Reabastece o márcalo como no disponible.`,
        tag: `out-of-stock-${item_id}`,
        data: { type, item_id, url: "/stock" },
      };
    }
    case "test": {
      return {
        title: `🔔 Notificación de prueba`,
        body: data?.body || "Si ves esto, las notificaciones funcionan correctamente.",
        tag: `test-${Date.now()}`,
        data: { type, url: "/settings" },
      };
    }
    default:
      return { title: data?.title || "Notificación", body: data?.body || "", tag: type, data: { type } };
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { type, data, business_id, target_user_id } = await req.json();
    if (!business_id) {
      return new Response(JSON.stringify({ error: "business_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPub = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPriv = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Per-business push enabled flag (default ON if no setting exists). Test always sends.
    if (type !== "test") {
      const { data: setting } = await supabase
        .from("restaurant_settings")
        .select("value")
        .eq("business_id", business_id)
        .eq("key", "push_enabled")
        .maybeSingle();
      if (setting?.value === "false") {
        return new Response(JSON.stringify({ ok: true, message: "Push disabled for business" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Determine recipient user IDs: a specific target, or all admins of the business.
    let recipientIds: string[];
    if (target_user_id) {
      // Verify they belong to the business
      const { data: m } = await supabase
        .from("business_members")
        .select("user_id")
        .eq("business_id", business_id)
        .eq("user_id", target_user_id)
        .maybeSingle();
      if (!m) {
        return new Response(JSON.stringify({ ok: true, message: "User is not a member of business" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      recipientIds = [target_user_id];
    } else {
      const { data: members } = await supabase
        .from("business_members")
        .select("user_id")
        .eq("business_id", business_id)
        .in("role", ["admin", "business_admin"]);
      recipientIds = (members ?? []).map((m: any) => m.user_id);
      if (recipientIds.length === 0) {
        return new Response(JSON.stringify({ ok: true, message: "No admins for business" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .eq("business_id", business_id)
      .in("user_id", recipientIds);

    if (!subs?.length) {
      return new Response(JSON.stringify({ ok: true, message: "No subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = buildPayload(type, data ?? {});

    const results = await Promise.allSettled(
      subs.map((s) => sendWebPush(s, payload, vapidPub, vapidPriv)),
    );

    const invalidEndpoints: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`Push failed sub ${i}:`, (r.reason as any)?.message);
        const sc = (r.reason as any)?.statusCode;
        if (sc === 410 || sc === 404) invalidEndpoints.push(subs[i].endpoint);
      }
    });
    if (invalidEndpoints.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", invalidEndpoints);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return new Response(JSON.stringify({ ok: true, sent, total: subs.length, cleaned: invalidEndpoints.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Push error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
