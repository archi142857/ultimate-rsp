// 전략의 진화(web/js/sims/evolution.js): 신뢰의 진화처럼 리그를 거듭할 때 사람 수와 결과의 큰 줄기.

import { test } from "node:test";
import assert from "node:assert/strict";
import { compileVariant } from "../web/js/core/engine.js";
import { findEntry } from "../web/js/data/catalog.js";
import { createEvolution, runEvolution, EVO_DEFAULTS } from "../web/js/sims/evolution.js";
import { playMatch } from "../web/js/sims/league.js";

const C = compileVariant(findEntry("classic"));
const SIMPLE = { stubborn: 5, cycle: 5, mirror: 5, avenger: 5, random: 5 };
const READERS = { stubborn: 3, cycle: 3, mirror: 3, avenger: 3, human: 3, freq: 3, pattern: 3, random: 4 };

/** seeds 마다 끝까지 돌려 가장 많이 남은 봇을 센다 */
function winners(pop, opts, seeds, maxGen = 40) {
  const tally = {};
  for (const seed of seeds) {
    const evo = runEvolution(C, pop, { ...opts, seed }, maxGen);
    const last = evo.history[evo.history.length - 1];
    const top = Object.keys(last).reduce((a, b) => (last[b] > last[a] ? b : a));
    tally[top] = (tally[top] || 0) + 1;
  }
  return tally;
}

test("세대마다 사람 수는 그대로, 낮은 5명이 빠지고 높은 5명이 늘어난다", () => {
  assert.deepEqual(EVO_DEFAULTS, { rounds: 10, cull: 5, noise: 0, payoff: { win: 1, tie: 0, lose: -1 } });
  const evo = createEvolution(C, SIMPLE, { seed: 3 });
  assert.equal(evo.people.length, 25);
  assert.deepEqual(evo.history[0], SIMPLE);
  const r = evo.step();
  assert.equal(r.generation, 1);
  assert.equal(r.scores.length, 25);
  assert.equal(r.out.length, 5);
  assert.equal(r.born.length, 5);
  assert.equal(evo.people.length, 25);
  assert.equal(Object.values(r.counts).reduce((a, b) => a + b, 0), 25);
  assert.deepEqual(Object.keys(r.counts), Object.keys(SIMPLE), "0명이 된 봇도 자리는 남는다");
  // 빠진 사람은 점수가 가장 낮은 다섯 명이다
  const worst = Math.max(...r.out.map((i) => r.scores[i]));
  const kept = r.scores.filter((_, i) => !r.out.includes(i));
  assert.ok(kept.every((s) => s >= worst));
  assert.equal(evo.history.length, 2);
});

test("같은 씨앗이면 같은 진화", () => {
  const a = runEvolution(C, SIMPLE, { seed: 7 }, 10).history;
  const b = runEvolution(C, SIMPLE, { seed: 7 }, 10).history;
  assert.deepEqual(a, b);
});

test("단순한 다섯 전략이면 따라쟁이가 퍼진다(신뢰의 진화의 따라쟁이처럼)", () => {
  const tally = winners(SIMPLE, {}, [1, 2, 3, 4, 5, 6]);
  assert.ok((tally.mirror || 0) >= 4, JSON.stringify(tally));
  assert.ok(!tally.stubborn && !tally.cycle, "고집과 돌림은 먼저 사라진다");
});

test("수 읽기는 오래 만날수록 강하고, 세 판짜리면 못 이긴다", () => {
  const long = winners(READERS, { rounds: 30 }, [1, 2, 3, 4]);
  assert.ok((long.pattern || 0) >= 3, `30판: ${JSON.stringify(long)}`);
  const short = winners(READERS, { rounds: 3 }, [1, 2, 3, 4]);
  assert.ok((short.pattern || 0) <= 1, `3판: ${JSON.stringify(short)}`);
});

test("실수(noise)가 1이면 누구든 아무렇게나 내는 것과 같다", () => {
  const sure = playMatch(C, "avenger", "stubborn", 2000, 11);
  assert.ok((sure.w - sure.l) / 2000 > 0.95, "실수가 없으면 앙갚음이 고집을 거의 다 이긴다");
  const blur = playMatch(C, "avenger", "stubborn", 6000, 11, { noise: 1 });
  assert.ok(Math.abs((blur.w - blur.l) / 6000) < 0.05, JSON.stringify(blur));
  assert.deepEqual(playMatch(C, "pattern", "mirror", 50, 5), playMatch(C, "pattern", "mirror", 50, 5, { noise: 0 }), "noise 0 은 예전과 같다");
});

test("틀린 값은 던진다", () => {
  assert.throws(() => createEvolution(C, { nobody: 3 }));
  assert.throws(() => createEvolution(C, { random: 1 }));
  assert.throws(() => createEvolution(C, { random: 2.5 }));
  const small = createEvolution(C, { random: 2, stubborn: 1 }, { cull: 5 });
  const r = small.step();
  assert.equal(r.out.length, 1, "세 명이면 한 명만 바꾼다");
});
