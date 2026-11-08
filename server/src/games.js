// 온라인에서 할 수 있는 게임과 그 판정 자료(V). 도감과 엔진(web/js)을 그대로 import 해서 혼자 할 때와 같은 판정을 쓴다.
// 서버에서는 화면 언어가 늘 한국어다(i18n.js 가 document 없으면 ko). 서버는 이름과 문장을 쓰지 않고 손 id 만 쓴다.

import { compileVariant } from "../../web/js/core/engine.js";
import { CATALOG, findEntry } from "../../web/js/data/catalog.js";
import { groupBases, isOneHand, isOnlineGame, seatRange } from "../../web/js/data/online.js";
import { makeCustomDef, maxWins, CUSTOM_MIN, CUSTOM_MAX } from "../../web/js/data/custom.js";
import { BOTS } from "../../web/js/core/bots.js";
import { Fail } from "./http.js";
import { FORMATS, GROUP_MODES, GROUP_SEATS, ROOM_DEFAULTS, TIMERS } from "./protocol.js";

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

/** 손 하나 내고 바로 판정하는 변종(도감 kind matrix)의 id. 목록의 기준은 web/js/data/online.js(컨셉) */
export function matrixIds() {
  return CATALOG.filter(isOneHand).map((e) => e.id);
}

/** 여럿이 가위바위보의 바탕이 될 수 있는 변종(목록은 data/online.js 의 groupBases) */
export function groupBaseIds() {
  return groupBases();
}

/**
 * 여럿이 할 때 자리 수 범위 { min, max }. 게임마다 컨셉이 정한 값(data/online.js 의 seatRange, 손 셋은 3–8, 손이 많으면 3–50)이고
 * 바탕이 될 수 없는 id 면 GROUP_SEATS
 */
export function groupSeatRange(base) {
  const r = seatRange(base);
  return r && Number.isInteger(r.min) && Number.isInteger(r.max) ? { min: r.min, max: r.max } : { min: GROUP_SEATS.min, max: GROUP_SEATS.max };
}

/**
 * 방 규칙이 받는 여럿이 인원: groupSeatRange 에 더해 지금 화면이 고르게 하는 GROUP_SEATS.max(10)까지는 받는다.
 * 11-08 컨셉이 손 셋 바탕을 8명까지로 정했는데, 화면이 seatRange 로 바꾸기 전에 9·10명 방이 오류가 나지 않게(그 뒤 줄인다)
 */
export function roomSeatRange(base) {
  const r = groupSeatRange(base);
  return { min: r.min, max: Math.max(r.max, GROUP_SEATS.max) };
}

/** kind(challenge·room·random)에서 고를 수 있는 게임인지. 아니면 bad_game */
export function checkOnlineGame(kind, game) {
  if (!isOnlineGame(kind, game)) throw new Fail("bad_game");
  return game;
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

/**
 * 방 규칙 정리. 빠진 값은 기본값, 틀린 값은 bad_game(게임) 또는 bad_rules(나머지).
 * 돌려주는 값: { game, custom, base, mode, format, seats, bot, timer }
 *  - 손 하나짜리 변종·직접 만들기: 둘이서(seats 2), base·mode 는 null
 *  - group(여럿이 가위바위보): base 는 groupBases(), mode survive·loser, seats 는 roomSeatRange(base), format 은 single
 */
export function normRules(input) {
  const r = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const game = r.game === undefined ? ROOM_DEFAULTS.game : r.game;
  const bot = r.bot === undefined ? ROOM_DEFAULTS.bot : r.bot;
  const timer = r.timer === undefined ? ROOM_DEFAULTS.timer : r.timer;
  if (!BOTS.some((b) => b.id === bot)) throw new Fail("bad_rules");
  if (!TIMERS.includes(timer)) throw new Fail("bad_rules");
  checkOnlineGame("room", game);
  if (game === "group") {
    const base = r.base === undefined ? "classic" : r.base;
    if (!groupBaseIds().includes(base)) throw new Fail("bad_game");
    const mode = r.mode === undefined ? GROUP_MODES[0] : r.mode;
    if (!GROUP_MODES.includes(mode)) throw new Fail("bad_rules");
    const seats = r.seats === undefined ? GROUP_SEATS.default : r.seats;
    const range = roomSeatRange(base);
    if (!Number.isInteger(seats) || seats < range.min || seats > range.max) throw new Fail("bad_rules");
    return { game, custom: null, base, mode, format: "single", seats, bot, timer };
  }
  const { game: id, custom } = resolveVariant(game, r.custom);
  const format = r.format === undefined ? ROOM_DEFAULTS.format : r.format;
  if (!FORMATS.includes(format)) throw new Fail("bad_rules");
  if (r.seats !== undefined && r.seats !== 2) throw new Fail("bad_rules");
  return { game: id, custom, base: null, mode: null, format, seats: 2, bot, timer };
}

/** 정리된 방 규칙의 판정 자료(group 이면 바탕 변종) */
export function rulesVariant(rules) {
  return rules.game === "group" ? resolveVariant(rules.base).V : resolveVariant(rules.game, rules.custom).V;
}
