// 온라인에서 고를 수 있는 게임. 목록은 컨셉의 공용 모듈 web/js/data/online.js(온라인 규약 1.3)를 쓴다.
// 서버(server/src/games.js)도 같은 목록을 본다. 여기는 화면이 쓰기 좋게 도감 항목(언어 따라 이름이 바뀐다)으로 바꿔 준다.
//  - 도전장: 손 하나짜리 변종 + 직접 만들기(custom). 만들기 화면은 아직 변종만 고르게 하고, 받기는 custom 까지 연다
//  - 방: 위 + 여럿이 가위바위보(group, 바탕은 groupBases)
//  - 랜덤 매칭: 손 하나짜리 변종만

import { findEntry } from "../data/catalog.js";
import { makeCustomDef } from "../data/custom.js";
import { compileVariant } from "../core/engine.js";
import { onlineGames, isOnlineGame, isOneHand } from "../data/online.js";

const entries = (ids) => ids.map(findEntry).filter(Boolean);

/** 도전장 만들기에서 고를 수 있는 도감 변종(도감 차례) */
export function challengeGames() {
  return entries(onlineGames("challenge")).filter(isOneHand);
}

export const isChallengeGame = (entry) => !!entry && isOneHand(entry) && isOnlineGame("challenge", entry.id);

export function challengeGame(id) {
  const e = findEntry(id);
  return isChallengeGame(e) ? e : null;
}

/** 랜덤 매칭에서 고를 수 있는 변종 */
export function randomGames() {
  return entries(onlineGames("random"));
}

export function randomGame(id) {
  return isOnlineGame("random", id) ? findEntry(id) : null;
}

/** 방에서 고를 수 있는 게임 id(직접 만들기는 아직 화면에 고르는 칸이 없어 뺀다. 남이 정한 custom 방은 보인다) */
export function roomGameIds() {
  return onlineGames("room").filter((id) => id !== "custom");
}

/** 서버가 준 game(·custom)으로 판정 자료 V 를 만든다. 모르는 게임이면 null(화면이 오래됐다) */
export function variantOf(game, custom = null) {
  if (game === "custom") {
    if (!custom || ![custom.n, custom.k, custom.seed].every(Number.isInteger)) return null;
    return compileVariant(makeCustomDef(custom));
  }
  const e = challengeGame(game);
  return e ? compileVariant(e) : null;
}
