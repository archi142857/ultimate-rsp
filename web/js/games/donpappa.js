// 돈파파(ドンパッパ, グリンピース). 0 = 나, 1 = 상대. 손은 가위바위보 변종(V)의 번호.
// 1단계(janken): 가위바위보로 선공을 정한다.
// 2단계(call): 선공이 '지금 손, 지금 손, 다음 손'을 외치며 세 번 내고, 후공도 박자에 맞춰 세 번 낸다.
//   앞의 두 번은 지금 손 그대로라 정할 것이 없다. 둘이 정하는 것은 셋째 손뿐이다.
//   셋째 손이 같으면 먼저 "돈!"을 외친 쪽이 이긴다(같은 때면 선공). 정한 시간 안에 아무도 안 외치면 그대로 다시 한다.
//   셋째 손이 다르면 공수가 바뀌고, 셋째 손이 새 '지금 손'이 된다.
// falseStart 를 켜면 셋째 손이 다를 때 "돈!"을 외친 쪽이 진다(간사이에서 하는 규칙).

import { lang } from "../i18n.js";
import { firstPress } from "./reaction.js";

/** 셋째 손이 같을 때 "돈!"을 외칠 수 있는 시간(ms) */
export const DON_MS = 2000;

const CALLS_KO = { rock: "그린", scissors: "치린", paper: "파린", don: "돈" };
const CALLS_EN = { rock: "Gurin", scissors: "Chirin", paper: "Parin", don: "Don" };
/** 손마다 외치는 말(지금 언어). 일본어로는 グリン·チリン·パリン, ドン */
export function donCalls() {
  return lang() === "en" ? CALLS_EN : CALLS_KO;
}
export const DON_KANA = { rock: "グリン", scissors: "チリン", paper: "パリン", don: "ドン" };

export function createDonpappa(V, { falseStart = false, limit = DON_MS } = {}) {
  const g = {
    falseStart,
    limit,
    phase: "janken",
    attacker: null,
    current: [null, null],
    rounds: [],
    done: false,
    winner: null,
    janken(a, b) {
      if (g.done || g.phase !== "janken") throw new Error("지금은 가위바위보 차례가 아니다");
      const c = V.cmp(a, b);
      const r = { kind: "janken", a, b, cmp: c };
      if (c !== 0) {
        g.attacker = c > 0 ? 0 : 1;
        g.current = [a, b];
        g.phase = "call";
      }
      g.rounds.push(r);
      return r;
    },
    /** a3, b3: 셋째 손. donA, donB: 셋째 손을 보인 뒤 "돈!"을 누른 시각(안 눌렀으면 Infinity) */
    call(a3, b3, donA = Infinity, donB = Infinity) {
      if (g.done || g.phase !== "call") throw new Error("지금은 셋째 손 차례가 아니다");
      const same = a3 === b3;
      const r = { kind: "call", attacker: g.attacker, current: g.current.slice(), a3, b3, same, donA, donB, result: "" };
      if (same) {
        const first = firstPress(donA, donB, { limit, tie: g.attacker });
        if (first === null) {
          r.result = "missed";
          g.current = [a3, b3];
        } else {
          r.result = "don";
          g.done = true;
          g.winner = first;
        }
      } else {
        const early = falseStart ? firstPress(donA, donB, { limit, tie: g.attacker }) : null;
        if (early !== null) {
          r.result = "false";
          g.done = true;
          g.winner = 1 - early;
        } else {
          r.result = "swap";
          g.attacker = 1 - g.attacker;
          g.current = [a3, b3];
        }
      }
      r.attackerAfter = g.attacker;
      g.rounds.push(r);
      return r;
    },
  };
  return g;
}
