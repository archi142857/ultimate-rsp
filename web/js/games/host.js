// 진행자 이기기(審判方式, ZEP 가위바위보 미니 게임). 0번이 나. 진행자는 따로 있다(컴퓨터나 방장).
// 진행자가 먼저 손을 정하고 모두 각자 낸다. 진행자에게 진 사람은 빠지고, 이기면 win 점, 비기면 draw 점을 얻고 남는다.
// 한 명만 남거나 rounds 판이 끝나면 끝난다. 끝까지 둘 이상 남으면 점수가 가장 높은 사람(들)이 이긴다.
// 남은 사람이 모두 지면 그 판은 없던 것으로 하고 다시 한다(모두 빠지지 않게).

export function createHostGame(V, { players = 10, rounds = 10, win = 10, draw = 5 } = {}) {
  const g = {
    players,
    rounds,
    points: { win, draw },
    alive: Array.from({ length: players }, (_, i) => i),
    score: new Array(players).fill(0),
    round: 0,
    log: [],
    done: false,
    winners: [],
    /** host: 진행자 손. throwsByPlayer: { 사람 번호: 손 } (남은 사람 모두) */
    play(host, throwsByPlayer) {
      if (g.done) throw new Error("이미 끝났다");
      const result = {};
      const out = [];
      for (const p of g.alive) {
        const c = V.cmp(throwsByPlayer[p], host);
        result[p] = c > 0 ? "win" : c === 0 ? "draw" : "lose";
        if (c < 0) out.push(p);
      }
      const r = { round: g.round + 1, host, throws: { ...throwsByPlayer }, result, out: [], voided: false };
      if (out.length === g.alive.length) {
        r.voided = true;
      } else {
        for (const p of g.alive) if (result[p] !== "lose") g.score[p] += result[p] === "win" ? win : draw;
        r.out = out;
        g.alive = g.alive.filter((p) => !out.includes(p));
        g.round += 1;
      }
      r.alive = g.alive.slice();
      r.score = g.score.slice();
      g.log.push(r);
      if (g.alive.length <= 1 || g.round >= rounds) {
        g.done = true;
        if (g.alive.length === 1) g.winners = g.alive.slice();
        else {
          const best = Math.max(...g.alive.map((p) => g.score[p]));
          g.winners = g.alive.filter((p) => g.score[p] === best);
        }
      }
      return r;
    },
  };
  return g;
}
