// 하나빼기 화면.

import { h, clear, frac } from "../ui/dom.js";
import { t, lower, listWords } from "../i18n.js";
import { handArt } from "../ui/art.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createMinusOne, keepGame, pairGame } from "../games/minusone.js";
import { stage, chant, fastToggle, block, selectBox, recordLine, rpsChant } from "../ui/widgets.js";
import { handVars } from "../ui/colors.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, stepList, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

export function minusOneView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  const PG = pairGame(V);
  let botKind = "calc";
  let game = createMinusOne(V);
  let busy = false;
  let picks = [null, null];
  const wins = [0, 0];

  const st = stage();
  const score = scoreboard();
  const steps = stepList([t("두 손으로 가위바위보를 낸다"), t("서로 두 손을 보고 '하나 빼기!'에 맞춰 한 손을 거둔다"), t("남은 손끼리 겨룬다. 비기면 1번부터")]);
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("minusone")));
  const doneBar = h("div", { class: "done-bar", hidden: true });

  // 1단계: 두 손 고르기
  const rows = [t("왼손"), t("오른손")].map((label, side) => {
    const btns = V.hands.map((hd) =>
      h(
        "button",
        {
          type: "button",
          class: "hand",
          vars: handVars(V, hd.i),
          "aria-pressed": "false",
          onclick: () => {
            picks[side] = hd.i;
            btns.forEach((b, k) => {
              b.classList.toggle("picked", k === hd.i);
              b.setAttribute("aria-pressed", String(k === hd.i));
            });
            throwBtn.disabled = picks[0] === null || picks[1] === null;
          },
        },
        handArt(hd, "hand-emoji"),
        h("span", { class: "hand-name" }, hd.name),
      ),
    );
    return { label, btns, el: h("div", { class: "pair-row" }, h("span", {}, label), h("div", { class: "hands hands-compact", role: "group", "aria-label": label }, btns)) };
  });
  const throwBtn = h("button", { class: "btn btn-ink", type: "button", disabled: true, onclick: () => throwTwo() }, t("두 손 내기"));
  const twoBox = h("div", {}, rows.map((r) => r.el), h("div", { class: "btn-row", style: { marginTop: "10px" } }, throwBtn));

  // 2단계: 남길 손 고르기
  const pairsView = h("div", { class: "pairs-view" });
  const keepBtns = h("div", { class: "keep-grid" });
  const calcBox = h("div", { class: "note", hidden: true });
  const calcToggle = h("label", { class: "check" }, h("input", { type: "checkbox", onchange: (e) => (calcBox.hidden = !e.target.checked) }), h("span", {}, t("계산 보기")));
  const oneBox = h("div", { hidden: true }, pairsView, h("p", { class: "field-label", style: { margin: "12px 0 8px" } }, t("남길 손")), keepBtns, calcToggle, calcBox);

  const botSel = selectBox({
    label: t("컴퓨터"),
    value: botKind,
    options: [
      { id: "calc", name: t("계산기") },
      { id: "random", name: t("주사위") },
    ],
    onChange: (v) => (botKind = v),
  });

  function botPair() {
    if (botKind === "random") return [rng.int(V.n), rng.int(V.n)];
    const p = PG.pairs[rng.weighted(PG.mix)];
    return rng.chance(0.5) ? [p[0], p[1]] : [p[1], p[0]];
  }

  function refresh() {
    steps.set(game.done ? 2 : game.phase === "two" ? 0 : 1);
    twoBox.hidden = game.phase !== "two" || game.done;
    oneBox.hidden = game.phase !== "one" || game.done;
    score.set(wins[0], wins[1], t("이긴 판"));
  }

  function resetPicks() {
    picks = [null, null];
    rows.forEach((r) => r.btns.forEach((b) => (b.classList.remove("picked"), b.setAttribute("aria-pressed", "false"))));
    throwBtn.disabled = true;
  }

  function newGame() {
    game = createMinusOne(V);
    busy = false;
    doneBar.hidden = true;
    resetPicks();
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    st.say("");
    st.sub(t("두 손을 골라 같이 낸다. 같은 손 둘도 된다."));
    log.clear();
    refresh();
  }

  async function throwTwo() {
    if (busy || game.phase !== "two") return;
    busy = true;
    const mine = picks.slice();
    const theirs = botPair();
    await chant(st, rpsChant());
    game.two(mine, theirs);
    st.say(t("하나 빼기!"), "chant");
    st.sub(t("컴퓨터의 두 손을 보고 남길 손을 고른다."));
    clear(pairsView).append(pairLine(t("나"), mine), pairLine(t("컴퓨터"), theirs));
    clear(keepBtns).append(
      ...mine.map((x, side) =>
        h(
          "button",
          { type: "button", class: "hand", vars: handVars(V, x), onclick: () => keep(side) },
          handArt(V.hands[x], "hand-emoji"),
          h("span", { class: "hand-name" }, side === 0 ? t("왼손 {h} 남기기", { h: V.hands[x].name }) : t("오른손 {h} 남기기", { h: V.hands[x].name })),
        ),
      ),
    );
    const kg = keepGame(V, mine, theirs);
    clear(calcBox).append(
      h("b", {}, t("이 판의 계산: ")),
      t("{list}로 섞으면 컴퓨터가 무엇을 남기든 평균 {v}점. ", {
        list: listWords(kg.mix.map((p, side) => {
          const v = { h: lower(V.hands[mine[side]].name), p: frac(p) };
          return side === 0 ? t("왼손({h}) {p}", v) : t("오른손({h}) {p}", v);
        })),
        v: signed(kg.value),
      }),
      kg.value > 1e-9 ? t("이 판은 내가 유리하다.") : kg.value < -1e-9 ? t("이 판은 컴퓨터가 유리하다.") : t("어느 쪽도 유리하지 않다."),
    );
    refresh();
    busy = false;
  }

  function pairLine(who, pair) {
    return h(
      "p",
      { class: "pair-line" },
      h("span", { class: "field-label" }, who),
      " ",
      pair.map((x) => h("span", { class: "pair-hand", vars: handVars(V, x), title: V.hands[x].name }, handArt(V.hands[x]))),
      h("span", { class: "sr" }, pair.map((x) => V.hands[x].name).join(", ")),
    );
  }

  async function keep(side) {
    if (busy || game.phase !== "one") return;
    busy = true;
    const theirs = game.pairs[1];
    let kb;
    if (botKind === "random") kb = rng.int(2);
    else {
      const theirGame = keepGame(V, theirs, game.pairs[0]);
      kb = rng.weighted(theirGame.mix);
    }
    st.me.set(V, null);
    st.op.set(V, null);
    await chant(st, t("하나 빼기!").split(" "), 260);
    const r = game.one(side, kb);
    st.me.set(V, r.a);
    st.op.set(V, r.b);
    if (r.cmp === 0) {
      st.say(t("비겼다"));
      st.sub(t("처음부터 다시 두 손을 낸다."));
      log.add(t("나 {a}, 컴퓨터 {b}. 비겨서 다시.", { a: lower(V.hands[r.a].name), b: lower(V.hands[r.b].name) }));
      resetPicks();
    } else {
      const meWon = r.cmp > 0;
      st.say(meWon ? t("이겼다!") : t("졌다"), meWon ? "win" : "lose");
      st.me.mark(meWon ? "won" : "lost");
      st.op.mark(meWon ? "lost" : "won");
      st.sub(`${r.sentence}.`);
      log.add(t("나 {a}, 컴퓨터 {b}. {s}.", { a: lower(V.hands[r.a].name), b: lower(V.hands[r.b].name), s: r.sentence }), meWon ? "w" : "l");
      wins[meWon ? 0 : 1] += 1;
      rec.textContent = recordLine(addRecord("minusone", r.cmp));
      clear(doneBar).append(
        h("strong", {}, meWon ? t("하나빼기 승리") : t("하나빼기 패배")),
        h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")),
      );
      doneBar.hidden = false;
    }
    refresh();
    busy = false;
  }

  const pairFacts = PG.pairs
    .map((p, i) => ({ p, m: PG.mix[i] }))
    .filter((x) => x.m > 1e-9)
    .map((x) => `${V.hands[x.p[0]].name}+${V.hands[x.p[1]].name}`);
  const side = h(
    "div",
    { class: "side-panel" },
    block(t("하는 법"), steps.el),
    h(
      "p",
      { class: "note" },
      h("b", {}, t("같은 손 둘은 손해다. ")),
      t("두 손을 보고 고르는 2단계까지 끝까지 계산하면, 1단계에서는 서로 다른 두 손({pairs})을 같은 비율로 섞어 내야 가장 좋다. 같은 손 둘을 내면 상대가 그 손을 이기는 손을 남겨 버린다.", { pairs: pairFacts.join(", ") }),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("하나빼기 하기") },
    h("div", { class: "controls" }, botSel.el, fastToggle()),
    score.el,
    st.el,
    twoBox,
    oneBox,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return { destroy: () => (busy = true) };
}

function signed(v) {
  if (Math.abs(v) < 1e-9) return "0";
  return (v > 0 ? "+" : "−") + frac(Math.abs(v));
}
