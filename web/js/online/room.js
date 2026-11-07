// 방 화면(#/room/코드). 지금은 자리만 있다.
// 다음 단계: 대기실(자리·봇·준비) → 대전 → 결과, 끊기면 다시 잇기.

import { h, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { onlineHead } from "./common.js";

export function roomView(main, code) {
  setTitle(t("방 {code}", { code }));
  main.append(h("div", { class: "online" }, onlineHead(t("방 {code}", { code })), h("p", { class: "note" }, t("방은 곧 열린다."))));
  return {};
}
