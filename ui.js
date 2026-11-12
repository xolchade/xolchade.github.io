// Shared UI: links, scroll frame loop, smooth scroll, cursor, magnetic buttons, easter-egg triggers
import { contacts } from "./works.js";

export const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Links come from works.js
$$("[data-link]").forEach((a) => {
  const k = a.dataset.link;
  a.href = k === "email" ? `mailto:${contacts.email}` : contacts[k];
  if (k !== "email") { a.target = "_blank"; a.rel = "noopener"; }
});
const y = $("#y");
if (y) y.textContent = new Date().getFullYear();

// One rAF per scroll/resize; subscribers get (scrollY, velocity)
const subs = [];
let queued = false, lastY = scrollY, idle;
function frame() {
  queued = false;
  const sy = scrollY, v = sy - lastY;
  lastY = sy;
  for (const f of subs) f(sy, v);
}
export function request() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
export function onFrame(fn) { subs.push(fn); request(); }
addEventListener("scroll", () => { request(); clearTimeout(idle); idle = setTimeout(request, 140); }, { passive: true });
addEventListener("resize", request);

const bar = $(".bar");
if (bar) onFrame((sy) => bar.classList.toggle("scrolled", sy > 24));

// Smooth wheel scroll (mouse only)
let target = scrollY, cur = scrollY, raf = 0;
const smooth = fine && !reduce;
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
function tick() {
  cur += (target - cur) * 0.12;
  if (Math.abs(target - cur) < 0.6) { cur = target; raf = 0; } else raf = requestAnimationFrame(tick);
  scrollTo(0, cur);
}
function canScroll(el, dy) {
  for (; el && el !== document.body; el = el.parentElement) {
    if (!el.matches?.("[data-native-scroll]")) continue;
    if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
  }
  return false;
}
if (smooth) {
  addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey || document.documentElement.classList.contains("lock")) return;
    if (canScroll(e.target, e.deltaY)) return;
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 36 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
    if (!raf) target = cur = scrollY;
    target = clamp(target + d, 0, maxScroll());
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: false });
  addEventListener("scroll", () => { if (!raf) target = cur = scrollY; }, { passive: true });
}
export function scrollToEl(el) {
  const top = clamp(el.getBoundingClientRect().top + scrollY - (el.matches(".process.pinned") ? 0 : 72), 0, maxScroll());
  if (smooth) { if (!raf) cur = scrollY; target = top; if (!raf) raf = requestAnimationFrame(tick); }
  else scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
}
addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.dataset.link) return;
  const el = a.getAttribute("href").length > 1 && $(a.getAttribute("href"));
  if (!el) return;
  e.preventDefault();
  scrollToEl(el);
  history.replaceState(null, "", a.getAttribute("href"));
});

// Cursor follower
if (fine && !reduce) {
  const c = document.createElement("div");
  c.className = "cursor";
  c.innerHTML = "<span></span>";
  document.body.append(c);
  document.documentElement.classList.add("has-cursor");
  const label = c.firstChild;
  let x = 0, yy = 0, cx = 0, cy = 0, run = 0, first = true;
  const loop = () => {
    cx += (x - cx) * 0.2; cy += (yy - cy) * 0.2;
    c.style.translate = `${cx}px ${cy}px`;
    run = Math.abs(x - cx) + Math.abs(yy - cy) > 0.2 ? requestAnimationFrame(loop) : 0;
  };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    x = e.clientX; yy = e.clientY;
    if (first) { cx = x; cy = yy; first = false; }
    c.classList.add("on");
    if (!run) run = requestAnimationFrame(loop);
  }, { passive: true });
  addEventListener("pointerover", (e) => {
    const t = e.target.closest?.("[data-cursor], a, button, input");
    const text = t?.dataset.cursor;
    c.classList.toggle("label", !!text);
    c.classList.toggle("link", !!t && !text);
    label.textContent = text || "";
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => c.classList.remove("on"));

  // Magnetic buttons
  $$(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.translate = `${(e.clientX - r.left - r.width / 2) * 0.25}px ${(e.clientY - r.top - r.height / 2) * 0.35}px`;
    });
    el.addEventListener("pointerleave", () => { el.style.translate = ""; });
  });
}

// Easter egg: ` key, typing "xolchade", or 5 taps on the footer wordmark
let typed = "";
export const openEgg = () => import("./egg.js").then((m) => m.open());
addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "`" || e.key === "~") { e.preventDefault(); return openEgg(); }
  if (e.key.length === 1) {
    typed = (typed + e.key.toLowerCase()).slice(-8);
    if (typed === "xolchade") { typed = ""; openEgg(); }
  }
});
console.log("%cpsst, dev. press ` or type xolchade", "font: 600 14px system-ui; color: #55A2FF");
