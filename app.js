// Главная: чат-визитка, список работ, фильтры
import { works, categories, contacts } from "./works.js";
import { cover } from "./cover.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

$("#tg").href = contacts.telegram;
$("#gh").href = contacts.github;
$("#y").textContent = new Date().getFullYear();

// --- чат ---
const thread = $("#thread");
const status = $("#status");

function bubble(text, who = "bot") {
  const li = document.createElement("li");
  li.className = `msg ${who}`;
  li.textContent = text;
  thread.append(li);
  thread.scrollTop = thread.scrollHeight;
  return li;
}

async function botSay(text) {
  status.textContent = "печатает…";
  const dots = document.createElement("li");
  dots.className = "msg bot typing";
  dots.innerHTML = "<i></i><i></i><i></i>";
  thread.append(dots);
  await wait(Math.min(400 + text.length * 14, 1300));
  dots.remove();
  bubble(text);
  status.textContent = "в сети";
}

(async () => {
  await wait(350);
  await botSay("Привет! Я xolchade 👋");
  await botSay("Проектирую и собираю Telegram Mini Apps, ботов и интерфейсы к ним.");
  await botSay("Что показать?");
  $("#keyboard").hidden = false;
})();

const replies = {
  works: "Лови список — открывается ниже.",
  process: "Коротко: разбор задачи, прототип, сборка, запуск. Подробнее ниже.",
  contact: "Отлично! Жду в Telegram.",
};

$("#keyboard").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  bubble(b.textContent, "me");
  await botSay(replies[b.dataset.go]);
  await wait(250);
  document.getElementById(b.dataset.go).scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
});

// --- список работ ---
const list = $("#list");

function render(filter) {
  list.innerHTML = works
    .filter((w) => filter === "all" || w.kind === filter)
    .map((w) => `
      <li style="view-transition-name: row-${w.id}">
        <a class="row" href="work.html?id=${w.id}" data-id="${w.id}">
          <span class="thumb" style="view-transition-name: cover-${w.id}">${cover(w, "sm")}</span>
          <span class="t">${w.title}<small>Описание появится скоро</small></span>
          <span class="k">${categories[w.kind]}</span>
          <span class="yr">${w.year}</span>
        </a>
      </li>`)
    .join("");
}
render("all");

$(".filters").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.getAttribute("aria-pressed") === "true") return;
  document.querySelectorAll(".filters button").forEach((x) => x.setAttribute("aria-pressed", x === b));
  const go = () => render(b.dataset.filter);
  document.startViewTransition && !reduce ? document.startViewTransition(go) : go();
});

// --- превью за курсором (только мышь) ---
const floater = $("#floater");
if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
  let x = 0, y = 0, fx = 0, fy = 0, raf;
  const loop = () => {
    fx += (x - fx) * 0.18; fy += (y - fy) * 0.18;
    floater.style.translate = `${fx}px ${fy}px`;
    raf = requestAnimationFrame(loop);
  };
  list.addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; });
  list.addEventListener("pointerover", (e) => {
    const a = e.target.closest(".row");
    if (!a) return;
    const w = works.find((w) => w.id === a.dataset.id);
    if (floater.dataset.id !== w.id) { floater.innerHTML = cover(w, "lg"); floater.dataset.id = w.id; }
    if (!floater.classList.contains("on")) { fx = e.clientX; fy = e.clientY; cancelAnimationFrame(raf); loop(); }
    floater.classList.add("on");
  });
  list.addEventListener("pointerleave", () => { floater.classList.remove("on"); cancelAnimationFrame(raf); });
}

// При переходе на работу — убираем плавающее превью из снимка
addEventListener("pageswap", () => floater.classList.remove("on"));
