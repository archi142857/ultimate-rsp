// 사람 고리(디자인 시안 ③ 고리). 사람을 고리 위 동그라미로 놓는다: 나(목록 맨 앞)는 늘 맨 아래, 나머지는 시계 방향.
// 모든 쌍을 옅은 선으로 잇고(도감 고리와 같은 느낌), 가운데에는 남은 시간·준비 수·판 결과를 둔다.
// 색은 손에만 쓴다: 손이 공개되면 그 사람 테두리와 손 배지를 손 색으로 바꾸고, 이긴 손에서 진 손으로 화살표를 긋는다.
// 크기는 칸 폭에 맞춰 px 로 다시 잰다(ResizeObserver). 같은 사람(key)의 동그라미는 고쳐 쓴다(그림이 깜박이지 않게).

import { h, s, reducedMotion } from "../ui/dom.js";
import { t } from "../i18n.js";
import { handArt } from "../ui/art.js";
import { handVars } from "../ui/colors.js";
import { fillFace, faceOf } from "./avatar.js";
import { emoteIcon, emoteLabel } from "./emotes.js";

export const BUBBLE_MS = 2000;
const MAX_W = 360;
const MIN_W = 240;

/** 사람 수에 따른 동그라미 지름(px): 2–4명 56, 5–6명 48, 7–8명 42, 9–12명 38, 그 위(손 많은 바탕 20명까지) 32 */
export function nodeSize(n) {
  return n <= 4 ? 56 : n <= 6 ? 48 : n <= 8 ? 42 : n <= 12 ? 38 : 32;
}

/**
 * n 사람의 자리(px). 0번이 맨 아래(start 90°), 그다음은 시계 방향(화면 좌표는 y 가 아래로 커서 각이 커지면 시계 방향).
 * 둘만 나란히 놓을 때(도전장)는 start 180° 로 0번을 왼쪽에. R 을 주지 않으면 동그라미와 이름 줄이 W×H 안에 드는 가장 큰 반지름.
 */
export function ringLayout(n, W, H, size, R = null, start = 90) {
  const cx = W / 2;
  const cy = H / 2;
  const r = R ?? Math.max(12, Math.min(W / 2 - size / 2 - 8, H / 2 - size / 2 - 20));
  const pos = [];
  for (let k = 0; k < n; k++) {
    const a = (start * Math.PI) / 180 + (2 * Math.PI * k) / n;
    pos.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  // 이름 줄 폭: 이웃 동그라미와 겹치지 않게(시안은 104px 에서 말줄임)
  const chord = n < 2 ? Infinity : 2 * r * Math.sin(Math.PI / n);
  const labelW = Math.round(Math.max(44, Math.min(104, chord - 8)));
  return { cx, cy, R: r, pos, labelW };
}

/** 나란히(둘이서, 낮은 화면): 높이가 모자라 고리를 세울 수 없을 때 SIDE_H 높이로 나를 왼쪽·상대를 오른쪽에 놓는다 */
export const SIDE_H = 168;
/**
 * 나란히 놓을 때의 자리(px). 이름 줄(104px)이 칸 안에 들게 양 끝에서 52px 안쪽, 동그라미 아래에 이름 두 줄,
 * 위에는 공개한 손(52px)이 들어갈 자리를 둔다. 가운데(남은 시간·결과)도 같은 높이
 */
export function sideLayout(W, H, size) {
  const y = H - size / 2 - 40;
  const pad = 52;
  return { cx: W / 2, cy: y, R: W / 2 - pad, pos: [[pad, y], [W - pad, y]], labelW: 104 };
}

/** 화살표 한 줄(이긴 사람 → 진 사람). 끝은 동그라미 테두리 밖에서 멈춘다 */
function arrowPath(p, q, gap, width) {
  const [x1, y1] = p;
  const [x2, y2] = q;
  const d = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / d;
  const uy = (y2 - y1) / d;
  const sx = x1 + ux * gap;
  const sy = y1 + uy * gap;
  const tx = x2 - ux * (gap + 2);
  const ty = y2 - uy * (gap + 2);
  const L = 7 + width * 1.6;
  const Wd = 3 + width;
  const bx = tx - ux * L;
  const by = ty - uy * L;
  const f = (v) => v.toFixed(1);
  return {
    line: { x1: f(sx), y1: f(sy), x2: f(tx - ux * L * 0.6), y2: f(ty - uy * L * 0.6) },
    head: `M${f(tx)},${f(ty)} L${f(bx - uy * Wd)},${f(by + ux * Wd)} L${f(bx + uy * Wd)},${f(by - ux * Wd)} Z`,
  };
}

const styleOf = (vars) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

/**
 * people: [{ key, who: {kind, name}, label, sub?, me?, strong?, empty?, emptyText?, dim?, away?,
 *            badge?: {text, kind: "ok"|"away"|"plus"|"crown"}, host?: 글, hand?: {V, i}, title? }]
 * arrows: [{ from, to, hand: {V, i} }]   from·to 는 people 의 차례
 */
export function peopleRing({ height = 300, label = t("자리"), chords = true, size: fixedSize = null, radius = null, start = 90, minWidth = MIN_W } = {}) {
  const svg = s("svg", { class: "pring-lines", "aria-hidden": "true", focusable: "false" });
  const mid = h("div", { class: "pring-mid" });
  const nodesBox = h("div", { class: "pring-nodes", role: "list", "aria-label": label });
  const el = h("div", { class: "pring" }, svg, mid, nodesBox);
  const nodes = new Map(); // key → { el, face, badges, hand, name, sub, bubble }
  let people = [];
  let arrows = [];
  let H = height;
  let W = 328;
  let size = 56;
  let side = false; // 둘이서 나란히(낮은 화면)

  function measure() {
    const w = el.clientWidth;
    return w ? Math.max(minWidth, Math.min(MAX_W, w)) : W;
  }

  function draw() {
    const n = people.length;
    size = fixedSize || nodeSize(n);
    const flat = side && n === 2;
    el.style.height = `${flat ? SIDE_H : H}px`;
    el.style.setProperty("--s", `${size}px`);
    el.classList.toggle("small", size < 44);
    el.classList.toggle("duo", n === 2); // 둘이서: 공개 때 낸 손을 얼굴 옆에 크게 보인다
    el.classList.toggle("side", flat);
    // 많이 모이면(13명부터) 이름 줄이 서로 덮는다: 나와 강조한 사람만 이름을 쓰고 나머지는 그림과 title 로
    el.classList.toggle("crowd", n > 12);
    const L = flat ? sideLayout(W, SIDE_H, size) : ringLayout(Math.max(n, 1), W, H, size, radius, start);
    el.style.setProperty("--lbw", `${L.labelW}px`);
    // 선: 고리 + 모든 쌍(+ 화살표)
    const vh = flat ? SIDE_H : H;
    svg.setAttribute("viewBox", `0 0 ${W} ${vh}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", vh);
    const lines = s("g", { class: "pring-chords" + (arrows.length ? " faded" : "") });
    if (flat) {
      const [[x1, y1], [x2, y2]] = L.pos;
      lines.append(s("line", { x1, y1, x2, y2 }));
    } else if (n >= 2) lines.append(s("circle", { cx: L.cx, cy: L.cy, r: L.R.toFixed(1) }));
    // 13명부터는 모든 쌍을 잇는 선(78개 넘음)이 고리를 덮어 고리 선만 둔다
    if (chords && n >= 3 && n <= 12) {
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          const [x1, y1] = L.pos[i];
          const [x2, y2] = L.pos[j];
          lines.append(s("line", { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1) }));
        }
    } else if (chords && n === 2 && !flat) {
      const [x1, y1] = L.pos[0];
      const [x2, y2] = L.pos[1];
      lines.append(s("line", { x1, y1, x2, y2 }));
    }
    const arrowsG = s("g", { class: "pring-arrows" });
    for (const a of arrows) {
      if (!L.pos[a.from] || !L.pos[a.to]) continue;
      const p = arrowPath(L.pos[a.from], L.pos[a.to], size / 2 + 6, 3);
      // pathLength 1: 공개할 때 화살 줄을 그어 나가는 움직임(online.css .revealing)
      arrowsG.append(s("g", { class: "pring-arrow", style: styleOf(handVars(a.hand.V, a.hand.i)) }, s("line", { ...p.line, pathLength: 1 }), s("path", { d: p.head })));
    }
    svg.replaceChildren(lines, arrowsG);
    mid.style.left = `${L.cx}px`;
    mid.style.top = `${L.cy}px`;

    // 사람
    const seen = new Set();
    people.forEach((p, k) => {
      const key = String(p.key);
      seen.add(key);
      let nd = nodes.get(key);
      if (!nd) {
        nd = makeNode(key);
        nodes.set(key, nd);
        nodesBox.append(nd.el);
      }
      updateNode(nd, p, L.pos[k]);
    });
    for (const [key, nd] of nodes) {
      if (seen.has(key)) continue;
      nd.el.remove();
      nodes.delete(key);
    }
    // 목록 차례를 고리 차례에 맞춘다(화면 낭독기는 나부터 시계 방향으로 읽는다)
    people.forEach((p) => nodesBox.append(nodes.get(String(p.key)).el));
  }

  function makeNode(key) {
    const face = h("span", { class: "pring-av" });
    const badges = h("span", { class: "pring-badges" });
    const hand = h("span", { class: "pring-hand", hidden: true });
    const name = h("span", { class: "pring-name" });
    const sub = h("small", { class: "pring-sub" });
    const lab = h("span", { class: "pring-label" }, name, sub);
    const elx = h("div", { class: "pring-node", role: "listitem", "data-key": key }, face, badges, hand, lab);
    return { el: elx, face, faceKey: null, badges, hand, handKey: null, name, sub, bubble: null };
  }

  function updateNode(nd, p, [x, y]) {
    const e = nd.el;
    e.style.left = `${x.toFixed(1)}px`;
    e.style.top = `${y.toFixed(1)}px`;
    e.className =
      "pring-node" +
      (p.me ? " me" : "") +
      (p.empty ? " empty" : "") +
      (p.dim ? " dim" : "") +
      (p.away ? " away" : "") +
      (p.hand ? " shown" : "") +
      (p.strong ? " strong" : "") +
      (p.host ? " is-host" : "");
    // 얼굴: 바뀔 때만 다시 넣는다
    const f = p.empty ? `empty:${p.emptyText || ""}` : JSON.stringify(faceOf(p.who));
    if (f !== nd.faceKey) {
      nd.faceKey = f;
      if (p.empty) nd.face.replaceChildren(h("span", { class: "pring-empty" }, p.emptyText || ""));
      else fillFace(nd.face, p.who);
    }
    // 배지
    const b = [];
    if (p.host) b.push(h("span", { class: "pring-badge host" }, p.host));
    if (p.badge) b.push(h("span", { class: `pring-badge ${p.badge.kind || "ok"}` }, p.badge.text));
    nd.badges.replaceChildren(...b);
    // 공개된 손
    const hk = p.hand ? `${p.hand.V.id}:${p.hand.V.n}:${p.hand.i}` : null;
    if (hk !== nd.handKey) {
      nd.handKey = hk;
      if (p.hand) {
        nd.hand.replaceChildren(handArt(p.hand.V.hands[p.hand.i], "pring-hand-art"));
        nd.hand.hidden = false;
        for (const [k, v] of Object.entries(handVars(p.hand.V, p.hand.i))) e.style.setProperty(k, v);
      } else {
        nd.hand.replaceChildren();
        nd.hand.hidden = true;
        for (const k of ["--cl", "--cd", "--ol", "--od"]) e.style.removeProperty(k);
      }
    }
    nd.name.textContent = p.label || "";
    nd.sub.textContent = p.sub || "";
    nd.sub.hidden = !p.sub;
    e.setAttribute("aria-label", p.title || [p.label, p.host, p.badge && p.badge.say, p.sub].filter(Boolean).join(", "));
    // 많이 모여 이름 줄을 감추면 마우스를 올렸을 때 이름이 보이게
    if (people.length > 12 && p.label) e.title = p.label;
    else e.removeAttribute("title");
  }

  // 칸 폭이 바뀌면 다시 놓는다
  let ro = null;
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(() => {
      const w = measure();
      if (Math.abs(w - W) > 0.5) {
        W = w;
        draw();
      }
    });
    ro.observe(el);
  }

  return {
    el,
    /** 사람·화살표를 바꾼다. height 를 주면 높이도 */
    set(next) {
      if (next.people) people = next.people;
      arrows = next.arrows || [];
      if (next.height) H = next.height;
      W = measure();
      draw();
    },
    /** 높이·나란히를 바꾼다(사람·화살표는 그대로). 화면 높이에 맞출 때 쓴다 */
    shape({ height = H, side: flat = side } = {}) {
      if (height === H && flat === side) return;
      H = height;
      side = flat;
      W = measure();
      draw();
    },
    /** 지금 높이와 나란히 여부 */
    get height() {
      return side && people.length === 2 ? SIDE_H : H;
    },
    /** 가운데 칸(남은 시간, 준비 수, 판 결과) */
    center(...children) {
      mid.replaceChildren(...children.filter(Boolean));
    },
    /** 보낸 사람 동그라미 오른쪽 위에 이모트를 2초 띄운다 */
    bubble(key, e) {
      const nd = nodes.get(String(key));
      if (!nd) return;
      if (nd.bubble) nd.bubble.remove();
      const top = parseFloat(nd.el.style.top) || 0;
      const b = h("span", { class: "pring-bubble" + (top < size / 2 + 44 ? " side" : "") + (reducedMotion() ? "" : " pop"), title: emoteLabel(e) }, emoteIcon(e, "pring-bubble-art"));
      nd.bubble = b;
      nd.el.append(b);
      setTimeout(() => {
        if (nd.bubble === b) {
          b.remove();
          nd.bubble = null;
        }
      }, BUBBLE_MS);
    },
    destroy() {
      if (ro) ro.disconnect();
    },
  };
}

/** 남은 시간 원: 진행은 --ink, 숫자는 Black Han Sans. set(초, 0~1, 서두름) */
export function timerDial({ r = 42, w = 7, unit = t("@time:초") } = {}) {
  const size = 2 * (r + w);
  const c = 2 * Math.PI * r;
  const bar = s("circle", {
    class: "dial-bar",
    cx: size / 2,
    cy: size / 2,
    r,
    "stroke-width": w,
    "stroke-dasharray": `0 ${c.toFixed(1)}`,
    transform: `rotate(-90 ${size / 2} ${size / 2})`,
  });
  const num = h("b", { class: "dial-num" });
  const el = h(
    "div",
    { class: "dial", vars: { "--dial": `${size}px` } },
    s("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, "aria-hidden": "true" }, s("circle", { class: "dial-bg", cx: size / 2, cy: size / 2, r, "stroke-width": w }), bar),
    h("span", { class: "dial-text" }, num, h("small", {}, unit)),
  );
  return {
    el,
    set(sec, frac, hurry = false) {
      num.textContent = sec === null || sec === undefined ? "–" : String(sec);
      const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
      bar.setAttribute("stroke-dasharray", `${(c * f).toFixed(1)} ${c.toFixed(1)}`);
      el.classList.toggle("hurry", !!hurry);
    },
  };
}

/** 가운데 글: 큰 글씨 한 줄 + 작은 글씨 한 줄 */
export function midText(big, small = "", tone = "") {
  return h("div", { class: "pring-say" + (tone ? ` tone-${tone}` : "") }, h("b", {}, big), small ? h("small", {}, small) : null);
}
