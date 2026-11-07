// 도전장 화면(#/c/번호). 지금은 자리만 있다.
// 다음 단계: 만든 사람·변종·규칙만 보여 주고, 손을 고르면 서버가 판정한 두 손과 결과를 보여 준다.

import { h, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { onlineHead } from "./common.js";

export function challengeView(main, id) {
  setTitle(t("도전장"));
  main.append(h("div", { class: "online" }, onlineHead(t("도전장"), t("번호 {id}", { id })), h("p", { class: "note" }, t("도전장은 곧 열린다."))));
  return {};
}
