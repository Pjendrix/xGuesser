import { json, bad, signSession, cookie } from "../../_lib.js";

// Klient posílá ID token z Google Identity Services.
// Ověříme ho u Googlu a založíme vlastní session cookie.
export async function onRequestPost({ request, env }) {
  const { credential } = await request.json().catch(() => ({}));
  if (!credential) return bad("Chybí Google credential.");

  const res = await fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential)
  );
  if (!res.ok) return bad("Google token se nepodařilo ověřit.", 401);
  const t = await res.json();

  if (t.aud !== env.GOOGLE_CLIENT_ID) return bad("Token patří jiné aplikaci.", 401);
  if (t.email_verified !== "true" && t.email_verified !== true)
    return bad("E-mail u Google účtu není ověřený.", 401);

  const name = t.name || (t.email || "").split("@")[0];

  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name, avatar_url)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(id) DO UPDATE SET display_name = ?3, avatar_url = ?4`
  ).bind(t.sub, t.email, name, t.picture || null).run();

  const row = await env.DB.prepare("SELECT is_admin FROM users WHERE id = ?1")
    .bind(t.sub).first();

  const token = await signSession(
    {
      sub: t.sub,
      name,
      picture: t.picture || null,
      admin: !!(row && row.is_admin),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    },
    env.SESSION_SECRET
  );

  return json({ name, picture: t.picture || null, admin: !!(row && row.is_admin) },
    200, { "set-cookie": cookie("xg_session", encodeURIComponent(token), 60 * 60 * 24 * 30) });
}
