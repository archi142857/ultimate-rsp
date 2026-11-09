// 서버 값 검사(코드, pid, 닉네임, 출처, 규약 번호). Cloudflare 없이 돈다.

import test from "node:test";
import assert from "node:assert/strict";
import { makeCode, normCode, checkPid, checkName, checkEmote, checkFace, checkRoomCode } from "../src/check.js";
import { Fail, allowedOrigin, checkVersion, originList } from "../src/http.js";
import { CODE_ABC, NAME_MAX, PROTOCOL } from "../src/protocol.js";

const failCode = (fn) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof Fail, `Fail 이 아닌 오류: ${e}`);
    return e.code;
  }
  return null;
};

test("코드는 정한 글자로만, 정한 길이로", () => {
  for (const len of [4, 8]) {
    for (let i = 0; i < 200; i++) {
      const c = makeCode(len);
      assert.equal(c.length, len);
      for (const ch of c) assert.ok(CODE_ABC.includes(ch), ch);
    }
  }
  assert.ok(!/[01ILO]/.test(CODE_ABC));
});

test("코드 글자가 고르게 나온다(248 이상 바이트는 버린다)", () => {
  // 0..255 를 차례로 주면 0..247 만 쓰여서 31 글자가 8 번씩 나온다
  let k = 0;
  const bytes = (n) => Uint8Array.from({ length: n }, () => k++ % 256);
  const count = new Map();
  const s = makeCode(248, bytes);
  for (const ch of s) count.set(ch, (count.get(ch) || 0) + 1);
  assert.equal(count.size, CODE_ABC.length);
  for (const v of count.values()) assert.equal(v, 8);
});

test("사람이 친 코드는 대문자로 고치고, 꼴이 틀리면 null", () => {
  assert.equal(normCode("k7q2", 4), "K7Q2");
  assert.equal(normCode("K7Q2", 4), "K7Q2");
  assert.equal(normCode("K7Q", 4), null);
  assert.equal(normCode("K7Q0", 4), null);
  assert.equal(normCode("K7QI", 4), null);
  assert.equal(normCode(1234, 4), null);
  assert.equal(normCode("7kq2m9xa", 8), "7KQ2M9XA");
});

test("pid 꼴", () => {
  assert.equal(checkPid("abcdefghijklmnop"), "abcdefghijklmnop");
  assert.equal(checkPid("Ab0_-".repeat(4)), "Ab0_-".repeat(4));
  assert.equal(failCode(() => checkPid("short")), "bad_pid");
  assert.equal(failCode(() => checkPid("a".repeat(65))), "bad_pid");
  assert.equal(failCode(() => checkPid("abcdefghijklmno!")), "bad_pid");
  assert.equal(failCode(() => checkPid(undefined)), "bad_pid");
});

test("닉네임: 공백 정리, 길이, 안 되는 글자", () => {
  assert.equal(checkName("  날쌘   여우 42 "), "날쌘 여우 42");
  assert.equal(checkName("Swift Fox"), "Swift Fox");
  assert.equal(checkName("🦊"), "🦊");
  assert.equal(checkName("\u{1F468}\u200D\u{1F469}\u200D\u{1F467}"), "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}", "이모지를 잇는 글자는 받는다");
  assert.equal(checkName("가".repeat(NAME_MAX)), "가".repeat(NAME_MAX));
  assert.equal(failCode(() => checkName("가".repeat(NAME_MAX + 1))), "bad_name");
  assert.equal(failCode(() => checkName("")), "bad_name");
  assert.equal(failCode(() => checkName("   ")), "bad_name");
  assert.equal(failCode(() => checkName("줄\n바꿈")), "bad_name");
  assert.equal(failCode(() => checkName("탭\t")), "bad_name");
  assert.equal(failCode(() => checkName("abc\u202Edef")), "bad_name");
  assert.equal(failCode(() => checkName("\u200B")), "bad_name");
  assert.equal(failCode(() => checkName(42)), "bad_name");
});

test("이모트", () => {
  assert.equal(checkEmote("gg"), "gg");
  assert.equal(checkEmote(undefined, true), null);
  assert.equal(failCode(() => checkEmote("boo")), "bad_request");
  assert.equal(failCode(() => checkEmote(undefined)), "bad_request");
});

test("출처: 배포 화면과 로컬 시험 주소만", () => {
  assert.ok(allowedOrigin("https://archi142857.github.io"));
  assert.ok(allowedOrigin("http://localhost:8000"));
  assert.ok(allowedOrigin("http://127.0.0.1:5500"));
  assert.ok(allowedOrigin("http://localhost"));
  assert.ok(!allowedOrigin("https://archi142857.github.io.evil.com"));
  assert.ok(!allowedOrigin("http://localhost.evil.com"));
  assert.ok(!allowedOrigin("https://example.com"));
  assert.ok(!allowedOrigin(null));
  assert.deepEqual(originList({ ORIGINS: "https://a.example, https://b.example" }), ["https://a.example", "https://b.example"]);
  assert.deepEqual(originList({}), ["https://archi142857.github.io"]);
});

test("규약 번호", () => {
  checkVersion(PROTOCOL);
  checkVersion(String(PROTOCOL));
  assert.equal(failCode(() => checkVersion(PROTOCOL + 1)), "version");
  assert.equal(failCode(() => checkVersion(undefined)), "version");
});

test("프로필 그림: web/art 그림 이름만, 아니면 오류 없이 null", () => {
  assert.equal(checkFace("fox"), "fox");
  assert.equal(checkFace("king"), "king");
  for (const bad of [undefined, null, "", "nope", "../fox", "FOX", 3, ["fox"], {}]) assert.equal(checkFace(bad), null, String(bad));
});

test("방을 만들 때 화면이 고른 코드: 없으면 null, 소문자는 대문자로, 꼴이 틀리면 bad_request", () => {
  assert.equal(checkRoomCode(undefined), null);
  assert.equal(checkRoomCode(null), null);
  assert.equal(checkRoomCode("k7q2"), "K7Q2");
  assert.equal(checkRoomCode(makeCode(4)).length, 4);
  for (const bad of ["", "ABC", "ABCDE", "AB0D", "ABIO", 1234, {}, "가나다라"]) assert.equal(failCode(() => checkRoomCode(bad)), "bad_request", String(bad));
});

test("이름: 빈칸처럼 보이는 글자와 서식 문자는 안 받는다(이모지를 잇는 U+200D 는 받는다)", () => {
  const hidden = ["\u3164", "\uFFA0", "\u115F", "\u1160", "\u2800", "\u034F", "\u200E", "\u200F", "\u00AD", "\u180E", "\u2061", "\u2064", "\u{E0001}", "\u{E007F}", "\u200B", "\u202E", "\uFEFF"];
  for (const ch of hidden) {
    assert.equal(failCode(() => checkName(ch.repeat(3))), "bad_name", `혼자: U+${ch.codePointAt(0).toString(16)}`);
    assert.equal(failCode(() => checkName(`admin${ch}`)), "bad_name", `섞여도: U+${ch.codePointAt(0).toString(16)}`);
  }
  assert.equal(checkName("\u{1F468}\u200D\u{1F469}\u200D\u{1F467} 가족"), "\u{1F468}\u200D\u{1F469}\u200D\u{1F467} 가족");
  assert.equal(checkName("날쌘 여우 42"), "날쌘 여우 42");
  assert.equal(checkName("👍🏽 엄지"), "👍🏽 엄지", "피부색 이모지는 받는다");
  assert.equal(checkName("1️⃣ 첫째"), "1️⃣ 첫째", "키캡 이모지는 받는다");
});

test("이름: 크메르 안 보이는 모음·몽골 선택자는 안 받고, 이체 선택자는 제 짝 글자 뒤에서만 받는다(11-09 검수)", () => {
  for (const bad of ["a\u17B4b", "a\u17B5", "ab\u180B", "ab\uFE00", "ab\uFE0D", "ab\uFE0F", "a\uFE0Eb", "가\uFE0F", "❤️\uFE0F", "ab\u{E0100}", "\uFE0F\uFE0F"]) {
    assert.equal(failCode(() => checkName(bad)), "bad_name", JSON.stringify(bad));
  }
  for (const ok of ["❤️ 하트", "#️⃣ 샵", "1️⃣ 첫째", "☺︎ 웃음", "🏳️‍🌈 무지개", "❤️‍🔥 불", "葛\u{E0100}城 이름"]) assert.equal(checkName(ok), ok, JSON.stringify(ok));
});
