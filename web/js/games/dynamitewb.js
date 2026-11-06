// 다이너마이트와 물풍선: 가위·바위·보 + 다이너마이트(개수 제한) + 물풍선. 비긴 점수 넘기기를 켤 수 있다.

export const DWB_DEF = {
  id: "dynamitewb",
  kind: "matrix",
  name: "다이너마이트와 물풍선",
  hands: [
    { id: "scissors", name: "가위", emoji: "✌️" },
    { id: "rock", name: "바위", emoji: "✊" },
    { id: "paper", name: "보", emoji: "✋" },
    { id: "dynamite", name: "다이너마이트", emoji: "🧨" },
    { id: "balloon", name: "물풍선", emoji: "🎈" },
  ],
  order: ["rock", "scissors", "paper", "dynamite", "balloon"],
  rel: [
    ["rock", "scissors", "부순다"],
    ["scissors", "paper", "자른다"],
    ["paper", "rock", "감싼다"],
    ["dynamite", "rock", "날려 버린다"],
    ["dynamite", "scissors", "날려 버린다"],
    ["dynamite", "paper", "불사른다"],
    ["balloon", "dynamite", "적셔 꺼뜨린다"],
    ["rock", "balloon", "터뜨린다"],
    ["scissors", "balloon", "찔러 터뜨린다"],
    ["paper", "balloon", "막아 낸다"],
  ],
};

/**
 * '폭탄 꾼': 비겨서 점수가 쌓였을 때 다이너마이트를 쓰고, 상대가 그런 버릇을 보이면 물풍선으로 받는다.
 * ctx: { rounds(경기 기록, a=나 b=상대가 아니라 side 기준으로 넘긴다), allowed, side }
 */
export function createDwbBot(V, rng, kind = "bomber") {
  const D = V.index.dynamite;
  const W = V.index.balloon;
  const basic = [V.index.rock, V.index.scissors, V.index.paper];
  return {
    kind,
    pick({ rounds, allowed, side }) {
      const theirs = (r) => (side === 0 ? r.b : r.a);
      if (kind === "random") {
        const opts = V.hands.map((h) => h.i).filter((i) => allowed[i]);
        return rng.pick(opts);
      }
      const pot = rounds.length ? rounds[rounds.length - 1].pot : 1;
      // 상대가 '비긴 뒤 다이너마이트'를 얼마나 했는지
      let heavy = 0;
      let heavyDyn = 0;
      for (let t = 0; t < rounds.length; t++) {
        const before = t ? rounds[t - 1].pot : 1;
        if (before >= 2) {
          heavy += 1;
          if (theirs(rounds[t]) === D) heavyDyn += 1;
        }
      }
      const theyBomb = heavy >= 2 && heavyDyn / heavy >= 0.4;
      if (pot >= 2 && theyBomb && rng.chance(0.6)) return W;
      if (allowed[D] && pot >= 2 && rng.chance(Math.min(0.85, 0.35 * pot))) return D;
      if (allowed[D] && rng.chance(0.04)) return D;
      return rng.pick(basic);
    },
  };
}
