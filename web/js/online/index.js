// 온라인 주소를 알맞은 화면으로 보낸다(app.js 가 parseOnline 결과를 넘긴다).

import { h, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { topBar, bigTitle } from "./common.js";
import { onlineHomeView } from "./home.js";
import { challengeView } from "./challenge.js";
import { newChallengeView } from "./challenge-new.js";
import { matchView } from "./match.js";
import { roomView } from "./room.js";

export { parseOnline } from "./ids.js";

export function onlineView(main, route, params) {
  if (route.kind === "home") return onlineHomeView(main, params);
  if (route.kind === "new-challenge") return newChallengeView(main, params);
  if (route.kind === "challenge") return challengeView(main, route.code, params);
  if (route.kind === "room") return roomView(main, route.code, params);
  if (route.kind === "match") return matchView(main, params);
  return badLinkView(main, route.what);
}

function badLinkView(main, what) {
  const room = what === "room";
  const title = room ? t("방") : t("도전장");
  setTitle(title);
  main.append(
    h(
      "div",
      { class: "online" },
      topBar({ href: "#/play", label: t("온라인") }).el,
      bigTitle(title),
      h("p", { class: "o-p" }, room ? t("방 코드가 맞지 않는다. 코드를 다시 확인해 주세요.") : t("링크가 맞지 않는다. 받은 링크를 다시 확인해 주세요.")),
      h("a", { class: "btn btn-ink btn-big", href: "#/play" }, t("온라인 첫 화면")),
    ),
  );
  return {};
}
