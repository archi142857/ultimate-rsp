// 화면 언어(한국어·영어). 한국어 문장 틀을 열쇠로 써서 영어를 찾는다.
//   t("{a:이가} {b:을를} 이긴다", { a, b })  →  "바위가 가위를 이긴다" / "Rock beats scissors"
// 틀 자리표
//   {이름}          값을 그대로 넣는다
//   {이름:이가}     한국어에서 받침에 맞는 조사를 붙인다(영어에서는 값만)
//   {이름|one|many} 영어 사전 쪽에서만 쓴다. 값이 1이면 one, 아니면 many
// 같은 한국어가 자리에 따라 영어로 달리 옮겨지면 앞에 쓰임새를 붙인다: t("@stat:차례"). 한국어로 낼 때는 뗀다.
// 영어 사전(i18n/en.js)에 없는 틀은 한국어가 그대로 나온다. tests/i18n.test.mjs 가 빠진 것을 찾는다.

import { josa } from "./core/josa.js";
import { EN } from "./i18n/en.js";

export const LANGS = [
  { id: "ko", name: "한국어" },
  { id: "en", name: "English" },
];

let current = detect();
const listeners = [];
const missing = new Set();

function detect() {
  // 브라우저 밖(테스트)에서는 한국어
  if (typeof document === "undefined") return "ko";
  try {
    const saved = JSON.parse(localStorage.getItem("ursp.set.lang"));
    if (saved === "ko" || saved === "en") return saved;
  } catch {
    /* 저장이 막혀 있으면 브라우저 언어로 */
  }
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "ko";
  return /^ko\b/i.test(nav) ? "ko" : "en";
}

export function lang() {
  return current;
}

export const isEn = () => current === "en";

/** 언어를 바꾼다. 저장하고, 등록된 곳(도감 자료 등)에 알린다. 화면을 다시 그리는 건 app.js 가 한다 */
export function setLang(l, { persist = true } = {}) {
  if (l !== "ko" && l !== "en") return;
  current = l;
  if (persist) {
    try {
      localStorage.setItem("ursp.set.lang", JSON.stringify(l));
    } catch {
      /* 못 해도 괜찮다 */
    }
  }
  if (typeof document !== "undefined") document.documentElement.lang = l;
  for (const cb of listeners) cb(l);
}

export function onLang(cb) {
  listeners.push(cb);
}

export function t(ko, vars) {
  let tpl = ko;
  if (current === "en") {
    const e = EN[ko];
    if (e === undefined) missing.add(ko);
    else tpl = typeof e === "function" ? e(vars || {}) : e;
  }
  // "@stat:차례" 처럼 앞에 붙인 쓰임새 표시는 한국어로 낼 때 뗀다(같은 한국어가 영어로는 달리 옮겨질 때 쓴다)
  if (tpl === ko && ko.charCodeAt(0) === 64) tpl = ko.replace(/^@[\w-]+:/, "");
  return fill(tpl, vars);
}

/** 영어 사전에 없어서 한국어로 나간 틀 (개발용) */
export function missingKeys() {
  return [...missing];
}

const SLOT = /\{(\w+)(?::([가-힣]+)|\|([^|}]*)\|([^}]*))?\}/g;

function fill(tpl, vars) {
  if (!vars) return tpl;
  return tpl.replace(SLOT, (m, key, pair, one, many) => {
    const v = vars[key];
    if (v === undefined || v === null) return m;
    if (one !== undefined) return Number(v) === 1 ? one : many;
    if (pair && current === "ko") return josa(String(v), pair);
    return String(v);
  });
}

/** 숫자를 그 언어 꼴로 (1,000) */
export function num(n) {
  return Number(n).toLocaleString(current === "en" ? "en-US" : "ko-KR");
}

/** 영어 문장 가운데에 들어갈 이름: 첫 글자만 소문자(고유 이름·약자는 그대로) */
export function lower(name, proper = false) {
  if (proper || current !== "en") return name;
  return /^[A-Z][a-z]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name;
}

/** 글자로 짐작한 언어(한글 ko, 가나 ja, 한자만 zh). 다른 이름 목록에 lang 을 달 때 쓴다 */
export function scriptLang(text) {
  if (/[\u3131-\u318e\uac00-\ud7a3]/.test(text)) return "ko";
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  return null;
}

/** 목록을 말로 잇는다: 가, 나, 다 / a, b, and c */
export function listWords(words) {
  if (current !== "en") return words.join(", ");
  if (words.length <= 2) return words.join(" and ");
  return `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;
}
