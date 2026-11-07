// 랜덤 매칭(#/match, #/match?v=게임&f=판수): 게임과 판 수를 고르면 같은 걸 고른 사람과 짝을 짓는다(온라인 규약 4장).
// 짝이 생기면(matched) 이 연결을 바로 닫고(1000) 그 방(#/room/코드)으로 간다. 20초가 지나도 없으면 컴퓨터를 권한다.

import { h, clear, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { selectBox } from "../ui/widgets.js";
import { setting, setSetting } from "../ui/store.js";
import { formatById } from "../games/match.js";
import { onlineHead, statusLine } from "./common.js";
import { randomGames, randomGame } from "./games.js";
import { myName, playerId } from "./identity.js";
import { openSocket } from "./socket.js";
import { PROTOCOL } from "./config.js";
import { MATCH_FORMATS, MATCH_BOT_OFFER_MS } from "./protocol.js";
import { errorText, closeText } from "./messages.js";

export function matchView(main, params = {}) {
  setTitle(t("랜덤 매칭"));
  let game = [params.v, setting("online.matchGame", null), "classic"].find((id) => id && randomGame(id));
  let format = [params.f, setting("online.matchFormat", null), "bo3"].find((f) => MATCH_FORMATS.includes(f));
  let sock = null;
  let since = 0;
  let offered = false;
  let timer = 0;

  const gameSel = selectBox({
    label: t("게임"),
    value: game,
    options: randomGames().map((e) => ({ id: e.id, name: e.name })),
    onChange: (id) => {
      game = id;
      setSetting("online.matchGame", id);
    },
  });
  const formatSel = selectBox({
    label: t("판 수"),
    value: format,
    options: MATCH_FORMATS.map((id) => ({ id, name: formatById(id).name })),
    onChange: (id) => {
      format = id;
      setSetting("online.matchFormat", id);
    },
  });
  const find = h("button", { type: "button", class: "btn btn-ink" }, t("상대 찾기"));
  find.addEventListener("click", search);
  const status = statusLine({ hidden: true });
  const box = h("section", { class: "panel match-form", "aria-live": "polite" });

  function formView() {
    clear(box).append(
      gameSel.el,
      formatSel.el,
      h("p", { class: "online-note" }, t("내 이름: {name}", { name: myName() }), " · ", h("a", { href: "#/play" }, t("이름 바꾸기"))),
      h("div", { class: "form-actions" }, find),
      status.el,
    );
  }

  function waitView() {
    const elapsed = h("p", { class: "challenge-lead" });
    const offer = h("div", { class: "match-offer", hidden: true });
    const stop = h("button", { type: "button", class: "btn" }, t("그만두기"));
    stop.addEventListener("click", cancel);
    clear(box).append(
      h("p", { class: "match-what" }, `${randomGame(game).name} · ${formatById(format).name}`),
      elapsed,
      offer,
      h("div", { class: "form-actions" }, stop),
      status.el,
    );
    status.hide();
    const tick = () => {
      if (!since) return (elapsed.textContent = t("대기열에 들어가는 중…"));
      const s = Math.floor((Date.now() - since) / 1000);
      elapsed.textContent = t("상대를 찾는 중… {n}초", { n: s });
      if (!offered && Date.now() - since >= MATCH_BOT_OFFER_MS) {
        offered = true;
        const bot = h("button", { type: "button", class: "btn btn-ink" }, t("컴퓨터와 하기"));
        bot.addEventListener("click", () => {
          bot.disabled = true;
          if (!sock || !sock.send({ t: "bot" })) bot.disabled = false;
        });
        const more = h("button", { type: "button", class: "btn" }, t("더 기다리기"));
        more.addEventListener("click", () => (offer.hidden = true));
        offer.append(h("p", {}, t("아직 같은 게임을 기다리는 사람이 없다. 컴퓨터와 할까?")), h("div", { class: "form-actions" }, bot, more));
        offer.hidden = false;
      }
    };
    tick();
    clearInterval(timer);
    timer = setInterval(tick, 1000);
  }

  function search() {
    since = 0;
    offered = false;
    waitView();
    sock = openSocket("/api/match/ws", { v: PROTOCOL, pid: playerId(), name: myName(), game, format }, { onMessage, onStatus });
  }

  function onMessage(m) {
    if (m.t === "queued") {
      if (!since) since = Date.now();
    } else if (m.t === "matched" && typeof m.room === "string") {
      // 서버도 4100 으로 닫지만 늦게 닿을 수 있어 기다리지 않는다(규약 4장)
      stopSearch(1000);
      location.hash = `#/room/${m.room}`;
    } else if (m.t === "error") {
      status.set("bad", errorText(m.code));
    }
  }

  function onStatus(s) {
    if (s.state === "open") status.hide();
    else if (s.state === "retrying") status.set("bad", since ? t("연결이 끊겼다. 곧 다시 잇는다.") : errorText("network"));
    else if (s.state === "closed") {
      stopSearch(null);
      formView();
      status.set("bad", closeText(s.code));
    }
  }

  function stopSearch(code) {
    clearInterval(timer);
    if (sock && code !== null) sock.close(code);
    sock = null;
  }

  function cancel() {
    stopSearch(1000);
    formView();
  }

  main.append(
    h(
      "div",
      { class: "online" },
      onlineHead(t("랜덤 매칭"), t("같은 게임과 판 수를 고른 사람과 짝을 지어 준다. 판정은 서버가 한다.")),
      box,
    ),
  );
  formView();

  return {
    destroy() {
      stopSearch(1000);
    },
  };
}
