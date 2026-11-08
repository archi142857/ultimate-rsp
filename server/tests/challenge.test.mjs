// 도전장 규칙: 만들기, 보기(답 전에는 손이 안 보임), 답하기(한 번만), 판정.

import test from "node:test";
import assert from "node:assert/strict";
import { makeChallenge, answerChallenge, closeChallenge, viewChallenge, judge } from "../src/challenge.js";
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
    fromFace: null,
    e: "hi",
    made: NOW,
    expires: NOW + KEEP_MS,
    open: true,
    max: 1,
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

test("프로필 그림: 만든 사람 fromFace, 답한 사람 toFace(모르는 값은 null)", () => {
  const rec = make({ face: "fox" });
  assert.equal(viewChallenge(rec).fromFace, "fox");
  assert.equal(viewChallenge(rec).toFace, undefined, "답 전에는 없다");
  const { rec: done } = answerChallenge(rec, { v: 1, pid: B, name: "곰", face: "king", hands: ["paper"] }, NOW + 1);
  const v = viewChallenge(done);
  assert.equal(v.fromFace, "fox");
  assert.equal(v.toFace, "king");
  assert.equal(viewChallenge(make({ face: "nope" })).fromFace, null);
  const { rec: plain } = answerChallenge(make(), { v: 1, pid: B, name: "곰", face: 7, hands: ["paper"] }, NOW + 1);
  assert.equal(viewChallenge(plain).toFace, null);
  assert.ok(!JSON.stringify(v).includes(B));
});

test("여럿이 도전장: max 명까지 답하고, 다 차면 closed. 같은 사람은 그대로, 만든 사람은 own", () => {
  const rec = make({ hands: ["rock", "paper", "scissors"], max: 3 });
  assert.deepEqual(rec.answers, []);
  let v = viewChallenge(rec, null, NOW);
  assert.equal(v.max, 3);
  assert.equal(v.count, 0);
  assert.equal(v.open, true);
  assert.deepEqual(v.answers, []);
  const pids = ["manyPid_0000000000001", "manyPid_0000000000002", "manyPid_0000000000003"];
  const throwsOf = [["paper", "paper", "paper"], ["rock", "paper", "scissors"], ["scissors", "scissors", "rock"]];
  let cur = rec;
  pids.forEach((pid, i) => {
    const r = answerChallenge(cur, { v: 1, pid, name: `사람${i}`, hands: throwsOf[i] }, NOW + i);
    assert.equal(r.changed, true);
    cur = r.rec;
  });
  assert.equal(cur.answers.length, 3);
  // 첫 사람: 보 보 보 → 바위에 이기고 보와 비기고 가위에 진다 → 1:1 비김
  assert.deepEqual(cur.answers[0].cmp, [-1, 0, 1]);
  assert.equal(cur.answers[0].winner, -1);
  assert.equal(cur.answers[1].winner, -1, "똑같이 내면 모두 비김");
  assert.equal(cur.answers[2].winner, 1, "가위 가위 바위 → 받은 사람이 2판");
  const again = answerChallenge(cur, { v: 1, pid: pids[1], name: "사람1", hands: ["rock", "rock", "rock"] }, NOW + 9);
  assert.equal(again.changed, false);
  assert.equal(failOf(() => answerChallenge(cur, { v: 1, pid: A, name: "여우", hands: ["rock", "rock", "rock"] }, NOW)).code, "own");
  const late = failOf(() => answerChallenge(cur, { v: 1, pid: C, name: "새", hands: ["rock", "rock", "rock"] }, NOW));
  assert.equal(late.code, "closed");
  assert.equal(late.extra.result.open, false);
  assert.deepEqual(late.extra.result.hands, { from: ["rock", "paper", "scissors"] }, "다 찼으면 끝난 도전장이라 손을 연다");
  assert.deepEqual(late.extra.result.answers.map((a) => a.hands), throwsOf);
  v = viewChallenge(cur, null, NOW + 9);
  assert.equal(v.count, 3);
  assert.equal(v.open, false);
});

test("여럿이 도전장 꼴: 마감 전에는 누구나 보는 꼴에도 답한 사람 꼴에도 결과가 없고, 만든 사람만 모든 답을 본다", () => {
  const P1 = "manyPid_0000000000011";
  const P2 = "manyPid_0000000000012";
  let { rec } = answerChallenge(make({ hands: ["rock"], max: 10, face: "fox" }), { v: 1, pid: P1, name: "곰", face: "bear", hands: ["paper"] }, NOW + 1);
  ({ rec } = answerChallenge(rec, { v: 1, pid: P2, name: "새", hands: ["scissors"] }, NOW + 2));
  const at = NOW + 3;
  const anyone = viewChallenge(rec, null, at);
  assert.deepEqual(anyone.answers, [
    { name: "곰", face: "bear", at: NOW + 1 },
    { name: "새", face: null, at: NOW + 2 },
  ]);
  assert.deepEqual([anyone.open, anyone.reveal, anyone.closes, anyone.you], [true, "end", NOW + 24 * 3600_000, undefined]);
  const text = JSON.stringify(anyone);
  for (const bad of ["rock", "paper", "scissors", "winner", "score", A, P1, P2]) assert.ok(!text.includes(bad), bad);
  assert.deepEqual(viewChallenge(rec, C, at), anyone, "답하지 않은 사람이 물어도 같다");

  const owner = viewChallenge(rec, A, at);
  assert.equal(owner.you, "from");
  assert.deepEqual(owner.hands, { from: ["rock"] });
  assert.deepEqual(owner.answers.map((a) => [a.hands, a.cmp, a.winner]), [[["paper"], [-1], 1], [["scissors"], [1], 0]]);

  const second = viewChallenge(rec, P2, at);
  assert.deepEqual([second.you, second.to, second.toFace, second.answered, second.hands], [1, "새", null, NOW + 2, { to: ["scissors"] }]);
  for (const k of ["cmp", "score", "winner"]) assert.equal(second[k], undefined, k);
  const back = structuredClone(rec);
  assert.deepEqual(viewChallenge(back, P1, at), viewChallenge(rec, P1, at), "저장했다 꺼내도 같다");
});

test("여럿이 도전장 만들기 검사: max 는 1–50 정수, 안 주면 1(지금 도전장 그대로)", () => {
  for (const bad of [0, 51, 2.5, "3", -1]) assert.equal(failOf(() => make({ max: bad })).code, "bad_request", String(bad));
  assert.equal(make().max, 1);
  assert.equal(make().answers, undefined);
  assert.equal(make({ max: 50 }).max, 50);
  // 11-08 전에 만든 기록(max 없음)은 한 사람 도전장으로 읽는다
  const old = make();
  delete old.max;
  const { rec } = answerChallenge(old, { v: 1, pid: B, name: "곰", hands: ["paper"] }, NOW);
  assert.equal(viewChallenge(rec).open, false);
  assert.equal(viewChallenge(rec).max, 1);
});

test("여럿이 도전장 reveal end: 마감 전에는 답한 사람도 '냈다'만, 만든 사람이 닫으면 모두 공개", () => {
  const P1 = "endPid_000000000000001";
  const P2 = "endPid_000000000000002";
  const rec = make({ hands: ["rock"], max: 5 });
  assert.equal(rec.reveal, "end");
  // 버리는 pid 로 먼저 답해도 만든 사람 손이나 결과를 알 수 없다
  let { rec: cur } = answerChallenge(rec, { v: 1, pid: P1, name: "버림", hands: ["paper"] }, NOW + 1);
  ({ rec: cur } = answerChallenge(cur, { v: 1, pid: P2, name: "진짜", hands: ["scissors"] }, NOW + 2));
  const p1 = viewChallenge(cur, P1, NOW + 4);
  assert.deepEqual([p1.you, p1.answered, p1.hands], [0, NOW + 1, { to: ["paper"] }]);
  for (const k of ["cmp", "score", "winner"]) assert.equal(p1[k], undefined, k);
  assert.deepEqual(p1.answers, [
    { name: "버림", face: null, at: NOW + 1 },
    { name: "진짜", face: null, at: NOW + 2 },
  ]);
  const anyone = viewChallenge(cur, null, NOW + 4);
  assert.equal(anyone.reveal, "end");
  assert.ok(!JSON.stringify(anyone).includes("rock") && !JSON.stringify(anyone).includes("winner"), "누구나 보는 꼴에도 결과가 없다");
  assert.deepEqual(viewChallenge(cur, A, NOW + 4).answers.map((a) => a.winner), [1, 0], "만든 사람은 늘 본다");
  // 닫기: 만든 사람만, 보통 도전장은 안 됨, 두 번 닫아도 그대로
  assert.equal(failOf(() => closeChallenge(cur, { v: 1, pid: P1 }, NOW + 3)).code, "bad_pid");
  assert.equal(failOf(() => closeChallenge(make(), { v: 1, pid: A }, NOW + 3)).code, "bad_request");
  const shut = closeChallenge(cur, { v: 1, pid: A }, NOW + 3);
  assert.equal(shut.changed, true);
  assert.equal(closeChallenge(shut.rec, { v: 1, pid: A }, NOW + 4).changed, false);
  cur = shut.rec;
  const after = viewChallenge(cur, null, NOW + 4);
  assert.deepEqual([after.open, after.closed, after.count], [false, NOW + 3, 2]);
  assert.deepEqual(after.hands, { from: ["rock"] });
  assert.deepEqual(after.answers.map((a) => [a.hands, a.score, a.winner]), [[["paper"], [0, 1], 1], [["scissors"], [1, 0], 0]]);
  const p2 = viewChallenge(cur, P2, NOW + 4);
  assert.deepEqual([p2.you, p2.hands, p2.winner], [1, { from: ["rock"], to: ["scissors"] }, 0]);
  // 닫힌 뒤에는 답을 안 받는다(자리가 남아도)
  assert.equal(failOf(() => answerChallenge(cur, { v: 1, pid: C, name: "새", hands: ["rock"] }, NOW + 5)).code, "closed");
  // 같은 사람이 다시 보내면 그대로(닫힌 뒤에도)
  assert.equal(answerChallenge(cur, { v: 1, pid: P1, name: "버림", hands: ["rock"] }, NOW + 6).changed, false);
});

test("여럿이 도전장 reveal 은 end 만(11-09 사용자 결정), 안 주면 end. max 를 채우거나 24시간이 지나면 연다", () => {
  assert.equal(make({ max: 3 }).reveal, "end");
  for (const bad of ["now", "later", 1, true]) assert.equal(failOf(() => make({ max: 3, reveal: bad })).code, "bad_request", String(bad));
  assert.equal(failOf(() => make({ reveal: "soon" })).code, "bad_request", "보통 도전장도 틀린 값은 안 받는다");
  let cur = make({ hands: ["rock"], max: 2 });
  ({ rec: cur } = answerChallenge(cur, { v: 1, pid: B, name: "곰", hands: ["paper"] }, NOW));
  assert.equal(viewChallenge(cur, B, NOW + 1).winner, undefined);
  ({ rec: cur } = answerChallenge(cur, { v: 1, pid: C, name: "새", hands: ["rock"] }, NOW + 1));
  const v = viewChallenge(cur, B, NOW + 2);
  assert.deepEqual([v.open, v.closed, v.winner, v.hands.from], [false, undefined, 1, ["rock"]], "다 차면 닫는 사람 없이 연다");
});

test("여럿이 도전장은 만든 뒤 24시간이 지나면 저절로 마감한다(보관은 30일 그대로)", () => {
  const DAY = 24 * 3600_000;
  let cur = make({ hands: ["rock"], max: 10 });
  ({ rec: cur } = answerChallenge(cur, { v: 1, pid: B, name: "곰", hands: ["paper"] }, NOW + 5));
  assert.equal(viewChallenge(cur, null, NOW + DAY - 1).open, true);
  const late = viewChallenge(cur, null, NOW + DAY);
  assert.deepEqual([late.open, late.count, late.answers[0].winner, late.hands.from], [false, 1, 1, ["rock"]], "24시간이 되면 모두에게 연다");
  assert.equal(viewChallenge(cur, B, NOW + DAY).winner, 1);
  assert.equal(failOf(() => answerChallenge(cur, { v: 1, pid: C, name: "새", hands: ["rock"] }, NOW + DAY)).code, "closed");
  assert.equal(cur.expires, NOW + 30 * DAY);
  // 11-08 에 만든 기록(closes·reveal now)도 만든 때 + 24시간, 결과는 마감 뒤에
  const old = { ...make({ max: 3 }), reveal: "now" };
  delete old.closes;
  const r = answerChallenge(old, { v: 1, pid: B, name: "곰", hands: ["paper"] }, NOW + 1).rec;
  assert.equal(viewChallenge(r, B, NOW + 2).winner, undefined);
  assert.equal(viewChallenge(r, B, NOW + DAY).winner, 1);
});
