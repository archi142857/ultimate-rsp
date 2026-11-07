// 서버가 받는 게임 목록과 판정 자료. 도감(web/js/data/catalog.js)을 그대로 쓰는지 본다.

import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../../web/js/data/catalog.js";
import { matrixIds, groupBaseIds, resolveVariant, handIndex, normCustom, normRules, warmUp } from "../src/games.js";
import { Fail } from "../src/http.js";

const failCode = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof Fail, `Fail 이 아닌 오류: ${e}`);
    return e.code;
  }
  return null;
};

test("도감의 손 하나짜리 변종은 모두 온라인으로 고를 수 있다", () => {
  const ids = matrixIds();
  assert.ok(ids.includes("classic") && ids.includes("rps101"));
  for (const id of ids) {
    const { game, custom, V } = resolveVariant(id);
    assert.equal(game, id);
    assert.equal(custom, null);
    assert.ok(V.n >= 3);
  }
  assert.equal(ids.length, CATALOG.filter((e) => e.kind === "matrix").length);
});

test("묵찌빠 같은 놀이·시뮬레이션·없는 id 는 bad_game", () => {
  for (const id of ["mukjjippa", "group", "league", "custom", "nope", undefined, 3]) {
    assert.equal(failCode(() => resolveVariant(id)), "bad_game", String(id));
  }
});

test("같은 변종은 한 번만 컴파일한다(미리 컴파일한 것을 꺼내 쓴다)", () => {
  warmUp();
  assert.equal(resolveVariant("rps101").V, resolveVariant("rps101").V);
  const c = { n: 11, k: 5, seed: 3 };
  assert.equal(resolveVariant("custom", c).V, resolveVariant("custom", { ...c }).V);
});

test("직접 만들기: 값 검사와 손 id", () => {
  const { game, custom, V } = resolveVariant("custom", { n: 7, k: 3, seed: 12345 });
  assert.equal(game, "custom");
  assert.deepEqual(custom, { n: 7, k: 3, seed: 12345 });
  assert.equal(V.n, 7);
  assert.deepEqual(V.hands.map((h) => h.id), ["h1", "h2", "h3", "h4", "h5", "h6", "h7"]);
  assert.equal(failCode(() => normCustom({ n: 2, k: 1, seed: 1 })), "bad_game");
  assert.equal(failCode(() => normCustom({ n: 102, k: 1, seed: 1 })), "bad_game");
  assert.equal(failCode(() => normCustom({ n: 8, k: 4, seed: 1 })), "bad_game");
  assert.equal(failCode(() => normCustom({ n: 7, k: 0, seed: 1 })), "bad_game");
  assert.equal(failCode(() => normCustom({ n: 7, k: 3, seed: -1 })), "bad_game");
  assert.equal(failCode(() => normCustom({ n: 7, k: 3, seed: 1.5 })), "bad_game");
  assert.equal(failCode(() => normCustom(null)), "bad_game");
  assert.ok(resolveVariant("custom", { n: 101, k: 50, seed: 4294967295 }).V.n === 101);
});

test("손 id → 번호, 없는 손은 bad_hand", () => {
  const { V } = resolveVariant("classic");
  assert.equal(V.hands[handIndex(V, "rock")].id, "rock");
  for (const bad of ["stone", "__proto__", "constructor", 0, null]) {
    assert.equal(failCode(() => handIndex(V, bad)), "bad_hand", String(bad));
  }
});

test("여럿이 가위바위보 바탕은 손이 셋인 변종", () => {
  const ids = groupBaseIds();
  assert.ok(ids.includes("classic"));
  for (const id of ids) assert.equal(resolveVariant(id).V.n, 3);
});

test("게임 목록은 공용 목록(web/js/data/online.js)을 따른다", async () => {
  const { onlineGames, groupBases } = await import("../../web/js/data/online.js");
  assert.deepEqual(matrixIds(), onlineGames("random"));
  assert.deepEqual(groupBaseIds(), groupBases());
  assert.equal(groupBaseIds().length, 8);
  for (const id of onlineGames("room")) {
    const rules = id === "custom" ? { game: id, custom: { n: 5, k: 2, seed: 1 } } : { game: id };
    assert.equal(normRules(rules).game, id);
  }
  for (const id of onlineGames("challenge")) assert.ok(id === "custom" || matrixIds().includes(id));
});
