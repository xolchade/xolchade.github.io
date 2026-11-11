// Theme toggle: light/dark with a circular reveal from the button
const root = document.documentElement;
const btn = document.getElementById("theme");
const dark = matchMedia("(prefers-color-scheme: dark)");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const current = () => root.dataset.theme || (dark.matches ? "dark" : "light");
const label = () => btn.setAttribute("aria-label", current() === "dark" ? "Switch to light theme" : "Switch to dark theme");
label();
dark.addEventListener("change", label);

btn.addEventListener("click", async () => {
  const next = current() === "dark" ? "light" : "dark";
  const apply = () => { root.dataset.theme = next; label(); };
  try { localStorage.setItem("theme", next); } catch {}

  if (!document.startViewTransition || reduce) return apply();
  const r = btn.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add("theming");
  const t = document.startViewTransition(apply);
  await t.ready;
  root.animate(
    { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
    { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)", pseudoElement: "::view-transition-new(root)" }
  );
  await t.finished;
  root.classList.remove("theming");
});
