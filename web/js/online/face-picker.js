// 프로필 그림 고르기(11-08 사용자: "프로필 사진은 우리가 가지고 있는 그림 중에 선택할 수 있도록").
// 게임 그림(web/art) 가운데 하나를 고른다. 맨 앞 '자동'은 지금처럼 이름에서 정한 그림(이름 끝 동물, 없으면 첫 글자).
// 묶음: 동물 · 사람 · 손 · 그 밖. 피·변기처럼 얼굴로 쓰기 어색한 그림은 뺀다.
// 키보드: 라디오 묶음처럼 고른 칸 하나만 Tab 으로 들어가고, 화살표로 옮기며 고른다.

import { h } from "../ui/dom.js";
import { t } from "../i18n.js";
import { artUrl } from "../ui/art.js";
import { CATALOG } from "../data/catalog.js";
import { ART_FILES } from "../data/art-files.js";
import { NICK_ART } from "../i18n/nicknames.js";
import { avatar, fillFace } from "./avatar.js";

const ANIMALS = [
  ...NICK_ART,
  "bird",
  "duck",
  "chicken",
  "fish",
  "frog",
  "lizard",
  "elephant",
  "porcupine",
  "spider",
  "ant",
  "slug",
  "worm",
  "vulture",
  "cockroach",
];
const PEOPLE = [
  "human",
  "man",
  "woman",
  "baby",
  "mother",
  "king",
  "queen",
  "prince",
  "princess",
  "ninja",
  "hunter",
  "headman",
  "police",
  "robot",
  "alien",
  "vampire",
  "medusa",
  "spock",
  "watonai",
  "devil",
  "satan",
  "death",
];
const HANDS = ["hand-rock", "hand-scissors", "hand-paper"];
const SKIP = new Set(["blood", "toilet"]);

/** 묶음별 그림 이름. 그림 목록에 없는 이름은 뺀다 */
export function faceGroups() {
  const has = (id) => ART_FILES.has(id) && !SKIP.has(id);
  const taken = new Set([...ANIMALS, ...PEOPLE, ...HANDS]);
  const rest = [...ART_FILES.keys()].filter((id) => has(id) && !taken.has(id)).sort();
  return [
    { label: t("@group:동물"), ids: ANIMALS.filter(has) },
    { label: t("@group:사람"), ids: PEOPLE.filter(has) },
    { label: t("@group:손"), ids: HANDS.filter(has) },
    { label: t("@group:그 밖"), ids: rest },
  ].filter((g) => g.ids.length);
}

let names = null;
/** 그림 이름 → 그 그림을 쓰는 손 이름(지금 언어). 없으면 그림 이름 그대로 */
function artName(id) {
  if (!names) {
    names = new Map();
    for (const v of CATALOG) for (const x of v.hands || []) if (!names.has(x.art || x.id)) names.set(x.art || x.id, x.name);
  }
  return names.get(id) || id;
}

/**
 * 고르기 칸. value: 그림 이름 | null(자동). autoWho(): 자동일 때 그릴 사람 꼴(지금 입력한 이름)
 * onPick(id|null) 은 고를 때마다. 돌려주는 값: { el, get value(), set(id), refreshAuto() }
 */
export function facePicker({ value = null, autoWho, onPick = null } = {}) {
  names = null; // 언어가 바뀌었을 수 있다
  let current = value;
  const cells = [];
  const autoFace = avatar({ ...autoWho(), face: null }, { size: 30, cls: "fp-auto-av" });
  const autoCell = h("button", { type: "button", class: "fp-cell fp-auto", role: "radio", "data-id": "", title: t("자동: 이름에 맞춘 그림"), "aria-label": t("자동: 이름에 맞춘 그림") }, autoFace);
  cells.push({ id: null, el: autoCell });
  const body = [h("div", { class: "fp-row" }, autoCell, h("span", { class: "fp-auto-text" }, t("자동")), h("span", { class: "fp-auto-note" }, t("이름 끝 동물이나 첫 글자")))];
  for (const g of faceGroups()) {
    body.push(h("p", { class: "fp-group", "aria-hidden": "true" }, g.label));
    body.push(
      h(
        "div",
        { class: "fp-grid" },
        g.ids.map((id) => {
          const name = artName(id);
          const el = h(
            "button",
            { type: "button", class: "fp-cell", role: "radio", "data-id": id, title: name, "aria-label": name },
            h("img", { src: artUrl({ id }), alt: "", loading: "lazy", decoding: "async", draggable: "false" }),
          );
          cells.push({ id, el });
          return el;
        }),
      ),
    );
  }
  const el = h("div", { class: "fp", role: "radiogroup", "aria-label": t("그림") }, body);

  function set(id, { focus = false } = {}) {
    current = id && ART_FILES.has(id) ? id : null;
    for (const c of cells) {
      const on = c.id === current;
      c.el.setAttribute("aria-checked", String(on));
      c.el.tabIndex = on ? 0 : -1;
      if (on && focus) c.el.focus();
    }
  }

  el.addEventListener("click", (e) => {
    const b = e.target.closest(".fp-cell");
    if (!b) return;
    set(b.dataset.id || null);
    if (onPick) onPick(current);
  });

  // 화살표: 칸 사이를 옮기며 고른다. 위·아래는 같은 줄 폭만큼
  el.addEventListener("keydown", (e) => {
    const k = cells.findIndex((c) => c.el === document.activeElement);
    if (k < 0) return;
    const grid = cells[k].el.parentElement;
    const cols = cells[k].id === null ? 1 : Math.max(1, Math.round(grid.clientWidth / cells[k].el.offsetWidth));
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    let next = null;
    if (step) next = Math.max(0, Math.min(cells.length - 1, k + step));
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = cells.length - 1;
    if (next === null) return;
    e.preventDefault();
    set(cells[next].id, { focus: true });
    cells[next].el.scrollIntoView({ block: "nearest" });
    if (onPick) onPick(current);
  });

  set(current);
  return {
    el,
    get value() {
      return current;
    },
    set,
    /** 이름을 고치는 중이면 '자동' 칸 그림도 따라 바꾼다 */
    refreshAuto() {
      fillFace(autoFace, { ...autoWho(), face: null });
    },
    /** 고른 칸이 보이게(감싼 스크롤 상자 안에서만 옮긴다) */
    reveal() {
      const c = cells.find((x) => x.id === current);
      const box = el.parentElement;
      if (!c || !c.id || !box) return;
      const r = c.el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      box.scrollTop += r.top - b.top - (b.height - r.height) / 2;
    },
  };
}
