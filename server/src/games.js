// 온라인에서 할 수 있는 게임과 그 판정 자료(V). 도감과 엔진(web/js)을 그대로 import 해서 혼자 할 때와 같은 판정을 쓴다.
// 서버에서는 화면 언어가 늘 한국어다(i18n.js 가 document 없으면 ko). 서버는 이름과 문장을 쓰지 않고 손 id 만 쓴다.

import { compileVariant } from "../../web/js/core/engine.js";
import { CATALOG, findEntry } from "../../web/js/data/catalog.js";
import { makeCustomDef, maxWins, CUSTOM_MIN, CUSTOM_MAX } from "../../web/js/data/custom.js";
import { Fail } from "./http.js";

const MAX_SEED = 0xffffffff;
// 도감 변종은 다 들고 있고(19가지), 직접 만들기는 최근 것만 든다
const variants = new Map();
const customs = new Map();
const CUSTOM_CACHE = 32;

function cached(cache, key, make, max = Infinity) {
  let V = cache.get(key);
  if (V) return V;
  V = make();
  if (cache.size >= max) cache.delete(cache.keys().next().value);
  cache.set(key, V);
  return V;
}

/**
 * 도감 변종을 미리 컴파일한다. Worker 의 전역에서 부른다(시작할 때 1초 한도 안에서 돌고,
 * 요청마다의 CPU 10ms 에는 안 든다). RPS-101 은 처음 컴파일에 몇 ms 가 들어서 요청 안에서 하면 빠듯하다
 */
export function warmUp() {
  for (const id of matrixIds()) resolveVariant(id);
}

/** 손 하나 내고 바로 판정하는 변종(도감 kind matrix)의 id */
export function matrixIds() {
  return CATALOG.filter((e) => e.kind === "matrix").map((e) => e.id);
}

/** 여럿이 가위바위보의 바탕이 될 수 있는 변종(손이 셋) */
export function groupBaseIds() {
  return CATALOG.filter((e) => e.kind === "matrix" && e.hands.length === 3).map((e) => e.id);
}

/** 직접 만들기 값 검사. 틀리면 bad_game */
export function normCustom(c) {
  if (!c || typeof c !== "object") throw new Fail("bad_game");
  const { n, k, seed } = c;
  if (!Number.isInteger(n) || n < CUSTOM_MIN || n > CUSTOM_MAX) throw new Fail("bad_game");
  if (!Number.isInteger(k) || k < 1 || k > maxWins(n)) throw new Fail("bad_game");
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) throw new Fail("bad_game");
  return { n, k, seed };
}

/**
 * 손 하나짜리 변종을 고른다. game 은 도감 matrix id 나 "custom"(custom: {n, k, seed}).
 * 돌려주는 값: { game, custom, V } — custom 은 직접 만들기가 아니면 null
 */
export function resolveVariant(game, custom) {
  if (game === "custom") {
    const c = normCustom(custom);
    const V = cached(customs, `${c.n}:${c.k}:${c.seed}`, () => compileVariant(makeCustomDef(c)), CUSTOM_CACHE);
    return { game: "custom", custom: c, V };
  }
  const e = typeof game === "string" ? findEntry(game) : null;
  if (!e || e.kind !== "matrix") throw new Fail("bad_game");
  return { game: e.id, custom: null, V: cached(variants, e.id, () => compileVariant(e)) };
}

/** 손 id → 번호. 없는 손이면 bad_hand */
export function handIndex(V, id) {
  const i = typeof id === "string" ? V.index[id] : undefined;
  if (i === undefined) throw new Fail("bad_hand");
  return i;
}
