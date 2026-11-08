// web/js/data/catalog.js 로 docs/variants.md 를 만든다.
//   node scripts/variants_doc.mjs > docs/variants.md
// 변종을 고치거나 더하면 catalog.js 를 고친 뒤 다시 돌린다. variants.md 는 손으로 고치지 않는다.

import { CATEGORIES, CATALOG, DRAFTS } from "../web/js/data/catalog.js";
import { compileVariant } from "../web/js/core/engine.js";
import { josa } from "../web/js/core/josa.js";

const SITE = "https://archi142857.github.io/ultimate-rsp/";

function frac(p) {
  for (let d = 1; d <= 120; d++) {
    const n = Math.round(p * d);
    if (Math.abs(n / d - p) < 1e-6) return n === 0 ? "0" : d === 1 ? String(n) : `${n}/${d}`;
  }
  return `${(p * 100).toFixed(1)}%`;
}

function drawChance(V) {
  let draws = 0;
  for (let a = 0; a < V.n; a++) for (let b = 0; b < V.n; b++) if (V.cmp(a, b) === 0) draws += 1;
  return draws / (V.n * V.n);
}

const handLabel = (h) => `${h.emoji} ${h.name}`;

function matrixLines(e) {
  const V = compileVariant(e);
  const out = [];
  out.push(`- 손: ${V.hands.map((h) => (h.how ? `${handLabel(h)}(${h.how})` : handLabel(h))).join(", ")}`);
  if (e.rel) {
    out.push("- 판정:");
    for (let a = 0; a < V.n; a++) for (let b = 0; b < V.n; b++) if (V.win[a][b]) out.push(`  - ${V.sentence(a, b)}.`);
  } else {
    const ring = V.order.map((i) => V.hands[i].name).join(" → ");
    out.push(`- 판정: 손을 고리로 늘어놓고(${ring}) 손마다 그 뒤로 ${e.cycle}개를 이긴다. 끝에 닿으면 처음으로 돌아간다.`);
  }
  if (e.weights) {
    const w = V.hands.filter((h) => V.weight[h.i] !== 1).map((h) => `${josa(h.name, "으로로")} 이기면 ${V.weight[h.i]}점`);
    if (w.length) out.push(`- 점수: ${w.join(", ")}.`);
  }
  out.push(`- 둘 다 아무렇게나 낼 때 비길 확률: ${frac(drawChance(V))}`);
  const eq = V.equilibrium;
  if (eq.uniform) out.push("- 최적 비율: 모든 손을 똑같이 낸다.");
  else out.push(`- 최적 비율: ${V.hands.map((h) => `${h.name} ${frac(eq.mix[h.i])}`).join(", ")}`);
  return out;
}

const lines = [];
lines.push("# 변종 목록", "");
lines.push(`앱에 실린 가위바위보 ${CATALOG.length}가지${DRAFTS.length ? `와 화면을 만들고 있는 ${DRAFTS.length}가지` : ""}의 규칙과 출처. \`web/js/data/catalog.js\` 에서 \`node scripts/variants_doc.mjs > docs/variants.md\` 로 만든다. 이 파일은 손으로 고치지 않는다.`, "");
lines.push("판정 문장과 손 설명은 이 앱이 새로 쓴 것이다. RPS-7 부터 RPS-101 까지의 손 구성과 고리 순서는 David C. Lovelace 의 것을 따랐고, 손끼리 이기는 까닭을 적은 문장은 따라 쓰지 않았다.", "");

function entryLines(e, live) {
  const out = [];
  out.push(`### ${e.name}${e.sub ? ` (${e.sub})` : ""}`, "");
  const meta = [e.origin, live ? `[앱에서 열기](${SITE}#/v/${e.id})` : "화면 준비 중"].filter(Boolean);
  out.push(meta.join(". ") + "", "");
  for (const p of e.about || []) out.push(p, "");
  if (e.kind === "matrix") out.push(...matrixLines(e), "");
  if (e.aka && e.aka.length) {
    out.push("| 이름 | 쓰는 곳 |", "| --- | --- |");
    for (const [n, where] of e.aka) out.push(`| ${n} | ${where} |`);
    out.push("");
  }
  if (e.sources && e.sources.length) {
    out.push("출처");
    out.push("");
    for (const s of e.sources) out.push(`- [${s.t}](${s.u})`);
    out.push("");
  }
  return out;
}

for (const cat of CATEGORIES) {
  const entries = CATALOG.filter((e) => e.cat === cat.id);
  if (!entries.length) continue;
  lines.push(`## ${cat.title}`, "", cat.blurb, "");
  for (const e of entries) lines.push(...entryLines(e, true));
}

if (DRAFTS.length) {
  lines.push("## 화면 준비 중", "", `규칙 코드(\`web/js/games/\`)와 시험은 있고 화면이 아직 없는 ${DRAFTS.length}가지. 화면이 붙으면 위 갈래로 옮겨 간다.`, "");
  for (const e of DRAFTS) lines.push(...entryLines(e, false));
}

process.stdout.write(lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n");
