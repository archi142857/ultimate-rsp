// 가위바위보 전쟁: 손들이 판 위를 떠돌다 부딪히면 진 쪽이 이긴 쪽으로 바뀐다.

export function createWar({ win, rng, perKind = 30, width = 600, height = 400, radius = 11, speed = 60 } = {}) {
  const S = win.length;
  const agents = [];
  for (let s = 0; s < S; s++) {
    for (let k = 0; k < perKind; k++) {
      const ang = rng.next() * Math.PI * 2;
      agents.push({
        x: radius + rng.next() * (width - 2 * radius),
        y: radius + rng.next() * (height - 2 * radius),
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        kind: s,
        flash: 0,
      });
    }
  }
  const sim = {
    agents,
    width,
    height,
    radius,
    time: 0,
    conversions: 0,
    counts() {
      const c = new Array(S).fill(0);
      for (const a of agents) c[a.kind] += 1;
      return c;
    },
    done() {
      const c = sim.counts();
      return c.filter((x) => x > 0).length <= 1;
    },
    step(dt) {
      const r = radius;
      for (const a of agents) {
        // 조금씩 방향을 흔든다
        const turn = (rng.next() - 0.5) * 1.2 * dt;
        const cs = Math.cos(turn);
        const sn = Math.sin(turn);
        const vx = a.vx * cs - a.vy * sn;
        const vy = a.vx * sn + a.vy * cs;
        a.vx = vx;
        a.vy = vy;
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if (a.x < r) {
          a.x = r;
          a.vx = Math.abs(a.vx);
        } else if (a.x > width - r) {
          a.x = width - r;
          a.vx = -Math.abs(a.vx);
        }
        if (a.y < r) {
          a.y = r;
          a.vy = Math.abs(a.vy);
        } else if (a.y > height - r) {
          a.y = height - r;
          a.vy = -Math.abs(a.vy);
        }
        if (a.flash > 0) a.flash = Math.max(0, a.flash - dt);
      }
      // 칸 나누기로 가까운 짝만 본다
      const cell = 2 * r;
      const cols = Math.ceil(width / cell);
      const buckets = new Map();
      agents.forEach((a, i) => {
        const key = Math.floor(a.y / cell) * cols + Math.floor(a.x / cell);
        let b = buckets.get(key);
        if (!b) buckets.set(key, (b = []));
        b.push(i);
      });
      const d2 = (2 * r) * (2 * r);
      for (const [key, list] of buckets) {
        const cx = key % cols;
        const cy = Math.floor(key / cols);
        for (let dy = 0; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx < 0) continue;
            const other = buckets.get((cy + dy) * cols + (cx + dx));
            if (!other) continue;
            for (const i of list) {
              for (const j of other) {
                if (other === list && j <= i) continue;
                const A = agents[i];
                const B = agents[j];
                const ddx = B.x - A.x;
                const ddy = B.y - A.y;
                const dist2 = ddx * ddx + ddy * ddy;
                if (dist2 >= d2 || dist2 === 0) continue;
                // 밀어내기
                const dist = Math.sqrt(dist2);
                const push = (2 * r - dist) / 2;
                const ux = ddx / dist;
                const uy = ddy / dist;
                A.x -= ux * push;
                A.y -= uy * push;
                B.x += ux * push;
                B.y += uy * push;
                // 부딪히면 속도를 맞바꾼다(대충의 탄성 충돌)
                const av = A.vx * ux + A.vy * uy;
                const bv = B.vx * ux + B.vy * uy;
                A.vx += (bv - av) * ux;
                A.vy += (bv - av) * uy;
                B.vx += (av - bv) * ux;
                B.vy += (av - bv) * uy;
                if (A.kind !== B.kind) {
                  if (win[A.kind][B.kind]) {
                    B.kind = A.kind;
                    B.flash = 0.35;
                    sim.conversions += 1;
                  } else if (win[B.kind][A.kind]) {
                    A.kind = B.kind;
                    A.flash = 0.35;
                    sim.conversions += 1;
                  }
                }
              }
            }
          }
        }
      }
      sim.time += dt;
    },
  };
  return sim;
}
