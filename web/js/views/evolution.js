// 진화 가위바위보 화면: 알에서 왕까지.

import { h, clear, sleep } from "../ui/dom.js";
import { t } from "../i18n.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createEvolution, EVO_STAGES } from "../games/group.js";
import { block, segmented } from "../ui/widgets.js";
import { entryHead, entryBody } from "./common.js";
import { flowLayout } from "./flow.js";
import { lineChart } from "./chart.js";

export function evolutionView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  let people = 30;
  let sim = null;
  let running = false;
  let alive = true;

  const rows = h("div", { class: "evo" });
  const stats = h("div", { class: "stats" });
  const chartBox = h("div", { style: { position: "relative" } });
  const stepBtn = h("button", { class: "btn", type: "button", onclick: () => step() }, t("한 차례"));
  const runBtn = h("button", { class: "btn btn-ink", type: "button", onclick: () => runAll() }, t("끝까지"));
  const resetBtn = h("button", { class: "btn", type: "button", onclick: () => reset() }, t("처음부터"));
  const nSeg = segmented({
    label: t("사람 수"),
    small: true,
    value: String(people),
    options: [10, 20, 30, 60].map((n) => ({ id: String(n), name: t("{n}명", { n }) })),
    onChange: (v) => ((people = Number(v)), reset()),
  });

  const SERIES_COLORS = { light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"], dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"] };

  function draw() {
    const c = sim.counts();
    clear(rows).append(
      ...EVO_STAGES.slice()
        .reverse()
        .map((stg) => {
          const k = EVO_STAGES.indexOf(stg);
          return h(
            "div",
            { class: "evo-row" },
            h("span", { class: "nm" }, `${stg.emoji} ${stg.name}`),
            h("span", { class: "tokens", "aria-hidden": "true" }, Array.from({ length: c[k] }, () => h("span", {}, stg.emoji))),
            h("span", { class: "n" }, String(c[k])),
          );
        }),
    );
    clear(stats).append(stat(t("@stat:차례"), t("{n}번", { n: sim.turn })), stat(t("@stat:가위바위보"), t("{n}번", { n: sim.throws })), stat(t("@stat:왕"), t("{n}명", { n: c[EVO_STAGES.length - 1] })));
    clear(chartBox).append(
      lineChart({
        series: EVO_STAGES.map((stg, k) => ({ name: `${stg.emoji} ${stg.name}`, values: sim.history.map((hh) => hh[k]), colors: [SERIES_COLORS.light[k], SERIES_COLORS.dark[k]] })),
        yMax: people,
        xLabel: t("@axis:차례"),
        yLabel: t("@axis:사람"),
        height: 200,
      }),
    );
    stepBtn.disabled = runBtn.disabled = sim.done || running;
  }

  function stat(k, v) {
    return h("div", { class: "stat" }, h("span", {}, k), h("b", {}, v));
  }

  function step() {
    if (sim.done) return;
    sim.step();
    draw();
  }

  async function runAll() {
    running = true;
    draw();
    while (!sim.done && alive) {
      step();
      await sleep(240);
    }
    running = false;
    if (alive) draw();
  }

  function reset() {
    sim = createEvolution(V, makeRng(), people);
    draw();
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(
      t("끝은 늘 비슷하다"),
      h("p", {}, t("같은 단계끼리만 겨루므로, 어느 단계든 두 사람 이상 남아 있으면 놀이가 이어진다. 그래서 끝날 때는 알·병아리·닭·공룡에 많아야 한 명씩 남고 나머지는 모두 왕이 된다.")),
      h("p", {}, t("지면 한 단계 내려가니 왕 바로 아래에서 오래 맴도는 사람도 생긴다.")),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("진화 가위바위보 지켜보기") },
    h("div", { class: "controls" }, nSeg.el, h("div", { class: "btn-row" }, stepBtn, runBtn, resetBtn)),
    stats,
    rows,
    h("div", { style: { marginTop: "20px" } }, chartBox),
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  reset();
  const onScheme = () => draw();
  window.addEventListener("schemechange", onScheme);
  return {
    destroy() {
      alive = false;
      window.removeEventListener("schemechange", onScheme);
    },
  };
}
