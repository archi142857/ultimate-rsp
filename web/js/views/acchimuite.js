// 아치무이테호이 화면.

import { h, clear } from "../ui/dom.js";
import { compileVariant } from "../core/engine.js";
import { createBot } from "../core/bots.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createAcchimuite, DIRS } from "../games/acchimuite.js";
import { handGrid, stage, chant, fastToggle, block, recordLine } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, stepList, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

export function acchimuiteView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  const bot = createBot("human", V, rng);
  const throws = [];
  const myDirs = [];
  let game = createAcchimuite(V);
  let busy = false;
  const wins = [0, 0];

  const st = stage();
  const score = scoreboard();
  const steps = stepList(["가위바위보", "이긴 쪽이 가리키고, 진 쪽이 같은 순간 고개를 돌린다", "가리킨 쪽을 보면 진다. 아니면 1번부터"]);
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("acchimuite")));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const grid = handGrid(V, { onPick: (i) => janken(i) });
  const dirLabel = h("p", { class: "field-label", style: { textAlign: "center", margin: "0 0 8px" } });
  const dirBtns = DIRS.map((d, k) =>
    h(
      "button",
      { type: "button", class: "dir", "data-d": d.id, onclick: () => hoi(k), "aria-label": d.name },
      h("span", { class: "arrow", "aria-hidden": "true" }, d.arrow),
      h("span", {}, d.name),
    ),
  );
  const dirBox = h("div", { hidden: true }, dirLabel, h("div", { class: "dirs" }, dirBtns));

  function refresh() {
    steps.set(game.done ? 2 : game.phase === "janken" ? 0 : 1);
    const hoiPhase = game.phase === "hoi" && !game.done;
    grid.el.hidden = hoiPhase;
    dirBox.hidden = !hoiPhase;
    if (hoiPhase) dirLabel.textContent = game.pointer === 0 ? "어디를 가리킬까" : "어디로 고개를 돌릴까";
    st.me.tag(game.pointer === 0 ? "가리키기" : game.pointer === 1 ? "고개 돌리기" : "");
    st.op.tag(game.pointer === 1 ? "가리키기" : game.pointer === 0 ? "고개 돌리기" : "");
    score.set(wins[0], wins[1], "이긴 판");
  }

  function newGame() {
    game = createAcchimuite(V);
    busy = false;
    doneBar.hidden = true;
    grid.lock(false);
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    st.say("");
    st.sub("가위바위보부터.");
    log.clear();
    refresh();
  }

  async function janken(i) {
    if (busy || game.done || game.phase !== "janken") return;
    busy = true;
    grid.lock(true);
    st.reset();
    const j = bot.pick({ history: throws });
    st.me.set(V, null);
    st.op.set(V, null);
    await chant(st, ["가위!", "바위!", "보!"]);
    const r = game.janken(i, j);
    throws.push({ me: j, op: i });
    st.me.set(V, i);
    st.op.set(V, j);
    if (r.cmp === 0) {
      st.say("비겼다");
      st.sub("다시 가위바위보.");
      log.add(`가위바위보: 둘 다 ${V.hands[i].name}.`);
    } else {
      st.say(game.pointer === 0 ? "내가 가리킨다" : "컴퓨터가 가리킨다", game.pointer === 0 ? "win" : "lose");
      st.sub(game.pointer === 0 ? "컴퓨터가 고개를 돌릴 쪽을 맞혀라." : "컴퓨터가 가리킬 쪽을 피해라.");
      log.add(`가위바위보: ${V.sentence(i, j)}.`);
    }
    grid.lock(false);
    refresh();
    busy = false;
  }

  async function hoi(k) {
    if (busy || game.done || game.phase !== "hoi") return;
    busy = true;
    const j = botDir();
    const pointer = game.pointer;
    await chant(st, ["아치", "무이테", "호이!"], 230);
    const r = game.hoi(k, j);
    myDirs.push(k);
    const meD = DIRS[k];
    const opD = DIRS[j];
    st.me.text(meD.arrow, meD.name);
    st.op.text(opD.arrow, opD.name);
    if (r.hit) {
      const meWon = game.winner === 0;
      st.say(meWon ? "이겼다!" : "졌다", meWon ? "win" : "lose");
      st.sub(pointer === 0 ? `${meD.name}을 가리켰는데 컴퓨터가 그쪽을 봤다.` : `컴퓨터가 ${opD.name}을 가리켰고 나도 그쪽을 봤다.`);
      log.add(`호이! 둘 다 ${meD.name}. ${meWon ? "내가" : "컴퓨터가"} 이겼다.`, meWon ? "w" : "l");
      wins[game.winner] += 1;
      rec.textContent = recordLine(addRecord("acchimuite", meWon ? 1 : -1));
      clear(doneBar).append(
        h("strong", {}, meWon ? "아치무이테호이 승리" : "아치무이테호이 패배"),
        h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, "한 판 더"),
      );
      doneBar.hidden = false;
    } else {
      st.say("빗나갔다");
      st.sub("다시 가위바위보부터.");
      log.add(`호이! 나 ${meD.name}, 컴퓨터 ${opD.name}. 빗나갔다.`);
    }
    refresh();
    busy = false;
  }

  // 컴퓨터 방향: 내가 자주 고른 방향을 조금 노린다(가리킬 때) / 피한다(고개 돌릴 때)
  function botDir() {
    const counts = [1, 1, 1, 1];
    myDirs.slice(-12).forEach((d) => (counts[d] += 1));
    if (rng.chance(0.5)) return rng.int(4);
    if (game.pointer === 1) return counts.indexOf(Math.max(...counts));
    const least = counts.indexOf(Math.min(...counts));
    return rng.chance(0.5) ? least : rng.int(4);
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block("차례", steps.el),
    h(
      "p",
      { class: "note" },
      h("b", {}, "가리키는 쪽이 이길 확률은 한 번에 1/4. "),
      "그래서 가위바위보를 여러 번 이겨야 끝나는 경우가 많다. 교토 기온의 술자리 놀이에서 비롯됐다는 이야기가 있다.",
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": "아치무이테호이 하기" },
    h("div", { class: "controls" }, fastToggle()),
    score.el,
    st.el,
    grid.el,
    dirBox,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  const keyDir = { ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3 };
  return {
    onKey(e) {
      if (game.phase === "hoi" && keyDir[e.key] !== undefined) {
        hoi(keyDir[e.key]);
        return true;
      }
      return game.phase === "janken" ? grid.keyHandler(e) : false;
    },
    destroy: () => (busy = true),
  };
}
