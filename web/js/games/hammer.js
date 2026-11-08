// 뿅망치 가위바위보(たたいて・かぶって・ジャンケンポン). 0 = 나, 1 = 상대. 손은 가위바위보 변종(V)의 번호.
// 1단계(janken): 가위바위보. 2단계(strike): 이긴 쪽은 뿅망치로 치고 진 쪽은 헬멧을 쓴다.
// 화면은 손을 보인 뒤 '치기'·'막기'를 누른 시각(ms)을 잰다. 헬멧이 먼저거나 같으면 막은 것이고, 막기 전에 치면 1점이다.
// 정한 시간 안에 안 치면 헛친 것이다. 어느 쪽이든 다시 가위바위보부터 한다. target 점 먼저 내면 이긴다.

/** 이긴 쪽이 칠 수 있는 시간(ms) */
export const STRIKE_MS = 1500;

export function createHammer(V, { target = 3, limit = STRIKE_MS } = {}) {
  const g = {
    target,
    limit,
    phase: "janken",
    striker: null,
    score: [0, 0],
    rounds: [],
    done: false,
    winner: null,
    janken(a, b) {
      if (g.done || g.phase !== "janken") throw new Error("지금은 가위바위보 차례가 아니다");
      const c = V.cmp(a, b);
      const r = { kind: "janken", a, b, cmp: c };
      if (c !== 0) {
        g.striker = c > 0 ? 0 : 1;
        g.phase = "strike";
      }
      g.rounds.push(r);
      return r;
    },
    /** hitMs: 이긴 쪽이 '치기'를 누른 시각, guardMs: 진 쪽이 '막기'를 누른 시각(안 눌렀으면 Infinity) */
    strike(hitMs, guardMs) {
      if (g.done || g.phase !== "strike") throw new Error("지금은 치기 차례가 아니다");
      const hit = Number.isFinite(hitMs) && hitMs <= limit;
      const guarded = Number.isFinite(guardMs) && guardMs <= hitMs;
      const result = !hit ? "miss" : guarded ? "blocked" : "hit";
      const r = { kind: "strike", striker: g.striker, hitMs, guardMs, result };
      if (result === "hit") {
        g.score[g.striker] += 1;
        if (g.score[g.striker] >= target) {
          g.done = true;
          g.winner = g.striker;
        }
      }
      r.score = g.score.slice();
      g.phase = "janken";
      g.striker = null;
      g.rounds.push(r);
      return r;
    },
  };
  return g;
}
