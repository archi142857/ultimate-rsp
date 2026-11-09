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
// 여럿이 도전장(규약 2.1–2.4, 11-08 밤): 만들 때 max(2–50)·reveal. 보기 꼴에 max·count·answers(이름·그림, 열렸으면 점수·이긴 쪽)가 오고
//   손은 POST /api/c/<코드>/me {v, pid} 로만 온다: 만든 사람이면 you "from" 과 모든 답의 손·cmp, 답한 사람이면 you(번호)와 자기 결과.
//   reveal "end"(서버 2a825ec, 손 엿보기 막기)면 마감(다 참·만든 사람이 닫음) 전에는 답한 사람도 자기 손과 '냈다'만 받는다(pending).
//   마감 뒤에는 누구나 모든 손과 결과를 본다. 만든 사람은 POST /api/c/<코드>/close {v, pid} 로 닫는다.

import { api, OnlineError } from "./net.js";
import { PROTOCOL } from "./config.js";
import { cleanName, faceId } from "./identity.js";

const ROUNDS = [1, 3, 5];

// face(프로필 그림)는 골랐을 때만 싣는다(규약 1.2·2·3.1, 서버 9a0879a). 서버가 모르는 그림은 null 로 받는다
export async function createChallenge({ game, custom = null, hands, name, face = null, pid, e = null, max = 1, reveal = "end" }, opts = {}) {
  const body = { v: PROTOCOL, pid, name, game, hands };
  if (face) body.face = face;
  if (custom) body.custom = custom;
  if (e) body.e = e;
  if (max > 1) Object.assign(body, { max, reveal });
  const d = await api("/api/c", { ...opts, body });
  if (typeof d.code !== "string" || !d.code) throw new OnlineError("bad_reply", d);
  return { code: d.code, expires: Number.isFinite(d.expires) ? d.expires : null };
}

export async function fetchChallenge(code, opts) {
  return readChallenge(await api(`/api/c/${encodeURIComponent(code)}?v=${PROTOCOL}`, opts));
}

/** 내 꼴(규약 2.4): 여럿이 도전장에서 만든 사람은 모든 답의 손, 답한 사람은 자기 결과가 실린다. pid 는 주소에 안 싣는다 */
export async function fetchMyChallenge(code, { pid }, opts = {}) {
  return readChallenge(await api(`/api/c/${encodeURIComponent(code)}/me`, { ...opts, body: { v: PROTOCOL, pid } }));
}

/** 여럿이 도전장 마감(만든 사람만): 더 받지 않고 결과를 모두에게 연다. 돌려주는 값은 만든 사람 꼴 */
export async function closeChallenge(code, { pid }, opts = {}) {
  return readChallenge(await api(`/api/c/${encodeURIComponent(code)}/close`, { ...opts, body: { v: PROTOCOL, pid } }));
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
    max: Number.isInteger(d.max) && d.max > 1 ? d.max : 1,
  };
  const results = (n) => Array.isArray(n) && n.length === d.rounds && n.every((x) => x === 1 || x === 0 || x === -1);
  if (c.max > 1) {
    // 여럿이: 답한 사람 줄(손은 만든 사람에게만), 내가 누구인지(you)
    if (!Array.isArray(d.answers)) throw new OnlineError("bad_reply", d);
    c.count = Number.isInteger(d.count) ? d.count : d.answers.length;
    c.reveal = d.reveal === "end" ? "end" : "now";
    c.closed = Number.isFinite(d.closed) ? d.closed : null;
    // 저절로 마감까지 남은 ms(만든 뒤 24시간, 서버 0eb31f1 의 closes). 서버 시계(now)로 센다
    c.closesIn = Number.isFinite(d.closes) && Number.isFinite(d.now) ? Math.max(0, d.closes - d.now) : null;
    c.answers = d.answers.map((a) => {
      const row = {
        name: cleanName(a && a.name) || "?",
        face: faceId(a && a.face),
        at: Number.isFinite(a && a.at) ? a.at : null,
        // 결과를 아직 안 열었으면(reveal "end" 의 마감 전) winner 는 null: '냈다'로 보인다
        winner: a && [0, 1, -1].includes(a.winner) ? a.winner : null,
      };
      if (row.winner !== null && Array.isArray(a.score) && a.score.length === 2) row.score = a.score.slice();
      if (isHandList(a && a.hands, d.rounds) && results(a.cmp)) {
        row.hands = a.hands.slice();
        row.cmp = a.cmp.slice();
      }
      return row;
    });
    const fromHands = d.hands && isHandList(d.hands.from, d.rounds) ? d.hands.from.slice() : null;
    if (d.you === "from") {
      c.you = "from";
      if (fromHands) c.hands = { from: fromHands };
      return c;
    }
    if (!Number.isInteger(d.you)) {
      // 마감 뒤 누구나 보는 꼴에는 만든 사람 손도 온다
      if (fromHands) c.hands = { from: fromHands };
      return c;
    }
    c.you = d.you;
    if (!Array.isArray(d.cmp)) {
      // 답했지만 마감 전(reveal "end"): 내 손과 '냈다'만
      if (!(d.hands && isHandList(d.hands.to, d.rounds))) throw new OnlineError("bad_reply", d);
      c.pending = true;
      c.to = cleanName(d.to) || "?";
      c.toFace = faceId(d.toFace);
      c.hands = { to: d.hands.to.slice() };
      return c;
    }
    return readResult(c, d);
  }
  return d.open ? c : readResult(c, d);
}

/** 닫힘 꼴(여럿이 도전장이면 답한 사람의 자기 결과)을 더한다 */
function readResult(c, d) {
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
  return c;
}

/**
 * 방 만들기(규약 3.1): 만든 사람이 방장·0번 자리. 돌려주는 값은 { code, taken }.
 * code 를 주면 그 코드로 만든다. 그 코드 방이 이미 있으면 서버가 만들지 않고 taken: true 로 알려 준다(그 방에 들어가면 된다)
 */
export async function createRoom({ rules, name, face = null, pid, code = null }, opts = {}) {
  const body = { v: PROTOCOL, pid, name, rules };
  if (face) body.face = face;
  if (code) body.code = code;
  const d = await api("/api/rooms", { ...opts, body });
  if (typeof d.code !== "string" || !d.code) throw new OnlineError("bad_reply", d);
  // 고른 코드가 이미 있는 방이면 지금 방장 {name, face}(서버 9d404ab). 아무도 없거나 옛 서버면 null
  const hostName = d.taken === true && d.host ? cleanName(d.host.name) : "";
  const host = hostName ? { name: hostName, face: faceId(d.host.face) } : null;
  return { code: d.code, taken: d.taken === true, host };
}
