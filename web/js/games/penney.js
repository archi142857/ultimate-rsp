// 동전 순서 겨루기(Penney's game, Walter Penney 1969). 0 = 나, 1 = 상대.
// 둘이 앞(H)·뒤(T) length 개짜리 순서를 하나씩 고르고(같은 것은 안 된다), 동전을 던져 먼저 나온 순서를 고른 쪽이 이긴다.
// 나중에 고르는 쪽은 늘 더 나은 순서를 고를 수 있다: 상대 순서의 가운데를 뒤집어 맨 앞에 두고, 상대 순서의 앞 두 개를 붙인다.

export const COIN = ["H", "T"];
const flip = (c) => (c === "H" ? "T" : "H");

/** 고를 수 있는 순서 모두(사전 차례) */
export function allSequences(length = 3) {
  let out = [""];
  for (let i = 0; i < length; i++) out = out.flatMap((s) => [s + "H", s + "T"]);
  return out;
}

export function isSequence(seq, length = 3) {
  return typeof seq === "string" && seq.length === length && /^[HT]+$/.test(seq);
}

/** 길이 3 순서에 맞서는 가장 좋은 순서 */
export function bestReply(seq) {
  if (!isSequence(seq, seq.length) || seq.length < 2) throw new Error("앞뒤 순서가 아니다");
  return flip(seq[1]) + seq.slice(0, seq.length - 1);
}

/** Conway 의 겹침 수: x 의 뒤 k 개가 y 의 앞 k 개와 같으면 2^(k-1) 을 더한다 */
function overlap(x, y) {
  let s = 0;
  for (let k = 1; k <= Math.min(x.length, y.length); k++) if (x.slice(-k) === y.slice(0, k)) s += 2 ** (k - 1);
  return s;
}

/** 길이가 같고 다른 두 순서에서 a 가 b 보다 먼저 나올 확률(Conway 공식) */
export function firstChance(a, b) {
  if (a === b) throw new Error("같은 순서");
  const aFirst = overlap(b, b) - overlap(b, a);
  const bFirst = overlap(a, a) - overlap(a, b);
  return aFirst / (aFirst + bFirst);
}

export function createPenney({ length = 3 } = {}) {
  const g = {
    length,
    picks: [null, null],
    flips: "",
    done: false,
    winner: null,
    pick(side, seq) {
      if (g.flips.length) throw new Error("이미 던지기 시작했다");
      if (!isSequence(seq, length)) throw new Error("앞뒤 순서가 아니다");
      if (g.picks[1 - side] === seq) throw new Error("상대와 같은 순서는 고를 수 없다");
      g.picks[side] = seq;
    },
    ready() {
      return g.picks[0] !== null && g.picks[1] !== null;
    },
    /** 동전 하나를 더한다(H 또는 T). 끝나면 winner 가 정해진다 */
    flip(coin) {
      if (g.done) throw new Error("이미 끝났다");
      if (!g.ready()) throw new Error("둘 다 고르지 않았다");
      if (coin !== "H" && coin !== "T") throw new Error("동전은 H 나 T");
      g.flips += coin;
      for (const side of [0, 1]) {
        if (g.flips.endsWith(g.picks[side])) {
          g.done = true;
          g.winner = side;
        }
      }
      return coin;
    },
    /** 끝날 때까지 던진다 */
    run(rng, max = 10000) {
      while (!g.done && g.flips.length < max) g.flip(rng.chance(0.5) ? "H" : "T");
      return g.flips;
    },
  };
  return g;
}

/** 컴퓨터가 고르는 순서. 상대가 먼저 골랐으면 가장 좋은 순서, 아니면 아무거나 */
export function penneyPick(rng, other = null, length = 3) {
  if (other) return bestReply(other);
  return rng.pick(allSequences(length));
}
