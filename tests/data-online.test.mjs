// 온라인 게임 목록(web/js/data/online.js). 화면과 서버가 같이 쓰는 목록이라 도감과 맞는지 본다.

import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG, findEntry } from "../web/js/data/catalog.js";
import { compileVariant, groupWinner } from "../web/js/core/engine.js";
import { setLang } from "../web/js/i18n.js";
import { ONLINE_KINDS, onlineGames, groupBases, isOnlineGame, isOneHand, isGroupBase } from "../web/js/data/online.js";

const oneHand = () => CATALOG.filter((e) => e.kind === "matrix").map((e) => e.id);

test("종류마다 고를 수 있는 게임", () => {
  const one = oneHand();
  assert.ok(one.includes("classic") && one.includes("rps101"));
  assert.deepEqual(onlineGames("challenge"), [...one, "custom"]);
  assert.deepEqual(onlineGames("room"), [...one, "custom", "group"]);
  assert.deepEqual(onlineGames("random"), one);
  assert.throws(() => onlineGames("tournament"));
});

test("목록의 id 는 모두 도감에 있다", () => {
  for (const kind of ONLINE_KINDS) {
    for (const id of onlineGames(kind)) assert.ok(findEntry(id), `${kind}: ${id}`);
  }
  assert.equal(findEntry("custom").kind, "custom");
  assert.equal(findEntry("group").kind, "game");
});

test("여럿이 가위바위보 바탕은 손 셋 고리", () => {
  const bases = groupBases();
  assert.equal(bases[0], "classic");
  assert.deepEqual(bases, CATALOG.filter(isGroupBase).map((e) => e.id));
  for (const id of bases) {
    const V = compileVariant(findEntry(id));
    assert.equal(V.n, 3, id);
    for (let a = 0; a < 3; a++) {
      const wins = [0, 1, 2].filter((b) => V.cmp(a, b) > 0).length;
      const losses = [0, 1, 2].filter((b) => V.cmp(a, b) < 0).length;
      assert.deepEqual([wins, losses], [1, 1], `${id}: 손 ${a} 는 하나를 이기고 하나에 져야 한다`);
    }
    // 한 가지만 나오거나 세 가지가 다 나오면 비기고, 두 가지만 나오면 이긴 손이 정해진다
    assert.equal(groupWinner(V, [0, 0, 0]), null);
    assert.equal(groupWinner(V, [0, 1, 2, 1]), null);
    const w = groupWinner(V, [0, 1, 1]);
    assert.ok(w === 0 || w === 1, id);
    assert.ok(V.cmp(w, w === 0 ? 1 : 0) > 0, id);
  }
});

test("isOnlineGame·isOneHand", () => {
  assert.ok(isOnlineGame("room", "group"));
  assert.ok(isOnlineGame("challenge", "custom"));
  assert.ok(isOnlineGame("random", "rps101"));
  assert.ok(!isOnlineGame("challenge", "group"));
  assert.ok(!isOnlineGame("random", "custom"));
  assert.ok(!isOnlineGame("room", "mukjjippa"));
  assert.ok(!isOnlineGame("room", 3));
  assert.ok(isOneHand(findEntry("rpsls")));
  assert.ok(!isOneHand(findEntry("group")) && !isOneHand(null));
});

test("화면 언어가 바뀌어도 목록은 같다", () => {
  const before = ONLINE_KINDS.map(onlineGames);
  const bases = groupBases();
  setLang("en", { persist: false });
  try {
    assert.deepEqual(ONLINE_KINDS.map(onlineGames), before);
    assert.deepEqual(groupBases(), bases);
  } finally {
    setLang("ko", { persist: false });
  }
});
