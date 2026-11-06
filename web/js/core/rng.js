// 씨앗(seed)을 받는 난수. 같은 씨앗이면 같은 수열이 나와서 시험과 시뮬레이션을 되풀이할 수 있다.
// mulberry32 (32비트 상태, 빠르고 고르게 퍼진다)

export function makeRng(seed = randomSeed()) {
  let s = seed >>> 0;
  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rng = {
    seed: seed >>> 0,
    next,
    /** 0 이상 n 미만의 정수 */
    int(n) {
      return Math.floor(next() * n);
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    chance(p) {
      return next() < p;
    },
    /** 확률 배열(합이 1이 아니어도 된다)에서 하나를 고른다. 0인 칸은 고르지 않는다 */
    weighted(ps) {
      let total = 0;
      for (const p of ps) total += p > 0 ? p : 0;
      if (!(total > 0)) return Math.floor(next() * ps.length);
      let r = next() * total;
      let last = -1;
      for (let i = 0; i < ps.length; i++) {
        if (!(ps[i] > 0)) continue;
        last = i;
        r -= ps[i];
        if (r < 0) return i;
      }
      return last;
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
  return rng;
}

export function randomSeed() {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0];
  } catch {
    return (Math.random() * 4294967296) >>> 0;
  }
}
