// 서버·연결 상태를 문장으로. 서버는 코드만 보내고 문장은 화면이 사용자 언어로 만든다.
// 서버 오류 코드는 온라인 규약 5장(server/src/protocol.js 의 ERRORS·WS_ERRORS). 그 밖에 화면이 만드는 코드:
// offline(인터넷 없음), timeout(답 없음), network(닿지 않음: 서버 꺼짐·하루 한도·CORS), bad_reply(답을 못 읽음)

import { t, lang } from "../i18n.js";

/** 하루 무료 한도가 풀리는 때(UTC 0시, 한국 오전 9시)를 보는 사람의 시각으로 */
export function resetTime(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toLocaleTimeString(lang() === "en" ? "en-US" : "ko-KR", { hour: "numeric", minute: "2-digit" });
}

export function errorText(code) {
  switch (code) {
    case "offline":
      return t("인터넷에 이어져 있지 않다. 연결을 확인해 주세요.");
    case "timeout":
      return t("서버가 답하지 않는다. 잠시 뒤에 다시 해 보세요.");
    case "version":
      return t("화면과 서버의 버전이 다르다. 새로고침해 주세요.");
    case "bad_reply":
    case "bad_request":
    case "bad_pid":
      return t("서버와 말이 맞지 않았다. 새로고침해 주세요.");
    case "origin":
      return t("이 주소에서는 온라인 대전을 쓸 수 없다.");
    case "bad_name":
      return t("이 이름은 쓸 수 없다. 온라인 첫 화면에서 이름을 바꿔 주세요.");
    case "not_found":
      return t("도전장을 찾지 못했다. 링크가 틀렸거나 기한이 지나 지워졌다.");
    case "closed":
      return t("이미 끝난 도전장이다.");
    case "own":
      return t("내가 만든 도전장에는 답할 수 없다.");
    case "bad_game":
      return t("이 게임은 아직 온라인에서 할 수 없다.");
    case "bad_hand":
      return t("그 손은 이 게임에 없다.");
    case "too_fast":
      return t("너무 자주 보냈다. 잠시 뒤에 다시 해 보세요.");
    default:
      // network·busy·server·http_5xx: 서버가 꺼졌거나 하루 한도에 닿았다(규약 5장: 모두 busy 처럼 안내)
      return t("서버에 닿지 않는다. 잠시 뒤에 다시 해 보세요. 하루 무료 한도를 넘었다면 {time}에 풀린다.", { time: resetTime() });
  }
}
