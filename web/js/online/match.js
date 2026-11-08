// 랜덤 매칭(#/match, #/match?v=게임&f=판수, 디자인 시안 ③ 12–14번): 게임과 판 수를 고르면 같은 걸 고른 사람과 짝을 짓는다.
// 첫 화면 랜덤 칸의 '시작'은 고른 게임을 v 로 실어 이 고르기 화면을 연다(판 수를 여기서 고른다, 11-08 사용자 요청)
// (온라인 규약 4장). 기다리는 동안 고리에 나와 빈자리 '?' 를 두고 가운데에 기다린 초를 센다.
// 짝이 생기면(matched) 이 연결을 바로 닫고(1000) 그 방(#/room/코드)으로 간다. 20초가 지나면 아래 시트로 컴퓨터를 권한다.

import { h, clear, append, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { segmented } from "../ui/widgets.js";
import { setting, setSetting } from "../ui/store.js";
import { formatById } from "../games/match.js";
import { compileVariant } from "../core/engine.js";
import { topBar, bigTitle, variantRow } from "./common.js";
import { noticeSlot } from "./notice.js";
import { peopleRing, timerDial } from "./people-ring.js";
import { randomGames, randomGame } from "./games.js";
import { myName, playerId, meFields, meWho } from "./identity.js";
import { openSocket } from "./socket.js";
import { PROTOCOL } from "./config.js";
import { MATCH_FORMATS, MATCH_BOT_OFFER_MS } from "./protocol.js";
import { noticeFor, closeText, wsErrorText } from "./messages.js";

const compiled = new Map();
const variant = (entry) => {
  if (!compiled.has(entry.id)) compiled.set(entry.id, compileVariant(entry));
  return compiled.get(entry.id);
};

export function matchView(main, params = {}) {
  setTitle(t("랜덤 매칭"));
  let game = [params.v, setting("online.matchGame", null), "classic"].find((id) => id && randomGame(id));
  let format = [params.f, setting("online.matchFormat", null), "bo3"].find((f) => MATCH_FORMATS.includes(f));
  let sock = null;
  let since = 0;
  let offered = false;
  let timer = 0;
  let ring = null;

  const notices = noticeSlot();
  const body = h("div", { class: "online-body" });
  const root = h("div", { class: "online match-page" }, notices.el, body);
  const fill = (...kids) => append(clear(body), kids);

  // ── 12: 게임 고르기 ─────────────────
  function pickView() {
    stopTimer();
    root.classList.remove("waiting");
    const rows = randomGames().map((e) => {
      const row = variantRow(variant(e), { tag: "button", on: e.id === game, sub: t("@seats:{n}명", { n: 2 }) });
      row.type = "button";
      row.setAttribute("aria-pressed", String(e.id === game));
      row.addEventListener("click", () => {
        game = e.id;
        setSetting("online.matchGame", game);
        for (const r of list.children) {
          r.classList.toggle("on", r === row);
          r.setAttribute("aria-pressed", String(r === row));
        }
      });
      return row;
    });
    const list = h("div", { class: "var-list", role: "group", "aria-label": t("게임") }, rows);
    const fmt = segmented({
      label: t("판 수"),
      value: format,
      options: MATCH_FORMATS.map((id) => ({ id, name: formatById(id).name })),
      onChange: (id) => {
        format = id;
        setSetting("online.matchFormat", id);
      },
    });
    const find = h("button", { type: "button", class: "btn btn-ink btn-big" }, t("찾기"));
    find.addEventListener("click", search);
    fill(
      topBar({ href: "#/play", label: t("랜덤 매칭") }).el,
      bigTitle(t("무엇으로 붙을까?")),
      h("div", { class: "o-card o-kv-card" }, fmt.el),
      list,
      h("div", { class: "o-actions o-sticky" }, find),
      h("p", { class: "o-p o-small o-center" }, t("내 이름: {name}", { name: myName() }), " · ", h("a", { href: "#/play?name=1" }, t("이름 바꾸기"))),
    );
    // 고른 게임이 보이게
    const on = list.querySelector(".on");
    if (on && on.scrollIntoView) requestAnimationFrame(() => on.scrollIntoView({ block: "nearest" }));
  }

  // ── 13·14: 기다리는 중 ─────────────────
  function waitView() {
    root.classList.add("waiting");
    const dial = timerDial();
    ring = peopleRing({ height: 300, size: 60, chords: false, label: t("랜덤 매칭") });
    ring.set({
      people: [
        { key: "me", who: meWho(), me: true, label: t("나") },
        { key: "q", empty: true, emptyText: "?", label: "" },
      ],
    });
    ring.center(dial.el);
    const stop = h("button", { type: "button", class: "btn btn-big" }, t("그만 찾기"));
    stop.addEventListener("click", cancel);
    const sheet = h("div", { class: "o-sheet-wrap", hidden: true });
    fill(
      topBar({ href: "#/play", label: t("랜덤 매칭") }, `${randomGame(game).name} · ${formatById(format).name}`).el,
      bigTitle(t("짝을 찾는 중이다")),
      ring.el,
      h("p", { class: "o-p o-center", "aria-live": "polite" }, t("찾으면 바로 방으로 들어간다.")),
      h("div", { class: "o-actions o-bottom" }, stop),
      sheet,
    );
    const tick = () => {
      const s = since ? Math.floor((Date.now() - since) / 1000) : 0;
      dial.set(s, since ? (Date.now() - since) / MATCH_BOT_OFFER_MS : 0);
      if (!offered && since && Date.now() - since >= MATCH_BOT_OFFER_MS) {
        offered = true;
        showSheet(sheet);
      }
    };
    tick();
    stopTimer();
    timer = setInterval(tick, 1000);
  }

  function showSheet(sheet) {
    const bot = h("button", { type: "button", class: "btn btn-ink btn-big" }, t("컴퓨터와 하기"));
    bot.addEventListener("click", () => {
      bot.disabled = true;
      if (!sock || !sock.send({ t: "bot" })) bot.disabled = false;
    });
    const more = h("button", { type: "button", class: "btn btn-big" }, t("더 기다리기"));
    more.addEventListener("click", () => (sheet.hidden = true));
    const title = h("h2", { class: "o-h2", id: "bot-sheet-title" }, t("컴퓨터와 할까?"));
    sheet.replaceChildren(
      h("div", { class: "o-scrim", onclick: () => (sheet.hidden = true) }),
      h(
        "div",
        { class: "o-sheet", role: "dialog", "aria-modal": "false", "aria-labelledby": "bot-sheet-title" },
        title,
        h("p", { class: "o-p" }, t("{n}초 동안 짝을 못 찾았다. 컴퓨터와 먼저 하고 있어도 된다.", { n: Math.round(MATCH_BOT_OFFER_MS / 1000) })),
        bot,
        more,
      ),
    );
    sheet.hidden = false;
    bot.focus();
  }

  function search() {
    since = 0;
    offered = false;
    notices.clear("drop", "limit", "note");
    waitView();
    sock = openSocket("/api/match/ws", { v: PROTOCOL, pid: playerId(), ...meFields(), game, format }, { onMessage, onStatus });
  }

  function onMessage(m) {
    if (m.t === "queued") {
      if (!since) since = Date.now();
    } else if (m.t === "matched" && typeof m.room === "string") {
      // 서버도 4100 으로 닫지만 늦게 닿을 수 있어 기다리지 않는다(규약 4장)
      stopSearch(1000);
      location.hash = `#/room/${m.room}`;
    } else if (m.t === "error") {
      notices.set("note", { title: wsErrorText(m.code) });
    }
  }

  function onStatus(st) {
    if (st.state === "open") notices.clear("drop", "wait");
    else if (st.state === "connecting") {
      if (!since) notices.set("wait", { title: t("서버에 연결하는 중…"), text: t("잠깐이면 된다."), spin: true });
    } else if (st.state === "retrying") {
      notices.clear("wait");
      if (since) notices.set("drop", { title: t("연결이 끊겼다"), text: t("다시 잇는 중… 화면을 닫지 마세요."), spin: true });
      else {
        const n = noticeFor("network");
        notices.set(n.kind, n);
      }
    } else if (st.state === "closed") {
      notices.clear("wait", "drop");
      stopSearch(null);
      pickView();
      if (st.code === 4000) notices.set("update", { ...noticeFor("version"), action: { label: t("새로고침"), run: () => location.reload() } });
      else notices.set("note", { title: closeText(st.code) });
    }
  }

  function stopTimer() {
    clearInterval(timer);
    timer = 0;
  }

  function stopSearch(code) {
    stopTimer();
    if (sock && code !== null) sock.close(code);
    sock = null;
    if (ring) ring.destroy();
    ring = null;
  }

  function cancel() {
    stopSearch(1000);
    notices.clear("drop", "wait", "limit");
    pickView();
  }

  main.append(root);
  pickView();

  return {
    destroy() {
      stopSearch(1000);
      notices.destroy();
    },
  };
}
