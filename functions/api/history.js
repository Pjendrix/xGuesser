import { json, bad } from "../_lib.js";

// GET /api/history?category=player&id=233
// Reálná xG vybraného hráče nebo týmu za vyhodnocená kola.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const asked = url.searchParams.get("category");
  const category = asked === "team" ? "team" : "player";
  const id = Number(url.searchParams.get("id"));
  if (!id) return bad("Missing id.");

  let subject;
  if (category === "team") {
    subject = await env.DB.prepare(
      "SELECT id, name, short_name AS short FROM teams WHERE id = ?1"
    ).bind(id).first();
  } else {
    subject = await env.DB.prepare(
      `SELECT p.id, p.name, p.position, t.short_name AS short, t.name AS team_name
       FROM players p JOIN teams t ON t.id = p.team_id WHERE p.id = ?1`
    ).bind(id).first();
  }
  if (!subject) return bad("Not found.", 404);

  // hráč kola sdílí xG s kategorií player, proto bereme obojí
  const cats = category === "team" ? ["team"] : ["player", "featured"];
  const marks = cats.map((_, i) => `?${i + 2}`).join(",");

  const rows = (await env.DB.prepare(
    `SELECT gameweek_id AS gw, MAX(actual_xg) AS xg
     FROM results
     WHERE subject_id = ?1 AND category IN (${marks})
     GROUP BY gameweek_id
     ORDER BY gameweek_id`
  ).bind(id, ...cats).all()).results;

  const values = rows.map((r) => r.xg);
  const avg = values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
    : null;

  return json({
    category, subject, rows,
    summary: {
      played: rows.length,
      avg,
      best: values.length ? Math.max(...values) : null,
    },
  });
}
