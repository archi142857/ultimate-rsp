// 손 그림: 목록(art-files.js)이 web/art/ 와 맞는지, 그림 이름과 SVG 규격.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATALOG } from "../web/js/data/catalog.js";
import { DWB_DEF } from "../web/js/games/dynamitewb.js";
import { scanArt, renderList, checkSvg } from "../scripts/art_list.mjs";

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function allHands() {
  const hands = [];
  for (const e of CATALOG) if (e.hands) hands.push(...e.hands);
  hands.push(...DWB_DEF.hands);
  return hands;
}

test("손마다 그림 이름이 파일 이름으로 쓸 수 있는 꼴이다", () => {
  for (const hd of allHands()) assert.match(hd.art || hd.id, NAME, `${hd.name}: ${hd.art || hd.id}`);
});

test("손 모양 셋은 물건 그림과 이름이 다르다", () => {
  const classic = CATALOG.find((e) => e.id === "classic");
  assert.deepEqual(classic.hands.map((hd) => hd.art), ["hand-scissors", "hand-rock", "hand-paper"]);
  const rps7 = CATALOG.find((e) => e.id === "rps7");
  assert.ok(rps7.hands.every((hd) => !(hd.art || hd.id).startsWith("hand-")));
});

test("art-files.js 가 web/art/ 와 맞다 (그림을 바꾸면 node scripts/art_list.mjs)", () => {
  const { ok, problems } = scanArt();
  assert.deepEqual(problems, [], "규격에 안 맞는 그림이 있다");
  const now = readFileSync(new URL("../web/js/data/art-files.js", import.meta.url), "utf8");
  assert.equal(now, renderList(ok));
});

test("web/art/ 의 그림은 모두 어떤 손의 그림 이름이다", () => {
  const known = new Set(allHands().map((hd) => hd.art || hd.id));
  for (const [key] of scanArt().ok) assert.ok(known.has(key), `${key}.svg 를 쓰는 손이 없다(이름 오타?)`);
});

test("SVG 규격 검사", () => {
  const good = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="none" stroke="currentColor"/></svg>';
  assert.deepEqual(checkSvg(good), []);
  assert.ok(checkSvg(good.replace("0 0 64 64", "0 0 100 100")).length);
  assert.ok(checkSvg(good.replace("<circle", "<script>alert(1)</script><circle")).length);
  assert.ok(checkSvg(good.replace("<circle", '<image href="http://x/y.png"/><circle')).length);
  assert.ok(checkSvg(good.replace('fill="none"', 'onclick="x()"')).length);
  assert.ok(checkSvg(good.replace("<circle", "<text>A</text><circle")).length);
  // 파일에 붙어 오는 메타데이터는 크기에 안 센다
  const meta = good.replace("<circle", `<metadata>${"A".repeat(20000)}</metadata><circle`);
  assert.deepEqual(checkSvg(meta), []);
  assert.ok(checkSvg(good.replace("<circle", `<path d="${"M0 0".repeat(12000)}"/><circle`)).length);
  // Fluent 이모지는 흐림 필터를 쓴다
  assert.deepEqual(checkSvg(good.replace("<circle", '<defs><filter id="f"><feGaussianBlur stdDeviation="1"/></filter></defs><circle filter="url(#f)"')), []);
  // 안쪽 id 를 가리키는 것은 괜찮다
  const grad = good.replace("<circle", '<defs><linearGradient id="g"/></defs><use href="#g"/><rect fill="url(#g)"/><circle');
  assert.deepEqual(checkSvg(grad), []);
});
