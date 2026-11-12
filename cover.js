// Placeholder covers drawn in SVG, one drawing per project kind
const art = {
  miniapp: `
    <g class="bob">
      <rect class="w" x="136" y="22" width="128" height="256" rx="26"/>
      <rect class="c o3" x="150" y="42" width="60" height="12" rx="6"/>
      <circle class="c o3" cx="242" cy="48" r="7"/>
      <rect class="c" x="150" y="66" width="100" height="78" rx="14"/>
      <rect class="c o3 pop" x="150" y="154" width="46" height="46" rx="12"/>
      <rect class="c o3 pop d1" x="204" y="154" width="46" height="46" rx="12"/>
      <rect class="c o3" x="150" y="210" width="70" height="8" rx="4"/>
      <rect class="c pulse" x="150" y="234" width="100" height="28" rx="14"/>
    </g>`,
  bot: `
    <rect class="w" x="62" y="40" width="176" height="42" rx="21"/>
    <rect class="c o3" x="82" y="57" width="110" height="8" rx="4"/>
    <rect class="c bob" x="186" y="96" width="152" height="42" rx="21"/>
    <rect class="w" x="62" y="152" width="96" height="42" rx="21"/>
    <circle class="c dot" cx="92" cy="173" r="5"/><circle class="c dot d1" cx="110" cy="173" r="5"/><circle class="c dot d2" cx="128" cy="173" r="5"/>
    <rect class="c o3 pop" x="62" y="222" width="134" height="36" rx="12"/>
    <rect class="c o3 pop d1" x="204" y="222" width="134" height="36" rx="12"/>`,
  api: `
    <path class="ln" d="M96 66C150 66 140 150 172 150M96 150H172M96 234C150 234 140 150 172 150M228 150C262 150 256 96 304 96M228 150C262 150 256 204 304 204"/>
    <path class="ln run" d="M96 66C150 66 140 150 172 150M96 150H172M96 234C150 234 140 150 172 150M228 150C262 150 256 96 304 96M228 150C262 150 256 204 304 204"/>
    <rect class="w" x="56" y="46" width="40" height="40" rx="12"/><rect class="w" x="56" y="130" width="40" height="40" rx="12"/><rect class="w" x="56" y="214" width="40" height="40" rx="12"/>
    <rect class="w" x="304" y="76" width="40" height="40" rx="12"/><rect class="w" x="304" y="184" width="40" height="40" rx="12"/>
    <circle class="c pulse" cx="200" cy="150" r="32"/>
    <path class="bgs" d="M190 150h20M200 140v20"/>`,
  ai: `
    <path class="c spin" d="M200 44c7 56 22 71 78 78-56 7-71 22-78 78-7-56-22-71-78-78 56-7 71-22 78-78Z"/>
    <path class="c o3 spin rev" d="M296 46c3 20 8 25 28 28-20 3-25 8-28 28-3-20-8-25-28-28 20-3 25-8 28-28Z"/>
    <path class="c o3 spin rev" d="M100 150c2 14 6 18 20 20-14 2-18 6-20 20-2-14-6-18-20-20 14-2 18-6 20-20Z"/>
    <rect class="w" x="84" y="224" width="232" height="42" rx="21"/>
    <rect class="c o3" x="106" y="241" width="96" height="8" rx="4"/>
    <rect class="c blink" x="210" y="235" width="4" height="20" rx="2"/>
    <circle class="c" cx="292" cy="245" r="13"/>`,
  ui: `
    <rect class="w" x="52" y="34" width="296" height="232" rx="20"/>
    <rect class="c o3" x="68" y="50" width="58" height="200" rx="12"/>
    <rect class="c" x="138" y="50" width="194" height="92" rx="14"/>
    <rect class="c o3" x="138" y="154" width="91" height="96" rx="14"/>
    <rect class="c o3" x="241" y="154" width="91" height="96" rx="14"/>
    <rect class="sel" x="131" y="43" width="208" height="106" rx="18"/>
    <g class="ptr"><path class="ink" d="M318 128v36l9-9 8 17 7-3-8-17h13z"/></g>`,
  "3d": `
    <g class="bob"><path class="c" d="M200 44l52 30-52 30-52-30z"/><path class="c o6" d="M148 74l52 30v60l-52-30z"/><path class="c o3" d="M252 74l-52 30v60l52-30z"/></g>
    <g class="bob d1"><path class="c" d="M130 150l44 25-44 25-44-25z"/><path class="c o6" d="M86 175l44 25v50l-44-25z"/><path class="c o3" d="M174 175l-44 25v50l44-25z"/></g>
    <g class="bob d2"><path class="c" d="M276 160l40 23-40 23-40-23z"/><path class="c o6" d="M236 183l40 23v46l-40-23z"/><path class="c o3" d="M316 183l-40 23v46l40-23z"/></g>`,
};

export function cover(w) {
  return `<svg class="art art-${w.kind}" viewBox="0 0 400 300" aria-hidden="true">${art[w.kind] || art.ui}</svg>`;
}
