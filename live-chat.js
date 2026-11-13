// Live chat: what a visitor types goes to xolchade's Telegram, answers come back here over a WebSocket.
// The scripted buttons stay as a quick tour. Without `contacts.chatApi` in works.js the chat stays scripted.
import { contacts } from "./works.js";

const API = (contacts.chatApi || "").replace(/\/$/, "");
const SITE_KEY = contacts.turnstileKey || "";
const NUDGE_AFTER = 90e3; // offer to leave a contact if no answer within 90 s
const $ = (s) => document.querySelector(s);

const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

const live = {
  enabled: false,
  sid: store.get("xc_sid"),
  known: false,
  status: "online",
  seen: new Set(), // message ids already on screen
  lastId: 0,
  ws: null,
  retry: 0,
  nudged: store.get("xc_nudged") === "1",
  contact: false,
  nudgeTimer: 0,
  queue: Promise.resolve(), // owner messages are typed out one after another
};

const ui = () => window.__chat; // hooks exported by the main script
const statusText = () => (live.status === "online" ? "online" : "replies within a few hours");

function setStatus(s) {
  live.status = s === "away" ? "away" : "online";
  window.__chatStatus = statusText();
  const el = $("#status");
  if (el && el.textContent !== "typing…") el.textContent = statusText();
  $("#chat")?.classList.toggle("is-away", live.status === "away");
}

// ---------- rendering ----------

function note(text) {
  const li = document.createElement("li");
  li.className = "msg sys";
  li.textContent = text;
  ui().thread.append(li);
  ui().thread.scrollTop = ui().thread.scrollHeight;
  return li;
}

function mine(text) {
  const li = ui().add(text, "me");
  li.classList.add("pending");
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = "sending…";
  li.append(meta);
  return { li, meta };
}

function showOwner(m, animate = true) {
  if (live.seen.has(m.id)) return;
  live.seen.add(m.id);
  live.lastId = Math.max(live.lastId, m.id);
  clearTimeout(live.nudgeTimer);
  live.queue = live.queue.then(async () => {
    if (animate) await ui().typing(m.text);
    else ui().add(m.text);
  });
}

function showHistory(messages) {
  if (!messages.length) return;
  note("Earlier");
  for (const m of messages) {
    if (live.seen.has(m.id)) continue;
    live.seen.add(m.id);
    live.lastId = Math.max(live.lastId, m.id);
    if (m.who === "v") ui().add(m.text, "me");
    else if (m.who === "o") ui().add(m.text);
  }
}

// small inline form: email or @telegram
function askContact() {
  if (live.nudged || live.contact) return;
  live.nudged = true;
  store.set("xc_nudged", "1");
  live.queue = live.queue.then(async () => {
    const li = await ui().typing("Wanna leave your email or Telegram handle, in case I miss you here?");
    const form = document.createElement("form");
    form.className = "leave";
    form.innerHTML = `<input type="text" maxlength="200" placeholder="email or @handle" aria-label="Your email or Telegram" required><button>Send</button>`;
    li.after(Object.assign(document.createElement("li"), { className: "msg bot form" }));
    li.nextSibling.append(form);
    ui().thread.scrollTop = ui().thread.scrollHeight;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const value = form.querySelector("input").value.trim();
      if (!value) return;
      form.querySelector("button").disabled = true;
      const r = await post("/api/contact", { sid: live.sid, contact: value }).catch(() => null);
      if (r?.ok) {
        live.contact = true;
        form.parentElement.remove();
        ui().add(value, "me");
        ui().typing("Got it 🙌 I’ll reach out there if I miss you here.");
      } else {
        form.querySelector("button").disabled = false;
        form.querySelector("input").setCustomValidity("Couldn’t send, try again");
        form.querySelector("input").reportValidity();
      }
    });
  });
}

// ---------- network ----------

async function post(path, body) {
  const r = await fetch(API + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, ...data };
}

async function sync() {
  if (!live.sid) return;
  const r = await fetch(`${API}/api/state?sid=${live.sid}`).then((r) => r.json()).catch(() => null);
  if (!r) return;
  setStatus(r.status);
  live.known = r.known;
  live.contact = r.contact;
  for (const m of r.messages) if (m.who === "o" && m.id > live.lastId) showOwner(m);
}

function connect() {
  if (!live.sid || !live.known || live.ws || document.hidden) return;
  const ws = new WebSocket(`${API.replace(/^http/, "ws")}/api/ws?sid=${live.sid}`);
  live.ws = ws;
  let ping;
  ws.onopen = () => {
    live.retry = 0;
    ping = setInterval(() => ws.readyState === 1 && ws.send("ping"), 25e3);
    sync(); // pick up anything sent while we were away
  };
  ws.onmessage = (e) => {
    if (e.data === "pong") return;
    let d;
    try {
      d = JSON.parse(e.data);
    } catch {
      return;
    }
    if (d.type === "status") setStatus(d.status);
    if (d.type === "msg" && d.who === "o") showOwner(d);
  };
  ws.onclose = () => {
    clearInterval(ping);
    live.ws = null;
    if (document.hidden) return;
    const wait = Math.min(30e3, 1e3 * 2 ** live.retry++);
    setTimeout(connect, wait);
    if (live.retry > 3) sync(); // socket keeps failing: at least poll
  };
}

// Turnstile is loaded only when someone actually writes
let turnstileReady;
function captcha() {
  if (!SITE_KEY) return Promise.resolve("");
  turnstileReady ||= new Promise((resolve, reject) => {
    window.__tsLoaded = resolve;
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__tsLoaded";
    s.async = true;
    s.onerror = reject;
    document.head.append(s);
  });
  return turnstileReady.then(
    () =>
      new Promise((resolve) => {
        const box = document.createElement("div");
        box.className = "ts-box";
        document.body.append(box);
        let id, finished = false;
        const done = (token) => {
          if (finished) return;
          finished = true;
          clearTimeout(t);
          // remove the widget through Turnstile first, then its box
          setTimeout(() => {
            try {
              window.turnstile.remove(id);
            } catch {}
            box.remove();
          });
          resolve(token || "");
        };
        const t = setTimeout(() => done(""), 15e3);
        id = window.turnstile.render(box, { sitekey: SITE_KEY, appearance: "interaction-only", callback: done, "error-callback": () => (done(""), true), "expired-callback": () => done("") });
      })
  );
}

async function send(text) {
  const first = !live.known;
  if (!live.sid) {
    live.sid = crypto.randomUUID();
    store.set("xc_sid", live.sid);
  }
  const { li, meta } = mine(text);
  const cid = crypto.randomUUID();
  const attempt = async () => {
    li.classList.add("pending");
    li.classList.remove("failed");
    meta.textContent = "sending…";
    const turnstile = first ? await captcha().catch(() => "") : "";
    const r = await post("/api/send", { sid: live.sid, cid, text, turnstile, page: location.pathname }).catch(() => null);
    li.classList.remove("pending");
    if (r?.ok) {
      meta.textContent = "✓ in my Telegram";
      live.seen.add(r.id);
      if (r.status) setStatus(r.status);
      if (!live.known) {
        live.known = true;
        live.queue = live.queue.then(() =>
          ui().typing(live.status === "online" ? "Sent to my Telegram ✓ I’ll answer right here, usually within minutes." : "Sent to my Telegram ✓ I’m away right now, but I’ll answer right here.")
        );
        connect();
      }
      clearTimeout(live.nudgeTimer);
      live.nudgeTimer = setTimeout(askContact, live.status === "online" ? NUDGE_AFTER : 4e3);
      return;
    }
    li.classList.add("failed");
    const msg = { captcha: "couldn’t verify you’re human", rate_limited: "too fast, try in a minute", too_long: "too long (1000 chars max)" }[r?.error] || "not sent";
    meta.innerHTML = "";
    meta.append(`${msg} · `);
    const again = Object.assign(document.createElement("button"), { type: "button", className: "retry", textContent: "retry" });
    again.onclick = attempt;
    meta.append(again);
  };
  await attempt();
}

// ---------- start ----------

function start() {
  if (!API || !window.__chat) return;
  live.enabled = true;
  window.liveChat = live;
  live.send = send;
  $("#chat")?.classList.add("is-live");
  const input = $("#q");
  if (input) input.placeholder = "Write to me, I answer here…";
  const noteEl = $(".chat-note");
  if (noteEl) noteEl.innerHTML = `Buttons are a quick tour. Anything you type lands in my Telegram, and I answer right here. Or <a data-link="telegram" href="${contacts.telegram}" target="_blank" rel="noopener">DM me</a>.`;

  fetch(`${API}/api/status`).then((r) => r.json()).then((d) => setStatus(d.status)).catch(() => {});

  if (live.sid) {
    fetch(`${API}/api/state?sid=${live.sid}`)
      .then((r) => r.json())
      .then(async (r) => {
        live.known = r.known;
        live.contact = r.contact;
        setStatus(r.status);
        if (!r.known) return;
        await ui().ready; // let the greeting finish first
        showHistory(r.messages);
        connect();
      })
      .catch(() => {});
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      connect();
      sync();
    }
  });
}

if (window.__chat) start();
else addEventListener("chat:ready", start, { once: true });
