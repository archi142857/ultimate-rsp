// 화면 아래 짧은 알림 하나(로그인 결과처럼 어느 화면에서든 보일 것). 온라인 알림(notice)과 같은 생김새, 몇 초 뒤 사라진다.

import { h } from "./dom.js";
import { t } from "../i18n.js";

let box = null;
let timer = 0;

/** kind: note(보통) | drop(잘못됨) */
export function toast(title, text = "", { kind = "note", ms = 7000 } = {}) {
  if (!box) {
    box = h("div", { class: "toast-slot", role: "status", "aria-live": "polite" });
    document.body.append(box);
  }
  clearTimeout(timer);
  const hide = () => {
    clearTimeout(timer);
    box.replaceChildren();
  };
  box.replaceChildren(
    h(
      "div",
      { class: `notice notice-${kind} toast` },
      h("span", { class: "notice-dot", "aria-hidden": "true" }),
      h("div", { class: "notice-body" }, h("b", {}, title), text ? h("small", {}, text) : null),
      h("button", { type: "button", class: "toast-x", "aria-label": t("알림 닫기"), onclick: hide }, "✕"),
    ),
  );
  timer = setTimeout(hide, ms);
}
