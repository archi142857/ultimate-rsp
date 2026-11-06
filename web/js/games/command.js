// 명령 가위바위보: 손 하나와 명령(이겨라·져라·비겨라)을 보고 맞는 손을 낸다.

import { t } from "../i18n.js";

export const ORDERS = [
  { id: "win", get name() { return t("이겨라"); }, weight: 0.45 },
  { id: "lose", get name() { return t("져라"); }, weight: 0.45 },
  { id: "draw", get name() { return t("비겨라"); }, weight: 0.1 },
];

export function createCommand(V, rng, seconds = 30) {
  const g = {
    seconds,
    score: 0,
    miss: 0,
    prompt: null,
    log: [],
    next() {
      let hand = rng.int(V.n);
      let order = ORDERS[rng.weighted(ORDERS.map((o) => o.weight))];
      // 같은 문제가 두 번 이어지지 않게
      if (g.prompt && g.prompt.hand === hand && g.prompt.order.id === order.id) hand = (hand + 1) % V.n;
      g.prompt = { hand, order };
      return g.prompt;
    },
    /** 맞는 손인지 */
    isRight(h, p = g.prompt) {
      const c = V.cmp(h, p.hand);
      if (p.order.id === "win") return c > 0;
      if (p.order.id === "lose") return c < 0;
      return h === p.hand;
    },
    /** 맞는 손(들) */
    answers(p = g.prompt) {
      return V.hands.map((x) => x.i).filter((h) => g.isRight(h, p));
    },
    answer(h, ms = 0) {
      const p = g.prompt;
      const ok = g.isRight(h, p);
      if (ok) g.score += 1;
      else g.miss += 1;
      g.log.push({ ...p, h, ok, ms });
      return ok;
    },
  };
  return g;
}
