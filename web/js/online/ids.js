// 온라인 주소 읽기: #/play(첫 화면), #/c/new(도전장 만들기), #/c/mine(내 도전장 모두), #/c/코드(도전장), #/room/코드(방),
// #/match(랜덤 매칭), #/rank/게임(순위표. 게임이 없으면 마지막에 본 게임).
// 코드의 꼴은 서버 규약(server/src/protocol.js 의 CODE_ABC·CODE_LEN)과 같다. tests/online-protocol.test.mjs 가 맞춰 본다.

/** 코드 글자(헷갈리는 0·1·I·L·O 뺌) */
export const CODE_ABC = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LEN = { challenge: 8, room: 4 };

function decode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

// 두벌식 자판: 한글 입력 상태로 친 코드(BABE → ㅠㅁㅠㄷ, AB → 뮤)를 영문 자판 글자로 되돌린다(검수 11-09).
// 겹받침·겹모음은 누른 차례대로, 쌍자음·ㅒ·ㅖ 는 Shift 를 뗀 글자로(코드는 어차피 대문자)
const JAMO_KEY = {
  ㄱ: "R", ㄲ: "R", ㄴ: "S", ㄷ: "E", ㄸ: "E", ㄹ: "F", ㅁ: "A", ㅂ: "Q", ㅃ: "Q", ㅅ: "T", ㅆ: "T", ㅇ: "D", ㅈ: "W", ㅉ: "W",
  ㅊ: "C", ㅋ: "Z", ㅌ: "X", ㅍ: "V", ㅎ: "G",
  ㅏ: "K", ㅐ: "O", ㅑ: "I", ㅒ: "O", ㅓ: "J", ㅔ: "P", ㅕ: "U", ㅖ: "P", ㅗ: "H", ㅘ: "HK", ㅙ: "HO", ㅚ: "HL", ㅛ: "Y",
  ㅜ: "N", ㅝ: "NJ", ㅞ: "NP", ㅟ: "NL", ㅠ: "B", ㅡ: "M", ㅢ: "ML", ㅣ: "L",
  ㄳ: "RT", ㄵ: "SW", ㄶ: "SG", ㄺ: "FR", ㄻ: "FA", ㄼ: "FQ", ㄽ: "FT", ㄾ: "FX", ㄿ: "FV", ㅀ: "FG", ㅄ: "QT",
};
const LEAD = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const VOWEL = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const TAIL = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

/** 한글(자모·완성형)을 두벌식 자판에서 누른 영문 글자로 */
export function hangulToKeys(s) {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) {
      const k = c - 0xac00;
      out += JAMO_KEY[LEAD[Math.floor(k / 588)]] + JAMO_KEY[VOWEL[Math.floor((k % 588) / 28)]] + (k % 28 ? JAMO_KEY[TAIL[k % 28]] : "");
    } else out += JAMO_KEY[ch] ?? ch;
  }
  return out;
}

const WORD = /[0-9A-Za-z\u3131-\u318E\uAC00-\uD7A3]+/g; // 영문·숫자·한글이 이어진 덩어리(빈칸·문장부호에서 끊는다)
const LATIN = /[0-9A-Za-z]+/g;

function codeLike(s, lens) {
  return lens.includes(s.length) && [...s].every((ch) => CODE_ABC.includes(ch));
}

/**
 * 사람이 쓴 글에서 코드를 고른다(검수 11-09: 채팅 글을 통째로 붙여 넣어도).
 * 낱말 안의 영문·숫자 덩어리('BABE로'처럼 조사가 붙어도) 가운데 코드 꼴(길이 · CODE_ABC)인 것을 고르되, 대문자나 숫자가 든 것을 먼저,
 * 같은 차례면 뒤의 것('here's the code babe'). 코드 꼴이 없으면 낱말이 하나일 때(치는 중, 한글 입력 상태로 친 ㅠㅁㅠㄷ) 통째로
 * 자판 글자로 바꾸고, 여럿이면 영문·숫자만 잇는다(K7-Q2 → K7Q2). 영문이 없는 문장('방 코드 알려줘')은 빈칸
 */
function pickCode(text, lens) {
  const words = text.match(WORD) || [];
  let best = null;
  let rank = 2;
  for (const w of words)
    for (const run of w.match(LATIN) || []) {
      const up = run.toUpperCase();
      const r = /\d/.test(run) || run === up ? 0 : 1;
      if (r <= rank && codeLike(up, lens)) [best, rank] = [up, r];
    }
  if (best) return best;
  if (words.length === 1) return hangulToKeys(words[0]).toUpperCase();
  return words
    .flatMap((w) => w.match(LATIN) || [])
    .join("")
    .toUpperCase();
}

/**
 * 사람이 친 코드를 고친다: 방·도전장 링크를 통째로 붙여 넣으면 코드만 뽑고(…#/room/BABE), 채팅 글이면 코드 꼴 낱말을,
 * 한글 입력 상태로 친 글자는 영문 자판 글자로, 빈칸·줄표·문장부호를 빼고 대문자로.
 * kind("room"·"challenge")를 주면 그 길이만 코드 꼴로 본다
 */
export function normalizeCode(s, kind = null) {
  let v = String(s || "")
    .normalize("NFC")
    // 전각 영문·숫자(ＢＡＢＥ)는 반각으로
    .replace(/[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  const m = /\/(?:room|c)\/([^/?#\s]+)/i.exec(v);
  if (m) v = decode(m[1]) ?? m[1];
  return pickCode(v, kind && CODE_LEN[kind] ? [CODE_LEN[kind]] : Object.values(CODE_LEN));
}

/** 코드에 쓰지 않는 글자(0·1·I·L·O 같은)가 들어 있나 */
export function hasBadCodeChar(s) {
  return [...normalizeCode(s)].some((ch) => !CODE_ABC.includes(ch));
}

/** 화면이 뽑는 무작위 코드(규약 3.1: 방 코드를 미리 채울 때 CODE_ABC 로) */
export function randomCode(kind = "room") {
  const a = new Uint32Array(CODE_LEN[kind]);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => CODE_ABC[x % CODE_ABC.length]).join("");
}

/** 코드 꼴이 맞으면 고친 코드, 아니면 null */
export function checkCode(s, kind) {
  const c = normalizeCode(s, kind);
  if (c.length !== CODE_LEN[kind]) return null;
  for (const ch of c) if (!CODE_ABC.includes(ch)) return null;
  return c;
}

/**
 * 온라인 주소면 { kind } 를 돌려준다. 아니면 null.
 *   { kind: "home" } | { kind: "new-challenge" } | { kind: "my-challenges" } | { kind: "challenge", code } | { kind: "room", code }
 *   | { kind: "match" } | { kind: "rank", game } | { kind: "bad", what }
 * rank 의 game 은 주소에 적힌 그대로(없으면 null). 있는 게임인지는 순위표 화면이 본다.
 */
export function parseOnline(path) {
  if (path === "/play" || path === "/play/") return { kind: "home" };
  if (path === "/c/new" || path === "/c/new/") return { kind: "new-challenge" };
  if (path === "/c/mine" || path === "/c/mine/") return { kind: "my-challenges" };
  if (path === "/match" || path === "/match/") return { kind: "match" };
  let m = /^\/rank(?:\/([^/]*))?\/?$/.exec(path);
  if (m) return { kind: "rank", game: (m[1] && decode(m[1])) || null };
  m = /^\/c\/([^/]*)\/?$/.exec(path);
  if (m) {
    const code = checkCode(decode(m[1]), "challenge");
    return code ? { kind: "challenge", code } : { kind: "bad", what: "challenge" };
  }
  m = /^\/room\/([^/]*)\/?$/.exec(path);
  if (m) {
    const code = checkCode(decode(m[1]), "room");
    return code ? { kind: "room", code } : { kind: "bad", what: "room" };
  }
  return null;
}
