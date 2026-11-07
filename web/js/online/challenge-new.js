// 도전장 만들기(#/c/new, #/c/new?v=게임): 게임과 손을 고르면 서버가 번호를 주고, 그 도전장 화면(#/c/번호)으로 간다.
// 내 손은 서버와 이 브라우저(mine.js)에만 남는다. 링크에는 번호만 들어간다.

import { h, clear, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { compileVariant } from "../core/engine.js";
import { selectBox } from "../ui/widgets.js";
import { setting, setSetting } from "../ui/store.js";
import { onlineHead, statusLine, ringPanel, handPicker } from "./common.js";
import { challengeGames, challengeGame } from "./games.js";
import { myName, playerId } from "./identity.js";
import { createChallenge } from "./api.js";
import { rememberChallenge } from "./mine.js";
import { errorText } from "./messages.js";

export function newChallengeView(main, params = {}) {
  setTitle(t("도전장 만들기"));
  const ctl = new AbortController();
  let gameId = [params.v, setting("online.game", null), "classic"].find((id) => id && challengeGame(id));
  let V = null;
  let picker = null;

  const status = statusLine({ hidden: true });
  const send = h("button", { type: "button", class: "btn btn-ink", disabled: true }, t("도전장 만들기"));
  send.addEventListener("click", submit);
  const gameSel = selectBox({
    label: t("게임"),
    value: gameId,
    options: challengeGames().map((e) => ({ id: e.id, name: e.name })),
    onChange(id) {
      gameId = id;
      setSetting("online.game", id);
      draw();
    },
  });
  const grid = h("div", { class: "entry-grid" });

  function draw() {
    V = compileVariant(challengeGame(gameId));
    const rp = ringPanel(V, { rulesLink: `#/v/${gameId}` });
    picker = handPicker(V, { ring: rp.ring, label: t("낼 손"), onPick: () => (send.disabled = false) });
    send.disabled = true;
    status.hide();
    clear(grid).append(
      rp.el,
      h(
        "section",
        { class: "panel challenge-form", "aria-label": t("도전장 만들기") },
        gameSel.el,
        h("p", { class: "challenge-lead" }, t("낼 손을 고르세요. 받은 사람은 결과가 나올 때까지 모른다.")),
        picker.el,
        h("p", { class: "online-note" }, t("보내는 이름: {name}", { name: myName() }), " · ", h("a", { href: "#/play" }, t("이름 바꾸기"))),
        h("div", { class: "form-actions" }, send),
        status.el,
      ),
    );
  }

  async function submit() {
    if (!picker || picker.picked === null || send.disabled) return;
    const hand = V.hands[picker.picked].id;
    const game = gameId;
    send.disabled = true;
    picker.lock(true);
    status.set("wait", t("도전장을 만드는 중…"));
    try {
      const { code } = await createChallenge({ game, hands: [hand], name: myName(), pid: playerId() }, { signal: ctl.signal });
      rememberChallenge({ id: code, role: "maker", game, hand, at: Date.now() });
      location.hash = `#/c/${code}`;
    } catch (e) {
      if (ctl.signal.aborted) return;
      status.set("bad", errorText(e.code));
      send.disabled = false;
      picker.lock(false);
    }
  }

  main.append(
    h(
      "div",
      { class: "online online-wide" },
      onlineHead(t("도전장 만들기"), t("게임과 손을 고르면 링크가 생긴다. 받은 사람은 내 손을 모른 채 손을 고른다.")),
      grid,
    ),
  );
  draw();

  return {
    onKey: (e) => (picker ? picker.keyHandler(e) : false),
    destroy() {
      ctl.abort();
    },
  };
}
