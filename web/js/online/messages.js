// 서버·연결 상태를 문장으로. 서버는 코드만 보내고 문장은 화면이 사용자 언어로 만든다.
// 서버 오류 코드는 온라인 규약 5장(server/src/protocol.js 의 ERRORS·WS_ERRORS). 그 밖에 화면이 만드는 코드:
// offline(인터넷 없음), timeout(답 없음), network(닿지 않음: 서버 꺼짐·하루 한도·CORS), bad_reply(답을 못 읽음)

import { t, lang } from "../i18n.js";
import { CLOSE } from "./protocol.js";

/** 하루 무료 한도가 풀리는 때(UTC 0시, 한국 오전 9시)를 보는 사람의 시각으로 */
export function resetTime(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toLocaleTimeString(lang() === "en" ? "en-US" : "ko-KR", { hour: "numeric", minute: "2-digit" });
}

export function errorText(code) {
  switch (code) {
    case "offline":
      return t("인터넷에 연결되어 있지 않다. 연결을 확인하자.");
    case "timeout":
      return t("서버가 응답하지 않는다. 잠시 뒤 다시 해 보자.");
    case "version":
      return t("화면과 서버 버전이 다르다. 새로고침하면 된다.");
    case "bad_reply":
    case "bad_request":
    case "bad_pid":
      return t("서버와 데이터를 주고받다가 오류가 났다. 새로고침하면 된다.");
    case "origin":
      return t("이 주소에서는 온라인 대전을 할 수 없다.");
    case "bad_name":
      return t("이 이름은 쓸 수 없다. 온라인 첫 화면에서 이름을 바꾸면 된다.");
    case "not_found":
      return t("도전장을 찾지 못했다. 링크가 틀렸거나 기한이 지나 지워졌다.");
    case "closed":
      return t("이미 끝난 도전장이다.");
    case "own":
      return t("내가 만든 도전장에는 답할 수 없다.");
    case "bad_game":
      return t("이 게임은 아직 온라인에서 할 수 없다.");
    case "bad_rules":
      return t("그 규칙은 쓸 수 없다.");
    case "bad_hand":
      return t("그 손은 이 게임에 없다.");
    case "too_fast":
      return t("너무 자주 보냈다. 잠시 뒤 다시 해 보자.");
    default:
      // network·busy·server·http_5xx: 서버가 꺼졌거나 하루 한도에 닿았다(규약 5장: 모두 busy 처럼 안내)
      return t("서버에 연결할 수 없다. 잠시 뒤 다시 해 보자. 하루 무료 한도를 넘었다면 {time}에 풀린다.", { time: resetTime() });
  }
}

/**
 * 맨 위 알림 자리(notice.js)에 띄울 꼴: { kind, title, text }.
 * 네트워크 오류·CORS 오류·5xx·busy 는 모두 한도처럼 안내한다(규약 5장: 무료 한도가 차면 Cloudflare 오류 페이지가 와서 CORS 오류로 보인다)
 */
export function noticeFor(code) {
  switch (code) {
    case "offline":
      return { kind: "drop", title: t("인터넷에 연결되어 있지 않다"), text: t("연결을 확인하자.") };
    case "version":
      return { kind: "update", title: t("새 버전이 나왔다"), text: t("새로고침하면 바뀐다.") };
    case "timeout":
    case "network":
    case "busy":
    case "server":
      return limitNotice();
    default:
      return /^http_5\d\d$/.test(code) || !code ? limitNotice() : { kind: "note", title: errorText(code), text: "" };
  }
}

const limitNotice = () => ({
  kind: "limit",
  title: t("지금은 서버에 연결할 수 없다"),
  text: t("오늘 무료 한도가 찼거나 서버가 잠시 멈췄다. 한도는 {time}에 풀린다. 혼자 하기는 그대로 된다.", { time: resetTime() }),
});

/** 방 WebSocket 의 {t:"error"} (연결은 그대로) */
export function wsErrorText(code) {
  switch (code) {
    case "not_host":
      return t("방장만 할 수 있다.");
    case "phase":
      return t("지금은 할 수 없다.");
    case "stale":
      return t("지난 판이라 받지 않았다.");
    case "already":
      return t("이번 판에는 이미 냈다.");
    case "full":
      return t("앉을 자리가 없다.");
    default:
      return errorText(code);
  }
}

/** 다시 붙지 않는 닫는 코드(규약 5장)의 안내 */
export function closeText(code) {
  switch (code) {
    case CLOSE.not_found:
      return t("방을 찾지 못했다. 코드가 틀렸거나 방이 지워졌다.");
    case CLOSE.replaced:
      return t("다른 창에서 이 방에 들어가서 이 창은 연결을 끊었다.");
    case CLOSE.deleted:
      return t("방이 지워졌다.");
    case CLOSE.full:
      return t("방에 사람이 너무 많다. 잠시 뒤 다시 해 보자.");
    case CLOSE.version:
      return errorText("version");
    case CLOSE.origin:
      return errorText("origin");
    case CLOSE.bad_request:
      return t("이름이나 주소가 잘못돼 들어가지 못했다. 온라인 첫 화면에서 이름을 확인하자.");
    default:
      return errorText("network");
  }
}
