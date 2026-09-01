import { json, bad, requireUser } from "../../_lib.js";
import { runEngine } from "../../_engine.js";

// POST /api/admin/settle — ruční spuštění téhož, co dělá /api/tick.
export async function onRequestPost({ request, env }) {
  let user;
  try { user = await requireUser(request, env); } catch (r) { return r; }
  if (!user.admin) return bad("Admins only.", 403);
  try {
    return json(await runEngine(env));
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
