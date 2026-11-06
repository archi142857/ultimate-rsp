// 글리코(계단 가위바위보) 화면.

import { h, clear, pct, sleep, reducedMotion } from "../ui/dom.js";
import { compileVariant } from "../core/engine.js";
import { createBot } from "../core/bots.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createGlico, solveGlico, steadyMix, GLICO_WORDS } from "../games/glico.js";
import { handGrid, stage, chant, fastToggle, block, segmented, selectBox, mixBar, recordLine, fastMode } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

const solved = new Map();
function solutionFor(V, goal) {
  if (!solved.has(goal)) solved.set(goal, solveGlico(V, goal));
  return solved.get(goal);
}

export function glicoView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  let goal = 30;
  let botKind = "calc";
  let human = createBot("human", V, rng);
  const throws = [];
  let game = createGlico(V, goal);
  let busy = false;
  const wins = [0, 0];

  const st = stage();
  const score = scoreboard();
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("glico")));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const grid = handGrid(V, {
    onPick: (i) => play(i),
    names: V.hands.map((x) => `${x.name} ${GLICO_WORDS[x.id].steps}칸`),
  });

  const tracks = [0, 1].map((side) => {
    const fill = h("span", { class: "fill", style: { width: "0%" } });
    const pos = h("span", { class: "pos" });
    const track = h("div", { class: "track", role: "meter", "aria-valuemin": 0 }, fill, pos);
    return { fill, pos, track, row: [h("span", { class: "who" }, side === 0 ? "나" : "컴퓨터"), track] };
  });
  const stairs = h("div", { class: "stairs", "aria-label": "계단" }, tracks.map((t) => t.row));
  const kana = h("div", { class: "kana", "aria-hidden": "true" });

  const analysis = h("div", { class: "analysis" });

  const goalSeg = segmented({
    label: "꼭대기",
    value: String(goal),
    small: true,
    options: [20, 30, 50].map((g) => ({ id: String(g), name: `${g}칸` })),
    onChange(v) {
      goal = Number(v);
      newGame();
    },
  });
  const botSel = selectBox({
    label: "컴퓨터 전략",
    value: botKind,
    options: [
      { id: "calc", name: "계산기" },
      { id: "human", name: "사람 흉내" },
      { id: "random", name: "주사위" },
    ],
    onChange: (v) => {
      botKind = v;
      human = createBot("human", V, rng);
    },
  });

  function drawTracks() {
    tracks.forEach((t, side) => {
      const p = game.pos[side];
      t.fill.style.width = `${(100 * p) / goal}%`;
      t.pos.textContent = `${p} / ${goal}`;
      t.pos.style.color = p / goal > 0.82 ? "var(--paper)" : "var(--ink)";
      t.track.setAttribute("aria-valuemax", goal);
      t.track.setAttribute("aria-valuenow", p);
      t.track.setAttribute("aria-label", `${side === 0 ? "나" : "컴퓨터"} ${p}칸`);
    });
  }

  function drawAnalysis() {
    clear(analysis);
    if (game.done) return;
    const sol = solutionFor(V, goal);
    const [pa, pb] = game.pos;
    const v = sol.value[pa][pb];
    analysis.append(
      h("p", { class: "field-label", style: { margin: 0 } }, "지금 자리에서 둘 다 최선을 다하면 내가 이길 확률"),
      h("div", { class: "big-num" }, pct(v)),
      h("p", { class: "field-label", style: { margin: "6px 0 0" } }, "그때 내가 낼 최적 섞기"),
      mixBar(V, sol.mix[pa][pb]),
    );
  }

  function newGame() {
    game = createGlico(V, goal);
    busy = false;
    doneBar.hidden = true;
    grid.lock(false);
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    st.say("");
    st.sub("이긴 사람만 이긴 손 글자 수만큼 오른다.");
    clear(kana);
    log.clear();
    drawTracks();
    drawAnalysis();
    score.set(wins[0], wins[1], "이긴 판");
  }

  function botPick() {
    if (botKind === "random") return rng.int(V.n);
    if (botKind === "human") return human.pick({ history: throws });
    const sol = solutionFor(V, goal);
    const [pa, pb] = game.pos;
    return rng.weighted(sol.mix[pb][pa]);
  }

  async function spell(handId) {
    const w = GLICO_WORDS[handId];
    const spans = w.kana.map((k) => h("span", {}, k));
    clear(kana).append(...spans, h("span", { class: "on", style: { marginLeft: "10px", fontSize: "0.7em" } }, `${w.read}, ${w.steps}칸`));
    if (fastMode() || reducedMotion()) {
      spans.forEach((s) => s.classList.add("on"));
      return;
    }
    for (const s of spans) {
      s.classList.add("on");
      await sleep(110);
    }
  }

  async function play(i) {
    if (busy || game.done) return;
    busy = true;
    grid.lock(true);
    st.reset();
    const j = botPick();
    st.me.set(V, null);
    st.op.set(V, null);
    await chant(st, ["가위!", "바위!", "보!"]);
    const r = game.play(i, j);
    throws.push({ me: j, op: i });
    st.me.set(V, i);
    st.op.set(V, j);
    if (r.cmp === 0) {
      st.say("비겼다");
      st.sub("아무도 오르지 않는다.");
      clear(kana);
      log.add(`둘 다 ${V.hands[i].name}. 그대로.`);
    } else {
      const meMoved = r.by === 0;
      st.say(meMoved ? `${r.moved}칸 오른다` : `컴퓨터 ${r.moved}칸`, meMoved ? "win" : "lose");
      st.me.mark(meMoved ? "won" : "lost");
      st.op.mark(meMoved ? "lost" : "won");
      st.sub(`${V.sentence(i, j)}.`);
      log.add(`${V.sentence(i, j)}. ${meMoved ? "내가" : "컴퓨터가"} ${r.moved}칸 올라 ${r.pos[r.by]}칸.`, meMoved ? "w" : "l");
      await spell(V.hands[meMoved ? i : j].id);
    }
    drawTracks();
    if (game.done) {
      const meWon = game.winner === 0;
      wins[game.winner] += 1;
      st.say(meWon ? "꼭대기!" : "졌다", meWon ? "win" : "lose");
      rec.textContent = recordLine(addRecord("glico", meWon ? 1 : -1));
      clear(doneBar).append(
        h("strong", {}, meWon ? "먼저 올랐다" : "컴퓨터가 먼저 올랐다"),
        h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, "한 판 더"),
      );
      doneBar.hidden = false;
      score.set(wins[0], wins[1], "이긴 판");
    } else grid.lock(false);
    drawAnalysis();
    busy = false;
  }

  const sm = steadyMix(V);
  const side = h(
    "div",
    { class: "side-panel" },
    block(
      "계산기가 본 판",
      h(
        "p",
        {},
        `바위는 3칸, 가위와 보는 6칸이다. 칸 차이만 따지면 가위·바위를 ${pct(sm[V.index.scissors])}씩, 보를 ${pct(sm[V.index.paper])} 내는 게 최선이다. 6칸이나 오르는 보를 가장 적게 내야 한다는 점이 재미있다.`,
      ),
      h("p", {}, "꼭대기가 가까워지면 셈이 달라진다. 아래 숫자는 지금 자리에서 끝까지 내다본 값이다."),
      analysis,
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": "글리코 하기" },
    h("div", { class: "controls" }, botSel.el, goalSeg.el, fastToggle()),
    score.el,
    stairs,
    kana,
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
