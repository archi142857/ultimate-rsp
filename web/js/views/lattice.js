// 자연 속 가위바위보: 격자 생태계 시뮬레이션.

import { h, clear, pct } from "../ui/dom.js";
import { t, isEn } from "../i18n.js";
import { compileVariant, inSentence } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { CATALOG } from "../data/catalog.js";
import { createLattice, CRITICAL_MOBILITY } from "../sims/lattice.js";
import { block, segmented, selectBox } from "../ui/widgets.js";
import { handColors, hexToRgb, isDark, handVars } from "../ui/colors.js";
import { entryHead, entryBody } from "./common.js";
import { createLineChart } from "./chart.js";

const PRESETS_KO = [
  {
    id: "lizard",
    name: "옆줄무늬도마뱀",
    def: {
      id: "lizard",
      name: "옆줄무늬도마뱀",
      hands: [
        { id: "orange", name: "주황 목", emoji: "🟠" },
        { id: "blue", name: "파랑 목", emoji: "🔵" },
        { id: "yellow", name: "노랑 목", emoji: "🟡" },
      ],
      rel: [
        ["orange", "blue", "짝을 빼앗는다"],
        ["blue", "yellow", "쫓아낸다"],
        ["yellow", "orange", "몰래 짝을 맺는다"],
      ],
      colors: { light: ["#bf4a12", "#2a78d6", "#eda100"], dark: ["#b0430e", "#3987e5", "#b98d00"] },
    },
    note: "주황 목 수컷은 넓은 땅을 지키며 파랑의 짝을 빼앗는다. 파랑은 짝 곁을 지키며 노랑을 쫓아낸다. 암컷을 닮은 노랑은 주황이 자리를 비운 틈에 몰래 짝을 맺는다. 실제 무리에서도 셋의 비율이 몇 해를 주기로 돈다.",
  },
  {
    id: "ecoli",
    name: "대장균 세 무리",
    def: {
      id: "ecoli",
      name: "대장균",
      hands: [
        { id: "c", name: "독을 만드는 균", emoji: "🧪" },
        { id: "s", name: "독에 약한 균", emoji: "🦠" },
        { id: "r", name: "독을 견디는 균", emoji: "🛡️" },
      ],
      rel: [
        ["c", "s", "독으로 죽인다"],
        ["s", "r", "더 빨리 자란다"],
        ["r", "c", "더 빨리 자란다"],
      ],
    },
    note: "독(콜리신)을 만드는 균은 독에 약한 균을 죽인다. 독을 견디는 균은 독을 만드는 비용이 들지 않아 독 만드는 균보다 빨리 자란다. 약한 균은 독을 견디는 비용까지 들지 않아 견디는 균보다 빨리 자란다. 접시 위에서는 셋이 함께 살았고, 흔들어 섞은 플라스크에서는 견디는 균만 남았다.",
  },
];

const PRESETS_EN = [
  {
    id: "lizard",
    name: "Side-blotched lizards",
    def: {
      id: "lizard",
      name: "Side-blotched lizards",
      lang: "en",
      hands: [
        { id: "orange", name: "Orange throat", emoji: "🟠" },
        { id: "blue", name: "Blue throat", emoji: "🔵" },
        { id: "yellow", name: "Yellow throat", emoji: "🟡" },
      ],
      rel: [
        ["orange", "blue", "steals mates from"],
        ["blue", "yellow", "chases off"],
        ["yellow", "orange", "cuckolds"],
      ],
      colors: PRESETS_KO[0].def.colors,
    },
    note: "Orange-throated males hold big territories and steal mates from blues; blue males guard their mates and chase off yellows; yellow males, which look like females, sneak matings while orange is away. In wild populations the shares of the three cycle over a few years.",
  },
  {
    id: "ecoli",
    name: "Three strains of E. coli",
    def: {
      id: "ecoli",
      name: "E. coli",
      lang: "en",
      hands: [
        { id: "c", name: "Toxin maker", emoji: "🧪" },
        { id: "s", name: "Sensitive strain", emoji: "🦠" },
        { id: "r", name: "Resistant strain", emoji: "🛡️" },
      ],
      rel: [
        ["c", "s", "poisons"],
        ["s", "r", "outgrows"],
        ["r", "c", "outgrows"],
      ],
    },
    note: "The strain that makes the toxin (colicin) kills the sensitive one. The resistant strain skips the cost of making toxin, so it outgrows the maker, and the sensitive strain skips even the cost of resistance, so it outgrows the resistant one. On a plate all three live together; in a shaken flask only the resistant strain was left.",
  },
];

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const sup = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("");

export function latticeView(main, entry) {
  const PRESETS = isEn() ? PRESETS_EN : PRESETS_KO;
  const variantChoices = CATALOG.filter((e) => e.kind === "matrix").map((e) => ({ e, V: compileVariant(e) })).filter((x) => x.V.n <= 7);
  const options = [...PRESETS.map((p) => ({ id: p.id, name: p.name })), ...variantChoices.map((x) => ({ id: x.e.id, name: t("{name} (손 {n}개)", { name: x.e.name, n: x.V.n }) }))];
  let presetId = "lizard";
  let V = null;
  let logM = -4;
  let mixed = false;
  let L = 120;
  let speed = 1;
  let sim = null;
  let rng = makeRng();
  let running = false;
  let raf = 0;
  let frames = 0;
  let alive = true;
  let samples = [];
  let sinceSample = 0;
  let palette = [];
  let chart = null;

  const canvas = h("canvas", { class: "pixel", width: L, height: L, role: "img", "aria-label": t("격자 생태계") });
  const ctx = canvas.getContext("2d");
  const status = h("p", { class: "note", "aria-live": "polite", style: { margin: "12px 0 0" } });
  const stats = h("div", { class: "stats" });
  const legend = h("ul", { class: "legend" });
  const chartBox = h("div");
  const presetNote = h("p", { class: "muted" });
  const playBtn = h("button", { class: "btn btn-ink", type: "button", onclick: () => toggle() }, t("시작"));
  const resetBtn = h("button", { class: "btn", type: "button", onclick: () => reset(true) }, t("처음부터"));
  const mOut = h("output", {});
  const mIn = h("input", {
    type: "range",
    min: -6,
    max: -2,
    step: 0.1,
    value: logM,
    "aria-label": t("이동성(로그)"),
    oninput: () => {
      logM = Number(mIn.value);
      sim.setMobility(10 ** logM);
      showM();
    },
  });

  const pSel = selectBox({ label: t("누가 사나"), value: presetId, options, onChange: (v) => ((presetId = v), reset(true)) });
  const mixSeg = segmented({
    label: t("어디서"),
    small: true,
    value: "plate",
    options: [
      { id: "plate", name: t("접시 (이웃끼리)") },
      { id: "flask", name: t("플라스크 (잘 섞임)") },
    ],
    onChange: (v) => {
      mixed = v === "flask";
      sim.mixed = mixed;
    },
  });
  const sizeSeg = segmented({
    label: t("격자"),
    small: true,
    value: String(L),
    options: [80, 120, 180].map((n) => ({ id: String(n), name: `${n}×${n}` })),
    onChange: (v) => ((L = Number(v)), reset(true)),
  });
  const speedSeg = segmented({
    label: t("빠르기"),
    small: true,
    value: "1",
    options: [
      { id: "0.25", name: t("천천히") },
      { id: "1", name: t("보통") },
      { id: "4", name: t("빠르게") },
    ],
    onChange: (v) => (speed = Number(v)),
  });

  function sciKo(x) {
    let e = Math.floor(Math.log10(x) + 1e-9);
    let m = x / 10 ** e;
    if (m >= 9.95) {
      m /= 10;
      e += 1;
    }
    return `${m.toFixed(1)} × 10${sup(e)}`;
  }

  function showM() {
    const m = 10 ** logM;
    mOut.textContent = sciKo(m);
    const ratio = m / CRITICAL_MOBILITY;
    mOut.title = ratio < 1 ? t("임계값보다 작다") : t("임계값보다 크다");
    drawStats();
  }

  function currentVariant() {
    const p = PRESETS.find((x) => x.id === presetId);
    if (p) return { V: compileVariant(p.def), note: p.note };
    const x = variantChoices.find((c) => c.e.id === presetId);
    return { V: x.V, note: t("{name}의 손이 칸마다 하나씩 산다. 이기는 손은 옆의 지는 손을 없애고, 빈칸에는 옆 손이 퍼진다.", { name: x.e.name }) };
  }

  function setPalette() {
    const cols = handColors(V);
    palette = cols.map((c) => hexToRgb(isDark() ? c[1] : c[0]));
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#ffffff";
    palette.unshift(hexToRgb(bg.length === 7 ? bg : "#ffffff"));
  }

  function draw() {
    const img = ctx.createImageData(L, L);
    const d = img.data;
    const g = sim.grid;
    for (let i = 0; i < g.length; i++) {
      const c = palette[g[i]];
      const o = i * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function drawStats() {
    if (!sim) return;
    const fr = sim.fractions();
    clear(stats).append(
      stat(t("시간"), `${Math.round(sim.time)}`),
      stat(t("살아 있는 무리"), `${sim.alive()} / ${V.n}`),
      stat(t("이동성"), 10 ** logM < CRITICAL_MOBILITY ? t("임계값 아래") : t("임계값 위")),
    );
    clear(legend).append(
      ...V.hands.map((hd) =>
        h("li", { class: fr[hd.i] > 0 ? "" : "zero" }, h("span", { class: "swatch", vars: handVars(V, hd.i), "aria-hidden": "true" }), `${hd.name} `, h("b", {}, pct(fr[hd.i]))),
      ),
    );
  }

  function stat(k, v) {
    return h("div", { class: "stat" }, h("span", {}, k), h("b", {}, v));
  }

  function sample() {
    samples.push(sim.fractions());
    if (samples.length > 800) samples = samples.filter((_, i) => i % 2 === 0);
  }

  function drawChart() {
    const series = V.hands.map((hd) => samples.map((s) => s[hd.i] * 100));
    chart.update(series);
  }

  function frame() {
    if (!running || !alive) return;
    // 한 장면에 너무 많은 사건이 몰리지 않게 시간 간격을 줄인다.
    const perUnit = sim.N * (sim.sigma + sim.mu + sim.eps);
    const dt = Math.min(0.5 * speed, 1.2e6 / perUnit);
    sim.advance(dt);
    sinceSample += dt;
    if (sinceSample >= 0.5) {
      sinceSample = 0;
      sample();
    }
    draw();
    frames += 1;
    if (frames % 8 === 0) {
      drawStats();
      drawChart();
    }
    if (sim.alive() <= 1) {
      running = false;
      playBtn.textContent = t("시작");
      drawStats();
      drawChart();
      const last = V.hands.find((hd) => sim.counts[hd.i + 1] > 0);
      status.textContent = last ? t("{h}만 남았다. 이동성을 낮추거나 접시로 바꿔 다시 해 보자.", { h: inSentence(last) }) : t("모두 사라졌다.");
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function toggle() {
    running = !running;
    playBtn.textContent = running ? t("멈춤") : t("시작");
    if (running) {
      status.textContent = "";
      raf = requestAnimationFrame(frame);
    } else cancelAnimationFrame(raf);
  }

  function reset(full) {
    const wasRunning = running;
    running = false;
    cancelAnimationFrame(raf);
    const cur = currentVariant();
    V = cur.V;
    presetNote.textContent = cur.note;
    rng = makeRng();
    canvas.width = L;
    canvas.height = L;
    sim = createLattice({ L, win: V.win, rng, mobility: 10 ** logM, mixed });
    samples = [];
    sample();
    setPalette();
    chart = createLineChart({
      series: V.hands.map((hd) => ({ name: hd.name, values: [], colors: handColors(V)[hd.i] })),
      yMax: 100,
      yFormat: (v) => `${Math.round(v)}%`,
      xFormat: () => "",
      yLabel: t("무리 비율"),
      height: 180,
      showLegend: false,
    });
    clear(chartBox).append(chart.el);
    drawChart();
    draw();
    drawStats();
    status.textContent = full ? t("시작을 누르면 시간이 흐른다.") : "";
    playBtn.textContent = t("시작");
    if (wasRunning && !full) toggle();
  }

  const left = h(
    "div",
    {},
    h("div", { class: "canvas-box" }, canvas),
    status,
    stats,
    legend,
    h("div", { style: { marginTop: "16px" } }, chartBox),
  );
  const right = h(
    "section",
    { class: "panel", "aria-label": t("생태계 설정") },
    h("div", { class: "controls" }, pSel.el),
    presetNote,
    h("div", { class: "controls" }, mixSeg.el),
    h("div", { class: "range", style: { marginBottom: "14px" } }, h("span", { class: "field-label" }, t("이동성 M "), mOut), mIn, h("span", { class: "rec", style: { margin: 0 } }, t("한 개체가 한 단위 시간 동안 돌아다니는 격자 넓이의 비율. 임계값은 약 4.5 × 10⁻⁴."))),
    h("div", { class: "controls" }, sizeSeg.el, speedSeg.el),
    h("div", { class: "btn-row" }, playBtn, resetBtn),
  );

  main.append(
    entryHead(entry),
    h("div", { class: "sim-grid" }, left, right),
    entryBody(
      entry,
      block(
        t("모형"),
        h("p", {}, t("칸마다 한 개체가 살거나 비어 있다. 이웃한 두 칸을 고르면 셋 가운데 하나가 일어난다. 이기는 쪽이 지는 쪽을 없애거나(선택), 옆 개체가 빈칸으로 퍼지거나(번식), 둘이 자리를 바꾼다(이동). 선택과 번식은 같은 빠르기로 두었다.")),
        h("p", {}, t("Reichenbach 등(2007)에 따르면 이 모형에서 이동성이 약 4.5 × 10⁻⁴를 넘으면 두 무리가 사라지고, 그보다 작으면 셋이 소용돌이를 이루며 오래 함께 산다. 플라스크는 아무 칸끼리나 만나게 해서 잘 섞인 물속처럼 만든다.")),
      ),
    ),
  );
  showM();
  reset(true);
  const onScheme = () => {
    setPalette();
    draw();
  };
  window.addEventListener("schemechange", onScheme);
  return {
    destroy() {
      alive = false;
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("schemechange", onScheme);
    },
  };
}
