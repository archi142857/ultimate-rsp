// 랭킹 저장소(rank-do.js)가 쓰는 순수 함수. 점수 계산은 web/js/core/rating.js(컨셉)를 그대로 쓴다.
// 저장 열쇠는 pid 의 해시다. pid 는 그 사람만 아는 값이라 순위표·방 어디에도 내보내지 않는다.

import { newRecord } from "../../web/js/core/rating.js";

/** pid → 저장 열쇠(SHA-256 앞 16바이트, 16진수 32자) */
export async function rankKey(pid) {
  const data = new TextEncoder().encode(`ursp-rank:${pid}`);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(h.subarray(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 저장된 줄 → rating.js 기록(없으면 처음 기록) */
export function fromRow(row) {
  if (!row) return newRecord();
  return { rating: row.rating, games: row.games, wins: row.wins, losses: row.losses, draws: row.draws };
}

/** 순위표 한 줄(이름·그림과 기록만. 그림은 마지막 경기 때 것, 없으면 null) */
export function boardEntry(row) {
  return { name: row.name, face: row.face ?? null, rating: row.rating, games: row.games, wins: row.wins, losses: row.losses, draws: row.draws };
}

/** 경기 뒤 방에 실을 기록(바뀐 점수 delta 포함) */
export function afterEntry(rec) {
  return { rating: rec.rating, delta: rec.delta, games: rec.games, wins: rec.wins, losses: rec.losses, draws: rec.draws };
}
