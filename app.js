// Home page: hero, chat demo, marquee, work grid, pinned process, page wire, footer wordmark
import { works, categories, filters, stack, stackAI } from "./works.js";
import { cover } from "./cover.js";
import { $, $$, clamp, reduce, fine, onFrame, request, scrollToEl, openEgg } from "./ui.js";
import { initGL } from "./gl.js";

const root = document.documentElement;
const intro = root.classList.contains("skip-intro") ? 100 : 950;
const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
const mobile = matchMedia("(max-width: 899px)");

// ---------- hero headline: wrap words for the masked reveal ----------
(function split(el) {
  let i = 0;
  const walk = (node) => [...node.childNodes].forEach((n) => {
    if (n.nodeType !== 3) return walk(n);
    const frag = document.createDocumentFragment();
    n.textContent.split(/(\s+)/).forEach((tok) => {
      if (!tok) return;
      if (/^\s+$/.test(tok)) return frag.append(" ");
      const w = document.createElement("span"), s = document.createElement("span");
      w.className = "w"; s.style.setProperty("--i", i++); s.textContent = tok;
      w.append(s); frag.append(w);
    });
    n.replaceWith(frag);
  });
  walk(el);
})($(".split"));

// ---------- WebGL wires ----------
const hero = $(".hero"), canvas = $("#gl"), chat = $("#chat"), ports = $(".ports");
const lowEnd = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
const glw = initGL(canvas, {
  still: reduce || lowEnd,
  isVertical: () => mobile.matches,
  target: () => {
    const c = canvas.getBoundingClientRect(), p = ports.getBoundingClientRect();
    return { x: p.left + p.width / 2 - c.left, y: p.top + p.height / 2 - c.top, gap: 18 };
  },
});
if (glw) {
  glw.start(intro / 1000 + 0.2);
  if (fine) {
    hero.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(); glw.pointer(e.clientX - r.left, e.clientY - r.top); }, { passive: true });
    hero.addEventListener("pointerleave", () => glw.pointer(-9999, -9999));
  }
  onFrame((sy, v) => glw.scroll(v));
  document.fonts?.ready.then(() => glw.refresh());
}

// ---------- chat demo (texts mirrored in bot/worker.js) ----------
const thread = $("#thread"), status = $("#status"), keyboard = $("#keyboard");
const replies = {
  works: { text: "Sure thing, scrolling you down 👇", go: "#work" },
  services: { text: "Mini Apps & bots, API integrations, AI features and the UI on top. Full menu below 👇", go: "#services" },
  process: { text: "TL;DR: we nail the brief, I prototype, I build, we ship. Details below.", go: "#process" },
  contact: { text: "Love that! Hit me up on Upwork or Telegram 🚀", go: "#contact" },
  price: { text: "Depends on the scope. Send me the idea and I’ll come back with a clear quote, no surprise invoices." },
  hi: { text: "Hey hey 👋 Ask me about work, services, process or price." },
  fallback: { text: "I’m a scripted demo, so that one’s above my pay grade 😅 The real me replies on Telegram.", tg: true },
};
const intents = [
  [/\b(price|cost|rate|budget|how much|\$)/i, "price"],
  [/\b(hire|contact|talk|call|telegram|upwork|email|start|let'?s)/i, "contact"],
  [/\b(process|how (do|does) (you|it) work|timeline|steps|deadline)/i, "process"],
  [/\b(work|portfolio|project|case|example)/i, "works"],
  [/\b(service|build|make|bot|mini ?app|api|ai|design|integrat|automat|can you|do you)/i, "services"],
  [/^(hi|hey|hello|yo|sup|привет)\b/i, "hi"],
];

function bubble(text, who = "bot") {
  const li = document.createElement("li");
  li.className = `msg ${who}`;
  li.textContent = text;
  thread.append(li);
  thread.scrollTop = thread.scrollHeight;
  return li;
}
async function botSay(text) {
  status.textContent = "typing…";
  const dots = document.createElement("li");
  dots.className = "msg bot typing";
  dots.innerHTML = "<i></i><i></i><i></i>";
  thread.append(dots);
  thread.scrollTop = thread.scrollHeight;
  await wait(Math.min(400 + text.length * 13, 1300));
  dots.remove();
  status.textContent = "online";
  return bubble(text);
}
let busy = true;
async function answer(key, said) {
  if (busy) return;
  busy = true;
  bubble(said, "me");
  const r = replies[key];
  const li = await botSay(r.text);
  if (r.tg) {
    const a = document.createElement("a");
    a.href = $('[data-link="telegram"]').href; a.target = "_blank"; a.rel = "noopener"; a.textContent = " Open Telegram";
    li.append(a);
  }
  busy = false;
  if (r.go) { await wait(350); scrollToEl($(r.go)); }
}
(async () => {
  await wait(intro + 900);
  await botSay("Hey! I’m xolchade 👋");
  await botSay("I wire Telegram, APIs and AI into products that actually work.");
  await botSay("What do you wanna see?");
  keyboard.hidden = false;
  thread.scrollTop = thread.scrollHeight;
  busy = false;
})();
keyboard.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) answer(b.dataset.go, b.textContent);
});
$("#ask").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("#q"), text = q.value.trim();
  if (!text || busy) return;
  q.value = "";
  answer((intents.find(([re]) => re.test(text)) || [0, "fallback"])[1], text);
});

// ---------- reveals ----------
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  const el = e.target;
  el.classList.add("in");
  io.unobserve(el);
  if (el.matches(".card")) setTimeout(() => el.classList.remove("reveal", "in"), 1300);
}), { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
const watch = (els) => els.forEach((el) => io.observe(el));
$$(".svc").forEach((el, i) => el.style.setProperty("--d", i * 90));
watch($$(".reveal, .reveal-mask"));

// ---------- stack marquee ----------
const colors = ["tg", "api", "ai", "ui", "d3"];
function marquee(el, items) {
  const html = items.map((t, i) => `<span class="it" style="--c:var(--${colors[i % colors.length]})">${t}</span>`).join("");
  el.innerHTML = `<div class="run">${html}</div><div class="run" aria-hidden="true">${html}</div><div class="run" aria-hidden="true">${html}</div>`;
}
marquee($("#mq1"), stack);
marquee($("#mq2"), stackAI);
const stackEl = $(".stack");
if (!reduce) onFrame((sy, v) => stackEl.style.setProperty("--skew", `${clamp(-v * 0.12, -8, 8)}deg`));

// ---------- work grid ----------
const grid = $("#grid"), filtersEl = $("#filters");
// Row patterns of the 12-column bento: [colSpan, rowSpan]
const rows = [[[7, 2], [5, 1], [5, 1]], [[4, 1], [4, 1], [4, 1]], [[5, 1], [7, 2], [5, 1]], [[6, 1], [6, 1]]];
const tails = { "0-1": [[12, 2]], "0-2": [[7, 2], [5, 2]], "1-1": [[12, 1]], "1-2": [[6, 1], [6, 1]], "2-1": [[12, 1]], "2-2": [[5, 2], [7, 2]], "3-1": [[12, 1]] };
function spans(n) {
  const out = [];
  for (let r = 0; out.length < n; r = (r + 1) % rows.length) {
    const left = n - out.length;
    out.push(...(left < rows[r].length ? tails[`${r}-${left}`] : rows[r]));
  }
  return out;
}
function render(key, animate) {
  const f = filters.find((x) => x.key === key);
  const list = works.filter((w) => !f.kinds.length || f.kinds.includes(w.kind));
  const sp = spans(list.length);
  grid.innerHTML = list.map((w, i) => `
    <a class="card${animate ? " reveal" : ""}" href="work.html?id=${w.id}" data-cursor="Open" style="--h:${w.hue};--cs:${sp[i][0]};--rs:${sp[i][1]};--d:${(i % 3) * 60};view-transition-name:card-${w.id}">
      <span class="cover" style="view-transition-name:cover-${w.id}">${cover(w)}</span>
      <span class="cap"><span><b>${w.title}</b><small>${categories[w.kind]}</small></span><span class="yr">${w.year}</span></span>
    </a>`).join("");
  if (animate) watch($$(".card", grid));
  buildWire();
}
filtersEl.innerHTML = filters.map((f) => `<button class="chip" data-key="${f.key}" aria-pressed="${f.key === "all"}">${f.color ? `<i style="--c:var(--${f.color})"></i>` : ""}${f.label}</button>`).join("");
filtersEl.addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (!b || b.getAttribute("aria-pressed") === "true") return;
  $$(".chip", filtersEl).forEach((x) => x.setAttribute("aria-pressed", x === b));
  const go = () => render(b.dataset.key, false);
  document.startViewTransition && !reduce ? document.startViewTransition(go) : go();
});

// 3D tilt + spotlight + parallax on cards (mouse only)
if (fine && !reduce) {
  grid.addEventListener("pointermove", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    const k = Math.min(1, 520 / r.width);
    card.classList.add("tilt");
    card.style.setProperty("--ry", `${(x - 0.5) * 14 * k}deg`);
    card.style.setProperty("--rx", `${(0.5 - y) * 12 * k}deg`);
    card.style.setProperty("--mx", `${x * 100}%`);
    card.style.setProperty("--my", `${y * 100}%`);
    card.style.setProperty("--px", `${(x - 0.5) * -20}px`);
    card.style.setProperty("--py", `${(y - 0.5) * -16}px`);
  }, { passive: true });
  grid.addEventListener("pointerout", (e) => {
    const card = e.target.closest(".card");
    if (!card || card.contains(e.relatedTarget)) return;
    card.classList.remove("tilt");
    ["--rx", "--ry", "--px", "--py"].forEach((p) => card.style.removeProperty(p));
  }, { passive: true });
}
// The cursor badge must not leak into the page-transition snapshot
addEventListener("pageswap", () => $(".cursor")?.classList.remove("on"));

// ---------- pinned "How I work" ----------
const proc = $("#process"), track = $("#track"), rail = $(".rail"), steps = $$(".step");
let pinned = false, maxX = 0, procTop = 0;
function layoutProcess() {
  pinned = !mobile.matches && !reduce;
  proc.classList.toggle("pinned", pinned);
  if (!pinned) { proc.style.height = ""; track.style.transform = ""; return; }
  proc.style.height = "";
  maxX = Math.max(0, track.scrollWidth - innerWidth);
  proc.style.height = `${innerHeight + maxX}px`;
  procTop = proc.getBoundingClientRect().top + scrollY;
}
onFrame((sy) => {
  if (!pinned) return;
  const p = maxX ? clamp((sy - procTop) / maxX, 0, 1) : 0;
  track.style.transform = `translate3d(${-p * maxX}px,0,0)`;
  rail.style.setProperty("--p", p);
  steps.forEach((s, i) => s.classList.toggle("on", p >= i / steps.length - 0.02));
});

// ---------- the wire running down the page ----------
const main = $("#main"), wire = $("#wire");
let head = { y0: 0, y1: 0, sx: 0, gx: 0, gaps: [], end: 0 }, nodes = [];
function buildWire() {
  const m = main.getBoundingClientRect();
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left - m.left, t: r.top - m.top, r: r.right - m.left, b: r.bottom - m.top, w: r.width, h: r.height }; };
  const lineY = (el) => { const b = box(el); return b.t + Math.min(b.h, parseFloat(getComputedStyle(el).fontSize) * 0.92) / 2; };
  const firstH = box($(".services h2"));
  const gx = Math.round(firstH.l * 0.45), r = Math.min(18, gx);
  const wrap = box($(".chat-wrap")), copy = box($(".hero-copy"));
  const sx = wrap.l + wrap.w / 2, y0 = wrap.b + 10;
  const y1 = Math.max(y0 + 34, copy.b + 34);
  const cta = $(".contact h2"), cy = lineY(cta), cl = box(cta).l;
  const p = box(proc);
  let d = `M${sx} ${y0}V${y1 - r}Q${sx} ${y1} ${sx - r} ${y1}H${gx + r}Q${gx} ${y1} ${gx} ${y1 + r}`;
  const gaps = [];
  if (pinned) { d += `V${p.t}M${gx} ${p.b}`; gaps.push([p.t, p.b]); }
  d += `V${cy - r}Q${gx} ${cy} ${gx + r} ${cy}H${cl - 14}`;
  nodes = $$("[data-node]").map((el) => ({ y: lineY(el), x: el === cta ? cl - 14 : gx, stub: el === cta ? 0 : box(el).l - 14 }));
  const stubs = nodes.filter((n) => n.stub).map((n) => `M${gx} ${n.y}H${n.stub}`).join("");
  const dots = nodes.map((n, i) => `<circle class="node" data-i="${i}" cx="${n.stub || n.x}" cy="${n.y}" r="4.5"/>`).join("");
  const body = `<path d="${d}${stubs}"/>${dots}`;
  wire.innerHTML = `<defs><clipPath id="wc"><rect id="wr" x="-20" y="0" width="99999" height="0"/></clipPath></defs>
    <g class="ghost">${body}</g><g clip-path="url(#wc)">${body}</g><circle class="head" id="wh" r="4"/>`;
  head = { y0, y1, sx, gx, gaps, end: cy };
  request();
}
onFrame((sy) => {
  const wr = $("#wr"), wh = $("#wh");
  if (!wr) return;
  const hy = reduce ? 1e6 : sy + innerHeight * 0.6;
  wr.setAttribute("height", Math.max(0, hy));
  const inGap = head.gaps.some(([a, b]) => hy > a && hy < b);
  const show = hy > head.y0 && hy < head.end && !inGap;
  wh.style.opacity = show ? 1 : 0;
  wh.setAttribute("cx", hy < head.y1 ? head.sx : head.gx);
  wh.setAttribute("cy", hy);
  $$("g[clip-path] .node", wire).forEach((n) => n.classList.toggle("on", hy >= nodes[n.dataset.i].y));
});

// ---------- footer wordmark: letters get heavier near the cursor ----------
const wm = $("#wordmark");
wm.innerHTML = [...wm.textContent].map((ch) => `<span>${ch}</span>`).join("");
if (fine && !reduce) {
  const letters = $$("span", wm);
  wm.addEventListener("pointermove", (e) => letters.forEach((l) => {
    const r = l.getBoundingClientRect(), dx = Math.abs(e.clientX - r.left - r.width / 2);
    l.style.setProperty("--wg", Math.round(800 - 600 * Math.max(0, 1 - dx / (r.width * 2.2))));
  }), { passive: true });
  wm.addEventListener("pointerleave", () => letters.forEach((l) => l.style.removeProperty("--wg")));
}
let taps = 0, tapT;
wm.addEventListener("click", () => { clearTimeout(tapT); tapT = setTimeout(() => (taps = 0), 1200); if (++taps >= 5) { taps = 0; openEgg(); } });

// ---------- layout ----------
function layout() { layoutProcess(); buildWire(); }
render("all", true);
layout();
let rt;
addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
mobile.addEventListener("change", layout);
document.fonts?.ready.then(layout);
addEventListener("load", layout);
