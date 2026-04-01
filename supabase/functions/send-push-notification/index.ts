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

// ── HMAC-SHA256 helpers for HKDF ──

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  return hmacSha256(salt, ikm);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const result = await hmacSha256(prk, concat(info, new Uint8Array([1])));
  return result.slice(0, len);
}

// ── VAPID JWT (ES256) ──

async function createVapidJwt(
  audience: string, subject: string, pubKeyB64: string, privKeyB64: string
): Promise<string> {
  const rawPriv = b64urlDecode(privKeyB64);
  const rawPub = b64urlDecode(pubKeyB64);

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: b64urlEncode(rawPriv), x: b64urlEncode(rawPub.slice(1, 33)), y: b64urlEncode(rawPub.slice(33, 65)) },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const now = Math.floor(Date.now() / 1000);
  const hdr = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const pay = b64urlEncode(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })));
  const unsigned = `${hdr}.${pay}`;

  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${b64urlEncode(sig)}`;
}

// ── RFC 8291 Encryption ──

async function encryptPayload(
  p256dhB64: string, authB64: string, payload: Uint8Array
): Promise<Uint8Array> {
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

// ── Send push ──

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  vapidPub: string,
  vapidPriv: string,
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

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, data } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPub = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPriv = Deno.env.get("VAPID_PRIVATE_KEY")!;

    // Debug: log the public key being used by server
    if (type === "debug_keys") {
      return new Response(JSON.stringify({ ok: true, vapidPub }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if push notifications are enabled
    const { data: settings } = await supabase
      .from("restaurant_settings")
      .select("key, value")
      .eq("key", "push_enabled");

    if (settings?.[0]?.value !== "true") {
      return new Response(JSON.stringify({ ok: true, message: "Push disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin user IDs
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles?.length) {
      return new Response(JSON.stringify({ ok: true, message: "No admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminIds = adminRoles.map((r) => r.user_id);

    // Get push subscriptions
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .in("user_id", adminIds);

    if (!subs?.length) {
      return new Response(JSON.stringify({ ok: true, message: "No subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build payload
    let payload: PushPayload;
    switch (type) {
      case "order_paid": {
        const { amount, tip, payment_method, waiter_name, table_number, order_id } = data;
        const method = payment_method === "cash" ? "Efectivo" : "Tarjeta";
        const tipText = tip > 0 ? ` | Propina: $${Number(tip).toFixed(2)}` : "";
        payload = {
          title: `💰 Orden cobrada - Mesa ${table_number}`,
          body: `$${Number(amount).toFixed(2)} ${method}${tipText} — ${waiter_name}`,
          tag: `order-paid-${order_id}`,
          data: { type: "order_paid", order_id },
        };
        break;
      }
      default:
        payload = { title: data.title || "Notificación", body: data.body || "", tag: type };
    }

    // Send
    const results = await Promise.allSettled(
      subs.map((s) => sendWebPush(s, payload, vapidPub, vapidPriv)),
    );

    const invalidEndpoints: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`Push failed sub ${i}:`, r.reason?.message);
        if (r.reason?.statusCode === 410 || r.reason?.statusCode === 404) {
          invalidEndpoints.push(subs[i].endpoint);
        }
      }
    });

    if (invalidEndpoints.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", invalidEndpoints);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return new Response(JSON.stringify({ ok: true, sent, cleaned: invalidEndpoints.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Push error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
