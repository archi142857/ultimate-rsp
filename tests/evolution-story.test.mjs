// 전략의 진화 이야기(web/js/sims/evolution-story.js): 장마다 글에 적은 결과가 정해 둔 씨앗의 계산과 같은지 본다.
// 봇·난수·진화 코드가 바뀌어 이 시험이 깨지면, 글(EVO_TEXT)의 숫자와 이름을 계산에 맞춰 같이 고친다.

import { test } from "node:test";
import assert from "node:assert/strict";
import { compileVariant } from "../web/js/core/engine.js";
import { findEntry } from "../web/js/data/catalog.js";
import { botInfo } from "../web/js/core/bots.js";
import { playMatch } from "../web/js/sims/league.js";
import {
  EVO_CAST,
  EVO_CHAPTERS,
  EVO_TEXT,
  EVO_LINES,
  EVO_CATALOG,
  evoChapter,
  evoSetup,
  evolutionFor,
  runChapter,
  leagueFor,
  opponentFor,
} from "../web/js/sims/evolution-story.js";

const C = compileVariant(findEntry("classic"));
const handName = (i) => C.hands[i].name;
const LANGS = ["ko", "en"];

/** id 가 처음 n 명이 된 세대(없으면 -1) */
const firstGen = (evo, id, n) => evo.history.findIndex((c) => c[id] === n);
/** id 가 0 명이 된 세대 */
const goneAt = (evo, id) => firstGen(evo, id, 0);
const last = (evo) => evo.history[evo.history.length - 1];
const ko = EVO_TEXT.ko;
const en = EVO_TEXT.en;

test("장마다 한국어·영어 글이 다 있다", () => {
  assert.deepEqual(
    EVO_CHAPTERS.map((c) => c.id),
    ["intro", "one", "duel", "league", "evolve", "readers", "rounds", "noise", "draw", "sandbox", "outro"],
  );
  for (const lang of LANGS) {
    const T = EVO_TEXT[lang];
    assert.ok(T.title);
    for (const ch of EVO_CHAPTERS) {
      const t = T[ch.id];
      assert.ok(t && t.title && Array.isArray(t.body) && t.body.length, `${lang} ${ch.id}`);
      if (ch.kind === "duel") for (const f of ch.foes) assert.ok(t.foes[f.id], `${lang} ${ch.id} ${f.id}`);
      if (ch.kind === "choice") {
        assert.deepEqual(Object.keys(t.choices).sort(), ch.choices.map((c) => c.id).sort(), `${lang} ${ch.id} 고르기`);
        for (const c of ch.choices) assert.ok(t.choices[c.id].label && t.choices[c.id].result, `${lang} ${ch.id} ${c.id}`);
      }
      if (["one", "duel", "league", "evolve", "choice"].includes(ch.kind)) assert.ok(t.end, `${lang} ${ch.id} 해설`);
    }
    assert.deepEqual(Object.keys(EVO_LINES[lang]).sort(), [...EVO_CAST].sort(), `${lang} 말버릇`);
    assert.ok(EVO_CATALOG[lang].name && EVO_CATALOG[lang].about.length === 2);
  }
  for (const id of EVO_CAST) assert.equal(botInfo(id).id, id);
});

test("한국어 문장은 하십시오체, 꾸밈 줄표 없음", () => {
  const sentences = [];
  for (const ch of EVO_CHAPTERS) {
    const t = ko[ch.id];
    const parts = [...t.body, t.end, t.credit, ...Object.values(t.foes || {}), ...Object.values(t.choices || {}).map((c) => c.result)].filter(Boolean);
    for (const p of parts) sentences.push(...p.split(/(?<=[.?])\s+/));
  }
  sentences.push(...EVO_CATALOG.ko.about.flatMap((p) => p.split(/(?<=[.?])\s+/)));
  for (const s of sentences) assert.match(s, /(니다\.|니까\?|십시오\.)$/, s);
  const all = JSON.stringify(EVO_TEXT) + JSON.stringify(EVO_CATALOG);
  assert.doesNotMatch(all, /—/, "줄표(—)를 쓰지 않는다");
  for (const lang of LANGS) {
    for (const ch of EVO_CHAPTERS) for (const c of Object.values(EVO_TEXT[lang][ch.id].choices || {})) assert.doesNotMatch(c.label, /\.$/, `단추 이름에 마침표: ${c.label}`);
  }
});

test("1·2장 상대: 고집은 바위만, 돌림은 바위·가위·보 차례", () => {
  const one = opponentFor(C, evoChapter("one"));
  assert.equal(one.id, "random");
  const duel = evoChapter("duel");
  assert.deepEqual(duel.foes.map((f) => f.id), ["stubborn", "cycle", "mirror", "avenger", "random"]);
  const play = (bot, n = 10) => {
    const h = [];
    const out = [];
    for (let t = 0; t < n; t++) {
      const x = bot.pick({ history: h });
      out.push(handName(x));
      h.push({ me: x, op: t % 3 });
    }
    return out;
  };
  assert.deepEqual(play(opponentFor(C, duel, 0)), new Array(10).fill("바위"));
  assert.deepEqual(play(opponentFor(C, duel, 1), 6), ["바위", "가위", "보", "바위", "가위", "보"]);
  assert.match(ko.duel.foes.stubborn, /바위만/);
  assert.match(ko.duel.foes.cycle, /바위, 가위, 보/);
  assert.match(en.duel.foes.cycle, /rock, scissors, paper/);
  assert.match(EVO_LINES.ko.cycle, /^바위, 가위, 보/);
  // 해설의 '이기는 법'이 맞다: 따라쟁이는 내 직전 손, 앙갚음은 내 직전 손을 이기는 손
  const mirror = opponentFor(C, duel, 2);
  const avenger = opponentFor(C, duel, 3);
  for (let my = 0; my < 3; my++) {
    const h = [{ me: 0, op: my }];
    assert.equal(mirror.pick({ history: h }), my);
    assert.ok(C.win[avenger.pick({ history: h })][my]);
  }
});

test("3장 리그 한 번: 따라쟁이 1등, 앙갚음에게만 짐, 고집은 모두에게 짐", () => {
  const r = leagueFor(C, evoChapter("league"));
  assert.deepEqual(r.order, ["mirror", "avenger", "random", "cycle", "stubborn"], JSON.stringify(r.totals));
  const lostTo = (id) =>
    r.pairs.filter((p) => (p.a === id ? p.w < p.l : p.b === id ? p.l < p.w : false)).map((p) => (p.a === id ? p.b : p.a));
  assert.deepEqual(lostTo("mirror"), ["avenger"]);
  assert.deepEqual(lostTo("stubborn").sort(), ["avenger", "cycle", "mirror", "random"]);
  const mc = r.pairs.find((p) => p.a === "cycle" && p.b === "mirror");
  assert.ok(mc.l - mc.w >= 8, "따라쟁이가 돌림을 크게 이긴다");
  assert.equal(Object.values(r.totals).length, 5);
});

test("4장 리그를 거듭하면: 고집 1세대, 돌림·앙갚음 3세대, 주사위 7세대에 사라지고 7세대에 모두 따라쟁이", () => {
  const evo = runChapter(C, evoChapter("evolve"));
  assert.equal(evo.people.length, 25);
  assert.equal(goneAt(evo, "stubborn"), 1);
  assert.equal(goneAt(evo, "cycle"), 3);
  assert.equal(goneAt(evo, "avenger"), 3);
  assert.equal(goneAt(evo, "random"), 7);
  assert.equal(firstGen(evo, "mirror", 25), 7);
  assert.ok(evo.done && evo.generation === 7);
  assert.match(ko.evolve.end, /7세대 만에 25명 모두 따라쟁이/);
  assert.match(en.evolve.end, /By generation 7, all 25 are Copycats/);
});

test("5장 읽는 사람이 오면: 수 읽기 8세대, 버릇 읽기 10세대에 25명, 사람 흉내는 1세대에 빠짐", () => {
  const ch = evoChapter("readers");
  const p = runChapter(C, ch, "pattern");
  assert.equal(firstGen(p, "pattern", 25), 8);
  const f = runChapter(C, ch, "freq");
  assert.equal(firstGen(f, "freq", 25), 10);
  const h = runChapter(C, ch, "human");
  assert.equal(goneAt(h, "human"), 1);
  assert.match(ko.readers.choices.pattern.result, /8세대 만에 25명/);
  assert.match(ko.readers.choices.freq.result, /10세대 만에 25명/);
  assert.match(en.readers.choices.pattern.result, /generation 8/);
  assert.match(en.readers.choices.freq.result, /generation 10/);
});

test("6장 판 수: 3판은 14세대에 모두 따라쟁이, 10판은 20세대에도 주사위·수 읽기가 나눔, 30판은 9세대에 모두 수 읽기", () => {
  const ch = evoChapter("rounds");
  assert.equal(Object.values(evoSetup(ch, "3").population).reduce((a, b) => a + b, 0), 25);
  const s = runChapter(C, ch, "3");
  assert.equal(firstGen(s, "mirror", 25), 14);
  const m = runChapter(C, ch, "10");
  assert.equal(m.generation, 20);
  assert.ok(!m.done);
  const c = last(m);
  const top = Object.entries(c).sort((a, b) => b[1] - a[1]);
  assert.deepEqual(top.slice(0, 2).map(([id]) => id).sort(), ["pattern", "random"], JSON.stringify(c));
  assert.ok(Math.abs(c.random - c.pattern) <= 2, JSON.stringify(c));
  const l = runChapter(C, ch, "30");
  assert.equal(firstGen(l, "pattern", 25), 9);
  assert.match(ko.rounds.choices[3].result, /14세대/);
  assert.match(ko.rounds.choices[30].result, /9세대/);
  assert.match(en.rounds.choices[3].result, /generation 14/);
  assert.match(en.rounds.choices[30].result, /generation 9/);
});

test("7장 실수: 0%는 12세대, 5%는 11세대에 모두 수 읽기, 20%는 수 읽기가 사라지고 앙갚음 21·따라쟁이 4", () => {
  const ch = evoChapter("noise");
  assert.equal(firstGen(runChapter(C, ch, "0"), "pattern", 25), 12);
  assert.equal(firstGen(runChapter(C, ch, "5"), "pattern", 25), 11);
  const n = runChapter(C, ch, "20");
  assert.equal(n.generation, 20);
  const c = last(n);
  assert.equal(c.avenger, 21);
  assert.equal(c.mirror, 4);
  assert.equal(c.pattern, 0);
  assert.match(ko.noise.choices[0].result, /12세대/);
  assert.match(ko.noise.choices[5].result, /11세대/);
  assert.match(ko.noise.choices[20].result, /앙갚음 21명과 따라쟁이 4명/);
  assert.match(en.noise.choices[20].result, /21 Avengers and 4 Copycats/);
});

test("8장 비김 점수: 0점은 7장 실수 없음과 같은 진화, 0.5점이면 20세대에 모두 앙갚음", () => {
  const ch = evoChapter("draw");
  const plain = runChapter(C, ch, "0");
  assert.deepEqual(plain.history, runChapter(C, evoChapter("noise"), "0").history, "같은 25명, 같은 씨앗");
  assert.equal(firstGen(plain, "pattern", 25), 12);
  const half = runChapter(C, ch, "half");
  assert.equal(firstGen(half, "avenger", 25), 20);
  assert.match(ko.draw.choices.half.result, /20세대 만에/);
  assert.match(en.draw.choices.half.result, /generation 20/);
});

test("9장 놀이터: 처음 값은 25명, 화면이 돌릴 수 있다", () => {
  const ch = evoChapter("sandbox");
  const s = evoSetup(ch);
  assert.equal(Object.values(s.population).reduce((a, b) => a + b, 0), 25);
  assert.deepEqual(Object.keys(s.population), EVO_CAST);
  assert.ok(s.rounds >= ch.limits.rounds[0] && s.rounds <= ch.limits.rounds[1]);
  assert.ok(s.noise >= ch.limits.noise[0] && s.noise <= ch.limits.noise[1]);
  const evo = evolutionFor(C, ch);
  const r = evo.step();
  assert.equal(r.out.length, s.cull);
});

test("10장 맺음: 수 읽기 > 돌림 > 앙갚음 > 수 읽기, 주사위는 누구와도 0 근처", () => {
  const net = (a, b, n = 300, rounds = 10) => {
    let s = 0;
    for (let k = 1; k <= n; k++) {
      const r = playMatch(C, a, b, rounds, k * 7919);
      s += r.w - r.l;
    }
    return s / (n * rounds);
  };
  assert.ok(net("pattern", "cycle") > 0.1);
  assert.ok(net("cycle", "avenger") > 0.5);
  assert.ok(net("avenger", "pattern") > 0.05);
  for (const id of ["stubborn", "cycle", "mirror", "avenger", "human", "freq", "pattern"]) assert.ok(Math.abs(net("random", id)) < 0.05, id);
});
