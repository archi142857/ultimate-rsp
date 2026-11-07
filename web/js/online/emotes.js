// 이모트(온라인 규약 1.4): 서버는 id 8개만 주고받고, 그림과 글은 화면이 정한다.
// 그림은 web/icons/emotes/<id>.svg(디자인 시안 ③, Fluent MIT). 그림을 못 읽으면 이모지가 나온다.

import { h } from "../ui/dom.js";
import { t } from "../i18n.js";
import { EMOTES } from "./protocol.js";

/** 그림을 바꾸면 올린다(배포 판 도장은 스크립트·스타일 주소에만 붙는다) */
const ICON_VERSION = 1;

const LOOK = {
  hi: { emoji: "👋", label: () => t("안녕") },
  gg: { emoji: "🤝", label: () => t("잘했어") },
  good: { emoji: "👍", label: () => t("좋아") },
  wow: { emoji: "😮", label: () => t("와") },
  lol: { emoji: "😂", label: () => t("웃겨") },
  hmm: { emoji: "🤔", label: () => t("흠") },
  oops: { emoji: "😅", label: () => t("앗") },
  cry: { emoji: "😭", label: () => t("엉엉") },
};

export const emoteIds = () => EMOTES.filter((id) => LOOK[id]);
export const isEmote = (id) => typeof id === "string" && !!LOOK[id] && EMOTES.includes(id);
export const emoteEmoji = (id) => (LOOK[id] ? LOOK[id].emoji : "");
export const emoteLabel = (id) => (LOOK[id] ? LOOK[id].label() : id);

export function emoteUrl(id) {
  return new URL(`../../icons/emotes/${id}.svg?v=${ICON_VERSION}`, import.meta.url).href;
}

/** 이모트 그림(꾸밈. 뜻은 둘레의 aria-label 이 말한다) */
export function emoteIcon(id, cls = "emote-img") {
  const box = h("span", { class: cls, "aria-hidden": "true" });
  if (!LOOK[id]) return box;
  const img = h("img", { src: emoteUrl(id), alt: "", draggable: "false", decoding: "async" });
  img.addEventListener("error", () => box.replaceChildren(LOOK[id].emoji));
  box.append(img);
  return box;
}

/**
 * 이모트 여덟 개 줄. onPick(id). 2초에 한 번만 보낼 수 있어(규약) 보낸 뒤 줄을 잠깐 흐리게 한다(rest).
 * selectable 이면 고르기 칸(도전장에 같이 보낼 이모트, 다시 누르면 고름을 푼다)
 */
export function emoteRow({ onPick, label = t("이모트"), selectable = false } = {}) {
  let picked = null;
  const buttons = emoteIds().map((id) =>
    h(
      "button",
      {
        type: "button",
        class: "emote",
        title: emoteLabel(id),
        "aria-label": emoteLabel(id),
        "aria-pressed": selectable ? "false" : undefined,
        "data-e": id,
        onclick: () => {
          if (selectable) set(picked === id ? null : id);
          if (onPick) onPick(selectable ? picked : id);
        },
      },
      emoteIcon(id),
    ),
  );
  const el = h("div", { class: "emote-row", role: "group", "aria-label": label }, buttons);
  function set(id) {
    picked = id;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.e === id)));
  }
  let timer = 0;
  return {
    el,
    get picked() {
      return picked;
    },
    set,
    /** 잠깐 못 누르게(흐리게) */
    rest(ms) {
      el.classList.add("resting");
      buttons.forEach((b) => (b.disabled = true));
      clearTimeout(timer);
      timer = setTimeout(() => {
        el.classList.remove("resting");
        buttons.forEach((b) => (b.disabled = el.classList.contains("off")));
      }, ms);
    },
    /** 아예 못 쓴다(구경꾼, 끊김) */
    off(on) {
      el.classList.toggle("off", on);
      buttons.forEach((b) => (b.disabled = on || el.classList.contains("resting")));
    },
  };
}
