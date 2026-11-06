// 여럿이 하는 놀이: 여럿이 가위바위보, 가위바위보 기차, 진화 가위바위보.

import { groupWinner } from "../core/engine.js";

/**
 * 여럿이 가위바위보. 0번이 나.
 * mode "survive": 이긴 손을 낸 사람만 남는다(마지막 한 명이 이긴다)
 * mode "loser":   진 손을 낸 사람만 남는다(마지막 한 명이 술래)
 */
export function createGroup(V, { players = 5, mode = "survive" } = {}) {
  const g = {
    mode,
    players,
    alive: Array.from({ length: players }, (_, i) => i),
    rounds: [],
    done: false,
    last: null,
    /** throwsByPlayer: { 사람 번호: 손 } (남은 사람 모두) */
    play(throwsByPlayer) {
      if (g.done) throw new Error("이미 끝났다");
      const hands = g.alive.map((p) => throwsByPlayer[p]);
      const w = groupWinner(V, hands);
      const r = { alive: g.alive.slice(), throws: { ...throwsByPlayer }, winnerHand: w, out: [] };
      if (w !== null) {
        const keep = g.alive.filter((p) => (mode === "survive" ? throwsByPlayer[p] === w : throwsByPlayer[p] !== w));
        r.out = g.alive.filter((p) => !keep.includes(p));
        g.alive = keep;
      }
      g.rounds.push(r);
      if (g.alive.length === 1) {
        g.done = true;
        g.last = g.alive[0];
      }
      return r;
    },
  };
  return g;
}

/** 한 판 승부(비기면 다시)를 아무렇게나 내서 끝낸다. 던진 횟수도 센다 */
export function duel(V, rng) {
  let throws = 0;
  for (;;) {
    const a = rng.int(V.n);
    const b = rng.int(V.n);
    throws += 1;
    const c = V.cmp(a, b);
    if (c !== 0) return { winner: c > 0 ? 0 : 1, throws, a, b };
    if (throws > 1000) return { winner: rng.int(2), throws, a, b };
  }
}

/**
 * 가위바위보 기차. trains: 기차마다 사람 번호 배열(맨 앞이 [0]).
 * 한 차례: 맨 앞끼리 짝을 지어 겨루고, 진 쪽 기차가 이긴 쪽 뒤에 붙는다. 짝이 없는 기차는 쉰다.
 */
export function createTrain(V, rng, people = 16) {
  const s = {
    trains: Array.from({ length: people }, (_, i) => [i]),
    turn: 0,
    throws: 0,
    done: people <= 1,
    log: [],
    step() {
      if (s.done) return null;
      const order = rng.shuffle(s.trains.map((_, i) => i));
      const next = [];
      const events = [];
      for (let k = 0; k + 1 < order.length; k += 2) {
        const A = s.trains[order[k]];
        const B = s.trains[order[k + 1]];
        const d = duel(V, rng);
        s.throws += d.throws;
        const [win, lose] = d.winner === 0 ? [A, B] : [B, A];
        events.push({ head: win[0], beat: lose[0], a: d.winner === 0 ? d.a : d.b, b: d.winner === 0 ? d.b : d.a, throws: d.throws });
        next.push(win.concat(lose));
      }
      if (order.length % 2 === 1) next.push(s.trains[order[order.length - 1]]);
      s.trains = next;
      s.turn += 1;
      s.log.push(events);
      if (s.trains.length === 1) s.done = true;
      return events;
    },
  };
  return s;
}

export const EVO_STAGES = [
  { id: "egg", name: "알", emoji: "🥚" },
  { id: "chick", name: "병아리", emoji: "🐣" },
  { id: "hen", name: "닭", emoji: "🐔" },
  { id: "dino", name: "공룡", emoji: "🦖" },
  { id: "king", name: "왕", emoji: "👑" },
];

/** 진화 가위바위보. 같은 단계끼리 짝을 지어 겨룬다. 꼭대기(왕)는 빠진다 */
export function createEvolution(V, rng, people = 30) {
  const top = EVO_STAGES.length - 1;
  const s = {
    level: new Array(people).fill(0),
    turn: 0,
    throws: 0,
    done: false,
    history: [],
    counts() {
      const c = new Array(EVO_STAGES.length).fill(0);
      s.level.forEach((l) => (c[l] += 1));
      return c;
    },
    step() {
      if (s.done) return null;
      const events = [];
      for (let lv = 0; lv < top; lv++) {
        const here = rng.shuffle(s.level.map((l, i) => (l === lv ? i : -1)).filter((i) => i >= 0));
        for (let k = 0; k + 1 < here.length; k += 2) {
          const d = duel(V, rng);
          s.throws += d.throws;
          const [w, l] = d.winner === 0 ? [here[k], here[k + 1]] : [here[k + 1], here[k]];
          events.push({ w, l, from: lv });
        }
      }
      // 한꺼번에 반영(같은 차례에 두 번 겨루지 않게)
      for (const e of events) {
        s.level[e.w] = Math.min(top, e.from + 1);
        s.level[e.l] = Math.max(0, e.from - 1);
      }
      s.turn += 1;
      const c = s.counts();
      s.history.push(c);
      if (events.length === 0 || c.slice(0, top).every((x) => x <= 1)) s.done = true;
      return events;
    },
  };
  s.history.push(s.counts());
  return s;
}
