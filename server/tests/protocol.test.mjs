// 규약 상수(server/src/protocol.js)가 서로, 그리고 판정 코드(web/js)와 맞는지 본다.
// 화면 쪽 사본과 맞는지는 Frontend 의 tests/online-protocol.test.mjs 가 본다.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as P from "../src/protocol.js";
import { BOTS } from "../../web/js/core/bots.js";
import { FORMATS as MATCH_FORMATS_ALL } from "../../web/js/games/match.js";
import { matrixIds } from "../src/games.js";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

test("서버 코드가 던지는 오류 코드는 모두 규약 목록에 있다", () => {
  const used = new Set();
  for (const f of readdirSync(SRC).filter((x) => x.endsWith(".js"))) {
    const text = readFileSync(SRC + f, "utf8");
    for (const m of text.matchAll(/new Fail\("([a-z_]+)"/g)) used.add(m[1]);
  }
  assert.ok(used.size >= 5);
  for (const code of used) assert.ok(code in P.ERRORS || code in P.NEW_ERRORS || P.WS_ERRORS.includes(code), code);
  for (const code of P.WS_ERRORS) assert.ok(!(code in P.ERRORS) && !(code in P.NEW_ERRORS), code);
  for (const code of Object.keys(P.NEW_ERRORS)) assert.ok(!(code in P.ERRORS), code);
});

test("닫는 코드는 4000번대에서 겹치지 않고, 다시 붙지 않는 코드는 그 안에 있다", () => {
  const codes = Object.values(P.CLOSE);
  assert.equal(new Set(codes).size, codes.length);
  for (const c of codes) assert.ok(c >= 4000 && c <= 4999, String(c));
  for (const c of P.NO_RETRY) assert.ok(codes.includes(c), String(c));
  assert.ok(!P.NO_RETRY.includes(P.CLOSE.too_fast) && !P.NO_RETRY.includes(P.CLOSE.matched));
});

test("판 수·봇·기본 규칙은 판정 코드(web/js)에 있는 것", () => {
  const formats = MATCH_FORMATS_ALL.map((f) => f.id);
  for (const f of P.FORMATS) assert.ok(formats.includes(f), f);
  for (const f of P.MATCH_FORMATS) assert.ok(P.FORMATS.includes(f), f);
  assert.ok(BOTS.some((b) => b.id === P.ROOM_DEFAULTS.bot));
  assert.ok(matrixIds().includes(P.ROOM_DEFAULTS.game));
  assert.ok(P.FORMATS.includes(P.ROOM_DEFAULTS.format));
  assert.ok(P.TIMERS.includes(P.ROOM_DEFAULTS.timer) && P.TIMERS.includes(P.MATCH_TIMER));
});

test("코드 글자, 이모트, 다시 붙는 간격", () => {
  assert.equal(new Set(P.CODE_ABC).size, P.CODE_ABC.length);
  assert.ok(!/[01ILO]/.test(P.CODE_ABC));
  assert.equal(new Set(P.EMOTES).size, P.EMOTES.length);
  for (const e of P.EMOTES) assert.match(e, /^[a-z]+$/);
  for (let i = 1; i < P.RETRY_MS.length; i++) assert.ok(P.RETRY_MS[i] > P.RETRY_MS[i - 1]);
  assert.ok(P.GROUP_SEATS.min <= P.GROUP_SEATS.default && P.GROUP_SEATS.default <= P.GROUP_SEATS.max);
});
