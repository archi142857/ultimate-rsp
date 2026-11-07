// 온라인 화면이 같이 쓰는 조각: 머리, 상태 한 줄, 고리 그림 칸, 손 고르기, 링크 상자, 지난 시각.

import { h } from "../ui/dom.js";
import { t, lang } from "../i18n.js";
import { createRing } from "../ui/ring.js";
import { handGrid } from "../ui/widgets.js";
import { handArt } from "../ui/art.js";
import { handVars } from "../ui/colors.js";

/** 온라인 화면 머리. back 이 참이면 온라인 첫 화면으로 가는 링크 */
export function onlineHead(title, sub, { back = true } = {}) {
  return h(
    "header",
    { class: "entry-head" },
    back ? h("a", { class: "back", href: "#/play" }, t("온라인")) : null,
    h("h1", { class: "entry-title" }, title),
    sub ? h("p", { class: "entry-sub" }, sub) : null,
  );
}

/** 상태 한 줄: 점 + 글 + (있으면) 단추. kind: wait | ok | bad. hide() 로 감춘다 */
export function statusLine({ hidden = false } = {}) {
  const text = h("span", { class: "online-status-text" });
  const act = h("span", { class: "online-status-act" });
  const el = h("p", { class: "online-status", role: "status", "data-kind": "wait", hidden }, h("span", { class: "status-dot", "aria-hidden": "true" }), text, act);
  return {
    el,
    set(kind, msg, action = null) {
      el.hidden = false;
      el.dataset.kind = kind;
      text.textContent = msg;
      act.replaceChildren(action ? h("button", { type: "button", class: "btn btn-sm", onclick: action.run }, action.label) : "");
    },
    hide() {
      el.hidden = true;
    },
  };
}

/** 도감 화면과 같은 고리 그림 칸. rulesLink 가 있으면 '규칙 자세히' 링크를 붙인다 */
export function ringPanel(V, { rulesLink = null } = {}) {
  const ring = createRing(V, { size: 440 });
  const el = h(
    "div",
    { class: "ring-panel" },
    h("div", { class: "ring-box" }, ring.el),
    h("p", { class: "ring-note" }, t("화살표는 이기는 손에서 지는 손으로 간다. 손을 짚으면 그 손이 이기는 쪽은 그 손 색으로, 지는 쪽은 진하게 보인다.")),
    rulesLink ? h("a", { class: "ring-more", href: rulesLink }, t("규칙 자세히 보기")) : null,
  );
  return { el, ring };
}

/**
 * 손 하나 고르기. 누르면 바로 내지 않고 고른 표시만 한다(잘못 누르기 쉬운 휴대폰을 생각해서).
 * 내기는 따로 단추로 한다. 숫자 키 1~9 도 받는다(keyHandler).
 */
export function handPicker(V, { ring = null, label = t("낼 손"), onPick = null } = {}) {
  let picked = null;
  const grid = handGrid(V, { label, onPick: (i) => set(i) });
  function set(i) {
    picked = i;
    grid.buttons.forEach((b, k) => {
      b.classList.toggle("picked", k === i);
      b.setAttribute("aria-pressed", String(k === i));
    });
    if (ring) ring.focus(i);
    if (onPick) onPick(i);
  }
  grid.buttons.forEach((b, k) => {
    b.setAttribute("aria-pressed", "false");
    if (!ring) return;
    b.addEventListener("mouseenter", () => ring.focus(k));
    b.addEventListener("mouseleave", () => ring.focus(picked));
    b.addEventListener("focus", () => ring.focus(k));
    b.addEventListener("blur", () => ring.focus(picked));
  });
  return {
    el: grid.el,
    get picked() {
      return picked;
    },
    lock: (on) => grid.lock(on),
    keyHandler: (e) => grid.keyHandler(e),
  };
}

/** 내가 낸 손(나만 본다) */
export function myHandLine(V, i, text) {
  return h("div", { class: "my-hand", vars: handVars(V, i) }, handArt(V.hands[i], "my-hand-art"), h("span", {}, text));
}

/** 남에게 보낼 링크: 읽기 전용 칸 + 복사 + (되면) 공유 */
export function linkBox(url, { title, text }) {
  const input = h("input", { type: "text", class: "text-input link-input", readonly: true, size: 1, "aria-label": t("링크") });
  input.value = url;
  input.addEventListener("focus", () => input.select());
  const done = h("span", { class: "copy-done", role: "status" });
  let timer = 0;
  const say = (msg) => {
    done.textContent = msg;
    clearTimeout(timer);
    timer = setTimeout(() => (done.textContent = ""), 3000);
  };
  const copy = h("button", { type: "button", class: "btn btn-ink" }, t("링크 복사"));
  copy.addEventListener("click", async () => say((await copyText(url, input)) ? t("복사했다.") : t("복사하지 못했다. 링크를 길게 눌러 복사해 주세요.")));
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const share = canShare
    ? h("button", { type: "button", class: "btn", onclick: () => navigator.share({ title, text, url }).catch(() => {}) }, t("공유하기"))
    : null;
  return h("div", { class: "linkbox" }, input, h("div", { class: "linkbox-act" }, copy, share, done));
}

async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* 권한이 없거나 오래된 브라우저 */
  }
  try {
    input.focus();
    input.select();
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

/** '3분 전', '어제' 같은 지난 시각 */
export function ago(at, now = Date.now()) {
  const rtf = new Intl.RelativeTimeFormat(lang() === "en" ? "en" : "ko", { numeric: "auto" });
  const s = (at - now) / 1000;
  const a = Math.abs(s);
  if (a < 45) return rtf.format(0, "second");
  if (a < 45 * 60) return rtf.format(Math.round(s / 60), "minute");
  if (a < 22 * 3600) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** 날짜 하나(링크가 열려 있는 마지막 날 등) */
export function dateText(ms) {
  return new Date(ms).toLocaleDateString(lang() === "en" ? "en-US" : "ko-KR", { month: "long", day: "numeric" });
}
