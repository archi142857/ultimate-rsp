// 다시 붙는 WebSocket(온라인 규약 3.3·4·5장).
// - 끊기면(1006 등) 1, 2, 4, 8, 16, 30초 간격으로 다시 붙고 그 뒤로 30초마다. 4013(너무 많이 보냄)은 30초 뒤.
// - 다시 붙지 않는 코드(4000 버전, 4001 나가기, 4004 없는 방, 4009 다른 창 …)와 4100(매칭 끝)은 'closed' 로 알린다.
// - 열려 있는 동안 30초마다 글자 'ping' 을 보낸다(서버가 깨지 않고 'pong' 으로 답한다).
// - 인터넷이 돌아오면(online 이벤트) 기다리지 않고 바로 붙는다.
// 서버가 받기 전에 거절할 때도 연결을 받은 뒤 {t:"error"} 를 보내고 닫는 코드로 닫는다(그래서 코드를 믿어도 된다).

import { socketUrl } from "./config.js";
import { noteServerTime } from "./net.js";
import { CLOSE, NO_RETRY, PING, PONG, PING_MS, RETRY_MS, TOO_FAST_WAIT_MS } from "./protocol.js";

/** n 번째 다시 붙기까지 기다릴 시간 */
export function retryDelay(tries, code = null) {
  if (code === CLOSE.too_fast) return TOO_FAST_WAIT_MS;
  return RETRY_MS[Math.min(tries, RETRY_MS.length - 1)];
}

/** 이 닫는 코드면 다시 붙지 않는다 */
export const isFinalClose = (code) => NO_RETRY.includes(code) || code === CLOSE.matched;

/**
 * path: "/api/rooms/K7Q2/ws" 처럼. params: 주소 뒤 ?v=…&pid=… 로 붙는다.
 * onMessage(msg): JSON 메시지(pong 은 거른다). onStatus({ state, code, retryAt }):
 *   state: "connecting"(처음·다시 붙는 중) | "open" | "retrying"(retryAt 에 다시) | "closed"(code 로 끝)
 */
export function openSocket(path, params, { onMessage, onStatus } = {}) {
  let ws = null;
  let tries = 0;
  let timer = 0;
  let ping = 0;
  let stopped = false;
  const url = () => `${socketUrl(path)}?${new URLSearchParams(params)}`;
  const status = (state, extra = {}) => onStatus && onStatus({ state, ...extra });

  function connect() {
    clearTimeout(timer);
    if (stopped) return;
    status("connecting", { tries });
    let sock;
    try {
      sock = new WebSocket(url());
    } catch {
      schedule(null);
      return;
    }
    ws = sock;
    sock.onopen = () => {
      if (ws !== sock) return;
      tries = 0;
      status("open");
      clearInterval(ping);
      ping = setInterval(() => sock.readyState === 1 && sock.send(PING), PING_MS);
    };
    sock.onmessage = (e) => {
      if (ws !== sock || typeof e.data !== "string" || e.data === PONG) return;
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg && typeof msg.now === "number") noteServerTime(msg.now);
      if (onMessage) onMessage(msg);
    };
    sock.onclose = (e) => {
      if (ws !== sock) return;
      ws = null;
      clearInterval(ping);
      if (stopped) return;
      if (isFinalClose(e.code)) {
        stopped = true;
        removeEventListener("online", onOnline);
        status("closed", { code: e.code });
        return;
      }
      schedule(e.code);
    };
    // onerror 뒤에는 늘 onclose 가 온다
    sock.onerror = () => {};
  }

  function schedule(code) {
    const wait = retryDelay(tries, code);
    tries++;
    status("retrying", { code, retryAt: Date.now() + wait });
    timer = setTimeout(connect, wait);
  }

  function onOnline() {
    if (!ws && !stopped) {
      tries = 0;
      connect();
    }
  }
  addEventListener("online", onOnline);
  connect();

  return {
    /** 보내기. 열려 있지 않으면 false */
    send(obj) {
      if (!ws || ws.readyState !== 1) return false;
      ws.send(JSON.stringify(obj));
      return true;
    },
    /** 그만두기. code 4001 은 '나가기'(자리를 바로 비운다), 1000 은 그냥 끊기(자리를 60초 지킨다) */
    close(code = 1000) {
      stopped = true;
      clearTimeout(timer);
      clearInterval(ping);
      removeEventListener("online", onOnline);
      if (ws) {
        try {
          ws.close(code);
        } catch {
          /* 이미 닫힘 */
        }
        ws = null;
      }
    },
    /** 지금 연결을 끊고 바로 다시 붙는다(서버는 들어올 때 봇이 잇던 내 자리를 되찾아 준다) */
    reconnect() {
      if (stopped) return;
      tries = 0;
      const old = ws;
      ws = null;
      clearInterval(ping);
      if (old) {
        try {
          old.close(1000);
        } catch {
          /* 이미 닫힘 */
        }
      }
      connect();
    },
    get open() {
      return !!ws && ws.readyState === 1;
    },
  };
}
