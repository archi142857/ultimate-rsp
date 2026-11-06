// 판정 엔진: 변종 정의를 받아 '누가 누구를 이기는지' 표로 만들고, 결과 문장과 최적 섞기를 낸다.

import { josa } from "./josa.js";
import { solveGame, bestReplyValue } from "./lp.js";

/**
 * 변종 정의(def)를 쓰기 좋은 꼴로 바꾼다.
 * def.hands: [{ id, name, emoji, how? }]  — 버튼에 놓는 차례
 * def.order: [id] — 고리 그림에 놓는 차례(없으면 hands 차례). cycle 규칙도 이 차례를 따른다
 * def.rel:   [[이기는 id, 지는 id, 동사?], ...]  또는
 * def.cycle: k — order 에서 저마다 다음 k 개를 이긴다
 * def.verbs: { "a>b": 동사 } — cycle 일 때 쓸 동사(없으면 '이긴다')
 * def.weights: { id: 점수 } — 이겼을 때 얻는 점수(글리코처럼). 없으면 1
 */
export function compileVariant(def) {
  const hands = def.hands.map((h, i) => ({ ...h, i }));
  const n = hands.length;
  const index = Object.create(null);
  hands.forEach((h) => {
    if (index[h.id] !== undefined) throw new Error(`${def.id}: 손 id 가 겹친다: ${h.id}`);
    index[h.id] = h.i;
  });
  const order = (def.order || hands.map((h) => h.id)).map((id) => {
    if (index[id] === undefined) throw new Error(`${def.id}: order 에 없는 손: ${id}`);
    return index[id];
  });
  if (new Set(order).size !== n) throw new Error(`${def.id}: order 가 손을 모두 한 번씩 담지 않는다`);

  const win = Array.from({ length: n }, () => new Array(n).fill(0));
  const verbs = Array.from({ length: n }, () => new Array(n).fill(null));
  const phrases = Array.from({ length: n }, () => new Array(n).fill(null));
  const setWin = (a, b, verb, phrase) => {
    if (a === b) throw new Error(`${def.id}: 같은 손끼리 승부를 적었다`);
    if (win[b][a] || win[a][b]) throw new Error(`${def.id}: ${hands[a].id}·${hands[b].id} 승부를 두 번 적었다`);
    win[a][b] = 1;
    verbs[a][b] = verb || null;
    phrases[a][b] = phrase || null;
  };

  if (def.rel) {
    // [이기는 손, 지는 손, 동사?, 통문장?] — 통문장은 '가위가 다이너마이트 심지를 자른다'처럼 틀에 안 맞을 때
    for (const [wa, lb, verb, phrase] of def.rel) {
      const a = index[wa];
      const b = index[lb];
      if (a === undefined || b === undefined) throw new Error(`${def.id}: rel 에 없는 손: ${wa}, ${lb}`);
      setWin(a, b, verb, phrase);
    }
  } else if (def.cycle) {
    const k = def.cycle;
    if (k < 1 || 2 * k >= n) throw new Error(`${def.id}: cycle 값은 1 이상, 손 개수의 절반 미만이어야 한다`);
    for (let p = 0; p < n; p++) {
      for (let d = 1; d <= k; d++) {
        const a = order[p];
        const b = order[(p + d) % n];
        setWin(a, b, lookupVerb(def.verbs, hands[a], hands[b]));
      }
    }
  } else {
    throw new Error(`${def.id}: rel 이나 cycle 이 있어야 한다`);
  }

  const weight = hands.map((h) => (def.weights && def.weights[h.id]) || 1);

  const V = {
    ...def,
    hands,
    n,
    index,
    order,
    win,
    verbs,
    weight,
    /** a 가 이기면 1, 지면 -1, 비기면 0 */
    cmp(a, b) {
      return win[a][b] ? 1 : win[b][a] ? -1 : 0;
    },
    /** 이긴 쪽이 진 쪽을 어떻게 이기는지 한 문장 */
    sentence(a, b) {
      if (win[a][b]) return phrases[a][b] || say(hands[a], hands[b], verbs[a][b]);
      if (win[b][a]) return phrases[b][a] || say(hands[b], hands[a], verbs[b][a]);
      return a === b ? `둘 다 ${hands[a].name}` : `${josa(hands[a].name, "과와")} ${hands[b].name}, 승부가 없다`;
    },
    /** 손 a 가 이기는 손들, 지는 손들 */
    beats(a) {
      return hands.filter((h) => win[a][h.i]).map((h) => h.i);
    },
    beatenBy(a) {
      return hands.filter((h) => win[h.i][a]).map((h) => h.i);
    },
  };
  V.matrix = payoffMatrix(V);
  V.balanced = isBalanced(V);
  V.equilibrium = equilibrium(V);
  return V;
}

function say(w, l, verb) {
  return `${josa(w.name, "이가")} ${josa(l.name, "을를")} ${verb || "이긴다"}`;
}

function lookupVerb(dict, a, b) {
  if (!dict) return null;
  const ka = a.verbKey || a.id;
  const kb = b.verbKey || b.id;
  return dict[`${ka}>${kb}`] || null;
}

/** 행 선수 기준 이득표. weights 가 있으면 이긴 손의 점수만큼 얻고 진 쪽은 그만큼 잃는다 */
export function payoffMatrix(V) {
  const { n, win, weight } = V;
  const P = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (win[a][b]) P[a][b] = weight[a];
      else if (win[b][a]) P[a][b] = -weight[b];
    }
  }
  return P;
}

/** 손마다 이기는 수와 지는 수가 같고 점수도 같으면 '고른' 판 */
function isBalanced(V) {
  const { n, win, weight } = V;
  if (weight.some((w) => w !== weight[0])) return false;
  for (let a = 0; a < n; a++) {
    let w = 0;
    let l = 0;
    for (let b = 0; b < n; b++) {
      w += win[a][b];
      l += win[b][a];
    }
    if (w !== l) return false;
  }
  return true;
}

/**
 * 최적 섞기. 똑같이 섞어도 지지 않으면 그것을 쓰고(보기에 가장 자연스럽다),
 * 아니면 선형 계획법으로 푼다.
 */
export function equilibrium(V) {
  const P = V.matrix;
  const n = V.n;
  const uniform = new Array(n).fill(1 / n);
  if (bestReplyValue(P, uniform) <= 1e-9) return { mix: uniform, value: 0, uniform: true };
  const { row, value } = solveGame(P);
  return { mix: row, value, uniform: false };
}

/** 여럿이 동시에 낸 손(3가지 손 변종)에서 이긴 손을 찾는다. 승부가 안 나면 null */
export function groupWinner(V, throws) {
  const kinds = [...new Set(throws)];
  if (kinds.length !== 2) return null;
  const [a, b] = kinds;
  const c = V.cmp(a, b);
  if (c === 0) return null;
  return c > 0 ? a : b;
}

/** n 명이 모두 아무렇게나 낼 때(손 3개) 한 번에 승부가 날 확률 */
export function groupDecisiveChance(players) {
  if (players < 2) return 1;
  // 정확히 두 가지 손만 나오는 경우: 3가지 가운데 2가지를 고르고, 그 둘로 모두를 채우되 한 가지만 나오는 경우를 뺀다
  return (3 * (Math.pow(2, players) - 2)) / Math.pow(3, players);
}
