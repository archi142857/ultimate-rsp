// 로그인 없이 쓰는 나: 브라우저가 만든 무작위 id(pid)와 이름, 프로필 그림.
// pid 는 비밀번호처럼 쓴다. 서버만 알고, 다시 들어올 때 내 자리를 찾는 데 쓴다. 화면에 보이지 않는다.
// 모두 이 브라우저에만 남는다(ursp.online.pid, ursp.set.nick, ursp.set.online.face). 저장이 막혀 있으면 이 창이 열려 있는 동안만 쓴다.
// 프로필 그림은 게임 그림(web/art) 가운데 하나다. 고르지 않으면(null) 이름에서 정한다(avatar.js).

import { load, save, setting, setSetting } from "../ui/store.js";
import { lang } from "../i18n.js";
import { NICK_WORDS } from "../i18n/nicknames.js";
import { ART_FILES } from "../data/art-files.js";

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

// 줄바꿈·제어 글자, 빈칸처럼 보이는 글자(한글 채움 U+3164·U+FFA0·U+115F·U+1160, 점자 빈칸 U+2800, U+034F,
// 크메르 안 보이는 모음 U+17B4·U+17B5, 몽골 선택자 U+180B–U+180F), 서식 글자(\p{Cf}: 보이지 않는 빈칸·글 방향 뒤집기·소프트 하이픈 등),
// 짝이 아닌 이체 선택자(U+FE0E·U+FE0F 는 그림 글자·키캡 바탕 뒤에서만, U+E0100–U+E01EF 는 한자 뒤에서만, U+FE00–U+FE0D 는 늘 뺀다).
// 서버 check.js 의 BAD_NAME 과 같은 모음(검수 11-08·11-09, 서버 2a825ec·f3ebcdc).
// 이모지를 잇는 글자(U+200D)는 남긴다(👨\u200D👩\u200D👧 같은 이모지가 깨지지 않게)
const HIDDEN =
  /[\p{Cc}\u2028\u2029\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u2800\u3164\uFFA0\uFE00-\uFE0D]|(?!\u200D)\p{Cf}|(?<![\p{Extended_Pictographic}0-9#*])[\uFE0E\uFE0F]|(?<!\p{Ideographic})[\u{E0100}-\u{E01EF}]/gu;

// 글자·숫자·기호·문장 부호가 하나는 있어야 한다(서버 checkName 과 같다)
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

/** 이름 다듬기: 보이지 않는 글자·줄바꿈을 빼고, 빈칸을 하나로, 20글자까지. 보이는 글자가 없으면 빈 이름 */
export function cleanName(s) {
  // 저장값이 글이 아니면(예: {"a":1}) 빈 이름으로 본다('[object Object]' 가 서버로 가지 않게, 검수 11-08)
  const flat = (typeof s === "string" ? s : typeof s === "number" ? String(s) : "")
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

/** 프로필 그림 이름이 게임 그림에 있으면 그대로, 아니면 null(서버가 준 값도 이걸로 거른다) */
export function faceId(x) {
  return typeof x === "string" && ART_FILES.has(x) ? x : null;
}

/** 내가 고른 프로필 그림. 고르지 않았으면 null(이름에서 정한다) */
export function myFace() {
  return faceId(setting("online.face", null));
}

/** 프로필 그림을 바꾼다. null 이면 이름에 맞춘다. 남긴 값을 돌려준다 */
export function setMyFace(id) {
  const f = faceId(id);
  setSetting("online.face", f);
  return f;
}

/** 나(사람 고리·그림에 넘기는 꼴) */
export function meWho() {
  return { kind: "human", name: myName(), face: myFace() };
}

/** 서버에 이름과 같이 보내는 값: 그림을 골랐을 때만 face 를 싣는다. 방은 들어올 때마다 그때 이름·그림으로 자리를 고친다(안 실으면 null) */
export function meFields() {
  const face = myFace();
  return face ? { name: myName(), face } : { name: myName() };
}
