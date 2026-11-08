// 뿅망치 가위바위보 화면. 가위바위보에 이기면 '치기', 지면 '막기'를 컴퓨터보다 먼저 누른다.

import { h, clear } from "../ui/dom.js";
import { t } from "../i18n.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createHammer, STRIKE_MS } from "../games/hammer.js";
import { reactionMs, REACTION_LEVELS } from "../games/reaction.js";
import { handGrid, stage, chant, fastToggle, block, segmented, recordLine, rpsChant } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, stepList, logList, pressPad } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

const TARGET = 3;
const HAMMER = "🔨";
const HELMET = "⛑️";

/** 초 단위로(소수 둘째 자리) */
export const secs = (ms) => (ms / 1000).toFixed(2);

/** 컴퓨터 빠르기 고르기(뿅망치·돈파파·편 술래잡기) */
export function speedSeg(value, onChange, label = t("컴퓨터 빠르기")) {
  return segmented({
    label,
    small: true,
    value,
    options: [
      { id: "easy", name: t("느림") },
      { id: "normal", name: t("보통") },
      { id: "hard", name: t("빠름") },
    ],
    onChange,
  });
}

export function hammerView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  let level = "normal";
  let game = null;
  let busy = false;

  const score = scoreboard();
  const st = stage();
  const steps = stepList([t("가위바위보"), t("이긴 쪽은 치기, 진 쪽은 막기를 누른다"), t("막기 전에 치면 1점, 먼저 3점을 내면 이긴다")]);
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("hammer")));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const grid = handGrid(V, { onPick: (i) => janken(i) });
  const pad = pressPad(t("치기"));
  pad.el.hidden = true;
  const lSeg = speedSeg(level, (v) => (level = v));

  function newGame() {
    pad.cancel();
    game = createHammer(V, { target: TARGET });
    busy = false;
    doneBar.hidden = true;
    pad.el.hidden = true;
    grid.el.hidden = false;
    grid.lock(false);
    log.clear();
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    st.say("");
    st.sub(t("가위바위보부터 한다. 이기면 치고, 지면 막는다."));
    score.set(0, 0, t("먼저 {n}점", { n: TARGET }));
    steps.set(0);
  }

  async function janken(i) {
    if (busy || game.done || game.phase !== "janken") return;
    busy = true;
    grid.lock(true);
    const g = game;
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    st.sub("");
    await chant(st, rpsChant());
    if (game !== g) return;
    const j = rng.int(V.n);
    const r = g.janken(i, j);
    st.me.set(V, i);
    st.op.set(V, j);
    if (r.cmp === 0) {
      st.say(t("비겼다. 다시"));
      grid.lock(false);
      busy = false;
      return;
    }
    await strike(g, r.cmp > 0);
  }

  async function strike(g, iHit) {
    steps.set(1);
    grid.el.hidden = true;
    pad.set(iHit ? t("치기") : t("막기"));
    pad.el.classList.toggle("hot", iHit);
    pad.el.hidden = false;
    st.say(iHit ? t("쳐라!") : t("막아라!"), iHit ? "win" : "lose");
    st.sub(iHit ? t("컴퓨터가 헬멧을 쓰기 전에") : t("뿅망치가 닿기 전에"));
    st.me.text(iHit ? HAMMER : HELMET, iHit ? t("치기") : t("막기"));
    st.op.text(iHit ? HELMET : HAMMER, iHit ? t("막기") : t("치기"));
    const comp = reactionMs(rng, level);
    let cue = 0;
    const mine = await pad.wait(STRIKE_MS, {
      onStart() {
        // 컴퓨터가 누르는 순간을 보여 준다. 컴퓨터가 치면 그 뒤에 막아도 늦어서 바로 끝낸다
        cue = setTimeout(() => {
          if (iHit) st.op.text(HELMET, t("헬멧!"));
          else {
            st.op.text(HAMMER, t("쾅!"));
            pad.cancel();
          }
        }, comp);
      },
    });
    clearTimeout(cue);
    if (game !== g) return;
    pad.el.hidden = true;
    const r = iHit ? g.strike(mine, comp) : g.strike(comp, mine);
    const shown = (ms) => (Number.isFinite(ms) && ms <= STRIKE_MS ? t("{s}초", { s: secs(ms) }) : t("안 눌렀다"));
    st.sub(t("나 {a}, 컴퓨터 {b}", { a: shown(mine), b: shown(comp) }));
    let say;
    let tone = "";
    if (r.result === "hit") {
      say = iHit ? t("맞혔다! 1점") : t("맞았다");
      tone = iHit ? "win" : "lose";
      (iHit ? st.op : st.me).mark("lost");
    } else if (r.result === "blocked") {
      say = iHit ? t("막혔다") : t("막았다!");
      tone = iHit ? "" : "win";
    } else say = iHit ? t("헛쳤다") : t("컴퓨터가 헛쳤다");
    st.say(say, tone);
    const said = { res: say, a: shown(mine), b: shown(comp) };
    log.add(iHit ? t("내가 쳤다: {res} (나 {a}, 컴퓨터 {b})", said) : t("컴퓨터가 쳤다: {res} (나 {a}, 컴퓨터 {b})", said), r.result === "hit" ? (iHit ? "w" : "l") : "");
    score.set(g.score[0], g.score[1], t("먼저 {n}점", { n: TARGET }));
    if (g.done) {
      const won = g.winner === 0;
      st.say(won ? t("이겼다!") : t("졌다"), won ? "win" : "lose");
      rec.textContent = recordLine(addRecord("hammer", won ? 1 : -1));
      clear(doneBar).append(
        h("strong", {}, won ? t("내가 먼저 {n}점을 냈다", { n: TARGET }) : t("컴퓨터가 먼저 {n}점을 냈다", { n: TARGET })),
        h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")),
      );
      doneBar.hidden = false;
      steps.set(2);
    } else {
      steps.set(0);
      grid.el.hidden = false;
      grid.lock(false);
    }
    busy = false;
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(t("하는 법"), steps.el),
    h(
      "p",
      { class: "note" },
      h("b", {}, t("이긴 쪽도 서둘러야 한다. ")),
      t("{s}초 안에 치지 않으면 헛친 것이다. 막기가 치기보다 먼저거나 동시면 막은 것이다. 컴퓨터는 빠르기에 따라 평균 {a}·{b}·{c}초에 누른다.", {
        s: secs(STRIKE_MS),
        a: secs(REACTION_LEVELS.easy),
        b: secs(REACTION_LEVELS.normal),
        c: secs(REACTION_LEVELS.hard),
      }),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("{name} 하기", { name: entry.name }) },
    h("div", { class: "controls" }, lSeg.el, fastToggle()),
    score.el,
    st.el,
    grid.el,
    pad.el,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return {
    onKey: (e) => pad.key(e) || (!grid.el.hidden ? grid.keyHandler(e) : false),
    destroy() {
      busy = true;
      pad.cancel();
    },
  };
}
