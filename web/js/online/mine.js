// 이 브라우저가 만들거나 답한 도전장. 내가 만든 링크인지 알고(서버는 묻지 않는다), 내 손을 보여 주고,
// 온라인 첫 화면에 '내 도전장'으로 늘어놓는 데 쓴다. ursp.online.challenges 에 최근 30개.
// { id: 코드, role: "maker" | "taker", game, hand, at, label? }  label 은 직접 만들기의 이름(RPS-n)

import { load, save } from "../ui/store.js";

const KEY = "online.challenges";
export const MINE_MAX = 30;

const valid = (r) =>
  r && typeof r.id === "string" && (r.role === "maker" || r.role === "taker") && typeof r.game === "string" && typeof r.hand === "string" && Number.isFinite(r.at);

// 저장이 막힌 브라우저(일부 사생활 보호 창)에서도 이 창이 열려 있는 동안은 알아보게 메모리에도 둔다
const session = [];

export function myChallenges() {
  const list = load(KEY, []);
  const stored = Array.isArray(list) ? list.filter(valid) : [];
  const ids = new Set(stored.map((r) => r.id));
  return [...session.filter((r) => !ids.has(r.id)), ...stored].sort((a, b) => b.at - a.at);
}

export function myChallenge(id) {
  return myChallenges().find((r) => r.id === id) || null;
}

/** 새것을 맨 앞에. 같은 번호가 있으면 바꾼다 */
export function rememberChallenge(rec) {
  const r = { id: rec.id, role: rec.role, game: rec.game, hand: rec.hand, at: Number.isFinite(rec.at) ? rec.at : Date.now() };
  if (typeof rec.label === "string" && rec.label) r.label = rec.label;
  if (!valid(r)) return;
  const i = session.findIndex((x) => x.id === r.id);
  if (i >= 0) session.splice(i, 1);
  session.unshift(r);
  session.length = Math.min(session.length, MINE_MAX);
  const list = load(KEY, []);
  const stored = Array.isArray(list) ? list.filter((x) => valid(x) && x.id !== r.id) : [];
  save(KEY, [r, ...stored].slice(0, MINE_MAX));
}
