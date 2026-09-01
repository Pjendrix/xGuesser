import { json, currentUser, isOpen } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  // Přednost má nejbližší kolo, jehož uzávěrka teprve přijde.
  // Když žádné takové není, vezmeme poslední proběhlé, ať stránka
  // není prázdná — ale staré nevyhodnocené kolo nesmí blokovat novější.
  let gw = await env.DB.prepare(
    `SELECT * FROM gameweeks
     WHERE status IN ('open','locked') AND deadline > datetime('now')
     ORDER BY deadline ASC LIMIT 1`
  ).first();

  if (!gw) {
    gw = await env.DB.prepare(
      `SELECT * FROM gameweeks WHERE status IN ('open','locked')
       ORDER BY deadline DESC LIMIT 1`
    ).first();
  }

  if (!gw) return json({ gameweek: null, teams: [], players: [], featured: null, picks: {} });

  const teams = (await env.DB.prepare(
    "SELECT id, name, short_name FROM teams ORDER BY name"
  ).all()).results;

  const players = (await env.DB.prepare(
    `SELECT p.id, p.name, p.position, t.short_name AS team
     FROM players p JOIN teams t ON t.id = p.team_id
     ORDER BY t.short_name, p.name`
  ).all()).results;

  let featured = null;
  if (gw.featured_player_id) {
    featured = await env.DB.prepare(
      `SELECT p.id, p.name, p.position, t.short_name AS team, t.name AS team_name
       FROM players p JOIN teams t ON t.id = p.team_id
       WHERE p.id = ?1`
    ).bind(gw.featured_player_id).first();
  }

  const u = await currentUser(request, env);
  const picks = {};
  if (u) {
    const rows = (await env.DB.prepare(
      "SELECT category, subject_id, xg FROM picks WHERE user_id = ?1 AND gameweek_id = ?2"
    ).bind(u.sub, gw.id).all()).results;
    for (const r of rows) picks[r.category] = { subject_id: r.subject_id, xg: r.xg };
  }

  return json({
    gameweek: { id: gw.id, season: gw.season, deadline: gw.deadline, open: isOpen(gw) },
    teams, players, featured, picks,
  });
}
