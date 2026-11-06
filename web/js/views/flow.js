// 가위바위보 위에 쌓은 놀이 화면들이 같이 쓰는 틀.

import { h, clear } from "../ui/dom.js";
import { t } from "../i18n.js";

export function flowLayout(side, panel) {
  return h("div", { class: "entry-grid flow-grid" }, side, panel);
}

/** 차례 목록. set(i) 로 지금 단계를 표시한다 */
export function stepList(items) {
  const lis = items.map((text, i) => h("li", { "data-i": i }, text));
  const el = h("ol", { class: "steps" }, lis);
  return {
    el,
    set(i) {
      lis.forEach((li, k) => {
        if (k === i) li.setAttribute("aria-current", "step");
        else li.removeAttribute("aria-current");
      });
    },
  };
}

/** 진행 기록(새 줄이 위) */
export function logList({ max = 12, label = t("진행 기록") } = {}) {
  const el = h("ol", { class: "log", "aria-label": label });
  return {
    el,
    add(text, cls = "") {
      el.prepend(h("li", { class: cls }, text));
      while (el.children.length > max) el.lastChild.remove();
    },
    clear() {
      clear(el);
    },
  };
}
