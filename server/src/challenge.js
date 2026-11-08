// 도전장(공유 링크)의 규칙. 값만 다루고 저장·통신은 challenge-do.js 가 한다(그래서 시험이 Cloudflare 없이 돈다).
// 만든 사람의 손과 pid 는 기록에만 있고, 보여 주는 꼴(viewChallenge)에는 답이 오기 전까지 손이 없다.
// max 가 2 이상이면 링크 하나에 여럿이 답한다(답마다 만든 사람과 따로 겨룬다). 그때는 아직 열린 도전장이라
// 누구나 보는 꼴에 손이 없고, 손은 만든 사람(전부)과 답한 사람(자기 것)에게만 pid 로 물었을 때 보인다.
// 결과는 늘 마감 때 한꺼번에 연다(reveal "end". 11-08 검수: 버리는 pid 로 먼저 답해 손을 엿보고 진짜 pid 로 이길 수 있었다,
// 11-09 사용자 결정). 마감 전에는 답한 사람도 '냈다'만 알고, 마감(max 명이 다 답함, 만든 사람이 닫음, 만든 뒤 24시간)에 모두 공개한다.

import { createMatch } from "../../web/js/games/match.js";
import { checkOnlineGame, resolveVariant, handIndex } from "./games.js";
import { checkPid, checkName, checkEmote, checkFace } from "./check.js";
import { Fail } from "./http.js";
import { CHALLENGE_KEEP_MS, CHALLENGE_MAX, CHALLENGE_OPEN_MS, CHALLENGE_REVEAL, CHALLENGE_ROUNDS } from "./protocol.js";

function checkHands(V, hands, count) {
  if (!Array.isArray(hands)) throw new Fail("bad_hand");
  const ok = count === null ? CHALLENGE_ROUNDS.includes(hands.length) : hands.length === count;
  if (!ok) throw new Fail("bad_hand");
  for (const id of hands) handIndex(V, id);
  return hands.slice();
}

/** 답할 수 있는 사람 수. 안 주면 1(보통 도전장), 틀리면 bad_request */
function checkMax(max) {
  if (max === undefined || max === null) return CHALLENGE_MAX.default;
  if (!Number.isInteger(max) || max < 1 || max > CHALLENGE_MAX.max) throw new Fail("bad_request");
  return max;
}

/** 여럿이 도전장의 결과 공개 때. 안 주면 CHALLENGE_REVEAL[0], 틀리면 bad_request */
function checkReveal(reveal) {
  if (reveal === undefined || reveal === null) return CHALLENGE_REVEAL[0];
  if (!CHALLENGE_REVEAL.includes(reveal)) throw new Fail("bad_request");
  return reveal;
}

/** 기록의 max(11-08 전에 만든 기록에는 없다 = 1) */
const maxOf = (rec) => rec.max || 1;
/** 여럿이 도전장이 저절로 마감되는 때(11-09 전 기록에는 closes 가 없다 = 만든 때 + 24시간) */
const closesOf = (rec) => rec.closes ?? rec.made + CHALLENGE_OPEN_MS;
/** 아직 답을 받는가: 만든 사람이 닫지 않았고, 자리가 남았고, 마감 시각 전이다 */
const isOpen = (rec, now) => !rec.closed && (rec.answers || []).length < maxOf(rec) && now < closesOf(rec);

/** 판정: 판마다 만든 사람 쪽에서 본 결과(1·0·−1), 이긴 판 수, 이긴 쪽(0 만든 사람, 1 받은 사람, −1 비김) */
export function judge(V, from, to) {
  const m = createMatch(V, { target: Infinity });
  const cmp = from.map((id, i) => m.play(V.index[id], V.index[to[i]]).cmp);
  const [a, b] = m.score;
  return { cmp, score: [a, b], winner: a > b ? 0 : b > a ? 1 : -1 };
}

/** 만들기 요청을 검사해 저장할 기록을 만든다(코드는 부르는 쪽이 붙인다) */
export function makeChallenge(body, now) {
  const pid = checkPid(body.pid);
  const name = checkName(body.name);
  const { game, custom, V } = resolveVariant(checkOnlineGame("challenge", body.game), body.custom);
  const hands = checkHands(V, body.hands, null);
  const e = checkEmote(body.e, true);
  const max = checkMax(body.max);
  const rec = { code: null, game, custom, from: { pid, name, face: checkFace(body.face) }, e, hands, made: now, expires: now + CHALLENGE_KEEP_MS, max, answer: null };
  if (max > 1) Object.assign(rec, { answers: [], reveal: checkReveal(body.reveal), closed: false, closes: now + CHALLENGE_OPEN_MS });
  else if (body.reveal !== undefined) checkReveal(body.reveal);
  return rec;
}

/**
 * 답하기. 돌려주는 값: { rec, changed } — changed 가 false 면 저장할 것이 없다(같은 사람이 다시 보냄).
 * 이미 다른 사람이 답했으면(여럿이면 max 명이 다 답했으면) closed(누구나 보는 꼴을 같이 싣는다), 만든 사람이면 own.
 */
export function answerChallenge(rec, body, now) {
  const pid = checkPid(body.pid);
  if (maxOf(rec) > 1) return answerMany(rec, pid, body, now);
  if (rec.answer) {
    if (rec.answer.pid === pid) return { rec, changed: false };
    throw new Fail("closed", { result: viewChallenge(rec) });
  }
  if (pid === rec.from.pid) throw new Fail("own");
  const name = checkName(body.name);
  const { V } = resolveVariant(rec.game, rec.custom);
  const hands = checkHands(V, body.hands, rec.hands.length);
  // 판정은 답할 때 한 번 하고 적어 둔다(나중에 도감 규칙이 바뀌어도 지난 결과는 그대로)
  const result = judge(V, rec.hands, hands);
  return { rec: { ...rec, answer: { pid, name, face: checkFace(body.face), hands, at: now, ...result } }, changed: true };
}

function answerMany(rec, pid, body, now) {
  const list = rec.answers || [];
  if (list.some((a) => a.pid === pid)) return { rec, changed: false };
  if (pid === rec.from.pid) throw new Fail("own");
  if (!isOpen(rec, now)) throw new Fail("closed", { result: viewChallenge(rec, null, now) });
  const name = checkName(body.name);
  const { V } = resolveVariant(rec.game, rec.custom);
  const hands = checkHands(V, body.hands, rec.hands.length);
  const result = judge(V, rec.hands, hands);
  return { rec: { ...rec, answers: [...list, { pid, name, face: checkFace(body.face), hands, at: now, ...result }] }, changed: true };
}

/**
 * 만든 사람이 여럿이 도전장을 닫는다(더 받지 않고 결과를 모두에게 연다). 돌려주는 값: { rec, changed }.
 * 만든 사람이 아니면 bad_pid, 보통 도전장(max 1)이면 bad_request. 이미 닫혔으면 그대로
 */
export function closeChallenge(rec, body, now) {
  const pid = checkPid(body.pid);
  if (maxOf(rec) === 1) throw new Fail("bad_request");
  if (pid !== rec.from.pid) throw new Fail("bad_pid");
  if (rec.closed) return { rec, changed: false };
  return { rec: { ...rec, closed: true, closedAt: now }, changed: true };
}

/**
 * 화면에 보여 줄 꼴. pid 는 절대 안 싣고, 답이 오기 전에는 만든 사람 손도 안 싣는다.
 * viewer 는 묻는 사람의 pid(POST 로 물을 때만). 여럿이 도전장에서 만든 사람이면 모든 답의 손을, 답한 사람이면 자기 결과를 싣는다
 */
export function viewChallenge(rec, viewer = null, now = Date.now()) {
  if (maxOf(rec) > 1) return viewMany(rec, viewer, now);
  const v = {
    code: rec.code,
    game: rec.game,
    custom: rec.custom,
    rounds: rec.hands.length,
    from: rec.from.name,
    fromFace: rec.from.face ?? null,
    e: rec.e,
    made: rec.made,
    expires: rec.expires,
    open: !rec.answer,
    max: 1,
  };
  if (rec.answer) {
    const a = rec.answer;
    Object.assign(v, {
      to: a.name,
      toFace: a.face ?? null,
      answered: a.at,
      hands: { from: rec.hands.slice(), to: a.hands.slice() },
      cmp: a.cmp.slice(),
      score: a.score.slice(),
      winner: a.winner,
    });
  }
  return v;
}

/**
 * 여럿이 도전장의 꼴. answers 는 답한 차례(이름·그림·때, 마감 뒤에는 손·점수·이긴 쪽).
 * 만든 사람은 늘 모든 답의 손·판마다 결과를 본다. 마감(open false) 전에는 답한 사람도 자기 손과 '냈다'(answered)만 받고,
 * 마감 뒤에는 누구나 모든 손과 결과를 본다. 11-08 에 reveal "now" 로 만든 것도 이제 같다
 */
function viewMany(rec, viewer, now) {
  const list = rec.answers || [];
  const owner = viewer !== null && viewer === rec.from.pid;
  const mine = viewer === null ? -1 : list.findIndex((a) => a.pid === viewer);
  const open = isOpen(rec, now);
  const reveal = "end";
  const results = !open;
  const v = {
    code: rec.code,
    game: rec.game,
    custom: rec.custom,
    rounds: rec.hands.length,
    from: rec.from.name,
    fromFace: rec.from.face ?? null,
    e: rec.e,
    made: rec.made,
    expires: rec.expires,
    open,
    max: maxOf(rec),
    count: list.length,
    reveal,
    closes: closesOf(rec),
    answers: list.map((a) => {
      const row = { name: a.name, face: a.face ?? null, at: a.at };
      if (owner || results) Object.assign(row, { score: a.score.slice(), winner: a.winner });
      if (owner || !open) Object.assign(row, { hands: a.hands.slice(), cmp: a.cmp.slice() });
      return row;
    }),
  };
  if (rec.closed) v.closed = rec.closedAt;
  if (owner) Object.assign(v, { you: "from", hands: { from: rec.hands.slice() } });
  else if (mine >= 0 && !results) {
    const a = list[mine];
    Object.assign(v, { you: mine, to: a.name, toFace: a.face ?? null, answered: a.at, hands: { to: a.hands.slice() } });
  } else if (!open) v.hands = { from: rec.hands.slice() };
  if (!owner && mine >= 0 && results) {
    const a = list[mine];
    Object.assign(v, {
      you: mine,
      to: a.name,
      toFace: a.face ?? null,
      answered: a.at,
      hands: { from: rec.hands.slice(), to: a.hands.slice() },
      cmp: a.cmp.slice(),
      score: a.score.slice(),
      winner: a.winner,
    });
  }
  return v;
}
