// 온라인 랭킹 점수(web/js/core/rating.js)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RATING_START, RATING_FLOOR, BOARD_MIN_GAMES, NEWCOMER_WEIGHT,
  expectedScore, kFactor, opponentWeight, newRecord, rateMatch, onBoard, compareStanding,
} from "../web/js/core/rating.js";

const rec = (rating, games) => ({ ...newRecord(), rating, games });

test("기대값", () => {
  assert.equal(expectedScore(1000, 1000), 0.5);
  assert.ok(Math.abs(expectedScore(1400, 1000) - 10 / 11) < 1e-12);
  for (const [a, b] of [[1000, 1200], [850, 1730], [1500, 1499]]) {
    assert.ok(Math.abs(expectedScore(a, b) + expectedScore(b, a) - 1) < 1e-12);
  }
});

test("처음 10경기는 K 40, 그 뒤 20", () => {
  assert.equal(kFactor(0), 40);
  assert.equal(kFactor(9), 40);
  assert.equal(kFactor(10), 20);
  assert.deepEqual(newRecord(), { rating: RATING_START, games: 0, wins: 0, losses: 0, draws: 0 });
});

test("같은 점수끼리", () => {
  // 처음 온 두 사람끼리: 40 × 0.5(상대가 처음 온 사람) × 0.5
  const r = rateMatch(newRecord(), newRecord(), 1);
  assert.equal(r.a.rating, 1010);
  assert.equal(r.a.delta, 10);
  assert.equal(r.b.rating, 990);
  assert.equal(r.b.delta, -10);
  assert.deepEqual([r.a.games, r.a.wins, r.a.losses, r.b.losses], [1, 1, 0, 1]);

  const v = rateMatch(rec(1000, 30), rec(1000, 30), 0.5);
  assert.deepEqual([v.a.delta, v.b.delta, v.a.draws, v.b.draws], [0, 0, 1, 1]);

  const w = rateMatch(rec(1000, 30), rec(1000, 30), 0);
  assert.deepEqual([w.a.delta, w.b.delta], [-10, 10]);
});

test("뒤집기: 새로 온 1000 이 오래 한 1400 을 이기면", () => {
  const r = rateMatch(rec(1000, 2), rec(1400, 50), 1);
  assert.equal(r.a.delta, 36); // 40 × (1 − 1/11)
  assert.equal(r.b.delta, -9); // 20 × 0.5(상대가 2경기째) × (0 − 10/11)
});

test("처음 온 상대에게는 점수가 반만 움직인다(새 pid 로 져 주기 막기)", () => {
  assert.equal(NEWCOMER_WEIGHT, 0.5);
  assert.equal(opponentWeight(0), 0.5);
  assert.equal(opponentWeight(BOARD_MIN_GAMES - 1), 0.5);
  assert.equal(opponentWeight(BOARD_MIN_GAMES), 1);
  // 오래 한 사람이 처음 온 사람을 이기면 20 × 0.5 × 0.5 = 5, 다섯 경기 한 사람을 이기면 10
  assert.equal(rateMatch(rec(1000, 30), rec(1000, 0), 1).a.delta, 5);
  assert.equal(rateMatch(rec(1000, 30), rec(1000, BOARD_MIN_GAMES), 1).a.delta, 10);
  // 매번 새 pid 에게 이겨서 올리기: 예전에는 8번이면 1100 을 넘었지만 이제는 반쯤
  let me = newRecord();
  for (let i = 0; i < 8; i++) me = rateMatch(me, newRecord(), 1).a;
  assert.ok(me.rating < 1080, `8번 이긴 뒤 ${me.rating}`);
});

test("바닥 아래로는 안 내려가고, 받은 기록은 그대로 둔다", () => {
  const low = rec(RATING_FLOOR, 40);
  const high = rec(1600, 40);
  const r = rateMatch(low, high, 0);
  assert.equal(r.a.rating, RATING_FLOOR);
  assert.equal(r.a.delta, 0);
  assert.deepEqual(low, rec(RATING_FLOOR, 40));
  assert.deepEqual(high, rec(1600, 40));
});

test("틀린 결과·기록은 던진다", () => {
  assert.throws(() => rateMatch(newRecord(), newRecord(), 2));
  assert.throws(() => rateMatch(newRecord(), newRecord(), "1"));
  assert.throws(() => rateMatch({ rating: 1000 }, newRecord(), 1));
  assert.throws(() => rateMatch(newRecord(), { rating: NaN, games: 0 }, 0));
});

test("순위표", () => {
  assert.ok(!onBoard(rec(1500, BOARD_MIN_GAMES - 1)));
  assert.ok(onBoard(rec(900, BOARD_MIN_GAMES)));
  const list = [rec(1000, 5), rec(1200, 7), rec(1200, 30), rec(980, 50)];
  assert.deepEqual(list.sort(compareStanding).map((r) => [r.rating, r.games]), [[1200, 30], [1200, 7], [1000, 5], [980, 50]]);
});

test("점수 합은 거의 그대로(같은 K 일 때)", () => {
  let a = rec(1000, 20);
  let b = rec(1000, 20);
  const results = [1, 1, 0, 0.5, 1, 0, 0, 1, 1, 0.5];
  for (const s of results) ({ a, b } = rateMatch(a, b, s));
  assert.ok(Math.abs(a.rating + b.rating - 2000) <= results.length);
  assert.equal(a.games, 30);
});
