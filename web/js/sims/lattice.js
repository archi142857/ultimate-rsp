// 격자 생태계 (Reichenbach, Mobilia & Frey 2007 의 확률적 May–Leonard 모형).
// 칸마다 종 하나가 살거나 빈칸(0)이다. 이웃 둘을 골라 셋 가운데 하나가 일어난다.
//   고르기(σ): 이기는 종이 지는 종을 없앤다  AB → A∅
//   번식(μ):  빈칸에 옆 종이 퍼진다          A∅ → AA
//   이동(ε):  둘이 자리를 바꾼다             AB → BA
// 이동성 M = 2ε / N (한 개체가 한 단위 시간에 돌아다니는 격자 넓이의 비율). 임계값은 약 4.5 × 10⁻⁴.

export const CRITICAL_MOBILITY = 4.5e-4;

export function createLattice({ L = 100, win, rng, mobility = 1e-4, sigma = 1, mu = 1, mixed = false, empty = 0.1 } = {}) {
  const S = win.length;
  const N = L * L;
  const grid = new Uint8Array(N);
  const counts = new Float64Array(S + 1);
  const sim = {
    L,
    N,
    S,
    grid,
    counts,
    time: 0,
    mixed,
    sigma,
    mu,
    eps: (mobility * N) / 2,
    setMobility(m) {
      sim.eps = (m * N) / 2;
    },
    mobility() {
      return (2 * sim.eps) / N;
    },
    reset(seedFill = true) {
      counts.fill(0);
      for (let i = 0; i < N; i++) {
        const v = seedFill ? (rng.next() < empty ? 0 : 1 + rng.int(S)) : 0;
        grid[i] = v;
        counts[v] += 1;
      }
      sim.time = 0;
    },
    /** 단위 시간 dt 만큼 돌린다 */
    advance(dt = 1) {
      const total = sim.sigma + sim.mu + sim.eps;
      const pSel = sim.sigma / total;
      const pRep = (sim.sigma + sim.mu) / total;
      const events = Math.max(1, Math.round(N * total * dt));
      for (let e = 0; e < events; e++) {
        const i = (rng.next() * N) | 0;
        let j;
        if (sim.mixed) {
          j = (rng.next() * N) | 0;
          if (j === i) continue;
        } else {
          const x = i % L;
          const y = (i / L) | 0;
          const d = (rng.next() * 4) | 0;
          if (d === 0) j = y * L + ((x + 1) % L);
          else if (d === 1) j = y * L + ((x + L - 1) % L);
          else if (d === 2) j = ((y + 1) % L) * L + x;
          else j = ((y + L - 1) % L) * L + x;
        }
        const a = grid[i];
        const b = grid[j];
        const r = rng.next();
        if (r < pSel) {
          if (a && b) {
            if (win[a - 1][b - 1]) {
              grid[j] = 0;
              counts[b] -= 1;
              counts[0] += 1;
            } else if (win[b - 1][a - 1]) {
              grid[i] = 0;
              counts[a] -= 1;
              counts[0] += 1;
            }
          }
        } else if (r < pRep) {
          if (a && !b) {
            grid[j] = a;
            counts[a] += 1;
            counts[0] -= 1;
          } else if (b && !a) {
            grid[i] = b;
            counts[b] += 1;
            counts[0] -= 1;
          }
        } else {
          grid[i] = b;
          grid[j] = a;
        }
      }
      sim.time += dt;
    },
    alive() {
      let k = 0;
      for (let s = 1; s <= S; s++) if (counts[s] > 0) k += 1;
      return k;
    },
    fractions() {
      return Array.from({ length: S }, (_, s) => counts[s + 1] / N);
    },
  };
  sim.reset();
  return sim;
}
