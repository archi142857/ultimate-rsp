// 전략의 진화: Nicky Case 의 '신뢰의 진화'(The Evolution of Trust, 2017)처럼 리그를 거듭한다.
// 한 세대: 모두가 서로 한 번씩 rounds 판 겨루고(같은 전략끼리도), 점수가 가장 낮은 cull 명이 빠지고
// 가장 높은 cull 명이 하나씩 더 생긴다. 점수는 판마다 이김 win·비김 tie·짐 lose 점을 더한 것.

import { botInfo } from "../core/bots.js";
import { makeRng } from "../core/rng.js";
import { playMatch } from "./league.js";

/** 신뢰의 진화와 같은 기본값: 25명, 한 경기 10판, 세대마다 5명 */
export const EVO_DEFAULTS = { rounds: 10, cull: 5, noise: 0, payoff: { win: 1, tie: 0, lose: -1 } };

/**
 * population: { 봇 id: 사람 수 } (넣은 차례가 화면 차례)
 * 돌려주는 객체
 *  - people: 사람마다 봇 id(배열 차례가 자리)
 *  - counts(): { 봇 id: 사람 수 } (처음 넣은 봇은 0명이어도 남긴다)
 *  - step(): 한 세대를 돌리고 { generation, scores, out, born, counts } 를 돌려준다
 *    scores 는 사람마다 이번 세대 점수, out 은 빠진 사람 자리(빠지기 전 차례), born 은 새로 생긴 봇 id
 *  - history: 세대마다 counts(0세대 포함)
 *  - done: 한 가지 봇만 남았으면 참
 */
export function createEvolution(V, population, { rounds = EVO_DEFAULTS.rounds, cull = EVO_DEFAULTS.cull, noise = EVO_DEFAULTS.noise, payoff = EVO_DEFAULTS.payoff, seed = 1 } = {}) {
  const order = Object.keys(population);
  for (const id of order) {
    if (botInfo(id).id !== id) throw new Error(`모르는 봇: ${id}`);
    const n = population[id];
    if (!Number.isInteger(n) || n < 0) throw new Error(`사람 수가 틀림: ${id} ${n}`);
  }
  const rng = makeRng(seed);
  const people = order.flatMap((id) => new Array(population[id]).fill(id));
  if (people.length < 2) throw new Error("두 명은 있어야 겨룬다");
  const k = Math.max(0, Math.min(cull, Math.floor(people.length / 2)));

  const counts = () => {
    const c = Object.fromEntries(order.map((id) => [id, 0]));
    for (const id of evo.people) c[id] += 1;
    return c;
  };

  const evo = {
    people,
    generation: 0,
    history: [],
    get done() {
      return new Set(evo.people).size <= 1;
    },
    counts,
    /** 한 세대 점수만 매긴다(사람은 그대로) */
    score() {
      const n = evo.people.length;
      const scores = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const r = playMatch(V, evo.people[i], evo.people[j], rounds, rng.int(2 ** 31), { noise });
          scores[i] += r.w * payoff.win + r.d * payoff.tie + r.l * payoff.lose;
          scores[j] += r.l * payoff.win + r.d * payoff.tie + r.w * payoff.lose;
        }
      }
      return scores;
    },
    step() {
      const scores = evo.score();
      // 점수가 같으면 제비뽑기로 차례를 정한다
      const tie = evo.people.map(() => rng.int(2 ** 31));
      const rank = evo.people.map((_, i) => i).sort((a, b) => scores[a] - scores[b] || tie[a] - tie[b]);
      const out = rank.slice(0, k);
      const top = rank.slice(rank.length - k);
      const born = top.map((i) => evo.people[i]);
      const gone = new Set(out);
      evo.people = evo.people.filter((_, i) => !gone.has(i)).concat(born);
      // 같은 봇끼리 모아 둔다(화면이 자리를 그리기 쉽게)
      evo.people.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      evo.generation += 1;
      const c = counts();
      evo.history.push(c);
      return { generation: evo.generation, scores, out, born, counts: c };
    },
  };
  evo.history.push(counts());
  return evo;
}

/** 끝까지(한 가지만 남거나 maxGen 세대) 돌려 history 를 돌려준다 */
export function runEvolution(V, population, opts = {}, maxGen = 50) {
  const evo = createEvolution(V, population, opts);
  while (!evo.done && evo.generation < maxGen) evo.step();
  return evo;
}
