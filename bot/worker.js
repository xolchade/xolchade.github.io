// xolchade bot — Telegram bot + live site chat on Cloudflare Workers
// Site visitors write in the chat on xolchade.dev, the owner answers from a Telegram group
// (one forum topic per visitor), and the answer lands back on the site over a WebSocket.

const SITE = "https://xolchade.dev";
const MAX_TEXT = 1000;
const MAX_CONTACT = 200;
const AWAY_AFTER = 3 * 3600e3; // owner counts as away after 3h of silence

// Labels for project kinds from works.js
const kinds = { miniapp: "Mini App", bot: "Bot", api: "API", ai: "AI", ui: "UI/UX", "3d": "2D/3D" };

const mainKeyboard = {
  inline_keyboard: [
    [{ text: "Show me your work", callback_data: "works" }, { text: "What can you build?", callback_data: "services" }],
    [{ text: "How do you work?", callback_data: "process" }, { text: "Let’s build something", callback_data: "contact" }],
    [{ text: "🌐 Open portfolio", web_app: { url: SITE } }],
  ],
};

const servicesText = [
  "<b>Mini Apps &amp; bots, API integrations, AI features and the UI on top.</b>",
  "",
  "<b>Telegram Mini Apps &amp; bots</b>\nYour product lives where your users already hang out. No app store, no installs: one tap and they’re in.",
  "<b>API integrations</b>\nPayments, CRMs, spreadsheets, whatever you run on. I make your tools talk to each other.",
  "<b>AI inside the product</b>\nText, images, assistants, automations. AI models plugged into real user flows.",
  "<b>UI/UX design</b>\nInterfaces that feel native to Telegram and obvious on the first tap.",
].join("\n");

const processText = [
  "<b>TL;DR: we nail the brief, I prototype, I build, we ship.</b>",
  "",
  "<b>1. Nail the brief</b>\nA quick call to lock in the goal, the audience and the timeline.",
  "<b>2. Prototype first</b>\nUser flows and a clickable prototype before any code.",
  "<b>3. Build &amp; wire it up</b>\nMini App, bot, integrations, AI. You see progress along the way: no black box.",
  "<b>4. Ship &amp; polish</b>\nLaunch, test with real users, fix what needs fixing.",
].join("\n");

const helpText = [
  "<b>Owner commands</b>",
  "/bind &lt;key&gt; — use this group as the inbox (send it in the group)",
  "/online, /away — what site visitors see in the chat header",
  "/status — current state",
  "",
  "Answer a visitor by writing in their topic. Reactions on your message: 👍 delivered live, 🕊 saved until they come back.",
].join("\n");

// ---------- worker: routing, CORS, anti-spam ----------

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const hub = () => env.HUB.get(env.HUB.idFromName("hub"));

    if (url.pathname.startsWith("/api/")) {
      const cors = corsHeaders(req, env);
      if (req.method === "OPTIONS") return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
      if (!cors) return new Response("Forbidden", { status: 403 });
      // WebSocket upgrades go straight to the hub (browsers don't send CORS preflights for them)
      if (url.pathname === "/api/ws") return hub().fetch(req);
      const r = await api(req, url, env, hub);
      const res = new Response(r.body, r); // responses from the hub have immutable headers
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    }

    // One-time setup: open https://<worker>/setup?key=SETUP_KEY in a browser
    if (url.pathname === "/setup") {
      if (!env.SETUP_KEY || url.searchParams.get("key") !== env.SETUP_KEY) return new Response("Wrong key", { status: 403 });
      return Response.json(await setup(env, url.origin));
    }

    if (req.method !== "POST") return new Response("xolchade bot is running ✅");
    if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret(env)) return new Response("Forbidden", { status: 403 });

    const update = await req.text();
    ctx.waitUntil(hub().fetch("https://hub/tg", { method: "POST", body: update }).catch((e) => console.log("tg error", e.stack)));
    return new Response("ok");
  },
};

async function api(req, url, env, hub) {
  const json = (data, status = 200) => Response.json(data, { status });

  if (url.pathname === "/api/status" && req.method === "GET") return hub().fetch("https://hub/status");

  if (url.pathname === "/api/state" && req.method === "GET") {
    const sid = url.searchParams.get("sid") || "";
    if (!validSid(sid)) return json({ error: "bad_sid" }, 400);
    return hub().fetch(`https://hub/state?sid=${sid}`);
  }

  if (req.method !== "POST" || !["/api/send", "/api/contact"].includes(url.pathname)) return json({ error: "not_found" }, 404);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (!validSid(body.sid)) return json({ error: "bad_sid" }, 400);

  const meta = {
    ip: req.headers.get("CF-Connecting-IP") || "local",
    country: req.cf?.country || "",
    city: req.cf?.city || "",
    page: String(body.page || "").slice(0, 120),
  };

  if (url.pathname === "/api/contact") {
    const contact = String(body.contact || "").trim();
    if (!contact || contact.length > MAX_CONTACT) return json({ error: "bad_contact" }, 400);
    return hub().fetch("https://hub/contact", { method: "POST", body: JSON.stringify({ sid: body.sid, contact, meta }) });
  }

  const text = String(body.text || "").trim();
  if (!text) return json({ error: "empty" }, 400);
  if (text.length > MAX_TEXT) return json({ error: "too_long", max: MAX_TEXT }, 400);

  // Turnstile only for the first message of a session; verify in parallel with the lookup
  const [known, human] = await Promise.all([
    hub().fetch(`https://hub/known?sid=${body.sid}`).then((r) => r.json()),
    env.TURNSTILE_SECRET && body.turnstile ? verifyTurnstile(env, body.turnstile, meta.ip) : Promise.resolve(false),
  ]);
  if (!known.known && env.TURNSTILE_SECRET && !human) return json({ error: "captcha" }, 403);

  return hub().fetch("https://hub/send", {
    method: "POST",
    body: JSON.stringify({ sid: body.sid, cid: String(body.cid || "").slice(0, 64), text, meta }),
  });
}

function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || SITE).split(",").map((s) => s.trim());
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === "null";
  if (!ok) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function verifyTurnstile(env, token, ip) {
  if (!token) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  form.append("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    return (await r.json()).success === true;
  } catch {
    return false;
  }
}

const validSid = (s) => typeof s === "string" && /^[a-zA-Z0-9-]{16,64}$/.test(s);
const secret = (env) => (env.SETUP_KEY || "").replace(/[^A-Za-z0-9_-]/g, "") || "xolchade";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const short = (sid) => sid.replace(/-/g, "").slice(0, 4);
const flag = (cc) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐");

// Telegram API call
async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

// ---------- hub: one Durable Object holds sessions, messages, sockets and owner state ----------

export class Hub {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY, topic INTEGER, tg_user INTEGER, label TEXT,
      contact TEXT, created INTEGER, last INTEGER)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, sid TEXT, who TEXT, text TEXT, cid TEXT, ts INTEGER)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS messages_sid ON messages (sid, id)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS hits (k TEXT PRIMARY KEY, n INTEGER, reset INTEGER)`);
    this.queues = new Map(); // sid → promise: Telegram deliveries per visitor, in order
  }

  // Telegram delivery runs after the visitor already has their answer; per-visitor order is kept,
  // so a burst of messages never opens two topics. Retries once after a short pause.
  deliver(sid, html) {
    const run = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (await this.toOwner(this.session(sid), html)) return;
        } catch (e) {
          console.log("deliver error", e.stack);
        }
        await sleep(1500);
      }
    };
    const next = (this.queues.get(sid) || Promise.resolve()).then(run);
    this.queues.set(sid, next);
    next.then(() => this.queues.get(sid) === next && this.queues.delete(sid));
    return next;
  }
  settled() {
    return Promise.all([...this.queues.values()]);
  }

  // small helpers over SQLite
  get(k) {
    return this.sql.exec(`SELECT v FROM kv WHERE k = ?`, k).toArray()[0]?.v ?? null;
  }
  set(k, v) {
    this.sql.exec(`INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, String(v));
  }
  session(sid) {
    return this.sql.exec(`SELECT * FROM sessions WHERE sid = ?`, sid).toArray()[0] || null;
  }
  sessionBy(field, value) {
    return this.sql.exec(`SELECT * FROM sessions WHERE ${field} = ?`, value).toArray()[0] || null;
  }
  addMessage(sid, who, text, cid = "") {
    const ts = Date.now();
    this.sql.exec(`INSERT INTO messages (sid, who, text, cid, ts) VALUES (?, ?, ?, ?, ?)`, sid, who, text, cid, ts);
    this.sql.exec(`UPDATE sessions SET last = ? WHERE sid = ?`, ts, sid);
    const id = this.sql.exec(`SELECT last_insert_rowid() AS id`).toArray()[0].id;
    return { id, who, text, ts };
  }

  // fixed-window rate limit; returns false when over the limit
  hit(key, limit, windowMs) {
    const now = Date.now();
    const row = this.sql.exec(`SELECT n, reset FROM hits WHERE k = ?`, key).toArray()[0];
    if (!row || row.reset < now) {
      this.sql.exec(`INSERT INTO hits (k, n, reset) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = 1, reset = excluded.reset`, key, now + windowMs);
      return true;
    }
    if (row.n >= limit) return false;
    this.sql.exec(`UPDATE hits SET n = n + 1 WHERE k = ?`, key);
    return true;
  }

  presence() {
    const manual = this.get("status") || "online";
    const seen = Number(this.get("owner_seen") || 0);
    const away = manual === "away" || !seen || Date.now() - seen > AWAY_AFTER;
    return away ? "away" : "online";
  }

  broadcast(data, sid) {
    const msg = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets(sid)) {
      try {
        ws.send(msg);
      } catch {}
    }
  }

  async fetch(req) {
    const url = new URL(req.url);
    const json = (data, status = 200) => Response.json(data, { status });

    switch (url.pathname) {
      case "/api/ws": {
        if (req.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
        const sid = url.searchParams.get("sid") || "";
        if (!validSid(sid) || !this.session(sid)) return new Response("Unknown session", { status: 404 });
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server, [sid]);
        server.send(JSON.stringify({ type: "status", status: this.presence() }));
        return new Response(null, { status: 101, webSocket: client });
      }
      case "/status":
        return json({ status: this.presence() });
      case "/known":
        return json({ known: !!this.session(url.searchParams.get("sid")) });
      case "/state": {
        const sid = url.searchParams.get("sid");
        const s = this.session(sid);
        const messages = s
          ? this.sql.exec(`SELECT id, who, text, ts FROM messages WHERE sid = ? ORDER BY id DESC LIMIT 100`, sid).toArray().reverse()
          : [];
        return json({ status: this.presence(), known: !!s, contact: !!s?.contact, messages });
      }
      case "/send":
        return this.onVisitorMessage(await req.json());
      case "/contact":
        return this.onContact(await req.json());
      case "/tg":
        await this.onTelegram(await req.json());
        return new Response("ok");
    }
    return new Response("Not found", { status: 404 });
  }

  // WebSocket events (hibernation API): the client only pings to keep the line warm
  async webSocketMessage(ws, msg) {
    if (msg === "ping") ws.send("pong");
  }
  async webSocketClose(ws, code) {
    try {
      ws.close(code, "bye");
    } catch {}
  }

  // ---------- site visitor ----------

  async onVisitorMessage({ sid, cid, text, meta }) {
    if (!this.hit(`ip:${meta.ip}:day`, 80, 86400e3) || !this.hit(`sid:${sid}:min`, 6, 60e3) || !this.hit(`sid:${sid}:day`, 60, 86400e3)) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }

    // the same client message retried after a network hiccup is stored once
    if (cid) {
      const dup = this.sql.exec(`SELECT id, ts FROM messages WHERE sid = ? AND cid = ?`, sid, cid).toArray()[0];
      if (dup) return Response.json({ ok: true, id: dup.id, ts: dup.ts, status: this.presence() });
    }

    let s = this.session(sid);
    const isNew = !s;
    if (isNew) {
      const label = `${flag(meta.country)} Site visitor #${short(sid)}${meta.country ? ` · ${meta.country}` : ""}`;
      this.sql.exec(`INSERT INTO sessions (sid, label, created, last) VALUES (?, ?, ?, ?)`, sid, label, Date.now(), Date.now());
      s = this.session(sid);
    }
    const m = this.addMessage(sid, "v", text, cid);

    const intro = isNew
      ? `🌐 <b>New chat from xolchade.dev</b>\n${[meta.city, meta.country].filter(Boolean).join(", ") || "Location unknown"}${meta.page ? ` · ${esc(meta.page)}` : ""}\nReply in this topic: it shows up in their chat live.\n\n`
      : "";
    this.deliver(sid, `${intro}${esc(text)}`);
    return Response.json({ ok: true, id: m.id, ts: m.ts, status: this.presence() });
  }

  async onContact({ sid, contact }) {
    const s = this.session(sid);
    if (!s) return Response.json({ error: "unknown_session" }, { status: 404 });
    if (!this.hit(`sid:${sid}:contact`, 5, 86400e3)) return Response.json({ error: "rate_limited" }, { status: 429 });
    this.sql.exec(`UPDATE sessions SET contact = ? WHERE sid = ?`, contact, sid);
    this.addMessage(sid, "s", `Contact left: ${contact}`);
    this.deliver(sid, `📇 <b>Contact left:</b> ${esc(contact)}`);
    return Response.json({ ok: true });
  }

  // Sends a message into the visitor's topic, creating the topic on first use.
  // Without a bound group it falls back to the owner's DMs with a #tag that replies can use.
  async toOwner(s, html) {
    const group = this.get("group");
    if (group) {
      let topic = s.topic;
      if (!topic) {
        const r = await tg(this.env, "createForumTopic", { chat_id: group, name: s.label.slice(0, 128), icon_color: 0x6fb9f0 });
        topic = r.ok ? r.result.message_thread_id : null;
        if (topic) this.sql.exec(`UPDATE sessions SET topic = ? WHERE sid = ?`, topic, s.sid);
      }
      if (topic) {
        const r = await tg(this.env, "sendMessage", { chat_id: group, message_thread_id: topic, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
        if (r.ok) return true;
        // topic was deleted in Telegram: forget it and open a fresh one
        if (/thread not found|TOPIC_DELETED|TOPIC_CLOSED/i.test(r.description || "")) {
          this.sql.exec(`UPDATE sessions SET topic = NULL WHERE sid = ?`, s.sid);
          return this.toOwner({ ...s, topic: null }, html);
        }
      }
    }
    const owner = this.get("owner") || this.env.OWNER_ID;
    if (!owner) return true; // nowhere to deliver: the message is still stored
    return (await tg(this.env, "sendMessage", { chat_id: owner, text: `${html}\n\n<i>${esc(s.label)}</i> #s${s.sid}`, parse_mode: "HTML" })).ok;
  }

  // ---------- Telegram updates ----------

  async onTelegram(u) {
    if (u.callback_query) return this.onButton(u.callback_query);
    const m = u.message;
    if (!m || !m.from || m.from.is_bot) return;

    const text = m.text || "";
    const owner = String(this.get("owner") || this.env.OWNER_ID || "");
    const fromOwner = owner && String(m.from.id) === owner;
    const chat = m.chat.id;
    const cmd = (text.match(/^\/([a-z]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i) || []).slice(1);

    // claim this group as the inbox: /bind <SETUP_KEY>
    if (cmd[0] === "bind") {
      if (!this.env.SETUP_KEY || (cmd[1] || "").trim() !== this.env.SETUP_KEY) return;
      if (m.chat.type !== "supergroup" || !m.chat.is_forum) {
        return tg(this.env, "sendMessage", { chat_id: chat, text: "Turn on Topics in the group settings first, then send /bind again." });
      }
      this.set("group", chat);
      this.set("owner", m.from.id);
      this.set("owner_seen", Date.now());
      await tg(this.env, "deleteMessage", { chat_id: chat, message_id: m.message_id }); // the key should not stay in the history
      return tg(this.env, "sendMessage", { chat_id: chat, parse_mode: "HTML", text: `✅ This group is now the inbox. Every visitor gets their own topic.\n\n${helpText}` });
    }

    if (fromOwner) {
      this.set("owner_seen", Date.now());
      if (cmd[0] === "online" || cmd[0] === "away") {
        this.set("status", cmd[0]);
        if (cmd[0] === "online") this.set("owner_seen", Date.now());
        for (const ws of this.ctx.getWebSockets()) {
          try {
            ws.send(JSON.stringify({ type: "status", status: this.presence() }));
          } catch {}
        }
        return tg(this.env, "sendMessage", { chat_id: chat, message_thread_id: m.message_thread_id, text: cmd[0] === "online" ? "🟢 Site chat shows you online." : "🌙 Site chat shows “replies within a few hours”." });
      }
      if (cmd[0] === "status") {
        const n = this.sql.exec(`SELECT COUNT(*) AS n FROM sessions`).toArray()[0].n;
        const live = this.ctx.getWebSockets().length;
        return tg(this.env, "sendMessage", { chat_id: chat, message_thread_id: m.message_thread_id, parse_mode: "HTML", text: `Status: <b>${this.presence()}</b>\nChats so far: ${n}\nVisitors connected now: ${live}\nInbox group: ${this.get("group") ? "bound ✅" : "not bound (send /bind &lt;key&gt; in the group)"}` });
      }
      if (cmd[0] === "help") return tg(this.env, "sendMessage", { chat_id: chat, message_thread_id: m.message_thread_id, parse_mode: "HTML", text: helpText });

      // owner writes inside a visitor's topic in the inbox group
      const group = this.get("group");
      if (group && String(chat) === String(group) && m.is_topic_message && m.message_thread_id && !cmd[0]) {
        const s = this.sessionBy("topic", m.message_thread_id);
        if (s) return this.ownerReply(s, m);
      }
      // fallback: owner replies in DMs to a tagged message
      if (m.chat.type === "private") {
        const tag = m.reply_to_message?.text || "";
        const sid = (tag.match(/#s([a-zA-Z0-9-]{16,64})/) || [])[1];
        const uid = (tag.match(/#id(\d+)/) || [])[1];
        if (sid && this.session(sid)) return this.ownerReply(this.session(sid), m);
        if (uid) return this.ownerReply(this.sessionBy("tg_user", Number(uid)) || { tg_user: Number(uid) }, m);
        if (!cmd[0]) return say(this.env, chat, "To answer someone, write in their topic in the inbox group (or reply to their message here).");
      }
    }

    // ignore everything else that happens in groups
    if (m.chat.type !== "private") return;
    return this.onBotChat(m, text, cmd);
  }

  // delivers the owner's answer to a site visitor (live or stored) or to a Telegram user
  async ownerReply(s, m) {
    const text = m.text || m.caption || "";
    if (s.tg_user) {
      const r = await tg(this.env, "copyMessage", { chat_id: s.tg_user, from_chat_id: m.chat.id, message_id: m.message_id });
      if (s.sid) this.addMessage(s.sid, "o", text || "[attachment]");
      return react(this.env, m, r.ok ? "👍" : "👎");
    }
    if (!text) {
      return tg(this.env, "sendMessage", { chat_id: m.chat.id, message_thread_id: m.message_thread_id, text: "Only text reaches the site chat for now." });
    }
    const msg = this.addMessage(s.sid, "o", text);
    const live = this.ctx.getWebSockets(s.sid).length > 0;
    this.broadcast({ type: "msg", ...msg }, s.sid);
    return react(this.env, m, live ? "👍" : "🕊");
  }

  // ---------- the bot's own DM conversation ----------

  async onButton(q) {
    const chat = q.message.chat.id;
    if (q.id !== "0") await tg(this.env, "answerCallbackQuery", { callback_query_id: q.id });
    if (q.data === "works") {
      const works = await loadWorks();
      const rows = works.map((w) => [{ text: kinds[w.kind] ? `${w.title} (${kinds[w.kind]})` : w.title, url: `${SITE}/work.html?id=${w.id}` }]);
      rows.push([{ text: "🌐 Open full portfolio", web_app: { url: SITE } }]);
      return say(this.env, chat, "Sure thing 👇 Tap any project to check it out.", { reply_markup: { inline_keyboard: rows } });
    }
    if (q.data === "services") {
      return say(this.env, chat, servicesText, { reply_markup: { inline_keyboard: [[{ text: "Show me your work", callback_data: "works" }], [{ text: "Let’s build something", callback_data: "contact" }]] } });
    }
    if (q.data === "process") {
      return say(this.env, chat, processText, { reply_markup: { inline_keyboard: [[{ text: "Let’s build something", callback_data: "contact" }]] } });
    }
    if (q.data === "contact") {
      return say(this.env, chat, "Love that! 🚀 Just type your idea right here — what you wanna build, rough deadline, budget if you have one. It lands straight in my DMs.");
    }
  }

  async onBotChat(m, text, cmd) {
    const chat = m.chat.id;
    const route = { work: "works", services: "services", process: "process", contact: "contact" }[cmd[0]];
    if (cmd[0] === "start") {
      await say(this.env, chat, "Hey! I’m xolchade 👋");
      await say(this.env, chat, "I wire Telegram, APIs and AI into products that actually work.");
      return say(this.env, chat, "What do you wanna see?", { reply_markup: mainKeyboard });
    }
    if (route) return this.onButton({ id: "0", data: route, message: m });
    if (cmd[0] === "myid") return say(this.env, chat, `Your Telegram id: <code>${m.from.id}</code>`);

    // anyone else's message = a lead → their own topic in the inbox
    const owner = this.get("owner") || this.env.OWNER_ID;
    if (!owner && !this.get("group")) return say(this.env, chat, "Thanks! I’ll get back to you soon 🙌");

    const sid = `tg-${m.from.id}`.padEnd(16, "-");
    let s = this.session(sid);
    if (!s) {
      const who = m.from.username ? `@${m.from.username}` : `${m.from.first_name || ""} ${m.from.last_name || ""}`.trim() || "Telegram user";
      this.sql.exec(`INSERT INTO sessions (sid, tg_user, label, created, last) VALUES (?, ?, ?, ?, ?)`, sid, m.from.id, `💬 ${who}`, Date.now(), Date.now());
      s = this.session(sid);
    }
    const body = text || m.caption || "[attachment]";
    this.addMessage(sid, "v", body);
    if (this.get("group")) {
      await this.toOwner(s, `${s.topic ? "" : `💬 <b>New Telegram chat</b> #id${m.from.id}\nReply in this topic: it goes to their DMs.\n\n`}${esc(body)}`);
      if (!text && s.topic) {
        const t = this.session(sid).topic;
        await tg(this.env, "copyMessage", { chat_id: this.get("group"), message_thread_id: t, from_chat_id: chat, message_id: m.message_id });
      }
    } else {
      await tg(this.env, "sendMessage", { chat_id: owner, parse_mode: "HTML", text: `📩 <b>New message</b> from ${esc(s.label)} #id${m.from.id}\n\n${esc(body)}` });
      if (!text) await tg(this.env, "copyMessage", { chat_id: owner, from_chat_id: chat, message_id: m.message_id });
    }
    return say(this.env, chat, "Got it, thanks! 🙌 I’ll get back to you right here, usually within a day.");
  }
}

const react = (env, m, emoji) => tg(env, "setMessageReaction", { chat_id: m.chat.id, message_id: m.message_id, reaction: [{ type: "emoji", emoji }] });

// Bot "types" like on the site
async function say(env, chat, text, extra = {}) {
  await tg(env, "sendChatAction", { chat_id: chat, action: "typing" });
  await sleep(Math.min(400 + text.length * 12, 1300));
  return tg(env, "sendMessage", { chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...extra });
}

// Projects are read from the site's works.js, so you edit them in one place
async function loadWorks() {
  try {
    const src = await (await fetch(`${SITE}/works.js`, { cf: { cacheTtl: 300 } })).text();
    const list = [];
    for (const m of src.matchAll(/\{([^{}]*\bid:\s*"[^"]+"[^{}]*)\}/g)) {
      const get = (k) => (m[1].match(new RegExp(`\\b${k}:\\s*"([^"]*)"`)) || [])[1];
      if (get("id") && get("title")) list.push({ id: get("id"), kind: get("kind"), title: get("title"), year: get("year") });
    }
    return list;
  } catch {
    return [];
  }
}

// Webhook, commands, menu button (the Mini App) and profile texts
async function setup(env, origin) {
  return {
    webhook: await tg(env, "setWebhook", { url: origin, secret_token: secret(env), allowed_updates: ["message", "callback_query"], drop_pending_updates: true }),
    commands: await tg(env, "setMyCommands", {
      commands: [
        { command: "start", description: "Say hi 👋" },
        { command: "work", description: "Show my projects" },
        { command: "services", description: "What I can build" },
        { command: "process", description: "How I work" },
        { command: "contact", description: "Pitch me your idea" },
      ],
    }),
    menu: await tg(env, "setChatMenuButton", { menu_button: { type: "web_app", text: "Portfolio", web_app: { url: SITE } } }),
    description: await tg(env, "setMyDescription", { description: "Hey! I wire Telegram, APIs and AI into products that work: Mini Apps, bots, integrations. Tap Start to see my work or pitch me your idea 🚀" }),
    short: await tg(env, "setMyShortDescription", { short_description: "Telegram Mini Apps, bots, API & AI integrations. Portfolio + DM me your idea." }),
  };
}
