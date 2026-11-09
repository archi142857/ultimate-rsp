// 랜덤 매칭(#/match, #/match?v=게임&f=판수, 디자인 시안 ③ 12–14번): 게임과 판 수를 고르면 같은 걸 고른 사람과 짝을 짓는다.
// 첫 화면 랜덤 칸의 '시작'이 이 고르기 화면을 연다(게임·판 수를 여기서 고른다, 11-08 사용자 요청)
// (온라인 규약 4장). 기다리는 동안 고리에 나와 빈자리 '?' 를 두고 가운데에 기다린 초를 센다.
// 짝이 생기면(matched) 이 연결을 바로 닫고(1000) 그 방(#/room/코드)으로 간다. 20초가 지나면 아래 시트로 컴퓨터를 권한다.
// 여럿이(규약 4.2, 11-08 밤): 인원에서 '여럿이'를 고르면 여럿이 가위바위보의 게임(바탕)과 정하기를 고른다.
// 기다리는 동안 모인 수(n/max)와 시작까지 남은 초를 보인다. 3명이 모이면 10초 뒤, 10명이면 바로 방이 생긴다. 순위에는 안 든다.

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
import { groupBases, gameName, modeName, seatsOf } from "./rules.js";
import { myName, playerId, meFields, meWho } from "./identity.js";
import { openSocket } from "./socket.js";
import { PROTOCOL } from "./config.js";
import { MATCH_FORMATS, MATCH_BOT_OFFER_MS, GROUP_MODES, GROUP_SEATS, GROUP_MATCH_WAIT_MS } from "./protocol.js";
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
  // 여럿이: 인원(duo·group), 게임(바탕), 정하기
  let kind = setting("online.matchKind", "duo") === "group" ? "group" : "duo";
  let base = [setting("online.matchBase", null), "classic"].find((id) => id && groupBases().some((e) => e.id === id));
  let mode = [setting("online.matchMode", null), GROUP_MODES[0]].find((m) => GROUP_MODES.includes(m));
  let queue = null; // 여럿이 기다릴 때 서버가 알려 준 { n, min, max, startIn, at }
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
    const group = kind === "group";
    const choose = (rows, onPick) => {
      for (const row of rows) {
        row.type = "button";
        row.setAttribute("aria-pressed", String(row.classList.contains("on")));
        row.addEventListener("click", () => {
          onPick(row.dataset.id);
          for (const r of rows) {
            r.classList.toggle("on", r === row);
            r.setAttribute("aria-pressed", String(r === row));
          }
        });
      }
      return rows;
    };
    // 여럿이 인원은 바탕마다 다르다(컨셉 seatRange: 손 셋 3–8명)
    const seatsText = (id) => {
      const r = seatsOf(id);
      return t("{a}–{b}명", { a: r.min, b: r.max });
    };
    const rows = (group ? groupBases() : randomGames()).map((e) => {
      const row = variantRow(variant(e), { tag: "button", on: e.id === (group ? base : game), sub: group ? seatsText(e.id) : t("@seats:{n}명", { n: 2 }) });
      row.dataset.id = e.id;
      return row;
    });
    const groupNote = () => {
      const r = seatsOf(base);
      return t("{a}명이 모이면 {s}초 뒤에, {b}명이 차면 바로 시작한다. 여럿이 하는 경기는 순위에 들지 않는다.", { a: r.min, b: r.max, s: Math.round(GROUP_MATCH_WAIT_MS / 1000) });
    };
    const note = group ? h("p", { class: "o-p o-small" }, groupNote()) : null;
    choose(rows, (id) => {
      if (group) {
        base = id;
        setSetting("online.matchBase", id);
        note.textContent = groupNote();
      } else {
        game = id;
        setSetting("online.matchGame", id);
      }
    });
    const list = h("div", { class: "var-list", role: "group", "aria-label": t("게임") }, rows);
    const kindSeg = segmented({
      label: t("인원"),
      value: kind,
      options: [
        { id: "duo", name: t("둘이서") },
        { id: "group", name: t("여럿이") },
      ],
      onChange: (id) => {
        kind = id;
        setSetting("online.matchKind", id);
        pickView();
        const seg = body.querySelector(".o-kv-card .seg button[aria-checked=true]");
        if (seg) seg.focus();
      },
    });
    const second = group
      ? segmented({
          label: t("정하기"),
          value: mode,
          options: GROUP_MODES.map((id) => ({ id, name: modeName(id) })),
          onChange: (id) => {
            mode = id;
            setSetting("online.matchMode", id);
          },
        })
      : segmented({
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
      h("div", { class: "o-card o-kv-card" }, kindSeg.el, second.el),
      note,
      list,
      h("div", { class: "o-actions o-sticky" }, find),
      h("p", { class: "o-p o-small o-center" }, t("내 이름: {name}", { name: myName() }), " · ", h("a", { href: "#/play?name=1" }, t("이름 바꾸기"))),
    );
    // 고른 게임이 보이게
    const on = list.querySelector(".on");
    if (on && on.scrollIntoView) requestAnimationFrame(() => on.scrollIntoView({ block: "nearest" }));
  }

  // ── 13·14: 기다리는 중 ─────────────────
  // 여럿이면 고리에 모인 사람(나 + 다른 사람)과 빈자리를 두고, 가운데에는 시작까지 남은 초(없으면 기다린 초)를 센다
  let waitUi = null;
  function waitView() {
    root.classList.add("waiting");
    const group = kind === "group";
    const dial = timerDial();
    ring = peopleRing({ height: group ? 330 : 300, size: group ? 50 : 60, chords: false, label: t("랜덤 매칭") });
    ring.center(dial.el);
    const note = h("p", { class: "o-p o-center", "aria-live": "polite" });
    const stop = h("button", { type: "button", class: "btn btn-big" }, t("그만 찾기"));
    stop.addEventListener("click", cancel);
    const sheet = h("div", { class: "o-sheet-wrap", hidden: true });
    const sub = group ? `${gameName({ game: "group", base })} · ${modeName(mode)}` : `${randomGame(game).name} · ${formatById(format).name}`;
    fill(
      topBar({ href: "#/play", label: t("랜덤 매칭") }, sub).el,
      bigTitle(group ? t("사람을 모으는 중이다") : t("짝을 찾는 중이다")),
      ring.el,
      note,
      h("div", { class: "o-actions o-bottom" }, stop),
      sheet,
    );
    /** 시작까지 남은 ms(여럿이고 서버가 시작 시각을 줬을 때만) */
    const left = () => (queue && queue.startIn !== null ? Math.max(0, queue.startIn - (Date.now() - queue.at)) : null);
    const draw = () => {
      const me = { key: "me", who: meWho(), me: true, label: t("나") };
      if (!group) {
        ring.set({ people: [me, { key: "q", empty: true, emptyText: "?", label: "" }] });
        note.textContent = t("찾으면 바로 방으로 들어간다.");
        return;
      }
      const n = queue ? queue.n : 1;
      const min = queue ? queue.min : seatsOf(base).min;
      const max = queue ? queue.max : seatsOf(base).max;
      const people = [me];
      for (let k = 1; k < n; k++) people.push({ key: `p${k}`, who: { art: "human" }, label: "" });
      const empty = n < min ? min - n : n < max ? 1 : 0;
      for (let k = 0; k < empty; k++) people.push({ key: `q${k}`, empty: true, emptyText: "?", label: "" });
      ring.set({ people });
      note.textContent =
        left() !== null
          ? t("{n}/{max}명이 모였다. 곧 시작한다.", { n, max })
          : t("{n}/{max}명이 모였다. {min}명이 되면 {s}초 뒤에 시작한다.", { n, max, min, s: Math.round(GROUP_MATCH_WAIT_MS / 1000) });
      // 사람이 모자랄 때만 컴퓨터를 권한다(규약 4.2)
      if (n >= min) sheet.hidden = true;
    };
    const tick = () => {
      const l = left();
      if (l !== null) {
        const sec = Math.ceil(l / 1000);
        dial.set(sec, 1 - l / GROUP_MATCH_WAIT_MS, sec <= 3);
        return;
      }
      const s = since ? Math.floor((Date.now() - since) / 1000) : 0;
      dial.set(s, since ? (Date.now() - since) / MATCH_BOT_OFFER_MS : 0);
      const short = !group || !queue || queue.n < queue.min;
      if (!offered && short && since && Date.now() - since >= MATCH_BOT_OFFER_MS) {
        offered = true;
        showSheet(sheet, group);
      }
    };
    waitUi = { draw, tick };
    draw();
    tick();
    stopTimer();
    timer = setInterval(tick, 250);
  }

  function showSheet(sheet, group) {
    const bot = h("button", { type: "button", class: "btn btn-ink btn-big" }, t("컴퓨터와 하기"));
    bot.addEventListener("click", () => {
      bot.disabled = true;
      if (!sock || !sock.send({ t: "bot" })) bot.disabled = false;
    });
    const more = h("button", { type: "button", class: "btn btn-big" }, t("더 기다리기"));
    more.addEventListener("click", () => (sheet.hidden = true));
    const title = h("h2", { class: "o-h2", id: "bot-sheet-title" }, t("컴퓨터와 할까?"));
    const n = Math.round(MATCH_BOT_OFFER_MS / 1000);
    sheet.replaceChildren(
      h("div", { class: "o-scrim", onclick: () => (sheet.hidden = true) }),
      h(
        "div",
        { class: "o-sheet", role: "dialog", "aria-modal": "false", "aria-labelledby": "bot-sheet-title" },
        title,
        h(
          "p",
          { class: "o-p" },
          group
            ? t("{n}초 동안 {min}명이 모이지 않았다. 지금 모인 사람에 컴퓨터를 더해 시작해도 된다.", { n, min: queue ? queue.min : GROUP_SEATS.min })
            : t("{n}초 동안 짝을 못 찾았다. 컴퓨터와 먼저 하고 있어도 된다.", { n }),
        ),
        bot,
        more,
      ),
    );
    sheet.hidden = false;
    bot.focus();
  }

  function search() {
    // 빨리 두 번 누르면 연결이 둘 생긴다(검수 11-08)
    if (sock) return;
    since = 0;
    offered = false;
    queue = null;
    notices.clear("drop", "limit", "note");
    waitView();
    const what = kind === "group" ? { game: "group", base, mode } : { game, format };
    sock = openSocket("/api/match/ws", { v: PROTOCOL, pid: playerId(), ...meFields(), ...what }, { onMessage, onStatus });
  }

  function onMessage(m) {
    if (m.t === "queued") {
      if (!since) since = Date.now();
      // 여럿이: 모인 수와 시작 시각(서버 시계라 now 와의 차이로 센다)
      if (kind === "group" && Number.isInteger(m.n)) {
        queue = {
          n: m.n,
          min: Number.isInteger(m.min) ? m.min : GROUP_SEATS.min,
          max: Number.isInteger(m.max) ? m.max : seatsOf(base).max,
          startIn: Number.isFinite(m.start) && Number.isFinite(m.now) ? m.start - m.now : null,
          at: Date.now(),
        };
      }
      if (waitUi) {
        waitUi.draw();
        waitUi.tick();
      }
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
      if (since) notices.set("drop", { title: t("연결이 끊겼다"), text: t("다시 연결하는 중… 화면을 열어 두자."), spin: true });
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
    waitUi = null;
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
