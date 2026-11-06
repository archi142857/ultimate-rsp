// 한 판짜리 변종(손을 동시에 내고 바로 판정하는 꼴)의 경기 진행.
// target: 먼저 몇 번 이기면 끝나는지(Infinity 면 끝없이), limits: { 손 id: 쓸 수 있는 횟수 }, carry: 비긴 점수 넘기기

export const FORMATS = [
  { id: "single", name: "단판", target: 1 },
  { id: "bo3", name: "삼세판", target: 2 },
  { id: "bo5", name: "5판 3선승", target: 3 },
  { id: "endless", name: "끝없이", target: Infinity },
];

export function formatById(id) {
  return FORMATS.find((f) => f.id === id) || FORMATS[1];
}

export function createMatch(V, { target = 2, limits = null, carry = false } = {}) {
  const uses = [0, 1].map(() => {
    const u = new Array(V.n).fill(Infinity);
    if (limits) for (const [id, c] of Object.entries(limits)) if (V.index[id] !== undefined) u[V.index[id]] = c;
    return u;
  });
  const m = {
    target,
    carry,
    score: [0, 0],
    pot: 1,
    uses,
    rounds: [],
    done: false,
    winner: null,
    /** side(0: 나, 1: 상대)가 지금 낼 수 있는 손 */
    allowed(side) {
      return uses[side].map((u) => u > 0);
    },
    /** 봇에게 줄 기록(봇 쪽에서 본 me/op) */
    historyFor(side) {
      return m.rounds.map((r) => (side === 0 ? { me: r.a, op: r.b } : { me: r.b, op: r.a }));
    },
    play(a, b) {
      if (m.done) throw new Error("이미 끝난 경기");
      if (!(uses[0][a] > 0) || !(uses[1][b] > 0)) throw new Error("쓸 수 없는 손");
      uses[0][a] -= 1;
      uses[1][b] -= 1;
      const c = V.cmp(a, b);
      let gain = 0;
      if (c !== 0) {
        gain = carry ? m.pot : 1;
        m.score[c > 0 ? 0 : 1] += gain;
        m.pot = 1;
      } else if (carry) {
        m.pot += 1;
      }
      const r = { a, b, cmp: c, gain, pot: m.pot, sentence: V.sentence(a, b) };
      m.rounds.push(r);
      if (m.score[0] >= target || m.score[1] >= target) {
        m.done = true;
        m.winner = m.score[0] >= target ? 0 : 1;
      }
      return r;
    },
  };
  return m;
}
