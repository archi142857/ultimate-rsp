// 모라 화면. 손가락 수(0~5)와 외칠 합(0~10)을 골라 컴퓨터와 같이 낸다. 홀짝 판도 있다.

import { h, clear } from "../ui/dom.js";
import { t } from "../i18n.js";
import { makeRng } from "../core/rng.js";
import { createMorra, createOddEven, morraPick, MAX_FINGERS } from "../games/morra.js";
import { stage, chant, fastToggle, block, segmented, recordLine, countChant } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, stepList, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

const TARGET = 3;

/** 숫자 단추 줄. 고른 값은 aria-pressed 로 보인다 */
export function pickRow(label, values, { onPick, render = (v) => String(v), name = null } = {}) {
  const btns = values.map((v) =>
    h("button", { type: "button", class: "pick", "aria-pressed": "false", "aria-label": name ? name(v) : undefined, onclick: () => onPick(v) }, render(v)),
  );
  const el = h("div", { class: "field" }, h("span", { class: "field-label" }, label), h("div", { class: "picks", role: "group", "aria-label": label }, btns));
  return {
    el,
    set(v) {
      btns.forEach((b, i) => b.setAttribute("aria-pressed", String(values[i] === v)));
    },
    disable(fn) {
      btns.forEach((b, i) => (b.disabled = !!fn(values[i])));
    },
    lock(on) {
      btns.forEach((b) => (b.inert = on));
    },
  };
}

export function morraView(main, entry) {
  const rng = makeRng();
  let mode = "morra";
  let mySide = 0; // 홀짝: 0 = 내가 홀, 1 = 내가 짝
  let game = null;
  let fingers = null;
  let guess = null;
  let busy = false;

  const fingerList = Array.from({ length: MAX_FINGERS + 1 }, (_, i) => i);
  const sumList = Array.from({ length: 2 * MAX_FINGERS + 1 }, (_, i) => i);
  const score = scoreboard();
  const st = stage();
  const steps = stepList([t("손가락 몇 개를 펼지 정한다"), t("둘의 손가락 합을 외친다"), t("혼자 맞히면 1점, 3점을 먼저 내면 이긴다")]);
  const log = logList();
  const rec = h("p", { class: "rec" });
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const fRow = pickRow(t("펼 손가락"), fingerList, { onPick: (v) => ((fingers = v), sync()), name: (v) => t("손가락 {n}개", { n: v }) });
  const gRow = pickRow(t("외칠 합"), sumList, { onPick: (v) => ((guess = v), sync()) });
  const go = h("button", { class: "btn btn-ink btn-big", type: "button", disabled: true, onclick: () => play() }, t("내기"));

  const mSeg = segmented({
    label: t("놀이"),
    small: true,
    value: mode,
    options: [
      { id: "morra", name: t("모라") },
      { id: "oddeven", name: t("홀짝") },
    ],
    onChange: (v) => ((mode = v), newGame()),
  });
  const sSeg = segmented({
    label: t("내가 맡을 쪽"),
    small: true,
    value: String(mySide),
    options: [
      { id: "0", name: t("홀") },
      { id: "1", name: t("짝") },
    ],
    onChange: (v) => ((mySide = Number(v)), newGame()),
  });

  const key = () => (mode === "morra" ? "morra" : "morra-oddeven");
  const parity = (n) => (n % 2 ? t("홀") : t("짝"));

  function sync() {
    fRow.set(fingers);
    gRow.set(guess);
    // 외칠 합은 내 손가락보다 작을 수 없고, 내 손가락 + 5 보다 클 수 없다
    gRow.disable((v) => fingers !== null && (v < fingers || v > fingers + MAX_FINGERS));
    if (guess !== null && fingers !== null && (guess < fingers || guess > fingers + MAX_FINGERS)) {
      guess = null;
      gRow.set(null);
    }
    go.disabled = busy || game.done || fingers === null || (mode === "morra" && guess === null);
  }

  function newGame() {
    game = mode === "morra" ? createMorra({ target: TARGET }) : createOddEven({ target: TARGET, odd: mySide === 0 ? 0 : 1 });
    busy = false;
    doneBar.hidden = true;
    gRow.el.hidden = mode !== "morra";
    sSeg.el.hidden = mode === "morra";
    log.clear();
    st.reset();
    st.me.set(null, null);
    st.op.set(null, null);
    st.say("");
    st.sub(
      mode === "morra"
        ? t("손가락 수와 외칠 합을 고르자.")
        : mySide === 0
          ? t("합이 홀이면 내가, 짝이면 컴퓨터가 1점.")
          : t("합이 짝이면 내가, 홀이면 컴퓨터가 1점."),
    );
    score.set(0, 0, t("{n}점 먼저", { n: TARGET }));
    rec.textContent = recordLine(record(key()));
    steps.set(0);
    sync();
  }

  async function play() {
    if (busy || game.done || go.disabled) return;
    busy = true;
    fRow.lock(true);
    gRow.lock(true);
    sync();
    st.reset();
    st.me.set(null, null);
    st.op.set(null, null);
    await chant(st, countChant());
    const c = morraPick(rng);
    let line;
    if (mode === "morra") {
      const r = game.play(fingers, guess, c.fingers, c.guess);
      st.me.text(String(fingers), t("{g}!", { g: guess }));
      st.op.text(String(c.fingers), t("{g}!", { g: c.guess }));
      const who = r.point === 0 ? t("내가 맞혔다") : r.point === 1 ? t("컴퓨터가 맞혔다") : r.hit[0] ? t("둘 다 맞혔다") : t("아무도 못 맞혔다");
      st.say(t("합 {s}", { s: r.sum }), r.point === 0 ? "win" : r.point === 1 ? "lose" : "");
      st.sub(who);
      if (r.point !== null) (r.point === 0 ? st.me : st.op).mark("won");
      line = t("{a} + {b} = {s}. 나 {x}, 컴퓨터 {y}. {who}.", { a: fingers, b: c.fingers, s: r.sum, x: guess, y: c.guess, who });
      log.add(line, r.point === 0 ? "w" : r.point === 1 ? "l" : "");
    } else {
      const r = game.play(fingers, c.fingers);
      st.me.text(String(fingers), mySide === 0 ? t("홀") : t("짝"));
      st.op.text(String(c.fingers), mySide === 0 ? t("짝") : t("홀"));
      st.say(t("합 {s}, {p}", { s: r.sum, p: parity(r.sum) }), r.winner === 0 ? "win" : "lose");
      st.sub(r.winner === 0 ? t("내가 1점") : t("컴퓨터가 1점"));
      (r.winner === 0 ? st.me : st.op).mark("won");
      line = t("{a} + {b} = {s}, {p}. {who}.", { a: fingers, b: c.fingers, s: r.sum, p: parity(r.sum), who: r.winner === 0 ? t("내가 1점") : t("컴퓨터가 1점") });
      log.add(line, r.winner === 0 ? "w" : "l");
    }
    score.set(game.score[0], game.score[1], t("{n}점 먼저", { n: TARGET }));
    steps.set(game.done ? 2 : 1);
    if (game.done) {
      const won = game.winner === 0;
      st.say(won ? t("이겼다!") : t("졌다"), won ? "win" : "lose");
      rec.textContent = recordLine(addRecord(key(), won ? 1 : -1));
      clear(doneBar).append(
        h("strong", {}, won ? t("{n}점 먼저 냈다", { n: TARGET }) : t("컴퓨터가 {n}점 먼저 냈다", { n: TARGET })),
        h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")),
      );
      doneBar.hidden = false;
    }
    fRow.lock(false);
    gRow.lock(false);
    busy = false;
    sync();
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(t("하는 법"), steps.el),
    h(
      "p",
      { class: "note" },
      h("b", {}, t("합은 여섯 가지 가운데 하나다. ")),
      t("내 손가락 수는 내가 아니까, 합은 내 손가락에 상대 손가락 0~5를 더한 수다. 상대가 아무렇게나 내면 그 여섯 가운데 무엇을 외쳐도 맞힐 확률은 1/6이다. 홀짝은 반반이다."),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("{name} 하기", { name: entry.name }) },
    h("div", { class: "controls" }, mSeg.el, sSeg.el, fastToggle()),
    score.el,
    st.el,
    fRow.el,
    gRow.el,
    go,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return {
    onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return false;
      if (/^[0-5]$/.test(e.key) && !busy && !game.done) {
        fingers = Number(e.key);
        sync();
        return true;
      }
      if (e.key === "Enter" && !go.disabled) {
        play();
        return true;
      }
      return false;
    },
    destroy: () => (busy = true),
  };
}
