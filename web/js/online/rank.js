// 순위(디자인 시안2 ①, 온라인 규약 4.1): 게임마다 상위 50 과 내 기록. 점수 계산은 컨셉의 core/rating.js(Elo)를 서버가 쓴다.
//   POST /api/rank {v, game, pid}(text/plain) → {game, n, top: [{name, rating, games, wins, losses, draws}], me: {…, rank} | null, now}
//   n 은 순위표에 오른 사람 수(5경기 이상). me.rank 는 5경기 전이면 null, 점수·경기 수가 같으면 같은 순위. 기록이 없으면 me 가 null.
//   me.index 는 top 안 내 줄 번호(0부터, 밖이면 null. 0d87250).
// pid 는 주소에 싣지 않으려고 POST 로 보낸다. 무료 한도를 아끼려고 같은 게임은 1분 동안 다시 묻지 않는다(폴링하지 않는다).
// 랭킹 경기가 끝나 점수가 바뀌면(방 ev rated) forgetRank 로 그 게임을 잊는다.

import { api } from "./net.js";
import { PROTOCOL } from "./config.js";
import { BOARD_MIN_GAMES } from "../core/rating.js";
import { cleanName } from "./identity.js";

/** 순위표에 보이는 줄 수(서버 RANK_TOP 과 같다) */
export const RANK_TOP = 50;
const MAX_AGE = 60000;

const count = (x) => (Number.isInteger(x) && x >= 0 ? x : null);

/** 한 사람 기록 다듬기. 꼴이 틀리면 null. withRank 면 순위(rank, 없으면 null)도 */
function record(x, { withRank = false } = {}) {
  if (!x || typeof x !== "object") return null;
  const rating = Number.isFinite(x.rating) ? Math.round(x.rating) : null;
  const games = count(x.games);
  const wins = count(x.wins);
  if (rating === null || games === null || wins === null || wins > games) return null;
  const r = { name: cleanName(x.name), rating, games, wins, losses: count(x.losses) || 0, draws: count(x.draws) || 0 };
  if (withRank) {
    r.rank = Number.isInteger(x.rank) && x.rank > 0 ? x.rank : null;
    // 서버가 줄 번호를 안 주면(옛 서버) undefined 로 두고 이름·기록으로 찾는다
    if (x.index === null || Number.isInteger(x.index)) r.index = Number.isInteger(x.index) && x.index >= 0 ? x.index : null;
  }
  return r;
}

/** 서버 답을 화면 꼴로: { game, n, top, me }. 순위표 줄에는 보이는 순위(같은 점수·경기 수는 같은 순위)를 붙인다 */
export function normalizeRank(data, game) {
  const top = (Array.isArray(data && data.top) ? data.top : [])
    .map((x) => record(x))
    .filter((r) => r && r.name)
    .slice(0, RANK_TOP);
  top.forEach((r, k) => {
    const prev = top[k - 1];
    r.rank = prev && prev.rating === r.rating && prev.games === r.games ? prev.rank : k + 1;
  });
  return {
    game: typeof (data && data.game) === "string" ? data.game : game,
    n: count(data && data.n),
    top,
    me: record(data && data.me, { withRank: true }),
  };
}

/** 승률(0–100 정수). 비긴 경기는 이긴 것으로 치지 않는다 */
export function winRate(rec) {
  return rec && rec.games > 0 ? Math.round((100 * rec.wins) / rec.games) : 0;
}

/** 순위표에 오르기까지 남은 경기 수(한 번도 안 했으면 BOARD_MIN_GAMES) */
export function gamesLeft(rec) {
  return Math.max(0, BOARD_MIN_GAMES - (rec ? rec.games : 0));
}

/**
 * 상위 목록에서 내 줄(0부터), 없으면 -1. 서버가 주는 me.index 를 쓴다(이름·기록이 같은 두 사람도 가른다).
 * me.index 가 없는 옛 서버면 이름과 기록이 같은 줄을 찾는다(같은 순위가 여럿일 수 있어 순위 번호로는 못 찾는다).
 */
export function myIndex(board) {
  const me = board && board.me;
  if (!me || !me.rank) return -1;
  if (me.index !== undefined) return me.index !== null && me.index < board.top.length ? me.index : -1;
  return board.top.findIndex((r) => r.name === me.name && r.rating === me.rating && r.games === me.games && r.wins === me.wins);
}

const cache = new Map(); // game → { at, board }

/** 게임 하나의 순위표와 내 기록. 같은 게임은 1분 동안 다시 묻지 않는다 */
export async function fetchRank(game, { pid, signal, fresh = false } = {}) {
  const hit = cache.get(game);
  if (!fresh && hit && Date.now() - hit.at < MAX_AGE) return hit.board;
  const board = normalizeRank(await api("/api/rank", { body: { v: PROTOCOL, game, pid }, signal }), game);
  cache.set(game, { at: Date.now(), board });
  return board;
}

/** 이미 받아 둔 순위표(없으면 null). 게임 목록의 'N명' 에 쓴다 */
export function knownRank(game) {
  const hit = cache.get(game);
  return hit ? hit.board : null;
}

/** 점수가 바뀌었다(랭킹 경기 끝): 다음에 열 때 다시 묻는다 */
export function forgetRank(game) {
  cache.delete(game);
}
