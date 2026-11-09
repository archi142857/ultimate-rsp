// node --test 로 돈다. 방·랜덤 매칭 화면의 바탕: 자리·판 계산, 규칙 한 줄, 다시 붙기 간격, 이모트·오류 문구.

import test from "node:test";
import assert from "node:assert/strict";
import { groupHead, sidesOf, cmpFor, seatName, seatBot, secondsLeft, canSit, finalFor, duelRound, groupRound, headcount } from "../web/js/online/room-model.js";
import { cleanRules, rulesLine, gameName, groupBases } from "../web/js/online/rules.js";
import { retryDelay, isFinalClose } from "../web/js/online/socket.js";
import { emoteIds, emoteEmoji, emoteLabel } from "../web/js/online/emotes.js";
import { wsErrorText, closeText, errorText } from "../web/js/online/messages.js";
import { CLOSE, EMOTES, ROOM_DEFAULTS } from "../web/js/online/protocol.js";
import { variantOf, challengeGames, randomGames, roomGameIds, randomGame } from "../web/js/online/games.js";
import { onlineGames, groupBases as sharedBases } from "../web/js/data/online.js";
import { setLang } from "../web/js/i18n.js";

const HANGUL = /[ㄱ-ㆎ가-힣]/;
const inEnglish = (fn) => {
  setLang("en", { persist: false });
  try {
    return fn();
  } finally {
    setLang("ko", { persist: false });
  }
};

test("자리: 내 쪽·상대 쪽, 이름, 남은 초, 앉기", () => {
  assert.deepEqual(sidesOf(0), { me: 0, op: 1 });
  assert.deepEqual(sidesOf(1), { me: 1, op: 0 });
  assert.deepEqual(sidesOf(null), { me: 0, op: 1 }, "구경꾼은 0번이 왼쪽");
  assert.equal(cmpFor(1, 0), 1);
  assert.equal(cmpFor(1, 1), -1);
  assert.equal(seatName({ kind: "human", name: "날쌘 여우 42", on: true }), "날쌘 여우 42");
  assert.equal(seatName({ kind: "bot", bot: "nash", name: null }), "컴퓨터");
  assert.equal(seatName({ kind: "bot", bot: "nash", name: "느린 곰 7" }), "느린 곰 7(컴퓨터)");
  assert.equal(seatName({ kind: "empty" }), "빈자리");
  assert.equal(seatBot({ kind: "bot", bot: "nash" }), "계산기");
  assert.equal(seatBot({ kind: "human" }), null);
  assert.equal(secondsLeft(10_500, 10_000), 1);
  assert.equal(secondsLeft(9_000, 10_000), 0);
  assert.equal(secondsLeft(null, 10_000), null);
  const seats = [{ kind: "human" }, { kind: "empty" }];
  assert.equal(canSit({ phase: "lobby", seats }), true);
  assert.equal(canSit({ phase: "play", seats }), false);
  assert.equal(canSit({ phase: "end", seats: [{ kind: "human" }, { kind: "human" }] }), false);
  assert.deepEqual(headcount({ seats: [{ kind: "human" }, { kind: "bot" }, { kind: "empty" }] }), { humans: 1, empty: 1, total: 3 });
});

test("판: 둘이서는 내 쪽에서, 여럿이는 이긴 손과 빠진 자리", () => {
  const V = variantOf("classic");
  const d = duelRound(V, { r: 2, hands: ["rock", "scissors"], cmp: 1 }, 1);
  assert.deepEqual(d, { r: 2, mi: V.index.scissors, oi: V.index.rock, cmp: -1 });
  assert.equal(duelRound(V, { r: 1, hands: ["rock", "laser"], cmp: 1 }, 0), null, "모르는 손");
  const g = groupRound(V, { r: 3, hands: ["rock", null, "paper"], win: "paper", out: [0] });
  assert.deepEqual(g, { r: 3, hands: [V.index.rock, null, V.index.paper], win: V.index.paper, lose: null, out: [0] });
  assert.equal(groupRound(V, { r: 4, hands: ["rock", "paper", "scissors"], win: null, out: [] }).win, null);
  // 갈렸는지는 out 으로 본다. 점수 규칙의 술래 정하기는 이긴 손 없이 진 손(lose)으로 갈린다(서버 2a825ec)
  assert.equal(groupHead(V, groupRound(V, { r: 4, hands: ["rock", "paper", "scissors"], win: null, out: [] })), null);
  assert.deepEqual(groupHead(V, g), { kind: "win", hand: V.index.paper, name: V.hands[V.index.paper].name });
  const lost = groupRound(V, { r: 5, hands: ["rock", "rock", "scissors"], win: null, lose: "scissors", out: [0, 1] });
  assert.equal(groupHead(V, lost).kind, "lose");
  assert.equal(groupHead(V, lost).hand, V.index.scissors);
  assert.equal(finalFor({ winner: 1 }, 1), 1);
  assert.equal(finalFor({ winner: 1 }, 0), -1);
  assert.equal(finalFor({ winner: null }, 0), 0);
});

test("규칙: 기본값과 한 줄", () => {
  assert.deepEqual(cleanRules({}), { ...ROOM_DEFAULTS, seats: 2 });
  assert.deepEqual(cleanRules({ game: "group" }), { game: "group", base: "classic", mode: "survive", seats: 5, bot: "human", timer: 20 });
  // 바탕이 될 수 없는 id(이어 하는 놀이). 손 많은 변종(rpsls 등)은 MANY_HAND_GROUP 을 켜면 바탕이 된다(컨셉 11-08)
  assert.deepEqual(cleanRules({ game: "group", seats: 99, mode: "?", base: "mukjjippa" }), { game: "group", base: "classic", mode: "survive", seats: 5, bot: "human", timer: 20 });
  assert.deepEqual(cleanRules({ game: "nope", format: "bo9", timer: 7, bot: "?" }), { ...ROOM_DEFAULTS, seats: 2 });
  assert.equal(cleanRules({ game: "custom", custom: { n: 5, k: 2, seed: 7 } }).custom.n, 5);
  assert.equal(rulesLine(cleanRules({})), "가위바위보 · 삼세판 · 20초");
  assert.equal(rulesLine(cleanRules({ game: "group", mode: "loser", seats: 4, timer: 0 })), "여럿이 가위바위보 · 술래 한 명 · 4명 · 시간 제한 없음");
  assert.match(gameName({ game: "group", base: "mushiken" }), /\(/);
  assert.equal(groupBases().length, sharedBases().length, "방의 여럿이 바탕은 data/online.js 와 같다(손 셋 변종이 늘어도)");
  inEnglish(() => {
    for (const r of [{}, { game: "group", mode: "loser" }, { game: "rps101", format: "endless", timer: 60 }, { game: "custom", custom: { n: 7, k: 3, seed: 1 } }])
      assert.ok(!HANGUL.test(rulesLine(cleanRules(r))), JSON.stringify(r));
  });
});

test("다시 붙기: 1·2·4·8·16·30초, 그 뒤 30초. 끝내는 코드는 안 붙는다", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9].map((n) => retryDelay(n) / 1000), [1, 2, 4, 8, 16, 30, 30, 30]);
  assert.equal(retryDelay(0, CLOSE.too_fast), 30_000);
  for (const c of [4000, 4001, 4003, 4004, 4008, 4009, 4010, 4029, 4100]) assert.equal(isFinalClose(c), true, c);
  for (const c of [1000, 1001, 1006, 1011, 4013, 4503]) assert.equal(isFinalClose(c), false, c);
});

test("이모트와 방 오류 문구는 두 언어로 있다", () => {
  assert.deepEqual(emoteIds(), EMOTES);
  assert.equal(new Set(EMOTES.map(emoteEmoji)).size, EMOTES.length);
  const ws = ["not_host", "phase", "stale", "already", "full"];
  const closes = Object.values(CLOSE).filter((c) => isFinalClose(c) && c !== CLOSE.leave && c !== CLOSE.matched);
  assert.equal(new Set(ws.map(wsErrorText)).size, ws.length);
  assert.equal(new Set(closes.map(closeText)).size, closes.length);
  for (const c of [1006, 4503]) assert.equal(closeText(c), errorText("network"));
  inEnglish(() => {
    for (const id of EMOTES) assert.ok(!HANGUL.test(emoteLabel(id)), id);
    for (const c of ws) assert.ok(!HANGUL.test(wsErrorText(c)), c);
    for (const c of closes) assert.ok(!HANGUL.test(closeText(c)), String(c));
  });
});

test("화면의 게임 목록은 공용 목록(data/online.js)을 따른다", () => {
  const ids = (list) => list.map((e) => e.id);
  assert.deepEqual(ids(challengeGames()), onlineGames("challenge").filter((id) => id !== "custom"), "도전장 만들기(직접 만들기는 아직 고르는 칸이 없다)");
  assert.deepEqual(ids(randomGames()), onlineGames("random"), "랜덤 매칭");
  assert.deepEqual(roomGameIds(), onlineGames("room").filter((id) => id !== "custom"), "방");
  assert.deepEqual(ids(groupBases()), sharedBases(), "여럿이 바탕");
  for (const id of roomGameIds()) assert.equal(cleanRules({ game: id }).game, id, id);
  assert.equal(randomGame("custom"), null, "랜덤 매칭에는 직접 만들기가 없다");
});
