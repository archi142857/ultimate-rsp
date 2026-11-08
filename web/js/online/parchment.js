// 양피지 도전장(디자인 시안2 ①). 조각 그림은 web/icons/parchment/(디자인 세션의 parchment.py).
//   짜임: 위 막대 / 종이 / 아래 막대. 막대는 종이보다 18px 넓고(양쪽 9px), 종이는 위아래로 10px 씩 막대 밑에 들어간다.
//   보내기: 0–450ms 종이가 위에서 아래로 펼쳐지고 아래 막대가 같이 내려온다 → 450ms 밀랍이 떨어져 오른쪽 아래에 찍힌다
//           → 800ms 두루마리가 살짝 쿵.
//   받기:   말린 채 가운데에 봉인이 살랑인다. 봉인(단추)을 누르면 0–400ms 두 쪽으로 갈라져 떨어지고 250–700ms 펼쳐진다.
// 움직임 줄이기면 끝 모습만: 보내기는 펼쳐지고 찍힌 채, 받기는 봉인 없이 펼친 채.
// 어두운 화면에서도 양피지 색은 그대로다(종이 안의 글자·손 고리도 밝은 화면 색을 쓴다. online.css .parch-sheet).

import { h, reducedMotion } from "../ui/dom.js";
import { t } from "../i18n.js";

// 그림을 바꾸면 올린다(캐시)
const PARCH_VERSION = 1;
export const parchUrl = (name) => new URL(`../../icons/parchment/${name}.svg?v=${PARCH_VERSION}`, import.meta.url).href;

// 그림 크기(viewBox). 그림을 읽기 전에도 자리를 잡게 width·height 를 단다
const SIZE = { roll: [200, 24], seal: [64, 64], "seal-left": [64, 64], "seal-right": [64, 64], parchment: [160, 128] };
const img = (name, cls) =>
  h("img", { class: cls, src: parchUrl(name), alt: "", draggable: "false", decoding: "async", width: SIZE[name][0], height: SIZE[name][1] });

/** 첫 화면 도전장 칸의 한 장 그림(160×128) */
export function parchmentArt(cls = "") {
  const el = img("parchment", "parch-art" + (cls ? ` ${cls}` : ""));
  el.setAttribute("aria-hidden", "true");
  return el;
}

const SEND_MS = 1050;
const OPEN_MS = 720;

/**
 * 두루마리. mode "send"(내가 보낸 것, 오른쪽 아래에 밀랍) | "recv"(받은 것, 봉인을 뜯어야 펼쳐진다)
 * children 은 종이 안에 들어간다. 그린 뒤(화면에 붙인 뒤) start() 를 부른다.
 *   send: start({ play }) — play 면 펼치기·도장 움직임, 아니면 끝 모습
 *   recv: start() — 말린 채로(움직임 줄이기면 바로 펼친 채). 펼쳐지면 onOpen(키보드로 뜯었나)
 */
export function scroll({ mode = "send", children = [], onOpen = null, label = "" } = {}) {
  const sheet = h("div", { class: "parch-sheet" }, ...children);
  const whole = img("seal", "parch-seal-art parch-whole");
  const sealKids = [whole];
  if (mode === "recv") sealKids.push(img("seal-left", "parch-seal-art parch-half parch-half-l"), img("seal-right", "parch-seal-art parch-half parch-half-r"));
  const seal =
    mode === "recv"
      ? h("button", { type: "button", class: "parch-seal", "aria-label": t("봉인 뜯기") }, ...sealKids)
      : h("span", { class: "parch-seal", "aria-hidden": "true" }, ...sealKids);
  const el = h(
    "div",
    { class: `parch ${mode}`, role: label ? "group" : undefined, "aria-label": label || undefined },
    img("roll", "parch-roll parch-roll-top"),
    sheet,
    img("roll", "parch-roll parch-roll-bot"),
    seal,
  );
  let opened = mode === "send";
  let timer = 0;

  // 아래 막대가 내려오는 거리는 종이 높이로 정한다(종이 안 글의 양에 따라 다르다)
  const measure = () => el.style.setProperty("--h", `${sheet.offsetHeight}px`);

  function replay(cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // 같은 움직임을 다시 시작하게
    el.classList.add(cls);
  }

  function open() {
    if (opened) return;
    opened = true;
    // 키보드로 뜯었으면(봉인 단추에 포커스가 있었으면) 펼친 뒤 포커스를 옮길 수 있게 알린다
    const byKey = document.activeElement === seal && seal.matches(":focus-visible");
    el.classList.remove("rolled");
    sheet.inert = false;
    if (reducedMotion()) {
      seal.remove();
      el.classList.add("opened");
      if (onOpen) onOpen(byKey);
      return;
    }
    measure();
    replay("opening");
    seal.disabled = true;
    timer = setTimeout(() => {
      seal.remove();
      el.classList.remove("opening");
      el.classList.add("opened");
      if (onOpen) onOpen(byKey);
    }, OPEN_MS);
  }

  if (mode === "recv") seal.addEventListener("click", open);

  return {
    el,
    sheet,
    get opened() {
      return opened;
    },
    start({ play = true } = {}) {
      if (mode === "send") {
        if (!play || reducedMotion()) return;
        measure();
        replay("play");
        clearTimeout(timer);
        timer = setTimeout(() => el.classList.remove("play"), SEND_MS);
        return;
      }
      if (reducedMotion()) {
        open();
        return;
      }
      // 말려 있는 동안 종이 안(손 고리)은 누를 수 없게
      el.classList.add("rolled");
      sheet.inert = true;
    },
    open,
    destroy() {
      clearTimeout(timer);
    },
  };
}
