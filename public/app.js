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
      `<li role="option" data-id="${i.id}" data-n="${n}">${badgeHtml(cat === "team" ? i.short_name : i.team)}<span>${i.name}</span></li>`).join("");
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


/* ---------- Team badges ---------- */
const TEAM_COLOURS = {
  ARS: ["#EF0107", "#FFFFFF"], AVL: ["#670E36", "#95BFE5"], BOU: ["#DA291C", "#FFFFFF"],
  BRE: ["#D20000", "#FFFFFF"], BHA: ["#0057B8", "#FFCD00"], BUR: ["#6C1D45", "#F4C300"],
  CHE: ["#034694", "#FFFFFF"], COV: ["#4B92DB", "#FFFFFF"], CRY: ["#1B458F", "#C4122E"],
  EVE: ["#003399", "#FFFFFF"], FUL: ["#000000", "#FFFFFF"], HUL: ["#F5A12D", "#000000"],
  IPS: ["#0044A9", "#FFFFFF"], LEE: ["#FFCD00", "#1D428A"], LEI: ["#003090", "#FDBE11"],
  LIV: ["#C8102E", "#FFFFFF"], MCI: ["#6CABDD", "#1C2C5B"], MUN: ["#DA291C", "#FBE122"],
  NEW: ["#241F20", "#FFFFFF"], NFO: ["#DD0000", "#FFFFFF"], SOU: ["#D71920", "#FFFFFF"],
  SUN: ["#EB172B", "#FFFFFF"], TOT: ["#132257", "#FFFFFF"], WHU: ["#7A263A", "#1BB1E7"],
  WOL: ["#FDB913", "#231F20"],
};

function badgeHtml(short) {
  const key = (short || "").toUpperCase();
  const [bg, fg] = TEAM_COLOURS[key] || ["#1E3A57", "#EAF2FB"];
  return `<span class="badge" style="--bg:${bg};--fg:${fg}">${key || "??"}</span>`;
}

function shortOf(cat, s) {
  if (cat === "featured") return state.featured ? state.featured.team : "";
  if (cat === "team") {
    const t = state.team.find((x) => x.id === s.subject_id);
    return t ? t.short_name : "";
  }
  const p = state.player.find((x) => x.id === s.subject_id);
  return p ? p.team : "";
}

/* ---------- Your picks ---------- */
const SLOT = { featured: "#slotFeatured", player: "#slotPlayer", team: "#slotTeam" };

function renderMine() {
  const box = $("#mine");
  if (!state.user || !state.gameweek) { box.hidden = true; return; }
  box.hidden = false;

  const EMPTY = { featured: "no round pick", player: "no player pick", team: "no team pick" };

  for (const cat of CATS) {
    const slot = $(SLOT[cat]);
    const s = state.saved[cat];
    const badgeEl = slot.querySelector(".slot-badge");
    const nameEl = slot.querySelector(".slot-name");
    const xgEl = slot.querySelector(".slot-xg");

    if (!s) {
      slot.classList.remove("is-set");
      badgeEl.innerHTML = '<span class="badge is-empty">—</span>';
      nameEl.textContent = EMPTY[cat];
      xgEl.textContent = "";
      continue;
    }

    slot.classList.add("is-set");
    badgeEl.innerHTML = badgeHtml(shortOf(cat, s));

    if (cat === "featured") {
      nameEl.textContent = state.featured ? state.featured.name : `#${s.subject_id}`;
    } else if (cat === "team") {
      const t = state.team.find((x) => x.id === s.subject_id);
      nameEl.textContent = t ? t.name : `#${s.subject_id}`;
    } else {
      const p = state.player.find((x) => x.id === s.subject_id);
      nameEl.textContent = p ? p.name : `#${s.subject_id}`;
    }
    xgEl.textContent = Number(s.xg).toFixed(2);
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
    $("#drawnBadge").innerHTML = badgeHtml(state.featured.team);
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
let board = { cat: "featured", gw: null, sort: "points" };

function fmt(n) { return n == null ? "—" : Number(n).toFixed(2); }

async function loadBoard() {
  const list = $("#ranks");
  const q = board.gw ? `&gw=${board.gw}` : `&sort=${board.sort}`;
  const data = await (await fetch(`/api/leaderboard?category=${board.cat}${q}`)).json();

  const scope = $("#scope");
  const tabs = [`<button class="chip${board.gw ? "" : " is-on"}" data-gw="">Season</button>`]
    .concat((data.gameweeks || []).map((g) =>
      `<button class="chip${board.gw === g ? " is-on" : ""}" data-gw="${g}">GW ${g}</button>`));
  scope.innerHTML = tabs.join("");
  scope.querySelectorAll(".chip").forEach((c) => {
    c.addEventListener("click", () => {
      board.gw = c.dataset.gw ? Number(c.dataset.gw) : null;
      loadBoard();
    });
  });

  const sortBox = $("#sortBy");
  sortBox.hidden = !!board.gw;
  if (!board.gw) {
    sortBox.innerHTML = [
      ["points", "By points"],
      ["podium", "By podiums"],
    ].map(([k, lbl]) =>
      `<button class="chip${board.sort === k ? " is-on" : ""}" data-sort="${k}">${lbl}</button>`
    ).join("");
    sortBox.querySelectorAll(".chip").forEach((c) => {
      c.addEventListener("click", () => { board.sort = c.dataset.sort; loadBoard(); });
    });
  }

  const note = $("#drawnNote");
  if (data.subject) {
    note.hidden = false;
    note.innerHTML = `${badgeHtml(data.subject.short)}<span>Everyone guessed <strong>${data.subject.name}</strong> — he finished on <strong>${fmt(data.subject.actual_xg)} xG</strong></span>`;
  } else {
    note.hidden = true;
  }

  if (!data.rows.length) {
    list.innerHTML = '<li class="empty">No gameweek has been settled yet.</li>';
    return;
  }

  if (data.scope === "season") {
    list.innerHTML = data.rows.map((r, i) => {
      const medals = `<span class="medals">
        <span class="m m1" title="wins">${r.gold || 0}</span>
        <span class="m m2" title="second places">${r.silver || 0}</span>
        <span class="m m3" title="third places">${r.bronze || 0}</span></span>`;
      const tail = board.sort === "podium"
        ? `${r.points} pts`
        : `${r.points} pts · avg ${fmt(r.avg_diff)}`;
      return `
      <li class="season">
        <span class="pos">${i + 1}</span>
        <span class="who">${r.name}</span>
        ${medals}
        <span class="diff">${tail}</span>
      </li>`;
    }).join("");
    return;
  }

  list.innerHTML = data.rows.map((r) => {
    const pickedName = board.cat === "featured"
      ? "" : (r.subject ? `${badgeHtml(r.subject.short)}<span class="picked">${r.subject.name}</span>` : "");
    return `
      <li class="detail">
        <span class="pos">${r.rank}</span>
        <span class="who">${r.name}</span>
        <span class="pickcell">${pickedName}</span>
        <span class="diff"><strong>${fmt(r.pick_xg)}</strong> vs ${fmt(r.actual_xg)} · ${r.points} pts</span>
      </li>`;
  }).join("");
}

document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("is-on"));
    t.classList.add("is-on");
    board.cat = t.dataset.cat;
    loadBoard();
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
loadBoard();
