import { json, bad, requireUser } from "../../_lib.js";

// POST /api/admin/settle
// { "gameweek_id": 12,
//   "results": [ {"category":"player","subject_id":233,"actual_xg":0.62}, ... ] }
//
// Řazení: menší |tip − realita| výš. Při shodě vyhrává vyšší tip
// (signed_diff kladné před záporným), pak dřívější odeslání.
export async function onRequestPost({ request, env }) {
  let user;
  try { user = await requireUser(request, env); } catch (r) { return r; }
  if (!user.admin) return bad("Jen pro administrátory.", 403);

  const { gameweek_id, results } = await request.json().catch(() => ({}));
  if (!gameweek_id || !Array.isArray(results) || !results.length)
    return bad("Chybí gameweek_id nebo výsledky.");

  for (const r of results) {
    await env.DB.prepare(
      `INSERT INTO results (gameweek_id, category, subject_id, actual_xg)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(gameweek_id, category, subject_id)
       DO UPDATE SET actual_xg = ?4`
    ).bind(gameweek_id, r.category, r.subject_id, Number(r.actual_xg)).run();
  }

  const settled = {};

  for (const category of ["player", "team"]) {
    const picks = (await env.DB.prepare(
      `SELECT p.user_id, p.xg, p.created_at, r.actual_xg
       FROM picks p
       JOIN results r ON r.gameweek_id = p.gameweek_id
                     AND r.category = p.category
                     AND r.subject_id = p.subject_id
       WHERE p.gameweek_id = ?1 AND p.category = ?2`
    ).bind(gameweek_id, category).all()).results;

    if (!picks.length) { settled[category] = 0; continue; }

    const scored = picks.map((p) => ({
      user_id: p.user_id,
      signed: Math.round((p.xg - p.actual_xg) * 1000) / 1000,
      abs: Math.round(Math.abs(p.xg - p.actual_xg) * 1000) / 1000,
      at: p.created_at,
    })).sort((a, b) =>
      a.abs - b.abs ||          // blíž realitě
      b.signed - a.signed ||    // shoda → vyšší tip vyhrává
      a.at.localeCompare(b.at)  // pak dřívější tip
    );

    await env.DB.prepare(
      "DELETE FROM scores WHERE gameweek_id = ?1 AND category = ?2"
    ).bind(gameweek_id, category).run();

    const stmt = env.DB.prepare(
      `INSERT INTO scores (gameweek_id, category, user_id, abs_diff, signed_diff, rank, points)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    );
    await env.DB.batch(scored.map((s, i) =>
      stmt.bind(gameweek_id, category, s.user_id, s.abs, s.signed, i + 1,
        Math.max(1, scored.length - i))
    ));

    settled[category] = scored.length;
  }

  await env.DB.prepare("UPDATE gameweeks SET status = 'settled' WHERE id = ?1")
    .bind(gameweek_id).run();

  return json({ ok: true, gameweek_id, settled });
}
