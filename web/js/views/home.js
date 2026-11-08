// 첫 화면: 큰 제목과 바로 한 판, 고리 그림, 그리고 갈래별 도감.

import { h, clear, setTitle } from "../ui/dom.js";
import { t, lang } from "../i18n.js";
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
  majority: "📊",
  choki: "✂️",
  host: "🎙️",
  teamtag: "👫",
  teamsplit: "🤚",
  penney: "🪙",
  dice: "🎲",
  morra: "🖐️",
  blotto: "🪖",
  hammer: "🔨",
  donpappa: "🗣️",
  relay: "🏃",
  ecard: "👑",
  shogi: "♟️",
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
  majority: "많은 손·적은 손",
  choki: "가위가 유리",
  host: "진행자에게 지면 탈락",
  teamtag: "편끼리 쫓고 달아나기",
  teamsplit: "바위와 보로 편 나누기",
  penney: "나중에 고르는 쪽이 유리",
  dice: "고리를 도는 주사위",
  morra: "손가락 합 맞히기",
  blotto: "병사 나누기",
  hammer: "치기와 막기",
  donpappa: "먼저 외치기",
  relay: "달려가 만나면 겨루기",
  ecard: "카드 다섯 장",
  shogi: "3×4 판",
};

const compiled = new Map();
export function compiledOf(entry) {
  const key = `${lang()}:${entry.id}`;
  if (!compiled.has(key)) {
    compiled.set(key, entry.kind === "custom" ? compileVariant(makeCustomDef({ n: 11, seed: 3 })) : compileVariant(entry));
  }
  return compiled.get(key);
}

const HERO_RINGS = ["classic", "rpsls", "rps7", "rps9", "rps11", "rps15", "rps25", "rps101"];

export function homeView(main, { focus } = {}) {
  setTitle(null);
  const classic = compileVariant(findEntry("classic"));
  const rng = makeRng();
  const bot = createBot("human", classic, rng);
  const history = [];

  // 바로 한 판
  const out = h("p", { class: "quick-out", "aria-live": "polite" }, t("손을 고르면 컴퓨터도 같이 낸다."));
  const grid = handGrid(classic, {
    compact: true,
    label: t("가위바위보 한 판"),
    onPick(i) {
      const j = bot.pick({ history: history.map((r) => ({ me: r.op, op: r.me })) });
      history.push({ me: i, op: j });
      const c = classic.cmp(i, j);
      addRecord("classic", c);
      clear(out).append(
        h("strong", {}, RESULT_WORD[c]),
        t("나") + " ",
        handArt(classic.hands[i]),
        " " + t("컴퓨터") + " ",
        handArt(classic.hands[j]),
        `. ${c === 0 ? t("한 번 더?") : classic.sentence(i, j) + "."}`,
      );
    },
  });

  const hero = h(
    "section",
    { class: "hero", "aria-labelledby": "hero-title" },
    h(
      "div",
      { class: "hero-text" },
      h("h1", { class: "hero-title", id: "hero-title" }, h("span", {}, t("궁극의")), h("span", {}, t("가위바위보"))),
      h(
        "p",
        { class: "hero-lead" },
        t("가위바위보 {n}가지를 모았다. 누가 누구를 이기는지 고리 그림으로 보고, 컴퓨터나 친구와 바로 겨룬다.", { n: CATALOG.length }),
      ),
      h(
        "div",
        { class: "quick" },
        h("div", { class: "quick-head" }, h("h2", {}, t("바로 한 판")), h("a", { href: "#/v/classic" }, t("삼세판으로 하기"))),
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
      t("{name}. 손 {n}개가 저마다 {k}개를 이기고 {k}개에 진다. 손을 누르면 누구를 이기는지 보인다. ", { name: V.name, n: V.n, k }),
      h("a", { href: `#/v/${id}` }, t("이걸로 하기")),
    );
  }
  const seg = segmented({
    label: t("고리 크기"),
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
    art = createRing(V, { size: 96, mini: true, emoji: V.n <= 5, title: t("{name} 고리", { name: e.name }) }).el;
    meta = e.kind === "custom" ? t("손 3개부터 101개까지") : t("손 {n}개", { n: V.n }) + (V.balanced ? "" : t(", 고르지 않음"));
  } else {
    art = h("span", { class: "art-emoji", "aria-hidden": "true" }, ART[e.id] || "✊");
    meta = META[e.id] ? t(META[e.id]) : "";
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
