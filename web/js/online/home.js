// 온라인 첫 화면(#/play): 내 이름, 도전장·방·랜덤 매칭, 서버 상태.
// 세 가지는 아직 자리만 있다(준비 중). 하나씩 열면서 카드를 링크·단추로 바꾼다.

import { h, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { onlineHead, statusLine } from "./common.js";
import { myName, setMyName, randomName, NAME_MAX } from "./identity.js";
import { hello } from "./net.js";
import { errorText } from "./messages.js";

const MODES = [
  {
    id: "challenge",
    art: "✉️",
    name: () => t("도전장"),
    desc: () => t("게임과 손을 골라 링크를 보낸다. 받은 사람은 내 손을 모른 채 손을 고르고, 결과는 둘 다 본다."),
  },
  {
    id: "room",
    art: "🚪",
    name: () => t("방"),
    desc: () => t("방을 만들어 코드를 알려 주면 같이 겨룬다. 빈자리는 컴퓨터가 채운다."),
  },
  {
    id: "random",
    art: "🎲",
    name: () => t("랜덤 매칭"),
    desc: () => t("게임을 고르면 기다리는 사람과 짝을 지어 준다. 아무도 없으면 컴퓨터와 겨룰 수 있다."),
  },
];

export function onlineHomeView(main) {
  setTitle(t("온라인 대전"));
  const ctl = new AbortController();

  const input = h("input", {
    type: "text",
    id: "online-name",
    class: "text-input",
    // 기본 폭(size 20)은 한글 글꼴에서 350px 가까이 돼 좁은 화면을 넘친다. 폭은 CSS 가 정한다
    size: 1,
    // 이모지가 두 칸으로 세어져도 잘리지 않게 넉넉히. 실제로는 cleanName 이 20글자로 자른다
    maxlength: NAME_MAX * 2,
    autocomplete: "off",
    spellcheck: "false",
    enterkeyhint: "done",
    "aria-describedby": "online-name-note",
  });
  input.value = myName();
  input.addEventListener("change", () => (input.value = setMyName(input.value)));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });
  const again = h("button", { type: "button", class: "btn", onclick: () => (input.value = setMyName(randomName())) }, t("새 이름"));

  const nameBox = h(
    "section",
    { class: "panel online-me", "aria-labelledby": "online-name-label" },
    h("label", { class: "field-label", id: "online-name-label", for: "online-name" }, t("내 이름")),
    h("div", { class: "name-row" }, input, again),
    h("p", { class: "online-note", id: "online-name-note" }, t("가입은 없다. 겨루는 상대에게 이 이름이 보이고, 이름은 이 브라우저에만 남는다.")),
  );

  const modes = h(
    "ul",
    { class: "modes" },
    MODES.map((m) =>
      h(
        "li",
        { class: "mode", "data-mode": m.id },
        h("span", { class: "mode-art", "aria-hidden": "true" }, m.art),
        h("div", { class: "mode-body" }, h("h2", { class: "mode-title" }, m.name()), h("p", { class: "mode-desc" }, m.desc())),
        h("span", { class: "mode-soon" }, t("준비 중")),
      ),
    ),
  );

  const status = statusLine();
  async function check() {
    status.set("wait", t("서버 확인 중…"));
    try {
      await hello({ signal: ctl.signal });
      status.set("ok", t("서버와 이어졌다."));
    } catch (e) {
      if (ctl.signal.aborted) return;
      if (e.code === "version") status.set("bad", errorText(e.code), { label: t("새로고침"), run: () => location.reload() });
      else status.set("bad", errorText(e.code), { label: t("다시 확인"), run: check });
    }
  }

  main.append(
    h(
      "div",
      { class: "online" },
      onlineHead(t("온라인 대전"), t("도전장을 보내거나, 방을 만들어 친구와, 아니면 아무나와 겨룬다."), { back: false }),
      nameBox,
      modes,
      status.el,
    ),
  );
  check();
  return {
    destroy() {
      ctl.abort();
    },
  };
}
