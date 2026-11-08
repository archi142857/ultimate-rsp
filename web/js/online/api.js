// 서버 주소마다 주고받는 꼴. 온라인 규약(세션소통\자료\온라인_규약.md, 규약 번호 1) 2장 도전장, 3.1 방 만들기.
// 방 안의 주고받기(WebSocket)는 room.js, 랜덤 매칭은 match.js.
//   POST /api/c              { v, pid, name, game, custom?, hands: [손 id], e? }  → 201 { code, expires }
//   GET  /api/c/<코드>?v=1                                                       → 보기 꼴
//   POST /api/c/<코드>/answer { v, pid, name, hands }                              → 200 닫힘 꼴
//     다른 사람이 먼저 답했으면 409 closed + result(닫힘 꼴), 만든 사람이면 409 own
// 보기 꼴: { code, game, custom, rounds, from, e, made, expires, open }
// 닫힘 꼴은 더해서: { to, answered, hands: { from, to }, cmp, score, winner }
//   cmp 는 판마다 만든 사람 쪽에서 본 결과(1·0·−1), winner 는 0 만든 사람, 1 받은 사람, −1 비김.
//   판정은 서버가 답할 때 한 번 해서 적어 둔다. 화면은 다시 판정하지 않고 이 값을 쓴다.

import { api, OnlineError } from "./net.js";
import { PROTOCOL } from "./config.js";
import { cleanName, faceId } from "./identity.js";

const ROUNDS = [1, 3, 5];

// face(프로필 그림)는 골랐을 때만 싣는다(규약 1.2·2·3.1, 서버 9a0879a). 서버가 모르는 그림은 null 로 받는다
export async function createChallenge({ game, custom = null, hands, name, face = null, pid, e = null }, opts = {}) {
  const body = { v: PROTOCOL, pid, name, game, hands };
  if (face) body.face = face;
  if (custom) body.custom = custom;
  if (e) body.e = e;
  const d = await api("/api/c", { ...opts, body });
  if (typeof d.code !== "string" || !d.code) throw new OnlineError("bad_reply", d);
  return { code: d.code, expires: Number.isFinite(d.expires) ? d.expires : null };
}

export async function fetchChallenge(code, opts) {
  return readChallenge(await api(`/api/c/${encodeURIComponent(code)}?v=${PROTOCOL}`, opts));
}

/** 답하기. 다른 사람이 먼저 답했으면 OnlineError("closed") 의 result 에 그 결과를 싣는다 */
export async function answerChallenge(code, { hands, name, face = null, pid }, opts = {}) {
  const body = { v: PROTOCOL, pid, name, hands };
  if (face) body.face = face;
  try {
    return readChallenge(await api(`/api/c/${encodeURIComponent(code)}/answer`, { ...opts, body }));
  } catch (e) {
    if (e.code === "closed" && e.detail && e.detail.result) {
      try {
        e.result = readChallenge(e.detail.result);
      } catch {
        /* 결과를 못 읽으면 화면이 다시 불러온다 */
      }
    }
    throw e;
  }
}

const isHandList = (a, n) => Array.isArray(a) && a.length === n && a.every((x) => typeof x === "string");

/** 서버 답을 화면이 쓰는 꼴로. 모자라거나 이상하면 bad_reply */
export function readChallenge(d) {
  const ok =
    d &&
    typeof d.code === "string" &&
    typeof d.game === "string" &&
    typeof d.from === "string" &&
    typeof d.open === "boolean" &&
    ROUNDS.includes(d.rounds);
  if (!ok) throw new OnlineError("bad_reply", d);
  const c = {
    code: d.code,
    game: d.game,
    custom: d.custom && typeof d.custom === "object" ? { n: d.custom.n, k: d.custom.k, seed: d.custom.seed } : null,
    rounds: d.rounds,
    from: cleanName(d.from) || "?",
    fromFace: faceId(d.fromFace),
    e: typeof d.e === "string" ? d.e : null,
    expires: Number.isFinite(d.expires) ? d.expires : null,
    open: d.open,
  };
  if (!d.open) {
    const n = d.rounds;
    const h = d.hands || {};
    const fine =
      isHandList(h.from, n) &&
      isHandList(h.to, n) &&
      Array.isArray(d.cmp) &&
      d.cmp.length === n &&
      d.cmp.every((x) => x === 1 || x === 0 || x === -1) &&
      Array.isArray(d.score) &&
      d.score.length === 2 &&
      [0, 1, -1].includes(d.winner);
    if (!fine) throw new OnlineError("bad_reply", d);
    c.to = cleanName(d.to) || "?";
    c.toFace = faceId(d.toFace);
    c.hands = { from: h.from.slice(), to: h.to.slice() };
    c.cmp = d.cmp.slice();
    c.score = d.score.slice();
    c.winner = d.winner;
  }
  return c;
}

/** 방 만들기(규약 3.1): 만든 사람이 방장·0번 자리. 돌려주는 값은 4자 코드 */
export async function createRoom({ rules, name, face = null, pid }, opts = {}) {
  const body = { v: PROTOCOL, pid, name, rules };
  if (face) body.face = face;
  const d = await api("/api/rooms", { ...opts, body });
  if (typeof d.code !== "string" || !d.code) throw new OnlineError("bad_reply", d);
  return d.code;
}
