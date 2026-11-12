// xolchade bot — Telegram bot for Cloudflare Workers
// Env vars: BOT_TOKEN (secret), OWNER_ID (your Telegram id), SETUP_KEY (any password)

const SITE = "https://xolchade.dev";

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

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    // One-time setup: open https://<worker>/setup?key=SETUP_KEY in a browser
    if (url.pathname === "/setup") {
      if (url.searchParams.get("key") !== env.SETUP_KEY) return new Response("Wrong key", { status: 403 });
      return Response.json(await setup(env, url.origin));
    }

    if (req.method !== "POST") return new Response("xolchade bot is running ✅");
    if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret(env)) return new Response("Forbidden", { status: 403 });

    const update = await req.json();
    ctx.waitUntil(handle(update, env).catch((e) => console.log("error", e.stack)));
    return new Response("ok");
  },
};

// Telegram API call
async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

const secret = (env) => env.SETUP_KEY.replace(/[^A-Za-z0-9_-]/g, "") || "xolchade";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s = "") => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

async function handle(u, env) {
  const owner = String(env.OWNER_ID || "");

  // Button presses
  if (u.callback_query) {
    const q = u.callback_query;
    const chat = q.message.chat.id;
    if (q.id !== "0") await tg(env, "answerCallbackQuery", { callback_query_id: q.id });

    if (q.data === "works") {
      const works = await loadWorks();
      const rows = works.map((w) => [{ text: kinds[w.kind] ? `${w.title} (${kinds[w.kind]})` : w.title, url: `${SITE}/work.html?id=${w.id}` }]);
      rows.push([{ text: "🌐 Open full portfolio", web_app: { url: SITE } }]);
      return say(env, chat, "Sure thing 👇 Tap any project to check it out.", { reply_markup: { inline_keyboard: rows } });
    }
    if (q.data === "services") {
      return say(env, chat, servicesText, { reply_markup: { inline_keyboard: [[{ text: "Show me your work", callback_data: "works" }], [{ text: "Let’s build something", callback_data: "contact" }]] } });
    }
    if (q.data === "process") {
      return say(env, chat, processText, { reply_markup: { inline_keyboard: [[{ text: "Let’s build something", callback_data: "contact" }]] } });
    }
    if (q.data === "contact") {
      return say(env, chat, "Love that! 🚀 Just type your idea right here — what you wanna build, rough deadline, budget if you have one. It lands straight in my DMs.");
    }
    return;
  }

  const m = u.message;
  if (!m) return;
  const chat = m.chat.id;
  const text = m.text || "";

  if (text.startsWith("/start")) {
    await say(env, chat, "Hey! I’m xolchade 👋");
    await say(env, chat, "I wire Telegram, APIs and AI into products that actually work.");
    return say(env, chat, "What do you wanna see?", { reply_markup: mainKeyboard });
  }
  if (text.startsWith("/work")) return handle({ callback_query: { id: "0", data: "works", message: m } }, env);
  if (text.startsWith("/services")) return handle({ callback_query: { id: "0", data: "services", message: m } }, env);
  if (text.startsWith("/process")) return handle({ callback_query: { id: "0", data: "process", message: m } }, env);
  if (text.startsWith("/contact")) return handle({ callback_query: { id: "0", data: "contact", message: m } }, env);
  if (text.startsWith("/myid")) return say(env, chat, `Your Telegram id: <code>${m.from.id}</code>`);

  // Owner replies to a forwarded lead → send answer back to that person
  if (String(m.from.id) === owner) {
    const replied = m.reply_to_message?.text || "";
    const to = (replied.match(/#id(\d+)/) || [])[1];
    if (!to) return say(env, chat, "To answer a lead, <b>reply</b> to their message here (swipe it left).");
    await tg(env, "copyMessage", { chat_id: to, from_chat_id: chat, message_id: m.message_id });
    return tg(env, "setMessageReaction", { chat_id: chat, message_id: m.message_id, reaction: [{ type: "emoji", emoji: "👍" }] });
  }

  // Anyone else's message = a lead → forward to owner
  if (!owner) return say(env, chat, "Thanks! I’ll get back to you soon 🙌");
  const who = m.from.username ? `@${m.from.username}` : esc(`${m.from.first_name || ""} ${m.from.last_name || ""}`.trim());
  const body = text || m.caption || "[attachment]";
  await tg(env, "sendMessage", {
    chat_id: owner,
    parse_mode: "HTML",
    text: `📩 <b>New message</b> from ${who} #id${m.from.id}\n\n${esc(body)}`,
  });
  if (!text) await tg(env, "copyMessage", { chat_id: owner, from_chat_id: chat, message_id: m.message_id });
  return say(env, chat, "Got it, thanks! 🙌 I’ll get back to you right here, usually within a day.");
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
