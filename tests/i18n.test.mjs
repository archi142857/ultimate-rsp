// node --test 로 돈다. 영어판: 빠진 번역, 자리표, 영어로 바꿨을 때의 도감·판정 문장.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { EN } from "../web/js/i18n/en.js";
import { setLang, missingKeys, t } from "../web/js/i18n.js";
import { CATALOG, CATEGORIES, findEntry } from "../web/js/data/catalog.js";
import { compileVariant } from "../web/js/core/engine.js";
import { BOTS } from "../web/js/core/bots.js";
import { makeCustomDef } from "../web/js/data/custom.js";
import { dwbDef } from "../web/js/games/dynamitewb.js";
import { FORMATS } from "../web/js/games/match.js";
import { DIRS } from "../web/js/games/acchimuite.js";
import { EVO_STAGES } from "../web/js/games/group.js";
import { ORDERS } from "../web/js/games/command.js";
import { GLICO_WORDS } from "../web/js/games/glico.js";
import { CALL } from "../web/js/games/mukjjippa.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HANGUL = /[ㄱ-ㆎ가-힣]/;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith(".js") ? [join(dir, d.name)] : []));
}

// 주석(줄 전체 // 와 /* */)은 뺀다: 설명 속 보기 문장까지 열쇠로 읽지 않게
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SOURCES = walk(join(ROOT, "web/js"))
  .filter((f) => !f.endsWith(join("i18n", "en.js")))
  .map((f) => ({ file: relative(ROOT, f), text: stripComments(readFileSync(f, "utf8")) }));
const HTML = readFileSync(join(ROOT, "web/index.html"), "utf8");

const CALL_KEY = /\b(?:t|tr)\(\s*"((?:[^"\\]|\\.)*)"/g;
const slotNames = (s) => [...s.matchAll(/\{(\w+)(?::[가-힣]+|\|[^|}]*\|[^}]*)?\}/g)].map((m) => m[1]).sort();

test("화면에서 부르는 한국어 틀은 모두 영어 사전에 있다", () => {
  const missing = [];
  for (const { file, text } of SOURCES) {
    assert.ok(!/\b(?:t|tr)\(\s*`/.test(text), `${file}: t() 열쇠는 따옴표 글이어야 한다(틀 글자는 찾을 수 없다)`);
    for (const m of text.matchAll(CALL_KEY)) {
      const key = JSON.parse(`"${m[1]}"`);
      if (!(key in EN)) missing.push(`${file}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("index.html 의 data-i18n 글도 영어 사전에 있다", () => {
  const keys = [...HTML.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 5);
  assert.deepEqual(keys.filter((k) => !(k in EN)), []);
});

test("영어 사전에 같은 열쇠가 두 번 없다(뒤의 것이 앞의 것을 말없이 덮는다)", () => {
  const src = readFileSync(join(ROOT, "web/js/i18n/en.js"), "utf8");
  const keys = [...src.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:/gm)].map((m) => JSON.parse(m[1]));
  assert.ok(keys.length >= Object.keys(EN).length * 0.9, "열쇠를 거의 다 읽어야 한다");
  const seen = new Set();
  const dup = keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
  assert.deepEqual(dup, []);
});

test("영어 사전: 자리표가 한국어 틀과 맞고 한글이 없다", () => {
  for (const [ko, en] of Object.entries(EN)) {
    if (typeof en !== "string") continue;
    assert.ok(!HANGUL.test(en), `한글이 남았다: ${ko} → ${en}`);
    assert.ok(!/\{\w+:/.test(en), `영어에 조사 자리표: ${en}`);
    assert.deepEqual([...new Set(slotNames(en))], [...new Set(slotNames(ko))], `자리표가 다르다: ${ko} → ${en}`);
  }
});

test("영어 사전에 쓰이지 않는 틀이 없다", () => {
  const all = SOURCES.map((x) => x.text).join("\n") + HTML;
  const unused = Object.keys(EN).filter((k) => !all.includes(JSON.stringify(k)));
  assert.deepEqual(unused, []);
});

test("쓰임새 표시(@)는 한국어로 낼 때 떨어진다", () => {
  assert.equal(t("@stat:차례"), "차례");
  assert.equal(t("{n}명", { n: 3 }), "3명");
  assert.equal(t("{a:이가} {b:을를} {v}%p 차이로 이겼다.", { a: "주사위", b: "고집", v: 12 }), "주사위가 고집을 12%p 차이로 이겼다.");
});

test("영어로 바꾸면 도감과 판정 문장이 모두 영어가 된다", () => {
  setLang("en", { persist: false });
  try {
    assert.equal(CATALOG.length, CATALOG.filter((e) => e.lang === "en").length);
    for (const c of CATEGORIES) assert.ok(!HANGUL.test(c.title + c.blurb), `갈래 ${c.id}`);
    for (const e of CATALOG) {
      // 다른 이름(aka)과 부제(sub)에는 본디 이름(가위바위보, じゃんけん 등)이 남아도 된다
      const text = JSON.stringify([e.name, e.origin, e.about, e.hands, e.sources, (e.aka || []).map((a) => a[1])]);
      assert.ok(!HANGUL.test(text), `${e.id} 에 한글이 남았다`);
    }
    for (const e of CATALOG.filter((x) => x.kind === "matrix")) {
      const V = compileVariant(e);
      for (let a = 0; a < V.n; a++)
        for (let b = 0; b < V.n; b++) {
          const s = V.sentence(a, b);
          assert.ok(!HANGUL.test(s) && /^[A-Z0-9]/.test(s), `${e.id}: ${s}`);
        }
    }
    const V = compileVariant(findEntry("classic"));
    const { rock, scissors, paper } = V.index;
    assert.equal(V.sentence(rock, scissors), "Rock crushes scissors");
    assert.equal(V.sentence(scissors, paper), "Scissors cut paper");
    assert.equal(V.sentence(paper, paper), "Both threw paper");
    const L = compileVariant(findEntry("rpsls"));
    assert.equal(L.sentence(L.index.lizard, L.index.spock), "Lizard bites Spock");
    assert.equal(L.sentence(L.index.spock, L.index.scissors), "Spock breaks scissors");

    const custom = compileVariant(makeCustomDef({ n: 9, k: 3, seed: 7 }));
    assert.ok(custom.hands.every((x) => !HANGUL.test(x.name)), "직접 만들기 손 이름");
    const dwb = compileVariant(dwbDef());
    assert.ok(dwb.hands.every((x) => !HANGUL.test(x.name)));
    assert.ok(!HANGUL.test(dwb.sentence(dwb.index.balloon, dwb.index.dynamite)));

    const words = [
      ...BOTS.flatMap((b) => [b.name, b.desc]),
      ...FORMATS.map((f) => f.name),
      ...DIRS.map((d) => d.name),
      ...EVO_STAGES.map((s) => s.name),
      ...ORDERS.map((o) => o.name),
      ...Object.values(GLICO_WORDS).map((w) => w.read),
      CALL.rock,
      CALL.scissors,
      CALL.paper,
    ];
    assert.deepEqual(words.filter((w) => HANGUL.test(w)), []);
    assert.equal(t("지금까지 {w}승 {d}무 {l}패", { w: 1, d: 0, l: 2 }), "So far: 1 win, 0 draws, 2 losses");
    assert.deepEqual(missingKeys(), []);
  } finally {
    setLang("ko", { persist: false });
  }
  assert.equal(CATALOG[0].lang, undefined, "한국어로 돌아온다");
});
