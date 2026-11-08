// 여럿이 가위바위보 화면.

import { h, clear, pct, sleep } from "../ui/dom.js";
import { t, lower, listWords } from "../i18n.js";
import { handArt } from "../ui/art.js";
import { compileVariant, groupDecisiveChance } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createGroup } from "../games/group.js";
import { handGrid, chant, fastToggle, block, segmented, recordLine, stage, rpsChant } from "../ui/widgets.js";
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
  const circle = h("div", { class: "circle", "aria-label": t("모인 사람") });
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("group")));
  const chanceLine = h("p", { class: "note", style: { margin: "0 0 14px" } });
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const finishBtn = h("button", { class: "btn", type: "button", hidden: true, onclick: () => autoFinish() }, t("남은 사람끼리 마저 하기"));
  const grid = handGrid(V, { onPick: (i) => round(i) });

  const pSeg = segmented({
    label: t("사람 수"),
    small: true,
    value: String(players),
    options: [3, 4, 5, 6, 8, 10].map((n) => ({ id: String(n), name: t("{n}명", { n }) })),
    onChange: (v) => ((players = Number(v)), newGame()),
  });
  const mSeg = segmented({
    label: t("무엇을 정하나"),
    small: true,
    value: mode,
    options: [
      { id: "survive", name: t("마지막 한 명") },
      { id: "loser", name: t("술래 한 명") },
    ],
    onChange: (v) => ((mode = v), newGame()),
  });

  const name = (p) => (p === 0 ? t("나") : t("컴퓨터 {n}", { n: p }));

  function draw() {
    clear(circle).append(
      ...Array.from({ length: players }, (_, p) => {
        const alive = game.alive.includes(p);
        let status = alive ? t("남음") : mode === "survive" ? t("빠짐") : t("빠져나감");
        if (game.done && p === game.last) status = mode === "survive" ? t("우승") : t("술래");
        const th = last[p];
        return h(
          "div",
          { class: "person" + (p === 0 ? " me" : "") + (alive || (game.done && p === game.last) ? "" : " out") },
          h("span", { class: "face", "aria-hidden": "true" }, th === undefined ? (p === 0 ? "🙂" : "🤖") : handArt(V.hands[th])),
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
      chanceLine.textContent = t("{n}명이 아무렇게나 내면 이번에 승부가 날 확률은 {p}. 나지 않으면 다시 낸다.", { n: game.alive.length, p: pct(c) });
    } else chanceLine.textContent = t("{n}번 만에 끝났다.", { n: game.rounds.length });
  }

  function newGame() {
    game = createGroup(V, { players, mode });
    last = {};
    busy = false;
    doneBar.hidden = true;
    grid.lock(false);
    log.clear();
    st.say("");
    st.sub(mode === "survive" ? t("이긴 손을 낸 사람만 남는다. 마지막 한 명이 이긴다.") : t("진 손을 낸 사람만 남는다. 마지막 한 명이 술래다."));
    draw();
  }

  function apply(my) {
    const throws = {};
    game.alive.forEach((p) => (throws[p] = p === 0 ? my : rng.int(V.n)));
    last = throws;
    const r = game.play(throws);
    const kinds = [...new Set(game.rounds[game.rounds.length - 1].alive.map((p) => throws[p]))];
    if (r.winnerHand === null) {
      const why = kinds.length === 1 ? t("모두 {h}", { h: lower(V.hands[kinds[0]].name) }) : t("세 가지가 다 나왔다");
      st.say(t("다시!"));
      st.sub(t("{why}. 아무도 빠지지 않는다.", { why }));
      log.add(t("{n}명: {why}. 다시.", { n: r.alive.length, why }));
    } else {
      const w = V.hands[r.winnerHand].name;
      const outNames = listWords(r.out.map(name));
      st.say(t("{h} 승", { h: w }));
      st.sub(mode === "survive" ? t("{names} 빠짐.", { names: outNames }) : t("{names} 빠져나감.", { names: outNames }));
      const lv = { n: r.alive.length, h: lower(w), names: outNames };
      log.add(mode === "survive" ? t("{n}명: {h} 손이 이겼다. {names} 탈락.", lv) : t("{n}명: {h} 손이 이겼다. {names} 통과.", lv));
    }
    if (game.done) finish();
    draw();
  }

  async function round(i) {
    if (busy || game.done) return;
    busy = true;
    grid.lock(true);
    await chant(st, rpsChant());
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
    const who = name(game.last);
    st.say(mode === "survive" ? (meLast ? t("나 우승") : t("{who} 우승", { who })) : meLast ? t("나 술래") : t("{who} 술래", { who }), good ? "win" : "lose");
    rec.textContent = recordLine(addRecord("group", good ? 1 : -1));
    clear(doneBar).append(
      h("strong", {}, mode === "survive" ? (meLast ? t("끝까지 살아남았다") : t("{who} 우승", { who })) : meLast ? t("내가 술래") : t("술래를 피했다")),
      h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")),
    );
    doneBar.hidden = false;
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(
      t("사람이 많으면"),
      h("p", {}, t("한 번에 승부가 나려면 딱 두 가지 손만 나와야 한다. 셋이면 2/3 확률로 승부가 나지만, 사람이 늘수록 세 가지가 다 나오기 쉬워진다.")),
      h("p", { class: "field-label", style: { margin: "4px 0 8px" } }, t("모두 아무렇게나 낼 때 한 번에 승부가 날 확률")),
      h("dl", { class: "aka" }, [3, 4, 5, 6, 8, 10].map((n) => [h("dt", {}, t("{n}명", { n })), h("dd", {}, pct(groupDecisiveChance(n)))])),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("여럿이 가위바위보 하기") },
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
