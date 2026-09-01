// Sdílené utility pro Pages Functions (Workers runtime)

const enc = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function bad(message, status = 400) {
  return json({ error: message }, status);
}

function b64url(bytes) {
  let s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function key(secret) {
  return crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

// Minimalistický podepsaný token: payload.signature
export async function signSession(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const ok = await crypto.subtle.verify(
    "HMAC", await key(secret), unb64url(sig), enc.encode(body)
  );
  if (!ok) return null;
  const payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function currentUser(request, env) {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)xg_session=([^;]+)/);
  if (!m) return null;
  return verifySession(decodeURIComponent(m[1]), env.SESSION_SECRET);
}

export async function requireUser(request, env) {
  const u = await currentUser(request, env);
  if (!u) throw new Response(JSON.stringify({ error: "Přihlas se přes Google." }), {
    status: 401, headers: { "content-type": "application/json" },
  });
  return u;
}

// Kolo je otevřené, dokud nenastane deadline (start prvního zápasu).
export function isOpen(gw) {
  return gw && gw.status === "open" && new Date(gw.deadline).getTime() > Date.now();
}
