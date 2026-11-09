// 편 가위바위보 술래잡기 화면. 우리 편 손은 내가 정하고, 상대 편은 컴퓨터가 정한다.
// 이기면 우리 편이 쫓고(진 편은 저마다 반반 확률로 잡힌다), 지면 '달아나기'를 술래보다 먼저 눌러야 산다.

import { h, clear, sleep } from "../ui/dom.js";
import { t, lower, listWords } from "../i18n.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createTeamTag } from "../games/teams.js";
import { reactionMs, firstPress, REACTION_LEVELS } from "../games/reaction.js";
import { handGrid, chant, fastToggle, block, segmented, recordLine, stage, rpsChant } from "../ui/widgets.js";
import { entryHead, entryBody } from "./common.js";
import { flowLayout, stepList, logList, pressPad } from "./flow.js";
import { addRecord, record } from "../ui/store.js";
import { HOLD_MS, padResult, clearPad } from "./hammer.js";

const ESCAPE_MS = 1200;

export function teamTagView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  let size = 5;
  let level = "normal";
  let game = null;
  let busy = false;
  let moved = new Set();

  const st = stage({ meLabel: t("우리 편"), opLabel: t("상대 편") });
  const board = h("div", { class: "teams", "aria-live": "polite" });
  const status = h("p", { class: "note", style: { margin: "0 0 14px" } });
  const steps = stepList([t("편마다 손 하나를 몰래 정한다"), t("다 같이 낸다. 이긴 편이 쫓는다"), t("잡히면 상대 편이 된다. 한 편에 아무도 남지 않으면 끝난다")]);
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("teamtag")));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const grid = handGrid(V, { onPick: (i) => round(i), label: t("우리 편 손") });
  const run = pressPad(t("달아나기"), { cls: "hot" });
  run.el.hidden = true;

  const sSeg = segmented({
    label: t("편마다"),
    small: true,
    value: String(size),
    options: [3, 5, 8].map((n) => ({ id: String(n), name: t("{n}명", { n }) })),
    onChange: (v) => ((size = Number(v)), newGame()),
  });
  const lSeg = segmented({
    label: t("술래 빠르기"),
    small: true,
    value: level,
    options: [
      { id: "easy", name: t("느림") },
      { id: "normal", name: t("보통") },
      { id: "hard", name: t("빠름") },
    ],
    onChange: (v) => (level = v),
  });

  const name = (p) => (p === 0 ? t("나") : t("컴퓨터 {n}", { n: p }));

  function draw() {
    const mine = game.myTeam();
    clear(board).append(
      ...[mine, 1 - mine].map((side) =>
        h(
          "div",
          { class: "team" + (side === mine ? " mine" : "") },
          h("div", { class: "team-head" }, h("span", {}, side === mine ? t("우리 편") : t("상대 편")), h("b", {}, String(game.teams[side].length))),
          h(
            "div",
            { class: "circle" },
            game.teams[side].map((p) =>
              h(
                "div",
                { class: "person" + (p === 0 ? " me" : "") + (moved.has(p) ? " moved" : "") },
                h("span", { class: "face", "aria-hidden": "true" }, p === 0 ? "🙂" : "🤖"),
                h("span", { class: "nm" }, name(p)),
              ),
            ),
          ),
        ),
      ),
    );
    status.textContent = game.done ? t("{n}판 만에 끝났다.", { n: game.round }) : t("{r}판째다. {m}판이 지나면 사람이 많은 편이 이긴다.", { r: game.round + 1, m: game.maxRounds });
    grid.el.hidden = game.done;
  }

  function newGame() {
    run.cancel();
    clearPad(run);
    game = createTeamTag(V, { size });
    moved = new Set();
    busy = false;
    doneBar.hidden = true;
    run.el.hidden = true;
    grid.lock(false);
    log.clear();
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    st.say("");
    st.sub(t("우리 편 손을 고르자."));
    steps.set(0);
    draw();
  }

  async function round(i) {
    if (busy || game.done) return;
    busy = true;
    grid.lock(true);
    const g = game;
    const mine = g.myTeam();
    const j = rng.int(V.n);
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    await chant(st, rpsChant());
    if (game !== g) return;
    st.me.set(V, i);
    st.op.set(V, j);
    const c = V.cmp(i, j);
    const [a, b] = mine === 0 ? [i, j] : [j, i];
    let escaped = null;
    const ran = c < 0;
    if (ran) {
      // 우리 편이 졌다: 술래보다 먼저 눌러야 달아난다
      steps.set(1);
      st.say(t("달아나!"), "lose");
      st.sub(t("술래보다 먼저 누르자."));
      clearPad(run);
      run.el.classList.add("hot");
      run.set(t("달아나기"));
      run.el.hidden = false;
      grid.el.hidden = true;
      const myMs = await run.wait(ESCAPE_MS);
      if (game !== g) return;
      const chaserMs = reactionMs(rng, level);
      escaped = firstPress(myMs, chaserMs, { limit: ESCAPE_MS, tie: 1 }) === 0;
      st.sub(Number.isFinite(myMs) ? t("나 {a}초, 술래 {b}초", { a: (myMs / 1000).toFixed(2), b: (chaserMs / 1000).toFixed(2) }) : t("못 눌렀다. 술래 {b}초", { b: (chaserMs / 1000).toFixed(2) }));
    }
    const r = g.play(a, b, rng, { escaped });
    // 달아나기 판이었으면 결과를 단추 자리에도 크게 보이고 잠깐 둔다(11-09 사용자: 결과가 바로 사라졌다)
    let outcome = null;
    const say = (text, tone = "") => {
      st.say(text, tone);
      outcome = [text, tone];
    };
    moved = new Set(r.caught);
    const ours = c > 0;
    if (c === 0) {
      say(t("비김. 다시"));
      st.sub(t("둘 다 {h}", { h: lower(V.hands[i].name) }));
      log.add(t("{r}판: 둘 다 {h}. 다시.", { r: r.round, h: lower(V.hands[i].name) }));
    } else {
      const names = r.caught.map(name);
      const caughtMe = r.caught.includes(0);
      if (ours) {
        say(t("우리 편이 쫓는다"), "win");
        st.sub(names.length ? t("{names} 잡음.", { names: listWords(names) }) : t("아무도 못 잡았다."));
      } else if (caughtMe) {
        say(t("잡혔다. 이제 상대 편이다"), "lose");
      } else {
        say(t("달아났다"), "win");
      }
      const said = { r: r.round, s: V.sentence(i, j), names: listWords(names) };
      log.add(
        names.length
          ? ours
            ? t("{r}판: {s}. 우리 편이 {names:을를} 잡았다.", said)
            : t("{r}판: {s}. 상대 편이 {names:을를} 잡았다.", said)
          : ours
            ? t("{r}판: {s}. 우리 편이 쫓았지만 아무도 못 잡았다.", said)
            : t("{r}판: {s}. 상대 편이 쫓았지만 모두 달아났다.", said),
        caughtMe ? "l" : ours ? "w" : "",
      );
    }
    steps.set(game.done ? 2 : 0);
    if (ran && outcome) {
      draw();
      grid.el.hidden = true;
      padResult(run, ...outcome);
      await sleep(HOLD_MS);
      if (game !== g) return;
      run.el.hidden = true;
    }
    if (g.done) finish();
    else grid.lock(false);
    draw();
    busy = false;
  }

  function finish() {
    const mine = game.myTeam();
    const won = game.winner === mine;
    const tie = game.winner === -1;
    st.say(tie ? t("비김") : won ? t("우리 편 승리") : t("우리 편 패배"), tie ? "" : won ? "win" : "lose");
    st.sub(t("{a} 대 {b}", { a: game.teams[mine].length, b: game.teams[1 - mine].length }));
    rec.textContent = recordLine(addRecord("teamtag", tie ? 0 : won ? 1 : -1));
    clear(doneBar).append(
      h("strong", {}, tie ? t("사람 수가 같아 비겼다") : won ? t("우리 편이 이겼다") : t("상대 편이 이겼다")),
      h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")),
    );
    doneBar.hidden = false;
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(t("하는 법"), steps.el),
    h(
      "p",
      { class: "note" },
      h("b", {}, t("잡히면 편이 바뀐다. ")),
      t("내가 잡히면 상대 편으로 가서 그 편으로 겨룬다. 끝났을 때 내가 있는 편이 우리 편이다. 술래 빠르기가 보통이면 술래는 평균 {a}초 만에 손을 뻗는다.", {
        a: (REACTION_LEVELS.normal / 1000).toFixed(2),
      }),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("{name} 하기", { name: entry.name }) },
    h("div", { class: "controls" }, sSeg.el, lSeg.el, fastToggle()),
    status,
    board,
    st.el,
    grid.el,
    run.el,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return {
    onKey: (e) => run.key(e) || (!grid.el.hidden ? grid.keyHandler(e) : false),
    destroy() {
      busy = true;
      run.cancel();
    },
  };
}
