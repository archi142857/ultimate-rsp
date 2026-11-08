// 항목 화면의 머리와 본문 틀.

import { h } from "../ui/dom.js";
import { t } from "../i18n.js";
import { handArt } from "../ui/art.js";
import { inSentence } from "../core/engine.js";
import { block, paragraphs, sourcesList } from "../ui/widgets.js";

export function entryHead(entry, { facts = [], title = entry.name, sub = entry.sub } = {}) {
  return h(
    "header",
    { class: "entry-head" },
    h("a", { class: "back", href: entry.cat === "sim" ? "#/sims" : "#/" }, entry.cat === "sim" ? t("시뮬레이션") : t("도감")),
    h("h1", { class: "entry-title" }, title),
    h("p", { class: "entry-sub" }, sub || null, h("span", { class: "origin" }, entry.origin)),
    facts.length
      ? h(
          "dl",
          { class: "facts" },
          facts.map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, v))),
        )
      : null,
  );
}

export function entryBody(entry, ...extra) {
  return h(
    "div",
    { class: "entry-body" },
    block(t("소개"), paragraphs(entry.about)),
    ...extra,
    entry.sources && entry.sources.length ? block(t("출처"), sourcesList(entry.sources)) : null,
  );
}

/** 점수판: 나 n : m 상대 */
export function scoreboard({ meLabel = t("나"), opLabel = t("컴퓨터") } = {}) {
  const me = h("span", { class: "score-num" }, "0");
  const op = h("span", { class: "score-num" }, "0");
  const mid = h("span", { class: "score-mid" });
  const meWho = h("span", { class: "score-who" }, meLabel);
  const opWho = h("span", { class: "score-who" }, opLabel);
  const el = h(
    "div",
    { class: "score", role: "group", "aria-label": t("점수") },
    h("div", { class: "score-side" }, meWho, me),
    mid,
    h("div", { class: "score-side" }, opWho, op),
  );
  return {
    el,
    set(a, b, note = "") {
      me.textContent = String(a);
      op.textContent = String(b);
      mid.textContent = note;
      el.setAttribute("aria-label", t("점수: 나 {a}, 상대 {b}", { a, b }));
    },
    labels(a, b) {
      meWho.textContent = a;
      opWho.textContent = b;
    },
  };
}

export function histItem(V, a, b, cmp) {
  const cls = cmp > 0 ? "w" : cmp < 0 ? "l" : "d";
  const word = cmp > 0 ? t("승") : cmp < 0 ? t("패") : t("무");
  const said = cmp > 0 ? t("@sr:승") : cmp < 0 ? t("@sr:패") : t("@sr:무");
  return h(
    "li",
    { class: cls, title: V.sentence(a, b) },
    h("span", { class: "pair", "aria-hidden": "true" }, handArt(V.hands[a]), handArt(V.hands[b])),
    h("span", { class: "sr" }, t("나 {a}, 상대 {b}, {r}", { a: inSentence(V.hands[a]), b: inSentence(V.hands[b]), r: said })),
    h("b", { "aria-hidden": "true" }, word),
  );
}
