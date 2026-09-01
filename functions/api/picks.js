import { json, bad, requireUser, isOpen } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  let user;
  try { user = await requireUser(request, env); } catch (r) { return r; }

  const { category, subject_id, xg } = await request.json().catch(() => ({}));

  if (category !== "player" && category !== "team")
    return bad("Kategorie musí být 'player' nebo 'team'.");

  const value = Number(xg);
  if (!Number.isFinite(value) || value < 0.01)
    return bad("Nejnižší možný tip je 0.01 xG.");
  if (value > 10) return bad("Tip nad 10.00 xG neprojde.");
  const rounded = Math.round(value * 100) / 100;

  const gw = await env.DB.prepare(
    "SELECT * FROM gameweeks WHERE status IN ('open','locked') ORDER BY deadline ASC LIMIT 1"
  ).first();
  if (!gw) return bad("Žádné kolo není otevřené.", 409);
  if (!isOpen(gw)) return bad("Tipy pro toto kolo jsou uzamčené.", 409);

  const table = category === "player" ? "players" : "teams";
  const exists = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?1`)
    .bind(subject_id).first();
  if (!exists) return bad("Vybraný hráč nebo tým neexistuje.");

  await env.DB.prepare(
    `INSERT INTO picks (user_id, gameweek_id, category, subject_id, xg)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(user_id, gameweek_id, category)
     DO UPDATE SET subject_id = ?4, xg = ?5, created_at = datetime('now')`
  ).bind(user.sub, gw.id, category, subject_id, rounded).run();

  return json({ ok: true, gameweek_id: gw.id, category, subject_id, xg: rounded });
}
