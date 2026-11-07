// 온라인 대전 설정: 서버 주소와 규약 번호.
// 시험할 때는 페이지 주소에 ?server=http://localhost:8787 을 붙인다(# 앞, 이 기기 안 주소만 받는다).
// # 뒤가 바뀌어도 ? 부분은 남으니 화면을 옮겨 다녀도 시험 서버를 계속 쓴다.

/** 화면이 아는 규약 번호. 서버의 번호와 다르면 새로고침을 안내한다 */
export const PROTOCOL = 1;

export const DEFAULT_SERVER = "https://ultimate-rsp.sanger-lee138.workers.dev";

const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

/** 주소의 ?server= 를 본다. 남의 서버로 이름과 id 가 새지 않게 이 기기 안 주소만 받는다 */
export function pickServer(search = "") {
  let p = null;
  try {
    p = new URLSearchParams(search).get("server");
  } catch {
    /* 읽지 못하면 기본 서버 */
  }
  if (p) {
    const s = p.trim().replace(/\/+$/, "");
    if (LOCAL.test(s)) return s;
  }
  return DEFAULT_SERVER;
}

export function serverUrl() {
  return pickServer(typeof location === "undefined" ? "" : location.search);
}

/** WebSocket 주소(http → ws, https → wss) */
export function socketUrl(path) {
  return serverUrl().replace(/^http/, "ws") + path;
}
