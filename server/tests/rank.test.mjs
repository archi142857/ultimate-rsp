// 랭킹 순수 함수(rank.js). 저장소(rank-do.js)는 Cloudflare 가 있어야 돌아서 로컬 wrangler dev 로 본다.

import test from "node:test";
import assert from "node:assert/strict";
import { afterEntry, boardEntry, fromRow, ipTag, rankKey, sameHome } from "../src/rank.js";
import { newRecord, rateMatch } from "../../web/js/core/rating.js";
import { RANK_TOP } from "../src/protocol.js";

const A = "playerA_000000000001";
const B = "playerB_000000000002";

test("저장 열쇠: pid 의 해시(16진수 32자), 같은 pid 는 같고 다른 pid 는 다르다", async () => {
  const ka = await rankKey(A);
  assert.match(ka, /^[0-9a-f]{32}$/);
  assert.equal(await rankKey(A), ka);
  assert.notEqual(await rankKey(B), ka);
  assert.ok(!ka.includes(A.slice(0, 8)), "열쇠에 pid 가 그대로 들어가면 안 된다");
});

test("저장된 줄 ↔ 기록, 순위표·방에 싣는 꼴에는 열쇠가 없다", () => {
  assert.deepEqual(fromRow(null), newRecord());
  const row = { key: "k".repeat(32), name: "여우", face: "fox", rating: 1032, games: 6, wins: 4, losses: 2, draws: 0, at: 1 };
  assert.deepEqual(fromRow(row), { rating: 1032, games: 6, wins: 4, losses: 2, draws: 0 });
  assert.deepEqual(boardEntry(row), { name: "여우", face: "fox", rating: 1032, games: 6, wins: 4, losses: 2, draws: 0 });
  assert.equal(boardEntry({ ...row, face: undefined }).face, null, "예전 줄(그림 칸 없음)은 null");
  const out = rateMatch(fromRow(row), newRecord(), 1);
  assert.deepEqual(Object.keys(afterEntry(out.a)), ["rating", "delta", "games", "wins", "losses", "draws"]);
  assert.equal(afterEntry(out.a).games, 7);
  assert.equal(RANK_TOP, 50);
});

test("IP 꼬리표: 같은 날 같은 IP 면 같고, 날이 바뀌거나 IP 가 다르면 다르다. IP 는 그대로 남지 않는다", async () => {
  const day = Date.UTC(2026, 10, 8, 12);
  const a = await ipTag("203.0.113.7", day);
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(await ipTag("203.0.113.7", day + 3600_000), a);
  assert.notEqual(await ipTag("203.0.113.7", day + 24 * 3600_000), a);
  assert.notEqual(await ipTag("203.0.113.8", day), a);
  assert.ok(!a.includes("203"));
  assert.equal(await ipTag(null, day), null);
  assert.equal(await ipTag("", day), null);
  assert.equal(await ipTag("127.0.0.1", day), null, "로컬 시험은 막지 않는다");
  assert.equal(await ipTag("::1", day), null);
});

test("같은 곳: 둘 다 꼬리표가 있고 같을 때만", () => {
  assert.equal(sameHome(["aa", "aa"]), true);
  assert.equal(sameHome(["aa", "bb"]), false);
  assert.equal(sameHome([null, null]), false, "모르면 막지 않는다");
  assert.equal(sameHome(["aa"]), false, "봇과 하기");
});
