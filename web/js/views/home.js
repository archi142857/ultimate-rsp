// 첫 화면: 큰 제목과 바로 한 판, 고리 그림, 그리고 갈래별 도감.

import { h, clear, setTitle } from "../ui/dom.js";
import { handArt } from "../ui/art.js";
import { CATALOG, CATEGORIES, findEntry } from "../data/catalog.js";
import { compileVariant } from "../core/engine.js";
import { makeCustomDef } from "../data/custom.js";
import { createRing } from "../ui/ring.js";
import { handGrid, segmented, RESULT_WORD } from "../ui/widgets.js";
import { createBot } from "../core/bots.js";
import { makeRng } from "../core/rng.js";
import { addRecord } from "../ui/store.js";

const ART = {
  mukjjippa: "👊",
  acchimuite: "👉",
  minusone: "✌️",
  glico: "🪜",
  limited: "🃏",
  dynamitewb: "🧨",
  command: "⏱️",
  group: "👥",
  train: "🚂",
  evolution: "🐣",
  league: "🏆",
  lattice: "🦎",
  war: "⚔️",
};
const META = {
  mukjjippa: "공격과 수비",
  acchimuite: "가리키고 고개 돌리기",
  minusone: "두 손 내고 하나 빼기",
  glico: "계단 오르기",
  limited: "카드 세기",
  dynamitewb: "개수가 정해진 손",
  command: "30초 순발력",
  group: "직접 하기",
  train: "지켜보기",
  evolution: "지켜보기",
  league: "전략 9가지",
  lattice: "도마뱀과 대장균",
  war: "손 3~5가지",
};

const compiled = new Map();
export function compiledOf(entry) {
  if (!compiled.has(entry.id)) {
    compiled.set(entry.id, entry.kind === "custom" ? compileVariant(makeCustomDef({ n: 11, seed: 3 })) : compileVariant(entry));
  }
  return compiled.get(entry.id);
}

const HERO_RINGS = ["classic", "rpsls", "rps7", "rps9", "rps11", "rps15", "rps25", "rps101"];

export function homeView(main, { focus } = {}) {
  setTitle(null);
  const classic = compileVariant(findEntry("classic"));
  const rng = makeRng();
  const bot = createBot("human", classic, rng);
  const history = [];

  // 바로 한 판
  const out = h("p", { class: "quick-out", "aria-live": "polite" }, "손을 고르면 컴퓨터도 같이 낸다.");
  const grid = handGrid(classic, {
    compact: true,
    label: "가위바위보 한 판",
    onPick(i) {
      const j = bot.pick({ history: history.map((r) => ({ me: r.op, op: r.me })) });
      history.push({ me: i, op: j });
      const c = classic.cmp(i, j);
      addRecord("classic", c);
      clear(out).append(
        h("strong", {}, RESULT_WORD[c]),
        "나 ",
        handArt(classic.hands[i]),
        " 컴퓨터 ",
        handArt(classic.hands[j]),
        `. ${c === 0 ? "한 번 더?" : classic.sentence(i, j) + "."}`,
      );
    },
  });

  const hero = h(
    "section",
    { class: "hero", "aria-labelledby": "hero-title" },
    h(
      "div",
      { class: "hero-text" },
      h("h1", { class: "hero-title", id: "hero-title" }, h("span", {}, "궁극의"), h("span", {}, "가위바위보")),
      h(
        "p",
        { class: "hero-lead" },
        `가위바위보 ${CATALOG.length}가지를 모았다. 누가 누구를 이기는지 고리 그림으로 보고, 컴퓨터와 바로 겨룬다.`,
      ),
      h(
        "div",
        { class: "quick" },
        h("div", { class: "quick-head" }, h("h2", {}, "바로 한 판"), h("a", { href: "#/v/classic" }, "삼세판으로 하기")),
        grid.el,
        out,
      ),
    ),
    heroRing(),
  );

  const cats = CATEGORIES.map((cat) =>
    h(
      "section",
      { class: "cat", id: `cat-${cat.id}`, "aria-labelledby": `cat-${cat.id}-t` },
      h("div", { class: "cat-head" }, h("h2", { class: "cat-title", id: `cat-${cat.id}-t` }, cat.title), h("p", { class: "cat-blurb" }, cat.blurb)),
      h(
        "ul",
        { class: "tiles" },
        CATALOG.filter((e) => e.cat === cat.id).map((e) => h("li", {}, tile(e))),
      ),
    ),
  );

  main.append(hero, ...cats);
  if (focus) {
    const el = document.getElementById(`cat-${focus}`);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
  }

  return {
    keepScroll: !!focus,
    onKey: (e) => grid.keyHandler(e),
  };
}

function heroRing() {
  const box = h("div", { class: "ring-box" });
  const cap = h("p", { class: "hero-cap" });
  let current = null;
  function show(id) {
    const entry = findEntry(id);
    const V = compiledOf(entry);
    const ring = createRing(V, { size: 440 });
    clear(box).append(ring.el);
    current = id;
    const k = (V.n - 1) / 2;
    clear(cap).append(
      `${V.name}. 손 ${V.n}개, 저마다 ${k}개를 이기고 ${k}개에 진다. 손을 짚으면 누구를 이기는지 보인다. `,
      h("a", { href: `#/v/${id}` }, "이 판 하기"),
    );
  }
  const seg = segmented({
    label: "고리 크기",
    small: true,
    value: "rps15",
    options: HERO_RINGS.map((id) => ({ id, name: String(compiledOf(findEntry(id)).n) })),
    onChange: (id) => id !== current && show(id),
  });
  show("rps15");
  return h("div", { class: "hero-ring" }, box, seg.el, cap);
}

function tile(e) {
  let art;
  let meta;
  if (e.kind === "matrix" || e.kind === "custom") {
    const V = compiledOf(e);
    art = createRing(V, { size: 96, mini: true, emoji: V.n <= 5, title: `${e.name} 고리` }).el;
    meta = e.kind === "custom" ? "손 3개부터 101개까지" : `손 ${V.n}개` + (V.balanced ? "" : ", 고르지 않음");
  } else {
    art = h("span", { class: "art-emoji", "aria-hidden": "true" }, ART[e.id] || "✊");
    meta = META[e.id] || "";
  }
  return h(
    "a",
    { class: "tile", href: `#/v/${e.id}` },
    h("span", { class: "tile-art" }, art),
    h(
      "span",
      {},
      h("span", { class: "tile-name" }, e.name),
      h("span", { class: "tile-sub" }, e.sub || e.origin),
      h("span", { class: "tile-meta" }, meta),
    ),
  );
}
