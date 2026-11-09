// 도전장 만들기(디자인 시안 ③ 2–3번). 세 단계:
//  1. #/c/new        변종 고르기(랜덤 매칭 목록과 같은 모양). 누르면 2단계로
//  2. #/c/new?v=게임  손 고르기 + 같이 보낼 이모트(안 골라도 된다) + 받을 사람(한 명·여럿이) → '링크 만들기'
//  3. #/c/번호        서버가 번호를 주면 그 도전장 화면이 '도전장이 준비됐다'(3/3)로 보인다(challenge.js)
// 내 손은 서버와 이 브라우저(mine.js)에만 남는다. 링크에는 번호만 들어간다.

import { h, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { compileVariant } from "../core/engine.js";
import { handGrid, segmented } from "../ui/widgets.js";
import { setting, setSetting } from "../ui/store.js";
import { topBar, bigTitle, variantRow, handRing } from "./common.js";
import { noticeSlot } from "./notice.js";
import { emoteRow } from "./emotes.js";
import { challengeGames, challengeGame } from "./games.js";
import { myName, playerId, meFields } from "./identity.js";
import { createChallenge } from "./api.js";
import { rememberChallenge, markFresh } from "./mine.js";
import { noticeFor } from "./messages.js";

/** 받을 사람 수: 1(보통 도전장)과 여럿이(서버는 2–50) */
const MAXES = [1, 5, 10, 50];

const compiled = new Map();
const variant = (entry) => {
  if (!compiled.has(entry.id)) compiled.set(entry.id, compileVariant(entry));
  return compiled.get(entry.id);
};

export function newChallengeView(main, params = {}) {
  const entry = params.v ? challengeGame(params.v) : null;
  return entry ? handStep(main, entry) : gameStep(main);
}

// ── 1단계: 변종 고르기 ─────────────────
function gameStep(main) {
  setTitle(t("도전장 만들기"));
  const last = setting("online.game", "classic");
  const list = h(
    "div",
    { class: "var-list" },
    challengeGames().map((e) => variantRow(variant(e), { href: `#/c/new?v=${encodeURIComponent(e.id)}`, on: e.id === last })),
  );
  main.append(
    h(
      "div",
      { class: "online" },
      topBar({ href: "#/play", label: t("온라인") }, stepText(1)).el,
      bigTitle(t("게임 고르기")),
      h("p", { class: "o-p" }, t("손을 숨겨 링크로 보냅니다. 한 사람이나 여럿이 받을 수 있습니다.")),
      list,
    ),
  );
  return {};
}

// ── 2단계: 손과 이모트 고르기 ─────────────────
function handStep(main, entry) {
  setTitle(t("도전장 만들기"));
  setSetting("online.game", entry.id);
  const ctl = new AbortController();
  const V = variant(entry);
  const notices = noticeSlot();
  let picked = null;

  const send = h("button", { type: "button", class: "btn btn-ink btn-big", disabled: true }, t("링크 만들기"));
  const ring = handRing(V, { pickable: true, onPick: (i) => choose(i, "ring") });
  // 손이 많으면 고리를 누르기 어렵다. 그때는 지금의 손 단추로 고른다
  const grid = V.n > 7 ? handGrid(V, { onPick: (i) => choose(i, "grid") }) : null;
  const emotes = emoteRow({ selectable: true, label: t("같이 보낼 이모트") });
  // 받을 사람(규약 2.1 max): 한 명이면 처음 답한 사람과, 여럿이면 그 수까지 답마다 따로 겨룬다(11-08 사용자)
  let max = [setting("online.challengeMax", 1), 1].find((n) => MAXES.includes(n));
  const maxSeg = segmented({
    label: t("받을 사람"),
    value: String(max),
    options: MAXES.map((n) => ({ id: String(n), name: n === 1 ? t("한 명") : t("@seats:{n}명", { n }) })),
    onChange: (id) => {
      max = Number(id);
      setSetting("online.challengeMax", max);
      maxNote.textContent = maxText();
    },
  });
  // 여럿이면 결과는 마감 때 연다(reveal "end": 버리는 이름으로 먼저 답해 손을 엿보지 못하게)
  const maxText = () => (max > 1 ? t("{n}명까지 답할 수 있고, 답마다 따로 겨룹니다. 결과는 {n}명이 다 답하거나, 직접 마감하거나, 하루가 지나면 한꺼번에 공개됩니다.", { n: max }) : t("처음 답한 한 사람과 겨룹니다."));
  const maxNote = h("p", { class: "o-p o-small" }, maxText());

  function choose(i, from) {
    picked = i;
    if (from !== "ring") ring.set(i);
    if (grid)
      grid.buttons.forEach((b, k) => {
        b.classList.toggle("picked", k === i);
        b.setAttribute("aria-pressed", String(k === i));
      });
    send.disabled = false;
  }
  if (grid) grid.buttons.forEach((b) => b.setAttribute("aria-pressed", "false"));

  send.addEventListener("click", async () => {
    if (picked === null || send.disabled) return;
    const hand = V.hands[picked].id;
    send.disabled = true;
    notices.set("wait", { title: t("도전장을 만드는 중…"), spin: true });
    try {
      const e = emotes.picked || undefined;
      const { code } = await createChallenge({ game: entry.id, hands: [hand], ...meFields(), pid: playerId(), e, max }, { signal: ctl.signal });
      rememberChallenge({ id: code, role: "maker", game: entry.id, hand, at: Date.now(), max, n: max > 1 ? 0 : undefined });
      markFresh(code);
      location.hash = `#/c/${code}`;
    } catch (err) {
      if (ctl.signal.aborted) return;
      notices.clear("wait");
      const n = noticeFor(err.code);
      notices.set(n.kind, n);
      send.disabled = false;
    }
  });

  main.append(
    h(
      "div",
      { class: "online" },
      notices.el,
      topBar({ href: "#/c/new", label: t("도전장 만들기") }, stepText(2)).el,
      variantRow(V, { right: h("a", { class: "o-link", href: "#/c/new" }, t("바꾸기")) }),
      h("h1", { class: "o-h2" }, t("손 고르기")),
      h("div", { class: "hand-ring-box" }, ring.el),
      h("p", { class: "o-p o-center" }, t("고른 손은 상대에게 보이지 않습니다. 화살표는 이기는 손에서 지는 손으로 갑니다.")),
      grid ? grid.el : null,
      h("p", { class: "o-label" }, t("같이 보낼 이모트(선택)")),
      emotes.el,
      h("div", { class: "o-card o-kv-card" }, maxSeg.el, maxNote),
      h("div", { class: "o-actions o-bottom" }, send),
      h("p", { class: "o-p o-small o-center" }, t("보내는 이름: {name}", { name: myName() }), " · ", h("a", { href: "#/play?name=1" }, t("이름 바꾸기"))),
    ),
  );

  return {
    onKey: (e) => (grid ? grid.keyHandler(e) : false),
    destroy() {
      ctl.abort();
      notices.destroy();
    },
  };
}

function stepText(n) {
  return h("span", {}, h("b", {}, String(n)), "/3");
}
