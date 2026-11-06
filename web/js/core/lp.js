// 두 사람 제로섬 게임의 최적 섞기(혼합 전략)를 선형 계획법(심플렉스)으로 푼다.
// 가위바위보 변종의 '최적 섞기', 하나빼기의 두 손 고르기, 글리코·한정 가위바위보의 계산기 봇이 쓴다.

const EPS = 1e-12;

/**
 * 최대화: c·x, 조건: A x ≤ b, x ≥ 0 (b ≥ 0 이어야 한다).
 * 돌려주는 것: x(해), y(조건마다의 쌍대값), value(최댓값)
 */
export function simplexMax(A, b, c) {
  const m = A.length;
  const n = c.length;
  const W = n + m + 1;
  const T = [];
  for (let i = 0; i < m; i++) {
    const row = new Float64Array(W);
    for (let j = 0; j < n; j++) row[j] = A[i][j];
    row[n + i] = 1;
    row[W - 1] = b[i];
    T.push(row);
  }
  const obj = new Float64Array(W);
  for (let j = 0; j < n; j++) obj[j] = -c[j];
  T.push(obj);
  const basis = [];
  for (let i = 0; i < m; i++) basis.push(n + i);

  for (let iter = 0; iter < 5000; iter++) {
    // 들어올 변수: Bland 규칙(가장 작은 번호의 음수 감소비용) — 되돌이를 막는다
    let e = -1;
    for (let j = 0; j < n + m; j++) {
      if (T[m][j] < -1e-11) {
        e = j;
        break;
      }
    }
    if (e < 0) break;
    let l = -1;
    let best = Infinity;
    for (let i = 0; i < m; i++) {
      if (T[i][e] > 1e-11) {
        const r = T[i][W - 1] / T[i][e];
        if (r < best - 1e-12 || (Math.abs(r - best) <= 1e-12 && basis[i] < basis[l])) {
          best = r;
          l = i;
        }
      }
    }
    if (l < 0) throw new Error("unbounded");
    pivot(T, l, e);
    basis[l] = e;
  }

  const x = new Array(n).fill(0);
  for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][W - 1];
  const y = new Array(m);
  for (let i = 0; i < m; i++) y[i] = T[m][n + i];
  return { x, y, value: T[m][W - 1] };
}

function pivot(T, l, e) {
  const W = T[0].length;
  const pr = T[l];
  const pv = pr[e];
  for (let j = 0; j < W; j++) pr[j] /= pv;
  for (let i = 0; i < T.length; i++) {
    if (i === l) continue;
    const row = T[i];
    const f = row[e];
    if (Math.abs(f) < EPS) continue;
    for (let j = 0; j < W; j++) row[j] -= f * pr[j];
  }
}

/**
 * 행 선수가 P[i][j] 를 얻는 제로섬 게임을 푼다.
 * 돌려주는 것: value(행 선수의 기대 이득), row(행 선수의 섞기), col(열 선수의 섞기)
 */
export function solveGame(P) {
  const m = P.length;
  const n = P[0].length;
  let min = Infinity;
  for (const r of P) for (const v of r) if (v < min) min = v;
  const k = 1 - min; // 모든 칸이 1 이상이 되게 민다
  const B = P.map((r) => r.map((v) => v + k));
  const { x: q, y: p, value } = simplexMax(B, new Array(m).fill(1), new Array(n).fill(1));
  const v = 1 / value;
  return { value: v - k, row: tidy(p.map((t) => t * v)), col: tidy(q.map((t) => t * v)) };
}

/** 아주 작은 음수·찌꺼기를 지우고 합을 1로 맞춘다 */
export function tidy(ps) {
  const out = ps.map((p) => (p > 1e-9 ? p : 0));
  const s = out.reduce((a, b) => a + b, 0);
  return s > 0 ? out.map((p) => p / s) : ps.map(() => 1 / ps.length);
}

/** 섞기 x 를 썼을 때 상대가 고를 수 있는 가장 좋은 대응의 이득(행렬은 행 선수 기준) */
export function bestReplyValue(P, x) {
  let best = -Infinity;
  const n = P[0].length;
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < P.length; i++) s += x[i] * P[i][j];
    if (-s > best) best = -s;
  }
  return best; // 상대 기준 이득. 0 이하면 x 는 (대칭 게임에서) 지지 않는 섞기
}
