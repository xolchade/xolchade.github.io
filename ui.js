// Shared UI: links, scroll frame loop, cursor badge, magnetic buttons, easter-egg triggers
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

export function scrollToEl(el) {
  const top = el.getBoundingClientRect().top + scrollY - (el.matches(".process") ? 0 : 72);
  scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
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

if (fine && !reduce) {
  // "Open" badge that follows the mouse over project cards
  const c = document.createElement("div");
  c.className = "cursor";
  c.innerHTML = "<span></span>";
  document.body.append(c);
  document.documentElement.classList.add("has-cursor");
  const label = c.firstChild;
  let x = 0, yy = 0, cx = 0, cy = 0, run = 0, on = false;
  const loop = () => {
    cx += (x - cx) * 0.35; cy += (yy - cy) * 0.35;
    c.style.transform = `translate3d(${cx}px,${cy}px,0)`;
    run = on && Math.abs(x - cx) + Math.abs(yy - cy) > 0.2 ? requestAnimationFrame(loop) : 0;
  };
  addEventListener("pointermove", (e) => {
    if (!on || e.pointerType !== "mouse") return;
    x = e.clientX; yy = e.clientY;
    if (!run) run = requestAnimationFrame(loop);
  }, { passive: true });
  addEventListener("pointerover", (e) => {
    const text = e.target.closest?.("[data-cursor]")?.dataset.cursor;
    if (text && !on) { cx = x = e.clientX; cy = yy = e.clientY; c.style.transform = `translate3d(${cx}px,${cy}px,0)`; }
    on = !!text;
    if (text) label.textContent = text;
    c.classList.toggle("on", on);
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { on = false; c.classList.remove("on"); });

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
console.log("%cpsst, dev. press ` or type xolchade", "font: 600 14px system-ui; color: #2AABEE");
