// 상성 고리: 손을 원 위에 고리 차례로 놓고, 이기는 손에서 지는 손으로 화살표를 긋는다.

import { s } from "./dom.js";
import { t, lower, listWords } from "../i18n.js";
import { ringArt } from "./art.js";
import { handVars } from "./colors.js";

function nodeRadius(n, size, mini, emoji) {
  if (mini && emoji) return n <= 3 ? size * 0.17 : n <= 4 ? size * 0.15 : size * 0.13;
  if (mini) return Math.max(3.2, Math.min(9, (size * 0.9) / n / 1.7));
  const base = size / 360;
  if (n <= 3) return 34 * base;
  if (n <= 5) return 30 * base;
  if (n <= 7) return 26 * base;
  if (n <= 11) return 22 * base;
  if (n <= 15) return 18 * base;
  if (n <= 25) return 13 * base;
  return Math.max(3.5, (size * 1.7) / n);
}

export function createRing(V, { size = 360, mini = false, emoji = !mini && V.n <= 41, title = null } = {}) {
  const n = V.n;
  const nr = nodeRadius(n, size, mini, emoji);
  const pad = mini ? 2 : 6;
  const R = size / 2 - nr - pad;
  const cx = size / 2;
  const cy = size / 2;
  const pos = new Array(n);
  V.order.forEach((hi, p) => {
    const a = -Math.PI / 2 + (2 * Math.PI * p) / n;
    pos[hi] = [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  });

  const svg = s("svg", {
    class: "ring" + (mini ? " ring-mini" : "") + (mini && emoji ? " ring-mini-emo" : "") + (n > 7 ? " ring-dense" : "") + (n > 25 ? " ring-huge" : ""),
    viewBox: `0 0 ${size} ${size}`,
    width: size,
    height: size,
    role: "img",
    "aria-label": title || ringLabel(V),
  });

  const edgesG = s("g", { class: "edges" });
  const nodesG = s("g", { class: "nodes" });
  svg.append(edgesG, nodesG);

  const edges = [];
  const arrowLen = mini ? 0 : Math.max(5, Math.min(10, nr * 0.45));
  const arrowW = arrowLen * 0.55;
  /** 이기는 손 a → 지는 손 b 선의 자리: 시작점, 선 끝, 화살촉 세 점 */
  function geo(a, b) {
    const [x1, y1] = pos[a];
    const [x2, y2] = pos[b];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const d = Math.hypot(dx, dy);
    const ux = dx / d;
    const uy = dy / d;
    const tx = x2 - ux * (nr + 2);
    const ty = y2 - uy * (nr + 2);
    const bx = tx - ux * arrowLen;
    const by = ty - uy * arrowLen;
    return {
      sx: x1 + ux * (nr + 1.5),
      sy: y1 + uy * (nr + 1.5),
      ex: tx - ux * arrowLen * 0.6,
      ey: ty - uy * arrowLen * 0.6,
      head: [tx, ty, bx - uy * arrowW, by + ux * arrowW, bx + uy * arrowW, by - ux * arrowW],
    };
  }
  const headD = ([x0, y0, x1, y1, x2, y2], k) => `M${x0.toFixed(k)},${y0.toFixed(k)} L${x1.toFixed(k)},${y1.toFixed(k)} L${x2.toFixed(k)},${y2.toFixed(k)} Z`;

  // 손이 26개부터는(RPS-101 은 선 5,050개) 선을 하나씩 그리면 요소가 수만 개라 그리기도 짚기도 무겁다.
  // 그때는 이기는 손마다 선을 path 하나로 묶어 옅게 깔고, 짚은 손·한 판의 선과 화살촉은 그때그때 위에 덧그린다.
  const huge = n > 25;
  for (let a = 0; a < n; a++) {
    let d = "";
    for (let b = 0; b < n; b++) {
      if (!V.win[a][b]) continue;
      const e = geo(a, b);
      if (huge) {
        d += `M${e.sx.toFixed(1)},${e.sy.toFixed(1)}L${e.ex.toFixed(1)},${e.ey.toFixed(1)}`;
        continue;
      }
      const g = s("g", { class: "edge", "data-a": a, "data-b": b, style: varsToStyle(handVars(V, a)) });
      g.append(s("line", { class: "ln", x1: e.sx, y1: e.sy, x2: e.ex, y2: e.ey }));
      if (!mini) g.append(s("path", { class: "hd", d: headD(e.head, 2) }));
      edgesG.append(g);
      edges.push({ a, b, g });
    }
    if (huge && d) edgesG.append(s("g", { class: "edge", "data-a": a, style: varsToStyle(handVars(V, a)) }, s("path", { class: "ln", d })));
  }

  // 손이 많을 때 덧그린 것: out(짚은 손이 이기는 선), in(짚은 손을 이기는 선), hit(한 판의 선)
  const over = {};
  let overFor = null; // out·in 을 그려 둔 손
  function overlay(kind, pairs) {
    over[kind]?.remove();
    over[kind] = null;
    if (!pairs.length) return;
    let ln = "";
    let hd = "";
    for (const [a, b] of pairs) {
      const e = geo(a, b);
      ln += `M${e.sx.toFixed(1)},${e.sy.toFixed(1)}L${e.ex.toFixed(1)},${e.ey.toFixed(1)}`;
      if (!mini) hd += headD(e.head, 1);
    }
    // 선 색(--c)은 이기는 손 것. in 은 손마다 다르지만 CSS 가 한 색(--ink-2)으로 그린다
    const g = s("g", { class: `edge ${kind}`, style: kind === "in" ? null : varsToStyle(handVars(V, pairs[0][0])) }, s("path", { class: "ln", d: ln }));
    if (hd) g.append(s("path", { class: "hd", d: hd }));
    edgesG.append(g);
    over[kind] = g;
  }

  const nodes = V.hands.map((hd) => {
    const [x, y] = pos[hd.i];
    const g = s("g", {
      class: "node",
      "data-i": hd.i,
      transform: `translate(${x.toFixed(2)},${y.toFixed(2)})`,
      style: varsToStyle(handVars(V, hd.i)),
    });
    g.append(s("circle", { r: nr }));
    if (emoji) g.append(ringArt(hd, nr * 1.5));
    if (!mini) g.append(s("title", {}, nodeTitle(V, hd.i)));
    nodesG.append(g);
    return g;
  });

  let focus = null;
  const api = {
    el: svg,
    pos,
    nodeR: nr,
    /** 손 하나를 짚는다: 이기는 선은 그 손 색, 지는 선은 진하게, 나머지는 옅게 */
    focus(i) {
      focus = i;
      const on = i !== null && i !== undefined;
      svg.classList.toggle("focused", on);
      if (huge && overFor !== (on ? i : null)) {
        overFor = on ? i : null;
        const ok = on && !!V.hands[i];
        overlay("out", ok ? V.beats(i).map((b) => [i, b]) : []);
        overlay("in", ok ? V.beatenBy(i).map((k) => [k, i]) : []);
      }
      for (const e of edges) {
        e.g.classList.toggle("out", i === e.a);
        e.g.classList.toggle("in", i === e.b);
      }
      nodes.forEach((g, k) => {
        g.classList.toggle("on", k === i);
        g.classList.toggle("prey", i !== null && i !== undefined && V.win[i]?.[k] === 1);
        g.classList.toggle("hunter", i !== null && i !== undefined && V.win[k]?.[i] === 1);
      });
    },
    /** 한 판 결과: 두 손과 그 사이 선을 밝힌다 */
    bout(a, b) {
      api.focus(null);
      svg.classList.add("bout");
      nodes.forEach((g, k) => g.classList.toggle("on", k === a || k === b));
      if (huge) overlay("hit", V.win[a]?.[b] ? [[a, b]] : V.win[b]?.[a] ? [[b, a]] : []);
      for (const e of edges) e.g.classList.toggle("hit", (e.a === a && e.b === b) || (e.a === b && e.b === a));
    },
    clear() {
      svg.classList.remove("bout");
      if (huge) overlay("hit", []);
      for (const e of edges) e.g.classList.remove("hit");
      api.focus(null);
    },
    get focused() {
      return focus;
    },
  };

  if (!mini) {
    nodes.forEach((g, k) => {
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", nodeTitle(V, k));
      g.addEventListener("mouseenter", () => api.focus(k));
      g.addEventListener("mouseleave", () => api.focus(null));
      g.addEventListener("focus", () => api.focus(k));
      g.addEventListener("blur", () => api.focus(null));
    });
  }
  return api;
}

function varsToStyle(v) {
  return Object.entries(v)
    .map(([k, val]) => `${k}:${val}`)
    .join(";");
}

export function nodeTitle(V, i) {
  const h = V.hands[i];
  const names = (ks) => listWords(ks.map((k) => lower(V.hands[k].name, V.hands[k].proper)));
  const w = V.beats(i);
  const l = V.beatenBy(i);
  const vars = { name: h.name, w: names(w), l: names(l) };
  if (w.length && l.length) return t("{name}: {w:을를} 이기고 {l}에 짐", vars);
  if (w.length) return t("{name}: {w:을를} 이김", vars);
  if (l.length) return t("{name}: {l}에 짐", vars);
  return t("{name}: 모두와 비김", vars);
}

function ringLabel(V) {
  return t("{name} 상성 고리. 손 {n}개. ", { name: V.name, n: V.n }) + V.hands.map((h) => nodeTitle(V, h.i)).join(". ");
}
