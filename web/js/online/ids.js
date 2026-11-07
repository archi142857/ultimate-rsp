// 온라인 주소 읽기: #/play(첫 화면), #/c/new(도전장 만들기), #/c/코드(도전장), #/room/코드(방).
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

/** 코드 꼴이 맞으면 고친 코드, 아니면 null */
export function checkCode(s, kind) {
  const c = normalizeCode(s);
  if (c.length !== CODE_LEN[kind]) return null;
  for (const ch of c) if (!CODE_ABC.includes(ch)) return null;
  return c;
}

/**
 * 온라인 주소면 { kind } 를 돌려준다. 아니면 null.
 *   { kind: "home" } | { kind: "new-challenge" } | { kind: "challenge", code } | { kind: "room", code } | { kind: "match" } | { kind: "bad", what }
 */
export function parseOnline(path) {
  if (path === "/play" || path === "/play/") return { kind: "home" };
  if (path === "/c/new" || path === "/c/new/") return { kind: "new-challenge" };
  if (path === "/match" || path === "/match/") return { kind: "match" };
  let m = /^\/c\/([^/]*)\/?$/.exec(path);
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
