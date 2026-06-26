import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// Web Push utilities — pure Deno, no npm dependency
const encoder = new TextEncoder();

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
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

// Create a JSON Web Token for VAPID
async function createVapidJwt(audience: string, subject: string, privateKeyBase64Url: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const rawKey = base64UrlDecode(privateKeyBase64Url);
  const keyData = rawKey.buffer.byteLength === 32 ? buildPkcs8FromRaw(rawKey) : rawKey.buffer;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    new Uint8Array(keyData as ArrayBuffer) as any,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s (64 bytes)
  const sigBytes = new Uint8Array(signature);
  const rawSig = sigBytes.length === 64 ? sigBytes : derToRaw(sigBytes);

  return `${unsignedToken}.${base64UrlEncode(rawSig)}`;
}

function buildPkcs8FromRaw(raw: Uint8Array): ArrayBuffer {
  // Wrap 32-byte raw private key into PKCS8 DER for P-256
  const pkcs8Prefix = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Suffix = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);
  // We only need the private key bytes, public key is optional in PKCS8
  const result = new Uint8Array(pkcs8Prefix.length + 32);
  result.set(pkcs8Prefix);
  result.set(raw, pkcs8Prefix.length);
  return result.buffer;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // Parse DER SEQUENCE of two INTEGERs into 64-byte r||s
  const raw = new Uint8Array(64);
  let offset = 2; // skip SEQUENCE tag + length
  // r
  const rLen = der[offset + 1];
  offset += 2;
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDstStart = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, offset + rLen), rDstStart);
  offset += rLen;
  // s
  const sLen = der[offset + 1];
  offset += 2;
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDstStart = sLen < 32 ? 64 - sLen : 32;
  raw.set(der.slice(sStart, offset + sLen), sDstStart);
  return raw;
}

// Encrypt payload using Web Push (RFC 8291) — aes128gcm content encoding
async function encryptPayload(
  payload: string,
  p256dhBase64Url: string,
  authBase64Url: string
): Promise<{ body: Uint8Array; localPublicKey: string; salt: string }> {
  // Generate local key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
  const localPublicKeyBytes = new Uint8Array(localPublicKeyRaw);

  // Import subscriber's public key
  const subscriberPubKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(base64UrlDecode(p256dhBase64Url)) as any,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPubKey },
    localKeyPair.privateKey,
    256
  );

  const authSecret = base64UrlDecode(authBase64Url);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF to derive encryption key and nonce (RFC 8291)
  const ikm = new Uint8Array(sharedSecret);

  // PRK = HKDF-Extract(auth_secret, ecdh_secret)
  const authKey = await crypto.subtle.importKey("raw", new Uint8Array(authSecret) as any, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", authKey, ikm));

  // info for key derivation
  const subscriberPubKeyBytes = base64UrlDecode(p256dhBase64Url);
  const keyInfoBuf = concatBuffers(
    encoder.encode("WebPush: info\0"),
    subscriberPubKeyBytes,
    localPublicKeyBytes
  );

  // IKM = HKDF-Expand(PRK, keyInfo, 32)
  const prkKey = await crypto.subtle.importKey("raw", new Uint8Array(prk) as any, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const ikmFull = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, concatBuffers(keyInfoBuf, new Uint8Array([1])) as unknown as BufferSource));
  const contentIkm = ikmFull.slice(0, 32);

  // PRK2 = HKDF-Extract(salt, ikm)
  const saltKey = await crypto.subtle.importKey("raw", new Uint8Array(salt) as any, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk2 = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, contentIkm));
  const prk2Key = await crypto.subtle.importKey("raw", new Uint8Array(prk2) as any, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  // CEK = HKDF-Expand(PRK2, "Content-Encoding: aes128gcm\0" + [1], 16)
  const cekInfo = concatBuffers(encoder.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1]));
  const cekFull = new Uint8Array(await crypto.subtle.sign("HMAC", prk2Key, cekInfo as unknown as BufferSource));
  const cek = cekFull.slice(0, 16);

  // Nonce = HKDF-Expand(PRK2, "Content-Encoding: nonce\0" + [1], 12)
  const nonceInfo = concatBuffers(encoder.encode("Content-Encoding: nonce\0"), new Uint8Array([1]));
  const nonceFull = new Uint8Array(await crypto.subtle.sign("HMAC", prk2Key, nonceInfo as unknown as BufferSource));
  const nonce = nonceFull.slice(0, 12);

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey("raw", new Uint8Array(cek) as any, "AES-GCM", false, ["encrypt"]);
  const paddedPayload = concatBuffers(encoder.encode(payload), new Uint8Array([2])); // delimiter
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload as unknown as BufferSource);

  // Build aes128gcm body: salt(16) + rs(4) + idlen(1) + keyid(65) + encrypted
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);

  const body = concatBuffers(
    salt,
    rs,
    new Uint8Array([65]), // keyid length
    localPublicKeyBytes,
    new Uint8Array(encrypted)
  );

  return {
    body,
    localPublicKey: base64UrlEncode(localPublicKeyBytes),
    salt: base64UrlEncode(salt),
  };
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

// Send a single push notification
async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ ok: boolean; status: number; statusText: string }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey);
  const { body } = await encryptPayload(payload, p256dh, auth);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body,
  });

  return { ok: response.ok, status: response.status, statusText: response.statusText };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    // Chamadas internas (crons) usam a service-role key como bearer e pulam o login de usuário
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    const isInternal = !!serviceRoleKey && bearer === serviceRoleKey;

    let user: { id: string } | null = null;
    if (!isInternal) {
      const { data: { user: u }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !u) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      user = u;
    }

    // Check admin role for broadcast
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { mode = "self", user_id, title, message, url: targetUrl, tag } = body;

    if (!title || !message) {
      return new Response(JSON.stringify({ error: "title and message required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = "mailto:suporte@useatlasapp.com";

    const payload = JSON.stringify({ title, body: message, icon: "/logo.png", badge: "/icons/icon-72x72.png", url: targetUrl || "/dashboard", tag: tag || "atlas-notif" });

    let subscriptions: any[] = [];

    if (mode === "self" && user) {
      // Send only to calling user's active subscriptions
      const { data } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);
      subscriptions = data || [];
    } else if (mode === "user" && user_id) {
      // Admin OU chamada interna (cron): envia para um usuário específico
      if (!isInternal) {
        const { data: roleCheck } = await supabaseAdmin.rpc("has_role", { _user_id: user!.id, _role: "admin" });
        if (!roleCheck) {
          return new Response(JSON.stringify({ error: "Admin required" }), {
            status: 403,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
      }
      const { data } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", true);
      subscriptions = data || [];
    } else if (mode === "user_ids" && Array.isArray(body.user_ids)) {
      // Admin: send to specific list of user IDs
      const { data: roleCheck } = await supabaseAdmin.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      if (!roleCheck) {
        return new Response(JSON.stringify({ error: "Admin required" }), {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const userIds: string[] = body.user_ids.filter((id: any) => typeof id === "string");
      if (userIds.length === 0) {
        return new Response(JSON.stringify({ sent: 0, failed: 0, total: 0, errors: [] }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .in("user_id", userIds)
        .eq("is_active", true)
        .limit(5000);
      subscriptions = data || [];
    } else if (mode === "broadcast") {
      // Admin: send to all active subscriptions
      const { data: roleCheck } = await supabaseAdmin.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      if (!roleCheck) {
        return new Response(JSON.stringify({ error: "Admin required" }), {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const { data } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("is_active", true)
        .limit(1000);
      subscriptions = data || [];
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        const result = await sendPush(
          sub.endpoint,
          sub.p256dh,
          sub.auth,
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );

        if (result.ok) {
          sent++;
          await supabaseAdmin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", sub.id);
        } else if (result.status === 404 || result.status === 410) {
          // Subscription expired/invalid
          await supabaseAdmin.from("push_subscriptions").update({
            is_active: false,
            last_failure_at: new Date().toISOString(),
            failure_reason: `HTTP ${result.status} - subscription expired`,
          }).eq("id", sub.id);
          failed++;
        } else {
          await supabaseAdmin.from("push_subscriptions").update({
            last_failure_at: new Date().toISOString(),
            failure_reason: `HTTP ${result.status} ${result.statusText}`,
          }).eq("id", sub.id);
          failed++;
          errors.push(`${sub.id}: ${result.status}`);
        }
      } catch (err) {
        failed++;
        errors.push(`${sub.id}: ${(err as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, total: subscriptions.length, errors: errors.slice(0, 5) }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
