// 가위바위보 전쟁: 떠돌다 부딪히면 진 쪽이 이긴 쪽으로 바뀐다.

import { h, clear } from "../ui/dom.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { CATALOG } from "../data/catalog.js";
import { createWar } from "../sims/war.js";
import { block, segmented, selectBox } from "../ui/widgets.js";
import { handColor, handVars } from "../ui/colors.js";
import { entryHead, entryBody } from "./common.js";

export function warView(main, entry) {
  const choices = CATALOG.filter((e) => e.kind === "matrix")
    .map((e) => ({ e, V: compileVariant(e) }))
    .filter((x) => x.V.n <= 5);
  let variantId = "classic";
  let per = 30;
  let speed = 1;
  let V = null;
  let sim = null;
  let running = false;
  let raf = 0;
  let last = 0;
  let alive = true;
  const W = 640;
  const H = 420;

  const canvas = h("canvas", { width: W, height: H, role: "img", "aria-label": "가위바위보 전쟁 판" });
  const ctx = canvas.getContext("2d");
  const legend = h("ul", { class: "legend" });
  const status = h("p", { class: "note", "aria-live": "polite", style: { margin: "12px 0 0" } });
  const stats = h("div", { class: "stats" });
  const playBtn = h("button", { class: "btn btn-ink", type: "button", onclick: () => toggle() }, "시작");
  const resetBtn = h("button", { class: "btn", type: "button", onclick: () => reset() }, "처음부터");

  const vSel = selectBox({
    label: "무엇끼리",
    value: variantId,
    options: choices.map((x) => ({ id: x.e.id, name: x.e.name })),
    onChange: (v) => ((variantId = v), reset()),
  });
  const nSeg = segmented({
    label: "손마다",
    small: true,
    value: String(per),
    options: [10, 30, 60].map((n) => ({ id: String(n), name: `${n}개` })),
    onChange: (v) => ((per = Number(v)), reset()),
  });
  const sSeg = segmented({
    label: "빠르기",
    small: true,
    value: "1",
    options: [
      { id: "0.5", name: "천천히" },
      { id: "1", name: "보통" },
      { id: "2.5", name: "빠르게" },
    ],
    onChange: (v) => (speed = Number(v)),
  });

  function setupCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#fff";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${sim.radius * 1.75}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    for (const a of sim.agents) {
      if (a.flash > 0) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, sim.radius + 4 + (0.35 - a.flash) * 20, 0, Math.PI * 2);
        ctx.strokeStyle = handColor(V, a.kind);
        ctx.globalAlpha = a.flash / 0.35;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillText(V.hands[a.kind].emoji, a.x, a.y + 1);
    }
  }

  function drawStats() {
    const c = sim.counts();
    const total = c.reduce((a, b) => a + b, 0);
    clear(legend).append(
      ...V.hands.map((hd) =>
        h("li", { class: c[hd.i] ? "" : "zero" }, h("span", { class: "swatch", vars: handVars(V, hd.i), "aria-hidden": "true" }), `${hd.emoji} ${hd.name} `, h("b", {}, String(c[hd.i]))),
      ),
    );
    clear(stats).append(stat("시간", `${sim.time.toFixed(0)}초`), stat("바뀐 횟수", String(sim.conversions)), stat("모두", String(total)));
  }

  function stat(k, v) {
    return h("div", { class: "stat" }, h("span", {}, k), h("b", {}, v));
  }

  let frames = 0;
  function frame(t) {
    if (!running || !alive) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016) * speed;
    last = t;
    const sub = Math.ceil(dt / 0.02);
    for (let k = 0; k < sub; k++) sim.step(dt / sub);
    draw();
    frames += 1;
    if (frames % 6 === 0) drawStats();
    if (sim.done()) {
      running = false;
      playBtn.textContent = "시작";
      drawStats();
      const c = sim.counts();
      const w = V.hands.find((hd) => c[hd.i] > 0);
      status.textContent = `${w.emoji} ${w.name}만 남았다. ${sim.time.toFixed(0)}초 걸렸다.`;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function toggle() {
    if (sim.done()) reset();
    running = !running;
    playBtn.textContent = running ? "멈춤" : "시작";
    if (running) {
      status.textContent = "";
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else cancelAnimationFrame(raf);
  }

  function reset() {
    running = false;
    cancelAnimationFrame(raf);
    V = choices.find((x) => x.e.id === variantId).V;
    sim = createWar({ win: V.win, rng: makeRng(), perKind: per, width: W, height: H, radius: per > 40 ? 9 : 11 });
    playBtn.textContent = "시작";
    status.textContent = "시작을 누르면 움직인다.";
    setupCanvas();
    draw();
    drawStats();
  }

  const left = h("div", {}, h("div", { class: "canvas-box" }, canvas), status, stats, legend);
  const right = h(
    "section",
    { class: "panel", "aria-label": "전쟁 설정" },
    h("div", { class: "controls" }, vSel.el),
    h("div", { class: "controls" }, nSeg.el, sSeg.el),
    h("div", { class: "btn-row" }, playBtn, resetBtn),
    h("p", { class: "rec" }, "같은 손끼리 부딪히면 튕겨 나가기만 하고, 다른 손끼리 부딪히면 진 쪽이 이긴 쪽으로 바뀐다."),
  );
  main.append(
    entryHead(entry),
    h("div", { class: "sim-grid" }, left, right),
    entryBody(
      entry,
      block(
        "왜 매번 다를까",
        h("p", {}, "셋이 서로 먹고 먹히니, 한 손이 늘면 그 손을 이기는 손이 곧 따라 는다. 그래서 수가 오르락내리락하다가, 우연히 한 손이 바닥나는 순간 승부가 정해진다."),
        h("p", {}, "고르지 않은 판(우물, 다이너마이트)을 골라 보면 약한 손이 먼저 사라지는지 볼 수 있다."),
      ),
    ),
  );
  reset();
  const onScheme = () => draw();
  window.addEventListener("schemechange", onScheme);
  return {
    destroy() {
      alive = false;
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("schemechange", onScheme);
    },
  };
}
