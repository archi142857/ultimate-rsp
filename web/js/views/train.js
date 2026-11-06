// 가위바위보 기차 화면: 여러 사람이 짝을 지어 겨루고, 진 쪽 기차가 이긴 쪽 뒤에 붙는다.

import { h, clear, sleep } from "../ui/dom.js";
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
  const log = logList({ max: 8, label: "차례마다" });
  const stepBtn = h("button", { class: "btn", type: "button", onclick: () => step() }, "한 차례");
  const runBtn = h("button", { class: "btn btn-ink", type: "button", onclick: () => runAll() }, "끝까지");
  const resetBtn = h("button", { class: "btn", type: "button", onclick: () => reset() }, "처음부터");
  const nSeg = segmented({
    label: "사람 수",
    small: true,
    value: String(people),
    options: [8, 16, 24, 48, 96].map((n) => ({ id: String(n), name: `${n}명` })),
    onChange: (v) => ((people = Number(v)), reset()),
  });

  const colorOf = (p) => oklchToHex(0.66, 0.12, (p * 137.508) % 360);

  function draw() {
    clear(trainsEl).append(
      ...sim.trains
        .slice()
        .sort((a, b) => b.length - a.length)
        .map((t) =>
          h(
            "div",
            { class: "train", "aria-label": `${t[0] + 1}번이 이끄는 기차, ${t.length}명` },
            t.map((p, k) => h("span", { class: "car" + (k === 0 ? " head" : ""), style: { background: colorOf(p) }, title: `${p + 1}번` })),
            h("span", { class: "rec", style: { margin: "0 0 0 8px" } }, `${t.length}명`),
          ),
        ),
    );
    clear(stats).append(
      stat("기차", `${sim.trains.length}줄`),
      stat("차례", `${sim.turn}번`),
      stat("가위바위보", `${sim.throws}번`),
      stat("한 줄이 되기까지 어림", `${Math.ceil(Math.log2(people))}차례쯤`),
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
    log.add(`${sim.turn}차례: ${ev.length}판을 겨뤄 기차가 ${sim.trains.length}줄. 비겨서 다시 낸 것 ${ties}번.`);
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
      "몇 번 만에 한 줄이 될까",
      h("p", {}, "한 차례마다 기차 둘이 하나로 합쳐지니 기차 수가 절반쯤으로 준다. 그래서 사람이 두 배가 되어도 차례는 한 번쯤만 는다."),
      h("p", {}, "비기면 다시 내므로 가위바위보는 한 판에 평균 1.5번 던진다."),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": "가위바위보 기차 지켜보기" },
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
