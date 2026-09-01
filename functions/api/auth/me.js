import { json, currentUser, cookie } from "../../_lib.js";

export async function onRequestGet({ request, env }) {
  const u = await currentUser(request, env);
  return json({ user: u ? { name: u.name, picture: u.picture, admin: u.admin } : null });
}

export async function onRequestDelete() {
  return json({ ok: true }, 200, { "set-cookie": cookie("xg_session", "", 0) });
}
