import { json, bad, requireUser, isOpen } from "../_lib.js";

const CATEGORIES = ["player", "team", "featured"];

export async function onRequestPost({ request, env }) {
  let user;
  try { user = await requireUser(request, env); } catch (r) { return r; }

  const { category, subject_id, xg } = await request.json().catch(() => ({}));

  if (!CATEGORIES.includes(category))
    return bad("Unknown category.");

  const value = Number(xg);
  if (!Number.isFinite(value) || value < 0.01)
    return bad("The lowest possible pick is 0.01 xG.");
  if (value > 10) return bad("Picks above 10.00 xG are not accepted.");
  const rounded = Math.round(value * 100) / 100;

  const gw = await env.DB.prepare(
    "SELECT * FROM gameweeks WHERE status IN ('open','locked') ORDER BY deadline ASC LIMIT 1"
  ).first();
  if (!gw) return bad("No gameweek is open right now.", 409);
  if (!isOpen(gw)) return bad("Picks for this gameweek are locked.", 409);

  // Hráč kola je pro všechny stejný, ID si určuje server.
  let target = subject_id;
  if (category === "featured") {
    if (!gw.featured_player_id) return bad("No player of the round has been drawn yet.", 409);
    target = gw.featured_player_id;
  } else {
    const table = category === "player" ? "players" : "teams";
    const exists = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?1`)
      .bind(target).first();
    if (!exists) return bad("That player or team does not exist.");
  }

  await env.DB.prepare(
    `INSERT INTO picks (user_id, gameweek_id, category, subject_id, xg)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(user_id, gameweek_id, category)
     DO UPDATE SET subject_id = ?4, xg = ?5, created_at = datetime('now')`
  ).bind(user.sub, gw.id, category, target, rounded).run();

  return json({ ok: true, gameweek_id: gw.id, category, subject_id: target, xg: rounded });
}
