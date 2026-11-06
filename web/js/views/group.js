// 여럿이 가위바위보 화면.

import { h, clear, pct, sleep } from "../ui/dom.js";
import { compileVariant, groupDecisiveChance } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createGroup } from "../games/group.js";
import { handGrid, chant, fastToggle, block, segmented, recordLine, stage } from "../ui/widgets.js";
import { entryHead, entryBody } from "./common.js";
import { flowLayout, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

export function groupView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  let players = 5;
  let mode = "survive";
  let game = null;
  let busy = false;
  let last = {};

  const st = stage();
  st.el.classList.add("stage-solo");
  const circle = h("div", { class: "circle", "aria-label": "모인 사람" });
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("group")));
  const chanceLine = h("p", { class: "note", style: { margin: "0 0 14px" } });
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const finishBtn = h("button", { class: "btn", type: "button", hidden: true, onclick: () => autoFinish() }, "남은 사람끼리 마저 하기");
  const grid = handGrid(V, { onPick: (i) => round(i) });

  const pSeg = segmented({
    label: "사람 수",
    small: true,
    value: String(players),
    options: [3, 4, 5, 6, 8, 10].map((n) => ({ id: String(n), name: `${n}명` })),
    onChange: (v) => ((players = Number(v)), newGame()),
  });
  const mSeg = segmented({
    label: "무엇을 정하나",
    small: true,
    value: mode,
    options: [
      { id: "survive", name: "마지막 한 명" },
      { id: "loser", name: "술래 한 명" },
    ],
    onChange: (v) => ((mode = v), newGame()),
  });

  const name = (p) => (p === 0 ? "나" : `컴퓨터 ${p}`);

  function draw() {
    clear(circle).append(
      ...Array.from({ length: players }, (_, p) => {
        const alive = game.alive.includes(p);
        let status = alive ? "남음" : mode === "survive" ? "빠짐" : "빠져나감";
        if (game.done && p === game.last) status = mode === "survive" ? "우승" : "술래";
        const t = last[p];
        return h(
          "div",
          { class: "person" + (p === 0 ? " me" : "") + (alive || (game.done && p === game.last) ? "" : " out") },
          h("span", { class: "face", "aria-hidden": "true" }, t === undefined ? (p === 0 ? "🙂" : "🤖") : V.hands[t].emoji),
          h("span", { class: "nm" }, name(p)),
          h("span", { class: "st" }, status),
        );
      }),
    );
    const meIn = game.alive.includes(0);
    grid.el.hidden = game.done || !meIn;
    finishBtn.hidden = game.done || meIn;
    if (!game.done) {
      const c = groupDecisiveChance(game.alive.length);
      chanceLine.textContent = `${game.alive.length}명이 아무렇게나 내면 이번에 승부가 날 확률은 ${pct(c)}. 나머지는 다시 한다.`;
    } else chanceLine.textContent = `${game.rounds.length}번 던져서 끝났다.`;
  }

  function newGame() {
    game = createGroup(V, { players, mode });
    last = {};
    busy = false;
    doneBar.hidden = true;
    grid.lock(false);
    log.clear();
    st.say("");
    st.sub(mode === "survive" ? "이긴 손을 낸 사람만 남는다. 마지막 한 명이 이긴다." : "진 손을 낸 사람만 남는다. 마지막 한 명이 술래.");
    draw();
  }

  function apply(my) {
    const throws = {};
    game.alive.forEach((p) => (throws[p] = p === 0 ? my : rng.int(V.n)));
    last = throws;
    const r = game.play(throws);
    const kinds = [...new Set(game.rounds[game.rounds.length - 1].alive.map((p) => throws[p]))];
    if (r.winnerHand === null) {
      const why = kinds.length === 1 ? `모두 ${V.hands[kinds[0]].name}` : "세 가지가 다 나왔다";
      st.say("다시!");
      st.sub(`${why}. 아무도 빠지지 않는다.`);
      log.add(`${r.alive.length}명: ${why}. 다시.`);
    } else {
      const w = V.hands[r.winnerHand].name;
      const outNames = r.out.map(name).join(", ");
      st.say(`${w} 승`);
      st.sub(`${mode === "survive" ? `${outNames} 빠짐` : `${outNames} 빠져나감`}.`);
      log.add(`${r.alive.length}명: ${w} 손이 이겼다. ${outNames} ${mode === "survive" ? "탈락" : "통과"}.`);
    }
    if (game.done) finish();
    draw();
  }

  async function round(i) {
    if (busy || game.done) return;
    busy = true;
    grid.lock(true);
    await chant(st, ["가위!", "바위!", "보!"]);
    apply(i);
    grid.lock(false);
    busy = false;
  }

  async function autoFinish() {
    if (busy) return;
    busy = true;
    finishBtn.disabled = true;
    while (!game.done) {
      apply(null);
      await sleep(260);
    }
    finishBtn.disabled = false;
    busy = false;
  }

  function finish() {
    const meLast = game.last === 0;
    const good = mode === "survive" ? meLast : !meLast;
    st.say(mode === "survive" ? `${name(game.last)} 우승` : `${name(game.last)} 술래`, good ? "win" : "lose");
    rec.textContent = recordLine(addRecord("group", good ? 1 : -1));
    clear(doneBar).append(
      h("strong", {}, mode === "survive" ? (meLast ? "끝까지 살아남았다" : `${name(game.last)} 우승`) : meLast ? "내가 술래" : "술래를 피했다"),
      h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, "한 판 더"),
    );
    doneBar.hidden = false;
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(
      "사람이 많으면",
      h("p", {}, "한 번에 승부가 나려면 딱 두 가지 손만 나와야 한다. 셋이면 2/3 확률로 승부가 나지만, 사람이 늘수록 세 가지가 다 나오기 쉬워진다."),
      h("p", { class: "field-label", style: { margin: "4px 0 8px" } }, "모두 아무렇게나 낼 때 한 번에 승부가 날 확률"),
      h("dl", { class: "aka" }, [3, 4, 5, 6, 8, 10].map((n) => [h("dt", {}, `${n}명`), h("dd", {}, pct(groupDecisiveChance(n)))])),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": "여럿이 가위바위보 하기" },
    h("div", { class: "controls" }, pSeg.el, mSeg.el, fastToggle()),
    chanceLine,
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
