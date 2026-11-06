// 작은 선 그래프(SVG). 선 2px, 가는 눈금, 범례, 마우스를 올리면 세로선과 값 상자.

import { h, s, clear } from "../ui/dom.js";
import { t } from "../i18n.js";

// 눈금 간격은 1, 2, 5의 10배수로 맞춘다.
function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p);
}

function niceValueStep(raw) {
  if (!(raw > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function niceTop(v) {
  const p = 10 ** Math.floor(Math.log10(v / 4));
  for (const f of [1, 2, 2.5, 5, 10]) if (4 * f * p >= v) return 4 * f * p;
  return v;
}

export function lineChart(opts) {
  return createLineChart(opts).el;
}

/**
 * series: [{ name, values: number[], colors: [밝은, 어두운] }]
 * yMax: 세로축 끝(없으면 자료에서), yFormat: 값 → 글자, xFormat: 칸 번호 → 글자
 */
export function createLineChart({ series, yMax = null, yFormat = (v) => String(Math.round(v)), xFormat = (i) => String(i), xLabel = "", yLabel = "", height = 220, showLegend = true }) {
  const W = 560;
  const H = height;
  const m = { l: 40, r: 12, t: 10, b: 28 };
  const svg = s("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": t("{y} 변화 그래프", { y: yLabel }) });
  const gridG = s("g");
  const lineG = s("g");
  const hover = s("line", { class: "crosshair", y1: m.t, y2: H - m.b, visibility: "hidden" });
  const hit = s("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" });
  svg.append(gridG, lineG, hover, hit);
  const tip = h("div", { class: "tooltip", hidden: true });
  const legend = h(
    "ul",
    { class: "legend", style: { marginTop: "8px" } },
    series.map((sr) => h("li", {}, h("span", { class: "swatch", vars: { "--cl": sr.colors[0], "--cd": sr.colors[1] }, "aria-hidden": "true" }), sr.name)),
  );
  const wrap = h("div", { class: "chart-wrap", style: { position: "relative" } }, svg, tip, showLegend ? legend : null);
  const paths = series.map((sr) => {
    const p = s("polyline", { class: "series", style: `stroke: var(--c)` });
    p.style.setProperty("--cl", sr.colors[0]);
    p.style.setProperty("--cd", sr.colors[1]);
    lineG.append(p);
    return p;
  });
  let data = series.map((sr) => sr.values);
  let scaleX = () => 0;
  let scaleY = () => 0;
  let top = 1;

  function render() {
    const len = Math.max(1, ...data.map((d) => d.length));
    top = yMax || niceTop(Math.max(1, ...data.flat()));
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    scaleX = (i) => m.l + (len <= 1 ? 0 : (iw * i) / (len - 1));
    scaleY = (v) => m.t + ih - (ih * v) / top;
    clear(gridG);
    const yStep = niceValueStep(top / 4);
    for (let v = 0; v <= top + yStep * 1e-6; v += yStep) {
      const y = scaleY(v);
      gridG.append(s("line", { class: "grid-line", x1: m.l, x2: W - m.r, y1: y, y2: y }));
      gridG.append(s("text", { class: "axis-label", x: m.l - 6, y: y + 4, "text-anchor": "end" }, yFormat(v)));
    }
    if (len > 1) {
      const step = niceStep((len - 1) / 5);
      for (let i = 0; i <= len - 1; i += step) {
        const anchor = i === 0 ? "start" : scaleX(i) > W - m.r - 16 ? "end" : "middle";
        gridG.append(s("text", { class: "axis-label", x: scaleX(i), y: H - 8, "text-anchor": anchor }, xFormat(i)));
      }
    }
    if (xLabel) gridG.append(s("text", { class: "axis-label", x: W - m.r, y: H - 8 - 14, "text-anchor": "end" }, xLabel));
    paths.forEach((p, k) => {
      const d = data[k];
      p.setAttribute("points", d.map((v, i) => `${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(" "));
    });
  }

  function showAt(evt) {
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * W;
    const len = Math.max(1, ...data.map((d) => d.length));
    const iw = W - m.l - m.r;
    const i = Math.max(0, Math.min(len - 1, Math.round(((x - m.l) / iw) * (len - 1))));
    const px = scaleX(i);
    hover.setAttribute("x1", px);
    hover.setAttribute("x2", px);
    hover.setAttribute("visibility", "visible");
    clear(tip).append(
      h("div", { style: { fontWeight: "700", marginBottom: "4px" } }, `${xLabel ? xLabel + " " : ""}${xFormat(i)}`),
      ...series.map((sr, k) =>
        h(
          "div",
          {},
          h("span", { class: "swatch", vars: { "--cl": sr.colors[0], "--cd": sr.colors[1] } }),
          `${sr.name} ${data[k][i] === undefined ? "–" : yFormat(data[k][i])}`,
        ),
      ),
    );
    tip.hidden = false;
    const left = (px / W) * rect.width;
    tip.style.left = `${Math.min(rect.width - 150, Math.max(0, left + 12))}px`;
    tip.style.top = `8px`;
  }
  hit.addEventListener("pointermove", showAt);
  hit.addEventListener("pointerleave", () => {
    hover.setAttribute("visibility", "hidden");
    tip.hidden = true;
  });

  render();
  return {
    el: wrap,
    update(values) {
      data = values;
      render();
    },
  };
}
