// 황제와 노예(E카드) 화면. 황제 쪽은 황제 1장·시민 4장, 노예 쪽은 노예 1장·시민 4장. 한 장씩 같이 낸다.
// 12판, 3판마다 쪽을 바꾼다. 노예 쪽으로 이기면 4점, 황제 쪽으로 이기면 1점.

import { h, clear } from "../ui/dom.js";
import { handArt } from "../ui/art.js";
import { t } from "../i18n.js";
import { makeRng } from "../core/rng.js";
import { createEcard, ecardPick, ecardNames, ECARD_EMOJI, ECARDS } from "../games/ecard.js";
import { stage, chant, fastToggle, block, recordLine, countChant } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, stepList, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

// 카드 그림(사용자 11-06: 보이는 이모지는 Fluent 그림으로). 그림이 없으면 이모지로 돌아간다
const CARD_ART = {
  emperor: { id: "king", emoji: ECARD_EMOJI.emperor },
  citizen: { id: "human", emoji: ECARD_EMOJI.citizen },
  slave: { id: "chain", emoji: ECARD_EMOJI.slave },
};

export function ecardView(main, entry) {
  const rng = makeRng();
  let game = null;
  let busy = false;

  const score = scoreboard();
  const st = stage();
  const sideLine = h("p", { class: "note", style: { margin: "0 0 14px" }, "aria-live": "polite" });
  const steps = stepList([t("카드를 한 장씩 같이 냄"), t("시민끼리 만나면 남은 카드로 계속 냄"), t("황제나 노예가 나오면 그 판 끝")]);
  const hand = h("div", { class: "ecards", role: "group", "aria-label": t("내 카드") });
  const opHand = h("div", { class: "ecards op", "aria-label": t("컴퓨터 카드") });
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("ecard")));
  const doneBar = h("div", { class: "done-bar", hidden: true });

  const N = () => ecardNames();
  const cardEl = (c, cls = "") => h("span", { class: `ecard ecard-${c}${cls ? ` ${cls}` : ""}`, "aria-hidden": "true" }, h("span", { class: "ecard-face" }, handArt(CARD_ART[c])), h("span", { class: "ecard-name" }, N()[c]));

  function draw() {
    const g = game;
    const mine = g.sides[0];
    clear(hand).append(
      ...ECARDS.filter((c) => g.hand[0][c] > 0 || (c === "citizen" && !g.done)).map((c) => {
        const n = g.hand[0][c];
        return h(
          "button",
          { type: "button", class: "ecard-btn", disabled: busy || g.done || n === 0, "aria-label": t("{c} 내기, {n}장 남음", { c: N()[c], n }), onclick: () => play(c) },
          cardEl(c),
          h("b", { class: "ecard-count" }, `×${n}`),
        );
      }),
    );
    const left = g.left(1);
    clear(opHand).append(...Array.from({ length: left }, () => h("span", { class: "ecard ecard-back", "aria-hidden": "true" })));
    opHand.setAttribute("aria-label", t("컴퓨터 카드 {n}장", { n: left }));
    sideLine.textContent = g.done
      ? t("{n}판 끝", { n: g.rounds })
      : t("{r}/{n}판, 나는 {side}. 노예 쪽 승리 {s}점, 황제 쪽 승리 {e}점", {
          r: g.round + 1,
          n: g.rounds,
          side: mine === "emperor" ? N().emperorSide : N().slaveSide,
          s: g.slavePoints,
          e: g.emperorPoints,
        });
    score.set(g.score[0], g.score[1], t("점수"));
  }

  function newGame() {
    game = createEcard();
    busy = false;
    doneBar.hidden = true;
    log.clear();
    st.reset();
    st.me.set(null, null);
    st.op.set(null, null);
    st.say("");
    st.sub(t("낼 카드 고르기"));
    steps.set(0);
    draw();
  }

  async function play(c) {
    if (busy || game.done) return;
    const g = game;
    busy = true;
    draw();
    st.reset();
    st.me.set(null, null);
    st.op.set(null, null);
    await chant(st, countChant());
    if (game !== g) return;
    const oc = ecardPick(g, 1, rng);
    const sides = g.sides.slice();
    const r = g.play(c, oc);
    st.me.art(CARD_ART[c], N()[c]);
    st.op.art(CARD_ART[oc], N()[oc]);
    if (r.cmp === 0) {
      st.say(t("시민끼리 비김. 계속"));
      st.sub(t("남은 카드로 다시 내기"));
      steps.set(1);
    } else {
      const w = r.roundWinner;
      (w === 0 ? st.op : st.me).mark("lost");
      st.say(w === 0 ? t("이 판은 내가 승리. +{n}점", { n: r.points }) : t("이 판은 컴퓨터가 승리. +{n}점", { n: r.points }), w === 0 ? "win" : "lose");
      const line = t("{r}판 {t}번째: {a} 대 {b}", { r: r.round + 1, t: r.turn, a: N()[c], b: N()[oc] });
      log.add(`${line} ${w === 0 ? t("내가 +{n}점", { n: r.points }) : t("컴퓨터가 +{n}점", { n: r.points })}`, w === 0 ? "w" : "l");
      const swapped = !g.done && g.sides[0] !== sides[0];
      st.sub(swapped ? t("쪽 바꿈. 이제 나는 {side}", { side: g.sides[0] === "emperor" ? N().emperorSide : N().slaveSide }) : "");
      steps.set(2);
    }
    if (g.done) {
      const won = g.winner === 0;
      const tie = g.winner === -1;
      st.say(tie ? t("무승부") : won ? t("승리!") : t("패배"), tie ? "" : won ? "win" : "lose");
      rec.textContent = recordLine(addRecord("ecard", tie ? 0 : won ? 1 : -1));
      clear(doneBar).append(
        h("strong", {}, t("{a} 대 {b}", { a: g.score[0], b: g.score[1] })),
        h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")),
      );
      doneBar.hidden = false;
    }
    busy = false;
    draw();
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(t("하는 법"), steps.el),
    h(
      "p",
      { class: "note" },
      h("b", {}, t("결국 몇 번째에 내느냐의 문제입니다. ")),
      t("황제·노예를 몇 번째에 낼지 둘이 몰래 고르는 셈입니다. 둘 다 낼 차례를 고르게 정하면 노예 쪽은 다섯 판에 한 번 이깁니다. 그래서 노예 쪽 승리를 4점, 황제 쪽 승리를 1점으로 하면 기대 점수가 같습니다."),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("{name} 하기", { name: entry.name }) },
    h("div", { class: "controls" }, fastToggle()),
    score.el,
    sideLine,
    opHand,
    st.el,
    hand,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return {
    onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey || busy || game.done) return false;
      const order = ["1", "2", "3"];
      const k = order.indexOf(e.key);
      const btns = [...hand.querySelectorAll("button:not([disabled])")];
      if (k >= 0 && btns[k]) {
        btns[k].click();
        return true;
      }
      return false;
    },
    destroy: () => (busy = true),
  };
}
