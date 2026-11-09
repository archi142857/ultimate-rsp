// 프로필 칩(디자인 시안2 ①): 둥근 알약에 그림 28px + 이름 + ✎. 누르면 프로필(이름과 그림)을 바꾼다.
// 넓은 화면은 칩 바로 아래 팝오버(꼭지가 칩을 가리킨다), 좁은 화면은 아래 시트(뒤는 어둡게).
// 그림은 게임 그림 가운데 고르고(face-picker.js), 고르지 않으면 이름에서 정한다(11-08 사용자: 이름과 그림을 따로).
// 열면 입력칸에 포커스. Enter·저장은 이름과 그림을 함께 남기고, Esc 나 바깥을 누르면 둘 다 그대로 둔다.
// 머리 오른쪽에 계정 알약(디자인 '로그인 칸 ③': 손님 '계정 · 로그인 ›', 로그인함 '✓ 계정 ›' → #/account).
// 로그인했으면 저장한 이름·그림을 계정에도 올린다(다른 기기에도 따라간다).

import { h } from "../ui/dom.js";
import { t } from "../i18n.js";
import { avatar, fillFace } from "./avatar.js";
import { myName, setMyName, randomName, cleanName, NAME_MAX, myFace, setMyFace, meWho } from "./identity.js";
import { facePicker } from "./face-picker.js";
import { signedIn, pushProfile, onAccount, knownMethods } from "./account.js";
import { accountPill } from "./account-view.js";

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
 * button: 칩 대신 이 글의 작은 단추로(계정 화면의 '이름 바꾸기')
 */
export function profileChip({ align = "start", ranked = false, onChange = null, button = null } = {}) {
  const id = `pname-${++seq}`;
  const face = avatar(meWho(), { size: 28, cls: "pchip-av" });
  const nameEl = h("span", { class: "pchip-name" }, myName());
  const chip = button
    ? h("button", { type: "button", class: "btn btn-sm pchip-btn", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": id }, button)
    : h(
        "button",
        { type: "button", class: "pchip", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": id },
        face,
        nameEl,
        h("span", { class: "pchip-pen", "aria-hidden": "true" }, "✎"),
        h("span", { class: "visually-hidden" }, ` · ${t("프로필 바꾸기")}`),
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
    "aria-labelledby": `${id}-name`,
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
  let rankedNow = ranked;
  // 아래 한 줄(디자인 ①⑨): 로그인할 수 있으면 어디에 남는지, 아니면(켜진 방법 없음) 지금처럼
  const setRanked = (on) => {
    rankedNow = on;
    const methods = knownMethods();
    if (signedIn()) note.textContent = t("로그인한 계정에 이름·그림·기록이 저장됩니다.");
    else if (methods && methods.length) note.textContent = t("로그인하지 않으면 이 브라우저에만 남습니다.");
    else note.textContent = on ? t("가입은 필요 없습니다. 이름과 그림은 이 브라우저에 저장되고, 상대와 순위표에 보입니다.") : t("가입은 필요 없습니다. 이름과 그림은 이 브라우저에 저장되고, 상대에게 보입니다.");
  };
  setRanked(ranked);
  // 계정 알약: 누르면 이 칸을 닫고 #/account 로
  const pill = accountPill({ onGo: () => close(false) });
  // 그림: 지금 입력한 이름으로 '자동' 칸을 그린다
  const typed = () => ({ kind: "human", name: cleanName(input.value) || myName() });
  const preview = avatar(meWho(), { size: 42, cls: "pname-preview" });
  const showPreview = () => fillFace(preview, { ...typed(), face: picker.value });
  const picker = facePicker({ value: myFace(), autoWho: typed, onPick: showPreview });
  const form = h(
    "form",
    { class: "pname" },
    h("div", { class: "pname-top" }, h("h2", { class: "pname-title", id: `${id}-title` }, t("프로필")), pill.el),
    h("div", { class: "pname-head" }, h("span", { class: "pname-label", id: `${id}-name` }, t("이름")), h("span", { class: "pname-limit" }, t("{n}자까지", { n: NAME_MAX }))),
    h("div", { class: "pname-name" }, preview, h("div", { class: "pname-field" }, input, wipe)),
    h("div", { class: "pname-head" }, h("span", { class: "pname-label" }, t("그림"))),
    h("div", { class: "pname-faces" }, picker.el),
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
    setMyFace(picker.value);
    show(name);
    close();
    if (onChange) onChange(name);
    // 로그인했으면 계정에도(다른 기기에도 따라가게). 끝난 토큰이면 account.js 가 로그아웃된 것으로 돌린다
    if (signedIn()) pushProfile().catch(() => {});
  });
  input.addEventListener("input", () => {
    input.removeAttribute("aria-invalid");
    picker.refreshAuto();
    showPreview();
  });

  const pop = h("div", { class: "ppop", id, role: "dialog", "aria-labelledby": `${id}-title`, hidden: true });
  const wrap = h("span", { class: "pchip-wrap" + (align === "end" ? " end" : "") }, chip, pop);
  let open = false;
  let sheet = false;

  function show(name) {
    nameEl.textContent = name;
    fillFace(face, meWho());
  }

  function openIt() {
    if (open) return;
    open = true;
    sheet = narrow();
    input.value = myName();
    input.removeAttribute("aria-invalid");
    picker.set(myFace());
    picker.refreshAuto();
    showPreview();
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
    picker.reveal();
    pill.draw();
    setRanked(rankedNow);
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

  // 로그인·로그아웃·새 손님·다른 기기에서 바꾼 이름이 오면 칩과 바깥(고리·순위표)을 맞춘다
  const offAccount = onAccount(() => {
    const name = myName();
    show(name);
    setRanked(rankedNow);
    if (onChange) onChange(name);
  });

  return {
    el: wrap,
    open: openIt,
    /** 다른 곳에서 이름이 바뀌었으면 맞춘다 */
    refresh: () => show(myName()),
    /** 순위표가 생기면 안내 글에 '순위표에도 보인다'를 쓴다 */
    setRanked,
    destroy() {
      close(false);
      offAccount();
      pill.destroy();
    },
  };
}
