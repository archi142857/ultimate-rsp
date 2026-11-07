// 온라인에서 할 수 있는 게임(온라인 규약 1.3). 도전장은 도감의 matrix 변종 19가지와 직접 만들기(custom: {n, k, seed}).
// 서버(server/src/games.js)와 같은 규칙이다. 컨셉이 web/js/data/online.js 로 공용 목록을 두면 그것으로 바꾼다.

import { CATALOG, findEntry } from "../data/catalog.js";
import { makeCustomDef } from "../data/custom.js";
import { compileVariant } from "../core/engine.js";

export const isChallengeGame = (entry) => !!entry && entry.kind === "matrix";

/** 도전장으로 보낼 수 있는 도감 변종. 도감 차례 그대로이고 언어가 바뀌면 이름도 바뀐다 */
export function challengeGames() {
  return CATALOG.filter(isChallengeGame);
}

export function challengeGame(id) {
  const e = findEntry(id);
  return isChallengeGame(e) ? e : null;
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
