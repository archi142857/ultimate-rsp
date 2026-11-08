// 가위바위보 장기. 일본 앱 「じゃんけん将棋」에서 따온 놀이를 이 앱 규칙으로 짰다. 0 = 나(아래), 1 = 상대(위).
//
// 판: 가로 3칸 × 세로 4칸. 칸마다 말이 하나나 둘(아래에 깔린 말 + 위에 올라탄 말) 있다.
// 처음 자리: 내 맨 아랫줄 왼쪽부터 바위·왕·가위, 그 앞 가운데 보. 상대는 판을 180도 돌린 자리.
// 움직임(한 칸): 왕은 여덟 방향, 바위는 앞뒤옆(✚), 가위는 대각선(✕), 보는 앞쪽 세 칸과 양옆.
// 상대 말이 있는 칸(맨 위 말을 본다)으로 갈 때:
//   - 상대가 왕이면 잡는다(어떤 말이든 왕을 잡을 수 있다). 내가 왕이면 무엇이든 잡는다.
//   - 가위바위보로 이기는 말이면 잡는다(바위 → 가위, 가위 → 보, 보 → 바위).
//   - 같은 말이면 비긴 것이라 그 위에 올라탄다. 깔린 말은 위에 무엇이 있는 동안 못 움직인다.
//   - 지는 말이면 갈 수 없다. 이미 둘이 쌓인 칸에는 맨 위를 잡을 때만 간다. 내 말이 맨 위인 칸에는 못 간다.
// 잡은 말은 내 말이 되어 손에 든다. 차례에 움직이는 대신 손의 말을 빈칸에 놓을 수 있다.
// 상대 왕을 잡으면 이긴다. maxPlies 수가 지나거나 같은 판이 세 번 나오면 비긴다.

export const SHOGI_W = 3;
export const SHOGI_H = 4;
export const PIECES = ["rock", "scissors", "paper", "king"];
const HANDABLE = ["rock", "scissors", "paper"];

const ORTH = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const DIAG = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
// 앞이 y-1 인 쪽(나) 기준. 상대는 y 를 뒤집는다
const STEPS = {
  king: [...ORTH, ...DIAG],
  rock: ORTH,
  scissors: DIAG,
  paper: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]],
};
const RPS_BEATS = { rock: "scissors", scissors: "paper", paper: "rock" };

/** 말 x 가 상대 말 y(맨 위)가 있는 칸에 들어갈 때: "capture" | "stack" | null(못 감) */
export function meet(x, y) {
  if (y === "king" || x === "king") return "capture";
  if (RPS_BEATS[x] === y) return "capture";
  if (x === y) return "stack";
  return null;
}

/** 말이 갈 수 있는 방향(판 위 좌표 차이) */
export function stepsOf(type, owner) {
  return STEPS[type].map(([dx, dy]) => [dx, owner === 0 ? dy : -dy]);
}

const piece = (type, owner) => ({ type, owner });

function startBoard() {
  const b = Array.from({ length: SHOGI_H }, () => Array.from({ length: SHOGI_W }, () => []));
  b[3][0] = [piece("rock", 0)];
  b[3][1] = [piece("king", 0)];
  b[3][2] = [piece("scissors", 0)];
  b[2][1] = [piece("paper", 0)];
  b[0][2] = [piece("rock", 1)];
  b[0][1] = [piece("king", 1)];
  b[0][0] = [piece("scissors", 1)];
  b[1][1] = [piece("paper", 1)];
  return b;
}

const inside = (x, y) => x >= 0 && x < SHOGI_W && y >= 0 && y < SHOGI_H;
const top = (stack) => stack[stack.length - 1];

function keyOf(g) {
  const cells = g.board.map((row) => row.map((st) => st.map((p) => `${p.owner}${p.type[0]}`).join("")).join(",")).join("/");
  const hands = g.hands.map((h) => HANDABLE.map((t) => h[t]).join("")).join("|");
  return `${g.turn}:${cells}:${hands}`;
}

export function createShogi({ maxPlies = 200 } = {}) {
  const g = {
    maxPlies,
    board: startBoard(),
    hands: [
      { rock: 0, scissors: 0, paper: 0 },
      { rock: 0, scissors: 0, paper: 0 },
    ],
    turn: 0,
    plies: 0,
    log: [],
    seen: new Map(),
    done: false,
    winner: null,
    end: null,
    /** 지금 차례의 모든 수 */
    moves() {
      return legalMoves(g, g.turn);
    },
    /** 수를 둔다. move: { kind: "move", from: [x, y], to: [x, y] } 또는 { kind: "drop", type, to: [x, y] } */
    play(move) {
      if (g.done) throw new Error("이미 끝났다");
      const ok = g.moves().some((m) => sameMove(m, move));
      if (!ok) throw new Error("둘 수 없는 수");
      const r = applyMove(g, move);
      g.log.push(r);
      g.plies += 1;
      if (r.captured === "king") {
        g.done = true;
        g.winner = r.by;
        g.end = "king";
      } else {
        g.turn = 1 - g.turn;
        const k = keyOf(g);
        const n = (g.seen.get(k) || 0) + 1;
        g.seen.set(k, n);
        if (n >= 3) {
          g.done = true;
          g.winner = -1;
          g.end = "repeat";
        } else if (g.plies >= maxPlies) {
          g.done = true;
          g.winner = -1;
          g.end = "plies";
        } else if (g.moves().length === 0) {
          // 둘 수가 없으면 진다(작은 판이라 드물다)
          g.done = true;
          g.winner = 1 - g.turn;
          g.end = "stuck";
        }
      }
      return r;
    },
  };
  g.seen.set(keyOf(g), 1);
  return g;
}

export function sameMove(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.to[0] !== b.to[0] || a.to[1] !== b.to[1]) return false;
  if (a.kind === "drop") return a.type === b.type;
  return a.from[0] === b.from[0] && a.from[1] === b.from[1];
}

/** side 가 둘 수 있는 모든 수 */
export function legalMoves(g, side) {
  const out = [];
  for (let y = 0; y < SHOGI_H; y++)
    for (let x = 0; x < SHOGI_W; x++) {
      const st = g.board[y][x];
      if (st.length !== 1 && !(st.length === 2)) continue;
      const p = top(st);
      if (!p || p.owner !== side) continue;
      // 깔린 말은 못 움직이고, 위에 탄 말은 움직인다
      for (const [dx, dy] of stepsOf(p.type, side)) {
        const tx = x + dx;
        const ty = y + dy;
        if (!inside(tx, ty)) continue;
        const dest = g.board[ty][tx];
        if (dest.length === 0) {
          out.push({ kind: "move", from: [x, y], to: [tx, ty] });
          continue;
        }
        const q = top(dest);
        if (q.owner === side) continue;
        const m = meet(p.type, q.type);
        if (m === "capture") out.push({ kind: "move", from: [x, y], to: [tx, ty] });
        else if (m === "stack" && dest.length === 1) out.push({ kind: "move", from: [x, y], to: [tx, ty] });
      }
    }
  for (const type of HANDABLE) {
    if (!(g.hands[side][type] > 0)) continue;
    for (let y = 0; y < SHOGI_H; y++) for (let x = 0; x < SHOGI_W; x++) if (g.board[y][x].length === 0) out.push({ kind: "drop", type, to: [x, y] });
  }
  return out;
}

/** 수를 판에 반영한다(검사는 하지 않는다). 무엇이 일어났는지 돌려준다 */
function applyMove(g, move) {
  const side = g.turn;
  const [tx, ty] = move.to;
  const dest = g.board[ty][tx];
  const r = { by: side, move, type: null, captured: null, stacked: false };
  if (move.kind === "drop") {
    g.hands[side][move.type] -= 1;
    dest.push(piece(move.type, side));
    r.type = move.type;
    return r;
  }
  const [fx, fy] = move.from;
  const src = g.board[fy][fx];
  const p = src.pop();
  r.type = p.type;
  if (dest.length) {
    const q = top(dest);
    const m = meet(p.type, q.type);
    if (m === "capture") {
      dest.pop();
      r.captured = q.type;
      if (q.type !== "king") g.hands[side][q.type] += 1;
    } else {
      r.stacked = true;
    }
  }
  dest.push(p);
  return r;
}

// ── 컴퓨터 ─────────────────────────────────────────
const VALUE = { rock: 10, scissors: 10, paper: 10, king: 1000 };

function clone(g) {
  return {
    board: g.board.map((row) => row.map((st) => st.map((p) => ({ ...p })))),
    hands: g.hands.map((h) => ({ ...h })),
    turn: g.turn,
  };
}

/** side 가 보기에 판이 얼마나 좋은가 */
function evaluate(s, side) {
  let v = 0;
  for (let y = 0; y < SHOGI_H; y++)
    for (let x = 0; x < SHOGI_W; x++) {
      const st = s.board[y][x];
      st.forEach((p, i) => {
        let w = VALUE[p.type];
        if (i === 0 && st.length === 2) w *= 0.6; // 깔려서 못 움직인다
        v += p.owner === side ? w : -w;
      });
    }
  for (const t of HANDABLE) v += 9 * (s.hands[side][t] - s.hands[1 - side][t]);
  v += 0.2 * (legalMoves(s, side).length - legalMoves(s, 1 - side).length);
  return v;
}

function search(s, depth, alpha, beta, side) {
  const moves = legalMoves(s, s.turn);
  if (depth === 0 || moves.length === 0) return evaluate(s, side);
  // 잡는 수를 먼저 본다
  moves.sort((a, b) => captureWorth(s, b) - captureWorth(s, a));
  const maxing = s.turn === side;
  let best = maxing ? -Infinity : Infinity;
  for (const m of moves) {
    const n = clone(s);
    const r = applyMove(n, m);
    let v;
    if (r.captured === "king") v = (r.by === side ? 1 : -1) * (100000 + depth);
    else {
      n.turn = 1 - n.turn;
      v = search(n, depth - 1, alpha, beta, side);
    }
    if (maxing) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }
  return best;
}

function captureWorth(s, m) {
  if (m.kind !== "move") return 0;
  const dest = s.board[m.to[1]][m.to[0]];
  return dest.length ? VALUE[top(dest).type] : 0;
}

/** 컴퓨터가 고르는 수. depth 가 클수록 세다(3이면 바로 다음 두 수까지 본다). 같은 값이면 아무거나 */
export function shogiPick(g, rng, depth = 3) {
  const side = g.turn;
  const moves = g.moves();
  let best = -Infinity;
  let picks = [];
  for (const m of moves) {
    const n = clone(g);
    const r = applyMove(n, m);
    let v;
    if (r.captured === "king") v = 1e9;
    else {
      n.turn = 1 - n.turn;
      v = search(n, depth - 1, -Infinity, Infinity, side);
    }
    if (v > best + 1e-9) {
      best = v;
      picks = [m];
    } else if (Math.abs(v - best) <= 1e-9) picks.push(m);
  }
  return picks.length ? rng.pick(picks) : null;
}
