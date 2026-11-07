// 온라인 화면이 같이 쓰는 조각: 머리, 서버 상태 한 줄.

import { h } from "../ui/dom.js";
import { t } from "../i18n.js";

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

/** 상태 한 줄: 점 + 글 + (있으면) 단추. kind: wait | ok | bad */
export function statusLine() {
  const text = h("span", { class: "online-status-text" });
  const act = h("span", { class: "online-status-act" });
  const el = h("p", { class: "online-status", role: "status", "data-kind": "wait" }, h("span", { class: "status-dot", "aria-hidden": "true" }), text, act);
  return {
    el,
    set(kind, msg, action = null) {
      el.dataset.kind = kind;
      text.textContent = msg;
      act.replaceChildren(action ? h("button", { type: "button", class: "btn btn-sm", onclick: action.run }, action.label) : "");
    },
  };
}
