// 로그인 없이 쓰는 나: 브라우저가 만든 무작위 id(pid)와 이름.
// pid 는 비밀번호처럼 쓴다. 서버만 알고, 다시 들어올 때 내 자리를 찾는 데 쓴다. 화면에 보이지 않는다.
// 둘 다 이 브라우저에만 남는다(ursp.online.pid, ursp.set.nick). 저장이 막혀 있으면 이 창이 열려 있는 동안만 쓴다.

import { load, save, setting, setSetting } from "../ui/store.js";
import { lang } from "../i18n.js";
import { NICK_WORDS } from "../i18n/nicknames.js";

export const NAME_MAX = 20;
const PID = /^[A-Za-z0-9_-]{22}$/;

/** 무작위 바이트를 URL 에 써도 되는 base64 로 (16바이트 → 22자) */
export function newId(bytes = 16) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  let bin = "";
  for (const x of a) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let pidMemo = null;
export function playerId() {
  if (pidMemo) return pidMemo;
  let id = load("online.pid", null);
  if (typeof id !== "string" || !PID.test(id)) {
    id = newId();
    save("online.pid", id);
  }
  return (pidMemo = id);
}

// 줄바꿈·제어 글자, 보이지 않는 빈칸, 글 방향을 뒤집는 글자(이름 바꿔치기에 쓰인다).
// 이모지를 잇는 글자(U+200D)는 남긴다(👨\u200D👩\u200D👧 같은 이모지가 깨지지 않게)
const HIDDEN = /[\p{Cc}\u2028\u2029\u200B\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/gu;

// 글자·숫자·기호·문장 부호가 하나는 있어야 한다(서버 checkName 과 같다)
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

/** 이름 다듬기: 보이지 않는 글자·줄바꿈을 빼고, 빈칸을 하나로, 20글자까지. 보이는 글자가 없으면 빈 이름 */
export function cleanName(s) {
  const flat = String(s || "")
    .normalize("NFC")
    .replace(HIDDEN, " ")
    .replace(/\s+/g, " ")
    .trim();
  const name = [...flat].slice(0, NAME_MAX).join("").trim();
  return VISIBLE.test(name) ? name : "";
}

/** "날쌘 여우 42" 같은 이름. rnd 는 0 이상 1 미만 수를 주는 함수 */
export function randomName(l = lang(), rnd = Math.random) {
  const w = NICK_WORDS[l] || NICK_WORDS.ko;
  const pick = (list) => list[Math.floor(rnd() * list.length) % list.length];
  const n = 10 + (Math.floor(rnd() * 90) % 90);
  return `${pick(w.adj)} ${pick(w.noun)} ${n}`;
}

let nameMemo = null;
/** 내 이름. 처음이면 무작위 이름을 정해 남긴다 */
export function myName() {
  if (nameMemo) return nameMemo;
  let n = cleanName(setting("nick", ""));
  if (!n) {
    n = randomName();
    setSetting("nick", n);
  }
  return (nameMemo = n);
}

/** 이름을 바꾼다. 비어 있으면 바꾸지 않는다. 남긴 이름을 돌려준다 */
export function setMyName(s) {
  const n = cleanName(s);
  if (!n) return myName();
  nameMemo = n;
  setSetting("nick", n);
  return n;
}
