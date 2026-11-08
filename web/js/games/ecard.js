// 황제와 노예(만화 「도박묵시록 카이지」의 E카드를 둘이 하는 놀이로 줄였다). 0 = 나, 1 = 상대.
// 황제는 시민을, 시민은 노예를, 노예는 황제를 이긴다. 시민끼리는 비기고 남은 카드로 계속 낸다.
// 황제 쪽은 황제 1장·시민 4장, 노예 쪽은 노예 1장·시민 4장을 들고 한 장씩 같이 낸다. 황제나 노예가 나오면 그 판이 끝난다.
// 한 경기는 rounds 판이고 swapEvery 판마다 쪽을 바꾼다. 황제 쪽으로 이기면 emperorPoints, 노예 쪽으로 이기면 slavePoints.
//
// 기본 점수 4: 특별 카드(황제·노예)를 몇 번째에 낼지 둘이 몰래 고르는 셈이라, 둘 다 최선이면 다섯 차례에 고르게 낸다.
// 그러면 노예 쪽은 1/5 로 이긴다. 노예 쪽이 4점을 받으면 두 쪽의 기대 점수(4/5 × 1 = 1/5 × 4)가 같다.
// 만화에서는 노예 쪽이 이기면 돈을 5배 받는다.

import { lang } from "../i18n.js";

export const ECARDS = ["emperor", "citizen", "slave"];
const NAMES_KO = { emperor: "황제", citizen: "시민", slave: "노예", emperorSide: "황제 쪽", slaveSide: "노예 쪽" };
const NAMES_EN = { emperor: "Emperor", citizen: "Citizen", slave: "Slave", emperorSide: "Emperor side", slaveSide: "Slave side" };
/** 카드 이름(지금 언어) */
export function ecardNames() {
  return lang() === "en" ? NAMES_EN : NAMES_KO;
}
export const ECARD_EMOJI = { emperor: "👑", citizen: "🧑", slave: "⛓️" };

const BEATS = { emperor: "citizen", citizen: "slave", slave: "emperor" };
/** 카드끼리 겨루기: 1 = x 가 이김, -1 = 짐, 0 = 비김 */
export function cmpCard(x, y) {
  if (x === y) return 0;
  return BEATS[x] === y ? 1 : -1;
}

const fullHand = (side) => (side === "emperor" ? { emperor: 1, citizen: 4, slave: 0 } : { emperor: 0, citizen: 4, slave: 1 });

export function createEcard({ rounds = 12, swapEvery = 3, emperorPoints = 1, slavePoints = 4 } = {}) {
  const g = {
    rounds,
    swapEvery,
    emperorPoints,
    slavePoints,
    round: 0,
    sides: ["emperor", "slave"],
    hand: [fullHand("emperor"), fullHand("slave")],
    turn: 0,
    score: [0, 0],
    log: [],
    done: false,
    winner: null,
    allowed(p) {
      return ECARDS.filter((c) => g.hand[p][c] > 0);
    },
    left(p) {
      return ECARDS.reduce((s, c) => s + g.hand[p][c], 0);
    },
    play(ca, cb) {
      if (g.done) throw new Error("이미 끝났다");
      if (!(g.hand[0][ca] > 0) || !(g.hand[1][cb] > 0)) throw new Error("없는 카드");
      g.hand[0][ca] -= 1;
      g.hand[1][cb] -= 1;
      g.turn += 1;
      const c = cmpCard(ca, cb);
      const r = { round: g.round, turn: g.turn, sides: g.sides.slice(), a: ca, b: cb, cmp: c, roundWinner: null, points: 0 };
      if (c !== 0) {
        const w = c > 0 ? 0 : 1;
        r.roundWinner = w;
        r.points = g.sides[w] === "slave" ? slavePoints : emperorPoints;
        g.score[w] += r.points;
        g.round += 1;
        g.turn = 0;
        if (g.round >= rounds) {
          g.done = true;
          g.winner = g.score[0] > g.score[1] ? 0 : g.score[1] > g.score[0] ? 1 : -1;
        } else {
          if (g.round % swapEvery === 0) g.sides = [g.sides[1], g.sides[0]];
          g.hand = [fullHand(g.sides[0]), fullHand(g.sides[1])];
        }
      }
      r.score = g.score.slice();
      g.log.push(r);
      return r;
    },
  };
  return g;
}

/**
 * 컴퓨터: 특별 카드를 남은 장수 가운데 1장 꼴(1/남은 장수)로 낸다. 그러면 특별 카드를 내는 차례가 다섯 차례에 고르게 퍼진다.
 */
export function ecardPick(game, p, rng) {
  const hand = game.hand[p];
  const special = hand.emperor > 0 ? "emperor" : hand.slave > 0 ? "slave" : null;
  if (!special) return "citizen";
  if (hand.citizen === 0) return special;
  return rng.chance(1 / game.left(p)) ? special : "citizen";
}
