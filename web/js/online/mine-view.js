// '내 도전장' 줄(첫 화면 도전장 칸은 최근 3개, #/c/mine 은 이 브라우저가 기억하는 것 모두).
// 결과는 사람이 열어 본 것만 안다(폴링하지 않는다). 열어 보기 전이면 만든 쪽은 '기다리는 중', 받은 쪽은 '받음'.

import { h, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { topBar, bigTitle } from "./common.js";
import { myChallenges } from "./mine.js";
import { challengeGame } from "./games.js";

function chipOf(r) {
  // 여럿이 받는 내 도전장은 마지막으로 열어 본 답 수
  if (r.role === "maker" && r.max) return h("span", { class: "chip" }, Number.isInteger(r.n) ? t("답 {n}/{max}", { n: r.n, max: r.max }) : t("기다리는 중"));
  if (r.result === 1) return h("span", { class: "chip ok" }, t("@chip:승리"));
  if (r.result === -1) return h("span", { class: "chip no" }, t("@chip:패배"));
  if (r.result === 0) return h("span", { class: "chip" }, t("@chip:무승부"));
  return h("span", { class: "chip" }, r.role === "maker" ? t("기다리는 중") : t("받음"));
}

/** 도전장 목록(ul). 없으면 null */
export function mineRows(list) {
  if (!list.length) return null;
  return h(
    "ul",
    { class: "mine-list" },
    list.map((r) => {
      const e = challengeGame(r.game);
      const game = r.label || (e ? e.name : r.game);
      const who = r.role === "maker" && r.max ? t("{n}명까지", { n: r.max }) : r.vs || r.id;
      return h("li", {}, h("a", { href: `#/c/${encodeURIComponent(r.id)}` }, h("span", { class: "mine-what" }, `${game} · ${who}`), chipOf(r)));
    }),
  );
}

/** #/c/mine: 이 브라우저가 만들거나 답한 도전장 모두 */
export function myChallengesView(main) {
  setTitle(t("@list:내 도전장"));
  const rows = mineRows(myChallenges());
  main.append(
    h(
      "div",
      { class: "online" },
      topBar({ href: "#/play", label: t("온라인") }).el,
      bigTitle(t("@list:내 도전장")),
      rows ? h("section", { class: "o-card" }, rows) : h("p", { class: "o-p" }, t("아직 만들거나 받은 도전장 없음")),
      h("div", { class: "o-actions" }, h("a", { class: "btn btn-ink btn-big", href: "#/c/new" }, t("도전장 쓰기"))),
      h("p", { class: "o-p o-small" }, t("이 목록은 이 브라우저에만 저장됩니다. 결과는 도전장을 열어야 보입니다.")),
    ),
  );
  return {};
}
