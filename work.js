// Project page: built from works.js by ?id=
import { works, categories, filters } from "./works.js";
import { cover } from "./cover.js";

const id = new URLSearchParams(location.search).get("id");
const i = Math.max(0, works.findIndex((w) => w.id === id));
const w = works[i];
const next = works[(i + 1) % works.length];
const color = (k) => (filters.find((f) => f.kinds.includes(k)) || {}).color || "tg";

document.title = `${w.title} — xolchade`;
document.getElementById("case").innerHTML = `
  <a class="back ul" href="./#work">All work</a>
  <p class="case-meta"><span class="kind" style="--t:var(--${color(w.kind)})"><i></i>${categories[w.kind]}</span><span>${w.year}</span></p>
  <h1 class="display">${w.title}</h1>
  <p class="lede">Case study dropping soon.</p>
  <div class="case-cover" style="view-transition-name:cover-${w.id}">${cover(w)}</div>
  <dl class="case-body">
    <dt>Challenge</dt><dd>Details land with the case study.</dd>
    <dt>Solution</dt><dd>Details land with the case study.</dd>
    <dt>Result</dt><dd>Details land with the case study.</dd>
  </dl>
  <a class="next" id="next" href="work.html?id=${next.id}">
    <small>Next project</small>
    <span>${next.title}</span>
  </a>
  <div class="floater" id="floater" aria-hidden="true">${cover(next)}</div>`;

// Shared UI (links, cursor, smooth scroll) loads after the page is painted
import("./ui.js").then(({ fine, reduce }) => {
  if (!fine || reduce) return;
  // Preview of the next project follows the cursor
  const link = document.getElementById("next"), fl = document.getElementById("floater");
  let x = 0, y = 0, fx = 0, fy = 0, raf = 0;
  const loop = () => { fx += (x - fx) * 0.18; fy += (y - fy) * 0.18; fl.style.transform = `translate3d(${fx}px,${fy}px,0)`; raf = requestAnimationFrame(loop); };
  link.addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
  link.addEventListener("pointerenter", (e) => { fx = x = e.clientX; fy = y = e.clientY; fl.classList.add("on"); cancelAnimationFrame(raf); loop(); });
  link.addEventListener("pointerleave", () => { fl.classList.remove("on"); cancelAnimationFrame(raf); });
  addEventListener("pageswap", () => fl.classList.remove("on"));
});
