// 묵찌빠 화면.

import { h, clear } from "../ui/dom.js";
import { t, lower } from "../i18n.js";
import { compileVariant } from "../core/engine.js";
import { createBot } from "../core/bots.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createMukjjippa, CALL } from "../games/mukjjippa.js";
import { handGrid, selectBox, stage, chant, fastToggle, block, rpsChant } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, stepList, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";
import { recordLine } from "../ui/widgets.js";

const BOT_CHOICES = [
  { id: "random", get name() { return t("주사위"); } },
  { id: "human", get name() { return t("사람 흉내"); } },
  { id: "pattern", get name() { return t("수 읽기"); } },
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
  const steps = stepList([t("가위바위보로 공격을 정함"), t("공격이 외치며 손을 바꾸고, 수비도 같이 바꿈"), t("같은 손이 나오면 공격이 이김")]);
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("mukjjippa")));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const grid = handGrid(V, { onPick: (i) => play(i) });
  const callNames = V.hands.map((x) => `${CALL[x.id]}! (${x.name})`);

  const botSel = selectBox({
    label: t("컴퓨터 전략"),
    value: botId,
    options: BOT_CHOICES,
    onChange(id) {
      botId = id;
      bot = createBot(id, V, rng);
    },
  });

  function roleText() {
    if (game.phase === "rps") return t("가위바위보! 이기는 쪽이 공격");
    return game.attacker === 0
      ? t("내가 공격. 외칠 손 고르기. 컴퓨터가 같은 손을 내면 내가 승리")
      : t("컴퓨터가 공격. 같은 손을 내면 패배. 다른 손으로 이기면 공격을 빼앗음");
  }

  function refresh() {
    steps.set(game.done ? 2 : game.phase === "rps" ? 0 : 1);
    st.me.tag(game.attacker === 0 ? t("공격") : game.attacker === 1 ? t("수비") : "");
    st.op.tag(game.attacker === 1 ? t("공격") : game.attacker === 0 ? t("수비") : "");
    grid.setNames(game.phase === "attack" ? callNames : null);
    score.set(wins[0], wins[1], t("이긴 판"));
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
    await chant(st, phase === "rps" ? rpsChant() : [`${CALL.rock}!`, `${CALL.scissors}!`, `${CALL.paper}!`]);
    const r = game.play(i, j);
    throws.push({ me: j, op: i });
    st.me.set(V, i, phase === "attack" && attacker === 0 ? `${CALL[V.hands[i].id]}!` : "");
    st.op.set(V, j, phase === "attack" && attacker === 1 ? `${CALL[V.hands[j].id]}!` : "");
    let line;
    if (r.note === "again") {
      st.say(t("무승부"));
      line = t("가위바위보: 둘 다 {h}. 다시", { h: lower(V.hands[i].name) });
    } else if (r.note === "start") {
      st.say(game.attacker === 0 ? t("내가 공격") : t("컴퓨터 공격"), game.attacker === 0 ? "win" : "lose");
      line = game.attacker === 0 ? t("가위바위보: {s}. 내가 공격", { s: V.sentence(i, j) }) : t("가위바위보: {s}. 컴퓨터가 공격", { s: V.sentence(i, j) });
    } else if (r.note === "hit") {
      const meWon = game.winner === 0;
      st.say(meWon ? t("승리!") : t("패배"), meWon ? "win" : "lose");
      st.me.mark(meWon ? "won" : "lost");
      st.op.mark(meWon ? "lost" : "won");
      line = meWon ? t("둘 다 {h}! 공격하던 내가 승리", { h: lower(V.hands[i].name) }) : t("둘 다 {h}! 공격하던 컴퓨터가 승리", { h: lower(V.hands[i].name) });
    } else {
      const s = V.sentence(i, j);
      st.say(r.note === "keep" ? t("공격 그대로") : t("공격 넘어감"), game.attacker === 0 ? "win" : "lose");
      if (r.note === "keep") line = game.attacker === 0 ? t("{s}. 내가 계속 공격", { s }) : t("{s}. 컴퓨터가 계속 공격", { s });
      else line = game.attacker === 0 ? t("{s}. 이제 내가 공격", { s }) : t("{s}. 이제 컴퓨터가 공격", { s });
    }
    log.add(line, r.note === "hit" ? (game.winner === 0 ? "w" : "l") : "");
    st.sub(game.done ? "" : roleText());
    if (game.done) {
      wins[game.winner] += 1;
      rec.textContent = recordLine(addRecord("mukjjippa", game.winner === 0 ? 1 : -1));
      clear(doneBar).append(
        h("strong", {}, game.winner === 0 ? t("묵찌빠 승리") : t("묵찌빠 패배")),
        h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")),
      );
      doneBar.hidden = false;
    } else grid.lock(false);
    refresh();
    busy = false;
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(t("하는 법"), steps.el),
    h(
      "p",
      { class: "note" },
      h("b", {}, t("공격하는 쪽이 유리합니다. ")),
      t("둘 다 아무렇게나 내면 공격하는 쪽이 끝내 이길 확률은 2/3입니다. 판마다 같은 손이 나올 확률, 공격을 지킬 확률, 빼앗길 확률이 모두 1/3이기 때문입니다."),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("묵찌빠 하기") },
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
