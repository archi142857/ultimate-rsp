// 하나빼기. 1단계(two): 두 손을 동시에 낸다. 2단계(one): 서로 두 손을 보고 한 손을 남긴다. 비기면 1단계부터 다시.

import { solveGame } from "../core/lp.js";

export function createMinusOne(V) {
  const g = {
    phase: "two",
    pairs: null,
    rounds: [],
    done: false,
    winner: null,
    two(pa, pb) {
      if (g.phase !== "two" || g.done) throw new Error("지금은 두 손 낼 차례가 아니다");
      g.pairs = [pa.slice(), pb.slice()];
      g.phase = "one";
      return g.pairs;
    },
    /** ka, kb: 남길 손의 자리(0 왼손, 1 오른손) */
    one(ka, kb) {
      if (g.phase !== "one" || g.done) throw new Error("지금은 하나 뺄 차례가 아니다");
      const a = g.pairs[0][ka];
      const b = g.pairs[1][kb];
      const c = V.cmp(a, b);
      const r = { pairs: g.pairs, ka, kb, a, b, cmp: c, sentence: V.sentence(a, b) };
      g.rounds.push(r);
      if (c === 0) {
        g.phase = "two";
        g.pairs = null;
      } else {
        g.done = true;
        g.winner = c > 0 ? 0 : 1;
      }
      return r;
    },
  };
  return g;
}

/** 두 손을 서로 본 뒤의 2×2 게임. mine/theirs: [손, 손]. 비기면 다시 하므로 비김의 값은 0 */
export function keepGame(V, mine, theirs) {
  const P = mine.map((a) => theirs.map((b) => V.cmp(a, b)));
  const sol = solveGame(P);
  return { P, mix: sol.row, theirMix: sol.col, value: sol.value };
}

/** 1단계에서 어떤 두 손 짝을 내는 게 좋은지: 짝(같은 손 둘 포함)마다 2단계 값을 표로 만들어 푼다 */
export function pairGame(V) {
  const pairs = [];
  for (let i = 0; i < V.n; i++) for (let j = i; j < V.n; j++) pairs.push([i, j]);
  const P = pairs.map((p) => pairs.map((q) => keepGame(V, p, q).value));
  const sol = solveGame(P);
  return { pairs, P, mix: sol.row, value: sol.value };
}
