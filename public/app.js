const $ = (s) => document.querySelector(s);
const CATS = ["featured", "player", "team"];
let state = { user: null, gameweek: null, featured: null, player: [], team: [], chosen: {}, saved: {} };

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
  out.className = "signout"; out.textContent = "Sign out";
  out.onclick = async () => { await fetch("/api/auth/me", { method: "DELETE" }); location.reload(); };
  box.append(name, out);
}

/* ---------- Searchable inputs ---------- */
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
      list.innerHTML = '<li class="none">Nothing matches that.</li>';
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

/* ---------- Your picks ---------- */
const SLOT = { featured: "#slotFeatured", player: "#slotPlayer", team: "#slotTeam" };

function renderMine() {
  const box = $("#mine");
  if (!state.user || !state.gameweek) { box.hidden = true; return; }
  box.hidden = false;

  for (const cat of CATS) {
    const slot = $(SLOT[cat]);
    const s = state.saved[cat];
    const nameEl = slot.querySelector(".slot-name");
    const xgEl = slot.querySelector(".slot-xg");
    if (!s) {
      slot.classList.remove("is-set");
      nameEl.textContent = "nothing yet";
      xgEl.textContent = "—";
      continue;
    }
    slot.classList.add("is-set");
    if (cat === "featured") {
      nameEl.textContent = state.featured
        ? `${state.featured.name} · ${state.featured.team}` : `#${s.subject_id}`;
    } else {
      const item = state[cat].find((x) => x.id === s.subject_id);
      nameEl.textContent = item ? label(cat, item) : `#${s.subject_id}`;
    }
    xgEl.textContent = Number(s.xg).toFixed(2) + " xG";
  }

  const lock = $("#lock");
  const d = new Date(state.gameweek.deadline);
  if (!state.gameweek.open) {
    lock.textContent = "This gameweek is locked, picks can no longer be changed.";
  } else {
    const h = Math.max(0, Math.round((d - Date.now()) / 3600000));
    lock.textContent = h > 48
      ? `You can change them until ${d.toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`
      : `About ${h} h left to edit.`;
  }
}

/* ---------- Data ---------- */
async function load() {
  const me = await (await fetch("/api/auth/me")).json();
  state.user = me.user;
  renderAccount();

  const data = await (await fetch("/api/gameweek")).json();
  state.gameweek = data.gameweek;
  state.featured = data.featured || null;
  state.player = data.players || [];
  state.team = data.teams || [];
  state.saved = data.picks || {};

  const dl = $("#deadline");
  if (!data.gameweek) {
    dl.textContent = "The next gameweek is being prepared.";
  } else {
    const d = new Date(data.gameweek.deadline);
    dl.textContent = data.gameweek.open
      ? `Gameweek ${data.gameweek.id} · picks until ${d.toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
      : `Gameweek ${data.gameweek.id} · picks are locked`;
  }

  const card = document.querySelector(".pick-featured");
  if (state.featured) {
    $("#drawnName").textContent = state.featured.name;
    $("#drawnTeam").textContent = `${state.featured.team_name} · ${state.featured.position}`;
    card.hidden = false;
  } else {
    card.hidden = true;
  }

  for (const cat of ["player", "team"]) {
    const p = state.saved[cat];
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
  if (state.saved.featured) {
    $("#featuredNum").value = state.saved.featured.xg;
    $("#featuredNum").dispatchEvent(new Event("input"));
  }

  const canPlay = state.user && data.gameweek && data.gameweek.open;
  $("#picks").hidden = !canPlay;
  $("#gate").hidden = !!canPlay;
  if (!state.user) $("#gate").textContent = "Sign in with Google to submit your picks for the upcoming gameweek.";
  else if (!data.gameweek) $("#gate").textContent = "The picking form will appear as soon as the next gameweek opens.";
  else if (!data.gameweek.open) $("#gate").textContent = "Picks for this gameweek are locked. Results follow once the round is played out.";

  renderMine();
}

document.querySelectorAll("button.save").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const cat = btn.dataset.category;
    const msg = document.querySelector(`[data-msg="${cat}"]`);
    const subject_id = cat === "featured"
      ? (state.featured ? state.featured.id : null)
      : state.chosen[cat];

    if (!subject_id) {
      msg.className = "msg err";
      msg.textContent = cat === "team" ? "Pick a team from the list." : "Pick a player from the list.";
      return;
    }

    const xg = Number($(`#${cat}Num`).value.replace(",", "."));
    btn.disabled = true;
    msg.className = "msg"; msg.textContent = "Saving…";
    const r = await fetch("/api/picks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: cat, subject_id, xg }),
    });
    const out = await r.json();
    btn.disabled = false;
    msg.className = "msg " + (r.ok ? "ok" : "err");
    msg.textContent = r.ok ? `Saved: ${out.xg.toFixed(2)} xG` : out.error;
    if (r.ok) {
      state.saved[cat] = { subject_id: out.subject_id, xg: out.xg };
      renderMine();
    }
  });
});

/* ---------- Leaderboard ---------- */
async function loadBoard(cat) {
  const list = $("#ranks");
  const data = await (await fetch(`/api/leaderboard?category=${cat}`)).json();
  if (!data.rows.length) {
    list.innerHTML = '<li class="empty">No gameweek has been settled yet.</li>';
    return;
  }
  list.innerHTML = data.rows.map((r, i) => `
    <li>
      <span class="pos">${i + 1}</span>
      <span>${r.name}</span>
      <span class="diff">${r.points} pts · avg ${Number(r.avg_diff).toFixed(2)}</span>
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
  msg.className = "msg"; msg.textContent = "Sending…";
  const r = await fetch(form.action, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: new FormData(form),
  });
  msg.className = "msg " + (r.ok ? "ok" : "err");
  msg.textContent = r.ok ? "Message sent. Thanks!" : "Sending failed, please try again.";
  if (r.ok) form.reset();
});

wireCombo("player");
wireCombo("team");
wireDial("featured");
wireDial("player");
wireDial("team");
load();
loadBoard("featured");
