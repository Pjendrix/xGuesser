const $ = (s) => document.querySelector(s);
let state = { user: null, gameweek: null };

/* ---------- Google Sign-In ---------- */
window.onload = () => {
  if (!window.google || !window.GOOGLE_CLIENT_ID) return;
  google.accounts.id.initialize({
    client_id: window.GOOGLE_CLIENT_ID,
    callback: async ({ credential }) => {
      const r = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (r.ok) location.reload();
    },
  });
  if (!state.user) {
    google.accounts.id.renderButton($("#gsi"), { theme: "filled_black", size: "medium", text: "signin" });
  }
};

function renderAccount() {
  const box = $("#account");
  if (!state.user) return;
  box.innerHTML = "";
  if (state.user.picture) {
    const img = new Image();
    img.src = state.user.picture; img.alt = "";
    box.append(img);
  }
  const name = document.createElement("span");
  name.textContent = state.user.name;
  const out = document.createElement("button");
  out.className = "signout"; out.textContent = "Odhlásit";
  out.onclick = async () => { await fetch("/api/auth/me", { method: "DELETE" }); location.reload(); };
  box.append(name, out);
}

/* ---------- xG dials ---------- */
function wireDial(cat) {
  const range = $(`#${cat}Range`), num = $(`#${cat}Num`), out = $(`#${cat}Out`);
  const show = (v) => {
    const n = Math.max(0.01, Math.min(10, Number(v) || 0.01));
    out.textContent = n.toFixed(2);
    if (document.activeElement !== num) num.value = n.toFixed(2);
    if (n <= Number(range.max)) range.value = n;
  };
  range.addEventListener("input", () => show(range.value));
  num.addEventListener("input", () => show(num.value));
  num.addEventListener("blur", () => show(num.value));
  show(range.value);
}

/* ---------- Data ---------- */
async function load() {
  const me = await (await fetch("/api/auth/me")).json();
  state.user = me.user;
  renderAccount();

  const data = await (await fetch("/api/gameweek")).json();
  state.gameweek = data.gameweek;

  const dl = $("#deadline");
  if (!data.gameweek) {
    dl.textContent = "Další kolo se připravuje.";
  } else {
    const d = new Date(data.gameweek.deadline);
    dl.textContent = data.gameweek.open
      ? `Kolo ${data.gameweek.id} · tipy do ${d.toLocaleString("cs-CZ", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
      : `Kolo ${data.gameweek.id} · tipy jsou uzamčené`;
  }

  const ps = $("#playerSelect"), ts = $("#teamSelect");
  ps.innerHTML = data.players.map((p) =>
    `<option value="${p.id}">${p.team} — ${p.name}</option>`).join("");
  ts.innerHTML = data.teams.map((t) =>
    `<option value="${t.id}">${t.name}</option>`).join("");

  if (data.picks.player) {
    ps.value = data.picks.player.subject_id;
    $("#playerNum").value = data.picks.player.xg;
    $("#playerNum").dispatchEvent(new Event("input"));
  }
  if (data.picks.team) {
    ts.value = data.picks.team.subject_id;
    $("#teamNum").value = data.picks.team.xg;
    $("#teamNum").dispatchEvent(new Event("input"));
  }

  const canPlay = state.user && data.gameweek && data.gameweek.open;
  $("#picks").hidden = !canPlay;
  $("#gate").hidden = !!canPlay;
  if (!state.user) $("#gate").textContent = "Přihlas se Google účtem a odešli tipy pro nadcházející kolo.";
  else if (!data.gameweek) $("#gate").textContent = "Jakmile se otevře další kolo, objeví se tu tipovací formulář.";
  else if (!data.gameweek.open) $("#gate").textContent = "Tipy pro toto kolo jsou uzamčené. Výsledky doplníme po dohrání kola.";
}

document.querySelectorAll("button.save").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const cat = btn.dataset.category;
    const msg = document.querySelector(`[data-msg="${cat}"]`);
    const subject_id = Number($(cat === "player" ? "#playerSelect" : "#teamSelect").value);
    const xg = Number($(`#${cat}Num`).value);

    btn.disabled = true;
    msg.className = "msg"; msg.textContent = "Ukládám…";
    const r = await fetch("/api/picks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: cat, subject_id, xg }),
    });
    const out = await r.json();
    btn.disabled = false;
    msg.className = "msg " + (r.ok ? "ok" : "err");
    msg.textContent = r.ok ? `Uloženo: ${out.xg.toFixed(2)} xG` : out.error;
  });
});

/* ---------- Leaderboard ---------- */
async function loadBoard(cat) {
  const list = $("#ranks");
  const data = await (await fetch(`/api/leaderboard?category=${cat}`)).json();
  if (!data.rows.length) {
    list.innerHTML = '<li class="empty">Zatím žádné vyhodnocené kolo.</li>';
    return;
  }
  list.innerHTML = data.rows.map((r, i) => `
    <li>
      <span class="pos">${i + 1}</span>
      <span>${r.name}</span>
      <span class="diff">${r.points} b · ø ${Number(r.avg_diff).toFixed(2)}</span>
    </li>`).join("");
}

document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("is-on"));
    t.classList.add("is-on");
    loadBoard(t.dataset.cat);
  });
});

/* ---------- Contact (Formspree) ---------- */
$("#contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target, msg = $("#contactMsg");
  msg.className = "msg"; msg.textContent = "Odesílám…";
  const r = await fetch(form.action, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: new FormData(form),
  });
  msg.className = "msg " + (r.ok ? "ok" : "err");
  msg.textContent = r.ok ? "Zpráva odešla. Díky!" : "Odeslání selhalo, zkus to prosím znovu.";
  if (r.ok) form.reset();
});

wireDial("player");
wireDial("team");
load();
loadBoard("player");
