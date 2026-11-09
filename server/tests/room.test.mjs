// 방 규칙(room.js): 자리, 방장, 시작, 손 내기·공개, 시간 초과, 끊김과 봇, group, 랜덤 방, 저장 뒤 되살리기.
// Cloudflare 없이 돈다. 시각은 숫자로 직접 넘긴다.

import test from "node:test";
import assert from "node:assert/strict";
import { Room } from "../src/room.js";
import { Fail } from "../src/http.js";
import { GRACE_MS, REVEAL_MS, ROOM_DELETE_MS, MATCH_SHOW_MS, ENDLESS_MAX } from "../src/protocol.js";
import { MANY_HAND_GROUP, seatRange } from "../../web/js/data/online.js";

const T0 = 1_800_000_000_000;
const A = "playerA_000000000001";
const B = "playerB_000000000002";
const C = "playerC_000000000003";

function make(rules = {}, extra = {}) {
  return Room.create({ code: "K7Q2", rules, now: T0, seed: 12345, host: { pid: A, name: "여우" }, ...extra });
}

function failCode(fn) {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof Fail, `Fail 이 아닌 오류: ${e && e.stack}`);
    return e.code;
  }
  return null;
}

const kinds = (room) => room.view(null).seats.map((x) => x.kind);
const evKinds = (evs) => evs.map((e) => e.k);
const thr = (room, pid, h, now = T0) => room.handle(pid, "", { t: "throw", r: room.s.game.r, h }, now);

/** A·B 둘이 들어와 시작한 방 */
function twoPlayers(rules = {}) {
  const room = make(rules);
  room.join(A, "여우", T0);
  room.join(B, "곰", T0);
  room.handle(A, "여우", { t: "start" }, T0);
  return room;
}

test("만들기와 들어오기: 방장 0번, 빈자리, 꽉 차면 구경꾼", () => {
  const room = make();
  assert.equal(room.s.cleanupAt, T0 + ROOM_DELETE_MS);
  let v = room.view(null);
  assert.equal(v.phase, "lobby");
  assert.equal(v.host, 0);
  assert.deepEqual(v.seats[0], { kind: "human", name: "여우", face: null, on: false, until: T0 + GRACE_MS, ready: false });
  assert.deepEqual(room.join(A, "여우", T0), { seat: 0, evs: [{ k: "back", s: 0 }] });
  assert.equal(room.s.cleanupAt, null);
  assert.deepEqual(room.join(B, "곰", T0), { seat: 1, evs: [{ k: "join", s: 1 }] });
  assert.deepEqual(room.join(C, "새", T0), { seat: null, evs: [{ k: "watch" }] });
  v = room.view(1, 1);
  assert.deepEqual(v.seats, [
    { kind: "human", name: "여우", face: null, on: true, until: null, ready: false },
    { kind: "human", name: "곰", face: null, on: true, until: null, ready: false },
  ]);
  assert.equal(v.watchers, 1);
  assert.equal(v.round, null);
  assert.deepEqual(v.score, [0, 0]);
  assert.deepEqual(v.rules, { game: "classic", custom: null, base: null, mode: null, format: "bo3", seats: 2, bot: "human", timer: 20 });
});

test("방장만 시작·규칙 바꾸기", () => {
  const room = make();
  room.join(A, "여우", T0);
  room.join(B, "곰", T0);
  assert.equal(failCode(() => room.handle(B, "곰", { t: "start" }, T0)), "not_host");
  assert.equal(failCode(() => room.handle(C, "새", { t: "start" }, T0)), "not_host");
  assert.equal(failCode(() => room.handle(B, "곰", { t: "rules", rules: { format: "bo5" } }, T0)), "not_host");
  assert.deepEqual(evKinds(room.handle(A, "여우", { t: "rules", rules: { format: "bo5", timer: 30 } }, T0).evs), ["rules"]);
  assert.equal(room.s.rules.format, "bo5");
  assert.equal(failCode(() => room.handle(A, "여우", { t: "rules", rules: { format: "bo7" } }, T0)), "bad_rules");
  assert.equal(failCode(() => room.handle(A, "여우", { t: "rules", rules: { game: "mukjjippa" } }, T0)), "bad_game");
  assert.deepEqual(evKinds(room.handle(A, "여우", { t: "start" }, T0).evs), ["start"]);
  assert.equal(failCode(() => room.handle(A, "여우", { t: "start" }, T0)), "phase");
  assert.equal(failCode(() => room.handle(A, "여우", { t: "rules", rules: {} }, T0)), "phase");
});

test("둘이서 삼세판: 손은 공개 전까지 남에게 안 보이고, 다 내면 공개", () => {
  const room = twoPlayers();
  let v = room.view(0);
  assert.equal(v.phase, "play");
  assert.deepEqual(v.round, { r: 1, deadline: T0 + 20_000, done: [false, false], paused: false });
  assert.deepEqual(evKinds(thr(room, A, "rock").evs), ["throw"]);
  assert.equal(room.view(0).mine, "rock");
  const other = room.view(1);
  assert.equal(other.mine, null);
  assert.deepEqual(other.round.done, [true, false]);
  assert.ok(!JSON.stringify(other).includes("rock"), "B 에게 A 의 손이 보이면 안 된다");
  assert.ok(!JSON.stringify(room.view(null)).includes("rock"), "구경꾼에게도");

  const t1 = T0 + 5000;
  const out = thr(room, B, "scissors", t1);
  assert.deepEqual(out.evs, [{ k: "throw", s: 1 }, { k: "reveal", r: 1, n: 1 }]);
  v = room.view(1);
  assert.deepEqual(v.hist, [{ r: 1, hands: ["rock", "scissors"], cmp: 1 }]);
  assert.deepEqual(v.score, [1, 0]);
  assert.deepEqual(v.round, { r: 2, deadline: t1 + 20_000 + REVEAL_MS, done: [false, false], paused: false });

  assert.equal(failCode(() => room.handle(A, "", { t: "throw", r: 1, h: "rock" }, t1)), "stale");
  thr(room, A, "paper", t1);
  assert.equal(failCode(() => thr(room, A, "rock", t1)), "already");
  assert.equal(failCode(() => thr(room, B, "lizard", t1)), "bad_hand");
  assert.equal(failCode(() => room.handle(C, "", { t: "throw", r: 2, h: "rock" }, t1)), "phase");
  thr(room, B, "rock", t1);
  v = room.view(0);
  assert.equal(v.phase, "end");
  assert.equal(v.winner, 0);
  assert.deepEqual(v.score, [2, 0]);
  assert.equal(v.round, null);

  // 다시 하기: 같은 자리로 점수 0 부터
  assert.deepEqual(evKinds(room.handle(A, "", { t: "start" }, t1).evs), ["start"]);
  assert.deepEqual(room.view(0).score, [0, 0]);
  assert.deepEqual(room.view(0).hist, []);
});

test("혼자 시작하면 빈자리는 봇이 앉고 판이 열리자마자 낸다", () => {
  const room = make({ bot: "stubborn" });
  room.join(A, "여우", T0);
  room.handle(A, "", { t: "start" }, T0);
  const v = room.view(0);
  assert.deepEqual(v.seats[1], { kind: "bot", bot: "stubborn", name: null });
  assert.deepEqual(v.round.done, [false, true]);
  const out = thr(room, A, "rock");
  assert.deepEqual(evKinds(out.evs), ["throw", "reveal"]);
  // 고집 봇은 늘 같은 손
  const first = room.view(0).hist[0].hands[1];
  for (let k = 0; k < 4 && room.s.phase === "play"; k++) thr(room, A, "rock");
  for (const h of room.view(0).hist) assert.equal(h.hands[1], first);
});

test("저장했다 되살려도 같은 판, 같은 봇 손", () => {
  const room = make({ bot: "pattern", format: "endless", timer: 0 });
  room.join(A, "여우", T0);
  room.handle(A, "", { t: "start" }, T0);
  for (const h of ["rock", "paper", "scissors", "rock", "rock", "paper"]) thr(room, A, h);
  const copy = new Room(structuredClone(room.s));
  assert.deepEqual(copy.view(0), room.view(0));
  thr(room, A, "scissors");
  thr(copy, A, "scissors");
  assert.deepEqual(copy.view(0), room.view(0));
  assert.equal(JSON.parse(JSON.stringify(room.s)).game.rounds.length, 7);
});

test("시간 초과: 못 낸 사람은 아무 손이나, 아무도 안 낸 판이 3번이면 멈춤, 내면 다시 간다", () => {
  const room = make({ timer: 10, format: "endless" });
  room.join(A, "여우", T0);
  room.handle(A, "", { t: "start" }, T0);
  let now = T0;
  assert.equal(room.nextWake(), T0 + 10_000);
  for (let k = 1; k <= 3; k++) {
    now = room.nextWake();
    assert.deepEqual(evKinds(room.tick(now)), ["reveal"]);
    assert.equal(room.s.seats[0].afk, k);
  }
  const v = room.view(0);
  assert.equal(v.round.paused, true);
  assert.equal(v.round.deadline, null);
  assert.equal(room.nextWake(), null);
  now += 60_000;
  thr(room, A, "rock", now);
  assert.equal(room.s.seats[0].afk, 0);
  assert.equal(room.view(0).round.paused, false);
  assert.equal(room.view(0).round.deadline, now + 10_000 + REVEAL_MS);
});

test("둘 중 한 사람이 3번 연달아 넘기면 봇이 잇고, 돌아오면 되찾는다", () => {
  const room = twoPlayers({ timer: 10, format: "endless" });
  let now = T0;
  const evs = [];
  for (let k = 0; k < 3; k++) {
    thr(room, A, "rock", now);
    now = room.nextWake();
    evs.push(...room.tick(now));
  }
  assert.deepEqual(evs.filter((e) => e.k === "bot"), [{ k: "bot", s: 1, why: "afk" }]);
  assert.deepEqual(room.view(0).seats[1], { kind: "bot", bot: "human", name: "곰" });
  assert.equal(room.view(0).round.done[1], true);
  assert.deepEqual(room.join(B, "곰", now).evs, [{ k: "back", s: 1 }]);
  assert.deepEqual(room.view(1).round.done, [false, false], "되찾으면 봇이 낸 손은 지운다");
});

test("끊기면 60초 지키고 봇이 잇는다(다른 사람이 있을 때만). 돌아오면 되찾는다", () => {
  const room = twoPlayers({ timer: 0 });
  assert.deepEqual(room.leave(B, T0), [{ k: "off", s: 1 }]);
  assert.deepEqual(room.view(0).seats[1], { kind: "human", name: "곰", face: null, on: false, until: T0 + GRACE_MS, ready: false });
  assert.equal(room.nextWake(), T0 + GRACE_MS);
  assert.deepEqual(room.tick(T0 + GRACE_MS - 1), []);
  assert.deepEqual(room.tick(T0 + GRACE_MS), [{ k: "bot", s: 1, why: "left" }]);
  assert.equal(room.view(0).round.done[1], true);
  assert.equal(room.nextWake(), null);
  assert.deepEqual(room.join(B, "곰", T0 + 90_000).evs, [{ k: "back", s: 1 }]);
  assert.equal(room.view(1).seats[1].kind, "human");

  // 둘 다 끊기면 아무도 안 바뀐다(알람도 없다)
  room.leave(A, T0 + 100_000);
  room.leave(B, T0 + 100_000);
  assert.equal(room.nextWake(), null);
  assert.deepEqual(room.tick(T0 + 1_000_000), []);
});

test("나가기(4001): 대기실이면 빈자리, 방장이 나가면 넘긴다. 경기 중이면 바로 봇", () => {
  const room = make();
  room.join(A, "여우", T0);
  room.join(B, "곰", T0);
  assert.deepEqual(room.leave(A, T0, true), [{ k: "gone", s: 0 }, { k: "host", s: 1 }]);
  assert.deepEqual(kinds(room), ["empty", "human"]);
  room.join(C, "새", T0);
  room.handle(B, "", { t: "start" }, T0);
  assert.deepEqual(room.leave(C, T0, true), [{ k: "bot", s: 0, why: "left" }]);
  assert.deepEqual(room.view(1).seats[0], { kind: "bot", bot: "human", name: "새" });
  assert.equal(room.join(C, "새", T0).seat, null, "스스로 나간 자리는 못 되찾는다(경기 중이라 구경꾼)");
});

test("대기실에서 끊긴 자리는 60초 뒤 빈다", () => {
  const room = make();
  room.join(A, "여우", T0);
  room.join(B, "곰", T0);
  room.leave(B, T0);
  assert.equal(room.nextWake(), T0 + GRACE_MS);
  assert.deepEqual(room.tick(T0 + GRACE_MS), [{ k: "gone", s: 1 }]);
  assert.deepEqual(kinds(room), ["human", "empty"]);
});

test("구경꾼 앉기와 이모트", () => {
  const room = make();
  room.join(A, "여우", T0);
  room.join(B, "곰", T0);
  room.join(C, "새", T0);
  assert.equal(failCode(() => room.handle(C, "새", { t: "sit" }, T0)), "full");
  room.leave(B, T0, true);
  assert.deepEqual(room.handle(C, "새", { t: "sit" }, T0).evs, [{ k: "join", s: 1 }]);
  assert.equal(failCode(() => room.handle(C, "새", { t: "sit" }, T0)), "phase");
  assert.deepEqual(room.handle(A, "", { t: "emote", e: "gg" }, T0), { evs: [], emote: { s: 0, e: "gg" } });
  assert.equal(failCode(() => room.handle(A, "", { t: "emote", e: "boo" }, T0)), "bad_request");
  assert.equal(failCode(() => room.handle("watcher_00000000000009", "", { t: "emote", e: "gg" }, T0)), "phase");
  assert.equal(failCode(() => room.handle(A, "", { t: "dance" }, T0)), "bad_request");
});

test("규칙을 바꾸면 자리 수가 바뀌고 사람은 남는다", () => {
  const room = make();
  room.join(A, "여우", T0);
  room.join(B, "곰", T0);
  room.handle(A, "", { t: "rules", rules: { game: "group", seats: 4, mode: "loser" } }, T0);
  assert.deepEqual(kinds(room), ["human", "human", "empty", "empty"]);
  room.join(C, "새", T0);
  room.leave(A, T0, true);
  assert.equal(room.s.host, 1);
  assert.equal(failCode(() => room.handle(B, "", { t: "rules", rules: { game: "group", seats: 3, base: "mukjjippa" } }, T0)), "bad_game");
  room.handle(B, "", { t: "rules", rules: { game: "classic" } }, T0);
  assert.deepEqual(kinds(room), ["human", "human"], "2번 자리 사람은 앞 빈자리로");
  assert.equal(room.s.host, 1);
  room.join(A, "여우", T0);
  assert.equal(room.view(null).seats.length, 2);
  room.handle(B, "", { t: "rules", rules: { game: "group", seats: 3 } }, T0);
  room.join(A, "여우", T0);
  assert.equal(failCode(() => room.handle(B, "", { t: "rules", rules: { game: "classic" } }, T0)), "bad_rules");
});

test("여럿이 가위바위보: 사람이 빠지면 봇끼리 끝까지 돈다", () => {
  const room = make({ game: "group", seats: 5 });
  room.join(A, "여우", T0);
  room.handle(A, "", { t: "start" }, T0);
  let v = room.view(0);
  assert.deepEqual(v.alive, [0, 1, 2, 3, 4]);
  assert.deepEqual(v.round.done, [false, true, true, true, true]);
  assert.equal(v.seats[1].bot, "random");
  assert.equal(v.score, null);
  for (let k = 0; k < 200 && room.s.phase === "play"; k++) thr(room, A, "rock");
  v = room.view(0);
  assert.equal(v.phase, "end");
  assert.equal(v.alive.length, 1);
  assert.equal(v.last, v.alive[0]);
  const lastRound = room.s.game.rounds.length;
  assert.ok(v.hist.length >= 1 && v.hist.length <= 20);
  assert.equal(v.hist[v.hist.length - 1].r, lastRound);
  for (const h of v.hist) assert.equal(h.hands.length, 5);
  for (const h of v.hist) assert.ok("lose" in h, "판마다 lose(술래 정하기에서 진 손, 없으면 null)");
});

test("여럿이 술래 정하기: hist 에 lose(가장 낮은 손)가 실린다", () => {
  const room = make({ game: "group", seats: 3, mode: "loser" });
  room.join(A, "여우", T0);
  room.join(B, "곰", T0);
  room.join(C, "새", T0);
  room.handle(A, "", { t: "start" }, T0);
  thr(room, A, "rock");
  thr(room, B, "rock");
  thr(room, C, "paper");
  const h = room.view(0).hist[0];
  assert.deepEqual([h.win, h.lose, h.out], ["paper", "rock", [2]]);
});

test("손 많은 바탕 여럿이: 점수 규칙으로 끝까지, 판마다 lose, 자리는 seatRange 까지", { skip: !MANY_HAND_GROUP && "MANY_HAND_GROUP 을 켜면 돈다" }, () => {
  const { max } = seatRange("rps101");
  assert.equal(failCode(() => make({ game: "group", base: "rps101", seats: max + 1 })), "bad_rules");
  for (const mode of ["survive", "loser"]) {
    const room = make({ game: "group", base: "rps101", mode, seats: max });
    room.join(A, "여우", T0);
    room.handle(A, "", { t: "start" }, T0);
    const V = room.V;
    for (let k = 0; k < 200 && room.s.phase === "play"; k++) thr(room, A, V.hands[k % V.n].id);
    const v = room.view(0);
    assert.equal(v.phase, "end", mode);
    assert.equal(v.alive.length, 1, mode);
    for (const h of v.hist) {
      assert.equal(h.hands.length, max, mode);
      assert.ok("lose" in h, mode);
    }
  }
});

test("들어올 때 앉는가(canSit): 제 자리, 대기실 빈자리는 앉고, 꽉 찼거나 경기 중이거나 랜덤 방이면 구경꾼", () => {
  const room = make();
  assert.equal(room.canSit(A), true, "방장 자리");
  assert.equal(room.canSit(B), true, "빈자리");
  room.join(A, "여우", T0);
  room.join(B, "곰", T0);
  assert.equal(room.canSit(C), false, "꽉 참");
  room.handle(A, "여우", { t: "start" }, T0);
  assert.equal(room.canSit(B), true, "경기 중에도 제 자리는");
  assert.equal(room.canSit(C), false);
  const rnd = Room.create({ code: "R2E2", rules: { game: "group", seats: 3 }, now: T0, seed: 1, reserve: [{ pid: A, name: "여우" }], random: true });
  assert.equal(rnd.canSit(A), true);
  assert.equal(rnd.canSit(B), false, "랜덤 방은 잡아 둔 사람만");
});

test("랜덤 방: 잡아 둔 두 사람이 다 오면 시작, 안 오면 15초 뒤 봇", () => {
  const reserve = [{ pid: A, name: "여우" }, { pid: B, name: "곰" }];
  const both = Room.create({ code: "R2D2", rules: { game: "rps101", format: "single" }, now: T0, seed: 1, reserve, random: true });
  assert.equal(both.view(null).random, true);
  assert.deepEqual(evKinds(both.join(A, "여우", T0).evs), ["back"]);
  assert.equal(both.join(C, "새", T0).seat, null, "남은 못 앉는다");
  assert.deepEqual(evKinds(both.join(B, "곰", T0).evs), ["back", "start"]);
  assert.equal(both.s.phase, "play");

  const one = Room.create({ code: "R2D3", rules: { game: "classic" }, now: T0, seed: 2, reserve, random: true });
  one.join(A, "여우", T0);
  assert.equal(one.nextWake(), T0 + MATCH_SHOW_MS);
  assert.deepEqual(evKinds(one.tick(T0 + MATCH_SHOW_MS)), ["start"]);
  assert.deepEqual(one.view(0).seats[1], { kind: "bot", bot: "human", name: "곰" });
  assert.deepEqual(one.join(B, "곰", T0 + 20_000).evs, [{ k: "back", s: 1 }], "늦게 와도 되찾는다");

  const solo = Room.create({ code: "R2D4", rules: { game: "classic" }, now: T0, seed: 3, reserve: [{ pid: A, name: "여우" }], random: true });
  assert.deepEqual(evKinds(solo.join(A, "여우", T0).evs), ["back", "start"]);
  assert.equal(solo.view(0).seats[1].kind, "bot");
});

test("끝없이도 999판에서 끝난다", () => {
  const room = make({ format: "endless", timer: 0, bot: "random" });
  room.join(A, "여우", T0);
  room.handle(A, "", { t: "start" }, T0);
  for (let k = 0; k < ENDLESS_MAX + 5 && room.s.phase === "play"; k++) thr(room, A, "rock");
  const v = room.view(0);
  assert.equal(v.phase, "end");
  assert.equal(room.s.game.rounds.length, ENDLESS_MAX);
  const [a, b] = v.score;
  assert.equal(v.winner, a > b ? 0 : b > a ? 1 : null);
});

test("대기실 준비: 자리 임자만, 대기실·끝에서만. 규칙 바뀜·시작·끝·끊김·다시 들어옴에 풀린다", () => {
  const room = make({ timer: 0, format: "single" });
  room.join(A, "여우", T0);
  room.join(B, "곰", T0);
  room.join(C, "새", T0);
  assert.deepEqual(room.handle(B, "곰", { t: "ready", on: true }, T0).evs, [{ k: "ready", s: 1, on: true }]);
  assert.deepEqual(room.handle(B, "곰", { t: "ready", on: true }, T0).evs, [], "같은 값이면 알림 없음");
  assert.equal(room.view(0).seats[1].ready, true);
  assert.equal(failCode(() => room.handle(C, "새", { t: "ready", on: true }, T0)), "phase", "구경꾼은 못 한다");
  assert.equal(failCode(() => room.handle(B, "곰", { t: "ready", on: "yes" }, T0)), "bad_request");
  room.handle(A, "여우", { t: "rules", rules: { format: "bo3" } }, T0);
  assert.equal(room.view(0).seats[1].ready, false, "규칙이 바뀌면 풀린다");

  room.handle(B, "곰", { t: "ready", on: true }, T0);
  room.leave(B, T0);
  assert.equal(room.view(0).seats[1].ready, false, "끊기면 풀린다");
  room.join(B, "곰", T0);
  room.handle(B, "곰", { t: "ready", on: true }, T0);
  room.join(B, "곰", T0);
  assert.equal(room.view(0).seats[1].ready, false, "다시 들어오면 풀린다");

  room.handle(B, "곰", { t: "ready", on: true }, T0);
  room.handle(A, "여우", { t: "start" }, T0);
  assert.equal(room.view(0).seats[1].ready, false, "시작하면 풀린다");
  assert.equal(failCode(() => room.handle(B, "곰", { t: "ready", on: true }, T0)), "phase", "경기 중에는 못 한다");
  for (let k = 0; k < 20 && room.s.phase === "play"; k++) {
    thr(room, A, "rock");
    thr(room, B, "scissors");
  }
  assert.equal(room.s.phase, "end");
  room.handle(B, "곰", { t: "ready", on: true }, T0);
  assert.equal(room.view(0).seats[1].ready, true, "끝 화면에서 다시 준비");
  room.handle(A, "여우", { t: "start" }, T0);
  for (let k = 0; k < 20 && room.s.phase === "play"; k++) {
    thr(room, A, "rock");
    thr(room, B, "scissors");
  }
  assert.equal(room.view(0).seats[1].ready, false, "끝나면 풀린다");
});

test("시간 초과로 봇에게 넘어간 자리는 그 사람이 무언가 보내면 돌아온다", () => {
  const room = twoPlayers({ timer: 10, format: "endless" });
  let now = T0;
  for (let k = 0; k < 3; k++) {
    thr(room, A, "rock", now);
    now = room.nextWake();
    room.tick(now);
  }
  assert.equal(room.view(0).seats[1].kind, "bot");
  assert.equal(failCode(() => thr(room, B, "rock", now)), "phase", "돌려받기 전에는 못 낸다");
  assert.deepEqual(room.reclaim(B, "곰", now), [{ k: "back", s: 1 }]);
  assert.deepEqual(room.reclaim(B, "곰", now), [], "두 번은 없다");
  assert.deepEqual(room.reclaim(C, "새", now), [], "남의 자리는 안 된다");
  assert.equal(room.view(1).seats[1].kind, "human");
  assert.deepEqual(evKinds(thr(room, B, "paper", now).evs), ["throw"]);
});

const pair = [{ pid: A, name: "여우" }, { pid: B, name: "곰" }];
/** A·B 가 랜덤 매칭으로 잡혀 둘 다 들어온(바로 시작한) 방 */
function randomPair(rules = {}, seed = 9) {
  const room = Room.create({ code: "R2D9", rules: { game: "classic", format: "single", ...rules }, now: T0, seed, reserve: pair, random: true });
  room.join(A, "여우", T0);
  room.join(B, "곰", T0);
  return room;
}

test("랭킹: 랜덤 방 첫 경기만 센다. 이긴 쪽 1, 이름은 끝날 때 이름, 다시 하기는 안 센다", () => {
  const room = randomPair();
  assert.equal(room.s.phase, "play");
  assert.deepEqual(room.view(0).rank, { after: null, skip: false });
  assert.equal(room.takeRank(), null, "끝나기 전엔 없다");
  room.join(A, "붉은여우", T0);
  thr(room, A, "rock");
  thr(room, B, "scissors");
  assert.equal(room.s.phase, "end");
  assert.deepEqual(room.takeRank(), { game: "classic", a: { pid: A, name: "붉은여우", face: null, home: null }, b: { pid: B, name: "곰", face: null, home: null }, score: 1 });
  assert.equal(room.takeRank(), null, "한 번만");
  for (const you of [0, 1, null]) assert.ok(!JSON.stringify(room.view(you)).includes("player"), "방 꼴에 pid 는 안 실린다");
  room.handle(A, "붉은여우", { t: "start" }, T0);
  assert.equal(room.s.phase, "play");
  assert.equal(room.view(0).rank, null, "다시 하기는 랭킹 경기가 아니다");
  assert.equal(twoPlayers().view(0).rank, null, "보통 방도 아니다");
});

test("랭킹: 대기열이 같은 곳(IP)에서 온 두 사람이라고 하면 랜덤 방이라도 안 센다", () => {
  const room = Room.create({ code: "R2E1", rules: { game: "classic", format: "single" }, now: T0, seed: 9, reserve: pair, random: true, ranked: false });
  room.join(A, "여우", T0);
  room.join(B, "곰", T0);
  assert.equal(room.s.phase, "play");
  assert.equal(room.view(0).random, true);
  assert.equal(room.view(0).rank, null);
  thr(room, A, "rock");
  thr(room, B, "scissors");
  assert.equal(room.takeRank(), null);
});

test("랭킹: 끝날 때 봇이 잇던 자리(나감·안 옴)는 진다. 둘 다면 안 센다. 봇 대전은 안 센다", () => {
  const left = randomPair({ format: "bo3" });
  left.leave(A, T0, true);
  assert.equal(left.view(1).seats[0].kind, "bot");
  for (let k = 0; k < 60 && left.s.phase === "play"; k++) thr(left, B, "rock");
  assert.equal(left.s.phase, "end");
  assert.deepEqual(left.takeRank(), { game: "classic", a: { pid: A, name: "여우", face: null, home: null }, b: { pid: B, name: "곰", face: null, home: null }, score: 0 }, "봇이 이겨도 나간 사람이 진다");

  const noShow = Room.create({ code: "R2D5", rules: { game: "rps101", format: "single" }, now: T0, seed: 5, reserve: pair, random: true });
  noShow.join(A, "여우", T0);
  noShow.tick(T0 + MATCH_SHOW_MS);
  for (let k = 0; k < 60 && noShow.s.phase === "play"; k++) thr(noShow, A, "rock", T0 + MATCH_SHOW_MS);
  const due = noShow.takeRank();
  assert.equal(due.game, "rps101");
  assert.equal(due.score, 1, "안 온 사람이 진다");
  assert.equal(due.b.pid, B);

  const both = randomPair({}, 11);
  thr(both, A, "rock");
  thr(both, B, "scissors");
  both.s.seats = both.s.seats.map((x) => ({ kind: "bot", bot: "human", pid: null, name: x.name, why: "left" }));
  assert.equal(both.takeRank(), null);
  assert.deepEqual(both.view(null).rank, { after: null, skip: true });

  const solo = Room.create({ code: "R2D6", rules: { game: "classic", format: "single" }, now: T0, seed: 6, reserve: [pair[0]], random: true });
  solo.join(A, "여우", T0);
  assert.equal(solo.s.phase, "play");
  assert.equal(solo.view(0).rank, null, "봇 대전");
});

test("프로필 그림: 사람 자리 face, 다시 들어오면 바뀌고, 랜덤 방 예약·랭킹 결과에도 이어진다", () => {
  const room = Room.create({ code: "F4C3", rules: { game: "classic" }, now: T0, seed: 3, host: { pid: A, name: "여우", face: "fox" } });
  assert.equal(room.view(0).seats[0].face, "fox");
  room.join(A, "여우", T0, "king");
  room.join(B, "곰", T0);
  assert.deepEqual(room.view(null).seats.map((x) => x.face), ["king", null]);
  room.join(B, "곰", T0, "bear");
  assert.equal(room.view(0).seats[1].face, "bear");

  const faces = [{ pid: A, name: "여우", face: "fox" }, { pid: B, name: "곰", face: "bear" }];
  const rnd = Room.create({ code: "F4C4", rules: { game: "classic", format: "single" }, now: T0, seed: 4, reserve: faces, random: true });
  rnd.join(A, "여우", T0, "fox");
  rnd.join(B, "곰", T0, "bear");
  rnd.leave(B, T0, true);
  assert.equal(rnd.view(0).seats[1].kind, "bot");
  assert.ok(!("face" in rnd.view(0).seats[1]), "봇 자리에는 그림을 안 싣는다");
  for (let k = 0; k < 60 && rnd.s.phase === "play"; k++) thr(rnd, A, "rock");
  const due = rnd.takeRank();
  assert.deepEqual(due.a, { pid: A, name: "여우", face: "fox", home: null });
  assert.deepEqual(due.b, { pid: B, name: "곰", face: "bear", home: null }, "나간 사람은 시작 때 그림");
});

test("같은 곳 꼬리표: 대기열이 준 home 은 순위 결과까지 이어지고 꼴에는 안 나간다", () => {
  const room = Room.create({ code: "H0M3", rules: { game: "classic", format: "single" }, now: T0, seed: 4, reserve: [{ pid: A, name: "여우", home: "aaaa1111" }, { pid: B, name: "곰", home: "bbbb2222" }], random: true });
  room.join(A, "여우", T0);
  room.join(B, "곰", T0);
  for (const k of [0, 1, null]) assert.ok(!JSON.stringify(room.view(k)).includes("aaaa1111"), "꼴에 꼬리표 없음");
  thr(room, A, "rock");
  thr(room, B, "scissors");
  const due = room.takeRank();
  assert.deepEqual([due.a.home, due.b.home], ["aaaa1111", "bbbb2222"]);
  assert.equal(room.s.homes, null, "시작하면 방 상태에서는 지운다");
});
