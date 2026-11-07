// 도전장 규칙: 만들기, 보기(답 전에는 손이 안 보임), 답하기(한 번만), 판정.

import test from "node:test";
import assert from "node:assert/strict";
import { makeChallenge, answerChallenge, viewChallenge, judge } from "../src/challenge.js";
import { CHALLENGE_KEEP_MS as KEEP_MS } from "../src/protocol.js";
import { resolveVariant } from "../src/games.js";
import { Fail } from "../src/http.js";

const A = "creatorPid_000000001";
const B = "answerPid_0000000002";
const C = "otherPid_00000000003";
const NOW = 1_800_000_000_000;

const failOf = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof Fail, `Fail 이 아닌 오류: ${e}`);
    return e;
  }
  return null;
};

function make(extra = {}) {
  const rec = makeChallenge({ v: 1, pid: A, name: "날쌘 여우 42", game: "classic", hands: ["rock"], ...extra }, NOW);
  rec.code = "7KQ2M9XA";
  return rec;
}

test("만들기: 기록에는 손과 pid, 보이는 꼴에는 둘 다 없다", () => {
  const rec = make({ e: "hi" });
  assert.equal(rec.expires, NOW + KEEP_MS);
  assert.deepEqual(rec.hands, ["rock"]);
  const v = viewChallenge(rec);
  assert.deepEqual(v, {
    code: "7KQ2M9XA",
    game: "classic",
    custom: null,
    rounds: 1,
    from: "날쌘 여우 42",
    e: "hi",
    made: NOW,
    expires: NOW + KEEP_MS,
    open: true,
  });
  const text = JSON.stringify(v);
  assert.ok(!text.includes("rock"));
  assert.ok(!text.includes(A));
});

test("만들기 검사: 손 수 1·3·5, 없는 손, 없는 게임, 닉네임, 이모트", () => {
  assert.equal(failOf(() => make({ hands: [] })).code, "bad_hand");
  assert.equal(failOf(() => make({ hands: ["rock", "paper"] })).code, "bad_hand");
  assert.equal(failOf(() => make({ hands: ["rock", "rock", "rock", "rock", "rock", "rock", "rock"] })).code, "bad_hand");
  assert.equal(failOf(() => make({ hands: ["stone"] })).code, "bad_hand");
  assert.equal(failOf(() => make({ hands: "rock" })).code, "bad_hand");
  assert.equal(failOf(() => make({ game: "mukjjippa" })).code, "bad_game");
  assert.equal(failOf(() => make({ name: "" })).code, "bad_name");
  assert.equal(failOf(() => make({ pid: "x" })).code, "bad_pid");
  assert.equal(failOf(() => make({ e: "boo" })).code, "bad_request");
  assert.equal(make({ hands: ["rock", "paper", "scissors"] }).hands.length, 3);
});

test("답하기: 판정하고 닫는다. 같은 사람이 다시 보내면 같은 결과", () => {
  const rec = make();
  const { rec: closed, changed } = answerChallenge(rec, { v: 1, pid: B, name: "느린 곰 7", hands: ["paper"] }, NOW + 5000);
  assert.equal(changed, true);
  const v = viewChallenge(closed);
  assert.equal(v.open, false);
  assert.equal(v.to, "느린 곰 7");
  assert.equal(v.answered, NOW + 5000);
  assert.deepEqual(v.hands, { from: ["rock"], to: ["paper"] });
  assert.deepEqual(v.cmp, [-1]);
  assert.deepEqual(v.score, [0, 1]);
  assert.equal(v.winner, 1);
  assert.ok(!JSON.stringify(v).includes(A) && !JSON.stringify(v).includes(B));

  const again = answerChallenge(closed, { v: 1, pid: B, name: "느린 곰 7", hands: ["rock"] }, NOW + 9000);
  assert.equal(again.changed, false);
  assert.deepEqual(viewChallenge(again.rec), v);
});

test("답하기: 다른 사람이 먼저 답했으면 closed + 결과, 만든 사람은 own", () => {
  const rec = make();
  assert.equal(failOf(() => answerChallenge(rec, { v: 1, pid: A, name: "나", hands: ["paper"] }, NOW)).code, "own");
  const { rec: closed } = answerChallenge(rec, { v: 1, pid: B, name: "느린 곰 7", hands: ["scissors"] }, NOW);
  const f = failOf(() => answerChallenge(closed, { v: 1, pid: C, name: "늦은 새", hands: ["paper"] }, NOW));
  assert.equal(f.code, "closed");
  assert.equal(f.status, 409);
  assert.equal(f.extra.result.winner, 0);
  assert.deepEqual(f.extra.result.hands, { from: ["rock"], to: ["scissors"] });
});

test("답하기 검사: 손 수가 다르거나 없는 손", () => {
  const rec = make({ hands: ["rock", "paper", "scissors"] });
  assert.equal(failOf(() => answerChallenge(rec, { v: 1, pid: B, name: "곰", hands: ["rock"] }, NOW)).code, "bad_hand");
  assert.equal(failOf(() => answerChallenge(rec, { v: 1, pid: B, name: "곰", hands: ["rock", "rock", "lizard"] }, NOW)).code, "bad_hand");
  assert.equal(failOf(() => answerChallenge(rec, { v: 1, pid: B, name: "", hands: ["rock", "rock", "rock"] }, NOW)).code, "bad_name");
});

test("여러 판: 정해진 판 수를 다 맞대고 이긴 판이 많은 쪽", () => {
  const { V } = resolveVariant("classic");
  // 바위:가위(이김), 보:보(비김), 가위:바위(짐) → 1:1 비김
  assert.deepEqual(judge(V, ["rock", "paper", "scissors"], ["scissors", "paper", "rock"]), { cmp: [1, 0, -1], score: [1, 1], winner: -1 });
  assert.deepEqual(judge(V, ["rock", "rock", "rock"], ["scissors", "paper", "scissors"]), { cmp: [1, -1, 1], score: [2, 1], winner: 0 });
  const rec = make({ hands: ["rock", "rock", "paper", "paper", "scissors"] });
  const { rec: closed } = answerChallenge(rec, { v: 1, pid: B, name: "곰", hands: ["paper", "paper", "rock", "rock", "rock"] }, NOW);
  const v = viewChallenge(closed);
  assert.equal(v.rounds, 5);
  assert.deepEqual(v.cmp, [-1, -1, 1, 1, -1]);
  assert.deepEqual(v.score, [2, 3]);
  assert.equal(v.winner, 1);
});

test("판정은 도감 규칙 그대로: RPS-101 과 직접 만들기", () => {
  const { V } = resolveVariant("rps101");
  const a = V.hands[0].id;
  const beaten = V.hands[V.beats(0)[0]].id;
  assert.deepEqual(judge(V, [a], [beaten]).cmp, [1]);
  assert.deepEqual(judge(V, [beaten], [a]).cmp, [-1]);
  assert.deepEqual(judge(V, [a], [a]).cmp, [0]);

  const custom = { n: 5, k: 2, seed: 99 };
  const rec = makeChallenge({ v: 1, pid: A, name: "여우", game: "custom", custom, hands: ["h1"] }, NOW);
  assert.deepEqual(viewChallenge(rec).custom, custom);
  assert.equal(failOf(() => makeChallenge({ v: 1, pid: A, name: "여우", game: "custom", custom, hands: ["h6"] }, NOW)).code, "bad_hand");
  const { rec: closed } = answerChallenge(rec, { v: 1, pid: B, name: "곰", hands: ["h1"] }, NOW);
  assert.deepEqual(viewChallenge(closed).cmp, [0]);
});

test("기록은 JSON 으로 저장해도 그대로다(Durable Object 저장소)", () => {
  const rec = make();
  const { rec: closed } = answerChallenge(rec, { v: 1, pid: B, name: "곰", hands: ["paper"] }, NOW);
  const back = structuredClone(closed);
  assert.deepEqual(viewChallenge(back), viewChallenge(closed));
  assert.equal(failOf(() => answerChallenge(back, { v: 1, pid: C, name: "새", hands: ["rock"] }, NOW)).code, "closed");
});
