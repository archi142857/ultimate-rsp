// 프로필 칩(디자인 시안2 ①): 둥근 알약에 그림 28px + 이름 + ✎. 누르면 이름 바꾸기가 뜬다.
// 넓은 화면은 칩 바로 아래 팝오버(320px, 꼭지가 칩을 가리킨다), 좁은 화면은 아래 시트(뒤는 어둡게).
// 열면 입력칸에 포커스. Enter 는 저장, Esc 나 바깥을 누르면 저장하지 않고 닫는다. 이름은 이 브라우저에만 남는다(identity.js).

import { h } from "../ui/dom.js";
import { t } from "../i18n.js";
import { avatar, fillFace } from "./avatar.js";
import { myName, setMyName, randomName, cleanName, NAME_MAX } from "./identity.js";

const NARROW = "(max-width: 599px)";
let seq = 0;

const narrow = () => {
  try {
    return matchMedia(NARROW).matches;
  } catch {
    return false;
  }
};

/**
 * align: "start"(칩이 왼쪽, 팝오버도 왼쪽에 맞춘다) | "end"(오른쪽)
 * ranked: 순위표가 있으면 안내 글에 '순위표에도 보인다'를 쓴다
 * onChange(name): 저장한 뒤
 */
export function profileChip({ align = "start", ranked = false, onChange = null } = {}) {
  const id = `pname-${++seq}`;
  const face = avatar({ kind: "human", name: myName() }, { size: 28, cls: "pchip-av" });
  const nameEl = h("span", { class: "pchip-name" }, myName());
  const chip = h(
    "button",
    { type: "button", class: "pchip", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": id },
    face,
    nameEl,
    h("span", { class: "pchip-pen", "aria-hidden": "true" }, "✎"),
    h("span", { class: "visually-hidden" }, ` · ${t("이름 바꾸기")}`),
  );

  // ── 이름 바꾸기 ─────────────────
  const input = h("input", {
    type: "text",
    class: "text-input pname-input",
    id: `${id}-input`,
    size: 1,
    // 이모지가 두 칸으로 세어져도 잘리지 않게 넉넉히. 실제로는 cleanName 이 20글자로 자른다
    maxlength: NAME_MAX * 2,
    autocomplete: "off",
    spellcheck: "false",
    enterkeyhint: "done",
    "aria-labelledby": `${id}-title`,
    "aria-describedby": `${id}-note`,
  });
  const wipe = h("button", { type: "button", class: "pname-clear", "aria-label": t("지우기") }, "✕");
  wipe.addEventListener("click", () => {
    input.value = "";
    input.removeAttribute("aria-invalid");
    input.focus();
  });
  const again = h("button", { type: "button", class: "btn" }, t("무작위 이름"));
  again.addEventListener("click", () => {
    input.value = randomName();
    input.removeAttribute("aria-invalid");
    input.focus();
  });
  const save = h("button", { type: "submit", class: "btn btn-ink" }, t("저장"));
  const note = h("p", { class: "o-p o-small", id: `${id}-note` });
  const setRanked = (on) => {
    note.textContent = on ? t("가입은 없다. 이 브라우저에만 남고, 상대와 순위표에 이 이름이 보인다.") : t("가입은 없다. 이 브라우저에만 남고, 상대에게 이 이름이 보인다.");
  };
  setRanked(ranked);
  const form = h(
    "form",
    { class: "pname" },
    h("div", { class: "pname-head" }, h("h2", { class: "pname-title", id: `${id}-title` }, t("이름 바꾸기")), h("span", { class: "pname-limit" }, t("{n}자까지", { n: NAME_MAX }))),
    h("div", { class: "pname-field" }, input, wipe),
    h("div", { class: "pname-act" }, again, save),
    note,
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!cleanName(input.value)) {
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    const name = setMyName(input.value);
    show(name);
    close();
    if (onChange) onChange(name);
  });
  input.addEventListener("input", () => input.removeAttribute("aria-invalid"));

  const pop = h("div", { class: "ppop", id, role: "dialog", "aria-labelledby": `${id}-title`, hidden: true });
  const wrap = h("span", { class: "pchip-wrap" + (align === "end" ? " end" : "") }, chip, pop);
  let open = false;
  let sheet = false;

  function show(name) {
    nameEl.textContent = name;
    fillFace(face, { kind: "human", name });
  }

  function openIt() {
    if (open) return;
    open = true;
    sheet = narrow();
    input.value = myName();
    input.removeAttribute("aria-invalid");
    if (sheet) {
      // 아래 시트: 화면 전체를 덮는 자리(.o-sheet-wrap)에 어두운 뒤판과 함께
      pop.className = "o-sheet-wrap pname-sheet";
      pop.setAttribute("aria-modal", "true");
      pop.replaceChildren(h("div", { class: "o-scrim", onclick: () => close() }), h("div", { class: "o-sheet" }, form));
    } else {
      pop.className = "ppop";
      pop.removeAttribute("aria-modal");
      pop.replaceChildren(form);
    }
    pop.hidden = false;
    chip.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onOutside, true);
    input.focus();
    input.select();
  }

  function close(back = true) {
    if (!open) return;
    open = false;
    pop.hidden = true;
    chip.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onOutside, true);
    if (back) chip.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  // 팝오버 바깥을 누르면 닫는다(시트는 어두운 뒤판이 받는다)
  function onOutside(e) {
    if (sheet || wrap.contains(e.target)) return;
    close(false);
  }

  chip.addEventListener("click", () => (open ? close() : openIt()));

  return {
    el: wrap,
    open: openIt,
    /** 다른 곳에서 이름이 바뀌었으면 맞춘다 */
    refresh: () => show(myName()),
    /** 순위표가 생기면 안내 글에 '순위표에도 보인다'를 쓴다 */
    setRanked,
    destroy() {
      close(false);
    },
  };
}
