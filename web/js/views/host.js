// 진행자 이기기 화면. 컴퓨터 진행자가 먼저 손을 정하고, 나와 컴퓨터들이 각자 낸다.

import { h, clear, sleep } from "../ui/dom.js";
import { t, lower, listWords } from "../i18n.js";
import { handArt } from "../ui/art.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createHostGame } from "../games/host.js";
import { handGrid, chant, fastToggle, block, segmented, recordLine, stage, rpsChant } from "../ui/widgets.js";
import { entryHead, entryBody } from "./common.js";
import { flowLayout, stepList, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

const ROUNDS = 10;

export function hostView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  let players = 10;
  let game = null;
  let busy = false;
  let last = null; // 마지막 판 기록

  const st = stage({ meLabel: t("나"), opLabel: t("진행자") });
  const circle = h("div", { class: "circle", "aria-label": t("모인 사람") });
  const status = h("p", { class: "note", style: { margin: "0 0 14px" } });
  const steps = stepList([t("진행자가 먼저 손을 정한다"), t("모두 각자 낸다"), t("진행자에게 지면 빠지고, 이기면 10점, 비기면 5점")]);
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("host")));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const finishBtn = h("button", { class: "btn", type: "button", hidden: true, onclick: () => autoFinish() }, t("남은 사람끼리 마저 하기"));
  const grid = handGrid(V, { onPick: (i) => round(i) });

  const pSeg = segmented({
    label: t("사람 수"),
    small: true,
    value: String(players),
    options: [5, 10, 20].map((n) => ({ id: String(n), name: t("{n}명", { n }) })),
    onChange: (v) => ((players = Number(v)), newGame()),
  });

  const name = (p) => (p === 0 ? t("나") : t("컴퓨터 {n}", { n: p }));
  const RESULT = { win: () => t("이김"), draw: () => t("비김"), lose: () => t("짐") };

  function draw() {
    const out = new Set();
    for (const r of game.log) for (const p of r.out) out.add(p);
    clear(circle).append(
      ...Array.from({ length: players }, (_, p) => {
        const gone = out.has(p);
        const won = game.done && game.winners.includes(p);
        const th = last && p in last.throws ? last.throws[p] : null;
        const res = last && last.result[p] ? RESULT[last.result[p]]() : "";
        const st = won ? t("우승") : gone ? t("빠짐") : t("{n}점", { n: game.score[p] });
        return h(
          "div",
          { class: "person" + (p === 0 ? " me" : "") + (gone ? " out" : "") },
          h("span", { class: "face", "aria-hidden": "true" }, th === null ? (p === 0 ? "🙂" : "🤖") : handArt(V.hands[th])),
          h("span", { class: "nm" }, name(p)),
          h("span", { class: "st" }, res && !game.done ? `${res} · ${st}` : st),
        );
      }),
    );
    const meIn = game.alive.includes(0);
    grid.el.hidden = game.done || !meIn;
    finishBtn.hidden = game.done || meIn;
    status.textContent = game.done
      ? t("{n}판 만에 끝났다.", { n: game.round })
      : t("{r}판째다. 남은 사람은 {n}명, 내 점수는 {s}점이다.", { r: game.round + 1, n: game.alive.length, s: game.score[0] });
    steps.set(game.done ? 2 : 1);
  }

  function newGame() {
    game = createHostGame(V, { players, rounds: ROUNDS });
    last = null;
    busy = false;
    doneBar.hidden = true;
    grid.lock(false);
    log.clear();
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    st.say("");
    st.sub(t("진행자는 이미 손을 정했다. 지지 않을 손을 고르자."));
    draw();
  }

  function apply(my) {
    const host = rng.int(V.n);
    const throws = {};
    game.alive.forEach((p) => (throws[p] = p === 0 ? my : rng.int(V.n)));
    const meIn = game.alive.includes(0);
    const r = game.play(host, throws);
    last = r;
    st.reset();
    st.op.set(V, host);
    if (meIn) st.me.set(V, my);
    else st.me.set(V, null);
    const hostName = lower(V.hands[host].name);
    if (r.voided) {
      st.say(t("없던 판"));
      st.sub(t("남은 사람이 모두 졌다. 다시 한다."));
      log.add(t("진행자 {h}: 남은 사람이 모두 져서 없던 판으로 했다.", { h: hostName }));
    } else {
      const mine = meIn ? r.result[0] : null;
      if (mine) {
        st.say(mine === "win" ? t("이겼다! +10점") : mine === "draw" ? t("비겼다. +5점") : t("졌다. 빠진다"), mine === "lose" ? "lose" : mine === "win" ? "win" : "");
        st.me.mark(mine === "win" ? "won" : mine === "lose" ? "lost" : null);
      } else st.say(t("진행자 {h}", { h: V.hands[host].name }));
      const outNames = r.out.map(name);
      st.sub(outNames.length ? t("{names} 빠짐.", { names: listWords(outNames) }) : t("아무도 빠지지 않았다."));
      log.add(
        outNames.length
          ? t("{r}판: 진행자 {h}. {names} 빠짐.", { r: r.round, h: hostName, names: listWords(outNames) })
          : t("{r}판: 진행자 {h}. 아무도 빠지지 않았다.", { r: r.round, h: hostName }),
        mine === "lose" ? "l" : mine === "win" ? "w" : "",
      );
    }
    if (game.done) finish();
    draw();
  }

  async function round(i) {
    if (busy || game.done) return;
    busy = true;
    grid.lock(true);
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    await chant(st, rpsChant());
    apply(i);
    if (!game.done) grid.lock(false);
    busy = false;
  }

  async function autoFinish() {
    if (busy) return;
    busy = true;
    finishBtn.disabled = true;
    const g = game;
    while (game === g && !g.done) {
      apply(null);
      await sleep(320);
    }
    finishBtn.disabled = false;
    if (game === g) busy = false;
  }

  function finish() {
    const ws = game.winners;
    const meWon = ws.includes(0);
    const alone = ws.length === 1;
    const who = listWords(ws.map(name));
    st.say(meWon ? (alone ? t("나 우승") : t("공동 우승")) : alone ? t("{who} 우승", { who }) : t("{who} 공동 우승", { who }), meWon ? "win" : "lose");
    st.sub(alone && game.alive.length === 1 ? t("혼자 남았다.") : t("{n}판을 다 했다. 점수가 가장 높은 사람이 이긴다.", { n: game.rounds }));
    rec.textContent = recordLine(addRecord("host", meWon ? 1 : -1));
    clear(doneBar).append(
      h("strong", {}, meWon ? (alone ? t("진행자를 이겨 냈다") : t("공동 우승")) : t("{who} 우승", { who })),
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
      h("b", {}, t("어떤 손이든 같다. ")),
      t("진행자가 아무렇게나 내면 판마다 질 확률은 1/3이다. 10명이면 한 판에 평균 3명쯤 빠지고, 내가 10판을 다 버틸 확률은 2%쯤이다."),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("{name} 하기", { name: entry.name }) },
    h("div", { class: "controls" }, pSeg.el, fastToggle()),
    status,
    circle,
    st.el,
    grid.el,
    finishBtn,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return { onKey: (e) => (!grid.el.hidden ? grid.keyHandler(e) : false), destroy: () => (busy = true) };
}
