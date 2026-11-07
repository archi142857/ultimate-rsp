// 알림 자리(디자인 시안 ③): 화면 맨 위 한 자리에 하나만 보인다.
// 겹치면 끊김 > 한도 > 잇는 중 > 새 판 > 짧은 알림 순으로 덮는다. 색은 알림 종류만 나타내고 손 색은 쓰지 않는다.

import { h } from "../ui/dom.js";

export const NOTICE_RANK = { drop: 5, limit: 4, wait: 3, update: 2, note: 1 };
const NOTE_MS = 4000;

/** 지금 보일 알림 종류(가장 높은 것). 없으면 null */
export function topNotice(kinds) {
  let top = null;
  for (const k of kinds) if (NOTICE_RANK[k] && (!top || NOTICE_RANK[k] > NOTICE_RANK[top])) top = k;
  return top;
}

export function noticeSlot() {
  const items = new Map(); // 종류 → { title, text, action, spin }
  const el = h("div", { class: "notice-slot", "aria-live": "polite" });
  let noteTimer = 0;
  let shown = "";

  function draw() {
    const kind = topNotice(items.keys());
    if (!kind) {
      shown = "";
      el.replaceChildren();
      return;
    }
    const it = items.get(kind);
    const key = JSON.stringify([kind, it.title, it.text, it.action && it.action.label, it.spin]);
    if (key === shown) return; // 같은 알림이면 다시 그리지 않는다(단추 초점이 그대로)
    shown = key;
    el.replaceChildren(
      h(
        "div",
        { class: `notice notice-${kind}` },
        h("span", { class: it.spin ? "spin" : "notice-dot", "aria-hidden": "true" }),
        h("div", { class: "notice-body" }, h("b", {}, it.title), it.text ? h("small", {}, it.text) : null),
        it.action ? h("button", { type: "button", class: "btn btn-sm" + (kind === "update" ? " btn-ink" : ""), onclick: it.action.run }, it.action.label) : null,
      ),
    );
  }

  return {
    el,
    /** kind: drop | limit | wait | update | note(4초 뒤 사라짐) */
    set(kind, { title, text = "", action = null, spin = false }) {
      items.set(kind, { title, text, action, spin });
      if (kind === "note") {
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => {
          items.delete("note");
          draw();
        }, NOTE_MS);
      }
      draw();
    },
    clear(...kinds) {
      for (const k of kinds) items.delete(k);
      draw();
    },
    has: (kind) => items.has(kind),
    destroy() {
      clearTimeout(noteTimer);
    },
  };
}
