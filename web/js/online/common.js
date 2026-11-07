// 온라인 화면이 같이 쓰는 조각(디자인 시안 ③ 고리): 위 줄(← 돌아가기 · 오른쪽 글), 카드, 변종 줄, 손 고리,
// 링크 상자, 지난 시각·남은 날.

import { h, s } from "../ui/dom.js";
import { t, lang } from "../i18n.js";
import { createRing } from "../ui/ring.js";
import { handArt } from "../ui/art.js";

/** 맨 위 한 줄: 왼쪽은 돌아가기 링크(← 글, href 가 없으면 글만), 오른쪽은 짧은 글(판 수, 단계 등) */
export function topBar(back, right = null) {
  const left =
    back && back.href
      ? h("a", { class: "o-back", href: back.href }, h("span", { class: "o-arrow", "aria-hidden": "true" }, "←"), " ", back.label)
      : h("span", { class: "o-back o-back-plain" }, back ? back.label : "");
  const r = h("span", { class: "o-top-right" });
  if (right) r.append(right);
  return { el: h("div", { class: "o-top" }, left, r), right: r, left };
}

/** 큰 제목(Black Han Sans) */
export function bigTitle(text, tone = "") {
  return h("h1", { class: "o-h1" + (tone ? ` tone-${tone}` : "") }, text);
}

/** 흰 카드 */
export function card(...children) {
  return h("section", { class: "o-card" }, ...children);
}

/** 변종 한 줄의 작은 손 그림(고리 차례로 다섯 개까지) */
export function miniHands(V, max = 5) {
  const hands = V.order.slice(0, max).map((i) => V.hands[i]);
  return h("span", { class: "mini-hands", "aria-hidden": "true" }, hands.map((hd) => handArt(hd, "mini-hand")));
}

/** "손 3개 · 손마다 하나를 이긴다" */
export function variantDesc(V) {
  const counts = new Set(V.hands.map((hd) => V.beats(hd.i).length));
  if (counts.size === 1) {
    const k = [...counts][0];
    if (k === 1) return t("손 {n}개 · 손마다 하나를 이긴다", { n: V.n });
    if (k > 1) return t("손 {n}개 · 손마다 {k}개를 이긴다", { n: V.n, k });
  }
  return t("손 {n}개", { n: V.n });
}

/** 변종 카드 줄: 작은 손 · 이름 · 설명 · (오른쪽 링크) */
export function variantRow(V, { href = null, on = false, right = null, sub = null, tag = href ? "a" : "div" } = {}) {
  return h(
    tag,
    { class: "varrow" + (on ? " on" : ""), href: href || undefined, "aria-current": on && href ? "true" : undefined },
    miniHands(V),
    h("span", { class: "varrow-body" }, h("span", { class: "varrow-name" }, V.name), h("span", { class: "varrow-sub" }, sub || variantDesc(V))),
    right,
  );
}

/**
 * 도전장의 손 고리: 그 변종의 상성 고리(도감 차례로 위에서 시계 방향, 화살표는 이기는 방향).
 * pickable 이면 손을 눌러 고르고, 고른 손에는 --focus 바깥 빛과 ✓. 손 7개까지는 이름을 동그라미 아래에 쓴다.
 */
export function handRing(V, { size = 300, pickable = false, onPick = null } = {}) {
  const ring = createRing(V, { size });
  ring.el.classList.add("hand-ring");
  if (pickable) ring.el.classList.add("pickable");
  const nr = ring.nodeR;
  const byI = new Map([...ring.el.querySelectorAll(".node")].map((g) => [Number(g.dataset.i), g]));
  const labels = new Map();
  if (V.n <= 7) {
    const g = s("g", { class: "hand-ring-labels", "aria-hidden": "true" });
    for (const hd of V.hands) {
      const [x, y] = ring.pos[hd.i];
      const el = s("text", { x: x.toFixed(1), y: (y + nr + 19).toFixed(1), "text-anchor": "middle" }, hd.name);
      labels.set(hd.i, el);
      g.append(el);
    }
    ring.el.append(g);
  }
  let picked = null;
  function mark(i) {
    for (const [k, g] of byI) {
      g.classList.toggle("picked", k === i);
      g.querySelectorAll(".pick-glow, .pick-check").forEach((x) => x.remove());
      if (k !== i) continue;
      g.insertBefore(s("circle", { class: "pick-glow", r: (nr + 5).toFixed(1) }), g.firstChild);
      const d = nr * 0.72;
      g.append(s("g", { class: "pick-check", transform: `translate(${d.toFixed(1)},${(-d).toFixed(1)})` }, s("circle", { r: 9 }), s("path", { d: "M-4.2,0.2 L-1.2,3.2 L4.4,-3" })));
    }
  }
  function pick(i, from = "ring") {
    picked = i;
    mark(i);
    ring.focus(i);
    if (onPick) onPick(i, from);
  }
  if (pickable) {
    for (const [k, g] of byI) {
      g.addEventListener("click", () => pick(k));
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pick(k);
        }
      });
      // 고리가 스스로 짚기를 풀면(mouseleave·blur) 고른 손을 다시 짚는다
      g.addEventListener("mouseleave", () => picked !== null && ring.focus(picked));
      g.addEventListener("blur", () => picked !== null && ring.focus(picked));
    }
  }
  return {
    el: ring.el,
    ring,
    get picked() {
      return picked;
    },
    /** 밖(손 단추)에서 고른 것을 맞춘다 */
    set(i) {
      picked = i;
      mark(i);
      ring.focus(i);
    },
    /** 결과: 두 손과 그 사이 화살표만 밝힌다. 이름 줄은 '누구 · 손' 으로 */
    bout(a, b, whoA, whoB) {
      mark(null);
      ring.bout(a, b);
      for (const [k, el] of labels) {
        const base = V.hands[k].name;
        el.textContent = k === a && k === b ? `${t("둘 다")} · ${base}` : k === a ? `${whoA} · ${base}` : k === b ? `${whoB} · ${base}` : base;
        el.classList.toggle("who", k === a || k === b);
      }
    },
    clear() {
      ring.clear();
      for (const [k, el] of labels) {
        el.textContent = V.hands[k].name;
        el.classList.remove("who");
      }
    },
    labels: labels.size > 0,
  };
}

/** 남에게 보낼 링크: (보이면) 읽기 전용 칸 + 복사 + (되면) 공유 */
export function linkBox(url, { title, text, showUrl = true, copyLabel = t("링크 복사") }) {
  const input = h("input", { type: "text", class: "text-input link-input", readonly: true, size: 1, "aria-label": t("링크"), hidden: !showUrl });
  input.value = url;
  input.addEventListener("focus", () => input.select());
  const done = h("span", { class: "copy-done", role: "status" });
  let timer = 0;
  const say = (msg) => {
    done.textContent = msg;
    clearTimeout(timer);
    timer = setTimeout(() => (done.textContent = ""), 3000);
  };
  const copy = h("button", { type: "button", class: "btn btn-ink" }, copyLabel);
  copy.addEventListener("click", async () => say((await copyText(url, input)) ? t("복사했다.") : t("복사하지 못했다. 링크를 길게 눌러 복사해 주세요.")));
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const share = canShare
    ? h("button", { type: "button", class: "btn", onclick: () => navigator.share({ title, text, url }).catch(() => {}) }, t("공유하기"))
    : null;
  return h("div", { class: "linkbox" }, input, h("div", { class: "linkbox-act" + (share ? " two" : "") }, copy, share), done);
}

export async function copyText(text, input = null) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* 권한이 없거나 오래된 브라우저 */
  }
  if (!input) return false;
  try {
    const was = input.hidden;
    input.hidden = false;
    input.focus();
    input.select();
    const ok = document.execCommand("copy");
    input.hidden = was;
    return ok;
  } catch {
    return false;
  }
}

/** '3분 전', '어제' 같은 지난 시각 */
export function ago(at, now = Date.now()) {
  const rtf = new Intl.RelativeTimeFormat(lang() === "en" ? "en" : "ko", { numeric: "auto" });
  const sec = (at - now) / 1000;
  const a = Math.abs(sec);
  if (a < 45) return rtf.format(0, "second");
  if (a < 45 * 60) return rtf.format(Math.round(sec / 60), "minute");
  if (a < 22 * 3600) return rtf.format(Math.round(sec / 3600), "hour");
  return rtf.format(Math.round(sec / 86400), "day");
}

/** 남은 날(올림). 지났으면 0 */
export function daysLeft(until, now = Date.now()) {
  return Math.max(0, Math.ceil((until - now) / 86400000));
}

/** 날짜 하나(링크가 열려 있는 마지막 날 등) */
export function dateText(ms) {
  return new Date(ms).toLocaleDateString(lang() === "en" ? "en-US" : "ko-KR", { month: "long", day: "numeric" });
}
