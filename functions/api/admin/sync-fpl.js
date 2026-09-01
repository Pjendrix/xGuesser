import { json, bad, requireUser } from "../../_lib.js";
import { ensureFeatured } from "../../_featured.js";

// POST /api/admin/sync-fpl
// Natáhne týmy, hráče a nejbližší kolo z veřejného FPL API.
// Volat po každém přestupovém okně, jinak stačí jednou za sezónu.
export async function onRequestPost({ request, env }) {
  let user;
  try { user = await requireUser(request, env); } catch (r) { return r; }
  if (!user.admin) return bad("Jen pro administrátory.", 403);

  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/", {
    headers: { "user-agent": "xguesser/1.0" },
  });
  if (!res.ok) return bad("FPL API neodpovědělo.", 502);
  const data = await res.json();

  const POS = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD", 5: "MNG" };

  // --- týmy ---
  const teamStmt = env.DB.prepare(
    `INSERT INTO teams (id, name, short_name) VALUES (?1, ?2, ?3)
     ON CONFLICT(id) DO UPDATE SET name = ?2, short_name = ?3`
  );
  await env.DB.batch(
    data.teams.map((t) => teamStmt.bind(t.id, t.name, t.short_name))
  );

  // --- hráči (bez manažerů) ---
  const players = data.elements.filter((e) => e.element_type !== 5);
  const playerStmt = env.DB.prepare(
    `INSERT INTO players (id, team_id, name, position) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(id) DO UPDATE SET team_id = ?2, name = ?3, position = ?4`
  );
  // D1 batch má limit, krájíme po stovkách
  for (let i = 0; i < players.length; i += 100) {
    await env.DB.batch(
      players.slice(i, i + 100).map((p) =>
        playerStmt.bind(
          p.id, p.team,
          `${p.first_name} ${p.second_name}`.trim(),
          POS[p.element_type] || null
        )
      )
    );
  }

  // --- nejbližší kolo ---
  const next = data.events.find((e) => e.is_next) || data.events.find((e) => !e.finished);
  let gameweek = null;
  if (next) {
    const season = data.events[0]?.deadline_time?.slice(0, 4);
    await env.DB.prepare(
      `INSERT INTO gameweeks (id, season, deadline, status) VALUES (?1, ?2, ?3, 'open')
       ON CONFLICT(id) DO UPDATE SET deadline = ?3`
    ).bind(next.id, `${season}/${Number(season) + 1 - 2000}`, next.deadline_time).run();
    const featured = await ensureFeatured(env, next.id, data.elements);
    gameweek = { id: next.id, deadline: next.deadline_time, featured_player_id: featured };
  }

  return json({ ok: true, teams: data.teams.length, players: players.length, gameweek });
}
