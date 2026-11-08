// 한정 가위바위보 화면.

import { h, clear } from "../ui/dom.js";
import { t, lower } from "../i18n.js";
import { handArt } from "../ui/art.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createLimited, createLimitedSolver } from "../games/limited.js";
import { handGrid, stage, chant, fastToggle, block, selectBox, mixBar, recordLine, rpsChant } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

export function limitedView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  const solver = createLimitedSolver(V, { stars: 3 });
  let botKind = "calc";
  let game = createLimited(V);
  let busy = false;
  const wins = [0, 0, 0];

  const st = stage();
  const score = scoreboard();
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("limited")));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const grid = handGrid(V, { onPick: (i) => play(i), label: t("낼 카드") });
  const starRow = [0, 1].map(() => h("span", { class: "stars" }));
  const theirDeck = h("div", { class: "deck" });
  const leftLine = h("p", { class: "rec", style: { margin: "0 0 10px" } });
  const analysis = h("div", { class: "analysis" });

  const botSel = selectBox({
    label: t("컴퓨터"),
    value: botKind,
    options: [
      { id: "calc", name: t("계산기") },
      { id: "random", name: t("주사위") },
    ],
    onChange: (v) => (botKind = v),
  });

  function starText(n) {
    const total = 2 * game.stars0;
    return [h("span", {}, "★".repeat(Math.max(0, n))), h("span", { class: "gone" }, "★".repeat(Math.max(0, total - n)))];
  }

  function draw() {
    starRow.forEach((el, side) => {
      clear(el).append(...starText(game.stars[side]));
      el.setAttribute("aria-label", side === 0 ? t("내 별 {n}개", { n: game.stars[side] }) : t("컴퓨터 별 {n}개", { n: game.stars[side] }));
    });
    V.hands.forEach((hd) => grid.setCount(hd.i, game.hand[0][hd.i]));
    grid.setAllowed(game.allowed(0));
    clear(theirDeck).append(
      h("span", { class: "field-label" }, t("컴퓨터에게 남은 카드")),
      ...V.hands.map((hd) => h("span", {}, handArt(hd), " " + t("{h} {n}장", { h: hd.name, n: game.hand[1][hd.i] }))),
    );
    leftLine.textContent = game.done ? "" : t("남은 카드 {n}장씩. 카드를 다 쓰면 별이 많은 쪽이 이긴다.", { n: game.left() });
    score.set(wins[0], wins[1], wins[2] ? t("이긴 판, 비김 {n}", { n: wins[2] }) : t("이긴 판"));
    clear(analysis);
    if (!game.done) {
      const b = solver.best(game, 0);
      analysis.append(
        h("p", { class: "field-label", style: { margin: 0 } }, t("끝까지 내다본 지금 내 기댓값 (이기면 +1, 지면 −1)")),
        h("div", { class: "big-num" }, signed(b.value)),
        h("p", { class: "field-label", style: { margin: "6px 0 0" } }, t("계산기라면 이렇게 섞어 낸다")),
        mixBar(V, b.mix),
      );
    }
  }

  function newGame() {
    game = createLimited(V);
    busy = false;
    doneBar.hidden = true;
    grid.lock(false);
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    st.say("");
    st.sub(t("카드는 가위·바위·보 4장씩. 이기면 상대 별 하나를 가져온다."));
    log.clear();
    draw();
  }

  function botPick() {
    const allowed = game.allowed(1);
    if (botKind === "random") return rng.pick(V.hands.map((x) => x.i).filter((i) => allowed[i]));
    const b = solver.best(game, 1);
    return rng.weighted(b.mix);
  }

  async function play(i) {
    if (busy || game.done || !(game.hand[0][i] > 0)) return;
    busy = true;
    grid.lock(true);
    st.reset();
    const j = botPick();
    st.me.set(V, null);
    st.op.set(V, null);
    await chant(st, rpsChant());
    const r = game.play(i, j);
    st.me.set(V, i);
    st.op.set(V, j);
    if (r.cmp === 0) {
      st.say(t("비겼다"));
      st.sub(t("별은 그대로, 카드만 한 장씩 줄었다."));
      log.add(t("둘 다 {h}. 별 그대로.", { h: lower(V.hands[i].name) }));
    } else {
      const meWon = r.cmp > 0;
      st.say(meWon ? t("별 하나!") : t("별을 잃었다"), meWon ? "win" : "lose");
      st.me.mark(meWon ? "won" : "lost");
      st.op.mark(meWon ? "lost" : "won");
      st.sub(`${r.sentence}.`);
      log.add(t("{s}. 별 {a} 대 {b}.", { s: r.sentence, a: r.stars[0], b: r.stars[1] }), meWon ? "w" : "l");
    }
    if (game.done) {
      const w = game.winner;
      if (w === -1) wins[2] += 1;
      else wins[w] += 1;
      rec.textContent = recordLine(addRecord("limited", w === 0 ? 1 : w === 1 ? -1 : 0));
      clear(doneBar).append(
        h("strong", {}, w === 0 ? t("살아남았다") : w === 1 ? t("졌다") : t("별이 같다, 비김")),
        h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")),
      );
      doneBar.hidden = false;
    } else grid.lock(false);
    draw();
    busy = false;
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(
      t("카드를 세면 보인다"),
      h("p", {}, t("서로 남은 카드가 보이므로 판이 지날수록 상대가 낼 수 있는 손이 줄어든다. 마지막 한 장은 무엇인지 둘 다 안다.")),
      h("p", {}, t("계산기는 남은 카드와 별 수로 나올 수 있는 끝을 모두 따져 비율을 정한다. 처음에는 고르게 섞으면 되지만, 몇 판만 지나도 비율이 달라진다.")),
      analysis,
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("한정 가위바위보 하기") },
    h("div", { class: "controls" }, botSel.el, fastToggle()),
    score.el,
    h(
      "div",
      { class: "star-board" },
      h("div", {}, h("span", { class: "field-label" }, t("내 별 ")), starRow[0]),
      h("div", {}, h("span", { class: "field-label" }, t("컴퓨터 별 ")), starRow[1]),
    ),
    st.el,
    leftLine,
    grid.el,
    h("div", { style: { marginTop: "12px" } }, theirDeck),
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return { onKey: (e) => grid.keyHandler(e), destroy: () => (busy = true) };
}

function signed(v) {
  if (Math.abs(v) < 0.005) return "0.00";
  return (v > 0 ? "+" : "−") + Math.abs(v).toFixed(2);
}
