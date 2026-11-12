// Theme toggle: light by default, dark on request
const root = document.documentElement;
const btn = document.getElementById("theme");
const meta = document.querySelector('meta[name="theme-color"]');
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const current = () => root.dataset.theme || "light";
const sync = () => {
  btn.setAttribute("aria-label", current() === "dark" ? "Switch to light theme" : "Switch to dark theme");
  if (meta) meta.content = current() === "dark" ? "#0E0E0E" : "#F4F1EA";
};
sync();

btn.addEventListener("click", async () => {
  const next = current() === "dark" ? "light" : "dark";
  const apply = () => { root.dataset.theme = next; sync(); };
  try { localStorage.setItem("theme", next); } catch {}
  if (!document.startViewTransition || reduce) return apply();
  root.classList.add("theming");
  await document.startViewTransition(apply).finished;
  root.classList.remove("theming");
});
