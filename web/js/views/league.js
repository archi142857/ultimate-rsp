// 전략 리그 화면: 컴퓨터 전략끼리 겨루게 하고 순위와 맞대결 표를 보여 준다.

import { h, clear } from "../ui/dom.js";
import { t, num } from "../i18n.js";
import { compileVariant } from "../core/engine.js";
import { BOTS } from "../core/bots.js";
import { CATALOG } from "../data/catalog.js";
import { leagueRunner } from "../sims/league.js";
import { block, segmented, selectBox } from "../ui/widgets.js";
import { entryHead, entryBody } from "./common.js";
import { randomSeed } from "../core/rng.js";

export function leagueView(main, entry) {
  const variants = CATALOG.filter((e) => e.kind === "matrix");
  let variantId = "classic";
  let rounds = 1000;
  const chosen = new Set(BOTS.map((b) => b.id));
  let alive = true;
  let running = false;

  const progress = h("div", { class: "progress", hidden: true }, h("span"));
  const out = h("div", { class: "league-out", "aria-live": "polite" });
  const runBtn = h("button", { class: "btn btn-ink", type: "button", onclick: () => run() }, t("리그 돌리기"));

  const vSel = selectBox({
    label: t("변종"),
    value: variantId,
    options: variants.map((v) => ({ id: v.id, name: v.name })),
    onChange: (v) => (variantId = v),
  });
  const rSeg = segmented({
    label: t("짝마다"),
    small: true,
    value: String(rounds),
    options: [100, 1000, 10000].map((n) => ({ id: String(n), name: t("{n}판", { n: num(n) }) })),
    onChange: (v) => (rounds = Number(v)),
  });
  const checks = h(
    "fieldset",
    { class: "checks", style: { border: 0, padding: 0, margin: 0 } },
    h("legend", { class: "field-label", style: { marginBottom: "6px" } }, t("나갈 전략")),
    BOTS.map((b) => {
      const id = `lg-${b.id}`;
      const box = h("input", {
        type: "checkbox",
        id,
        checked: true,
        onchange: () => {
          if (box.checked) chosen.add(b.id);
          else chosen.delete(b.id);
          runBtn.disabled = chosen.size < 2;
        },
      });
      return h("label", { class: "check", for: id, title: b.desc }, box, h("span", {}, b.name));
    }),
  );

  async function run() {
    if (running) return;
    running = true;
    runBtn.disabled = true;
    const V = compileVariant(variants.find((v) => v.id === variantId));
    const ids = BOTS.map((b) => b.id).filter((id) => chosen.has(id));
    const it = leagueRunner(V, ids, rounds, randomSeed());
    progress.hidden = false;
    const bar = progress.firstChild;
    let r = it.next();
    while (!r.done && alive) {
      bar.style.width = `${(100 * r.value.done) / r.value.total}%`;
      await new Promise((res) => requestAnimationFrame(res));
      r = it.next();
    }
    if (!alive) return;
    progress.hidden = true;
    show(V, r.value);
    running = false;
    runBtn.disabled = chosen.size < 2;
  }

  function show(V, res) {
    const order = res.table.map((row, i) => ({ ...row, i })).sort((a, b) => b.pts - a.pts || b.avg - a.avg);
    const table = h(
      "table",
      { class: "league-table" },
      h("caption", { class: "sr" }, t("순위표")),
      h(
        "thead",
        {},
        h("tr", {}, h("th", { scope: "col" }, t("순위")), h("th", { scope: "col" }, t("전략")), h("th", { scope: "col" }, t("승점")), h("th", { scope: "col" }, t("평균 차이")), h("th", { scope: "col" }, t("@col:이긴 판")), h("th", { scope: "col" }, t("@col:진 판"))),
      ),
      h(
        "tbody",
        {},
        order.map((row, rank) =>
          h(
            "tr",
            {},
            h("td", {}, String(rank + 1)),
            h("td", {}, row.name),
            h("td", {}, String(row.pts)),
            h("td", {}, signedPct(row.avg)),
            h("td", {}, num(row.w)),
            h("td", {}, num(row.l)),
          ),
        ),
      ),
    );
    const names = res.botIds.map((id) => BOTS.find((b) => b.id === id).name);
    const heat = h(
      "table",
      { class: "heat" },
      h("caption", { class: "sr" }, t("맞대결 표. 줄 전략이 칸 전략과 겨뤄 이긴 판에서 진 판을 뺀 비율")),
      h("thead", {}, h("tr", {}, h("th", {}), names.map((n) => h("th", { class: "col", scope: "col" }, n)))),
      h(
        "tbody",
        {},
        res.net.map((row, i) =>
          h(
            "tr",
            {},
            h("th", { scope: "row" }, names[i]),
            row.map((v, j) => {
              if (i === j) return h("td", { class: "self" }, "–");
              const k = Math.min(1, Math.abs(v));
              const pole = v >= 0 ? "var(--pos)" : "var(--neg)";
              const wdl = res.wdl[i][j];
              return h(
                "td",
                {
                  style: {
                    background: `color-mix(in oklab, ${pole} ${Math.round(k * 100)}%, var(--mid))`,
                    color: k > 0.55 ? "#fff" : "var(--ink)",
                  },
                  title: t("{a} 대 {b}: {w}승 {d}무 {l}패", { a: names[i], b: names[j], w: num(wdl.w), d: num(wdl.d), l: num(wdl.l) }),
                },
                signedPct(v, true),
              );
            }),
          ),
        ),
      ),
    );
    const pairs = [];
    for (let i = 0; i < res.net.length; i++) for (let j = 0; j < res.net.length; j++) if (res.net[i][j] > 0) pairs.push([i, j, res.net[i][j]]);
    pairs.sort((a, b) => b[2] - a[2]);
    const cyc = findCycle(res.net);
    clear(out).append(
      block(t("{name}, 짝마다 {n}판", { name: V.name, n: num(res.rounds) }), h("div", { class: "table-wrap" }, table), h("p", { class: "rec" }, t("승점: 맞대결마다 이긴 판이 많으면 3점, 같으면 1점. 평균 차이: 상대마다 (이긴 판 − 진 판) / 판 수의 평균"))),
      block(
        t("맞대결 표"),
        h("div", { class: "table-wrap" }, heat),
        h(
          "div",
          { class: "scale" },
          t("줄이 짐"),
          h("span", { class: "ramp", style: { background: "linear-gradient(90deg, var(--neg), var(--mid), var(--pos))" } }),
          t("줄이 이김"),
        ),
        h(
          "ul",
          { class: "plain-list" },
          pairs.slice(0, 4).map(([i, j, v]) => h("li", {}, t("{a:이가} {b:을를} {v}%p 차이로 이김", { a: names[i], b: names[j], v: Math.round(v * 100) }))),
        ),
        cyc ? h("p", { class: "note" }, h("b", {}, t("전략끼리도 물고 물립니다. ")), t("{chain}. 화살표 앞 전략이 뒤 전략을 이겼습니다.", { chain: [...cyc, cyc[0]].map((i) => names[i]).join(" → ") })) : null,
      ),
    );
  }

  const panel = h(
    "section",
    { class: "panel", "aria-label": t("리그 설정") },
    h("div", { class: "controls" }, vSel.el, rSeg.el),
    checks,
    h("div", { class: "btn-row", style: { marginTop: "16px" } }, runBtn),
    progress,
  );
  main.append(
    entryHead(entry),
    h("div", { class: "league-layout" }, panel, out),
    entryBody(entry, block(t("나가는 전략"), h("ul", { class: "botlist" }, BOTS.map((b) => h("li", {}, h("b", {}, b.name), b.desc))))),
  );
  run();
  return {
    destroy() {
      alive = false;
    },
  };
}

function signedPct(v, short = false) {
  const p = Math.round(v * 100);
  if (p === 0) return "0";
  return (p > 0 ? "+" : "−") + Math.abs(p) + (short ? "" : t("%p"));
}

/** 셋짜리 물고 무는 고리(i가 j를, j가 k를, k가 i를 이긴다)를 하나 찾는다. 차이가 가장 큰 것으로 */
function findCycle(net) {
  let best = null;
  let bestScore = 0.05;
  const n = net.length;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) {
        if (i === j || j === k || i === k) continue;
        const sc = Math.min(net[i][j], net[j][k], net[k][i]);
        if (sc > bestScore) {
          bestScore = sc;
          best = [i, j, k];
        }
      }
  return best;
}
