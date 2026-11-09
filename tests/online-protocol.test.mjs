// node --test 로 돈다. 화면 쪽 사본이 서버 규약(server/src/protocol.js, 세션소통\자료\온라인_규약.md)과 맞는지 본다.
// 서버 모듈은 순수 모듈이라 그대로 import 한다. 어긋나면 규약 문서를 보고 둘 중 하나를 고친다.

import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../server/src/protocol.js";
import { checkName, normCode, makeCode } from "../server/src/check.js";
import { matrixIds, groupBaseIds, normRules } from "../server/src/games.js";
import * as C from "../web/js/online/protocol.js";
import { cleanRules, groupBases } from "../web/js/online/rules.js";
import { seatRange } from "../web/js/data/online.js";
import { wsErrorText } from "../web/js/online/messages.js";
import { BOTS } from "../web/js/core/bots.js";
import { readFileSync, existsSync } from "node:fs";
import { PROTOCOL, DEFAULT_SERVER } from "../web/js/online/config.js";
import { CODE_ABC, CODE_LEN, checkCode } from "../web/js/online/ids.js";
import { NAME_MAX, cleanName, randomName, newId } from "../web/js/online/identity.js";
import { errorText } from "../web/js/online/messages.js";
import { challengeGames } from "../web/js/online/games.js";

test("규약 번호·코드 글자와 길이·이름 길이가 서버와 같다", () => {
  assert.equal(PROTOCOL, P.PROTOCOL);
  assert.equal(CODE_ABC, P.CODE_ABC);
  assert.deepEqual(CODE_LEN, P.CODE_LEN);
  assert.equal(NAME_MAX, P.NAME_MAX);
});

test("서버가 만든 코드를 화면 주소가 받는다(방 코드는 소문자도)", () => {
  for (let i = 0; i < 300; i++) {
    const c = makeCode(P.CODE_LEN.challenge);
    assert.equal(checkCode(c, "challenge"), c);
    const r = makeCode(P.CODE_LEN.room);
    assert.equal(checkCode(r.toLowerCase(), "room"), r);
    assert.equal(normCode(r.toLowerCase(), P.CODE_LEN.room), r);
  }
});

test("처리방침 판·이메일 열쇠 값이 서버와 같고, 처리방침 쪽도 같은 판이다", async () => {
  assert.equal(C.PRIVACY_VERSION, P.PRIVACY_VERSION);
  assert.deepEqual(C.EMAIL_KDF, P.EMAIL_KDF);
  assert.equal(C.AUTH_SIGNUP_MS, P.AUTH_SIGNUP_MS);
  assert.equal(C.EMAIL_CODE_MS, P.EMAIL_CODE_MS);
  const html = readFileSync(new URL("../web/privacy.html", import.meta.url), "utf8");
  assert.match(html, new RegExp(`<meta name="policy-version" content="${C.PRIVACY_VERSION}">`));
  // 화면의 열쇠(WebCrypto)가 같은 값의 PBKDF2 와 같다
  const { emailKey, normEmail } = await import("../web/js/online/account.js");
  const { pbkdf2Sync } = await import("node:crypto");
  const email = "  Sanger@Example.COM ";
  const want = pbkdf2Sync("비밀번호 8자 이상", P.EMAIL_KDF.salt + normEmail(email), P.EMAIL_KDF.iterations, P.EMAIL_KDF.bytes, "sha256").toString("base64url");
  const got = await emailKey(email, "비밀번호 8자 이상");
  assert.equal(got, want);
  assert.match(got, /^[A-Za-z0-9_-]{43}$/);
});

test("pid 꼴이 서버와 맞는다", () => {
  for (let i = 0; i < 50; i++) assert.match(newId(), /^[A-Za-z0-9_-]{16,64}$/);
});

test("화면이 다듬은 이름은 서버가 받는다", () => {
  for (let i = 0; i < 300; i++)
    for (const l of ["ko", "en"]) {
      const n = randomName(l);
      assert.equal(checkName(n), n);
    }
  // 검수 11-08: 한글 채움·점자 빈칸·서식 글자(\p{Cf})가 든 이름도 화면이 다듬으면 서버가 받는다
  const nasty = ["a\u202Eb", "줄\n바꿈", "  띄어   쓰기  ", "x\u200By", "e\u0301", "\u{1F468}\u200D\u{1F469}\u200D\u{1F467} 가족", "가".repeat(30), "\u3000전각\u3000빈칸\u3000", "\u3164곰", "a\u200Eb\u200Fc", "소프트\u00AD하이픈", "점자\u2800빈칸", "\uFFA0반각\u115F\u1160", "x\u034Fy", "a\u17B4b", "몽골\u180B선택", "x\uFE00y", "글\uFE0F자", "\u2764\uFE0F 하트", "1\uFE0F\u20E3 키캡", "葛\u{E0100} 한자", "a\u{E0100}b"];
  for (const raw of nasty) {
    const c = cleanName(raw);
    assert.ok(c, JSON.stringify(raw));
    assert.equal(checkName(c), c, `서버가 받아야 한다: ${JSON.stringify(c)}`);
  }
  // 보이는 글자가 없으면 화면은 빈 이름으로 보고(바꾸지 않는다), 서버도 안 받는다
  for (const raw of ["\u0301", "   ", "\u200B", "\u3164", "\u2800\u2800", "\uFFA0", "\u00AD"]) {
    assert.equal(cleanName(raw), "");
    assert.throws(() => checkName(raw));
  }
});

test("서버 오류 코드마다 화면 문구가 있다", () => {
  const unreachable = errorText("network");
  // 로그인·계정 오류(규약 8장)와 가입·이메일 오류(8.3b·8.8)도 같이 본다
  for (const code of Object.keys(P.ERRORS)) {
    const msg = errorText(code);
    assert.ok(msg, code);
    // busy·server 는 '닿지 않는다'와 같은 안내(규약 5장)
    if (!["busy", "server"].includes(code)) assert.notEqual(msg, unreachable, code);
  }
});

test("도전장으로 보낼 수 있는 도감 변종이 서버와 같다", () => {
  assert.deepEqual(
    challengeGames().map((e) => e.id),
    matrixIds(),
  );
});

test("화면의 기본 서버 주소가 서버 README 의 주소와 같다", () => {
  const readme = new URL("../server/README.md", import.meta.url);
  if (!existsSync(readme)) return;
  const found = readFileSync(readme, "utf8").match(/https:\/\/ultimate-rsp\.[a-z0-9-]+\.workers\.dev/);
  if (found) assert.equal(DEFAULT_SERVER, found[0]);
});

test("방·매칭 수가 서버와 같다(규약 1.4·3·4·5장)", () => {
  for (const k of ["EMOTES", "EMOTE_GAP_MS", "FORMATS", "MATCH_FORMATS", "TIMERS", "ROOM_DEFAULTS", "GROUP_SEATS", "GROUP_MODES", "GRACE_MS", "REVEAL_MS", "MATCH_BOT_OFFER_MS", "GROUP_MATCH_WAIT_MS", "PING", "PONG", "PING_MS", "RETRY_MS", "CLOSE", "NO_RETRY"])
    assert.deepEqual(C[k], P[k], k);
  for (const code of P.WS_ERRORS) assert.notEqual(wsErrorText(code), errorText("network"), code);
  assert.deepEqual(
    groupBases().map((e) => e.id),
    groupBaseIds(),
  );
});

test("화면이 보내는 방 규칙을 서버가 그대로 받는다", () => {
  const tries = [{}];
  for (const game of [...matrixIds(), "group"])
    for (const format of P.FORMATS)
      for (const timer of P.TIMERS) tries.push({ game, format, timer, bot: BOTS[(timer / 10) % BOTS.length].id, mode: timer ? "loser" : "survive", seats: 3 + (timer % 8) });
  tries.push({ game: "custom", custom: { n: 9, k: 4, seed: 123 } });
  // 바탕마다 앉을 수 있는 가장 많은 인원(컨셉 seatRange: 손 셋 8명)
  for (const base of groupBaseIds()) tries.push({ game: "group", base, seats: seatRange(base).max });
  for (const r of tries) {
    const mine = cleanRules(r);
    const server = normRules(mine);
    for (const [k, v] of Object.entries(mine)) assert.deepEqual(server[k], v, `${JSON.stringify(r)} → ${k}`);
  }
});
