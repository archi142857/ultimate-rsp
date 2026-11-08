// 명령 가위바위보 화면: 30초 동안 시키는 대로 이기고, 지고, 비긴다.

import { h, clear } from "../ui/dom.js";
import { t, lower, listWords } from "../i18n.js";
import { handArt, setArt } from "../ui/art.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createCommand, ORDERS } from "../games/command.js";
import { handGrid, block } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout } from "./flow.js";
import { load, save } from "../ui/store.js";

export function commandView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  let game = null;
  let running = false;
  let t0 = 0;
  let raf = 0;
  let shownAt = 0;
  let best = load("commandBest", 0);

  const score = scoreboard({ meLabel: t("맞힘"), opLabel: t("틀림") });
  const handEl = h("div", { class: "cmd-hand", "aria-hidden": "true" }, handArt(V.hands[V.index.rock]));
  const orderEl = h("div", { class: "cmd-order" }, t("준비"));
  const sayEl = h("p", { class: "sr", "aria-live": "assertive" });
  const feedback = h("p", { class: "stage-sub", style: { textAlign: "center", minHeight: "1.6em" } });
  const timerFill = h("span");
  const timer = h("div", { class: "timer", role: "progressbar", "aria-label": t("남은 시간"), "aria-valuemin": 0, "aria-valuemax": 30 }, timerFill);
  const startBtn = h("button", { class: "btn btn-ink", type: "button", onclick: () => start() }, t("시작"));
  const bestLine = h("p", { class: "rec" }, bestText());
  const grid = handGrid(V, { onPick: (i) => answer(i) });
  grid.lock(true);

  function bestText() {
    return best ? t("가장 많이 맞힌 기록은 {n}개.", { n: best }) : t("아직 기록이 없다.");
  }

  function orderText(id, name) {
    if (id === "draw") return t("{h:과와} 비겨라", { h: name });
    return id === "win" ? t("{h}에게 이겨라", { h: name }) : t("{h}에게 져라", { h: name });
  }

  function show() {
    const p = game.next();
    setArt(handEl, V.hands[p.hand]);
    orderEl.textContent = orderText(p.order.id, lower(V.hands[p.hand].name));
    sayEl.textContent = orderEl.textContent;
    shownAt = performance.now();
  }

  function start() {
    game = createCommand(V, rng, 30);
    running = true;
    startBtn.disabled = true;
    feedback.textContent = "";
    score.set(0, 0, t("{n}초", { n: 30 }));
    grid.lock(false);
    show();
    t0 = performance.now();
    tick();
  }

  function tick() {
    const left = Math.max(0, game.seconds - (performance.now() - t0) / 1000);
    timerFill.style.width = `${(100 * left) / game.seconds}%`;
    timer.setAttribute("aria-valuenow", Math.ceil(left));
    score.set(game.score, game.miss, t("{n}초", { n: Math.ceil(left) }));
    if (left <= 0) return finish();
    raf = requestAnimationFrame(tick);
  }

  function answer(i) {
    if (!running) return;
    const ms = performance.now() - shownAt;
    const p = game.prompt;
    const ok = game.answer(i, ms);
    const v = { h: lower(V.hands[p.hand].name), a: listWords(game.answers(p).map((x) => lower(V.hands[x].name))) };
    const miss = p.order.id === "draw" ? t("틀렸다. {h:과와} 비기려면 {a}.", v) : p.order.id === "win" ? t("틀렸다. {h}에게 이기려면 {a}.", v) : t("틀렸다. {h}에게 지려면 {a}.", v);
    feedback.textContent = ok ? t("맞았다. {n}초", { n: (ms / 1000).toFixed(2) }) : miss;
    feedback.style.color = ok ? "var(--win)" : "var(--lose)";
    show();
  }

  function finish() {
    running = false;
    cancelAnimationFrame(raf);
    grid.lock(true);
    startBtn.disabled = false;
    startBtn.textContent = t("다시");
    const okTimes = game.log.filter((x) => x.ok);
    const avg = okTimes.length ? okTimes.reduce((a, b) => a + b.ms, 0) / okTimes.length / 1000 : 0;
    const byOrder = ["win", "lose", "draw"].map((id) => {
      const xs = game.log.filter((x) => x.order.id === id);
      return xs.length ? `${ORDERS.find((o) => o.id === id).name} ${xs.filter((x) => x.ok).length}/${xs.length}` : null;
    });
    if (game.score > best) {
      best = game.score;
      save("commandBest", best);
    }
    handEl.textContent = "⏱️";
    orderEl.textContent = t("{n}개", { n: game.score });
    feedback.style.color = "";
    feedback.textContent = t("틀린 것 {m}개. 맞힌 것은 평균 {s}초. {list}", { m: game.miss, s: avg.toFixed(2), list: byOrder.filter(Boolean).join(", ") });
    bestLine.textContent = bestText();
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(
      t("해 보면 안다"),
      h("p", {}, t("'이겨라'와 '져라' 가운데 어느 쪽에서 더 머뭇거리는지 재 보자. 끝나면 명령마다 몇 개를 맞혔는지 보여 준다.")),
      h("p", {}, t("숫자 키 1, 2, 3으로도 낼 수 있다. 엔터를 누르면 시작한다.")),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("명령 가위바위보 하기") },
    score.el,
    timer,
    h("div", { class: "cmd-prompt" }, handEl, orderEl, sayEl),
    feedback,
    grid.el,
    h("div", { class: "btn-row", style: { marginTop: "16px" } }, startBtn),
    bestLine,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  score.set(0, 0, t("{n}초", { n: 30 }));
  return {
    onKey: (e) => {
      if (!running && (e.key === "Enter" || e.key === " ") && !startBtn.disabled) {
        start();
        return true;
      }
      return running ? grid.keyHandler(e) : false;
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
