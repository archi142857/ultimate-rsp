// 전략 리그: 봇마다 다른 봇 모두와 rounds 판씩 겨룬다.
// 결과 net[i][j] = (i 가 j 에게 이긴 판 − 진 판) / rounds  (−1 ~ 1)

import { createBot, botInfo } from "../core/bots.js";
import { makeRng } from "../core/rng.js";

/**
 * 두 봇이 rounds 판 겨룬다. noise 는 실수할 확률: 그 판에는 마음먹은 손 대신 아무 손이나 나간다(둘 다 실제로 나간 손을 기억한다).
 * 돌려주는 값 { w, l, d } 는 A 쪽에서 본 이긴 판·진 판·비긴 판 수
 */
export function playMatch(V, idA, idB, rounds, seed, { noise = 0 } = {}) {
  const rng = makeRng(seed);
  const A = createBot(idA, V, makeRng(rng.int(2 ** 31)));
  const B = createBot(idB, V, makeRng(rng.int(2 ** 31)));
  const slip = noise > 0 ? makeRng(rng.int(2 ** 31)) : null;
  const hA = [];
  const hB = [];
  let w = 0;
  let l = 0;
  for (let t = 0; t < rounds; t++) {
    let a = A.pick({ history: hA });
    let b = B.pick({ history: hB });
    if (slip) {
      if (slip.chance(noise)) a = slip.int(V.n);
      if (slip.chance(noise)) b = slip.int(V.n);
    }
    hA.push({ me: a, op: b });
    hB.push({ me: b, op: a });
    const c = V.cmp(a, b);
    if (c > 0) w += 1;
    else if (c < 0) l += 1;
  }
  return { w, l, d: rounds - w - l };
}

/** 한 짝씩 진행하는 발생기. 화면이 멈추지 않게 짝마다 진행 상황을 내놓는다 */
export function* leagueRunner(V, botIds, rounds = 1000, seed = 1) {
  const k = botIds.length;
  const net = Array.from({ length: k }, () => new Array(k).fill(0));
  const wdl = Array.from({ length: k }, () => Array.from({ length: k }, () => null));
  const pairs = [];
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) pairs.push([i, j]);
  const rng = makeRng(seed);
  let done = 0;
  for (const [i, j] of pairs) {
    const r = playMatch(V, botIds[i], botIds[j], rounds, rng.int(2 ** 31));
    net[i][j] = (r.w - r.l) / rounds;
    net[j][i] = -net[i][j];
    wdl[i][j] = r;
    wdl[j][i] = { w: r.l, l: r.w, d: r.d };
    done += 1;
    yield { done, total: pairs.length };
  }
  const table = botIds.map((id, i) => {
    let w = 0;
    let l = 0;
    let d = 0;
    let pts = 0;
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      const r = wdl[i][j];
      w += r.w;
      l += r.l;
      d += r.d;
      // 짝마다 승점: 이긴 판이 더 많으면 3, 같으면 1
      pts += r.w > r.l ? 3 : r.w === r.l ? 1 : 0;
    }
    const avg = k > 1 ? net[i].reduce((a, b) => a + b, 0) / (k - 1) : 0;
    return { id, name: botInfo(id).name, w, l, d, pts, avg };
  });
  return { botIds, net, wdl, table, rounds };
}

export function runLeague(V, botIds, rounds = 1000, seed = 1) {
  const it = leagueRunner(V, botIds, rounds, seed);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
