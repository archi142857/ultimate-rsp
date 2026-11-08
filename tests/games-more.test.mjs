// 11-08 에 더한 놀이: 뿅망치, 돈파파, 릴레이, 황제와 노예, 동전 순서, 이상한 주사위, 모라, 블로토, 장기,
// 여럿이 규칙(많은 손·적은 손, 셋 다 나오면 가위), 진행자 이기기, 편 술래잡기, 편 가르기.

import test from "node:test";
import assert from "node:assert/strict";
import { compileVariant } from "../web/js/core/engine.js";
import { makeRng } from "../web/js/core/rng.js";
import { findEntry } from "../web/js/data/catalog.js";
import { reactionMs, firstPress, REACTION_LEVELS } from "../web/js/games/reaction.js";
import { createHammer, STRIKE_MS } from "../web/js/games/hammer.js";
import { createDonpappa, DON_MS } from "../web/js/games/donpappa.js";
import { createRelay, playRelay, relayStats } from "../web/js/games/relay.js";
import { createEcard, cmpCard, ecardPick } from "../web/js/games/ecard.js";
import { createPenney, bestReply, firstChance, allSequences, penneyPick } from "../web/js/games/penney.js";
import { DICE_SETS, dieOf, duelOdds, bestDie, createDiceDuel, dicePick } from "../web/js/games/dice.js";
import { createMorra, createOddEven, morraPick } from "../web/js/games/morra.js";
import { allocations, fieldsWon, blottoCmp, blottoMix, blottoPick, createBlotto, isAllocation } from "../web/js/games/blotto.js";
import { createShogi, legalMoves, meet, shogiPick } from "../web/js/games/shogi.js";
import { createGroup, winningHand } from "../web/js/games/group.js";
import { createHostGame } from "../web/js/games/host.js";
import { createTeamTag, createTeamSplit, splitChance, expectedSplitTries } from "../web/js/games/teams.js";

const C = compileVariant(findEntry("classic"));
const { rock: R, scissors: S, paper: P } = C.index;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("반응 시간: 세기 차례대로 빠르고, 먼저 누른 쪽을 고른다", () => {
  const rng = makeRng(1);
  const avg = (lv) => {
    let s = 0;
    for (let i = 0; i < 2000; i++) s += reactionMs(rng, lv);
    return s / 2000;
  };
  const [e, n, h] = ["easy", "normal", "hard"].map(avg);
  assert.ok(h < n && n < e, `${h} ${n} ${e}`);
  assert.ok(Math.abs(n - REACTION_LEVELS.normal) < 20);
  for (let i = 0; i < 500; i++) assert.ok(reactionMs(rng, "hard") >= 180);
  assert.equal(firstPress(300, 400), 0);
  assert.equal(firstPress(Infinity, 400), 1);
  assert.equal(firstPress(Infinity, Infinity), null);
  assert.equal(firstPress(300, 300, { tie: 1 }), 1);
  assert.equal(firstPress(2500, 2600, { limit: 2000 }), null);
});

test("뿅망치: 가위바위보에 이긴 쪽이 치고, 막기보다 먼저 쳐야 1점", () => {
  const g = createHammer(C, { target: 2 });
  assert.equal(g.janken(R, R).cmp, 0);
  assert.equal(g.phase, "janken");
  g.janken(R, S);
  assert.equal(g.phase, "strike");
  assert.equal(g.striker, 0);
  assert.throws(() => g.janken(R, S));
  assert.equal(g.strike(300, 450).result, "hit");
  assert.deepEqual(g.score, [1, 0]);
  g.janken(S, R);
  assert.equal(g.strike(400, 400).result, "blocked", "같은 때면 막은 것");
  g.janken(S, R);
  assert.equal(g.strike(Infinity, Infinity).result, "miss");
  g.janken(S, R);
  assert.equal(g.strike(STRIKE_MS + 1, Infinity).result, "miss", "시간을 넘기면 헛친다");
  g.janken(P, R);
  g.strike(200, Infinity);
  assert.ok(g.done);
  assert.equal(g.winner, 0);
});

test("돈파파: 셋째 손이 같으면 먼저 외친 쪽, 다르면 공수 교대", () => {
  const g = createDonpappa(C);
  g.janken(P, P);
  assert.equal(g.phase, "janken");
  g.janken(P, R);
  assert.equal(g.attacker, 0);
  assert.deepEqual(g.current, [P, R]);
  let r = g.call(S, R);
  assert.equal(r.result, "swap");
  assert.equal(g.attacker, 1);
  assert.deepEqual(g.current, [S, R]);
  r = g.call(R, R, Infinity, DON_MS + 10);
  assert.equal(r.result, "missed", "정한 시간 안에 아무도 안 외침");
  assert.equal(g.attacker, 1);
  r = g.call(P, P, 500, 500);
  assert.equal(r.result, "don");
  assert.equal(g.winner, 1, "같은 때면 선공");
  const h = createDonpappa(C, { falseStart: true });
  h.janken(R, S);
  r = h.call(R, P, Infinity, 300);
  assert.equal(r.result, "false");
  assert.equal(h.winner, 0, "손이 다른데 외친 쪽이 진다");
  const k = createDonpappa(C);
  k.janken(R, S);
  assert.equal(k.call(R, P, Infinity, 300).result, "swap", "기본 규칙에서는 잘못 외쳐도 그냥 교대");
});

test("릴레이: 가운데서 만나고, 진지를 막던 사람에게 이기면 1점", () => {
  const g = createRelay(C, { cells: 8, target: 1 });
  assert.equal(g.run(), 4);
  assert.deepEqual(g.pos, [4, 5]);
  assert.equal(g.phase, "janken");
  g.janken(R, S);
  assert.deepEqual(g.pos, [4, 9], "진 편은 진지에서 다음 사람이 나온다");
  assert.deepEqual(g.runner, [1, 2]);
  assert.equal(g.phase, "run");
  g.run();
  assert.deepEqual(g.pos, [6, 7]);
  g.janken(R, S);
  g.run();
  assert.deepEqual(g.pos, [7, 8]);
  g.janken(R, S);
  g.run();
  assert.deepEqual(g.pos, [8, 8], "같은 칸에서도 만난다");
  g.janken(R, S);
  assert.deepEqual(g.pos, [8, 9], "마지막 칸에서 진지에 막 나온 사람과 바로 만난다");
  assert.equal(g.phase, "janken");
  const r = g.janken(R, S);
  assert.equal(r.point, 0);
  assert.ok(g.done);
  assert.equal(g.winner, 0);
  assert.equal(g.seconds(), g.hops + g.throws);
  // 아무렇게나 내도 끝나고, 후프 8개면 평균 2분 안팎이다(이 앱 규칙)
  const rng = makeRng(5);
  for (let i = 0; i < 50; i++) assert.ok(playRelay(C, rng, { cells: 5 }).done);
  const st = relayStats(C, makeRng(9), 8, 3000);
  assert.ok(st.seconds > 105 && st.seconds < 135, `${st.seconds}`);
  // 점수 여럿: 1점 뒤에는 둘 다 진지에서 다시 나온다
  const m = createRelay(C, { cells: 1, target: 2 });
  m.run();
  m.janken(R, S);
  m.janken(R, S);
  assert.deepEqual(m.score, [1, 0]);
  assert.deepEqual(m.pos, [0, 2]);
  assert.ok(!m.done);
});

test("황제와 노예: 판 흐름, 3판마다 쪽 바꾸기, 노예로 이기면 4점", () => {
  assert.equal(cmpCard("emperor", "citizen"), 1);
  assert.equal(cmpCard("citizen", "slave"), 1);
  assert.equal(cmpCard("slave", "emperor"), 1);
  assert.equal(cmpCard("citizen", "citizen"), 0);
  const g = createEcard();
  assert.deepEqual(g.sides, ["emperor", "slave"]);
  assert.equal(g.play("citizen", "citizen").cmp, 0);
  assert.equal(g.round, 0);
  let r = g.play("emperor", "slave");
  assert.equal(r.roundWinner, 1);
  assert.equal(r.points, 4);
  r = g.play("emperor", "citizen");
  assert.equal(r.roundWinner, 0);
  assert.equal(r.points, 1);
  assert.throws(() => g.play("slave", "citizen"), /없는 카드/);
  g.play("citizen", "slave");
  assert.deepEqual(g.sides, ["slave", "emperor"], "3판 뒤 쪽을 바꾼다");
  while (!g.done) {
    const a = g.allowed(0)[0];
    const b = g.allowed(1)[0];
    g.play(a, b);
  }
  assert.equal(g.round, 12);
  // 둘 다 컴퓨터처럼 내면 노예 쪽이 1/5 쯤 이기고, 4점이면 두 쪽 기대 점수가 같다
  const rng = makeRng(3);
  let slaveWins = 0;
  let roundsPlayed = 0;
  const turns = new Array(5).fill(0);
  for (let k = 0; k < 400; k++) {
    const e = createEcard();
    while (!e.done) {
      const a = ecardPick(e, 0, rng);
      const b = ecardPick(e, 1, rng);
      const res = e.play(a, b);
      if (res.roundWinner !== null) {
        roundsPlayed += 1;
        if (res.sides[res.roundWinner] === "slave") slaveWins += 1;
        const special = res.sides[0] === "emperor" ? a : b;
        if (special === "emperor") turns[res.turn - 1] += 1;
      }
    }
  }
  const rate = slaveWins / roundsPlayed;
  assert.ok(Math.abs(rate - 0.2) < 0.02, `${rate}`);
});

test("동전 순서: 나중에 고른 쪽의 순서, Conway 확률이 Wikipedia 표와 맞다", () => {
  assert.equal(bestReply("HHH"), "THH");
  assert.equal(bestReply("HTH"), "HHT");
  assert.equal(bestReply("TTT"), "HTT");
  assert.ok(near(firstChance("THH", "HHH"), 7 / 8));
  assert.ok(near(firstChance("THH", "HHT"), 3 / 4));
  assert.ok(near(firstChance("HHT", "HTH"), 2 / 3));
  for (const s of allSequences(3)) assert.ok(firstChance(bestReply(s), s) >= 2 / 3 - 1e-9, s);
  assert.ok(near(firstChance("HTH", "THT"), 0.5));
  // 던져 보면 확률과 맞다
  const rng = makeRng(11);
  let wins = 0;
  for (let i = 0; i < 4000; i++) {
    const g = createPenney();
    g.pick(0, "HTT");
    g.pick(1, "TTH");
    g.run(rng);
    if (g.winner === 0) wins += 1;
  }
  assert.ok(Math.abs(wins / 4000 - firstChance("HTT", "TTH")) < 0.03);
  const g = createPenney();
  g.pick(0, "HHT");
  assert.throws(() => g.pick(1, "HHT"));
  assert.throws(() => g.pick(1, "HHX"));
  assert.equal(penneyPick(rng, "HHT"), "THH");
  assert.ok(allSequences(3).includes(penneyPick(rng)));
});

test("이상한 주사위: Efron 고리는 2/3, Grime 은 둘씩 굴리면 두째 고리가 뒤집힌다", () => {
  const E = (id) => dieOf("efron", id);
  for (const [a, b] of [["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"]]) assert.ok(near(duelOdds(E(a), E(b)).win, 2 / 3), `${a}>${b}`);
  assert.ok(near(duelOdds(E("C"), E("A")).win, 5 / 9));
  assert.ok(near(duelOdds(E("B"), E("D")).win, 1 / 2));
  const G = (id) => dieOf("grime", id);
  const beats = (a, b, n) => duelOdds(G(a), G(b), n).win > duelOdds(G(a), G(b), n).lose;
  for (const [a, b] of [["A", "B"], ["B", "C"], ["C", "D"], ["D", "E"], ["E", "A"]]) assert.ok(beats(a, b, 1), `첫 고리 ${a}>${b}`);
  for (const [a, b] of [["A", "C"], ["C", "E"], ["E", "B"], ["B", "D"], ["D", "A"]]) {
    assert.ok(beats(a, b, 1), `두째 고리 ${a}>${b}`);
    assert.ok(beats(b, a, 2), `둘씩이면 뒤집힌다 ${b}>${a}`);
  }
  assert.ok(beats("D", "C", 2), "첫 고리에서 둘씩 굴리면 D 가 C 를 이기는 것 하나만 다르다");
  for (const d of DICE_SETS.efron) assert.notEqual(bestDie("efron", d.id), d.id);
  assert.equal(bestDie("efron", "A"), "D");
  const g = createDiceDuel({ rolls: 3 });
  g.choose(0, "A");
  assert.throws(() => g.choose(1, "A"));
  g.choose(1, dicePick(makeRng(1), "efron", "A"));
  assert.equal(g.dice[1], "D");
  g.roll(null, [[4], [1]]);
  g.roll(null, [[0], [5]]);
  g.roll(null, [[4], [5]]);
  assert.ok(g.done);
  assert.equal(g.winner, 1);
});

test("모라와 홀짝", () => {
  const g = createMorra({ target: 2 });
  assert.equal(g.play(2, 5, 3, 4).point, 0);
  assert.equal(g.play(1, 3, 2, 3).point, null, "둘 다 맞히면 점수 없음");
  assert.equal(g.play(0, 9, 0, 8).point, null, "둘 다 틀림");
  g.play(5, 10, 5, 7);
  assert.ok(g.done);
  assert.equal(g.winner, 0);
  assert.throws(() => createMorra().play(6, 6, 0, 0));
  const o = createOddEven({ target: 1, odd: 1 });
  assert.equal(o.play(1, 2).winner, 1);
  assert.ok(o.done);
  const rng = makeRng(2);
  for (let i = 0; i < 100; i++) {
    const m = morraPick(rng);
    assert.ok(m.fingers >= 0 && m.fingers <= 5 && m.guess >= m.fingers && m.guess <= m.fingers + 5);
  }
});

test("블로토: 나눔 66가지, 컴퓨터 비율은 거의 못 이긴다", () => {
  assert.equal(allocations(3, 10).length, 66);
  assert.ok(isAllocation([3, 3, 4], 3, 10));
  assert.ok(!isAllocation([3, 3, 3], 3, 10));
  assert.deepEqual(fieldsWon([5, 5, 0], [4, 4, 2]), [2, 1]);
  assert.equal(blottoCmp([4, 3, 3], [4, 3, 3]), 0);
  const m = blottoMix(3, 10);
  assert.ok(m.exploit < 0.01, `${m.exploit}`);
  assert.ok(near(m.mix.reduce((a, b) => a + b, 0), 1, 1e-9));
  const rng = makeRng(4);
  for (let i = 0; i < 50; i++) {
    assert.ok(isAllocation(blottoPick(rng, 3, 10), 3, 10));
    assert.ok(isAllocation(blottoPick(rng, 5, 20), 5, 20), "나눔이 많으면 고르게");
  }
  const g = createBlotto({ target: 1 });
  assert.throws(() => g.play([10, 0], [5, 5, 0]));
  g.play([6, 4, 0], [5, 0, 5]);
  assert.ok(g.done);
  assert.equal(g.winner, 0);
});

test("가위바위보 장기: 처음 수, 잡기·올라타기·놓기, 컴퓨터가 아무렇게나 두는 쪽을 이긴다", () => {
  assert.equal(meet("rock", "scissors"), "capture");
  assert.equal(meet("scissors", "rock"), null);
  assert.equal(meet("paper", "paper"), "stack");
  assert.equal(meet("scissors", "king"), "capture");
  assert.equal(meet("king", "paper"), "capture");
  const g = createShogi();
  const first = g.moves();
  assert.ok(first.length > 0);
  assert.ok(first.every((m) => m.kind === "move"));
  // 보가 앞의 상대 보 위에 올라탄다: 깔린 상대 보는 못 움직인다
  g.play({ kind: "move", from: [1, 2], to: [1, 1] });
  assert.equal(g.board[1][1].length, 2);
  assert.ok(!legalMoves(g, 1).some((m) => m.kind === "move" && m.from[0] === 1 && m.from[1] === 1), "깔린 말은 못 움직인다");
  // 상대 바위(2,0)로 내 보(1,1 위)를 잡는다: 보가 바위를 이기므로 바위는 못 간다
  assert.ok(!legalMoves(g, 1).some((m) => m.kind === "move" && m.from[0] === 2 && m.to[0] === 1 && m.to[1] === 1));
  // 상대 가위(0,0)는 대각선으로 (1,1) 의 내 보를 잡는다
  const cap = { kind: "move", from: [0, 0], to: [1, 1] };
  assert.ok(legalMoves(g, 1).some((m) => m.from && m.from[0] === 0 && m.from[1] === 0 && m.to[0] === 1 && m.to[1] === 1));
  const r = g.play(cap);
  assert.equal(r.captured, "paper");
  assert.equal(g.hands[1].paper, 1);
  assert.deepEqual(g.board[1][1].map((p) => p.type), ["paper", "scissors"], "잡은 뒤 상대 보 위에 올라탄다");
  // 놓기: 손의 말은 빈칸에만 놓는다. 나는 손에 든 말이 없다
  const empty = g.board.flat().filter((st) => st.length === 0).length;
  assert.equal(legalMoves(g, 1).filter((m) => m.kind === "drop").length, empty);
  assert.equal(g.turn, 0);
  assert.ok(g.moves().every((m) => m.kind === "move"));
  // 컴퓨터(깊이 3)가 아무렇게나 두는 쪽을 대부분 이긴다
  let wins = 0;
  for (let k = 0; k < 12; k++) {
    const rng = makeRng(100 + k);
    const s = createShogi({ maxPlies: 120 });
    while (!s.done) {
      if (s.turn === 0) s.play(shogiPick(s, rng, 3));
      else s.play(rng.pick(s.moves()));
    }
    if (s.winner === 0) wins += 1;
  }
  assert.ok(wins >= 10, `${wins}/12`);
});

test("여럿이 규칙: 많은 손·적은 손, 셋 다 나오면 가위, 둘이면 보통 규칙", () => {
  assert.equal(winningHand(C, [R, R, S, P], "majority"), R);
  assert.equal(winningHand(C, [R, R, S, S, P], "majority"), null, "가장 많은 손이 둘");
  assert.equal(winningHand(C, [R, R, S, P, P], "minority"), S);
  assert.equal(winningHand(C, [R, R, R], "minority"), null, "모두 같은 손");
  assert.equal(winningHand(C, [R, S, P]), null);
  assert.equal(winningHand(C, [R, S, P], "rps", "scissors"), S);
  assert.equal(winningHand(C, [R, R, S]), R);
  const g = createGroup(C, { players: 4, rule: "minority" });
  g.play({ 0: S, 1: R, 2: R, 3: R });
  assert.ok(g.done);
  assert.equal(g.last, 0, "적게 나온 손을 낸 한 명이 남는다");
  const h = createGroup(C, { players: 3, rule: "majority" });
  h.play({ 0: R, 1: R, 2: P });
  assert.deepEqual(h.alive, [0, 1]);
  h.play({ 0: R, 1: S });
  assert.equal(h.last, 0, "둘이 남으면 보통 가위바위보");
  const k = createGroup(C, { players: 3, tie3: "scissors" });
  k.play({ 0: S, 1: R, 2: P });
  assert.equal(k.last, 0);
});

test("진행자 이기기: 진 사람은 빠지고, 모두 지면 없던 판, 점수로 우승", () => {
  const g = createHostGame(C, { players: 3, rounds: 3 });
  let r = g.play(R, { 0: P, 1: R, 2: S });
  assert.deepEqual(r.out, [2]);
  assert.deepEqual(g.score, [10, 5, 0]);
  r = g.play(P, { 0: R, 1: R });
  assert.ok(r.voided, "모두 지면 다시");
  assert.deepEqual(g.alive, [0, 1]);
  assert.equal(g.round, 1);
  g.play(S, { 0: S, 1: S });
  g.play(R, { 0: R, 1: R });
  assert.ok(g.done);
  assert.deepEqual(g.winners, [0]);
  const h = createHostGame(C, { players: 2, rounds: 5 });
  h.play(R, { 0: P, 1: S });
  assert.ok(h.done);
  assert.deepEqual(h.winners, [0]);
});

test("편 술래잡기와 편 가르기", () => {
  const rng = makeRng(8);
  const g = createTeamTag(C, { size: 3, catchChance: 1 });
  assert.equal(g.myTeam(), 0);
  g.play(R, R, rng);
  assert.equal(g.round, 0, "비기면 다시");
  g.play(R, P, rng, { escaped: true });
  assert.deepEqual(g.teams[0], [0], "나만 달아났다");
  assert.deepEqual(g.teams[1].length, 5);
  g.play(R, P, rng, { escaped: false });
  assert.ok(g.done);
  assert.equal(g.myTeam(), 1);
  assert.equal(g.winner, 1);
  assert.ok(near(splitChance(10), 252 / 1024));
  assert.ok(near(splitChance(3), 6 / 8));
  assert.ok(Math.abs(expectedSplitTries(10) - 4.06) < 0.01);
  const s = createTeamSplit({ players: 4 });
  assert.equal(s.play([0, 0, 0, 1]).even, false);
  s.play([0, 1, 1, 0]);
  assert.ok(s.done);
  assert.deepEqual(s.teams, [[0, 3], [1, 2]]);
  assert.equal(s.tries, 2);
});

test("화면 준비 중(draft) 항목은 도감에 안 보이고, 영어와 출처가 있다", async () => {
  const cat = await import("../web/js/data/catalog.js");
  const { setLang } = await import("../web/js/i18n.js");
  const ids = ["hammer", "donpappa", "relay", "ecard", "shogi", "penney", "dice", "morra", "blotto", "majority", "choki", "host", "teamtag", "teamsplit"];
  // 화면이 붙은 항목은 프론트엔드가 draft 를 지워 도감에 나온다(11-08 프론트엔드: 하나씩 열 수 있게 고침)
  const drafts = cat.DRAFTS.map((e) => e.id);
  assert.ok(drafts.every((id) => ids.includes(id)), `draft 는 11-08 놀이만: ${drafts}`);
  for (const id of ids) {
    if (drafts.includes(id)) assert.equal(cat.findEntry(id), null, `${id} 는 아직 도감에 없다`);
    else assert.ok(cat.findEntry(id), `${id} 는 화면이 생겨 도감에 있다`);
    const e = cat.findAnyEntry(id);
    assert.ok(e && e.about.length === 2 && e.sources.length, id);
  }
  assert.ok(cat.CATALOG.every((e) => !e.draft));
  assert.ok(cat.CATEGORIES.every((c) => cat.CATALOG.some((e) => e.cat === c.id)), "빈 갈래는 빠진다");
  const HANGUL = /[ㄱ-ㆎ가-힣]/;
  try {
    setLang("en");
    for (const e of ids.map((id) => cat.findAnyEntry(id))) {
      const text = [e.name, e.sub || "", e.origin, ...e.about, ...e.sources.map((s) => s.t)].join(" ");
      assert.ok(!HANGUL.test(text), `${e.id} 영어에 한글이 남았다`);
    }
  } finally {
    setLang("ko");
  }
});
