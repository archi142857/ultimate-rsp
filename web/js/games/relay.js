// 가위바위보 릴레이(どんじゃんけん, Hoop Hop Showdown). 0 = 나(왼쪽 편), 1 = 상대(오른쪽 편).
// 칸이 cells 개인 길의 양 끝(자리 0 과 cells+1)이 두 편의 진지다. 편마다 한 명씩 나와 한 번에 한 칸씩 다가가고,
// 같은 칸이나 옆 칸에서 만나면 가위바위보를 한다. 이긴 사람은 그 자리에서 계속 가고, 진 편은 진지에서 다음 사람이 나온다.
// 진지에 막 나와 서 있는 사람에게 이기면 그 진지에 들어가 1점이다. target 점을 먼저 내면 이긴다.
// 시간은 FiveThirtyEight Riddler 처럼 한 칸에 1초, 가위바위보 한 번에 1초로 센다.

export function createRelay(V, { cells = 8, target = 1 } = {}) {
  if (!(Number.isInteger(cells) && cells >= 1)) throw new Error("칸 수는 1 이상의 정수");
  const home = [0, cells + 1];
  const s = {
    cells,
    target,
    home,
    pos: home.slice(),
    runner: [1, 1],
    score: [0, 0],
    phase: "run",
    hops: 0,
    throws: 0,
    rounds: [],
    done: false,
    winner: null,
    met() {
      return s.pos[1] - s.pos[0] <= 1;
    },
    /** 두 사람이 한 칸씩 다가간다. 만나면 phase 가 janken 이 된다. 움직였으면 true */
    step() {
      if (s.done || s.phase !== "run") return false;
      if (s.met()) {
        s.phase = "janken";
        return false;
      }
      s.pos[0] += 1;
      s.pos[1] -= 1;
      s.hops += 1;
      if (s.met()) s.phase = "janken";
      return true;
    },
    /** 만날 때까지 걷는다. 걸은 횟수 */
    run() {
      let n = 0;
      while (s.step()) n += 1;
      return n;
    },
    janken(a, b) {
      if (s.done || s.phase !== "janken") throw new Error("지금은 가위바위보 차례가 아니다");
      s.throws += 1;
      const c = V.cmp(a, b);
      const r = { a, b, cmp: c, pos: s.pos.slice(), runner: s.runner.slice(), winner: null, point: null };
      if (c !== 0) {
        const w = c > 0 ? 0 : 1;
        const l = 1 - w;
        r.winner = w;
        if (s.pos[l] === home[l]) {
          // 진지를 막던 사람에게 이겼다: 진지에 들어간다
          r.point = w;
          s.score[w] += 1;
          if (s.score[w] >= target) {
            s.done = true;
            s.winner = w;
          } else {
            s.pos = home.slice();
            s.runner = [s.runner[0] + 1, s.runner[1] + 1];
          }
        } else {
          s.pos[l] = home[l];
          s.runner[l] += 1;
        }
        if (!s.done) s.phase = s.met() ? "janken" : "run";
      }
      r.score = s.score.slice();
      s.rounds.push(r);
      return r;
    },
    /** Riddler 셈의 지난 시간(초) */
    seconds() {
      return s.hops + s.throws;
    },
  };
  return s;
}

/** 둘 다 아무렇게나 낼 때 한 경기를 끝까지 돌린다 */
export function playRelay(V, rng, opts = {}) {
  const s = createRelay(V, opts);
  let guard = 0;
  while (!s.done && guard++ < 1e6) {
    s.run();
    if (s.phase === "janken") s.janken(rng.int(V.n), rng.int(V.n));
  }
  return s;
}

/** 칸 수별 평균 시간(초)과 가위바위보 횟수. games 번 돌린다 */
export function relayStats(V, rng, cells, games = 2000) {
  let sec = 0;
  let thr = 0;
  let max = 0;
  for (let i = 0; i < games; i++) {
    const s = playRelay(V, rng, { cells });
    sec += s.seconds();
    thr += s.throws;
    if (s.seconds() > max) max = s.seconds();
  }
  return { cells, games, seconds: sec / games, throws: thr / games, max };
}
