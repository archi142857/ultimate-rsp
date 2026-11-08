// 여럿이 가위바위보 대기열이 할 일(순수 모듈, 시험이 바로 쓴다). 저장·연결은 match-do.js 가 한다.
// 최대 인원이 차면 바로 시작, 최소 인원이 모이면 GROUP_MATCH_WAIT_MS 동안 사람을 더 받은 뒤 그때 모인 사람으로 시작.

import { GROUP_MATCH_WAIT_MS } from "./protocol.js";
import { groupSeatRange } from "./games.js";

export { groupSeatRange };

/**
 * 기다리는 사람 n 명일 때. alarm 은 걸어 둔 시작 시각(없으면 null).
 * 돌려주는 값: { start: 지금 데려갈 사람 수(0 이면 안 함), alarm: 걸어 둘 시작 시각(null 이면 지움) }
 */
export function groupPlan(n, { min, max }, alarm, now, wait = GROUP_MATCH_WAIT_MS) {
  if (n >= max) return { start: max, alarm: null };
  if (n >= min) return { start: 0, alarm: alarm ?? now + wait };
  return { start: 0, alarm: null };
}

/** 알람이 울렸을 때: 최소 인원이 있으면 최대 인원까지 데려간다 */
export function groupDue(n, { min, max }) {
  return n >= min ? Math.min(n, max) : 0;
}

/** 봇과 하기: 지금 기다리는 사람을 다(최대 인원까지) 데려가고 모자란 자리는 봇. 자리 수 */
export function groupSeatsWithBots(n, { min, max }) {
  return Math.min(max, Math.max(min, n));
}
