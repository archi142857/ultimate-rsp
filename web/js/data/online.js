// 온라인 대전에서 고를 수 있는 게임(온라인 규약 1.3). 화면(web/js/online)과 서버(server/src)가 같이 import 한다.
// 도감에서 끌어오므로 변종을 더하면 여기도 따라간다. 값은 게임 id 라 화면 언어와 상관없다.

import { CATALOG, findEntry } from "./catalog.js";
import { groupThrows } from "../core/engine.js";

/** 온라인 대전 종류: 도전장(공유 링크), 방, 랜덤 매칭 */
export const ONLINE_KINDS = ["challenge", "room", "random"];

/** 손 하나 내고 바로 판정하는 도감 변종(kind matrix) */
export function isOneHand(entry) {
  return !!entry && entry.kind === "matrix";
}

/**
 * 손이 셋보다 많은 변종도 여럿이 바탕으로 연다(11-08 사용자 '모든 변종을 방에서 여럿이').
 * 서버(seatRange·진 손 lose)와 화면이 준비되면 true 로 바꾼다. 그 전에도 { manyHands: true } 를 넘기면 늘어난 목록을 본다
 */
export const MANY_HAND_GROUP = true;

/**
 * 여럿이 가위바위보의 바탕이 될 수 있는 변종: 손 하나짜리 변종(MANY_HAND_GROUP 이 false 면 손이 셋인 것만).
 * 손 셋 변종은 모두 세 손 고리(손마다 하나를 이기고 하나에 진다)라 보통 규칙(rps)이 맞고, 손이 더 많으면 점수 규칙(score)으로 한다
 * (games/group.js 의 defaultGroupRule). group: false 를 단 변종은 바탕에서 뺀다(지금은 없다).
 */
export function isGroupBase(entry, { manyHands = MANY_HAND_GROUP } = {}) {
  return isOneHand(entry) && entry.group !== false && (manyHands || entry.hands.length === 3);
}

const oneHandIds = () => CATALOG.filter(isOneHand).map((e) => e.id);

/** 여럿이 가위바위보 바탕 변종 id(도감 차례, 맨 앞이 classic) */
export function groupBases(opts) {
  return CATALOG.filter((e) => isGroupBase(e, opts)).map((e) => e.id);
}

/** 여럿이 바탕 id 의 규칙: 손 셋이면 "rps"(보통 규칙), 손이 더 많으면 "score"(점수). 바탕이 될 수 없는 id 면 null */
export function groupRuleOf(id) {
  const e = typeof id === "string" ? findEntry(id) : null;
  if (!isGroupBase(e, { manyHands: true })) return null;
  return e.hands.length === 3 ? "rps" : "score";
}

/**
 * 여럿이 한 방에 앉을 수 있는 사람 수의 바닥과 천장(둘이면 보통 대전이다).
 * 천장 20: 백엔드가 재 보니 50명 방은 손 하나 낼 때마다 14KB 방 꼴을 56곳에 보내 폰에 무거웠다(20명이면 6.4KB, 11-08 23:47).
 * 판정은 50명도 금방 끝난다. 여럿이 도전장 max(50)는 서버가 따로 정한다
 */
export const GROUP_SEATS_MIN = 3;
export const GROUP_SEATS_MAX = 20;
/** 모두 아무렇게나 낼 때 한 경기가 평균 이만큼 안에 끝나는 인원까지 연다(한 번 내는 데 5초쯤이면 1분 남짓) */
export const GROUP_THROWS_MAX = 15;

/**
 * 여럿이 바탕 id 마다 앉을 수 있는 사람 수 { min, max }. 바탕이 될 수 없는 id 면 null.
 *  - 손 셋(보통 규칙): 세 가지가 다 나오면 다시라 사람이 늘면 끝이 안 난다. 평균 판 수(groupThrows)가 GROUP_THROWS_MAX 안인 8명까지
 *    (8명 평균 12.1번, 9명 17.1번, 10명 24.4번)
 *  - 손이 더 많음(점수 규칙): 50명이 해도 평균 5번 안에 끝난다(tests/group-score.test.mjs 가 본다). 그래서 방 무게로 정한 GROUP_SEATS_MAX 까지
 */
export function seatRange(id) {
  const rule = groupRuleOf(id);
  if (rule === null) return null;
  if (rule === "score") return { min: GROUP_SEATS_MIN, max: GROUP_SEATS_MAX };
  let max = GROUP_SEATS_MIN;
  while (max < GROUP_SEATS_MAX && groupThrows(max + 1) <= GROUP_THROWS_MAX) max += 1;
  return { min: GROUP_SEATS_MIN, max };
}

/**
 * kind 에서 고를 수 있는 게임 id(도감 차례).
 *  - challenge: 손 하나짜리 변종 + "custom"(직접 만들기)
 *  - room:      손 하나짜리 변종(둘이서) + "custom"(둘이서) + "group"(여럿이 가위바위보, 바탕은 groupBases())
 *  - random:    손 하나짜리 변종. 직접 만들기는 판이 끝없이 많아 대기열을 나눌 수 없어서 뺀다
 */
export function onlineGames(kind) {
  switch (kind) {
    case "challenge":
      return [...oneHandIds(), "custom"];
    case "room":
      return [...oneHandIds(), "custom", "group"];
    case "random":
      return oneHandIds();
    default:
      throw new Error(`모르는 온라인 종류: ${kind}`);
  }
}

/** id 가 kind 에서 고를 수 있는 게임인가 */
export function isOnlineGame(kind, id) {
  return typeof id === "string" && onlineGames(kind).includes(id);
}
