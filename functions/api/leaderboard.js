import { json } from "../_lib.js";

const CATEGORIES = ["player", "team", "featured"];

// /api/leaderboard?category=featured           → sezónní součet
// /api/leaderboard?category=featured&gw=2      → detail kola s tipy a realitou
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const asked = url.searchParams.get("category");
  const category = CATEGORIES.includes(asked) ? asked : "player";
  const gw = url.searchParams.get("gw");

  // seznam vyhodnocených kol pro přepínač
  const gameweeks = (await env.DB.prepare(
    `SELECT DISTINCT gameweek_id AS id FROM scores ORDER BY gameweek_id DESC`
  ).all()).results.map((r) => r.id);

  if (gw) {
    const id = Number(gw);

    const rows = (await env.DB.prepare(
      `SELECT u.display_name AS name,
              s.abs_diff, s.signed_diff, s."rank", s.points,
              p.xg AS pick_xg, p.subject_id,
              r.actual_xg
       FROM scores s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN picks p ON p.user_id = s.user_id
                        AND p.gameweek_id = s.gameweek_id
                        AND p.category = s.category
       LEFT JOIN results r ON r.gameweek_id = s.gameweek_id
                          AND r.category = s.category
                          AND r.subject_id = p.subject_id
       WHERE s.gameweek_id = ?1 AND s.category = ?2
       ORDER BY s."rank" LIMIT 100`
    ).bind(id, category).all()).results;

    // doplníme jména vybraných hráčů či týmů
    const ids = [...new Set(rows.map((r) => r.subject_id).filter(Boolean))];
    const names = {};
    if (ids.length) {
      const marks = ids.map((_, i) => `?${i + 1}`).join(",");
      const table = category === "team"
        ? `SELECT id, name, short_name FROM teams WHERE id IN (${marks})`
        : `SELECT p.id, p.name, t.short_name FROM players p
           JOIN teams t ON t.id = p.team_id WHERE p.id IN (${marks})`;
      for (const row of (await env.DB.prepare(table).bind(...ids).all()).results) {
        names[row.id] = { name: row.name, short: row.short_name };
      }
    }

    // hráč kola je pro všechny stejný, vytáhneme ho zvlášť
    let subject = null;
    if (category === "featured") {
      const g = await env.DB.prepare(
        "SELECT featured_player_id FROM gameweeks WHERE id = ?1"
      ).bind(id).first();
      if (g?.featured_player_id) {
        const p = await env.DB.prepare(
          `SELECT p.name, t.short_name AS short, t.name AS team_name
           FROM players p JOIN teams t ON t.id = p.team_id WHERE p.id = ?1`
        ).bind(g.featured_player_id).first();
        const r = await env.DB.prepare(
          `SELECT actual_xg FROM results
           WHERE gameweek_id = ?1 AND category = 'featured' AND subject_id = ?2`
        ).bind(id, g.featured_player_id).first();
        if (p) subject = { ...p, actual_xg: r ? r.actual_xg : null };
      }
    }

    return json({
      scope: "gameweek", gameweek_id: id, category, gameweeks, subject,
      rows: rows.map((r) => ({
        name: r.name, rank: r.rank, points: r.points,
        pick_xg: r.pick_xg, actual_xg: r.actual_xg, abs_diff: r.abs_diff,
        subject: names[r.subject_id] || null,
      })),
    });
  }

  // sort=points (výchozí) nebo sort=podium
  const sort = url.searchParams.get("sort") === "podium" ? "podium" : "points";

  const order = sort === "podium"
    ? `gold DESC, silver DESC, bronze DESC, points DESC`
    : `points DESC, avg_diff ASC`;

  const rows = (await env.DB.prepare(
    `SELECT u.display_name AS name,
            SUM(s.points) AS points,
            ROUND(AVG(s.abs_diff), 3) AS avg_diff,
            COUNT(*) AS played,
            SUM(CASE WHEN s."rank" = 1 THEN 1 ELSE 0 END) AS gold,
            SUM(CASE WHEN s."rank" = 2 THEN 1 ELSE 0 END) AS silver,
            SUM(CASE WHEN s."rank" = 3 THEN 1 ELSE 0 END) AS bronze
     FROM scores s JOIN users u ON u.id = s.user_id
     WHERE s.category = ?1
     GROUP BY s.user_id
     ORDER BY ${order}
     LIMIT 100`
  ).bind(category).all()).results;

  return json({ scope: "season", category, sort, gameweeks, rows });
}
