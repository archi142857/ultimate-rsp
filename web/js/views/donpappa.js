// 돈파파 화면. 가위바위보로 공격을 정한 뒤, 공격이 '지금 손, 지금 손, 다음 손'을 외치고 둘이 셋째 손을 같이 낸다.
// 셋째 손이 같으면 '돈!'을 먼저 누른 쪽이 이긴다. 다르면 공수가 바뀐다.

import { h, clear, sleep } from "../ui/dom.js";
import { t } from "../i18n.js";
import { compileVariant } from "../core/engine.js";
import { createBot } from "../core/bots.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createDonpappa, donCalls, DON_KANA, DON_MS } from "../games/donpappa.js";
import { reactionMs } from "../games/reaction.js";
import { handGrid, stage, chant, fastToggle, block, segmented, recordLine, rpsChant } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, stepList, logList, pressPad } from "./flow.js";
import { speedSeg, secs, HOLD_MS, padResult, clearPad } from "./hammer.js";
import { addRecord, record } from "../ui/store.js";
import { sfx } from "../sound/index.js";

/** 셋째 손이 다를 때(간사이 규칙) '돈!'을 잘못 누를 수 있게 단추를 켜 두는 시간 */
const FALSE_MS = 900;

export function donpappaView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  let level = "normal";
  let falseStart = false;
  let game = null;
  let busy = false;
  const wins = [0, 0];
  const bot = createBot("random", V, rng);

  const score = scoreboard();
  const st = stage();
  const steps = stepList([t("가위바위보로 공격을 정함"), t("공격이 지금 손을 두 번 외치고, 둘이 셋째 손을 같이 냄"), t("셋째 손이 같으면 '돈!'을 먼저 누른 쪽이 이김")]);
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("donpappa")));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const grid = handGrid(V, { onPick: (i) => pick(i) });
  const calls = () => donCalls();
  const callOf = (i) => calls()[V.hands[i].id];
  const pad = pressPad(`${calls().don}!`, { cls: "hot" });
  pad.el.hidden = true;
  const lSeg = speedSeg(level, (v) => (level = v));
  const rSeg = segmented({
    label: t("다를 때 '돈!'"),
    small: true,
    value: falseStart ? "lose" : "free",
    options: [
      { id: "free", name: t("그냥 넘어감") },
      { id: "lose", name: t("누르면 짐") },
    ],
    onChange: (v) => ((falseStart = v === "lose"), newGame()),
  });

  function roleTag() {
    st.me.tag(game.attacker === 0 ? t("공격") : game.attacker === 1 ? t("수비") : "");
    st.op.tag(game.attacker === 1 ? t("공격") : game.attacker === 0 ? t("수비") : "");
  }

  function prompt() {
    if (game.phase === "janken") return t("가위바위보! 이기는 쪽이 공격");
    const now = callOf(game.current[game.attacker]);
    return game.attacker === 0
      ? t("내가 공격. '{c}, {c}' 다음에 낼 손 고르기", { c: now })
      : t("컴퓨터가 공격. '{c}, {c}' 다음에 낼 손 고르기", { c: now });
  }

  function newGame() {
    pad.cancel();
    clearPad(pad);
    game = createDonpappa(V, { falseStart, limit: DON_MS });
    busy = false;
    doneBar.hidden = true;
    pad.el.hidden = true;
    grid.el.hidden = false;
    grid.lock(false);
    grid.setNames(null);
    log.clear();
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    st.say("");
    st.sub(prompt());
    roleTag();
    score.set(wins[0], wins[1], t("이긴 판"));
    steps.set(0);
  }

  async function pick(i) {
    if (busy || game.done) return;
    busy = true;
    grid.lock(true);
    if (game.phase === "janken") await janken(i);
    else await third(i);
    busy = false;
  }

  async function janken(i) {
    const g = game;
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    await chant(st, rpsChant());
    if (game !== g) return;
    const j = bot.pick({ history: [] });
    const r = g.janken(i, j);
    st.me.set(V, i);
    st.op.set(V, j);
    if (r.cmp === 0) st.say(t("비김. 다시"));
    else {
      st.say(g.attacker === 0 ? t("내가 공격") : t("컴퓨터 공격"), g.attacker === 0 ? "win" : "lose");
      log.add(g.attacker === 0 ? t("가위바위보: {s}. 내가 공격", { s: V.sentence(i, j) }) : t("가위바위보: {s}. 컴퓨터가 공격", { s: V.sentence(i, j) }));
      grid.setNames(V.hands.map((x) => calls()[x.id]));
      steps.set(1);
    }
    if (r.cmp === 0) sfx("draw");
    st.sub(prompt());
    roleTag();
    grid.lock(false);
  }

  async function third(i) {
    const g = game;
    const now = callOf(g.current[g.attacker]);
    st.reset();
    st.me.set(V, g.current[0], callOf(g.current[0]));
    st.op.set(V, g.current[1], callOf(g.current[1]));
    await chant(st, [`${now}!`, `${now}!`]);
    if (game !== g) return;
    const j = rng.int(V.n);
    st.me.set(V, i, callOf(i));
    st.op.set(V, j, callOf(j));
    const same = i === j;
    let mine = Infinity;
    let comp = Infinity;
    const pressed = same || g.falseStart;
    if (pressed) {
      // 같으면 '돈!' 겨루기. 간사이 규칙이면 다를 때도 단추를 잠깐 켜 둔다(누르면 진다)
      grid.el.hidden = true;
      clearPad(pad);
      pad.el.hidden = false;
      st.say(same ? t("같음!") : t("다름"), same ? "win" : "");
      if (same) sfx("go");
      st.sub(same ? t("먼저 누르기") : t("누르면 패배"));
      if (same) comp = reactionMs(rng, level);
      let cue = 0;
      mine = await pad.wait(same ? DON_MS : FALSE_MS, {
        onStart() {
          if (same)
            cue = setTimeout(() => {
              st.op.set(V, j, `${calls().don}!`);
              pad.cancel(); // 컴퓨터가 먼저 외쳤다
            }, comp);
        },
      });
      clearTimeout(cue);
      if (game !== g) return;
    }
    const r = g.call(i, j, mine, comp);
    // 누르기 판이었으면 결과를 단추 자리에도 크게 보이고 잠깐 둔다(11-09 사용자: 결과가 바로 사라졌다)
    const say = (text, tone = "") => {
      st.say(text, tone);
      if (pressed) padResult(pad, text, tone);
    };
    const shown = (ms) => (Number.isFinite(ms) ? t("{s}초", { s: secs(ms) }) : t("안 누름"));
    let line;
    if (r.result === "don") {
      const meWon = g.winner === 0;
      say(meWon ? t("돈! 내가 승리") : t("돈! 컴퓨터가 승리"), meWon ? "win" : "lose");
      st.sub(t("나 {a}, 컴퓨터 {b}", { a: shown(mine), b: shown(comp) }));
      const said = { c: callOf(i), a: shown(mine), b: shown(comp) };
      line = meWon ? t("둘 다 {c}. 내가 먼저 '돈!' (나 {a}, 컴퓨터 {b})", said) : t("둘 다 {c}. 컴퓨터가 먼저 '돈!' (나 {a}, 컴퓨터 {b})", said);
    } else if (r.result === "missed") {
      say(t("아무도 안 외침"));
      sfx("draw");
      line = t("둘 다 {c}. 아무도 '돈!'을 외치지 않아 다시", { c: callOf(i) });
    } else if (r.result === "false") {
      say(t("손이 다른데 외쳐서 패배"), "lose");
      st.sub(t("나 {a}", { a: shown(mine) }));
      line = t("{a} 대 {b}. 손이 다른데 '돈!'을 외쳐서 패배", { a: callOf(i), b: callOf(j) });
    } else {
      say(g.attacker === 0 ? t("이제 내가 공격") : t("공격 넘어감"), g.attacker === 0 ? "win" : "lose");
      line = t("{a} 대 {b}. 공격과 수비가 바뀜", { a: callOf(i), b: callOf(j) });
    }
    log.add(line, g.done ? (g.winner === 0 ? "w" : "l") : "");
    roleTag();
    if (g.done) {
      const won = g.winner === 0;
      sfx(won ? "matchwin" : "matchlose");
      wins[g.winner] += 1;
      score.set(wins[0], wins[1], t("이긴 판"));
      rec.textContent = recordLine(addRecord("donpappa", won ? 1 : -1));
      clear(doneBar).append(h("strong", {}, won ? t("돈파파 승리") : t("돈파파 패배")), h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")));
      doneBar.hidden = false;
      grid.el.hidden = true;
      pad.el.hidden = true;
      steps.set(2);
    } else {
      if (pressed) {
        await sleep(HOLD_MS);
        if (game !== g) return;
        pad.el.hidden = true;
        grid.el.hidden = false;
      }
      if (r.result !== "don") st.sub(prompt());
      grid.lock(false);
    }
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(t("하는 법"), steps.el),
    h(
      "p",
      { class: "note" },
      h("b", {}, t("손마다 외치는 말이 있습니다. ")),
      t("바위는 {r}, 가위는 {s}, 보는 {p}({kr}·{ks}·{kp})입니다. 셋째 손이 같아지면 '{d}!'을 먼저 외칩니다. 동시에 외치면 공격이 이깁니다.", {
        r: donCalls().rock,
        s: donCalls().scissors,
        p: donCalls().paper,
        kr: DON_KANA.rock,
        ks: DON_KANA.scissors,
        kp: DON_KANA.paper,
        d: donCalls().don,
      }),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("{name} 하기", { name: entry.name }) },
    h("div", { class: "controls" }, lSeg.el, rSeg.el, fastToggle()),
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
