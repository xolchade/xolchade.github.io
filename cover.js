// Обложка-заглушка: рисуется кодом по типу работы
export function cover(w, size = "") {
  const inner = {
    miniapp: `<i class="m-top"></i><i class="m-card"></i><i class="m-row"></i><i class="m-row s"></i><i class="m-btn"></i>`,
    bot: `<i class="b-in"></i><i class="b-out"></i><i class="b-in s"></i><i class="b-keys"><i></i><i></i></i>`,
    ui: `<i class="u-a"></i><i class="u-b"></i><i class="u-c"></i><i class="u-d"></i>`,
  }[w.kind];
  return `<div class="cover cover-${w.kind} ${size}" style="--h:${w.hue}">${inner}</div>`;
}
