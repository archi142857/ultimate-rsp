// 여러 화면이 같이 쓰는 조각: 고르기, 손 버튼, 무대(나 대 컴퓨터), 외치기, 섞기 막대, 출처.

import { h, clear, reducedMotion, sleep, pct, frac } from "./dom.js";
import { t, isEn } from "../i18n.js";
import { handArt, setArt } from "./art.js";
import { handVars } from "./colors.js";
import { setting, setSetting } from "./store.js";

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

/** 버튼 여럿 가운데 하나 고르기 */
export function segmented({ label, options, value, onChange, small = false }) {
  const name = nextId("seg");
  const wrap = h("div", { class: "seg" + (small ? " seg-sm" : ""), role: "radiogroup", "aria-label": label });
  const btns = options.map((o) =>
    h(
      "button",
      {
        type: "button",
        role: "radio",
        class: "seg-btn",
        "aria-checked": String(o.id === value),
        "data-id": o.id,
        name,
        onclick: () => {
          set(o.id);
          onChange && onChange(o.id);
        },
      },
      o.name,
    ),
  );
  function set(id) {
    btns.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.id === String(id))));
  }
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = btns.findIndex((b) => b.getAttribute("aria-checked") === "true");
    const j = (i + (e.key === "ArrowRight" ? 1 : btns.length - 1)) % btns.length;
    btns[j].focus();
    btns[j].click();
    e.preventDefault();
  });
  wrap.append(...btns);
  return { el: field(label, wrap), set };
}

export function selectBox({ label, options, value, onChange }) {
  const id = nextId("sel");
  const sel = h(
    "select",
    { id, onchange: () => onChange && onChange(sel.value) },
    options.map((o) => h("option", { value: o.id, selected: o.id === value }, o.name)),
  );
  return { el: h("div", { class: "field" }, h("label", { for: id }, label), h("div", { class: "select" }, sel)), sel };
}

export function field(label, control) {
  return h("div", { class: "field" }, h("span", { class: "field-label" }, label), control);
}

/**
 * 손 버튼 묶음. onPick(i). 숫자 키 1~9 도 받는다(keys 가 참이면).
 * setAllowed(boolean[]), setCount(i, 남은 수)로 한정 판을 보여 준다.
 */
export function handGrid(V, { onPick, label = t("낼 손"), names = null, keys = true, compact = false } = {}) {
  const grid = h("div", {
    class: "hands" + (V.n > 7 ? " hands-many" : "") + (V.n > 15 ? " hands-lots" : "") + (V.n > 41 ? " hands-huge" : "") + (compact ? " hands-compact" : ""),
    role: "group",
    "aria-label": label,
  });
  const buttons = V.hands.map((hd, k) => {
    const key = keys && k < 9 ? String(k + 1) : null;
    const b = h(
      "button",
      {
        type: "button",
        class: "hand",
        vars: handVars(V, hd.i),
        "data-i": hd.i,
        "aria-keyshortcuts": key || undefined,
        onclick: () => !b.disabled && onPick(hd.i),
      },
      handArt(hd, "hand-emoji"),
      h("span", { class: "hand-name" }, names ? names[hd.i] : hd.name),
      key && V.n <= 9 ? h("span", { class: "hand-key", "aria-hidden": "true" }, key) : null,
      h("span", { class: "hand-count", hidden: true }),
    );
    return b;
  });
  grid.append(...buttons);
  const api = {
    el: grid,
    buttons,
    setNames(list) {
      buttons.forEach((b, i) => (b.querySelector(".hand-name").textContent = list ? list[i] : V.hands[i].name));
    },
    setAllowed(allowed) {
      buttons.forEach((b, i) => (b.disabled = allowed ? !allowed[i] : false));
    },
    setCount(i, c) {
      const el = buttons[i].querySelector(".hand-count");
      el.hidden = c === null || c === undefined || c === Infinity;
      el.textContent = c === Infinity ? "" : `${c}`;
      buttons[i].setAttribute("aria-label", el.hidden ? V.hands[i].name : t("{name}, {c}개 남음", { name: V.hands[i].name, c }));
    },
    lock(on) {
      grid.classList.toggle("locked", on);
      buttons.forEach((b) => (b.inert = on));
    },
    keyHandler(e) {
      if (!keys || e.altKey || e.ctrlKey || e.metaKey) return false;
      const k = Number(e.key);
      if (k >= 1 && k <= Math.min(9, V.n)) {
        const b = buttons[k - 1];
        if (b && !b.disabled && !grid.classList.contains("locked")) {
          b.click();
          return true;
        }
      }
      return false;
    },
  };
  return api;
}

/** 나 대 상대 무대 */
export function stage({ meLabel = t("나"), opLabel = t("컴퓨터") } = {}) {
  const me = side("me", meLabel);
  const op = side("op", opLabel);
  const msg = h("div", { class: "stage-msg", "aria-live": "polite" });
  const sub = h("div", { class: "stage-sub" });
  const el = h("div", { class: "stage" }, me.el, h("div", { class: "stage-mid" }, msg, sub), op.el);
  function side(cls, label) {
    const face = h("div", { class: "stage-hand", "aria-hidden": "true" }, "");
    const name = h("div", { class: "stage-hand-name" });
    const tag = h("div", { class: "stage-tag" });
    const who = h("div", { class: "stage-who" }, label);
    const box = h("div", { class: `stage-side ${cls}` }, who, face, name, tag);
    return {
      el: box,
      set(V, i, extra = "") {
        if (i === null || i === undefined) {
          setArt(face, null);
          name.textContent = extra || "";
          box.classList.add("empty");
          box.removeAttribute("style");
          return;
        }
        box.classList.remove("empty");
        setArt(face, V.hands[i]);
        name.textContent = extra || V.hands[i].name;
        const v = handVars(V, i);
        for (const [k, val] of Object.entries(v)) box.style.setProperty(k, val);
      },
      text(emoji, label) {
        box.classList.remove("empty");
        box.removeAttribute("style");
        face.textContent = emoji;
        name.textContent = label;
      },
      /** 변종 손이 아닌 소품 그림(황제·시민·노예 같은 것). hand 는 { id 나 art, emoji } */
      art(hand, label) {
        box.classList.remove("empty");
        box.removeAttribute("style");
        setArt(face, hand);
        name.textContent = label;
      },
      tag(t) {
        tag.textContent = t || "";
      },
      who(t) {
        who.textContent = t;
      },
      mark(kind) {
        box.classList.toggle("won", kind === "won");
        box.classList.toggle("lost", kind === "lost");
      },
    };
  }
  return {
    el,
    me,
    op,
    say(text, tone = "") {
      msg.textContent = text;
      msg.className = "stage-msg" + (tone ? ` tone-${tone}` : "");
    },
    sub(text) {
      sub.textContent = text || "";
    },
    reset() {
      me.mark(null);
      op.mark(null);
    },
  };
}

/** 셋을 세는 외침: 3, 2, 1 거꾸로 센다(11-08 사용자. 언어와 상관없이 숫자) */
export function countChant() {
  return ["3", "2", "1"];
}

/** 가위바위보 외치기(언어마다 다르다) */
export function rpsChant() {
  return isEn() ? ["Rock!", "Paper!", "Scissors!", "Shoot!"] : ["가위!", "바위!", "보!"];
}

/** '가위! 바위! 보!' 를 한 마디씩 띄운다. 빨리 하기를 켜거나 움직임 줄이기면 건너뛴다 */
export async function chant(st, words, step = 190) {
  if (fastMode() || reducedMotion()) return;
  for (const w of words) {
    st.say(w, "chant");
    // 화면에 한 번은 그려진 뒤부터 센다(바쁜 폰에서 첫 마디가 건너뛰어지지 않게)
    await painted();
    await sleep(step);
  }
}

/** 다음 화면이 그려질 때까지(숨은 탭이면 0.1초 뒤 그냥 넘어간다) */
export function painted() {
  return new Promise((ok) => {
    const done = setTimeout(ok, 100);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(done);
        ok();
      }),
    );
  });
}

export function fastMode() {
  return setting("fast", false);
}

export function fastToggle() {
  const id = nextId("fast");
  const box = h("input", {
    type: "checkbox",
    id,
    checked: fastMode(),
    onchange: () => setSetting("fast", box.checked),
  });
  return h("label", { class: "check", for: id }, box, h("span", {}, t("외치기 건너뛰기")));
}

export const RESULT_WORD = {
  get 1() {
    return t("승리!");
  },
  get 0() {
    return t("무승부");
  },
  get "-1"() {
    return t("패배");
  },
};

/** 섞기 막대(고르지 않은 판에서만 의미가 있다) */
export function mixBar(V, mix, { label = t("최적 비율") } = {}) {
  const items = V.hands.map((hd) => ({ hd, p: mix[hd.i] })).filter((x) => x.p > 1e-9);
  const bar = h(
    "div",
    { class: "mixbar", role: "img", "aria-label": `${label}: ` + items.map((x) => `${x.hd.name} ${frac(x.p)}`).join(", ") },
    items.map((x) => {
      const v = handVars(V, x.hd.i);
      // 칸 안 글자: 밝은 칸(노랑 등)에는 진한 색, 나머지는 흰색
      return h(
        "span",
        { class: "mix-seg", vars: { ...v, "--w": String(x.p), "--tl": v["--ol"], "--td": v["--od"] }, title: `${x.hd.name} ${frac(x.p)} (${pct(x.p)})` },
        x.p >= 0.12 ? h("span", { class: "mix-in" }, frac(x.p)) : null,
      );
    }),
  );
  const legend = h(
    "ul",
    { class: "legend" },
    V.hands.map((hd) =>
      h(
        "li",
        { class: mix[hd.i] > 1e-9 ? "" : "zero" },
        h("span", { class: "swatch", vars: handVars(V, hd.i), "aria-hidden": "true" }),
        handArt(hd),
        ` ${hd.name} `,
        h("b", {}, frac(mix[hd.i])),
      ),
    ),
  );
  return h("div", { class: "mix" }, bar, legend);
}


export function sourcesList(list) {
  if (!list || !list.length) return null;
  return h(
    "ul",
    { class: "sources" },
    list.map((s) => h("li", {}, h("a", { href: s.u, target: "_blank", rel: "noopener" }, s.t))),
  );
}

export function block(title, ...children) {
  return h("section", { class: "block" }, h("h2", { class: "block-title" }, title), ...children);
}

export function paragraphs(list) {
  return (list || []).map((p) => h("p", {}, p));
}

export function recordLine(r) {
  const total = r.w + r.d + r.l;
  if (!total) return t("아직 기록 없음");
  const tally = t("지금까지 {w}승 {d}무 {l}패", r);
  if (!(r.w + r.l)) return tally;
  return tally + t(", 비긴 판을 빼면 승률 {p}%", { p: Math.round((100 * r.w) / (r.w + r.l)) });
}

export function emptyNode(el) {
  return clear(el);
}
