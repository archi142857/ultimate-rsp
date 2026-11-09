// node --test 로 돈다. 온라인 화면의 바탕: 주소 읽기, 시험 서버 주소, 이름과 pid, 연결 실패 문구.

import test from "node:test";
import assert from "node:assert/strict";
import { parseOnline, normalizeCode, checkCode, hasBadCodeChar } from "../web/js/online/ids.js";
import { pickServer, DEFAULT_SERVER, PROTOCOL } from "../web/js/online/config.js";
import { cleanName, randomName, newId, playerId, NAME_MAX, faceId, myFace, setMyFace, setMyName, meWho, meFields } from "../web/js/online/identity.js";
import { NICK_WORDS } from "../web/js/i18n/nicknames.js";
import { resetTime, errorText } from "../web/js/online/messages.js";
import { setLang } from "../web/js/i18n.js";

const HANGUL = /[ㄱ-ㆎ가-힣]/;

test("온라인 주소를 읽는다", () => {
  assert.deepEqual(parseOnline("/play"), { kind: "home" });
  assert.deepEqual(parseOnline("/play/"), { kind: "home" });
  assert.deepEqual(parseOnline("/c/new"), { kind: "new-challenge" });
  assert.deepEqual(parseOnline("/c/7KQ2M9XA"), { kind: "challenge", code: "7KQ2M9XA" });
  assert.deepEqual(parseOnline("/c/7kq2m9xa"), { kind: "challenge", code: "7KQ2M9XA" }, "소문자도 받는다");
  assert.deepEqual(parseOnline("/room/k7q2"), { kind: "room", code: "K7Q2" });
  assert.deepEqual(parseOnline("/room/K7%20Q2"), { kind: "room", code: "K7Q2" });
  assert.equal(normalizeCode(" k7-q2 "), "K7Q2");
  // 검수 11-09: 한글 입력 상태로 친 코드, 링크를 통째로 붙여 넣은 코드
  assert.equal(normalizeCode("ㅠㅁㅠㄷ"), "BABE");
  assert.equal(normalizeCode("뮤ㅠㄷ"), "ABBE", "조합된 글자(ㅁ+ㅠ)도 누른 차례대로");
  assert.equal(normalizeCode("https://archi142857.github.io/ultimate-rsp/#/room/babe"), "BABE");
  assert.equal(normalizeCode("https://archi142857.github.io/ultimate-rsp/#/c/7kq2m9xa"), "7KQ2M9XA");
  // 검수 11-09: 채팅 글을 통째로 붙여 넣으면 코드 꼴 낱말만(한글 낱말을 자판 글자로 바꾸지 않는다)
  for (const [text, want] of [
    ["방 코드: babe", "BABE"],
    ["코드 BABE", "BABE"],
    ["BABE 방으로 와", "BABE"],
    ["babe!", "BABE"],
    ["BABE로 들어와", "BABE"],
    ["here's the code: babe", "BABE"],
    ["Join my rock paper scissors room K7Q2. Open the link to come right in.", "K7Q2"],
    ["방 BABE 도전장 7KQ2M9XA", "BABE"],
    ["ＢＡＢＥ", "BABE"],
    ["BAㅠㄷ", "BABE"],
    ["B0BE로 와", "B0BE"],
    ["방 코드 알려줘", ""],
  ])
    assert.equal(normalizeCode(text, "room"), want, text);
  assert.equal(normalizeCode("방 BABE 도전장 7KQ2M9XA", "challenge"), "7KQ2M9XA");
  assert.equal(hasBadCodeChar("B0BE"), true);
  assert.equal(hasBadCodeChar("babe"), false);
  assert.equal(checkCode("K7Q0", "room"), null, "0 은 코드 글자가 아니다");
  assert.equal(checkCode("7KQ2M9X", "challenge"), null, "도전장 코드는 8자");
  for (const p of ["/c/", "/c/%E0%A4%A", "/c/<script>", "/c/7KQ2M9XAB", "/c/7KQ2M9XI"]) assert.deepEqual(parseOnline(p), { kind: "bad", what: "challenge" }, p);
  for (const p of ["/room/!!", "/room/K7Q", "/room/K7Q2Z", "/room/O0O0"]) assert.deepEqual(parseOnline(p), { kind: "bad", what: "room" }, p);
  for (const p of ["/", "", "/sims", "/about", "/v/classic", "/cards", "/rooms/K7Q2", "/c/a/b"]) assert.equal(parseOnline(p), null, p);
});

test("시험 서버는 이 기기 안 주소만 받는다", () => {
  assert.equal(pickServer(""), DEFAULT_SERVER);
  assert.equal(pickServer("?server=http://localhost:8787"), "http://localhost:8787");
  assert.equal(pickServer("?server=http://127.0.0.1:8787/"), "http://127.0.0.1:8787");
  for (const bad of ["https://evil.example", "http://localhost.evil.example", "http://localhost:8787/x", "javascript:alert(1)"])
    assert.equal(pickServer("?server=" + encodeURIComponent(bad)), DEFAULT_SERVER, bad);
  assert.match(DEFAULT_SERVER, /^https:\/\//);
  assert.ok(Number.isInteger(PROTOCOL) && PROTOCOL > 0);
});

test("이름: 다듬기", () => {
  assert.equal(cleanName("  날쌘\n\t여우  "), "날쌘 여우");
  assert.equal(cleanName("a\u202Eb\u200Bc"), "a b c", "글 방향 뒤집기·보이지 않는 빈칸");
  assert.equal(cleanName("👨\u200D👩\u200D👧 가족"), "👨\u200D👩\u200D👧 가족", "이모지 잇는 글자는 남긴다");
  assert.equal([...cleanName("가".repeat(30))].length, NAME_MAX);
  assert.equal(cleanName("   "), "");
  assert.equal(cleanName(null), "");
  assert.equal(cleanName("\u0301\u0301"), "", "보이는 글자가 없으면 빈 이름");
  assert.equal(cleanName("e\u0301"), "\u00e9", "NFC 로 맞춘다");
});

test("이름: 무작위 이름은 두 언어로, 다듬어도 그대로", () => {
  const seq = (xs) => {
    let i = 0;
    return () => xs[i++ % xs.length];
  };
  assert.equal(randomName("ko", seq([0])), "날쌘 여우 10");
  assert.equal(randomName("en", seq([0.999])), "Gentle Dragon 99");
  for (const l of ["ko", "en"]) {
    for (let i = 0; i < 300; i++) {
      const n = randomName(l);
      assert.equal(cleanName(n), n);
      assert.ok([...n].length <= NAME_MAX, n);
      assert.equal(HANGUL.test(n), l === "ko", n);
    }
  }
  for (const l of ["ko", "en"]) {
    const w = NICK_WORDS[l];
    // 가장 긴 꾸밈말 + 이름말 + 두 자리 수도 20글자 안
    const longest = (list) => Math.max(...list.map((x) => [...x].length));
    assert.ok(longest(w.adj) + longest(w.noun) + 4 <= NAME_MAX, `${l} 이름이 20글자를 넘을 수 있다`);
    assert.equal(new Set(w.adj).size, w.adj.length, `${l} 꾸밈말이 겹친다`);
    assert.equal(new Set(w.noun).size, w.noun.length, `${l} 이름말이 겹친다`);
  }
});

test("pid 는 22자 무작위이고 한 번 정하면 그대로", () => {
  const a = newId();
  assert.match(a, /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(a, newId());
  assert.match(playerId(), /^[A-Za-z0-9_-]{22}$/);
  assert.equal(playerId(), playerId());
});

test("프로필 그림: 게임 그림 이름만 받고, 고른 때만 서버에 싣는다", () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  try {
    assert.equal(faceId("fox"), "fox");
    for (const bad of ["", "nope", "../fox", "FOX", "fox.png", null, 7, {}]) assert.equal(faceId(bad), null, String(bad));
    setMyName("날쌘 여우");
    assert.equal(myFace(), null, "처음에는 고른 그림이 없다");
    assert.deepEqual(meFields(), { name: "날쌘 여우" }, "안 골랐으면 face 를 보내지 않는다");
    assert.equal(setMyFace("nope"), null);
    assert.equal(setMyFace("tiger"), "tiger");
    assert.deepEqual(meFields(), { name: "날쌘 여우", face: "tiger" });
    assert.deepEqual(meWho(), { kind: "human", name: "날쌘 여우", face: "tiger" });
    mem.set("ursp.set.online.face", JSON.stringify("../evil"));
    assert.equal(myFace(), null, "저장된 값도 거른다");
    setMyFace(null);
    assert.equal(myFace(), null);
  } finally {
    delete globalThis.localStorage;
  }
});

test("연결 실패 문구와 한도가 풀리는 시각", () => {
  assert.match(errorText("network"), /풀립니다/);
  assert.match(errorText("anything_else"), /서버에 연결할 수 없습니다/);
  setLang("en", { persist: false });
  try {
    assert.match(resetTime(new Date("2026-11-07T05:00:00Z")), /^\d{1,2}:00\s?(AM|PM)$/);
    for (const c of ["offline", "timeout", "version", "network"]) assert.ok(!HANGUL.test(errorText(c)), c);
  } finally {
    setLang("ko", { persist: false });
  }
});
