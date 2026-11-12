// Hero background: three bundles of wires converging into the chat. Raw WebGL, one fragment shader.
const VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }";
const FRAG = `
precision highp float;
uniform vec2 u_res, u_mouse, u_target;
uniform float u_time, u_dpr, u_vert, u_dark, u_gap, u_intro;
uniform vec3 u_c0, u_c1, u_c2;

// cross-axis position of wire (fi = 0..2, fiber fj = -1..1) at along-axis coordinate a
float pathAt(float a, float fi, float fj, vec2 m, float ta, float tc, float span) {
  float t = clamp(a / ta, 0., 1.);
  float e = t * t * (3. - 2. * t);
  float base = mix(span * mix(.14 + .36 * fi, .56 + .21 * fi, u_vert), tc + (fi - 1.) * u_gap, e);
  float amp = span * mix(.07, .05, u_vert) * pow(1. - t, 1.25);
  float ph = fi * 2.1 + fj * .9;
  float c = base
    + sin(a * .0042 * (1. + fi * .23) + u_time * (.35 + fi * .07) + ph) * amp
    + sin(a * .011 + u_time * .6 + ph * 1.7) * amp * .3 * (.5 + fj * .5)
    + fj * (amp * .28 + 3. * (1. - e)) * sin(a * .006 + ph + u_time * .25);
  float da = a - m.x, dc = c - m.y;
  c += exp(-da * da / 51200.) * 64. * dc / (abs(dc) + 50.) * exp(-abs(dc) / 240.) * (1. - e * .7);
  return c;
}

void main() {
  vec2 p = gl_FragCoord.xy / u_dpr;
  p.y = u_res.y - p.y;
  float a = mix(p.x, p.y, u_vert), c = mix(p.y, p.x, u_vert);
  float ta = mix(u_target.x, u_target.y, u_vert), tc = mix(u_target.y, u_target.x, u_vert);
  float span = mix(u_res.y, u_res.x, u_vert);
  vec2 m = mix(u_mouse, u_mouse.yx, u_vert);
  float t = clamp(a / ta, 0., 1.);
  float vis = step(a, ta) * smoothstep(0., .1, t) * (1. - smoothstep(u_intro - .08, u_intro, t));
  vec3 col = vec3(0.);
  float al = 0.;
  if (vis > 0.) {
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec3 wc = i == 0 ? u_c0 : (i == 1 ? u_c1 : u_c2);
      float pk = pow(max(0., sin(t * 24. - u_time * 1.5 + fi * 2.)), 28.);
      for (int j = -1; j < 2; j++) {
        float fj = float(j);
        float y0 = pathAt(a, fi, fj, m, ta, tc, span);
        float y1 = pathAt(a + 1., fi, fj, m, ta, tc, span);
        float d = abs(c - y0) / sqrt(1. + (y1 - y0) * (y1 - y0));
        float mn = j == 0 ? 1. : 0.;
        float w = mix(.45, 1.1 + pk * 1.3, mn);
        float core = 1. - smoothstep(w, w + 1.1, d);
        float glow = u_dark * mn * (.16 + pk * .5) * exp(-d / 9.);
        float k = core * mix(.42, .9 + pk * .4, mn) + glow;
        col += wc * k;
        al += k;
      }
    }
  }
  vec3 avg = col / max(al, .001);
  al = clamp(al, 0., 1.) * vis;
  gl_FragColor = vec4(mix(min(avg, 1.) * al, min(col * vis, 1.), u_dark), al);
}`;

export function initGL(canvas, { target, isVertical, still }) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ["res", "mouse", "target", "time", "dpr", "vert", "dark", "gap", "intro", "c0", "c1", "c2"]) U[n] = gl.getUniformLocation(prog, "u_" + n);

  let w = 0, h = 0, dpr = 1, raf = 0, visible = true, t0 = performance.now(), extra = 0;
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };

  // Colors come from CSS variables, so both themes work
  const probe = document.createElement("i");
  probe.style.cssText = "position:absolute;visibility:hidden;transition-property:none";
  document.body.append(probe);
  const rgb = (v) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map((n) => n / 255); };
  function colors() {
    gl.uniform3fv(U.c0, rgb("--tg")); gl.uniform3fv(U.c1, rgb("--api")); gl.uniform3fv(U.c2, rgb("--ai"));
    const bg = rgb("--bg");
    gl.uniform1f(U.dark, bg[0] + bg[1] + bg[2] < 1.5 ? 1 : 0);
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, isVertical() ? 1.25 : 1.5);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.res, w, h); gl.uniform1f(U.dpr, dpr);
    const tg = target();
    gl.uniform2f(U.target, tg.x, tg.y); gl.uniform1f(U.gap, tg.gap);
    gl.uniform1f(U.vert, isVertical() ? 1 : 0);
  }
  function draw(now) {
    raf = 0;
    const time = still ? 4 : (now - t0) / 1000;
    mouse.x += (mouse.tx - mouse.x) * 0.12; mouse.y += (mouse.ty - mouse.y) * 0.12;
    gl.uniform1f(U.time, time + extra);
    gl.uniform1f(U.intro, still ? 1.2 : Math.max(0, Math.min(1.2, (time - introAt) / 1.6 * 1.2)));
    gl.uniform2f(U.mouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (visible && !still) raf = requestAnimationFrame(draw);
  }
  let introAt = 0;
  const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };

  colors(); resize(); kick();
  new ResizeObserver(() => { resize(); kick(); }).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(canvas);
  new MutationObserver(() => { colors(); kick(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { colors(); kick(); });

  return {
    pointer(x, y) { mouse.tx = x; mouse.ty = y; },
    scroll(v) { extra += v * 0.004; },
    start(delay) { introAt = (performance.now() - t0) / 1000 + delay; },
    refresh() { resize(); kick(); },
  };
}
