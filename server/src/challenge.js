// 도전장(공유 링크)의 규칙. 값만 다루고 저장·통신은 challenge-do.js 가 한다(그래서 시험이 Cloudflare 없이 돈다).
// 만든 사람의 손과 pid 는 기록에만 있고, 보여 주는 꼴(viewChallenge)에는 답이 오기 전까지 손이 없다.

import { createMatch } from "../../web/js/games/match.js";
import { checkOnlineGame, resolveVariant, handIndex } from "./games.js";
import { checkPid, checkName, checkEmote, checkFace } from "./check.js";
import { Fail } from "./http.js";
import { CHALLENGE_KEEP_MS, CHALLENGE_ROUNDS } from "./protocol.js";

function checkHands(V, hands, count) {
  if (!Array.isArray(hands)) throw new Fail("bad_hand");
  const ok = count === null ? CHALLENGE_ROUNDS.includes(hands.length) : hands.length === count;
  if (!ok) throw new Fail("bad_hand");
  for (const id of hands) handIndex(V, id);
  return hands.slice();
}

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
  return { code: null, game, custom, from: { pid, name, face: checkFace(body.face) }, e, hands, made: now, expires: now + CHALLENGE_KEEP_MS, answer: null };
}

/**
 * 답하기. 돌려주는 값: { rec, changed } — changed 가 false 면 저장할 것이 없다(같은 사람이 다시 보냄).
 * 이미 다른 사람이 답했으면 closed(결과를 같이 싣는다), 만든 사람이면 own.
 */
export function answerChallenge(rec, body, now) {
  const pid = checkPid(body.pid);
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

/** 화면에 보여 줄 꼴. pid 는 절대 안 싣고, 답이 오기 전에는 만든 사람 손도 안 싣는다 */
export function viewChallenge(rec) {
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
