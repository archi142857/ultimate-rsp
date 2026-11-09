// 여럿이 가위바위보 화면. 많은 손 이기기(majority)·셋 다 나오면 가위 승(choki)도 이 화면에 규칙만 바꿔 쓴다.

import { h, clear, pct, sleep } from "../ui/dom.js";
import { t, lower, listWords } from "../i18n.js";
import { handArt } from "../ui/art.js";
import { compileVariant, groupDecisiveChance } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createGroup, winningHand } from "../games/group.js";
import { handGrid, chant, fastToggle, block, segmented, recordLine, stage, rpsChant } from "../ui/widgets.js";
import { entryHead, entryBody } from "./common.js";
import { flowLayout, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

/** preset: { rules: ["majority", "minority"] } 많은 손·적은 손 고르기, { tie3: "scissors" } 셋 다 나오면 가위 승 */
export function groupView(main, entry, params, preset = {}) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  const rules = preset.rules || null;
  const tie3 = preset.tie3 || "redo";
  let rule = rules ? rules[0] : "rps";
  let players = 5;
  let mode = "survive";
  let game = null;
  let busy = false;
  let last = {};

  const st = stage();
  st.el.classList.add("stage-solo");
  const circle = h("div", { class: "circle", "aria-label": t("모인 사람") });
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record(entry.id)));
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

  const rSeg = rules
    ? segmented({
        label: t("이기는 손"),
        small: true,
        value: rule,
        options: [
          { id: "majority", name: t("많은 손") },
          { id: "minority", name: t("적은 손") },
        ],
        onChange: (v) => ((rule = v), newGame(), drawOdds()),
      })
    : null;

  const name = (p) => (p === 0 ? t("나") : t("컴퓨터 {n}", { n: p }));

  /** n명이 아무렇게나 낼 때 한 번에 승부가 날 확률(이 화면 규칙대로. 둘이면 보통 가위바위보) */
  function decisive(n, r = rule) {
    if (n < 2) return 1;
    const fact = (k) => (k <= 1 ? 1 : k * fact(k - 1));
    let p = 0;
    for (let a = 0; a <= n; a++)
      for (let b = 0; a + b <= n; b++) {
        const c = n - a - b;
        const hands = [...Array(a).fill(0), ...Array(b).fill(1), ...Array(c).fill(2)];
        if (winningHand(V, hands, n === 2 ? "rps" : r, r === "rps" ? tie3 : "redo") !== null) p += fact(n) / (fact(a) * fact(b) * fact(c));
      }
    return p / Math.pow(3, n);
  }

  function ruleText() {
    const keep = mode === "survive";
    if (rule === "majority") return keep ? t("가장 많이 나온 손을 낸 사람만 남음. 마지막 한 명이 승리") : t("가장 많이 나온 손을 낸 사람은 빠져나감. 마지막 한 명이 술래");
    if (rule === "minority") return keep ? t("가장 적게 나온 손을 낸 사람만 남음. 마지막 한 명이 승리") : t("가장 적게 나온 손을 낸 사람은 빠져나감. 마지막 한 명이 술래");
    if (tie3 === "scissors") return keep ? t("이긴 손을 낸 사람만 남음. 세 가지가 다 나오면 가위가 이김") : t("진 손을 낸 사람만 남음. 세 가지가 다 나오면 가위가 이김");
    return keep ? t("이긴 손을 낸 사람만 남음. 마지막 한 명이 승리") : t("진 손을 낸 사람만 남음. 마지막 한 명이 술래");
  }

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
      const c = decisive(game.alive.length);
      chanceLine.textContent = t("{n}명이 아무렇게나 내면 이번에 승부가 날 확률 {p}. 안 나면 다시", { n: game.alive.length, p: pct(c) });
    } else chanceLine.textContent = t("{n}번 만에 끝남", { n: game.rounds.length });
  }

  function newGame() {
    game = createGroup(V, { players, mode, rule, tie3 });
    last = {};
    busy = false;
    doneBar.hidden = true;
    grid.lock(false);
    log.clear();
    st.say("");
    st.sub(ruleText());
    draw();
  }

  function apply(my) {
    const throws = {};
    game.alive.forEach((p) => (throws[p] = p === 0 ? my : rng.int(V.n)));
    last = throws;
    const r = game.play(throws);
    const kinds = [...new Set(game.rounds[game.rounds.length - 1].alive.map((p) => throws[p]))];
    const R = r.alive.length === 2 ? "rps" : rule; // 둘만 남으면 보통 가위바위보
    if (r.winnerHand === null) {
      const why =
        kinds.length === 1
          ? t("모두 {h}", { h: lower(V.hands[kinds[0]].name) })
          : R === "majority"
            ? t("가장 많이 나온 손이 둘 이상")
            : R === "minority"
              ? t("가장 적게 나온 손이 둘 이상")
              : t("세 가지가 다 나옴");
      st.say(t("다시!"));
      st.sub(t("{why}. 아무도 안 빠짐", { why }));
      log.add(t("{n}명: {why}. 다시", { n: r.alive.length, why }));
    } else {
      const w = V.hands[r.winnerHand].name;
      const outNames = listWords(r.out.map(name));
      st.say(t("{h} 승", { h: w }));
      st.sub(mode === "survive" ? t("{names} 빠짐", { names: outNames }) : t("{names} 빠져나감", { names: outNames }));
      const lv = { n: r.alive.length, h: lower(w), names: outNames };
      const out = mode === "survive";
      if (R === "majority") log.add(out ? t("{n}명: {h} 손이 가장 많음. {names} 탈락", lv) : t("{n}명: {h} 손이 가장 많음. {names} 통과", lv));
      else if (R === "minority") log.add(out ? t("{n}명: {h} 손이 가장 적음. {names} 탈락", lv) : t("{n}명: {h} 손이 가장 적음. {names} 통과", lv));
      else if (kinds.length === 3) log.add(out ? t("{n}명: 세 가지가 다 나와 {h} 손 승리. {names} 탈락", lv) : t("{n}명: 세 가지가 다 나와 {h} 손 승리. {names} 통과", lv));
      else log.add(out ? t("{n}명: {h} 손 승리. {names} 탈락", lv) : t("{n}명: {h} 손 승리. {names} 통과", lv));
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
    const g = game; // 도중에 사람 수·규칙을 바꿔 새 판이 되면 멈춘다(새 판을 내 손 없이 두지 않게)
    while (game === g && !g.done) {
      apply(null);
      await sleep(260);
    }
    finishBtn.disabled = false;
    if (game === g) busy = false;
  }

  function finish() {
    const meLast = game.last === 0;
    const good = mode === "survive" ? meLast : !meLast;
    const who = name(game.last);
    st.say(mode === "survive" ? (meLast ? t("나 우승") : t("{who} 우승", { who })) : meLast ? t("나 술래") : t("{who} 술래", { who }), good ? "win" : "lose");
    rec.textContent = recordLine(addRecord(entry.id, good ? 1 : -1));
    clear(doneBar).append(
      h("strong", {}, mode === "survive" ? (meLast ? t("끝까지 살아남음") : t("{who} 우승", { who })) : meLast ? t("내가 술래") : t("술래를 피함")),
      h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")),
    );
    doneBar.hidden = false;
  }

  const odds = h("dl", { class: "aka" });
  function drawOdds() {
    const base = rule === "rps" && tie3 === "redo";
    clear(odds).append(
      ...[3, 4, 5, 6, 8, 10].map((n) => [
        h("dt", {}, t("{n}명", { n })),
        h("dd", {}, base ? pct(groupDecisiveChance(n)) : t("{p}, 보통 {q}", { p: pct(decisive(n)), q: pct(groupDecisiveChance(n)) })),
      ]).flat(),
    );
  }
  const why =
    rules !== null
      ? t("보통 가위바위보는 사람이 늘수록 승부가 잘 안 납니다. 많은 손·적은 손 이기기는 5명 이상이어도 열 번에 여섯 번 넘게 승부가 납니다. 둘만 남으면 보통 가위바위보로 겨룹니다.")
      : tie3 === "scissors"
        ? t("세 가지가 다 나와도 가위가 이겨서, 모두 같은 손을 낼 때만 다시 합니다. 대신 사람이 많을수록 세 가지가 다 나오기 쉬워 가위가 유리합니다.")
        : t("한 번에 승부가 나려면 딱 두 가지 손만 나와야 합니다. 셋이면 2/3 확률로 승부가 나지만, 사람이 늘수록 세 가지가 다 나오기 쉬워집니다.");
  const side = h(
    "div",
    { class: "side-panel" },
    block(t("사람이 많으면"), h("p", {}, why), h("p", { class: "field-label", style: { margin: "4px 0 8px" } }, t("모두 아무렇게나 낼 때 한 번에 승부가 날 확률")), odds),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": entry.id === "group" ? t("여럿이 가위바위보 하기") : t("{name} 하기", { name: entry.name }) },
    h("div", { class: "controls" }, rSeg ? rSeg.el : null, pSeg.el, mSeg.el, fastToggle()),
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
  drawOdds();
  newGame();
  return { onKey: (e) => (!grid.el.hidden ? grid.keyHandler(e) : false), destroy: () => (busy = true) };
}
