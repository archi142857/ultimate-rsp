// 여럿이 가위바위보 대기열이 할 일(queue.js). 대기열 DO 는 이 값대로 시작·알람을 정한다.

import test from "node:test";
import assert from "node:assert/strict";
import { groupDue, groupPlan, groupSeatRange, groupSeatsWithBots } from "../src/queue.js";
import { GROUP_MATCH_WAIT_MS, GROUP_SEATS } from "../src/protocol.js";
import { normRules } from "../src/games.js";
import { GROUP_SEATS_MAX } from "../../web/js/data/online.js";

const R = { min: 3, max: 10 };
const NOW = 1_800_000_000_000;

test("대기열 자리 범위는 게임마다(컨셉 seatRange): 손 셋은 3–8, 손 많은 바탕은 GROUP_SEATS_MAX, 바탕이 아니면 GROUP_SEATS", () => {
  assert.deepEqual(groupSeatRange("classic"), { min: 3, max: 8 });
  assert.deepEqual(groupSeatRange("rps101"), { min: 3, max: GROUP_SEATS_MAX });
  assert.deepEqual(groupSeatRange("mukjjippa"), { min: GROUP_SEATS.min, max: GROUP_SEATS.max });
  assert.deepEqual(groupPlan(GROUP_SEATS_MAX, groupSeatRange("rps101"), null, NOW), { start: GROUP_SEATS_MAX, alarm: null });
});

test("최대 인원이 차면 바로, 최소 인원이면 알람(이미 걸려 있으면 그대로), 모자라면 알람 없음", () => {
  assert.deepEqual(groupPlan(10, R, null, NOW), { start: 10, alarm: null });
  assert.deepEqual(groupPlan(12, R, NOW + 5, NOW), { start: 10, alarm: null }, "넘치면 먼저 온 열 명");
  assert.deepEqual(groupPlan(3, R, null, NOW), { start: 0, alarm: NOW + GROUP_MATCH_WAIT_MS });
  assert.deepEqual(groupPlan(5, R, NOW + 3000, NOW), { start: 0, alarm: NOW + 3000 }, "사람이 더 와도 시작 시각은 안 미룬다");
  assert.deepEqual(groupPlan(2, R, NOW + 3000, NOW), { start: 0, alarm: null }, "최소 아래로 떨어지면 지운다");
  assert.deepEqual(groupPlan(0, R, null, NOW), { start: 0, alarm: null });
});

test("알람: 최소 인원이 있으면 최대 인원까지 데려간다", () => {
  assert.equal(groupDue(2, R), 0);
  assert.equal(groupDue(3, R), 3);
  assert.equal(groupDue(7, R), 7);
  assert.equal(groupDue(14, R), 10);
});

test("봇과 하기: 모인 사람 수(최소 인원 이상, 최대 인원 이하)로 자리를 잡는다", () => {
  assert.equal(groupSeatsWithBots(1, R), 3);
  assert.equal(groupSeatsWithBots(2, R), 3);
  assert.equal(groupSeatsWithBots(6, R), 6);
  assert.equal(groupSeatsWithBots(15, R), 10);
});

test("대기열이 만드는 방 규칙은 방 규칙 검사를 지난다", () => {
  for (const seats of [3, 6, 8]) {
    const r = normRules({ game: "group", base: "classic", mode: "loser", seats, timer: 20, bot: "human" });
    assert.equal(r.seats, seats);
    assert.equal(r.mode, "loser");
  }
});
