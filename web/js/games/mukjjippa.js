// 묵찌빠. 0 = 나, 1 = 상대. 손은 가위바위보 변종(V)의 번호를 쓴다.
// 1단계(rps): 가위바위보로 공격을 정한다. 2단계(attack): 같은 손이면 공격이 이기고, 다르면 그 판에 이긴 쪽이 공격.

export const CALL = { rock: "묵", scissors: "찌", paper: "빠" };

export function createMukjjippa(V) {
  const g = {
    phase: "rps",
    attacker: null,
    rounds: [],
    done: false,
    winner: null,
    play(a, b) {
      if (g.done) throw new Error("이미 끝났다");
      const c = V.cmp(a, b);
      const r = { phase: g.phase, attackerBefore: g.attacker, a, b, cmp: c, note: "" };
      if (g.phase === "rps") {
        if (c === 0) r.note = "again";
        else {
          g.attacker = c > 0 ? 0 : 1;
          g.phase = "attack";
          r.note = "start";
        }
      } else if (a === b) {
        g.done = true;
        g.winner = g.attacker;
        r.note = "hit";
      } else {
        const next = c > 0 ? 0 : 1;
        r.note = next === g.attacker ? "keep" : "swap";
        g.attacker = next;
      }
      r.attackerAfter = g.attacker;
      g.rounds.push(r);
      return r;
    },
  };
  return g;
}

/** 둘 다 아무렇게나 낼 때 공격 쪽이 결국 이길 확률(2/3). 공격 단계 판정표가 순환 행렬이라 고르게 섞는 게 최선이다 */
export const ATTACKER_EDGE = 2 / 3;
