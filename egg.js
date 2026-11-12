// Easter egg: a tiny terminal with a snake game. Loaded only when opened.
import { works, categories, stack, contacts } from "./works.js";

let el, out, input, game;
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const print = (html = "") => { out.insertAdjacentHTML("beforeend", html + "\n"); out.scrollTop = out.scrollHeight; };

const commands = {
  help: () => print(`<span class="m">commands:</span>
  <span class="u">work</span>        list projects
  <span class="u">open</span> &lt;id&gt;   open a project
  <span class="u">stack</span>       what this site is made of
  <span class="u">theme</span>       flip light / dark
  <span class="u">contact</span>     where to find me
  <span class="u">hire</span>        the important one
  <span class="u">snake</span>       take a break
  <span class="u">clear</span>, <span class="u">exit</span>`),
  work: () => print(works.map((w) => `  <span class="a">${w.id.padEnd(11)}</span>${w.title} <span class="m">(${categories[w.kind]}, ${w.year})</span>`).join("\n")),
  open: (id) => {
    const w = works.find((x) => x.id === id);
    if (!w) return print(`no such project. try <span class="u">work</span>`);
    location.href = `work.html?id=${w.id}`;
  },
  stack: () => print(`  this site: plain HTML, CSS and JS. no framework, no build, one hand-written WebGL shader.
  day to day: ${stack.filter((s) => !s.includes("[")).map(esc).join(", ")}`),
  theme: () => { document.getElementById("theme")?.click(); print("flipped."); },
  contact: () => print(Object.entries(contacts).map(([k, v]) => `  <span class="g">${k.padEnd(9)}</span>${k === "email" ? esc(v) : `<a href="${v}" target="_blank" rel="noopener">${esc(v)}</a>`}`).join("\n")),
  hire: () => { print(`<span class="p">good call.</span> opening Upwork…`); setTimeout(() => window.open(contacts.upwork, "_blank", "noopener"), 500); },
  sudo: () => print(`<span class="p">nice try.</span>`),
  clear: () => { out.innerHTML = ""; },
  exit: () => close(),
  snake: () => snake(),
};

function run(line) {
  const [cmd, ...args] = line.trim().split(/\s+/);
  print(`<span class="g">&gt;</span> ${esc(line)}`);
  if (!cmd) return;
  (commands[cmd.toLowerCase()] || (() => print(`command not found: ${esc(cmd)}. try <span class="u">help</span>`)))(...args);
}

function snake() {
  stopGame();
  const N = 20, M = 14, S = 16;
  const cv = document.createElement("canvas");
  cv.width = N * S; cv.height = M * S;
  print(`<span class="m">arrows / WASD or swipe. Esc to quit.</span>`);
  out.append(cv); out.scrollTop = out.scrollHeight;
  const g = cv.getContext("2d");
  let body = [[5, 7], [4, 7], [3, 7]], dir = [1, 0], next = dir, food = [12, 7], score = 0;
  const place = () => { do food = [Math.random() * N | 0, Math.random() * M | 0]; while (body.some(([x, y]) => x === food[0] && y === food[1])); };
  const turn = (d) => { if (d[0] !== -dir[0] || d[1] !== -dir[1]) next = d; };
  const keys = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  const onKey = (e) => { const d = keys[e.key]; if (d) { e.preventDefault(); e.stopPropagation(); turn(d); } };
  let touch;
  const onStart = (e) => { touch = e.touches[0]; };
  const onMove = (e) => {
    if (!touch) return;
    const dx = e.touches[0].clientX - touch.clientX, dy = e.touches[0].clientY - touch.clientY;
    if (Math.abs(dx) + Math.abs(dy) < 24) return;
    turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
    touch = null; e.preventDefault();
  };
  addEventListener("keydown", onKey, true);
  cv.addEventListener("touchstart", onStart, { passive: true });
  cv.addEventListener("touchmove", onMove, { passive: false });
  const timer = setInterval(() => {
    dir = next;
    const head = [(body[0][0] + dir[0] + N) % N, (body[0][1] + dir[1] + M) % M];
    if (body.some(([x, y]) => x === head[0] && y === head[1])) { stopGame(); return print(`<span class="p">game over.</span> score: ${score}. again? <span class="u">snake</span>`); }
    body.unshift(head);
    if (head[0] === food[0] && head[1] === food[1]) { score++; place(); } else body.pop();
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#FFB340"; g.beginPath(); g.arc(food[0] * S + S / 2, food[1] * S + S / 2, S / 2 - 3, 0, 7); g.fill();
    body.forEach(([x, y], i) => { g.fillStyle = i ? "#55A2FF" : "#F1F3FA"; g.beginPath(); g.roundRect(x * S + 1, y * S + 1, S - 2, S - 2, 4); g.fill(); });
  }, 110);
  game = () => { clearInterval(timer); removeEventListener("keydown", onKey, true); input.focus(); };
  input.blur();
}
function stopGame() { if (game) { const g = game; game = null; g(); } }

function close() {
  stopGame();
  el?.remove(); el = null;
  document.documentElement.classList.remove("lock");
  document.body.style.overflow = "";
}

export function open() {
  if (el) return;
  el = document.createElement("div");
  el.className = "term";
  el.innerHTML = `<div class="term-win" role="dialog" aria-label="Terminal" data-native-scroll>
    <div class="term-bar"><span>xolchade.dev — terminal</span><button aria-label="Close">esc</button></div>
    <div class="term-out" data-native-scroll></div>
    <form class="term-in"><span>&gt;</span><input aria-label="Command" autocomplete="off" autocapitalize="off" spellcheck="false"></form>
  </div>`;
  document.body.append(el);
  document.documentElement.classList.add("lock");
  document.body.style.overflow = "hidden";
  out = el.querySelector(".term-out"); input = el.querySelector("input");
  print(`<span class="u">you found it.</span> type <span class="u">help</span> to look around.`);
  el.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); const v = input.value; input.value = ""; run(v); });
  el.querySelector("button").addEventListener("click", close);
  el.addEventListener("pointerdown", (e) => { if (e.target === el) close(); });
  addEventListener("keydown", function onEsc(e) {
    if (!el) return removeEventListener("keydown", onEsc);
    if (e.key !== "Escape") return;
    e.preventDefault();
    if (game) { stopGame(); print(`<span class="m">bye snake.</span>`); } else close();
  });
  input.focus();
}
