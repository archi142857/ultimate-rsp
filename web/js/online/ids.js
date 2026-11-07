// 온라인 주소 읽기: #/play(첫 화면), #/c/번호(도전장), #/room/코드(방).
// 번호와 코드의 꼴은 서버 규약을 따른다(규약이 정해지면 여기를 맞춘다).

export const CHALLENGE_ID = /^[A-Za-z0-9_-]{4,32}$/;
export const ROOM_CODE = /^[A-Z0-9]{4,8}$/;

function decode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

/** 방 코드를 입력받은 꼴 그대로 고친다: 앞뒤 빈칸·가운데 빈칸·줄표를 빼고 대문자로 */
export function normalizeRoomCode(s) {
  return String(s || "")
    .replace(/[\s-]+/g, "")
    .toUpperCase();
}

/**
 * 온라인 주소면 { kind } 를 돌려준다. 아니면 null.
 *   { kind: "home" } | { kind: "challenge", id } | { kind: "room", code } | { kind: "bad", what }
 */
export function parseOnline(path) {
  if (path === "/play" || path === "/play/") return { kind: "home" };
  let m = /^\/c\/([^/]*)\/?$/.exec(path);
  if (m) {
    const id = decode(m[1]);
    return id && CHALLENGE_ID.test(id) ? { kind: "challenge", id } : { kind: "bad", what: "challenge" };
  }
  m = /^\/room\/([^/]*)\/?$/.exec(path);
  if (m) {
    const code = normalizeRoomCode(decode(m[1]));
    return ROOM_CODE.test(code) ? { kind: "room", code } : { kind: "bad", what: "room" };
  }
  return null;
}
