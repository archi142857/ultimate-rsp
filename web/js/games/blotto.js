// 블로토 대령(Colonel Blotto, Émile Borel 1921). 0 = 나, 1 = 상대.
// 둘이 병사 troops 명을 싸움터 fields 곳에 몰래 나눠 보낸다. 싸움터마다 많이 보낸 쪽이 이기고(같으면 아무도 못 가짐),
// 싸움터를 더 많이 가진 쪽이 그 판을 이긴다. target 판을 먼저 이기면 경기를 이긴다.
// 컴퓨터는 나누는 방법이 많지 않으면(기본 3곳 10명은 66가지) 최적 비율에 가까운 비율로 고른다.
// 비율은 후회 맞추기(regret matching+)를 스스로 맞붙여 구한다. 이 판정표는 비기는 칸이 많아 심플렉스(lp.js)가 돌기만 하고 끝나지 않았다.


/** troops 를 fields 칸에 0 이상 정수로 나누는 모든 방법 */
export function allocations(fields, troops) {
  const out = [];
  const cur = new Array(fields).fill(0);
  (function rec(i, left) {
    if (i === fields - 1) {
      cur[i] = left;
      out.push(cur.slice());
      return;
    }
    for (let x = left; x >= 0; x--) {
      cur[i] = x;
      rec(i + 1, left - x);
    }
  })(0, troops);
  return out;
}

export function isAllocation(a, fields, troops) {
  return Array.isArray(a) && a.length === fields && a.every((x) => Number.isInteger(x) && x >= 0) && a.reduce((s, x) => s + x, 0) === troops;
}

/** 싸움터를 몇 곳씩 가졌나: [a 가 가진 곳, b 가 가진 곳] */
export function fieldsWon(a, b) {
  let wa = 0;
  let wb = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] > b[i]) wa += 1;
    else if (b[i] > a[i]) wb += 1;
  }
  return [wa, wb];
}

/** 한 판 결과: 1 = a 가 이김, -1 = 짐, 0 = 비김 */
export function blottoCmp(a, b) {
  const [wa, wb] = fieldsWon(a, b);
  return Math.sign(wa - wb);
}

export function createBlotto({ fields = 3, troops = 10, target = 3 } = {}) {
  const g = {
    fields,
    troops,
    target,
    score: [0, 0],
    rounds: [],
    done: false,
    winner: null,
    play(a, b) {
      if (g.done) throw new Error("이미 끝났다");
      if (!isAllocation(a, fields, troops) || !isAllocation(b, fields, troops)) throw new Error(`병사 ${troops}명을 ${fields}곳에 나눠야 한다`);
      const won = fieldsWon(a, b);
      const c = Math.sign(won[0] - won[1]);
      if (c > 0) g.score[0] += 1;
      else if (c < 0) g.score[1] += 1;
      const r = { a: a.slice(), b: b.slice(), won, cmp: c, score: g.score.slice() };
      g.rounds.push(r);
      if (g.score[0] >= target || g.score[1] >= target) {
        g.done = true;
        g.winner = g.score[0] >= target ? 0 : 1;
      }
      return r;
    },
  };
  return g;
}

const solved = new Map();
/**
 * 나누는 방법이 limit 가지 이하일 때 최적 비율에 가까운 비율. 너무 많으면 null.
 * 대칭 제로섬이라 값은 0 이다. exploit: 이 비율에 맞서 가장 잘 고른 나눔이 얻는 기대 이득(0 에 가까울수록 좋다).
 */
export function blottoMix(fields, troops, { limit = 300, iterations = 4000 } = {}) {
  const key = `${fields}/${troops}`;
  if (solved.has(key)) return solved.get(key);
  const list = allocations(fields, troops);
  let out = null;
  if (list.length <= limit) {
    const n = list.length;
    const P = list.map((a) => list.map((b) => blottoCmp(a, b)));
    const regret = new Float64Array(n);
    const avg = new Float64Array(n);
    let x = new Float64Array(n).fill(1 / n);
    for (let t = 1; t <= iterations; t++) {
      const u = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        const row = P[i];
        for (let j = 0; j < n; j++) s += row[j] * x[j];
        u[i] = s;
      }
      let ev = 0;
      for (let i = 0; i < n; i++) ev += x[i] * u[i];
      let pos = 0;
      for (let i = 0; i < n; i++) {
        regret[i] = Math.max(0, regret[i] + u[i] - ev);
        pos += regret[i];
      }
      for (let i = 0; i < n; i++) avg[i] += t * x[i];
      x = pos > 0 ? regret.map((r) => r / pos) : new Float64Array(n).fill(1 / n);
    }
    const total = avg.reduce((a, b) => a + b, 0);
    const mix = Array.from(avg, (v) => (v / total > 1e-4 ? v / total : 0));
    const sum = mix.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) mix[i] /= sum;
    let exploit = -Infinity;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += P[i][j] * mix[j];
      if (s > exploit) exploit = s;
    }
    out = { list, mix, exploit };
  }
  solved.set(key, out);
  return out;
}

/** 컴퓨터가 고르는 나눔: 최적 비율이 있으면 거기서, 없으면 아무 나눔이나 고르게 */
export function blottoPick(rng, fields = 3, troops = 10) {
  const m = blottoMix(fields, troops);
  if (m) return m.list[rng.weighted(m.mix)].slice();
  // 별과 막대: 막대 자리 fields-1 개를 고른다
  const bars = [];
  const pool = Array.from({ length: troops + fields - 1 }, (_, i) => i);
  rng.shuffle(pool);
  for (let i = 0; i < fields - 1; i++) bars.push(pool[i]);
  bars.sort((x, y) => x - y);
  const out = [];
  let prev = -1;
  for (const b of bars) {
    out.push(b - prev - 1);
    prev = b;
  }
  out.push(troops + fields - 2 - prev);
  return out;
}
