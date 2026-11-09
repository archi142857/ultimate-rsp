// 편 가르기 화면. 모두 바위나 보를 내서 같은 손끼리 한 편이 된다. 두 편 수가 고를 때까지 다시 낸다.

import { h, clear, pct } from "../ui/dom.js";
import { t, num } from "../i18n.js";
import { handArt } from "../ui/art.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createTeamSplit, splitChance, expectedSplitTries } from "../games/teams.js";
import { chant, fastToggle, block, segmented, stage, countChant } from "../ui/widgets.js";
import { entryHead, entryBody } from "./common.js";
import { flowLayout, logList } from "./flow.js";

const SIZES = [4, 6, 8, 10, 12];

export function teamSplitView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  const SIDES = [V.hands[V.index.rock], V.hands[V.index.paper]]; // 0 = 바위 편, 1 = 보 편
  let players = 8;
  let game = null;
  let busy = false;
  let picks = null;

  const st = stage();
  st.el.classList.add("stage-solo");
  const status = h("p", { class: "note", style: { margin: "0 0 14px" } });
  const board = h("div", { class: "teams", "aria-live": "polite" });
  const log = logList();
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const btns = SIDES.map((hd, side) =>
    h(
      "button",
      { type: "button", class: "hand", "aria-keyshortcuts": String(side + 1), onclick: () => throwIt(side) },
      handArt(hd, "hand-emoji"),
      h("span", { class: "hand-name" }, hd.name),
      h("span", { class: "hand-key", "aria-hidden": "true" }, String(side + 1)),
    ),
  );
  const pad = h("div", { class: "hands", role: "group", "aria-label": t("낼 손") }, btns);

  const pSeg = segmented({
    label: t("사람 수"),
    small: true,
    value: String(players),
    options: SIZES.map((n) => ({ id: String(n), name: t("{n}명", { n }) })),
    onChange: (v) => ((players = Number(v)), newGame()),
  });

  const name = (p) => (p === 0 ? t("나") : t("컴퓨터 {n}", { n: p }));

  function person(p) {
    return h(
      "div",
      { class: "person" + (p === 0 ? " me" : "") },
      h("span", { class: "face", "aria-hidden": "true" }, picks ? handArt(SIDES[picks[p]]) : p === 0 ? "🙂" : "🤖"),
      h("span", { class: "nm" }, name(p)),
    );
  }

  function draw() {
    const all = Array.from({ length: players }, (_, p) => p);
    clear(board).append(
      ...[0, 1].map((side) => {
        const list = picks ? all.filter((p) => picks[p] === side) : side === 0 ? all : [];
        const mine = picks ? picks[0] === side : side === 0;
        return h(
          "div",
          { class: "team" + (mine ? " mine" : "") },
          h("div", { class: "team-head" }, h("span", {}, picks ? t("{h} 편", { h: SIDES[side].name }) : side === 0 ? t("모인 사람") : t("아직 안 냄")), picks ? h("b", {}, String(list.length)) : null),
          h("div", { class: "circle" }, list.map(person)),
        );
      }),
    );
    status.textContent = game.done
      ? t("{n}번 만에 갈림", { n: game.tries })
      : t("{n}명이 아무렇게나 내면 한 번에 고르게 갈릴 확률은 {p}다.", { n: players, p: pct(splitChance(players)) });
    pad.hidden = game.done;
  }

  function newGame() {
    game = createTeamSplit({ players });
    picks = null;
    busy = false;
    doneBar.hidden = true;
    pad.classList.remove("locked");
    log.clear();
    st.reset();
    st.me.set(V, null);
    st.say("");
    st.sub(players % 2 ? t("두 편이 한 명 차이가 될 때까지 다시 냄") : t("두 편이 똑같이 {n}명씩 될 때까지 다시 냄", { n: players / 2 }));
    draw();
  }

  async function throwIt(side) {
    if (busy || game.done) return;
    busy = true;
    pad.classList.add("locked");
    picks = null;
    draw();
    await chant(st, countChant());
    const all = Array.from({ length: players }, (_, p) => (p === 0 ? side : rng.int(2)));
    const r = game.play(all);
    picks = all;
    const [a, b] = r.counts;
    st.say(r.even ? t("갈림!") : t("다시!"), r.even ? "win" : "");
    st.sub(t("{x} {a}명, {y} {b}명", { x: SIDES[0].name, a, y: SIDES[1].name, b }));
    log.add(t("{n}번째: {x} {a}명, {y} {b}명.", { n: r.try, x: SIDES[0].name, a, y: SIDES[1].name, b }) + (r.even ? "" : " " + t("다시.")), r.even ? "w" : "");
    if (game.done) {
      clear(doneBar).append(
        h("strong", {}, t("{h} 편이 됨", { h: SIDES[side].name })),
        h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("다시 가르기")),
      );
      doneBar.hidden = false;
    }
    draw();
    pad.classList.remove("locked");
    busy = false;
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(
      t("갈리기까지 내는 횟수"),
      h("p", {}, t("사람이 많을수록 한 번에 고르게 갈리기 어렵습니다. 홀수면 한 명 차이까지 고르게 봅니다.")),
      h("p", { class: "field-label", style: { margin: "4px 0 8px" } }, t("모두 아무렇게나 낼 때: 한 번에 갈릴 확률, 평균 내는 횟수")),
      h(
        "dl",
        { class: "aka" },
        SIZES.map((n) => [h("dt", {}, t("{n}명", { n })), h("dd", {}, t("{p}, {k}번", { p: pct(splitChance(n)), k: num(Math.round(expectedSplitTries(n) * 10) / 10) }))]),
      ),
    ),
  );
  const panel = h("section", { class: "panel", "aria-label": t("{name} 하기", { name: entry.name }) }, h("div", { class: "controls" }, pSeg.el, fastToggle()), status, board, st.el, pad, doneBar, log.el);
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return {
    onKey(e) {
      if (pad.hidden || e.altKey || e.ctrlKey || e.metaKey) return false;
      if (e.key === "1" || e.key === "2") {
        throwIt(Number(e.key) - 1);
        return true;
      }
      return false;
    },
    destroy: () => (busy = true),
  };
}
