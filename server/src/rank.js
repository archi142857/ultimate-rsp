// 랭킹 저장소(rank-do.js)가 쓰는 순수 함수. 점수 계산은 web/js/core/rating.js(컨셉)를 그대로 쓴다.
// 저장 열쇠는 pid 의 해시다. pid 는 그 사람만 아는 값이라 순위표·방 어디에도 내보내지 않는다.

import { RANK_DAILY } from "./protocol.js";
import { newRecord } from "../../web/js/core/rating.js";

/** pid → 저장 열쇠(SHA-256 앞 16바이트, 16진수 32자) */
export async function rankKey(pid) {
  const data = new TextEncoder().encode(`ursp-rank:${pid}`);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(h.subarray(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * IP 를 '한 집' 단위로: IPv4 는 주소 그대로, IPv6 는 앞 64비트(집마다 /64 를 받고 그 안에서 주소를 자주 바꾼다).
 * IPv6 안에 든 IPv4(::ffff:1.2.3.4)는 IPv4 로 본다
 */
export function homeOf(ip) {
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (v4) return v4[1];
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return `${full.slice(0, 4).map((x) => parseInt(x || "0", 16).toString(16)).join(":")}::/64`;
}

/**
 * 랜덤 매칭에서 두 사람이 같은 곳(IP)에서 왔는지 보려는 꼬리표. IP 를 그대로 두지 않고 날마다 바뀌는 해시(앞 8바이트)만
 * 대기열 첨부에 둔다. 같은 날 같은 IP 면 같은 값. IP 가 없거나 이 컴퓨터(로컬 wrangler dev 시험)면 null(그때는 순위를 막지 않는다)
 */
export async function ipTag(ip, now) {
  if (typeof ip !== "string" || !ip || ip === "127.0.0.1" || ip === "::1") return null;
  const day = new Date(now).toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`ursp-ip:${day}:${homeOf(ip)}`);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(h.subarray(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 두 사람이 같은 곳에서 왔으면 순위에 안 넣는다(11-08 검수: pid 둘로 혼자 짜고 지면 순위가 올랐다) */
export function sameHome(tags) {
  return tags.length === 2 && !!tags[0] && tags[0] === tags[1];
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

/** 하루 상한을 세는 날(UTC 날짜. 한국 오전 9시에 바뀌고, IP 꼬리표가 바뀌는 때와 같다) */
export function dayOf(now) {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * 오늘 센 순위 경기 수로 이 경기를 셀지. counts: { a, b }(두 pid), { ha, hb }(두 사람의 같은 곳, 모르면 null).
 * pid 하나가 RANK_DAILY.pid, 같은 곳 하나가 RANK_DAILY.home 에 닿았으면 true(이 경기는 안 센다)
 */
export function overDaily({ a, b, ha = null, hb = null }, limits = RANK_DAILY) {
  return a >= limits.pid || b >= limits.pid || (ha !== null && ha >= limits.home) || (hb !== null && hb >= limits.home);
}
