// 아치무이테호이. 1단계(janken): 가위바위보, 2단계(hoi): 이긴 쪽이 가리키고 진 쪽이 고개를 돌린다.

export const DIRS = [
  { id: "up", name: "위", arrow: "↑", emoji: "⬆️" },
  { id: "down", name: "아래", arrow: "↓", emoji: "⬇️" },
  { id: "left", name: "왼쪽", arrow: "←", emoji: "⬅️" },
  { id: "right", name: "오른쪽", arrow: "→", emoji: "➡️" },
];

export function createAcchimuite(V) {
  const g = {
    phase: "janken",
    pointer: null,
    rounds: [],
    done: false,
    winner: null,
    janken(a, b) {
      if (g.phase !== "janken" || g.done) throw new Error("지금은 가위바위보 차례가 아니다");
      const c = V.cmp(a, b);
      const r = { kind: "janken", a, b, cmp: c };
      if (c !== 0) {
        g.pointer = c > 0 ? 0 : 1;
        g.phase = "hoi";
      }
      g.rounds.push(r);
      return r;
    },
    /** da: 내 방향, db: 상대 방향(가리키든 돌리든 같은 방향 목록) */
    hoi(da, db) {
      if (g.phase !== "hoi" || g.done) throw new Error("지금은 호이 차례가 아니다");
      const hit = da === db;
      const r = { kind: "hoi", da, db, pointer: g.pointer, hit };
      if (hit) {
        g.done = true;
        g.winner = g.pointer;
      } else {
        g.phase = "janken";
        g.pointer = null;
      }
      g.rounds.push(r);
      return r;
    },
  };
  return g;
}
