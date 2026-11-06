// 가위바위보 위에 쌓은 놀이, 여럿이 하는 놀이, 봇, 시뮬레이션.

import test from "node:test";
import assert from "node:assert/strict";
import { compileVariant } from "../web/js/core/engine.js";
import { makeRng } from "../web/js/core/rng.js";
import { createBot, BOTS } from "../web/js/core/bots.js";
import { findEntry } from "../web/js/data/catalog.js";
import { createMatch } from "../web/js/games/match.js";
import { createMukjjippa } from "../web/js/games/mukjjippa.js";
import { createAcchimuite } from "../web/js/games/acchimuite.js";
import { createMinusOne, keepGame, pairGame } from "../web/js/games/minusone.js";
import { createGlico, solveGlico, steadyMix } from "../web/js/games/glico.js";
import { createLimited, createLimitedSolver } from "../web/js/games/limited.js";
import { DWB_DEF, createDwbBot } from "../web/js/games/dynamitewb.js";
import { createCommand } from "../web/js/games/command.js";
import { createGroup, createTrain, createEvolution, EVO_STAGES } from "../web/js/games/group.js";
import { runLeague } from "../web/js/sims/league.js";
import { createLattice } from "../web/js/sims/lattice.js";
import { createWar } from "../web/js/sims/war.js";

const C = compileVariant(findEntry("classic"));
const { rock: R, scissors: S, paper: P } = C.index;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test("삼세판: 먼저 두 번 이기면 끝나고, 비긴 판은 세지 않는다", () => {
  const m = createMatch(C, { target: 2 });
  m.play(R, R);
  assert.deepEqual(m.score, [0, 0]);
  m.play(R, S);
  m.play(P, S);
  assert.deepEqual(m.score, [1, 1]);
  m.play(P, R);
  assert.ok(m.done);
  assert.equal(m.winner, 0);
});

test("개수 제한과 비긴 점수 넘기기", () => {
  const V = compileVariant(DWB_DEF);
  const D = V.index.dynamite;
  const m = createMatch(V, { target: 5, limits: { dynamite: 1 }, carry: true });
  m.play(V.index.rock, V.index.rock); // 비김 → 다음 판 2점
  m.play(V.index.rock, V.index.rock); // 다음 판 3점
  const r = m.play(D, V.index.paper);
  assert.equal(r.gain, 3);
  assert.deepEqual(m.score, [3, 0]);
  assert.equal(m.allowed(0)[D], false);
  assert.throws(() => m.play(D, V.index.rock));
});

test("묵찌빠: 가위바위보로 공격을 정하고, 같은 손이면 공격이 이긴다", () => {
  const g = createMukjjippa(C);
  assert.equal(g.play(R, R).note, "again");
  assert.equal(g.play(R, S).note, "start");
  assert.equal(g.attacker, 0);
  assert.equal(g.play(S, R).note, "swap"); // 상대가 이겨 공격이 넘어간다
  assert.equal(g.attacker, 1);
  assert.equal(g.play(P, S).note, "keep");
  assert.equal(g.play(R, R).note, "hit");
  assert.ok(g.done);
  assert.equal(g.winner, 1);
});

test("묵찌빠: 둘 다 아무렇게나 내면 공격이 2/3 로 이긴다", () => {
  const rng = makeRng(3);
  let attackerWins = 0;
  const T = 20000;
  for (let t = 0; t < T; t++) {
    const g = createMukjjippa(C);
    g.play(R, S); // 내가 공격으로 시작
    while (!g.done) g.play(rng.int(3), rng.int(3));
    if (g.winner === 0) attackerWins += 1;
  }
  assert.ok(Math.abs(attackerWins / T - 2 / 3) < 0.015, String(attackerWins / T));
});

test("아치무이테호이: 가리킨 쪽을 보면 진다", () => {
  const g = createAcchimuite(C);
  g.janken(P, R);
  assert.equal(g.pointer, 0);
  g.hoi(0, 2);
  assert.equal(g.phase, "janken");
  g.janken(S, R);
  assert.equal(g.pointer, 1);
  g.hoi(3, 3);
  assert.ok(g.done);
  assert.equal(g.winner, 1);
});

test("하나빼기: 비기면 처음부터, 2×2 계산이 맞다", () => {
  const g = createMinusOne(C);
  g.two([R, P], [R, S]);
  g.one(0, 0); // 바위 대 바위
  assert.equal(g.phase, "two");
  g.two([R, P], [R, S]);
  g.one(1, 1); // 보 대 가위
  assert.ok(g.done);
  assert.equal(g.winner, 1);
  // [바위, 보] 대 [바위, 가위]: 내 값은 1/3, 바위 2/3·보 1/3
  const k = keepGame(C, [R, P], [R, S]);
  assert.ok(near(k.value, 1 / 3), String(k.value));
  assert.ok(near(k.mix[0], 2 / 3) && near(k.mix[1], 1 / 3), k.mix.join());
  // 같은 손 둘은 손해다
  assert.ok(keepGame(C, [R, R], [P, S]).value < 0);
  const pg = pairGame(C);
  assert.ok(near(pg.value, 0, 1e-9));
  const same = pg.pairs.map((p, i) => (p[0] === p[1] ? pg.mix[i] : 0)).reduce((a, b) => a + b, 0);
  assert.ok(near(same, 0), "같은 손 둘은 최적 섞기에 없다");
});

test("글리코: 꼭대기에 먼저 닿으면 이기고, 계산기는 대칭 자리에서 반반", () => {
  const g = createGlico(C, 9);
  g.play(S, P); // 가위 6칸
  assert.deepEqual(g.pos, [6, 0]);
  g.play(R, S); // 바위 3칸 → 9 도착
  assert.ok(g.done);
  assert.equal(g.winner, 0);
  const sol = solveGlico(C, 30);
  assert.ok(near(sol.value[0][0], 0.5, 1e-6), String(sol.value[0][0]));
  assert.ok(sol.value[27][0] > sol.value[0][27]);
  const sm = steadyMix(C);
  assert.ok(near(sm[R], 0.4) && near(sm[S], 0.4) && near(sm[P], 0.2));
});

test("한정 가위바위보: 별을 다 잃으면 지고, 계산기는 처음에 0 값", () => {
  const g = createLimited(C, { cards: 4, stars: 3 });
  g.play(R, S);
  assert.deepEqual(g.stars, [4, 2]);
  g.play(R, S);
  g.play(R, S);
  assert.deepEqual(g.stars, [6, 0]);
  assert.ok(g.done);
  assert.equal(g.winner, 0);
  const solver = createLimitedSolver(C, { stars: 3 });
  const fresh = createLimited(C);
  const b = solver.best(fresh, 0);
  assert.ok(near(b.value, 0, 1e-9), String(b.value));
  assert.ok(near(b.mix.reduce((x, y) => x + y, 0), 1));
});

test("다이너마이트 꾼은 다이너마이트를 다 쓴 뒤 쓰지 않는다", () => {
  const V = compileVariant(DWB_DEF);
  const rng = makeRng(11);
  const bot = createDwbBot(V, rng);
  const m = createMatch(V, { target: Infinity, limits: { dynamite: 3 }, carry: true });
  for (let t = 0; t < 300; t++) {
    const b = bot.pick({ rounds: m.rounds, allowed: m.allowed(1), side: 1 });
    m.play(rng.int(3), b);
  }
  const used = m.rounds.filter((r) => r.b === V.index.dynamite).length;
  assert.ok(used <= 3);
});

test("명령 가위바위보: 맞는 손을 고른다", () => {
  const g = createCommand(C, makeRng(5));
  for (let t = 0; t < 50; t++) {
    const p = g.next();
    const ans = g.answers(p);
    assert.equal(ans.length, 1);
    assert.ok(g.answer(ans[0]));
  }
  assert.equal(g.score, 50);
});

test("여럿이: 마지막 한 명이 남는다", () => {
  const rng = makeRng(9);
  for (const mode of ["survive", "loser"]) {
    const g = createGroup(C, { players: 6, mode });
    let guard = 0;
    while (!g.done && guard++ < 5000) {
      const t = {};
      g.alive.forEach((p) => (t[p] = rng.int(3)));
      g.play(t);
    }
    assert.ok(g.done, mode);
    assert.equal(g.alive.length, 1);
  }
});

test("기차는 한 줄이 되고, 진화는 단계마다 많아야 한 명 남는다", () => {
  const rng = makeRng(21);
  const tr = createTrain(C, rng, 37);
  while (!tr.done) tr.step();
  assert.equal(tr.trains.length, 1);
  assert.equal(tr.trains[0].length, 37);
  assert.equal(new Set(tr.trains[0]).size, 37);
  const ev = createEvolution(C, rng, 30);
  let guard = 0;
  while (!ev.done && guard++ < 10000) ev.step();
  const c = ev.counts();
  assert.ok(c.slice(0, EVO_STAGES.length - 1).every((x) => x <= 1), c.join());
  assert.equal(c.reduce((a, b) => a + b, 0), 30);
});

test("봇은 모두 쓸 수 있는 손만 낸다", () => {
  const V = compileVariant(DWB_DEF);
  const rng = makeRng(4);
  const allowed = [true, true, true, false, true];
  for (const b of BOTS) {
    const bot = createBot(b.id, V, rng);
    const history = [];
    for (let t = 0; t < 60; t++) {
      const x = bot.pick({ history, allowed });
      assert.ok(allowed[x], `${b.id} 이(가) 못 쓰는 손을 냈다`);
      history.push({ me: x, op: rng.int(3) });
    }
  }
});

test("리그: 수 읽기는 돌림을 크게 이기고, 주사위는 누구와도 비슷하다", () => {
  const ids = ["random", "pattern", "cycle", "stubborn"];
  const res = runLeague(C, ids, 2000, 1);
  const idx = Object.fromEntries(ids.map((id, i) => [id, i]));
  assert.ok(res.net[idx.pattern][idx.cycle] > 0.6, String(res.net[idx.pattern][idx.cycle]));
  assert.ok(res.net[idx.pattern][idx.stubborn] > 0.6);
  for (const j of ids) if (j !== "random") assert.ok(Math.abs(res.net[idx.random][idx[j]]) < 0.08, j);
});

test("격자: 이동이 적으면 셋이 함께 살고, 잘 섞으면 결국 줄어든다", () => {
  const low = createLattice({ L: 60, win: C.win, rng: makeRng(2), mobility: 1e-5 });
  low.advance(200);
  assert.equal(low.alive(), 3);
  const total = [...low.counts].reduce((a, b) => a + b, 0);
  assert.equal(total, low.N);
  const mixed = createLattice({ L: 40, win: C.win, rng: makeRng(5), mobility: 1e-5, mixed: true });
  let t = 0;
  while (mixed.alive() === 3 && t < 3000) {
    mixed.advance(10);
    t += 10;
  }
  assert.ok(mixed.alive() < 3, `섞인 판에서 ${t} 동안 셋이 다 살았다`);
});

test("전쟁: 결국 한 가지만 남는다", () => {
  const sim = createWar({ win: C.win, rng: makeRng(8), perKind: 15, width: 300, height: 200 });
  let guard = 0;
  while (!sim.done() && guard++ < 60 * 600) sim.step(1 / 30);
  assert.ok(sim.done());
  assert.equal(sim.counts().reduce((a, b) => a + b, 0), 45);
});
