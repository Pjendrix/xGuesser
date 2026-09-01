import { json } from "../_lib.js";
import { runEngine } from "../_engine.js";

// GET /api/tick?key=<CRON_KEY>
// Volá se zvenku podle časovače (cron-job.org apod.).
// Běh je idempotentní, opakované volání nic nerozbije.
export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get("key");
  if (!env.CRON_KEY || key !== env.CRON_KEY) {
    return new Response("Nope", { status: 403 });
  }
  try {
    return json(await runEngine(env));
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
