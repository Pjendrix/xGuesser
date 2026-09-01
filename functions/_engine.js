// Kompletní běh: vyhodnotí dohraná kola a otevře nadcházející.
// Sdílí ho ruční admin endpoint i veřejný /api/tick.

import { ensureFeatured } from "./_featured.js";

const FPL = "https://fantasy.premierleague.com/api";
const UA = { "user-agent": "xguesser/1.0" };

async function fpl(path) {
  const r = await fetch(`${FPL}${path}`, { headers: UA });
  if (!r.ok) throw new Error(`FPL ${path} → ${r.status}`);
  return r.json();
}

// Blíž realitě výš; při shodě vyhrává vyšší tip, pak dřívější odeslání.
function rankPicks(picks) {
  return picks
    .map((p) => ({
      user_id: p.user_id,
      signed: Math.round((p.xg - p.actual_xg) * 1000) / 1000,
      abs: Math.round(Math.abs(p.xg - p.actual_xg) * 1000) / 1000,
      at: p.created_at,
    }))
    .sort((a, b) => a.abs - b.abs || b.signed - a.signed || a.at.localeCompare(b.at));
}

async function settle(env, gameweekId) {
  const log = { gameweek: gameweekId };

  const live = await fpl(`/event/${gameweekId}/live/`);
  const playerXg = new Map();
  for (const el of live.elements) {
    playerXg.set(el.id, Math.round(Number(el.stats?.expected_goals ?? 0) * 100) / 100);
  }

  const roster = (await env.DB.prepare("SELECT id, team_id FROM players").all()).results;
  const teamXg = new Map();
  for (const p of roster) {
    const xg = playerXg.get(p.id);
    if (xg == null) continue;
    teamXg.set(p.team_id, (teamXg.get(p.team_id) || 0) + xg);
  }

  const rStmt = env.DB.prepare(
    `INSERT INTO results (gameweek_id, category, subject_id, actual_xg)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(gameweek_id, category, subject_id) DO UPDATE SET actual_xg = ?4`
  );

  const rows = [];
  for (const [id, xg] of playerXg) rows.push(rStmt.bind(gameweekId, "player", id, xg));
  for (const [id, xg] of teamXg)
    rows.push(rStmt.bind(gameweekId, "team", id, Math.round(xg * 100) / 100));

  const feat = await env.DB.prepare(
    "SELECT featured_player_id FROM gameweeks WHERE id = ?1"
  ).bind(gameweekId).first();
  if (feat?.featured_player_id && playerXg.has(feat.featured_player_id)) {
    rows.push(rStmt.bind(gameweekId, "featured", feat.featured_player_id,
      playerXg.get(feat.featured_player_id)));
  }

  for (let i = 0; i < rows.length; i += 100) await env.DB.batch(rows.slice(i, i + 100));

  for (const category of ["player", "team", "featured"]) {
    const picks = (await env.DB.prepare(
      `SELECT p.user_id, p.xg, p.created_at, r.actual_xg
       FROM picks p
       JOIN results r ON r.gameweek_id = p.gameweek_id
                     AND r.category = p.category
                     AND r.subject_id = p.subject_id
       WHERE p.gameweek_id = ?1 AND p.category = ?2`
    ).bind(gameweekId, category).all()).results;

    if (!picks.length) { log[category] = 0; continue; }

    const scored = rankPicks(picks);

    await env.DB.prepare(
      "DELETE FROM scores WHERE gameweek_id = ?1 AND category = ?2"
    ).bind(gameweekId, category).run();

    const sStmt = env.DB.prepare(
      `INSERT INTO scores (gameweek_id, category, user_id, abs_diff, signed_diff, "rank", points)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    );
    await env.DB.batch(scored.map((s, i) =>
      sStmt.bind(gameweekId, category, s.user_id, s.abs, s.signed, i + 1,
        Math.max(1, scored.length - i))
    ));

    log[category] = scored.length;
  }

  await env.DB.prepare("UPDATE gameweeks SET status = 'settled' WHERE id = ?1")
    .bind(gameweekId).run();

  return log;
}

async function openNext(env, boot) {
  const next = boot.events.find((e) => e.is_next) || boot.events.find((e) => !e.finished);
  if (!next) return null;
  const y = Number(next.deadline_time.slice(0, 4));
  await env.DB.prepare(
    `INSERT INTO gameweeks (id, season, deadline, status) VALUES (?1, ?2, ?3, 'open')
     ON CONFLICT(id) DO UPDATE SET deadline = ?3`
  ).bind(next.id, `${y}/${y + 1 - 2000}`, next.deadline_time).run();
  await ensureFeatured(env, next.id, boot.elements);
  return next.id;
}

export async function runEngine(env) {
  const boot = await fpl("/bootstrap-static/");
  const out = { settled: [], opened: null };

  // data_checked = FPL dokončilo revizi statistik, teprve pak má smysl počítat
  for (const ev of boot.events.filter((e) => e.finished && e.data_checked)) {
    const gw = await env.DB.prepare("SELECT status FROM gameweeks WHERE id = ?1")
      .bind(ev.id).first();
    if (!gw || gw.status === "settled") continue;
    out.settled.push(await settle(env, ev.id));
  }

  out.opened = await openNext(env, boot);
  return out;
}
