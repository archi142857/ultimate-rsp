// DO 자리 힌트(where.js). 입구가 request.cf 로 본 나라·대륙에서 고른다.

import test from "node:test";
import assert from "node:assert/strict";
import { QUEUE_HINT, checkHint, pairHint, placeOf } from "../src/where.js";

test("나라·대륙 → 자리 힌트", () => {
  assert.equal(placeOf({ country: "KR", continent: "AS" }), "apac-ne");
  assert.equal(placeOf({ country: "JP", continent: "AS" }), "apac-ne");
  assert.equal(placeOf({ country: "SG", continent: "AS" }), "apac-se");
  assert.equal(placeOf({ country: "IN", continent: "AS" }), "apac");
  assert.equal(placeOf({ country: "AE", continent: "AS" }), "me");
  assert.equal(placeOf({ country: "AU", continent: "OC" }), "oc");
  assert.equal(placeOf({ country: "DE", continent: "EU" }), "weur");
  assert.equal(placeOf({ country: "US", continent: "NA", longitude: "-122.4" }), "wnam");
  assert.equal(placeOf({ country: "US", continent: "NA", longitude: "-77.0" }), "enam");
  assert.equal(placeOf({ country: "BR", continent: "SA" }), "sam");
  assert.equal(placeOf({ country: "ZA", continent: "AF" }), "afr");
  for (const bad of [undefined, null, "KR", {}, { continent: "T1" }]) assert.equal(placeOf(bad), null);
  assert.equal(QUEUE_HINT, "apac-ne");
});

test("랜덤 방 자리: 먼저 기다린 사람 쪽, 모르는 값은 건너뛴다", () => {
  assert.equal(pairHint(["apac-ne", "weur"]), "apac-ne");
  assert.equal(pairHint([null, "weur"]), "weur");
  assert.equal(pairHint(["mars", "apac-ne"]), "apac-ne", "꾸며 넣은 값은 안 받는다");
  assert.equal(pairHint([null, undefined]), null);
  assert.equal(pairHint(["apac-ne"]), "apac-ne", "봇과 하기(혼자)");
  assert.equal(checkHint("enam"), "enam");
  assert.equal(checkHint("x"), null);
});
