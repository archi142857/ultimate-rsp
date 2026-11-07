// node --test 로 돈다. 도전장: 서버 답 읽기, 할 수 있는 게임, 이 브라우저의 기록, 링크, 문구.

import test from "node:test";
import assert from "node:assert/strict";

// 브라우저의 저장소와 주소를 흉내 낸다(모듈을 불러오기 전에)
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
globalThis.location = { origin: "https://archi142857.github.io", pathname: "/ultimate-rsp/", search: "" };

const { readChallenge } = await import("../web/js/online/api.js");
const { challengeGames, challengeGame, variantOf } = await import("../web/js/online/games.js");
const { myChallenges, myChallenge, rememberChallenge, MINE_MAX } = await import("../web/js/online/mine.js");
const { shareLink } = await import("../web/js/online/config.js");
const { parseOnline } = await import("../web/js/online/ids.js");
const { errorText } = await import("../web/js/online/messages.js");
const { ago } = await import("../web/js/online/common.js");
const { setLang } = await import("../web/js/i18n.js");
const { CATALOG } = await import("../web/js/data/catalog.js");
const { compileVariant } = await import("../web/js/core/engine.js");

const HANGUL = /[ㄱ-ㆎ가-힣]/;

test("서버 답 읽기(규약 2장): 열린 것은 손이 없고, 닫힌 것은 두 손과 서버 판정", () => {
  const open = readChallenge({ code: "7KQ2M9XA", game: "classic", custom: null, rounds: 1, from: " 날쌘\n여우 42 ", e: "hi", made: 1, expires: 5, open: true, now: 1 });
  assert.deepEqual(open, { code: "7KQ2M9XA", game: "classic", custom: null, rounds: 1, from: "날쌘 여우 42", e: "hi", expires: 5, open: true });
  assert.ok(!("hands" in open));
  const closed = readChallenge({
    code: "7KQ2M9XA", game: "classic", custom: null, rounds: 1, from: "a", open: false, to: "느린 곰 7", answered: 9,
    hands: { from: ["rock"], to: ["paper"] }, cmp: [-1], score: [0, 1], winner: 1,
  });
  assert.deepEqual(closed.hands, { from: ["rock"], to: ["paper"] });
  assert.deepEqual([closed.cmp, closed.score, closed.winner, closed.to], [[-1], [0, 1], 1, "느린 곰 7"]);
  const custom = readChallenge({ code: "X", game: "custom", custom: { n: 5, k: 2, seed: 7, extra: 1 }, rounds: 1, from: "a", open: true });
  assert.deepEqual(custom.custom, { n: 5, k: 2, seed: 7 });
  const base = { code: "X", game: "classic", rounds: 1, from: "a" };
  for (const bad of [
    null,
    {},
    { ...base, open: "yes" },
    { ...base, open: true, rounds: 2 },
    { ...base, open: false },
    { ...base, open: false, hands: { from: ["rock"], to: [] }, cmp: [1], score: [1, 0], winner: 0 },
    { ...base, open: false, hands: { from: ["rock"], to: ["paper"] }, cmp: [2], score: [1, 0], winner: 0 },
    { ...base, open: false, hands: { from: ["rock"], to: ["paper"] }, cmp: [1], score: [1, 0], winner: 3 },
  ])
    assert.throws(() => readChallenge(bad), (e) => e.code === "bad_reply", JSON.stringify(bad));
});

test("서버가 준 게임으로 판정 자료를 만든다(직접 만들기 포함)", () => {
  assert.equal(variantOf("classic").n, 3);
  const V = variantOf("custom", { n: 5, k: 2, seed: 7 });
  assert.equal(V.n, 5);
  assert.deepEqual(V.hands.map((x) => x.id), ["h1", "h2", "h3", "h4", "h5"]);
  assert.equal(variantOf("custom", null), null);
  assert.equal(variantOf("mukjjippa"), null);
});

test("도전장 게임: 한 번 내고 끝나는 도감 변종만", () => {
  const list = challengeGames();
  assert.equal(list.length, CATALOG.filter((e) => e.kind === "matrix").length);
  assert.ok(list.length >= 19);
  for (const e of list) {
    const V = compileVariant(e);
    assert.ok(V.n >= 3, e.id);
  }
  assert.ok(challengeGame("classic") && challengeGame("rps101"));
  for (const id of ["custom", "mukjjippa", "group", "league", "nope", ""]) assert.equal(challengeGame(id), null, id);
});

test("이 브라우저의 도전장 기록: 새것이 앞, 같은 번호는 하나, 30개까지", () => {
  mem.clear();
  assert.deepEqual(myChallenges(), []);
  rememberChallenge({ id: "a1", role: "maker", game: "classic", hand: "rock", at: 1 });
  rememberChallenge({ id: "b2", role: "taker", game: "rpsls", hand: "spock", at: 2 });
  rememberChallenge({ id: "a1", role: "maker", game: "classic", hand: "rock", at: 3 });
  assert.deepEqual(
    myChallenges().map((r) => r.id),
    ["a1", "b2"],
  );
  assert.equal(myChallenge("b2").hand, "spock");
  assert.equal(myChallenge("zz"), null);
  rememberChallenge({ id: "c3", role: "taker", game: "custom", hand: "h2", at: 4, label: "RPS-5" });
  assert.equal(myChallenge("c3").label, "RPS-5");
  rememberChallenge({ id: "bad", role: "spy", game: "classic", hand: "rock" });
  assert.equal(myChallenge("bad"), null, "모르는 역할은 남기지 않는다");
  for (let i = 0; i < MINE_MAX + 5; i++) rememberChallenge({ id: `n${i}`, role: "maker", game: "classic", hand: "rock", at: 10 + i });
  assert.equal(myChallenges().length, MINE_MAX);
  mem.set("ursp.online.challenges", "망가진 값");
  assert.ok(myChallenges().every((r) => r.id.startsWith("n") || r.id === "a1" || r.id === "b2"), "망가진 저장값은 버리고 이 창의 기록만");
  // 저장이 막혀도 이 창에서 만든 것은 알아본다
  const realSet = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error("막힘");
  };
  try {
    rememberChallenge({ id: "private1", role: "maker", game: "classic", hand: "paper", at: 999 });
    assert.equal(myChallenge("private1").hand, "paper");
  } finally {
    localStorage.setItem = realSet;
  }
});

test("링크: 번호만 담고, 시험 서버일 때만 ?server= 를 붙인다", () => {
  assert.equal(shareLink("/c/7KQ2M9XA"), "https://archi142857.github.io/ultimate-rsp/#/c/7KQ2M9XA");
  location.search = "?server=http://127.0.0.1:8787&utm=x";
  assert.equal(shareLink("/c/7KQ2M9XA"), "https://archi142857.github.io/ultimate-rsp/?server=http%3A%2F%2F127.0.0.1%3A8787#/c/7KQ2M9XA");
  location.search = "?server=https://evil.example";
  assert.equal(shareLink("/c/7KQ2M9XA"), "https://archi142857.github.io/ultimate-rsp/#/c/7KQ2M9XA");
  location.search = "";
  assert.deepEqual(parseOnline("/c/new"), { kind: "new-challenge" });
});

test("오류 문구는 두 언어로 있다", () => {
  const codes = ["offline", "timeout", "version", "bad_reply", "origin", "bad_name", "not_found", "closed", "own", "bad_game", "bad_hand", "too_fast", "network"];
  const ko = codes.map(errorText);
  assert.equal(new Set(ko).size, codes.length, "코드마다 다른 문구");
  for (const c of ["busy", "server", "http_502"]) assert.equal(errorText(c), errorText("network"), `${c} 는 닿지 않음과 같은 안내`);
  setLang("en", { persist: false });
  try {
    for (const c of codes) assert.ok(!HANGUL.test(errorText(c)), c);
    assert.match(ago(Date.now() - 3 * 60000), /3 minutes ago/);
  } finally {
    setLang("ko", { persist: false });
  }
  assert.match(ago(Date.now() - 3 * 60000), /3분 전/);
  assert.match(ago(Date.now() - 2 * 86400000), /그저께|2일 전/);
  assert.equal(parseOnline("/c/new").kind, "new-challenge");
});
