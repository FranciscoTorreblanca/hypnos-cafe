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

// ── Web Push with native Web Crypto (no npm:web-push) ──

function base64UrlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidPrivateKey(rawB64: string): Promise<CryptoKey> {
  const raw = base64UrlDecode(rawB64);
  // raw is 32 bytes (the "d" value of the EC key)
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: base64UrlEncode(raw),
    // We need x, y too — derive from private key by importing as PKCS8
    // Actually, for signing JWTs we only need the private key for signing
    // Let's build a proper JWK with x/y derived from the public key
  };
  // We'll use a different approach: import as raw ECDSA via PKCS8
  // Build PKCS8 DER from the raw 32-byte private key
  const pkcs8 = buildPkcs8FromRaw(raw);
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

function buildPkcs8FromRaw(rawPrivate: Uint8Array): Uint8Array {
  // PKCS8 wrapper for EC P-256 private key
  const prefix = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  const suffix = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);
  // We need the public key point too. For JWT signing we can set dummy public key
  // and it still works. But let's generate the key pair properly.
  // Actually we need x,y. Let's just import as JWK using the public key from env.
  // This approach is getting complicated. Let's use a simpler method.
  const result = new Uint8Array(prefix.length + rawPrivate.length);
  result.set(prefix);
  result.set(rawPrivate, prefix.length);
  // This won't work without the public key portion. Let's use JWK instead.
  return result;
}

// Simpler approach: use the web-push protocol manually with fetch
async function createVapidJwt(
  audience: string,
  subject: string,
  publicKey: string,
  privateKeyB64: string,
): Promise<string> {
  const rawPrivate = base64UrlDecode(privateKeyB64);
  const rawPublic = base64UrlDecode(publicKey);

  // Build JWK from raw keys
  // P-256 uncompressed public key is 65 bytes: 0x04 || x(32) || y(32)
  const x = base64UrlEncode(rawPublic.slice(1, 33));
  const y = base64UrlEncode(rawPublic.slice(33, 65));
  const d = base64UrlEncode(rawPrivate);

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken),
  );

  // Convert DER signature to raw r||s format
  const sigBytes = new Uint8Array(signature);
  const rawSig = derToRaw(sigBytes);

  return `${unsignedToken}.${base64UrlEncode(rawSig)}`;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // Web Crypto ECDSA with P-256 returns raw r||s (64 bytes) not DER
  // But just in case, handle both
  if (der.length === 64) return der;

  // Parse DER: 0x30 <len> 0x02 <rlen> <r> 0x02 <slen> <s>
  let offset = 2; // skip 0x30 <len>
  if (der[0] !== 0x30) return der; // not DER, return as-is

  offset++; // 0x02
  const rLen = der[offset++];
  const r = der.slice(offset, offset + rLen);
  offset += rLen;

  offset++; // 0x02
  const sLen = der[offset++];
  const s = der.slice(offset, offset + sLen);

  const raw = new Uint8Array(64);
  raw.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
  raw.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  return raw;
}

async function encryptPayload(
  p256dhB64: string,
  authB64: string,
  payloadBytes: Uint8Array,
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const clientPublicKey = base64UrlDecode(p256dhB64);
  const clientAuth = base64UrlDecode(authB64);

  // Generate ephemeral ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKeyPair.privateKey,
      256,
    ),
  );

  // Export server public key
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey),
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // RFC 8291 key derivation
  const authInfo = concatBuffers(
    new TextEncoder().encode("WebPush: info\0"),
    clientPublicKey,
    serverPublicKeyRaw,
  );

  const prkKey = await crypto.subtle.importKey(
    "raw",
    clientAuth,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const ikm = new Uint8Array(
    await crypto.subtle.sign("HMAC", prkKey, sharedSecret),
  );

  // HKDF for PRK
  const prkInfoKey = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const prk = new Uint8Array(
    await crypto.subtle.sign("HMAC", prkInfoKey, ikm),
  );

  // Wait, let me use proper HKDF
  const ikmKey = await hkdfExtract(salt, ikm);
  const keyInfo = concatBuffers(
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    new Uint8Array(0),
  );
  const nonceInfo = concatBuffers(
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    new Uint8Array(0),
  );

  // Actually, let me implement this properly with the full RFC 8291 flow
  // This is getting complex. Let me use a simpler approach with HKDF.
  
  // Step 1: IKM = HKDF-Extract(auth_secret, ecdh_secret)
  // Then HKDF-Expand with info = "WebPush: info\0" || client_public || server_public
  const authHkdfKey = await crypto.subtle.importKey(
    "raw", clientAuth, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const ikmBytes = new Uint8Array(await crypto.subtle.sign("HMAC", authHkdfKey, sharedSecret));
  
  // PRK = HKDF-Extract(salt, IKM) where IKM = HKDF(auth, ecdh, "WebPush: info"...)
  const authInfoBytes = concatBuffers(
    new TextEncoder().encode("WebPush: info\0"),
    clientPublicKey,
    serverPublicKeyRaw,
  );
  const ikmExpanded = await hkdfExpand(ikmBytes, authInfoBytes, 32);
  
  const prkBytes = await hkdfExtractBytes(salt, ikmExpanded);
  
  // CEK = HKDF-Expand(PRK, "Content-Encoding: aes128gcm\0", 16)
  const cekInfoBytes = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const cek = await hkdfExpand(prkBytes, cekInfoBytes, 16);
  
  // Nonce = HKDF-Expand(PRK, "Content-Encoding: nonce\0", 12)
  const nonceInfoBytes = new TextEncoder().encode("Content-Encoding: nonce\0");
  const nonce = await hkdfExpand(prkBytes, nonceInfoBytes, 12);
  
  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw", cek, { name: "AES-GCM" }, false, ["encrypt"]
  );
  
  // Add padding: payload + 0x02 (delimiter) 
  const paddedPayload = concatBuffers(payloadBytes, new Uint8Array([2]));
  
  const encryptedData = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      paddedPayload,
    )
  );

  // Build aes128gcm content coding header:
  // salt(16) || rs(4) || idlen(1) || keyid(65) || encrypted
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  
  const header = concatBuffers(
    salt,
    rs,
    new Uint8Array([serverPublicKeyRaw.length]),
    serverPublicKeyRaw,
  );
  
  const encrypted = concatBuffers(header, encryptedData);

  return { encrypted, salt, serverPublicKey: serverPublicKeyRaw };
}

async function hkdfExtractBytes(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const input = concatBuffers(info, new Uint8Array([1]));
  const output = new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
  return output.slice(0, length);
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
) {
  const { endpoint, p256dh, auth } = subscription;
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));

  // Encrypt payload
  const { encrypted } = await encryptPayload(p256dh, auth, payloadBytes);

  // Create VAPID JWT
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await createVapidJwt(audience, "mailto:admin@hypnos.cafe", vapidPublicKey, vapidPrivateKey);

  const vapidPublicKeyBytes = base64UrlDecode(vapidPublicKey);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Authorization": `vapid t=${jwt}, k=${base64UrlEncode(vapidPublicKeyBytes)}`,
    },
    body: encrypted,
  });

  if (!response.ok) {
    const body = await response.text();
    const error: any = new Error(`Push failed: ${response.status} ${body}`);
    error.statusCode = response.status;
    throw error;
  }
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
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No admins to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminIds = adminRoles.map((r) => r.user_id);

    // Get push subscriptions for admins
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .in("user_id", adminIds);

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
        console.error(`Push send failed for sub ${i}:`, err?.message || err);
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
