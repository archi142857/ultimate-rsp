// node --test 로 돈다. 판정 엔진, 최적 섞기, 조사.

import test from "node:test";
import assert from "node:assert/strict";
import { compileVariant, groupWinner, groupDecisiveChance } from "../web/js/core/engine.js";
import { solveGame } from "../web/js/core/lp.js";
import { josa } from "../web/js/core/josa.js";
import { CATALOG, CATEGORIES, findEntry } from "../web/js/data/catalog.js";
import { makeCustomDef, maxWins } from "../web/js/data/custom.js";

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const mixOf = (V) => Object.fromEntries(V.hands.map((h) => [h.id, V.equilibrium.mix[h.i]]));

test("모든 도감 항목은 갈래가 있고 id 가 겹치지 않는다", () => {
  const ids = new Set();
  const cats = new Set(CATEGORIES.map((c) => c.id));
  for (const e of CATALOG) {
    assert.ok(!ids.has(e.id), `겹친 id ${e.id}`);
    ids.add(e.id);
    assert.ok(cats.has(e.cat), `${e.id} 의 갈래가 없다`);
    assert.ok(e.name && e.about && e.about.length, `${e.id} 이름·설명`);
  }
});

test("한 판짜리 변종은 모두 엔진으로 읽히고 판정이 앞뒤가 맞다", () => {
  for (const e of CATALOG.filter((x) => x.kind === "matrix")) {
    const V = compileVariant(e);
    for (let a = 0; a < V.n; a++) {
      assert.equal(V.cmp(a, a), 0);
      for (let b = 0; b < V.n; b++) assert.equal(V.cmp(a, b) + V.cmp(b, a), 0, `${e.id} ${a},${b}`);
    }
    const s = V.equilibrium.mix.reduce((x, y) => x + y, 0);
    assert.ok(near(s, 1), `${e.id} 섞기 합`);
  }
});

test("가위바위보: 바위가 가위를 이기고 문장이 자연스럽다", () => {
  const V = compileVariant(findEntry("classic"));
  const { rock, scissors, paper } = V.index;
  assert.equal(V.cmp(rock, scissors), 1);
  assert.equal(V.cmp(scissors, paper), 1);
  assert.equal(V.cmp(paper, rock), 1);
  assert.equal(V.sentence(scissors, rock), "바위가 가위를 부순다");
  assert.equal(V.sentence(paper, rock), "보가 바위를 감싼다");
  assert.ok(V.balanced);
  assert.ok(V.equilibrium.uniform);
});

test("러브레이스 판은 고르고, 남긴 사실과 맞는다", () => {
  for (const [id, n] of [["rps7", 7], ["rps9", 9], ["rps11", 11], ["rps15", 15], ["rps25", 25]]) {
    const V = compileVariant(findEntry(id));
    assert.equal(V.n, n);
    assert.ok(V.balanced, id);
    for (let a = 0; a < n; a++) assert.equal(V.beats(a).length, (n - 1) / 2, `${id} ${V.hands[a].id}`);
  }
  // RPS-7 페이지: 바위는 불·가위·스펀지를 이긴다
  const v7 = compileVariant(findEntry("rps7"));
  assert.deepEqual(v7.beats(v7.index.rock).map((i) => v7.hands[i].id).sort(), ["fire", "scissors", "sponge"]);
  // RPS-15 페이지: 총은 바위·나무·불·가위·뱀·사람·늑대를 이긴다
  const v15 = compileVariant(findEntry("rps15"));
  assert.deepEqual(
    v15.beats(v15.index.gun).map((i) => v15.hands[i].id).sort(),
    ["fire", "human", "rock", "scissors", "snake", "tree", "wolf"],
  );
  // RPS-25 페이지: 다이너마이트는 바위·가위를, 종이는 다이너마이트를, 남자는 악마를, 악마는 여자를 이긴다
  const v25 = compileVariant(findEntry("rps25"));
  const I = v25.index;
  assert.equal(v25.cmp(I.dynamite, I.rock), 1);
  assert.equal(v25.cmp(I.dynamite, I.scissors), 1);
  assert.equal(v25.cmp(I.paper, I.dynamite), 1);
  assert.equal(v25.cmp(I.man, I.devil), 1);
  assert.equal(v25.cmp(I.devil, I.woman), 1);
  // RPS-101 에서 뒤집었다고 적힌 짝: RPS-25 에서는 늑대가 핵폭탄을 이긴다
  assert.equal(v25.cmp(I.wolf, I.nuke), 1);
});

test("도마뱀 스팍: 손마다 둘을 이기고 위키 규칙과 같다", () => {
  const V = compileVariant(findEntry("rpsls"));
  const I = V.index;
  const beats = (h) => V.beats(I[h]).map((i) => V.hands[i].id).sort();
  assert.deepEqual(beats("spock"), ["rock", "scissors"]);
  assert.deepEqual(beats("lizard"), ["paper", "spock"]);
  assert.deepEqual(beats("rock"), ["lizard", "scissors"]);
  assert.deepEqual(beats("paper"), ["rock", "spock"]);
  assert.deepEqual(beats("scissors"), ["lizard", "paper"]);
  assert.equal(V.sentence(I.paper, I.spock), "보가 스팍을 반박한다");
});

test("우물: 최적 섞기에서 바위는 0, 나머지는 1/3", () => {
  const m = mixOf(compileVariant(findEntry("well")));
  assert.ok(near(m.rock, 0));
  for (const k of ["scissors", "paper", "well"]) assert.ok(near(m[k], 1 / 3), k);
});

test("불과 물: 가위·바위·보 1/9, 불·물 1/3", () => {
  const m = mixOf(compileVariant(findEntry("firewater")));
  for (const k of ["scissors", "rock", "paper"]) assert.ok(near(m[k], 1 / 9), k);
  for (const k of ["fire", "water"]) assert.ok(near(m[k], 1 / 3), k);
});

test("다이너마이트(놀이터): 보는 쓰지 않고 나머지 셋이 1/3", () => {
  const V = compileVariant(findEntry("dynamite"));
  const m = mixOf(V);
  assert.ok(near(m.paper, 0));
  for (const k of ["scissors", "rock", "dynamite"]) assert.ok(near(m[k], 1 / 3), k);
  assert.equal(V.sentence(V.index.scissors, V.index.dynamite), "가위가 다이너마이트 심지를 자른다");
});

test("막대기·호랑이·닭·벌레: 이웃만 승부, 마주 보면 비긴다", () => {
  const V = compileVariant(findEntry("sticktigerchickenworm"));
  const I = V.index;
  assert.equal(V.cmp(I.stick, I.tiger), 1);
  assert.equal(V.cmp(I.worm, I.stick), 1);
  assert.equal(V.cmp(I.stick, I.chicken), 0);
  assert.equal(V.cmp(I.tiger, I.worm), 0);
  assert.ok(V.equilibrium.uniform);
});

test("직접 만들기: 홀수는 늘 승부, 짝수는 맞은편과 비긴다", () => {
  for (const n of [3, 4, 5, 8, 21, 101]) {
    const V = compileVariant(makeCustomDef({ n, seed: 7 }));
    assert.equal(V.n, n);
    const k = maxWins(n);
    for (let a = 0; a < n; a++) assert.equal(V.beats(a).length, k);
    assert.ok(V.equilibrium.uniform, `n=${n}`);
  }
});

test("선형 계획법: 칸 수가 다른 가위바위보(글리코식)는 바위·가위 2/5, 보 1/5", () => {
  // 행·열 차례: 바위, 가위, 보. 이기면 이긴 손 칸 수만큼 얻고 지면 상대 칸 수만큼 잃는다
  const P = [
    [0, 3, -6],
    [-3, 0, 6],
    [6, -6, 0],
  ];
  const s = solveGame(P);
  assert.ok(near(s.value, 0));
  assert.ok(near(s.row[0], 0.4) && near(s.row[1], 0.4) && near(s.row[2], 0.2), s.row.join());
});

test("여럿이: 두 가지 손만 나와야 승부가 나고, 8명이면 열에 아홉은 다시", () => {
  const V = compileVariant(findEntry("classic"));
  const { rock, scissors, paper } = V.index;
  assert.equal(groupWinner(V, [rock, rock, scissors]), rock);
  assert.equal(groupWinner(V, [rock, paper, scissors]), null);
  assert.equal(groupWinner(V, [paper, paper]), null);
  assert.ok(near(groupDecisiveChance(2), 2 / 3));
  const redo8 = 1 - groupDecisiveChance(8);
  assert.ok(redo8 > 0.88 && redo8 < 0.89, String(redo8));
});

test("조사", () => {
  assert.equal(josa("바위", "이가"), "바위가");
  assert.equal(josa("스팍", "이가"), "스팍이");
  assert.equal(josa("물", "을를"), "물을");
  assert.equal(josa("보(종이)", "을를"), "보(종이)를");
  assert.equal(josa("RPS-7", "은는"), "RPS-7은");
  assert.equal(josa("길", "으로로"), "길로");
  assert.equal(josa("밥", "으로로"), "밥으로");
});
