// 다이너마이트와 물풍선 화면.

import { h, clear } from "../ui/dom.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { createMatch } from "../games/match.js";
import { DWB_DEF, createDwbBot } from "../games/dynamitewb.js";
import { createRing } from "../ui/ring.js";
import { handGrid, stage, chant, fastToggle, block, segmented, selectBox, recordLine } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard, histItem } from "./common.js";
import { flowLayout } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

export function dynamiteWbView(main, entry) {
  const V = compileVariant(DWB_DEF);
  const D = V.index.dynamite;
  const rng = makeRng();
  let target = 7;
  let dyn = 3;
  let carry = true;
  let botKind = "bomber";
  let bot = createDwbBot(V, rng, botKind);
  let match = null;
  let busy = false;

  const ring = createRing(V, { size: 360 });
  const st = stage();
  const score = scoreboard();
  const hist = h("ol", { class: "hist", "aria-label": "지난 판" });
  const rec = h("p", { class: "rec" }, recordLine(record("dynamitewb")));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const potLine = h("p", { class: "note", style: { margin: "0 0 14px" } });
  const grid = handGrid(V, { onPick: (i) => play(i) });

  const targetSeg = segmented({
    label: "먼저",
    small: true,
    value: String(target),
    options: [5, 7, 10].map((t) => ({ id: String(t), name: `${t}점` })),
    onChange: (v) => ((target = Number(v)), newMatch()),
  });
  const dynSeg = segmented({
    label: "다이너마이트",
    small: true,
    value: String(dyn),
    options: [1, 3, 5].map((t) => ({ id: String(t), name: `${t}개` })),
    onChange: (v) => ((dyn = Number(v)), newMatch()),
  });
  const carryBox = h("input", { type: "checkbox", checked: carry, id: "dwb-carry", onchange: () => ((carry = carryBox.checked), newMatch()) });
  const botSel = selectBox({
    label: "컴퓨터",
    value: botKind,
    options: [
      { id: "bomber", name: "폭탄 꾼" },
      { id: "random", name: "주사위" },
    ],
    onChange: (v) => ((botKind = v), (bot = createDwbBot(V, rng, v)), newMatch()),
  });

  function draw() {
    const pot = match.pot;
    score.set(match.score[0], match.score[1], `먼저 ${target}점`);
    grid.setAllowed(match.allowed(0));
    grid.setCount(D, match.uses[0][D]);
    potLine.textContent = carry
      ? pot > 1
        ? `비긴 점수가 쌓였다. 다음 판에 이기면 ${pot}점. 내 다이너마이트 ${match.uses[0][D]}개, 컴퓨터 ${match.uses[1][D]}개.`
        : `다음 판은 1점. 내 다이너마이트 ${match.uses[0][D]}개, 컴퓨터 ${match.uses[1][D]}개.`
      : `한 판에 1점. 내 다이너마이트 ${match.uses[0][D]}개, 컴퓨터 ${match.uses[1][D]}개.`;
  }

  function newMatch() {
    match = createMatch(V, { target, limits: { dynamite: dyn }, carry });
    busy = false;
    grid.lock(false);
    doneBar.hidden = true;
    clear(hist);
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    st.say("");
    st.sub("다이너마이트는 아껴 쓰고, 물풍선은 노려서 쓴다.");
    ring.clear();
    draw();
  }

  async function play(i) {
    if (busy || match.done) return;
    busy = true;
    grid.lock(true);
    ring.clear();
    st.reset();
    const j = bot.pick({ rounds: match.rounds, allowed: match.allowed(1), side: 1 });
    st.me.set(V, null);
    st.op.set(V, null);
    await chant(st, ["하나!", "둘!", "셋!"]);
    const r = match.play(i, j);
    st.me.set(V, i);
    st.op.set(V, j);
    st.say(r.cmp === 0 ? "비겼다" : r.cmp > 0 ? `+${r.gain}점` : `−${r.gain}점`, r.cmp > 0 ? "win" : r.cmp < 0 ? "lose" : "");
    st.sub(r.cmp === 0 ? (carry ? `${i === j ? `둘 다 ${V.hands[i].name}` : r.sentence}. 점수가 다음 판으로 넘어간다.` : `${i === j ? `둘 다 ${V.hands[i].name}` : r.sentence}.`) : `${r.sentence}.`);
    st.me.mark(r.cmp > 0 ? "won" : r.cmp < 0 ? "lost" : null);
    st.op.mark(r.cmp < 0 ? "won" : r.cmp > 0 ? "lost" : null);
    ring.bout(i, j);
    hist.prepend(histItem(V, i, j, r.cmp));
    while (hist.children.length > 16) hist.lastChild.remove();
    if (match.done) {
      const won = match.winner === 0;
      rec.textContent = recordLine(addRecord("dynamitewb", won ? 1 : -1));
      clear(doneBar).append(
        h("strong", {}, won ? `${target}점 먼저, 승리` : "컴퓨터가 먼저 닿았다"),
        h("button", { class: "btn btn-ink", type: "button", onclick: newMatch }, "새 경기"),
      );
      doneBar.hidden = false;
    } else grid.lock(false);
    draw();
    busy = false;
  }

  const side = h(
    "div",
    { class: "side-panel" },
    h("div", { class: "ring-box", style: { width: "min(100%, 360px)", margin: "0 auto" } }, ring.el),
    block(
      "언제 터뜨릴까",
      h("p", {}, "다이너마이트를 아무 때나 쓰면 금방 떨어진다. 점수가 쌓인 판에 쓰면 한 번에 여러 점을 가져온다."),
      h("p", {}, "그 버릇을 읽으면 물풍선으로 받아칠 수 있다. 물풍선은 다이너마이트만 이기고 나머지에는 지니, 빗나가면 손해다. '폭탄 꾼'은 이렇게 두고, 상대가 비긴 뒤에 다이너마이트를 자주 쓰면 물풍선을 꺼낸다."),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": "다이너마이트와 물풍선 하기" },
    h(
      "div",
      { class: "controls" },
      botSel.el,
      targetSeg.el,
      dynSeg.el,
      h("label", { class: "check", for: "dwb-carry" }, carryBox, h("span", {}, "비긴 점수 넘기기")),
      fastToggle(),
    ),
    score.el,
    potLine,
    st.el,
    grid.el,
    doneBar,
    hist,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newMatch();
  return { onKey: (e) => grid.keyHandler(e), destroy: () => (busy = true) };
}
