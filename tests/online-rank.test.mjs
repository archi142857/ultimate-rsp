// node --test 로 돈다. 온라인 순위(시안2 ①, 규약 4.1): 서버 답 다듬기, 같은 순위, 승률·남은 경기, 순위표 주소.

import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRank, winRate, gamesLeft, myIndex, RANK_TOP } from "../web/js/online/rank.js";
import { RANK_TOP as SERVER_RANK_TOP } from "../server/src/protocol.js";
import { parseOnline } from "../web/js/online/ids.js";
import { BOARD_MIN_GAMES } from "../web/js/core/rating.js";

const row = (k, extra = {}) => ({ name: `Brave Tiger ${k}`, rating: 1300 - k, games: 10 + k, wins: 5, losses: 4, draws: 1, ...extra });

test("순위 주소: #/rank, #/rank/게임, #/c/mine", () => {
  assert.deepEqual(parseOnline("/rank"), { kind: "rank", game: null });
  assert.deepEqual(parseOnline("/rank/"), { kind: "rank", game: null });
  assert.deepEqual(parseOnline("/rank/classic"), { kind: "rank", game: "classic" });
  assert.deepEqual(parseOnline("/rank/%E0%A4%A"), { kind: "rank", game: null }, "읽을 수 없는 이름은 없는 것으로");
  assert.deepEqual(parseOnline("/c/mine"), { kind: "my-challenges" });
  for (const p of ["/ranking", "/rank/a/b"]) assert.equal(parseOnline(p), null, p);
});

test("순위표 줄 수는 서버와 같다", () => {
  assert.equal(RANK_TOP, SERVER_RANK_TOP);
});

test("서버 답 다듬기: 틀린 줄은 버리고 50위까지, 이름은 다듬는다", () => {
  const top = Array.from({ length: 60 }, (_, k) => row(k));
  top[1] = { name: "", rating: 1200, games: 5, wins: 1 }; // 이름 없음
  top[2] = { name: "x", rating: "1200", games: 5, wins: 1 }; // 점수가 글자
  top[3] = { name: "y", rating: 1200, games: 5, wins: 9 }; // 이긴 게 경기보다 많음
  top[4] = { ...row(4), name: "  Quiet​   Wolf  " };
  const b = normalizeRank({ game: "classic", n: 412, top, me: { name: "Swift Fox 42", rating: 1032.4, games: 14, wins: 8, losses: 6, draws: 0, rank: 128 } }, "classic");
  assert.equal(b.top.length, RANK_TOP);
  assert.equal(b.top[0].name, "Brave Tiger 0");
  assert.equal(b.top[1].name, "Quiet Wolf", "보이지 않는 글자·겹친 빈칸을 뗀다");
  assert.deepEqual(
    b.top.slice(0, 3).map((r) => r.rank),
    [1, 2, 3],
  );
  assert.equal(b.n, 412);
  assert.deepEqual(b.me, { name: "Swift Fox 42", rating: 1032, games: 14, wins: 8, losses: 6, draws: 0, rank: 128 });
  const c = normalizeRank({ top, me: { name: "a", rating: 1000, games: 9, wins: 4, rank: 9, index: 8 } }, "classic");
  assert.equal(c.me.index, 8);
  assert.equal(normalizeRank({ top, me: { name: "a", rating: 1000, games: 9, wins: 4, rank: 99, index: null } }, "classic").me.index, null);
  assert.equal(normalizeRank({ top, me: { name: "a", rating: 1000, games: 9, wins: 4, rank: 99, index: -2 } }, "classic").me.index, null);
});

test("점수·경기 수가 같으면 같은 순위(서버와 같은 셈)", () => {
  const b = normalizeRank({ top: [row(0), row(1, { rating: 1200, games: 9 }), row(2, { rating: 1200, games: 9 }), row(3, { rating: 1200, games: 8 })] }, "classic");
  assert.deepEqual(
    b.top.map((r) => r.rank),
    [1, 2, 2, 4],
  );
});

test("내 기록: 오르기 전이면 순위 없음, 한 번도 안 했으면 null", () => {
  assert.equal(normalizeRank({ top: [], me: { name: "a", rating: 1000, games: 2, wins: 1, losses: 1, draws: 0, rank: null } }, "classic").me.rank, null);
  assert.equal(normalizeRank({ top: [], me: null }, "classic").me, null);
  assert.equal(normalizeRank({}, "rps7").game, "rps7");
  assert.equal(gamesLeft(null), BOARD_MIN_GAMES);
  assert.equal(gamesLeft({ games: 3 }), BOARD_MIN_GAMES - 3);
  assert.equal(gamesLeft({ games: 40 }), 0);
});

test("승률은 이긴 경기 / 경기(비김은 이긴 것이 아니다), 반올림", () => {
  assert.equal(winRate({ games: 61, wins: 40 }), 66);
  assert.equal(winRate({ games: 3, wins: 2, draws: 1 }), 67);
  assert.equal(winRate({ games: 0, wins: 0 }), 0);
  assert.equal(winRate(null), 0);
});

test("내 줄은 서버가 준 줄 번호(me.index)로 찾는다", () => {
  const twins = [row(0), row(1, { name: "Same Name", rating: 1200, games: 9 }), row(2, { name: "Same Name", rating: 1200, games: 9 })];
  const me = { ...twins[2], rank: 2 };
  assert.equal(myIndex(normalizeRank({ top: twins, me: { ...me, index: 2 } }, "classic")), 2, "이름·기록이 같은 두 사람도 가른다");
  assert.equal(myIndex(normalizeRank({ top: twins, me: { ...me, index: 1 } }, "classic")), 1);
  assert.equal(myIndex(normalizeRank({ top: twins, me: { ...me, index: null } }, "classic")), -1, "순위표 밖");
  assert.equal(myIndex(normalizeRank({ top: twins, me: { ...me, index: 7 } }, "classic")), -1, "목록보다 크면 없는 것으로");
});

test("옛 서버(me.index 없음)면 이름과 기록으로 찾는다(같은 순위가 여럿이어도)", () => {
  const top = [row(0), row(1, { rating: 1200, games: 9 }), row(2, { rating: 1200, games: 9 })];
  const me = { ...row(2, { rating: 1200, games: 9 }), rank: 2 };
  const b = normalizeRank({ top, me }, "classic");
  assert.equal(myIndex(b), 2, "같은 2위 가운데 내 이름 줄");
  assert.equal(myIndex(normalizeRank({ top, me: { ...me, name: "Someone Else" } }, "classic")), -1);
  assert.equal(myIndex(normalizeRank({ top, me: { ...me, rank: null } }, "classic")), -1, "5경기 전이면 목록에 없다");
  assert.equal(myIndex(normalizeRank({ top, me: null }, "classic")), -1);
});
