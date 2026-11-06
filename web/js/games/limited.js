// 한정 가위바위보(둘이 하는 판). 손마다 카드 cards 장, 별 stars 개로 시작한다.
// 한 판에 한 장씩 같이 내고, 이기면 상대 별 하나를 가져온다. 카드를 다 쓰거나 누가 별을 다 잃으면 끝.

import { solveGame } from "../core/lp.js";

export function createLimited(V, { cards = 4, stars = 3 } = {}) {
  const g = {
    cards,
    stars0: stars,
    hand: [new Array(V.n).fill(cards), new Array(V.n).fill(cards)],
    stars: [stars, stars],
    rounds: [],
    done: false,
    winner: null, // 0, 1, 또는 비기면 -1
    left() {
      return g.hand[0].reduce((a, b) => a + b, 0);
    },
    allowed(side) {
      return g.hand[side].map((c) => c > 0);
    },
    play(a, b) {
      if (g.done) throw new Error("이미 끝났다");
      if (!(g.hand[0][a] > 0) || !(g.hand[1][b] > 0)) throw new Error("없는 카드");
      g.hand[0][a] -= 1;
      g.hand[1][b] -= 1;
      const c = V.cmp(a, b);
      if (c > 0) {
        g.stars[0] += 1;
        g.stars[1] -= 1;
      } else if (c < 0) {
        g.stars[0] -= 1;
        g.stars[1] += 1;
      }
      const r = { a, b, cmp: c, stars: g.stars.slice(), sentence: V.sentence(a, b) };
      g.rounds.push(r);
      if (g.stars[0] <= 0 || g.stars[1] <= 0 || g.left() === 0) {
        g.done = true;
        g.winner = g.stars[0] > g.stars[1] ? 0 : g.stars[1] > g.stars[0] ? 1 : -1;
      }
      return r;
    },
  };
  return g;
}

/**
 * 끝까지 내다보는 계산기. 이기면 +1, 비기면 0, 지면 -1 의 기댓값을 최대로 하는 섞기를 구한다.
 * 상태: (내 카드, 상대 카드, 내 별). 전체 별 수는 늘 2 × stars.
 */
export function createLimitedSolver(V, { stars = 3 } = {}) {
  const total = 2 * stars;
  const memo = new Map();
  const key = (mine, theirs, s) => mine.join("") + "|" + theirs.join("") + "|" + s;
  function solve(mine, theirs, s) {
    const left = mine.reduce((a, b) => a + b, 0);
    if (s <= 0) return { value: -1, mix: null };
    if (s >= total) return { value: 1, mix: null };
    if (left === 0) return { value: Math.sign(s - (total - s)), mix: null };
    const k = key(mine, theirs, s);
    const hit = memo.get(k);
    if (hit) return hit;
    const A = [];
    const B = [];
    for (let i = 0; i < V.n; i++) if (mine[i] > 0) A.push(i);
    for (let j = 0; j < V.n; j++) if (theirs[j] > 0) B.push(j);
    const P = A.map((i) =>
      B.map((j) => {
        const m2 = mine.slice();
        const t2 = theirs.slice();
        m2[i] -= 1;
        t2[j] -= 1;
        const c = V.cmp(i, j);
        return solve(m2, t2, s + c).value;
      }),
    );
    const sol = solveGame(P);
    const mix = new Array(V.n).fill(0);
    A.forEach((i, t) => (mix[i] = sol.row[t]));
    const out = { value: sol.value, mix };
    memo.set(k, out);
    return out;
  }
  return {
    /** side 쪽에서 본 최적 섞기와 값 */
    best(game, side) {
      const mine = game.hand[side];
      const theirs = game.hand[1 - side];
      return solve(mine.slice(), theirs.slice(), game.stars[side]);
    },
    solve,
    size: () => memo.size,
  };
}
