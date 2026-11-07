// 서버와 주고받기(HTTP). 실시간 대전(WebSocket)은 규약이 정해지면 여기에 더한다.
// 무료 한도를 아끼려고 '단순 요청'만 보낸다: GET 은 헤더 없이, POST 는 JSON 을 text/plain 으로.
// 그러면 브라우저가 미리 묻는 요청(OPTIONS)을 따로 보내지 않는다.

import { serverUrl, PROTOCOL } from "./config.js";

/** 서버가 준 오류 코드나 연결 문제. code 를 보고 화면이 문장을 고른다(online/messages.js) */
export class OnlineError extends Error {
  constructor(code, detail = null) {
    super(code);
    this.name = "OnlineError";
    this.code = code;
    this.detail = detail;
  }
}

// 서버 시각 - 내 시각(ms). 서버가 준 마감 시각을 내 시계로 옮길 때 쓴다
let offset = 0;
export const serverNow = () => Date.now() + offset;
export function noteServerTime(now, sentAt = Date.now()) {
  if (Number.isFinite(now)) offset = now - sentAt;
}

/**
 * 서버에 묻는다. body 가 있으면 POST, 없으면 GET. 답은 JSON.
 * 실패하면 OnlineError: offline, network, timeout, aborted, bad_reply, http_<상태>, 또는 서버가 준 오류 코드
 */
export async function api(path, { body, signal, timeout = 8000 } = {}) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new OnlineError("offline");
  const ctl = new AbortController();
  let why = null;
  const timer = setTimeout(() => {
    why = "timeout";
    ctl.abort();
  }, timeout);
  const onAbort = () => {
    why = why || "aborted";
    ctl.abort();
  };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  const init = { signal: ctl.signal, cache: "no-store" };
  if (body !== undefined) {
    init.method = "POST";
    init.headers = { "Content-Type": "text/plain;charset=UTF-8" };
    init.body = JSON.stringify(body);
  }
  const sentAt = Date.now();
  let res;
  try {
    res = await fetch(serverUrl() + path, init);
  } catch {
    // 서버가 없거나 꺼졌거나 하루 한도를 넘으면(이때는 서버가 돌지 않아 CORS 머리가 없다) 브라우저는 모두 같은 실패로 본다
    throw new OnlineError(why || "network");
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* JSON 이 아니면 아래에서 상태로 가른다 */
  }
  if (data && typeof data.now === "number") noteServerTime(data.now, (sentAt + Date.now()) / 2);
  if (data && typeof data.error === "string") throw new OnlineError(data.error, data);
  if (!res.ok) throw new OnlineError(`http_${res.status}`, data);
  if (data === null) throw new OnlineError("bad_reply");
  return data;
}

/** 서버가 살아 있고 규약 번호가 같은지 본다 */
export async function hello(opts) {
  const data = await api(`/api/hello?v=${PROTOCOL}`, opts);
  if (typeof data.v !== "number") throw new OnlineError("bad_reply", data);
  if (data.v !== PROTOCOL) throw new OnlineError("version", data);
  return data;
}
