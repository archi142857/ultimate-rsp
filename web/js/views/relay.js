// 가위바위보 릴레이 화면. 두 편이 길 양 끝에서 한 명씩 달려 나와 만나면 가위바위보를 한다.
// 이긴 사람은 계속 가고, 진 편은 진지에서 다음 사람이 나온다. 상대 진지에 들어가면 1점.

import { h, clear, sleep, reducedMotion } from "../ui/dom.js";
import { t, num } from "../i18n.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createRelay, relayStats } from "../games/relay.js";
import { handGrid, stage, chant, fastMode, fastToggle, block, segmented, recordLine, rpsChant } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, stepList, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";
import { handArt } from "../ui/art.js";
import { PROPS } from "../data/props.js";
import { sfx } from "../sound/index.js";

// 주자 그림(컨셉 0e3a2df: Fluent Person running, 왼쪽을 본다. 우리 편은 CSS 로 뒤집는다)
const RUNNER = PROPS.runner;
const STEP_MS = 230;

export function relayView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  let cells = 8;
  let target = 1;
  let game = null;
  let busy = false;

  const score = scoreboard();
  const st = stage({ meLabel: t("우리 편"), opLabel: t("상대 편") });
  const track = h("div", { class: "relay-track", role: "img" });
  const clock = h("p", { class: "note", style: { margin: "0 0 14px" }, "aria-live": "polite" });
  const steps = stepList([t("한 명씩 달려 나감"), t("만나면 가위바위보를 하고, 진 편은 다음 사람이 나옴"), t("상대 진지에 들어가면 1점")]);
  const log = logList();
  const rec = h("p", { class: "rec" });
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const grid = handGrid(V, { onPick: (i) => janken(i) });
  const statsBox = h("dl", { class: "aka" });

  const cSeg = segmented({
    label: t("칸 수"),
    small: true,
    value: String(cells),
    options: [4, 8, 12].map((n) => ({ id: String(n), name: t("{n}칸", { n }) })),
    onChange: (v) => ((cells = Number(v)), newGame()),
  });
  const tSeg = segmented({
    label: t("이기려면"),
    small: true,
    value: String(target),
    options: [
      { id: "1", name: t("한 번 들어가기") },
      { id: "3", name: t("세 번 들어가기") },
    ],
    onChange: (v) => ((target = Number(v)), newGame()),
  });

  const key = () => `relay-${cells}-${target}`;

  function drawTrack() {
    const g = game;
    const spots = Array.from({ length: g.cells + 2 }, (_, i) => i);
    // 끝났으면 이긴 주자를 상대 진지 안에 그린다(진 편 주자는 뺀다)
    const pos = g.pos.slice();
    let shown = [0, 1];
    if (g.done && g.winner !== null) {
      pos[g.winner] = g.home[1 - g.winner];
      shown = [g.winner];
    }
    clear(track).append(
      ...spots.map((i) => {
        const home = i === 0 || i === g.cells + 1;
        const here = shown.filter((p) => pos[p] === i);
        return h(
          "div",
          { class: "spot" + (home ? " home" : "") + (i === 0 ? " home-me" : i === g.cells + 1 ? " home-op" : "") },
          here.map((p) => h("span", { class: "runner" + (p === 0 ? " me" : " op"), "aria-hidden": "true" }, h("span", { class: "glyph" }, handArt(RUNNER)), h("small", {}, String(g.runner[p])))),
        );
      }),
    );
    track.setAttribute(
      "aria-label",
      g.done
        ? t("길 {n}칸", { n: g.cells })
        : t("길 {n}칸. 우리 편 {a}번째 주자는 {x}칸째, 상대 편 {b}번째 주자는 {y}칸째", { n: g.cells, a: g.runner[0], x: g.pos[0], b: g.runner[1], y: g.cells + 1 - g.pos[1] }),
    );
    clock.textContent = t("{s}초 지남(한 칸 1초, 가위바위보 한 번 1초). 가위바위보 {n}번", { s: g.seconds(), n: g.throws });
    score.set(g.score[0], g.score[1], target > 1 ? t("먼저 {n}점", { n: target }) : t("먼저 들어가기"));
  }

  async function runUntilMeet() {
    const g = game;
    const quick = fastMode() || reducedMotion();
    st.say(t("달리는 중"));
    st.sub("");
    while (g.step()) {
      if (!quick) {
        drawTrack();
        await sleep(STEP_MS);
        if (game !== g) return;
      }
    }
    drawTrack();
    st.say(t("만남"));
    st.sub(t("가위바위보로 겨루기"));
    steps.set(1);
    grid.el.hidden = false;
    grid.lock(false);
    busy = false;
  }

  function newGame() {
    game = createRelay(V, { cells, target });
    busy = true;
    doneBar.hidden = true;
    grid.el.hidden = true;
    log.clear();
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    rec.textContent = recordLine(record(key()));
    steps.set(0);
    drawTrack();
    runUntilMeet();
  }

  async function janken(i) {
    if (busy || game.done || game.phase !== "janken") return;
    busy = true;
    grid.lock(true);
    const g = game;
    st.reset();
    st.sub("");
    st.me.set(V, null);
    st.op.set(V, null);
    await chant(st, rpsChant());
    if (game !== g) return;
    const j = rng.int(V.n);
    const r = g.janken(i, j);
    st.me.set(V, i);
    st.op.set(V, j);
    if (r.cmp === 0) {
      st.say(t("비김. 다시"));
      sfx("draw");
      grid.lock(false);
      busy = false;
      return;
    }
    const w = r.winner;
    (w === 0 ? st.op : st.me).mark("lost");
    if (r.point !== null) {
      st.say(w === 0 ? t("상대 진지에 들어감!") : t("상대가 우리 진지에 들어옴"), w === 0 ? "win" : "lose");
      log.add(w === 0 ? t("{s}. 상대 진지에 들어감. 1점", { s: V.sentence(i, j) }) : t("{s}. 상대가 우리 진지에 들어옴", { s: V.sentence(i, j) }), w === 0 ? "w" : "l");
    } else {
      st.say(w === 0 ? t("승리. 계속 달림") : t("패배. 다음 사람이 나감"), w === 0 ? "win" : "lose");
      log.add(w === 0 ? t("{s}. 상대 편 다음 사람이 나옴", { s: V.sentence(i, j) }) : t("{s}. 우리 편 다음 사람이 나감", { s: V.sentence(i, j) }));
    }
    drawTrack();
    if (g.done) {
      const won = g.winner === 0;
      sfx(won ? "matchwin" : "matchlose");
      steps.set(2);
      grid.el.hidden = true;
      rec.textContent = recordLine(addRecord(key(), won ? 1 : -1));
      clear(doneBar).append(
        h("strong", {}, won ? t("우리 편 승리") : t("우리 편 패배")),
        h("span", { class: "muted" }, t("{s}초 걸림", { s: g.seconds() })),
        h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")),
      );
      doneBar.hidden = false;
      busy = false;
      return;
    }
    grid.el.hidden = true;
    if (!fastMode()) await sleep(500);
    if (game !== g) return;
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    steps.set(0);
    if (g.phase === "janken") {
      // 진지에서 막 나온 사람과 바로 붙었다
      st.say(t("만남"));
      st.sub(t("가위바위보로 겨루기"));
      grid.el.hidden = false;
      grid.lock(false);
      busy = false;
    } else runUntilMeet();
  }

  function drawStats() {
    const sim = makeRng(11);
    clear(statsBox).append(
      ...[4, 8, 12, 16].flatMap((n) => {
        const s = relayStats(V, sim, n, 600);
        return [h("dt", {}, t("{n}칸", { n })), h("dd", {}, t("평균 {s}초, 가위바위보 {k}번", { s: num(Math.round(s.seconds)), k: num(Math.round(s.throws * 10) / 10) }))];
      }),
    );
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(t("하는 법"), steps.el),
    block(
      t("걸리는 시간"),
      h("p", {}, t("둘 다 아무렇게나 내면 길이 길수록 오래 걸립니다. 진지에서 막 나온 사람을 이겨야 들어가기 때문입니다.")),
      h("p", { class: "field-label", style: { margin: "4px 0 8px" } }, t("한 번 들어가면 끝나는 규칙으로 600판을 돌린 평균")),
      statsBox,
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("{name} 하기", { name: entry.name }) },
    h("div", { class: "controls" }, cSeg.el, tSeg.el, fastToggle()),
    score.el,
    track,
    clock,
    st.el,
    grid.el,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  drawStats();
  newGame();
  return { onKey: (e) => (!grid.el.hidden ? grid.keyHandler(e) : false), destroy: () => (busy = true) };
}
