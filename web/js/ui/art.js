// 손(포지션) 그림을 찍는 곳은 모두 여기를 거친다.
// 그림 이름은 손의 art(없으면 id). web/art/<그림 이름>.svg 가 ART_FILES 목록에 있으면 그 그림을,
// 없으면 이모지를 넣는다. 목록은 `node scripts/art_list.mjs` 로 다시 만든다.
// 그림은 Microsoft Fluent 이모지(MIT)를 64×64 에 감싼 것이라 색이 그대로다. <img> 로 넣는다.

import { ART_FILES } from "../data/art-files.js";
import { h, s } from "./dom.js";

export const artKey = (hand) => hand.art || hand.id;
export const hasArt = (hand) => !!hand && ART_FILES.has(artKey(hand));

/** 그림 주소. 내용이 바뀌면 ?v= 가 바뀌어 캐시를 깬다 */
export function artUrl(hand) {
  const key = artKey(hand);
  return new URL(`../../art/${key}.svg?v=${ART_FILES.get(key)}`, import.meta.url).href;
}

/** 글 사이나 버튼에 넣는 손 그림(span). 이모지 한 글자 자리에 맞춘다 */
export function handArt(hand, cls = "") {
  const el = h("span", { class: "art" + (cls ? ` ${cls}` : ""), "aria-hidden": "true" });
  if (!hasArt(hand)) {
    el.textContent = hand.emoji || "";
    return el;
  }
  el.classList.add("art-svg");
  const img = h("img", { src: artUrl(hand), alt: "", draggable: "false", decoding: "async" });
  // 그림을 못 읽으면 이모지로 돌아간다
  img.addEventListener("error", () => {
    el.classList.remove("art-svg");
    el.textContent = hand.emoji || "";
  });
  el.append(img);
  return el;
}

/** 이미 있는 자리(판 결과의 큰 손 등)의 그림을 바꾼다. hand 가 없으면 비운다 */
export function setArt(box, hand, cls = "") {
  box.replaceChildren(hand ? handArt(hand, cls) : "");
}

/** SVG(고리) 안에 놓는 손 그림. 가운데가 (0,0), 한 변이 size */
export function ringArt(hand, size) {
  if (!hasArt(hand)) {
    return s(
      "text",
      { class: "emo", "text-anchor": "middle", "dominant-baseline": "central", "font-size": (size * 0.72).toFixed(1), y: 1 },
      hand.emoji || "",
    );
  }
  const half = (size / 2).toFixed(2);
  return s("image", { class: "art-g", href: artUrl(hand), x: `-${half}`, y: `-${half}`, width: size.toFixed(2), height: size.toFixed(2) });
}

const bitmaps = new Map(); // 그림 이름 → Image

/** 캔버스에 그릴 손 그림. 읽혔으면 Image, 아직이면 null(그동안은 이모지를 그린다) */
export function artBitmap(hand) {
  if (!hasArt(hand)) return null;
  const key = artKey(hand);
  let img = bitmaps.get(key);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = artUrl(hand);
    bitmaps.set(key, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}
