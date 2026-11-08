// 편으로 하는 놀이: 편 가위바위보 술래잡기, 편 가르기.

/**
 * 편 가위바위보 술래잡기(Rock Paper Scissors Tag). 0번이 나. 처음 편은 0..size-1 과 size..2size-1.
 * 편마다 손 하나를 정해 다 같이 낸다(나는 내가 있는 편의 손을 정한다). 비기면 다시 한다.
 * 진 편 사람은 저마다 catchChance 확률로 잡혀 이긴 편으로 간다. 한 편이 다 사라지거나 maxRounds 판이 지나면 끝난다.
 * 끝나면 사람이 많은 편이 이긴다(같으면 비김, winner -1).
 */
export function createTeamTag(V, { size = 5, catchChance = 0.5, maxRounds = 20 } = {}) {
  const g = {
    size,
    catchChance,
    maxRounds,
    teams: [Array.from({ length: size }, (_, i) => i), Array.from({ length: size }, (_, i) => size + i)],
    round: 0,
    log: [],
    done: false,
    winner: null,
    /** 내가 있는 편(0, 1) */
    myTeam() {
      return g.teams[0].includes(0) ? 0 : 1;
    },
    /**
     * handA, handB: 편 0 과 편 1 의 손. escaped: 내 편이 졌을 때 내가 달아났는지(화면의 누르기 놀이 결과).
     * 주지 않으면 나도 다른 사람처럼 확률로 정한다.
     */
    play(handA, handB, rng, { escaped = null } = {}) {
      if (g.done) throw new Error("이미 끝났다");
      const c = V.cmp(handA, handB);
      const r = { round: g.round + 1, hands: [handA, handB], cmp: c, caught: [] };
      if (c !== 0) {
        const w = c > 0 ? 0 : 1;
        const l = 1 - w;
        const caught = g.teams[l].filter((p) => (p === 0 && escaped !== null ? !escaped : rng.chance(catchChance)));
        g.teams[l] = g.teams[l].filter((p) => !caught.includes(p));
        g.teams[w] = g.teams[w].concat(caught);
        r.winner = w;
        r.caught = caught;
        g.round += 1;
      }
      r.teams = g.teams.map((t) => t.slice());
      g.log.push(r);
      if (g.teams[0].length === 0 || g.teams[1].length === 0 || g.round >= maxRounds) {
        g.done = true;
        const [a, b] = g.teams.map((t) => t.length);
        g.winner = a > b ? 0 : b > a ? 1 : -1;
      }
      return r;
    },
  };
  return g;
}

function choose(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** n 명이 둘 가운데 하나를 아무렇게나 낼 때 두 편이 고르게(짝수면 똑같이, 홀수면 한 명 차이로) 갈릴 확률 */
export function splitChance(n) {
  if (n < 2) return 1;
  const half = Math.floor(n / 2);
  const ways = n % 2 === 0 ? choose(n, half) : 2 * choose(n, half);
  return ways / 2 ** n;
}

/** 편이 갈릴 때까지 내는 횟수의 기대값 */
export function expectedSplitTries(n) {
  return 1 / splitChance(n);
}

/**
 * 편 가르기(グーパー, うらおもて, 엎어라 뒤집어라). 모두 둘 가운데 하나(0 이나 1)를 낸다.
 * 두 편 수가 고르면(짝수면 똑같이, 홀수면 한 명 차이) 갈린다. 아니면 다시 낸다.
 */
export function createTeamSplit({ players = 8 } = {}) {
  const g = {
    players,
    tries: 0,
    log: [],
    done: false,
    teams: null,
    /** picks: 사람마다 0 이나 1 */
    play(picks) {
      if (g.done) throw new Error("이미 끝났다");
      if (!Array.isArray(picks) || picks.length !== players || !picks.every((x) => x === 0 || x === 1)) throw new Error("사람마다 0 이나 1");
      g.tries += 1;
      const ones = picks.filter((x) => x === 1).length;
      const even = Math.abs(players - 2 * ones) <= players % 2;
      const r = { try: g.tries, picks: picks.slice(), counts: [players - ones, ones], even };
      g.log.push(r);
      if (even) {
        g.done = true;
        g.teams = [0, 1].map((side) => picks.map((x, i) => (x === side ? i : -1)).filter((i) => i >= 0));
      }
      return r;
    },
  };
  return g;
}
