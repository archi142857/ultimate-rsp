// 글리코(계단 가위바위보). 이긴 쪽만 이긴 손의 글자 수만큼 오른다.

import { solveGame } from "../core/lp.js";

export const GLICO_WORDS = {
  rock: { steps: 3, kana: ["グ", "リ", "コ"], read: "구리코" },
  scissors: { steps: 6, kana: ["チ", "ヨ", "コ", "レ", "イ", "ト"], read: "치요코레이토" },
  paper: { steps: 6, kana: ["パ", "イ", "ナ", "ツ", "プ", "ル"], read: "파이나쓰푸루" },
};

export function stepsOf(V) {
  return V.hands.map((h) => GLICO_WORDS[h.id].steps);
}

export function createGlico(V, goal = 30) {
  const steps = stepsOf(V);
  const g = {
    goal,
    pos: [0, 0],
    rounds: [],
    done: false,
    winner: null,
    play(a, b) {
      if (g.done) throw new Error("이미 끝났다");
      const c = V.cmp(a, b);
      const r = { a, b, cmp: c, moved: 0, by: null };
      if (c > 0) {
        r.by = 0;
        r.moved = steps[a];
        g.pos[0] = Math.min(goal, g.pos[0] + steps[a]);
      } else if (c < 0) {
        r.by = 1;
        r.moved = steps[b];
        g.pos[1] = Math.min(goal, g.pos[1] + steps[b]);
      }
      r.pos = g.pos.slice();
      g.rounds.push(r);
      if (g.pos[0] >= goal || g.pos[1] >= goal) {
        g.done = true;
        g.winner = g.pos[0] >= goal ? 0 : 1;
      }
      return r;
    },
  };
  return g;
}

/** 길게 이어질 때(꼭대기가 멀 때)의 최적 섞기: 칸 차이를 이득으로 본 제로섬 게임 */
export function steadyMix(V) {
  const s = stepsOf(V);
  const P = V.hands.map((_, a) => V.hands.map((__, b) => (V.win[a][b] ? s[a] : V.win[b][a] ? -s[b] : 0)));
  return solveGame(P).row;
}

/**
 * 자리마다 이길 확률과 최적 섞기를 동적 계획법으로 구한다.
 * value[pa][pb] = 내가 pa, 상대가 pb 칸에 있을 때 내가 이길 확률(둘 다 최선을 다할 때)
 * mix[pa][pb]   = 그 자리에서 내 최적 섞기. 상대의 최적 섞기는 mix[pb][pa]
 */
export function solveGlico(V, goal = 30) {
  const s = stepsOf(V);
  const n = V.n;
  const value = Array.from({ length: goal }, () => new Array(goal).fill(0));
  const mix = Array.from({ length: goal }, () => new Array(goal).fill(null));
  const get = (pa, pb) => (pa >= goal ? 1 : pb >= goal ? 0 : value[pa][pb]);
  for (let sum = 2 * (goal - 1); sum >= 0; sum--) {
    for (let pa = Math.min(goal - 1, sum); pa >= 0 && sum - pa < goal; pa--) {
      const pb = sum - pa;
      let x = 0.5;
      let sol = null;
      for (let it = 0; it < 60; it++) {
        const M = [];
        for (let a = 0; a < n; a++) {
          const row = [];
          for (let b = 0; b < n; b++) {
            if (V.win[a][b]) row.push(get(pa + s[a], pb));
            else if (V.win[b][a]) row.push(get(pa, pb + s[b]));
            else row.push(x);
          }
          M.push(row);
        }
        sol = solveGame(M);
        if (Math.abs(sol.value - x) < 1e-10) {
          x = sol.value;
          break;
        }
        x = sol.value;
      }
      value[pa][pb] = x;
      mix[pa][pb] = sol.row;
    }
  }
  return { goal, value, mix };
}
