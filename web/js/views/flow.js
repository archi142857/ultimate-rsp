// 가위바위보 위에 쌓은 놀이 화면들이 같이 쓰는 틀.

import { h, clear } from "../ui/dom.js";
import { t } from "../i18n.js";
import { painted } from "../ui/widgets.js";

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

/**
 * 누르기 단추(뿅망치 치기·막기, 돈!, 달아나기). wait(limit) 로 켜고, 켠 뒤 누르기까지 걸린 ms 를 돌려준다.
 * limit 안에 안 누르면 Infinity. 손가락은 pointerdown 에서 바로 잰다(click 은 손을 뗄 때라 늦다).
 * 키보드는 화면의 onKey 에서 key(e) 를 부른다(Space·Enter).
 */
export function pressPad(label, { cls = "" } = {}) {
  const btn = h("button", { class: "press" + (cls ? ` ${cls}` : ""), type: "button", disabled: true }, label);
  let t0 = 0;
  let done = null;
  let timer = 0;
  function finish(ms) {
    if (!done) return;
    const ok = done;
    done = null;
    clearTimeout(timer);
    btn.disabled = true;
    btn.classList.remove("armed");
    ok(ms);
  }
  const hit = () => done && t0 && finish(Math.round(performance.now() - t0));
  btn.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    hit();
  });
  btn.addEventListener("click", (e) => e.detail === 0 && hit()); // 키보드로 누른 단추
  return {
    el: btn,
    async wait(limit = Infinity) {
      finish(Infinity);
      t0 = 0;
      btn.disabled = false;
      btn.classList.add("armed");
      const p = new Promise((ok) => (done = ok));
      await painted(); // 단추가 보인 때부터 잰다
      t0 = performance.now();
      if (Number.isFinite(limit)) timer = setTimeout(() => finish(Infinity), limit);
      return p;
    },
    cancel() {
      finish(Infinity);
    },
    key(e) {
      if (!done || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return false;
      if (e.key !== " " && e.key !== "Enter") return false;
      hit();
      return true;
    },
    set(text) {
      btn.textContent = text;
    },
  };
}
