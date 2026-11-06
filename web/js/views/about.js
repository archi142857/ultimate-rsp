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
        t("무엇인가"),
        h("p", {}, t("가위바위보 변종 {n}가지를 한곳에 모았다. 손이 셋인 옛 놀이부터 손이 101개인 판, 가위바위보 위에 규칙을 쌓은 놀이, 여럿이 하는 놀이, 그리고 가위바위보처럼 물고 무는 생물의 시뮬레이션까지 있다.", { n: total })),
        h("p", {}, t("변종마다 누가 누구를 이기는지 고리 그림으로 보여 주고, 컴퓨터와 바로 겨룰 수 있다. 가입은 없고, 전적과 설정은 이 브라우저(localStorage)에만 남는다.")),
      ),
      block(
        t("컴퓨터 전략"),
        h("p", {}, t("한 판짜리 변종에서는 아래 전략 가운데 하나를 고른다. 전략 리그에서는 이 전략들끼리 겨룬다.")),
        h("ul", { class: "botlist" }, BOTS.map((b) => h("li", {}, h("b", {}, b.name), b.desc))),
        h("p", { class: "note" }, t("'사람 흉내'는 Wang, Xu, Zhou(2014)가 사람 360명의 가위바위보에서 찾은 버릇(이기면 그대로, 지면 방금 이긴 손을 이기는 쪽으로 옮긴다)을 본떴다. 확률 값은 이 앱에서 정했다.")),
      ),
      block(
        t("계산은 이렇게"),
        h("p", {}, t("'최적 섞기'는 두 사람 제로섬 게임을 선형 계획법(심플렉스)으로 풀어 구한다. 모든 손을 똑같이 섞어도 지지 않는 판은 그 답을 그대로 보여 준다.")),
        h("p", {}, t("글리코와 한정 가위바위보의 계산기는 끝에서부터 거꾸로 따지는 동적 계획법으로, 자리마다 최적 섞기를 다시 푼다. 하나빼기는 두 손을 본 뒤의 2×2 게임을 풀고, 그 값으로 처음에 낼 두 손의 섞기도 푼다.")),
      ),
      block(
        t("출처"),
        h("p", {}, t("변종마다 화면 아래에 출처를 달았다. 모은 자료와 규칙의 근거는 저장소의 docs/variants.md 에 한데 적었다. RPS-7·9·11·15·25·101 의 규칙은 David C. Lovelace 의 판을 따랐고, 이기는 방식을 말하는 낱말은 이 앱에서 새로 지었다.")),
      ),
      block(
        t("라이선스"),
        h("p", {}, t("코드는 MIT 라이선스다. 글꼴은 Black Han Sans(© The Black Han Sans Project Authors)와 IBM Plex Sans KR(© IBM Corp.)이고 둘 다 SIL Open Font License 1.1 이다. jsDelivr 로 Fontsource 판을 불러온다.")),
        h("p", {}, t("손 그림은 Microsoft 의 "), h("a", { href: "https://github.com/microsoft/fluentui-emoji", rel: "noopener" }, "Fluent UI Emoji"), t("(© Microsoft Corporation, MIT 라이선스)를 고쳐 쓴다. 아직 그림이 없는 손은 보는 기기의 이모지로 나온다.")),
      ),
      block(
        t("만든 사람"),
        h("p", {}, t("서울대학교 동물생명공학전공 25학번 이영표. 버그 제보와 새 변종 제안은 "), h("a", { href: "https://github.com/Archi142857/ultimate-rsp/issues", rel: "noopener" }, t("GitHub 이슈")), t("로 받는다.")),
      ),
    ),
  );
  return {};
}
