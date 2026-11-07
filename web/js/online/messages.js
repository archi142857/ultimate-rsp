// 서버·연결 상태를 문장으로. 서버는 코드만 보내고 문장은 화면이 사용자 언어로 만든다.
// 서버 오류 코드는 규약(세션소통\자료\온라인_규약.md)이 정해지면 여기에 더한다.

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
    default:
      return t("서버에 닿지 않는다. 잠시 뒤에 다시 해 보세요. 하루 무료 한도를 넘었다면 {time}에 풀린다.", { time: resetTime() });
  }
}
