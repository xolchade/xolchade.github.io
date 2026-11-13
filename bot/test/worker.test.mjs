// Tests for the bot + live chat. No dependencies: `node --test bot/test`
// Cloudflare pieces (Durable Object storage, WebSockets, Telegram, Turnstile) are replaced with small fakes.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

// ---------- fakes ----------

// Response with status 101 is legal in Workers but not in Node
const NodeResponse = globalThis.Response;
globalThis.Response = class extends NodeResponse {
  constructor(body, init = {}) {
    if (init.status === 101) {
      super(null, { status: 200 });
      this.upgraded = init.webSocket;
    } else super(body, init);
  }
  static json(data, init) {
    return NodeResponse.json(data, init);
  }
};

class FakeSocket {
  constructor() {
    this.inbox = [];
    this.peer = null;
  }
  send(m) {
    this.peer.inbox.push(m);
  }
  close() {}
}
globalThis.WebSocketPair = function () {
  const a = new FakeSocket(), b = new FakeSocket();
  a.peer = b;
  b.peer = a;
  return { 0: a, 1: b };
};

function fakeSql() {
  const db = new DatabaseSync(":memory:");
  return {
    exec(q, ...params) {
      const st = db.prepare(q);
      const rows = /^\s*select/i.test(q) ? st.all(...params) : (st.run(...params), []);
      return { toArray: () => rows.map((r) => ({ ...r })) };
    },
  };
}

function fakeCtx() {
  const sockets = [];
  return {
    storage: { sql: fakeSql() },
    acceptWebSocket(ws, tags) {
      sockets.push({ ws, tags });
    },
    getWebSockets(tag) {
      return sockets.filter((s) => !tag || s.tags.includes(tag)).map((s) => s.ws);
    },
    drop(ws) {
      sockets.splice(sockets.findIndex((s) => s.ws === ws), 1);
    },
  };
}

let calls, topicSeq, failNextThread, tgDelay = 0;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes("api.telegram.org")) {
    const method = url.split("/").pop();
    const body = JSON.parse(init.body);
    if (tgDelay) await new Promise((r) => setTimeout(r, tgDelay));
    calls.push({ method, body });
    if (method === "createForumTopic") return NodeResponse.json({ ok: true, result: { message_thread_id: ++topicSeq } });
    if (method === "sendMessage" && failNextThread && body.message_thread_id === failNextThread) {
      failNextThread = null;
      return NodeResponse.json({ ok: false, description: "Bad Request: message thread not found" });
    }
    return NodeResponse.json({ ok: true, result: { message_id: 1 } });
  }
  if (url.includes("turnstile")) return NodeResponse.json({ success: init.body.get("response") === "good" });
  if (url.endsWith("/works.js")) return new NodeResponse('export const works = [{ id: "a1", kind: "bot", title: "Lead bot", year: "2026" }];');
  throw new Error("unexpected fetch " + url);
};

const { default: worker, Hub } = await import("../worker.js");

let env, ctx, hub;
const SITE = "https://xolchade.dev";
const KEY = "setup-key-123";
const SID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const OWNER = 111, GROUP = -1001, VISITOR_TG = 222;

beforeEach(() => {
  calls = [];
  topicSeq = 100;
  failNextThread = null;
  tgDelay = 0;
  ctx = fakeCtx();
  env = { BOT_TOKEN: "T", SETUP_KEY: KEY, TURNSTILE_SECRET: "ts", ALLOWED_ORIGINS: SITE };
  hub = new Hub(ctx, env);
  env.HUB = { idFromName: () => "hub", get: () => ({ fetch: (i, init) => hub.fetch(i instanceof Request ? i : new Request(i, init)) }) };
});

const waits = [];
const runCtx = { waitUntil: (p) => waits.push(p) };
async function call(path, { method = "GET", body, origin = SITE, headers = {} } = {}) {
  const req = new Request(`https://bot.example${path}`, {
    method,
    headers: { Origin: origin, "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await worker.fetch(req, env, runCtx);
  await Promise.all(waits.splice(0));
  await hub.settled();
  return res;
}
const tgUpdate = (update) => call("/", { method: "POST", body: update, headers: { "X-Telegram-Bot-Api-Secret-Token": KEY } });
const groupMsg = (text, extra = {}) => tgUpdate({ message: { message_id: 50, from: { id: OWNER }, chat: { id: GROUP, type: "supergroup", is_forum: true }, text, ...extra } });
const bind = () => groupMsg(`/bind ${KEY}`);
const send = (text, extra = {}) => call("/api/send", { method: "POST", body: { sid: SID, text, turnstile: "good", ...extra } });
const sent = (method) => calls.filter((c) => c.method === method);

// ---------- tests ----------

test("CORS: the site and localhost pass, other origins are refused", async () => {
  assert.equal((await call("/api/status", { method: "OPTIONS" })).status, 204);
  assert.equal((await call("/api/status", { method: "OPTIONS", origin: "http://localhost:8080" })).status, 204);
  assert.equal((await call("/api/status", { method: "OPTIONS", origin: "https://evil.example" })).status, 403);
  const r = await call("/api/status");
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), SITE);
});

test("webhook with a wrong secret is refused", async () => {
  const r = await call("/", { method: "POST", body: {}, headers: { "X-Telegram-Bot-Api-Secret-Token": "nope" } });
  assert.equal(r.status, 403);
});

test("/bind: wrong key ignored, group without topics warned, right key binds and deletes the key", async () => {
  await groupMsg("/bind wrong");
  assert.equal(hub.get("group"), null);
  await tgUpdate({ message: { message_id: 5, from: { id: OWNER }, chat: { id: -5, type: "group" }, text: `/bind ${KEY}` } });
  assert.equal(hub.get("group"), null);
  assert.match(sent("sendMessage")[0].body.text, /Topics/);
  await bind();
  assert.equal(hub.get("group"), String(GROUP));
  assert.equal(hub.get("owner"), String(OWNER));
  assert.equal(sent("deleteMessage").length, 1);
});

test("first message needs Turnstile, then opens a topic with an intro card", async () => {
  await bind();
  calls = [];
  const bad = await call("/api/send", { method: "POST", body: { sid: SID, text: "hi", turnstile: "bad" } });
  assert.equal(bad.status, 403);
  assert.equal((await bad.json()).error, "captcha");

  const ok = await call("/api/send", { method: "POST", body: { sid: SID, text: "Need a <b>bot</b>", turnstile: "good", page: "/" }, headers: { "CF-Connecting-IP": "1.2.3.4" } });
  assert.equal(ok.status, 200);
  assert.equal(sent("createForumTopic").length, 1);
  const msg = sent("sendMessage")[0].body;
  assert.equal(msg.message_thread_id, 101);
  assert.match(msg.text, /New chat from xolchade\.dev/);
  assert.match(msg.text, /Need a &lt;b&gt;bot&lt;\/b&gt;/, "visitor text is escaped");

  // second message: no captcha needed, same topic, no new topic
  const again = await call("/api/send", { method: "POST", body: { sid: SID, text: "second" } });
  assert.equal(again.status, 200);
  assert.equal(sent("createForumTopic").length, 1);
  assert.equal(sent("sendMessage")[1].body.message_thread_id, 101);
  assert.equal(sent("sendMessage")[1].body.text, "second");
});

test("validation: bad sid, empty and too long messages", async () => {
  assert.equal((await call("/api/send", { method: "POST", body: { sid: "x", text: "hi" } })).status, 400);
  assert.equal((await call("/api/send", { method: "POST", body: { sid: SID, text: "   " } })).status, 400);
  assert.equal((await send("a".repeat(1001))).status, 400);
  assert.equal((await call("/api/state?sid=../etc")).status, 400);
});

test("a retried message (same client id) is stored once", async () => {
  await bind();
  await send("hello", { cid: "c1" });
  await send("hello", { cid: "c1" });
  const st = await (await call(`/api/state?sid=${SID}`)).json();
  assert.equal(st.messages.filter((m) => m.who === "v").length, 1);
});

test("rate limit: 7th message within a minute is refused", async () => {
  await bind();
  for (let i = 0; i < 6; i++) assert.equal((await send(`m${i}`)).status, 200);
  assert.equal((await send("m7")).status, 429);
});

test("owner reply reaches a connected visitor live (👍) and is kept for an offline one (🕊)", async () => {
  await bind();
  await send("hello");
  const ws = await call(`/api/ws?sid=${SID}`, { headers: { Upgrade: "websocket" } });
  const client = ws.upgraded;
  assert.ok(client, "upgraded to a WebSocket");
  assert.deepEqual(JSON.parse(client.inbox[0]), { type: "status", status: "online" });

  await groupMsg("Sure, let's talk!", { message_thread_id: 101, is_topic_message: true, message_id: 77 });
  const live = JSON.parse(client.inbox.at(-1));
  assert.equal(live.type, "msg");
  assert.equal(live.who, "o");
  assert.equal(live.text, "Sure, let's talk!");
  assert.equal(sent("setMessageReaction").at(-1).body.reaction[0].emoji, "👍");

  ctx.drop(ctx.getWebSockets(SID)[0]); // visitor closed the tab
  await groupMsg("Still there?", { message_thread_id: 101, is_topic_message: true, message_id: 78 });
  assert.equal(sent("setMessageReaction").at(-1).body.reaction[0].emoji, "🕊");

  const st = await (await call(`/api/state?sid=${SID}`)).json();
  assert.deepEqual(st.messages.map((m) => [m.who, m.text]), [["v", "hello"], ["o", "Sure, let's talk!"], ["o", "Still there?"]]);
});

test("unknown sessions cannot open a socket or read state", async () => {
  const ws = await call(`/api/ws?sid=${SID}`, { headers: { Upgrade: "websocket" } });
  assert.equal(ws.status, 404);
  const st = await (await call(`/api/state?sid=${SID}`)).json();
  assert.equal(st.known, false);
  assert.deepEqual(st.messages, []);
});

test("/away and /online change what visitors see, live", async () => {
  await bind();
  await send("hello");
  const client = (await call(`/api/ws?sid=${SID}`, { headers: { Upgrade: "websocket" } })).upgraded;
  await groupMsg("/away");
  assert.equal((await (await call("/api/status")).json()).status, "away");
  assert.deepEqual(JSON.parse(client.inbox.at(-1)), { type: "status", status: "away" });
  await groupMsg("/online");
  assert.equal((await (await call("/api/status")).json()).status, "online");
});

test("owner is shown away after 3 hours of silence", async () => {
  await bind();
  hub.set("owner_seen", Date.now() - 4 * 3600e3);
  assert.equal((await (await call("/api/status")).json()).status, "away");
});

test("contact goes to the visitor's topic", async () => {
  await bind();
  await send("hello");
  const r = await call("/api/contact", { method: "POST", body: { sid: SID, contact: "me@mail.com" } });
  assert.equal(r.status, 200);
  assert.match(sent("sendMessage").at(-1).body.text, /Contact left:<\/b> me@mail\.com/);
  assert.equal((await (await call(`/api/state?sid=${SID}`)).json()).contact, true);
});

test("a deleted topic is recreated instead of losing the message", async () => {
  await bind();
  await send("hello");
  failNextThread = 101;
  await send("after delete");
  assert.equal(sent("createForumTopic").length, 2);
  assert.equal(sent("sendMessage").at(-1).body.message_thread_id, 102);
});

test("Telegram DM leads get their own topic and the owner answers inside it", async () => {
  await bind();
  calls = [];
  const dm = (text) => tgUpdate({ message: { message_id: 9, from: { id: VISITOR_TG, username: "client" }, chat: { id: VISITOR_TG, type: "private" }, text } });
  await dm("I need a Mini App");
  const topic = sent("createForumTopic")[0].body;
  assert.match(topic.name, /@client/);
  await groupMsg("Hi! Tell me more", { message_thread_id: 101, is_topic_message: true });
  const copy = sent("copyMessage").at(-1).body;
  assert.equal(copy.chat_id, VISITOR_TG);
});

test("without a bound group, leads go to the owner's DMs and replies to them still work", async () => {
  env.OWNER_ID = String(OWNER);
  await send("hello");
  const dmMsg = sent("sendMessage")[0].body;
  assert.equal(dmMsg.chat_id, String(OWNER));
  assert.match(dmMsg.text, new RegExp(`#s${SID}`));
  await tgUpdate({ message: { message_id: 60, from: { id: OWNER }, chat: { id: OWNER, type: "private" }, text: "Answer", reply_to_message: { text: dmMsg.text } } });
  const st = await (await call(`/api/state?sid=${SID}`)).json();
  assert.equal(st.messages.at(-1).text, "Answer");
});

test("the bot's DM menu still works and reads projects from works.js", async () => {
  await tgUpdate({ callback_query: { id: "q1", data: "works", message: { chat: { id: VISITOR_TG } } } });
  const msg = sent("sendMessage").at(-1).body;
  assert.equal(msg.reply_markup.inline_keyboard[0][0].text, "Lead bot (Bot)");
});

test("the visitor gets an answer before Telegram delivery finishes", async () => {
  await bind();
  tgDelay = 400; // slow Telegram
  const req = new Request("https://bot.example/api/send", { method: "POST", headers: { Origin: SITE, "content-type": "application/json" }, body: JSON.stringify({ sid: SID, text: "fast?", turnstile: "good" }) });
  const t0 = Date.now();
  const res = await worker.fetch(req, env, runCtx);
  const took = Date.now() - t0;
  assert.equal(res.status, 200);
  assert.ok(took < 300, `answered in ${took} ms`);
  await hub.settled();
  assert.equal(sent("createForumTopic").length, 1);
  assert.equal(sent("sendMessage").at(-1).body.message_thread_id, 101);
});

test("a burst of messages from a new visitor opens exactly one topic, in order", async () => {
  await bind();
  tgDelay = 50;
  await Promise.all(["one", "two", "three"].map((text, i) => send(text, { cid: `b${i}` })));
  await hub.settled();
  assert.equal(sent("createForumTopic").length, 1);
  const texts = sent("sendMessage").filter((c) => c.body.message_thread_id === 101).map((c) => c.body.text.split("\n\n").at(-1));
  assert.deepEqual(texts, ["one", "two", "three"]);
});

test("a failed Telegram delivery is retried once", async () => {
  await bind();
  await send("hello");
  calls = [];
  failNextThread = 101; // one failure on the existing topic → recreated topic
  await send("again");
  assert.ok(sent("sendMessage").some((c) => c.body.text === "again"));
});
