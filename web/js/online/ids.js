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

/** 사람이 친 코드를 고친다: 빈칸·줄표를 빼고 대문자로 */
export function normalizeCode(s) {
  return String(s || "")
    .replace(/[\s-]+/g, "")
    .toUpperCase();
}

/** 화면이 뽑는 무작위 코드(규약 3.1: 방 코드를 미리 채울 때 CODE_ABC 로) */
export function randomCode(kind = "room") {
  const a = new Uint32Array(CODE_LEN[kind]);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => CODE_ABC[x % CODE_ABC.length]).join("");
}

/** 코드 꼴이 맞으면 고친 코드, 아니면 null */
export function checkCode(s, kind) {
  const c = normalizeCode(s);
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
