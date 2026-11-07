// 온라인 대전에서 고를 수 있는 게임(온라인 규약 1.3). 화면(web/js/online)과 서버(server/src)가 같이 import 한다.
// 도감에서 끌어오므로 변종을 더하면 여기도 따라간다. 값은 게임 id 라 화면 언어와 상관없다.

import { CATALOG } from "./catalog.js";

/** 온라인 대전 종류: 도전장(공유 링크), 방, 랜덤 매칭 */
export const ONLINE_KINDS = ["challenge", "room", "random"];

/** 손 하나 내고 바로 판정하는 도감 변종(kind matrix) */
export function isOneHand(entry) {
  return !!entry && entry.kind === "matrix";
}

/**
 * 여럿이 가위바위보의 바탕이 될 수 있는 변종: 손이 셋인 matrix.
 * 도감의 손 셋 변종은 모두 세 손 고리(손마다 하나를 이기고 하나에 진다)라 groupWinner 가 그대로 맞는다.
 */
export function isGroupBase(entry) {
  return isOneHand(entry) && entry.hands.length === 3;
}

const oneHandIds = () => CATALOG.filter(isOneHand).map((e) => e.id);

/** 여럿이 가위바위보 바탕 변종 id(도감 차례, 맨 앞이 classic) */
export function groupBases() {
  return CATALOG.filter(isGroupBase).map((e) => e.id);
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
