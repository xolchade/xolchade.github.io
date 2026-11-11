// Страница работы: собирается из works.js по ?id=
import { works, categories } from "./works.js";
import { cover } from "./cover.js";

const id = new URLSearchParams(location.search).get("id");
const i = Math.max(0, works.findIndex((w) => w.id === id));
const w = works[i];
const next = works[(i + 1) % works.length];

document.title = `${w.title} — xolchade`;
document.getElementById("y").textContent = new Date().getFullYear();

document.getElementById("case").innerHTML = `
  <div class="case-head">
    <p class="case-meta"><span>${categories[w.kind]}</span><span>${w.year}</span></p>
    <h1>${w.title}</h1>
    <p class="lede">Описание проекта появится скоро.</p>
  </div>
  <div class="case-cover" style="view-transition-name: cover-${w.id}">${cover(w, "xl")}</div>
  <dl class="case-body">
    <dt>Задача</dt><dd>Текст появится вместе с проектом.</dd>
    <dt>Решение</dt><dd>Текст появится вместе с проектом.</dd>
    <dt>Результат</dt><dd>Текст появится вместе с проектом.</dd>
  </dl>
  <a class="next" href="work.html?id=${next.id}">
    <small>Следующая работа</small>
    <span>${next.title}</span>
  </a>`;
