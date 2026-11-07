// 온라인 랭킹 점수(Elo). 순수 모듈이라 서버(server/src)가 import 해서 경기 결과로 점수를 고친다.
// 기본안(2026-11-08): 게임 id 마다 따로 매기고, 랜덤 매칭에서 사람끼리 끝난 경기(삼세판이면 한 경기)만 센다.

/** 처음 점수 */
export const RATING_START = 1000;
/** 이 아래로는 안 내려간다 */
export const RATING_FLOOR = 100;
/** 처음 이만큼은 점수가 크게 움직인다 */
export const PROVISIONAL_GAMES = 10;
/** 순위표에 오르려면 이만큼 경기를 해야 한다 */
export const BOARD_MIN_GAMES = 5;

/** a 가 b 를 이길 기대값(0..1, 비김은 반으로 친다) */
export function expectedScore(ra, rb) {
  return 1 / (1 + 10 ** ((rb - ra) / 400));
}

/** 지금까지 한 경기 수에 따른 K(한 경기에 움직일 수 있는 가장 큰 점수) */
export function kFactor(games) {
  return games < PROVISIONAL_GAMES ? 40 : 20;
}

/** 처음 온 사람의 기록 */
export function newRecord() {
  return { rating: RATING_START, games: 0, wins: 0, losses: 0, draws: 0 };
}

/**
 * 한 경기 결과로 두 사람 기록을 고친다. 받은 객체는 바꾸지 않는다.
 * score 는 a 쪽에서 본 결과: 1 이김, 0.5 비김, 0 짐. 도중에 나간 사람은 진 것으로 넣는다.
 * 돌려주는 값 { a, b } 는 새 기록이고, 각각 delta(이번에 바뀐 점수)가 붙는다. 점수는 정수.
 */
export function rateMatch(a, b, score) {
  if (score !== 0 && score !== 0.5 && score !== 1) throw new Error(`결과는 0, 0.5, 1 가운데 하나: ${score}`);
  for (const r of [a, b]) {
    if (!Number.isFinite(r?.rating) || !Number.isInteger(r?.games) || r.games < 0) throw new Error("기록 꼴이 틀림");
  }
  const ea = expectedScore(a.rating, b.rating);
  const da = Math.round(kFactor(a.games) * (score - ea));
  const db = Math.round(kFactor(b.games) * (1 - score - (1 - ea)));
  return { a: applyResult(a, da, score), b: applyResult(b, db, 1 - score) };
}

function applyResult(rec, delta, score) {
  const rating = Math.max(RATING_FLOOR, Math.round(rec.rating) + delta);
  return {
    ...rec,
    rating,
    delta: rating - Math.round(rec.rating),
    games: rec.games + 1,
    wins: (rec.wins ?? 0) + (score === 1 ? 1 : 0),
    losses: (rec.losses ?? 0) + (score === 0 ? 1 : 0),
    draws: (rec.draws ?? 0) + (score === 0.5 ? 1 : 0),
  };
}

/** 순위표에 오르는가 */
export function onBoard(rec) {
  return rec.games >= BOARD_MIN_GAMES;
}

/** 순위표 차례: 점수 높은 순, 같으면 경기 많은 순 */
export function compareStanding(x, y) {
  return y.rating - x.rating || y.games - x.games;
}
