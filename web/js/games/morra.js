// 모라(Morra, 划拳). 0 = 나, 1 = 상대.
// 둘이 동시에 손가락 0~5개를 펴며 손가락 합을 외친다. 한 사람만 맞히면 그 사람이 1점, 둘 다 맞히거나 다 틀리면 점수가 없다.
// target 점을 먼저 내면 이긴다.
// 홀짝(createOddEven): 한쪽은 홀, 한쪽은 짝을 맡고 손가락 합이 홀이면 홀 쪽이, 짝이면 짝 쪽이 판을 이긴다.

export const MAX_FINGERS = 5;

const isFingers = (f) => Number.isInteger(f) && f >= 0 && f <= MAX_FINGERS;

export function createMorra({ target = 3 } = {}) {
  const g = {
    target,
    score: [0, 0],
    rounds: [],
    done: false,
    winner: null,
    /** fa, fb: 편 손가락 수. ga, gb: 외친 합 */
    play(fa, ga, fb, gb) {
      if (g.done) throw new Error("이미 끝났다");
      if (!isFingers(fa) || !isFingers(fb)) throw new Error("손가락은 0~5개");
      if (![ga, gb].every((x) => Number.isInteger(x) && x >= 0 && x <= 2 * MAX_FINGERS)) throw new Error("합은 0~10");
      const sum = fa + fb;
      const hit = [ga === sum, gb === sum];
      const point = hit[0] && !hit[1] ? 0 : hit[1] && !hit[0] ? 1 : null;
      if (point !== null) g.score[point] += 1;
      const r = { fingers: [fa, fb], guesses: [ga, gb], sum, hit, point, score: g.score.slice() };
      g.rounds.push(r);
      if (point !== null && g.score[point] >= target) {
        g.done = true;
        g.winner = point;
      }
      return r;
    },
  };
  return g;
}

/** 홀짝. odd: 홀을 맡은 쪽(0 이나 1) */
export function createOddEven({ target = 3, odd = 0 } = {}) {
  const g = {
    target,
    odd,
    score: [0, 0],
    rounds: [],
    done: false,
    winner: null,
    play(fa, fb) {
      if (g.done) throw new Error("이미 끝났다");
      if (!isFingers(fa) || !isFingers(fb)) throw new Error("손가락은 0~5개");
      const sum = fa + fb;
      const w = sum % 2 === 1 ? odd : 1 - odd;
      g.score[w] += 1;
      const r = { fingers: [fa, fb], sum, winner: w, score: g.score.slice() };
      g.rounds.push(r);
      if (g.score[w] >= target) {
        g.done = true;
        g.winner = w;
      }
      return r;
    },
  };
  return g;
}

/** 컴퓨터: 손가락은 아무렇게나, 합은 제 손가락에 상대가 낼 만한 수(0~5)를 더해 외친다 */
export function morraPick(rng) {
  const fingers = rng.int(MAX_FINGERS + 1);
  return { fingers, guess: fingers + rng.int(MAX_FINGERS + 1) };
}
