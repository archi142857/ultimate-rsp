// 이상한 주사위(비추이 주사위). 0 = 나, 1 = 상대.
// 둘이 주사위를 하나씩 고르고(같은 것은 안 된다) 여러 번 굴려, 높은 수가 나온 횟수가 많은 쪽이 이긴다.
// Efron 주사위 넷은 A > B > C > D > A 로 고리를 이루어 다음 주사위를 2/3 로 이긴다.
// Grime 주사위 다섯은 하나씩 굴리면 고리가 둘이고, 둘씩 굴려 합을 겨루면 그 가운데 한 고리가 거꾸로 돈다.

export const DICE_SETS = {
  efron: [
    { id: "A", faces: [4, 4, 4, 4, 0, 0] },
    { id: "B", faces: [3, 3, 3, 3, 3, 3] },
    { id: "C", faces: [6, 6, 2, 2, 2, 2] },
    { id: "D", faces: [5, 5, 5, 1, 1, 1] },
  ],
  grime: [
    { id: "A", faces: [2, 2, 2, 7, 7, 7] },
    { id: "B", faces: [1, 1, 6, 6, 6, 6] },
    { id: "C", faces: [0, 5, 5, 5, 5, 5] },
    { id: "D", faces: [4, 4, 4, 4, 4, 9] },
    { id: "E", faces: [3, 3, 3, 3, 8, 8] },
  ],
};

export function dieOf(set, id) {
  const d = DICE_SETS[set] && DICE_SETS[set].find((x) => x.id === id);
  if (!d) throw new Error(`없는 주사위: ${set} ${id}`);
  return d;
}

/** count 개를 굴린 합의 분포: Map(합 → 확률) */
export function sumDist(faces, count = 1) {
  let dist = new Map([[0, 1]]);
  for (let k = 0; k < count; k++) {
    const next = new Map();
    for (const [s, p] of dist) for (const f of faces) next.set(s + f, (next.get(s + f) || 0) + p / faces.length);
    dist = next;
  }
  return dist;
}

/** 주사위 x 와 y 를 count 개씩 굴려 합을 겨룰 때 x 가 이기고·비기고·질 확률 */
export function duelOdds(x, y, count = 1) {
  const dx = sumDist(x.faces, count);
  const dy = sumDist(y.faces, count);
  let win = 0;
  let tie = 0;
  for (const [a, pa] of dx)
    for (const [b, pb] of dy) {
      if (a > b) win += pa * pb;
      else if (a === b) tie += pa * pb;
    }
  return { win, tie, lose: 1 - win - tie };
}

/** set 에서 상대 주사위 otherId 를 가장 크게 이기는 주사위(이길 확률 - 질 확률이 가장 큰 것) */
export function bestDie(set, otherId, count = 1) {
  const other = dieOf(set, otherId);
  let best = null;
  let edge = -Infinity;
  for (const d of DICE_SETS[set]) {
    if (d.id === otherId) continue;
    const o = duelOdds(d, other, count);
    if (o.win - o.lose > edge) {
      edge = o.win - o.lose;
      best = d.id;
    }
  }
  return best;
}

export function createDiceDuel({ set = "efron", count = 1, rolls = 10 } = {}) {
  if (!DICE_SETS[set]) throw new Error(`없는 주사위 묶음: ${set}`);
  const g = {
    set,
    count,
    rolls,
    dice: [null, null],
    wins: [0, 0],
    ties: 0,
    log: [],
    done: false,
    winner: null,
    choose(side, id) {
      if (g.log.length) throw new Error("이미 굴리기 시작했다");
      dieOf(set, id);
      if (g.dice[1 - side] === id) throw new Error("상대와 같은 주사위는 고를 수 없다");
      g.dice[side] = id;
    },
    ready() {
      return g.dice[0] !== null && g.dice[1] !== null;
    },
    /** 한 번 굴린다. faces: [[내 주사위 눈들], [상대 눈들]] 을 주면 그대로 쓰고(시험용), 아니면 rng 로 굴린다 */
    roll(rng, faces = null) {
      if (g.done) throw new Error("이미 끝났다");
      if (!g.ready()) throw new Error("둘 다 고르지 않았다");
      const got = faces || [0, 1].map((side) => {
        const d = dieOf(set, g.dice[side]);
        return Array.from({ length: count }, () => d.faces[rng.int(d.faces.length)]);
      });
      const sums = got.map((xs) => xs.reduce((a, b) => a + b, 0));
      const c = Math.sign(sums[0] - sums[1]);
      if (c > 0) g.wins[0] += 1;
      else if (c < 0) g.wins[1] += 1;
      else g.ties += 1;
      const r = { faces: got, sums, cmp: c, wins: g.wins.slice() };
      g.log.push(r);
      if (g.log.length >= rolls) {
        g.done = true;
        g.winner = g.wins[0] > g.wins[1] ? 0 : g.wins[1] > g.wins[0] ? 1 : -1;
      }
      return r;
    },
  };
  return g;
}

/** 컴퓨터가 고르는 주사위. 상대가 먼저 골랐으면 가장 좋은 주사위, 아니면 아무거나 */
export function dicePick(rng, set, otherId = null, count = 1) {
  if (otherId) return bestDie(set, otherId, count);
  return rng.pick(DICE_SETS[set]).id;
}
