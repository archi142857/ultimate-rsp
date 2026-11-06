// 묵찌빠 화면.

import { h, clear } from "../ui/dom.js";
import { compileVariant } from "../core/engine.js";
import { createBot } from "../core/bots.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createMukjjippa, CALL } from "../games/mukjjippa.js";
import { handGrid, selectBox, stage, chant, fastToggle, block } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, stepList, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";
import { recordLine } from "../ui/widgets.js";

const BOT_CHOICES = [
  { id: "random", name: "주사위" },
  { id: "human", name: "사람 흉내" },
  { id: "pattern", name: "수 읽기" },
];

export function mukjjippaView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  let botId = "pattern";
  let bot = createBot(botId, V, rng);
  const throws = []; // 봇 쪽에서 본 { me, op }
  let game = createMukjjippa(V);
  let busy = false;
  const wins = [0, 0];

  const st = stage();
  const score = scoreboard();
  const steps = stepList(["가위바위보로 공격을 정한다", "공격이 외치며 손을 바꾸고, 수비도 같이 바꾼다", "같은 손이 나오면 공격이 이긴다"]);
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("mukjjippa")));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const grid = handGrid(V, { onPick: (i) => play(i) });
  const callNames = V.hands.map((x) => `${CALL[x.id]}! (${x.name})`);

  const botSel = selectBox({
    label: "컴퓨터 전략",
    value: botId,
    options: BOT_CHOICES,
    onChange(id) {
      botId = id;
      bot = createBot(id, V, rng);
    },
  });

  function roleText() {
    if (game.phase === "rps") return "가위바위보! 이기는 쪽이 공격이 된다.";
    return game.attacker === 0
      ? "내가 공격. 외칠 손을 고르자. 컴퓨터가 같은 손을 내면 내가 이긴다."
      : "컴퓨터가 공격. 같은 손을 내면 진다. 다른 손으로 이기면 공격을 빼앗는다.";
  }

  function refresh() {
    steps.set(game.done ? 2 : game.phase === "rps" ? 0 : 1);
    st.me.tag(game.attacker === 0 ? "공격" : game.attacker === 1 ? "수비" : "");
    st.op.tag(game.attacker === 1 ? "공격" : game.attacker === 0 ? "수비" : "");
    grid.setNames(game.phase === "attack" ? callNames : null);
    score.set(wins[0], wins[1], "이긴 판");
  }

  function newGame() {
    game = createMukjjippa(V);
    busy = false;
    grid.lock(false);
    doneBar.hidden = true;
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    st.say("");
    st.sub(roleText());
    log.clear();
    refresh();
  }

  function botPick() {
    const g = bot.pick({ history: throws });
    // 봇이 공격이면 '내가 낼 것 같은 손'을 같이 내야 이긴다: 봇이 고른 손이 이기는 손이 곧 짐작한 내 손
    if (game.phase === "attack" && game.attacker === 1) {
      const target = V.beats(g)[0];
      return target === undefined ? g : target;
    }
    return g;
  }

  async function play(i) {
    if (busy || game.done) return;
    busy = true;
    grid.lock(true);
    st.reset();
    const j = botPick();
    const phase = game.phase;
    const attacker = game.attacker;
    st.me.set(V, null);
    st.op.set(V, null);
    await chant(st, phase === "rps" ? ["가위!", "바위!", "보!"] : ["묵!", "찌!", "빠!"]);
    const r = game.play(i, j);
    throws.push({ me: j, op: i });
    st.me.set(V, i, phase === "attack" && attacker === 0 ? `${CALL[V.hands[i].id]}!` : "");
    st.op.set(V, j, phase === "attack" && attacker === 1 ? `${CALL[V.hands[j].id]}!` : "");
    let line;
    if (r.note === "again") {
      st.say("비겼다");
      line = `가위바위보: 둘 다 ${V.hands[i].name}. 다시.`;
    } else if (r.note === "start") {
      st.say(game.attacker === 0 ? "내가 공격" : "컴퓨터 공격", game.attacker === 0 ? "win" : "lose");
      line = `가위바위보: ${V.sentence(i, j)}. ${game.attacker === 0 ? "내가" : "컴퓨터가"} 공격.`;
    } else if (r.note === "hit") {
      const meWon = game.winner === 0;
      st.say(meWon ? "이겼다!" : "졌다", meWon ? "win" : "lose");
      st.me.mark(meWon ? "won" : "lost");
      st.op.mark(meWon ? "lost" : "won");
      line = `같은 손 ${V.hands[i].name}! ${meWon ? "내가" : "컴퓨터가"} 공격이라 ${meWon ? "내가 이겼다" : "컴퓨터가 이겼다"}.`;
    } else {
      const who = game.attacker === 0 ? "내가" : "컴퓨터가";
      st.say(r.note === "keep" ? "공격 그대로" : "공격이 넘어갔다", game.attacker === 0 ? "win" : "lose");
      line = `${V.sentence(i, j)}. ${r.note === "keep" ? `${who} 계속 공격.` : `이제 ${who} 공격.`}`;
    }
    log.add(line, r.note === "hit" ? (game.winner === 0 ? "w" : "l") : "");
    st.sub(game.done ? "" : roleText());
    if (game.done) {
      wins[game.winner] += 1;
      rec.textContent = recordLine(addRecord("mukjjippa", game.winner === 0 ? 1 : -1));
      clear(doneBar).append(
        h("strong", {}, game.winner === 0 ? "묵찌빠 승리" : "묵찌빠 패배"),
        h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, "한 판 더"),
      );
      doneBar.hidden = false;
    } else grid.lock(false);
    refresh();
    busy = false;
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block("차례", steps.el),
    h(
      "p",
      { class: "note" },
      h("b", {}, "공격을 쥐면 유리하다. "),
      "둘 다 아무렇게나 내면 공격 쪽이 결국 이길 확률이 2/3 이다. 같은 손이 나올 확률 1/3, 공격을 지킬 확률 1/3, 빼앗길 확률 1/3 이 이어지기 때문이다.",
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": "묵찌빠 하기" },
    h("div", { class: "controls" }, botSel.el, fastToggle()),
    score.el,
    st.el,
    grid.el,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return { onKey: (e) => grid.keyHandler(e), destroy: () => (busy = true) };
}
