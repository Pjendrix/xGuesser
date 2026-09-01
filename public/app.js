const $ = (s) => document.querySelector(s);
let state = { user: null, gameweek: null, player: [], team: [], chosen: {}, saved: {} };

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

/* ---------- Vyhledávací pole ---------- */
function label(cat, item) {
  return cat === "player" ? `${item.name} · ${item.team}` : item.name;
}

function wireCombo(cat) {
  const input = $(`#${cat}Search`);
  const list = $(`#${cat}List`);
  let active = -1;

  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };

  const choose = (item) => {
    state.chosen[cat] = item.id;
    input.value = label(cat, item);
    input.classList.add("is-set");
    close();
  };

  const render = (q) => {
    const needle = q.trim().toLowerCase();
    const pool = state[cat].filter((i) =>
      label(cat, i).toLowerCase().includes(needle)
    ).slice(0, 8);

    if (!pool.length) {
      list.innerHTML = '<li class="none">Nic takového tu není.</li>';
      list.hidden = false;
      return;
    }
    list.innerHTML = pool.map((i, n) =>
      `<li role="option" data-id="${i.id}" data-n="${n}">${label(cat, i)}</li>`).join("");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    list.querySelectorAll("li[data-id]").forEach((li) => {
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(state[cat].find((x) => x.id === Number(li.dataset.id)));
      });
    });
  };

  input.addEventListener("input", () => {
    state.chosen[cat] = null;
    input.classList.remove("is-set");
    render(input.value);
  });
  input.addEventListener("focus", () => render(input.value));
  input.addEventListener("blur", () => setTimeout(close, 120));

  input.addEventListener("keydown", (e) => {
    const items = [...list.querySelectorAll("li[data-id]")];
    if (!items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((li, n) => li.classList.toggle("is-active", n === active));
      items[active].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && active > -1) {
      e.preventDefault();
      choose(state[cat].find((x) => x.id === Number(items[active].dataset.id)));
    } else if (e.key === "Escape") close();
  });
}

/* ---------- xG dials ---------- */
function wireDial(cat) {
  const range = $(`#${cat}Range`), num = $(`#${cat}Num`), out = $(`#${cat}Out`);
  const show = (v) => {
    const n = Math.max(0.01, Math.min(10, Number(String(v).replace(",", ".")) || 0.01));
    out.textContent = n.toFixed(2);
    if (document.activeElement !== num) num.value = n.toFixed(2);
    if (n <= Number(range.max)) range.value = n;
  };
  range.addEventListener("input", () => show(range.value));
  num.addEventListener("input", () => show(num.value));
  num.addEventListener("blur", () => show(num.value));
  show(range.value);
}


/* ---------- Moje tipy ---------- */
function renderMine() {
  const box = $("#mine");
  if (!state.user || !state.gameweek) { box.hidden = true; return; }
  box.hidden = false;

  for (const cat of ["player", "team"]) {
    const slot = $(cat === "player" ? "#slotPlayer" : "#slotTeam");
    const s = state.saved[cat];
    const nameEl = slot.querySelector(".slot-name");
    const xgEl = slot.querySelector(".slot-xg");
    if (!s) {
      slot.classList.remove("is-set");
      nameEl.textContent = "zatím nic";
      xgEl.textContent = "—";
    } else {
      const item = state[cat].find((x) => x.id === s.subject_id);
      slot.classList.add("is-set");
      nameEl.textContent = item ? label(cat, item) : `#${s.subject_id}`;
      xgEl.textContent = Number(s.xg).toFixed(2) + " xG";
    }
  }

  const lock = $("#lock");
  const d = new Date(state.gameweek.deadline);
  if (!state.gameweek.open) {
    lock.textContent = "Kolo je uzamčené, tipy už měnit nejdou.";
  } else {
    const h = Math.max(0, Math.round((d - Date.now()) / 3600000));
    lock.textContent = h > 48
      ? `Změnit je můžeš do ${d.toLocaleString("cs-CZ", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`
      : `Zbývá zhruba ${h} h na úpravy.`;
  }
}

/* ---------- Data ---------- */
async function load() {
  const me = await (await fetch("/api/auth/me")).json();
  state.user = me.user;
  renderAccount();

  const data = await (await fetch("/api/gameweek")).json();
  state.gameweek = data.gameweek;
  state.player = data.players || [];
  state.team = data.teams || [];

  const dl = $("#deadline");
  if (!data.gameweek) {
    dl.textContent = "Další kolo se připravuje.";
  } else {
    const d = new Date(data.gameweek.deadline);
    dl.textContent = data.gameweek.open
      ? `Kolo ${data.gameweek.id} · tipy do ${d.toLocaleString("cs-CZ", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
      : `Kolo ${data.gameweek.id} · tipy jsou uzamčené`;
  }

  state.saved = data.picks || {};

  for (const cat of ["player", "team"]) {
    const p = data.picks[cat];
    if (!p) continue;
    const item = state[cat].find((x) => x.id === p.subject_id);
    if (item) {
      state.chosen[cat] = item.id;
      const inp = $(`#${cat}Search`);
      inp.value = label(cat, item);
      inp.classList.add("is-set");
    }
    $(`#${cat}Num`).value = p.xg;
    $(`#${cat}Num`).dispatchEvent(new Event("input"));
  }

  const canPlay = state.user && data.gameweek && data.gameweek.open;
  $("#picks").hidden = !canPlay;
  $("#gate").hidden = !!canPlay;
  if (!state.user) $("#gate").textContent = "Přihlas se Google účtem a odešli tipy pro nadcházející kolo.";
  else if (!data.gameweek) $("#gate").textContent = "Jakmile se otevře další kolo, objeví se tu tipovací formulář.";
  else if (!data.gameweek.open) $("#gate").textContent = "Tipy pro toto kolo jsou uzamčené. Výsledky doplníme po dohrání kola.";

  renderMine();
}

document.querySelectorAll("button.save").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const cat = btn.dataset.category;
    const msg = document.querySelector(`[data-msg="${cat}"]`);
    const subject_id = state.chosen[cat];

    if (!subject_id) {
      msg.className = "msg err";
      msg.textContent = cat === "player" ? "Vyber hráče ze seznamu." : "Vyber tým ze seznamu.";
      return;
    }

    const xg = Number($(`#${cat}Num`).value.replace(",", "."));
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
    if (r.ok) {
      state.saved[cat] = { subject_id, xg: out.xg };
      renderMine();
    }
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

wireCombo("player");
wireCombo("team");
wireDial("player");
wireDial("team");
load();
loadBoard("player");
