// 이 브라우저가 만들거나 답한 도전장. 내가 만든 링크인지 알고(서버는 묻지 않는다), 내 손을 보여 주고,
// 온라인 첫 화면에 '내 도전장'으로 늘어놓는 데 쓴다. ursp.online.challenges 에 최근 30개.
// { id: 코드, role: "maker" | "taker", game, hand, at, label?, result?, vs?, max?, n? }
//   label 은 직접 만들기의 이름(RPS-n), result 는 내 쪽에서 본 결과(1 이김, 0 비김, −1 짐), vs 는 상대 이름.
//   max·n 은 여럿이 도전장(2–50명이 답한다)의 답할 수 있는 사람 수와 마지막으로 본 답 수.
// 결과는 사람이 도전장을 열었을 때만 안다(폴링하지 않는다. 규약 6장). 그래서 만든 쪽은 열어 보기 전까지 '기다리는 중'.

import { load, save } from "../ui/store.js";
import { cleanName } from "./identity.js";

const KEY = "online.challenges";
export const MINE_MAX = 30;

const valid = (r) =>
  r && typeof r.id === "string" && (r.role === "maker" || r.role === "taker") && typeof r.game === "string" && typeof r.hand === "string" && Number.isFinite(r.at);

/** 저장할 꼴로 다듬기(모르는 칸은 버린다) */
function tidy(rec) {
  const r = { id: rec.id, role: rec.role, game: rec.game, hand: rec.hand, at: Number.isFinite(rec.at) ? rec.at : Date.now() };
  if (typeof rec.label === "string" && rec.label) r.label = rec.label;
  if (rec.result === 1 || rec.result === 0 || rec.result === -1) r.result = rec.result;
  const vs = cleanName(rec.vs);
  if (vs) r.vs = vs;
  if (Number.isInteger(rec.max) && rec.max > 1) {
    r.max = rec.max;
    if (Number.isInteger(rec.n) && rec.n >= 0) r.n = Math.min(rec.n, rec.max);
  }
  return r;
}

// 저장이 막힌 브라우저(일부 사생활 보호 창)에서도 이 창이 열려 있는 동안은 알아보게 메모리에도 둔다
const session = [];

export function myChallenges() {
  const list = load(KEY, []);
  const stored = Array.isArray(list) ? list.filter(valid).map(tidy) : [];
  const ids = new Set(stored.map((r) => r.id));
  return [...session.filter((r) => !ids.has(r.id)), ...stored].sort((a, b) => b.at - a.at);
}

export function myChallenge(id) {
  return myChallenges().find((r) => r.id === id) || null;
}

function put(r, { front }) {
  const i = session.findIndex((x) => x.id === r.id);
  if (i >= 0) session.splice(i, 1);
  session.unshift(r);
  session.length = Math.min(session.length, MINE_MAX);
  const list = load(KEY, []);
  const stored = Array.isArray(list) ? list.filter((x) => valid(x) && x.id !== r.id) : [];
  if (front) stored.unshift(r);
  else {
    // 차례(at)를 지켜 제자리에
    const k = stored.findIndex((x) => x.at < r.at);
    stored.splice(k < 0 ? stored.length : k, 0, r);
  }
  save(KEY, stored.slice(0, MINE_MAX));
}

/** 새것을 맨 앞에. 같은 번호가 있으면 바꾼다 */
export function rememberChallenge(rec) {
  const r = tidy(rec);
  if (!valid(r)) return;
  put(r, { front: true });
}

/** 있는 기록에 결과·상대 이름을 적는다(차례는 그대로). 기록이 없으면 아무것도 안 한다 */
export function noteChallenge(id, patch) {
  const old = myChallenge(id);
  if (!old) return null;
  const r = tidy({ ...old, ...patch });
  if (r.result === old.result && r.vs === old.vs && r.max === old.max && r.n === old.n) return old;
  put(r, { front: false });
  return r;
}

// 막 만든 도전장(같은 창에서 만들고 바로 연 것): 도전장 화면이 '3/3 도전장이 준비됐다'로 보인다
const fresh = new Set();
export const markFresh = (id) => fresh.add(id);
export const isFresh = (id) => fresh.has(id);
/** 한 번만 '막 만든' 화면으로 보이게 꺼낸다(여럿이 도전장은 다시 그릴 일이 많아 펼치기가 되풀이되지 않게) */
export const takeFresh = (id) => fresh.delete(id);
