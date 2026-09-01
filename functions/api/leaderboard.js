import { json } from "../_lib.js";

const CATEGORIES = ["player", "team", "featured"];

// /api/leaderboard?category=featured&gw=12   (gw vynechané = celková sezóna)
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const asked = url.searchParams.get("category");
  const category = CATEGORIES.includes(asked) ? asked : "player";
  const gw = url.searchParams.get("gw");

  if (gw) {
    const rows = (await env.DB.prepare(
      `SELECT u.display_name AS name, u.avatar_url AS avatar,
              s.abs_diff, s.signed_diff, s."rank", s.points
       FROM scores s JOIN users u ON u.id = s.user_id
       WHERE s.gameweek_id = ?1 AND s.category = ?2
       ORDER BY s."rank" LIMIT 100`
    ).bind(Number(gw), category).all()).results;
    return json({ scope: "gameweek", gameweek_id: Number(gw), category, rows });
  }

  const rows = (await env.DB.prepare(
    `SELECT u.display_name AS name, u.avatar_url AS avatar,
            SUM(s.points) AS points,
            ROUND(AVG(s.abs_diff), 3) AS avg_diff,
            COUNT(*) AS played
     FROM scores s JOIN users u ON u.id = s.user_id
     WHERE s.category = ?1
     GROUP BY s.user_id
     ORDER BY points DESC, avg_diff ASC
     LIMIT 100`
  ).bind(category).all()).results;

  return json({ scope: "season", category, rows });
}
