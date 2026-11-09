// 전략의 진화 화면(web/js/views/evolution-story.js) 둘레: 도감의 league 글이 이야기 값(EVO_CATALOG)과 같고, 인물 그림이 다 있다.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { findEntry } from "../web/js/data/catalog.js";
import { EVO_CATALOG, EVO_CAST } from "../web/js/sims/evolution-story.js";

test("도감 league 이름·출처·소개는 EVO_CATALOG 와 같다", () => {
  const ko = findEntry("league");
  assert.equal(ko.name, EVO_CATALOG.ko.name);
  assert.equal(ko.origin, EVO_CATALOG.ko.origin);
  assert.deepEqual(ko.about, EVO_CATALOG.ko.about);
  const en = readFileSync(new URL("../web/js/data/catalog-en.js", import.meta.url), "utf8");
  for (const line of [EVO_CATALOG.en.name, EVO_CATALOG.en.origin, ...EVO_CATALOG.en.about]) assert.ok(en.includes(JSON.stringify(line)), line);
});

test("인물 아홉의 그림이 web/icons/cast/ 에 있다", () => {
  for (const id of EVO_CAST) assert.ok(existsSync(new URL(`../web/icons/cast/bot-${id}.svg`, import.meta.url)), id);
});
