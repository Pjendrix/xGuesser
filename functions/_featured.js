// Deterministický los hráče kola.
// Stejné kolo → vždy stejný hráč, takže se v průběhu týdne nemění.

function hash(n) {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// candidates = pole FPL elements
export function drawFeatured(gameweekId, elements) {
  const pool = elements
    .filter((e) =>
      e.element_type !== 5 &&
      e.element_type !== 1 &&              // brankáře nelosujeme
      e.status === "a" &&                  // není zraněný ani mimo
      Number(e.minutes) > 0 &&
      Number(e.now_cost) >= 45             // odfiltruje hráče mimo rotaci
    )
    .sort((a, b) => a.id - b.id);

  if (!pool.length) return null;
  return pool[hash(gameweekId) % pool.length].id;
}

export async function ensureFeatured(env, gameweekId, elements) {
  const row = await env.DB.prepare(
    "SELECT featured_player_id FROM gameweeks WHERE id = ?1"
  ).bind(gameweekId).first();

  if (row && row.featured_player_id) return row.featured_player_id;

  const id = drawFeatured(gameweekId, elements);
  if (!id) return null;

  await env.DB.prepare(
    "UPDATE gameweeks SET featured_player_id = ?1 WHERE id = ?2"
  ).bind(id, gameweekId).run();

  return id;
}
