// 정보 화면: 무엇인지, 컴퓨터 전략, 계산 방법, 출처와 라이선스, 만든 사람.

import { h, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { BOTS } from "../core/bots.js";
import { CATALOG } from "../data/catalog.js";
import { block } from "../ui/widgets.js";

export function aboutView(main) {
  setTitle(t("정보"));
  const total = CATALOG.length;
  main.append(
    h(
      "div",
      { class: "about" },
      h("header", { class: "entry-head" }, h("h1", { class: "entry-title" }, "Ultimate RSP"), h("p", { class: "entry-sub" }, t("궁극의 가위바위보"))),
      block(
        t("이 사이트"),
        h("p", {}, t("가위바위보 변종 {n}가지를 한곳에 모았습니다. 손이 셋인 옛 놀이부터 손이 101개인 변종, 가위바위보 위에 규칙을 쌓은 놀이, 여럿이 하는 놀이까지 있습니다. 가위바위보처럼 서로 물고 물리는 생물을 흉내 낸 시뮬레이션도 있습니다.", { n: total })),
        h("p", {}, t("변종마다 누가 누구를 이기는지 고리 그림으로 보여 주고, 컴퓨터와 바로 겨룰 수 있습니다. 온라인에서는 방을 열어 친구와 하거나, 링크로 도전장을 보내거나, 아무나와 붙을 수 있습니다. 가입은 필요 없습니다. 로그인은 하지 않아도 되고, 하면 다른 기기에서도 같은 기록과 이름을 씁니다. 컴퓨터와 한 전적과 설정은 이 브라우저(localStorage)에만 남고, 온라인 대전의 닉네임·도전장·순위와 로그인 정보는 서버에 남습니다.")),
      ),
      block(
        t("컴퓨터 전략"),
        h("p", {}, t("손을 한 번씩 내는 변종에서는 컴퓨터 전략을 아래에서 고릅니다. 전략의 진화에서는 이 전략끼리 겨룹니다.")),
        h("ul", { class: "botlist" }, BOTS.map((b) => h("li", {}, h("b", {}, b.name), b.desc))),
        h("p", { class: "note" }, t("'사람 흉내'는 Wang, Xu, Zhou(2014)가 사람 360명의 가위바위보에서 찾은 버릇(이기면 그대로, 지면 방금 이긴 손을 이기는 쪽으로 옮김)을 본떴습니다. 확률 값은 이 앱에서 정했습니다.")),
      ),
      block(
        t("계산은 이렇게"),
        h("p", {}, t("'최적 비율'은 두 사람 제로섬 게임을 선형 계획법(심플렉스)으로 풀어 구합니다. 모든 손을 똑같이 섞어도 지지 않는 변종에서는 그 답이 그대로 나옵니다.")),
        h("p", {}, t("글리코와 한정 가위바위보의 계산기는 동적 계획법을 씁니다. 끝에서부터 거꾸로 따지며 자리마다 최적 비율을 다시 풉니다. 하나빼기는 두 손을 본 뒤의 2×2 게임을 먼저 풀고, 그 값으로 처음에 낼 두 손의 비율을 정합니다.")),
      ),
      block(
        t("출처"),
        h("p", {}, t("변종마다 화면 아래에 출처를 달았습니다. 모은 자료와 규칙의 근거는 저장소의 docs/variants.md에 모아 두었습니다. RPS-7·9·11·15·25·101의 규칙은 David C. Lovelace의 것을 따랐고, 손이 이기는 동작('덮어 끔', '녹임' 같은 말)은 이 앱에서 붙였습니다.")),
      ),
      block(
        t("라이선스"),
        h("p", {}, t("코드는 MIT 라이선스입니다. 글꼴은 Black Han Sans(© The Black Han Sans Project Authors)와 IBM Plex Sans KR(© IBM Corp.)이고, 둘 다 SIL Open Font License 1.1을 따릅니다. 글꼴 파일은 jsDelivr에서 Fontsource 것을 불러옵니다.")),
        h("p", {}, t("손 그림은 Microsoft의 "), h("a", { href: "https://github.com/microsoft/fluentui-emoji", rel: "noopener" }, "Fluent UI Emoji"), t("(© Microsoft Corporation, MIT 라이선스)를 고쳐 썼습니다. 그림을 불러오지 못하면 기기의 이모지로 보입니다.")),
      ),
      block(
        t("만든 사람"),
        h("p", {}, t("서울대학교 동물생명공학전공 25학번 이영표. 버그 제보와 새 변종 제안은 "), h("a", { href: "https://github.com/Archi142857/ultimate-rsp/issues", rel: "noopener" }, t("GitHub 이슈")), t("로 받습니다.")),
      ),
    ),
  );
  return {};
}
