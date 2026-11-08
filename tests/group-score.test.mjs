// 손이 셋보다 많은 변종의 여럿이 판정(점수 규칙)과 인원(11-08 사용자 '모든 변종을 방에서 여럿이').

import { test } from "node:test";
import assert from "node:assert/strict";
import { compileVariant, groupThrows } from "../web/js/core/engine.js";
import { findEntry } from "../web/js/data/catalog.js";
import { makeRng } from "../web/js/core/rng.js";
import { createGroup, defaultGroupRule, handScores, isThreeCycle, losingHand, winningHand } from "../web/js/games/group.js";
import { groupBases, groupRuleOf, seatRange, GROUP_SEATS_MAX, GROUP_THROWS_MAX } from "../web/js/data/online.js";

const V = (id) => compileVariant(findEntry(id));
const C = V("classic");
const L = V("rpsls");
const hands = (W, ...ids) => ids.map((id) => W.index[id]);
/** 사람 번호 순서대로 낸 손 → { 번호: 손 } */
const byPlayer = (list) => Object.fromEntries(list.map((x, i) => [i, x]));

test("기본 규칙: 세 손 고리는 보통 규칙, 손이 많으면 점수", () => {
  assert.ok(isThreeCycle(C));
  assert.ok(!isThreeCycle(L));
  assert.equal(defaultGroupRule(C), "rps");
  assert.equal(defaultGroupRule(L), "score");
  assert.equal(createGroup(C, { players: 4 }).rule, "rps");
  assert.equal(createGroup(L, { players: 4 }).rule, "score");
  assert.equal(createGroup(L, { players: 4, rule: "rps" }).rule, "rps", "정해 주면 그 규칙");
});

test("점수: 이긴 사람 수 − 진 사람 수", () => {
  // 바위 둘·가위·보: 바위는 가위를 이기고 보에 져서 0, 보는 바위 둘을 이기고 가위에 져서 +1, 가위는 −1
  const hs = hands(L, "rock", "rock", "scissors", "paper");
  const s = handScores(L, hs);
  assert.equal(s.get(L.index.rock), 0);
  assert.equal(s.get(L.index.paper), 1);
  assert.equal(s.get(L.index.scissors), -1);
  assert.equal(winningHand(L, hs, "score"), L.index.paper);
  assert.equal(losingHand(L, hs, "score"), L.index.scissors);

  const g = createGroup(L, { players: 4 });
  const r = g.play(byPlayer(hs));
  assert.deepEqual(r.out, [0, 1, 2]);
  assert.ok(g.done && g.last === 3, "보를 낸 사람이 이긴다");

  const k = createGroup(L, { players: 4, mode: "loser" });
  const r2 = k.play(byPlayer(hs));
  assert.equal(r2.loserHand, L.index.scissors);
  assert.ok(k.done && k.last === 2, "가위를 낸 사람이 술래");
});

test("점수가 모두 같거나 모두 같은 손이면 다시", () => {
  // 바위·가위·보는 RPSLS 에서도 고리라 셋 다 0점
  for (const hs of [hands(L, "rock", "scissors", "paper"), hands(L, "spock", "spock", "spock")]) {
    for (const mode of ["survive", "loser"]) {
      const g = createGroup(L, { players: 3, mode });
      const r = g.play(byPlayer(hs));
      assert.deepEqual([r.winnerHand, r.loserHand, r.out, g.alive], [null, null, [], [0, 1, 2]], mode);
    }
  }
});

test("가장 높은(낮은) 점수가 둘 이상이면 그 쪽만 다시", () => {
  // 가위 −1, 바위 +2, 도마뱀 −2, 스팍 +2: 가장 높은 손이 둘(바위·스팍), 가장 낮은 손은 도마뱀 하나
  const topTie = hands(L, "scissors", "scissors", "rock", "lizard", "spock");
  const s = createGroup(L, { players: 5 });
  const r = s.play(byPlayer(topTie));
  assert.deepEqual([r.winnerHand, r.out, s.alive.length], [null, [], 5], "마지막 한 명 정하기는 다시");
  const k = createGroup(L, { players: 5, mode: "loser" });
  const r2 = k.play(byPlayer(topTie));
  assert.equal(r2.winnerHand, null);
  assert.equal(r2.loserHand, L.index.lizard);
  assert.ok(k.done && k.last === 3, "술래 정하기는 도마뱀이 술래");

  // 가위 +1, 바위 +2, 보 −2, 도마뱀 −2: 가장 높은 손은 바위 하나, 가장 낮은 손이 둘
  const botTie = hands(L, "scissors", "scissors", "rock", "paper", "lizard");
  const s2 = createGroup(L, { players: 5 });
  s2.play(byPlayer(botTie));
  assert.ok(s2.done && s2.last === 2, "바위가 이긴다");
  const k2 = createGroup(L, { players: 5, mode: "loser" });
  const r3 = k2.play(byPlayer(botTie));
  assert.deepEqual([r3.loserHand, r3.out, k2.alive.length], [null, [], 5], "술래 정하기는 다시");
});

test("두 가지 손만 나오면 보통 규칙과 같다", () => {
  const W = V("rps101");
  const [a, b] = [0, 1].sort((x, y) => -W.cmp(x, y)); // a 가 b 를 이긴다
  assert.ok(W.cmp(a, b) > 0);
  const g = createGroup(W, { players: 3 });
  const r = g.play(byPlayer([a, b, a]));
  assert.deepEqual([r.winnerHand, r.loserHand, r.out, g.alive], [a, b, [1], [0, 2]]);
  const k = createGroup(W, { players: 3, mode: "loser" });
  k.play(byPlayer([a, b, a]));
  assert.ok(k.done && k.last === 1);
  // 둘만 남으면 보통 가위바위보(비기면 다시)
  const r2 = g.play(byPlayer([b, undefined, a]));
  assert.ok(g.done && g.last === 2 && r2.out[0] === 0);
});

test("서로 비기는 손이 있는 변종(막대기·호랑이·닭·벌레)", () => {
  const W = V("sticktigerchickenworm");
  assert.equal(defaultGroupRule(W), "score");
  const g = createGroup(W, { players: 3 });
  const r = g.play(byPlayer(hands(W, "stick", "chicken", "stick")));
  assert.deepEqual([r.winnerHand, r.out], [null, []], "막대기와 닭은 비긴다");
  const r2 = g.play(byPlayer(hands(W, "stick", "tiger", "chicken")));
  // 막대기 +1(호랑이), 호랑이 +1 −1, 닭 −1
  assert.deepEqual([r2.winnerHand, r2.loserHand, g.alive], [W.index.stick, W.index.chicken, [0]]);
});

test("손 셋 변종은 그대로 보통 규칙", () => {
  // 셋 다 나오면 점수가 달라도 다시(보통 규칙). 점수 규칙이었다면 보가 이겼을 판
  const hs = hands(C, "rock", "rock", "scissors", "paper");
  const g = createGroup(C, { players: 4 });
  const r = g.play(byPlayer(hs));
  assert.deepEqual([r.winnerHand, r.loserHand, r.out], [null, null, []]);
  assert.equal(winningHand(C, hs, "score"), C.index.paper);
  const r2 = g.play(byPlayer(hands(C, "rock", "scissors", "scissors", "rock")));
  assert.deepEqual([r2.winnerHand, r2.loserHand, r2.out], [C.index.rock, C.index.scissors, [1, 2]]);
  const k = createGroup(C, { players: 4, mode: "loser" });
  const r3 = k.play(byPlayer(hands(C, "rock", "scissors", "scissors", "rock")));
  assert.deepEqual([r3.loserHand, r3.out, k.alive], [C.index.scissors, [0, 3], [1, 2]]);
});

test("손 셋 여럿이 평균 판 수(groupThrows)", () => {
  assert.equal(groupThrows(1), 0);
  assert.equal(groupThrows(2), 1.5);
  assert.equal(groupThrows(3), 2.25);
  assert.ok(Math.abs(groupThrows(8) - 12.104) < 0.01);
  assert.ok(groupThrows(8) <= GROUP_THROWS_MAX && groupThrows(9) > GROUP_THROWS_MAX, "그래서 손 셋은 8명까지");
  // 아무렇게나 내서 끝까지 해 본 평균과 맞는다
  const rng = makeRng(7);
  const n = 6;
  let sum = 0;
  const T = 3000;
  for (let t = 0; t < T; t++) {
    const g = createGroup(C, { players: n });
    while (!g.done) g.play(Object.fromEntries(g.alive.map((p) => [p, rng.int(3)])));
    sum += g.rounds.length;
  }
  assert.ok(Math.abs(sum / T - groupThrows(n)) < 0.35, `${sum / T} ≈ ${groupThrows(n)}`);
});

test("손이 많은 바탕은 50명이 해도 금방 끝난다(인원 천장은 판정이 아니라 방 무게로 정한다)", () => {
  const rng = makeRng(2026);
  const many = groupBases({ manyHands: true }).filter((id) => groupRuleOf(id) === "score");
  assert.ok(many.length >= 12 && many.includes("rpsls") && many.includes("rps101"));
  for (const id of many) {
    assert.equal(seatRange(id).max, GROUP_SEATS_MAX, id);
    assert.equal(GROUP_SEATS_MAX, 20);
    const W = V(id);
    for (const mode of ["survive", "loser"]) {
      let sum = 0;
      const T = 40;
      for (let t = 0; t < T; t++) {
        const g = createGroup(W, { players: 50, mode });
        while (!g.done && g.rounds.length < 500) g.play(Object.fromEntries(g.alive.map((p) => [p, rng.int(W.n)])));
        assert.ok(g.done, `${id} ${mode}: 끝난다`);
        sum += g.rounds.length;
      }
      assert.ok(sum / T <= GROUP_THROWS_MAX / 2, `${id} ${mode}: 평균 ${sum / T}번`);
    }
  }
});
