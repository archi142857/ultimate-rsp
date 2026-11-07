// 방 화면이 쓰는 값 계산. DOM 없이 시험하려고 room.js 와 따로 둔다.
// room 의 꼴은 온라인 규약 3.5(서버 room.js 의 view).

import { t } from "../i18n.js";
import { botInfo } from "../core/bots.js";

/** 둘이서: 내 자리와 상대 자리. 구경꾼이면 0번 자리를 왼쪽에 둔다 */
export function sidesOf(you) {
  const me = you === 1 ? 1 : 0;
  return { me, op: 1 - me };
}

/** 0번 자리 쪽에서 본 cmp(hist)를 me 쪽에서 본 값으로 */
export const cmpFor = (cmp, me) => (me === 0 ? cmp : -cmp);

/** 자리 이름: 사람은 닉네임, 컴퓨터는 '컴퓨터'(사람이 나가서 이은 자리면 그 사람 이름을 붙인다), 빈자리 */
export function seatName(seat) {
  if (!seat || seat.kind === "empty") return t("빈자리");
  if (seat.kind === "bot") return seat.name ? t("{name}(컴퓨터)", { name: seat.name }) : t("컴퓨터");
  return seat.name;
}

/** 컴퓨터 자리의 전략 이름(여럿이 하면 늘 '주사위') */
export const seatBot = (seat) => (seat && seat.kind === "bot" ? botInfo(seat.bot).name : null);

/** 남은 초(올림, 0 아래로는 안 간다). 마감이 없으면 null */
export function secondsLeft(deadline, now) {
  if (!Number.isFinite(deadline)) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** 구경꾼이 앉을 수 있나: 대기실·끝일 때 빈자리나 컴퓨터 자리가 있으면 */
export function canSit(room) {
  return (room.phase === "lobby" || room.phase === "end") && room.seats.some((s) => s.kind === "empty" || s.kind === "bot");
}

/** 둘이서 끝난 경기를 me 쪽에서 본 값: 1 이김, −1 짐, 0 비김(endless 동점) */
export function finalFor(room, me) {
  if (room.winner === 0 || room.winner === 1) return room.winner === me ? 1 : -1;
  return 0;
}

/** 지난 판 한 줄에 쓸 값. 둘이서 hist: { r, hands: [h0, h1], cmp } */
export function duelRound(V, entry, me) {
  const op = 1 - me;
  const mi = V.index[entry.hands[me]];
  const oi = V.index[entry.hands[op]];
  if (mi === undefined || oi === undefined) return null;
  return { r: entry.r, mi, oi, cmp: cmpFor(entry.cmp, me) };
}

/** 여럿이 hist: { r, hands: [..., null], win, out } → 이긴 손 번호와 빠진 자리 */
export function groupRound(V, entry) {
  const hands = entry.hands.map((id) => (id === null ? null : V.index[id] ?? null));
  const win = entry.win === null || entry.win === undefined ? null : V.index[entry.win] ?? null;
  return { r: entry.r, hands, win, out: Array.isArray(entry.out) ? entry.out : [] };
}

/** 사람 수 세기 */
export function headcount(room) {
  let humans = 0;
  let empty = 0;
  for (const s of room.seats) {
    if (s.kind === "human") humans++;
    else if (s.kind === "empty") empty++;
  }
  return { humans, empty, total: room.seats.length };
}

/** 고리에 놓을 자리 차례: 나부터 시계 방향(구경꾼이면 0번부터) */
export function ringOrder(n, you) {
  const start = Number.isInteger(you) && you >= 0 && you < n ? you : 0;
  return Array.from({ length: n }, (_, k) => (start + k) % n);
}

/**
 * 대기실 준비(서버가 seats 에 ready 를 줄 때만 쓴다. 규약에 더해 달라고 부탁해 둠).
 * 방장은 늘 준비로 센다. all 은 사람이 모두 준비했나
 */
export function readyInfo(room) {
  let total = 0;
  let ready = 0;
  let supported = false;
  room.seats.forEach((s, i) => {
    if (s.kind !== "human") return;
    total++;
    if (typeof s.ready === "boolean") supported = true;
    if (i === room.host || s.ready === true) ready++;
  });
  return { supported, ready, total, all: supported && total > 0 && ready === total };
}

/** 0:42 */
export function mmss(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 둘이서 판 결과: 이긴 자리(없으면 null) */
export const duelWinnerSeat = (cmp) => (cmp > 0 ? 0 : cmp < 0 ? 1 : null);

/**
 * 끝난 경기의 순위: [{ seat, rank, score }] (rank 는 1, 2, 2, 4 처럼 같으면 같은 등수).
 * 둘이서는 이긴 판 수. 여럿이는 빠진 차례: 마지막 한 명이면 늦게 빠질수록 위(끝까지 남은 사람 1등),
 * 술래 한 명이면 일찍 빠져나갈수록 위(술래가 꼴찌). hist 는 최근 20판뿐이라 그보다 앞서 빠진 자리는 0판으로 본다.
 */
export function ranking(room) {
  const seats = room.seats.map((s, i) => i).filter((i) => room.seats[i].kind !== "empty");
  let score;
  if (room.rules && room.rules.game === "group") {
    const outAt = new Map();
    for (const e of room.hist || []) for (const s of e.out || []) if (!outAt.has(s)) outAt.set(s, e.r);
    const loser = room.rules.mode === "loser";
    score = (i) => (i === room.last ? (loser ? -Infinity : Infinity) : loser ? -(outAt.get(i) || 0) : outAt.get(i) || 0);
    const rows = seats.map((i) => ({ seat: i, key: score(i), out: i === room.last ? null : outAt.get(i) ?? 0 }));
    return rankRows(rows);
  }
  const rows = seats.map((i) => ({ seat: i, key: (room.score && room.score[i]) || 0, score: (room.score && room.score[i]) || 0 }));
  return rankRows(rows);
}

function rankRows(rows) {
  rows.sort((a, b) => b.key - a.key || a.seat - b.seat);
  let rank = 0;
  return rows.map((r, k) => {
    if (k === 0 || r.key !== rows[k - 1].key) rank = k + 1;
    const out = { seat: r.seat, rank };
    if ("score" in r) out.score = r.score;
    if ("out" in r) out.out = r.out;
    return out;
  });
}
