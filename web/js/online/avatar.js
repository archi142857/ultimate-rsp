// 사람 그림(시안 ③ 고리): 이름 끝 동물(여우 → art/fox.svg), 컴퓨터는 로봇, 빈자리는 점선 동그라미.
// 동물이 없는 이름(사용자가 직접 지은 이름)은 첫 글자를 쓴다. 같은 동물 둘보다 글자가 더 잘 갈린다.

import { h } from "../ui/dom.js";
import { artUrl, hasArt } from "../ui/art.js";
import { NICK_ART, NICK_WORDS } from "../i18n/nicknames.js";

const WORDS = new Map(); // 낱말(소문자) → 그림 이름
for (const words of Object.values(NICK_WORDS)) words.noun.forEach((w, k) => WORDS.set(w.toLowerCase(), NICK_ART[k]));
WORDS.set("kitten", "cat");

/** 이름에 든 마지막 동물 낱말의 그림 이름. 없으면 null */
export function animalOf(name) {
  const words = String(name || "")
    .toLowerCase()
    .split(/[\s_.,·()-]+/u)
    .filter(Boolean);
  for (let k = words.length - 1; k >= 0; k--) {
    const a = WORDS.get(words[k]);
    if (a) return a;
  }
  return null;
}

/** 첫 글자 한 덩어리(한글 한 자, 이모지 하나). 라틴 글자는 대문자로 */
export function initialOf(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  let first = [...s][0];
  try {
    for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)) {
      first = segment;
      break;
    }
  } catch {
    /* Segmenter 가 없는 브라우저 */
  }
  return first.toUpperCase();
}

/** 자리(또는 { kind, name })의 그림 열쇠: { art } 이거나 { text } */
export function faceOf(who) {
  if (!who || who.kind === "empty") return { text: "" };
  if (who.kind === "bot") return { art: "robot" };
  const a = animalOf(who.name);
  return a ? { art: a } : { text: initialOf(who.name) };
}

/** 그림 동그라미. size 는 px. 그림을 못 읽으면 첫 글자로 */
export function avatar(who, { size = 44, cls = "" } = {}) {
  const el = h("span", { class: "av" + (cls ? ` ${cls}` : ""), "aria-hidden": "true", vars: { "--av": `${size}px` } });
  fillFace(el, who);
  return el;
}

/** 이미 있는 자리에 그림을 넣는다(고리의 사람 동그라미) */
export function fillFace(el, who) {
  const f = faceOf(who);
  if (f.art && hasArt({ id: f.art })) {
    const img = h("img", { src: artUrl({ id: f.art }), alt: "", draggable: "false", decoding: "async" });
    img.addEventListener("error", () => el.replaceChildren(h("span", { class: "av-text" }, initialOf(who && who.name))));
    el.replaceChildren(img);
  } else {
    el.replaceChildren(f.text ? h("span", { class: "av-text" }, f.text) : "");
  }
  return el;
}
