// Hero background: particle cloud morphing paper plane → { } → neural sphere (WebGL points, motion in the vertex shader)
const VS = `
attribute vec3 a0, a1, a2;
attribute vec4 seed;
uniform float uPhase, uTime, uAspect, uScale, uSize, uPush, uIntro;
uniform vec2 uCenter, uMouse, uTilt;
varying float vA, vK;
vec3 shape(float i) { return i < .5 ? a0 : i < 1.5 ? a1 : a2; }
void main() {
  float ph = mod(uPhase, 3.), i = floor(ph), f = ph - i;
  float t = smoothstep(0., 1., clamp((f - .2 - seed.x * .25) / .35, 0., 1.));
  vec3 p = mix(shape(i), shape(mod(i + 1., 3.)), t);
  float mid = sin(t * 3.14159);
  vec3 n = vec3(sin(seed.y * 40. + uTime * .6), cos(seed.z * 37. + uTime * .5), sin(seed.w * 31. + uTime * .7));
  p += n * (mid * .42 * (.35 + seed.w) + .014);
  p = mix(p * 1.5 + n * .5, p, uIntro * uIntro * (3. - 2. * uIntro));
  float ry = smoothstep(.2, .8, f) * 6.28318 + sin(uTime * .3) * .32 + uTilt.x;
  float rx = sin(uTime * .21) * .1 + uTilt.y;
  float c = cos(ry), s = sin(ry);
  p.xz = mat2(c, -s, s, c) * p.xz;
  c = cos(rx); s = sin(rx);
  p.yz = mat2(c, -s, s, c) * p.yz;
  float w = 1. - p.z * .22;
  vec2 q = uCenter + p.xy * uScale / w / vec2(uAspect, 1.);
  vec2 d = (q - uMouse) * vec2(uAspect, 1.);
  float push = 1. - smoothstep(0., .34, length(d));
  q += normalize(d + 1e-5) / vec2(uAspect, 1.) * push * push * .1 * uPush;
  gl_Position = vec4(q, 0., 1.);
  gl_PointSize = uSize * (.55 + seed.w * .9) / w * (1. + mid * .4);
  vA = (.3 + .7 * seed.z) * clamp(.75 + p.z * .35, .3, 1.) * uIntro;
  vK = step(.88, seed.y);
}`;
const FS = `
precision mediump float;
uniform vec3 uAcc, uInk;
varying float vA, vK;
void main() {
  float a = smoothstep(.5, .28, length(gl_PointCoord - .5)) * vA;
  gl_FragColor = vec4(mix(uAcc, uInk, vK) * a, a);
}`;

// Seeded random, so the shapes look the same on every visit
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Built in steps with pauses in between, so no single task blocks the page
const pause = () => new Promise((f) => setTimeout(f));
async function shapes(n) {
  const r = rng(7), a0 = new Float32Array(n * 3), a1 = new Float32Array(n * 3), a2 = new Float32Array(n * 3);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // 1. Paper plane: four triangles plus denser edges
  const N = [1.55, 0, 0], WL = [-1.15, .14, 1.1], WR = [-1.15, .14, -1.1], CL = [-1.15, .14, .17], CR = [-1.15, .14, -.17], K = [-1.15, -.52, 0];
  const tris = [[N, WL, CL], [N, WR, CR], [N, CL, K], [N, CR, K]], tw = [1, 1, .55, .55];
  const edges = [[N, WL], [WL, CL], [N, CL], [N, WR], [WR, CR], [N, CR], [N, K], [CL, K], [CR, K]];
  const cx = Math.cos(.95), sx = Math.sin(.95), cz = Math.cos(.62), sz = Math.sin(.62);
  for (let i = 0; i < n; i++) {
    let p;
    if (r() < .34) { const e = edges[r() * edges.length | 0]; p = lerp(e[0], e[1], r()); }
    else {
      let k = r() * 3.1, j = 0; while (k > tw[j]) k -= tw[j++];
      const [A, B, C] = tris[j]; let u = r(), v = r(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
      p = [A[0] + (B[0] - A[0]) * u + (C[0] - A[0]) * v, A[1] + (B[1] - A[1]) * u + (C[1] - A[1]) * v, A[2] + (B[2] - A[2]) * u + (C[2] - A[2]) * v];
    }
    let [x, y, z] = p; x += .1;
    let y2 = y * cx - z * sx, z2 = y * sx + z * cx;
    a0.set([x * cz - y2 * sz, x * sz + y2 * cz, z2], i * 3);
  }

  await pause();

  // 2. Curly braces: points along the glyph centerline, with thickness and depth
  const bez = (p0, p1, p2, p3, t) => { const m = 1 - t; return [m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0], m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]]; };
  const half = [];
  for (let t = 0; t <= 1; t += .05) half.push(bez([.44, 1.32], [.1, 1.32], [.04, 1.12], [.04, .84], t));
  half.push([.04, .42]);
  for (let t = .05; t <= 1.001; t += .05) half.push(bez([.04, .42], [.04, .16], [-.08, .02], [-.36, 0], t));
  const line = [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [x, -y])];
  const len = [0];
  for (let i = 1; i < line.length; i++) len.push(len[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  for (let i = 0; i < n; i++) {
    const s = r() * len[len.length - 1]; let j = 1; while (len[j] < s) j++;
    const t = (s - len[j - 1]) / (len[j] - len[j - 1]), side = i % 2 ? 1 : -1;
    const ang = r() * 6.283, rad = Math.sqrt(r()) * .085;
    const x = line[j - 1][0] + (line[j][0] - line[j - 1][0]) * t + Math.cos(ang) * rad;
    const y = line[j - 1][1] + (line[j][1] - line[j - 1][1]) * t + Math.sin(ang) * rad;
    a1.set([side * (.74 - x), y, (r() - .5) * .34], i * 3);
  }

  await pause();

  // 3. Neural form: tight node clusters on two layers, a thin shell and a dense core
  const nodes = [];
  for (let k = 0; k < 30; k++) { const y = 1 - (k + .5) / 15, q = Math.sqrt(1 - y * y), th = k * 2.39996, R = k % 3 ? 1.16 : .66; nodes.push([Math.cos(th) * q * R, y * R, Math.sin(th) * q * R, k % 3 ? .075 : .05]); }
  const gauss = () => r() + r() + r() - 1.5;
  for (let i = 0; i < n; i++) {
    const u = r(), y = r() * 2 - 1, q = Math.sqrt(1 - y * y), th = r() * 6.283;
    let p = [Math.cos(th) * q, y, Math.sin(th) * q];
    if (u < .52) { const c = nodes[r() * nodes.length | 0]; p = [c[0] + gauss() * c[3], c[1] + gauss() * c[3], c[2] + gauss() * c[3]]; }
    else if (u < .82) p = p.map((v) => v * 1.16);
    else { const k = Math.cbrt(r()) * .3; p = p.map((v) => v * k); }
    a2.set(p, i * 3);
  }

  const seed = new Float32Array(n * 4);
  for (let i = 0; i < seed.length; i++) seed[i] = r();
  return { a0, a1, a2, seed };
}

export async function initCloud(canvas, { hero, still = false, mobile = () => false, onShape = () => {} }) {
  const opts = { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" };
  const gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
  if (!gl) return null;
  const phone = mobile();
  let count = phone ? 9000 : 20000;

  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  const data = await shapes(count);
  await pause();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  await pause();
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  await pause();
  gl.useProgram(prog);
  for (const [name, size] of [["a0", 3], ["a1", 3], ["a2", 3], ["seed", 4]]) {
    const loc = gl.getAttribLocation(prog, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data[name], gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }
  const U = {};
  for (const k of ["uPhase", "uTime", "uAspect", "uScale", "uSize", "uPush", "uIntro", "uCenter", "uMouse", "uTilt", "uAcc", "uInk"]) U[k] = gl.getUniformLocation(prog, k);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  // Colors come from the CSS tokens
  const probe = document.createElement("i");
  probe.style.cssText = "position:absolute;visibility:hidden;transition-property:none";
  document.body.append(probe);
  const rgb = (v) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map((x) => x / 255); };
  function colors() { gl.uniform3fv(U.uAcc, rgb("--acc")); gl.uniform3fv(U.uInk, rgb("--ink")); }

  const dpr = Math.min(devicePixelRatio || 1, phone ? 1 : 1.5);
  let W = 0, H = 0;
  function size() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const narrow = mobile(), asp = W / H;
    gl.uniform1f(U.uAspect, asp);
    gl.uniform1f(U.uScale, narrow ? Math.min(.26, .5 * asp) : Math.min(.34, .42 * asp));
    gl.uniform2f(U.uCenter, narrow ? .4 : 0, narrow ? .36 : -.2);
    gl.uniform1f(U.uSize, (narrow ? 2.3 : 2.6) * dpr * Math.max(.8, Math.min(1.25, H / 860)));
  }

  let phase = 0, target = 0, time = 0, intro = still ? 1 : 0, last = 0, raf = 0, visible = true, started = false, shapeIdx = -1;
  let mx = 0, my = 0, tmx = 0, tmy = 0, push = 0, tpush = 0, lastScroll = -1e9, sy = scrollY;
  let slow = 0, frames = 0;
  // Dev knob: ?cloud=0|1|2 pins a shape
  const pin = (location.search.match(/[?&]cloud=(\d)/) || [])[1], force = pin != null;
  if (force) phase = target = +pin;

  function draw() {
    gl.uniform1f(U.uPhase, phase); gl.uniform1f(U.uTime, time); gl.uniform1f(U.uIntro, intro);
    gl.uniform2f(U.uMouse, mx, my); gl.uniform1f(U.uPush, push);
    gl.uniform2f(U.uTilt, Math.max(-1, Math.min(1, mx)) * .22, -my * .14);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, count);
    const idx = Math.floor(((phase + .5) % 3 + 3) % 3);
    if (idx !== shapeIdx) onShape(shapeIdx = idx);
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000 || .016);
    // Too slow twice in a row: halve the cloud, then freeze it
    if (intro >= 1 && !force && now - last < 200) { frames++; slow += now - last; if (frames === 90) { if (slow / 90 > 30) { if (count > 6000) count >>= 1; else still = true; } frames = slow = 0; } }
    last = now;
    time += dt;
    intro = Math.min(1, intro + dt / 1.6);
    if (now - lastScroll > 700 && !force) target += dt / 7.5;
    phase += (target - phase) * Math.min(1, dt * 5);
    mx += (tmx - mx) * Math.min(1, dt * 7); my += (tmy - my) * Math.min(1, dt * 7);
    push += (tpush - push) * Math.min(1, dt * 5);
    draw();
    if (still) { phase = target = Math.round(phase); intro = 1; draw(); return; }
    play();
  }
  function play() { if (!raf && started && visible && !document.hidden && !still) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  new ResizeObserver(() => { size(); if (!raf) draw(); }).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? play() : stop(); }).observe(canvas);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : play()));
  new MutationObserver(() => { colors(); if (!raf) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); stop(); canvas.classList.remove("on"); });

  addEventListener("scroll", () => {
    const y = scrollY, h = hero.offsetHeight || 1;
    if (visible && !still && !force) { target += (y - sy) / h * 2; lastScroll = performance.now(); }
    sy = y;
  }, { passive: true });
  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !W) return;
    const r = canvas.getBoundingClientRect();
    tmx = (e.clientX - r.left) / r.width * 2 - 1; tmy = 1 - (e.clientY - r.top) / r.height * 2; tpush = 1;
  }, { passive: true });
  hero.addEventListener("pointerleave", () => { tpush = 0; });

  size(); colors();
  return {
    start() { started = true; canvas.classList.add("on"); if (still) { intro = 1; draw(); } else play(); },
  };
}
