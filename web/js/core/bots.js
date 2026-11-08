// 컴퓨터 상대. 어떤 손 개수의 변종에도 쓸 수 있게 만들었다.
// pick(ctx) 의 ctx: { history: [{ me, op }], allowed?: boolean[] }  — me 가 봇 자신의 손, op 가 상대 손

import { t } from "../i18n.js";

const BOT_TEXT = [
  { id: "random", name: "주사위", desc: "아무 손이나 같은 확률로 낸다." },
  { id: "nash", name: "계산기", desc: "최적 비율대로 낸다. 길게 보면 누구에게도 지지 않는다." },
  { id: "human", name: "사람 흉내", desc: "이기면 같은 손을 또 내고, 지면 방금 자기를 이긴 손을 이기는 손으로 바꾼다." },
  { id: "freq", name: "버릇 읽기", desc: "상대가 요즘 자주 내는 손을 노린다." },
  { id: "pattern", name: "수 읽기", desc: "상대가 내 온 순서를 외워 다음 손을 짐작한다." },
  { id: "cycle", name: "돌림", desc: "고리 차례대로 돌아가며 낸다." },
  { id: "stubborn", name: "고집", desc: "한 손만 계속 낸다." },
  { id: "mirror", name: "따라쟁이", desc: "상대가 방금 낸 손을 따라 낸다." },
  { id: "avenger", name: "앙갚음", desc: "상대가 방금 낸 손을 이기는 손을 낸다." },
];

/** 이름과 설명은 지금 언어로 읽힌다 */
export const BOTS = BOT_TEXT.map((b) => ({
  id: b.id,
  get name() {
    return t(b.name);
  },
  get desc() {
    return t(b.desc);
  },
}));

export function botInfo(id) {
  return BOTS.find((b) => b.id === id) || BOTS[0];
}

function allowedList(V, allowed) {
  const list = [];
  for (let i = 0; i < V.n; i++) if (!allowed || allowed[i]) list.push(i);
  return list.length ? list : V.hands.map((h) => h.i);
}

/** 손 h 를 이기는 손 가운데 하나(쓸 수 있는 것만). 없으면 아무거나 */
export function beaterOf(V, h, allowed, rng) {
  const opts = allowedList(V, allowed).filter((x) => V.win[x][h]);
  if (opts.length) return rng.pick(opts);
  return rng.pick(allowedList(V, allowed));
}

export function createBot(id, V, rng) {
  const info = botInfo(id);
  const stubbornHand = rng.int(V.n);
  let cycleStart = rng.int(V.n);
  // 수 읽기: 상대의 '앞 손 → 다음 손', '앞앞 손·앞 손 → 다음 손'을 한 판씩 쌓아 센다
  let seen = 0;
  let t1 = new Map();
  let t2 = new Map();
  const bump = (m, key, next) => {
    let c = m.get(key);
    if (!c) m.set(key, (c = new Array(V.n).fill(0)));
    c[next] += 1;
  };
  const learn = (h) => {
    if (h.length < seen) {
      seen = 0;
      t1 = new Map();
      t2 = new Map();
    }
    for (let t = Math.max(seen, 1); t < h.length; t++) {
      bump(t1, h[t - 1].op, h[t].op);
      if (t >= 2) bump(t2, h[t - 2].op * V.n + h[t - 1].op, h[t].op);
    }
    seen = h.length;
  };

  const pickers = {
    random(ctx) {
      return rng.pick(allowedList(V, ctx.allowed));
    },
    nash(ctx) {
      const mix = V.equilibrium.mix.map((p, i) => (!ctx.allowed || ctx.allowed[i] ? p : 0));
      return rng.weighted(mix);
    },
    human(ctx) {
      const h = ctx.history;
      if (!h.length) return pickers.random(ctx);
      const last = h[h.length - 1];
      const res = V.cmp(last.me, last.op);
      const ok = (x) => !ctx.allowed || ctx.allowed[x];
      if (res > 0 && ok(last.me) && rng.chance(0.5)) return last.me;
      if (res < 0 && rng.chance(0.5)) return beaterOf(V, last.op, ctx.allowed, rng);
      return pickers.random(ctx);
    },
    freq(ctx) {
      const h = ctx.history;
      if (h.length < 2) return pickers.random(ctx);
      const score = new Array(V.n).fill(0);
      let w = 1;
      for (let t = h.length - 1; t >= 0 && t >= h.length - 30; t--) {
        score[h[t].op] += w;
        w *= 0.9;
      }
      const guess = argmaxRandom(score, rng);
      return rng.chance(0.85) ? beaterOf(V, guess, ctx.allowed, rng) : pickers.random(ctx);
    },
    pattern(ctx) {
      const h = ctx.history;
      learn(h);
      if (h.length < 3) return pickers.freq(ctx);
      const a = h[h.length - 2].op;
      const b = h[h.length - 1].op;
      const c = t2.get(a * V.n + b) || t1.get(b);
      if (!c) return pickers.freq(ctx);
      const guess = argmaxRandom(c, rng);
      return rng.chance(0.9) ? beaterOf(V, guess, ctx.allowed, rng) : pickers.random(ctx);
    },
    cycle(ctx) {
      const turn = ctx.history.length;
      for (let d = 0; d < V.n; d++) {
        const x = V.order[(cycleStart + turn + d) % V.n];
        if (!ctx.allowed || ctx.allowed[x]) return x;
      }
      return pickers.random(ctx);
    },
    stubborn(ctx) {
      for (let d = 0; d < V.n; d++) {
        const x = (stubbornHand + d) % V.n;
        if (!ctx.allowed || ctx.allowed[x]) return x;
      }
      return pickers.random(ctx);
    },
    mirror(ctx) {
      const h = ctx.history;
      if (!h.length) return pickers.random(ctx);
      const x = h[h.length - 1].op;
      return !ctx.allowed || ctx.allowed[x] ? x : pickers.random(ctx);
    },
    avenger(ctx) {
      const h = ctx.history;
      if (!h.length) return pickers.random(ctx);
      return beaterOf(V, h[h.length - 1].op, ctx.allowed, rng);
    },
  };

  const pick = pickers[info.id] || pickers.random;
  return {
    id: info.id,
    name: info.name,
    desc: info.desc,
    pick(ctx) {
      return pick({ history: ctx.history || [], allowed: ctx.allowed });
    },
    reset() {
      cycleStart = rng.int(V.n);
      seen = 0;
      t1 = new Map();
      t2 = new Map();
    },
  };
}

function argmaxRandom(arr, rng) {
  let best = -Infinity;
  let idx = [];
  arr.forEach((v, i) => {
    if (v > best + 1e-12) {
      best = v;
      idx = [i];
    } else if (Math.abs(v - best) <= 1e-12) idx.push(i);
  });
  return rng.pick(idx);
}

