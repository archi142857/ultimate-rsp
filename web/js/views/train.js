// 가위바위보 기차 화면: 여러 사람이 짝을 지어 겨루고, 진 쪽 기차가 이긴 쪽 뒤에 붙는다.

import { h, clear, sleep } from "../ui/dom.js";
import { t } from "../i18n.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createTrain } from "../games/group.js";
import { block, segmented } from "../ui/widgets.js";
import { oklchToHex } from "../ui/colors.js";
import { entryHead, entryBody } from "./common.js";
import { flowLayout, logList } from "./flow.js";

export function trainView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  let people = 24;
  let sim = null;
  let rng = makeRng();
  let running = false;
  let alive = true;

  const trainsEl = h("div", { class: "trains", "aria-live": "polite" });
  const stats = h("div", { class: "stats" });
  const log = logList({ max: 8, label: t("차례마다") });
  const stepBtn = h("button", { class: "btn", type: "button", onclick: () => step() }, t("한 차례"));
  const runBtn = h("button", { class: "btn btn-ink", type: "button", onclick: () => runAll() }, t("끝까지"));
  const resetBtn = h("button", { class: "btn", type: "button", onclick: () => reset() }, t("처음부터"));
  const nSeg = segmented({
    label: t("사람 수"),
    small: true,
    value: String(people),
    options: [8, 16, 24, 48, 96].map((n) => ({ id: String(n), name: t("{n}명", { n }) })),
    onChange: (v) => ((people = Number(v)), reset()),
  });

  const colorOf = (p) => oklchToHex(0.66, 0.12, (p * 137.508) % 360);

  function draw() {
    clear(trainsEl).append(
      ...sim.trains
        .slice()
        .sort((a, b) => b.length - a.length)
        .map((tr) =>
          h(
            "div",
            { class: "train", "aria-label": t("{h}번이 이끄는 기차, {n}명", { h: tr[0] + 1, n: tr.length }) },
            tr.map((p, k) => h("span", { class: "car" + (k === 0 ? " head" : ""), style: { background: colorOf(p) }, title: t("@person:{n}번", { n: p + 1 }) })),
            h("span", { class: "rec", style: { margin: "0 0 0 8px" } }, t("{n}명", { n: tr.length })),
          ),
        ),
    );
    clear(stats).append(
      stat(t("기차"), t("{n}줄", { n: sim.trains.length })),
      stat(t("@stat:차례"), t("{n}번", { n: sim.turn })),
      stat(t("@stat:가위바위보"), t("{n}번", { n: sim.throws })),
      stat(t("한 줄이 될 때까지(어림)"), t("{n}차례쯤", { n: Math.ceil(Math.log2(people)) })),
    );
    stepBtn.disabled = runBtn.disabled = sim.done || running;
  }

  function stat(k, v) {
    return h("div", { class: "stat" }, h("span", {}, k), h("b", {}, v));
  }

  function step() {
    if (sim.done) return;
    const ev = sim.step();
    const ties = ev.reduce((a, e) => a + e.throws - 1, 0);
    log.add(t("{t}차례: {g}판을 겨뤄 기차가 {n}줄. 비겨서 다시 낸 것 {d}번.", { t: sim.turn, g: ev.length, n: sim.trains.length, d: ties }));
    draw();
  }

  async function runAll() {
    running = true;
    draw();
    while (!sim.done && alive) {
      step();
      await sleep(420);
    }
    running = false;
    if (alive) draw();
  }

  function reset() {
    rng = makeRng();
    sim = createTrain(V, rng, people);
    log.clear();
    draw();
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(
      t("한 줄이 되기까지 걸리는 차례"),
      h("p", {}, t("한 차례마다 기차 둘이 하나로 합쳐지니 기차 수가 절반쯤으로 줄어듭니다. 그래서 사람이 두 배가 되어도 차례는 한 번쯤만 늘어납니다.")),
      h("p", {}, t("비기면 다시 내므로 가위바위보는 한 판에 평균 1.5번 던집니다.")),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("가위바위보 기차 지켜보기") },
    h("div", { class: "controls" }, nSeg.el, h("div", { class: "btn-row" }, stepBtn, runBtn, resetBtn)),
    stats,
    trainsEl,
    log.el,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  reset();
  return {
    destroy() {
      alive = false;
    },
  };
}
