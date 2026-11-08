// 방(#/room/코드, 디자인 시안 ③ 7–11번): WebSocket 으로 붙어 대기실 → 대전 → 끝을 그린다(온라인 규약 3장).
// 화면은 늘 서버가 보낸 room 으로 다시 그리고, ev 는 알림과 공개 연출에만 쓴다.
// 사람은 고리 위 동그라미(나는 늘 맨 아래), 가운데에 남은 시간·준비 수·판 결과. 누가 냈는지는 ✓ 로만 보이고
// 내 손은 단추 테두리로만 표시한다. 다 내면 한꺼번에 공개: 손 배지와 이긴 손 → 진 손 화살표.
// 손은 한 번 누르면 바로 낸다(한 판에 한 번, 못 바꾼다). 같은 화면이 둘이서(변종·직접 만들기)와 여럿이(group)를 다 그린다.
// '준비'는 서버가 seats 에 ready 를 줄 때만 보인다(규약에 더해 달라고 백엔드에 부탁해 둠).

import { h, clear, append, setTitle, sleep, reducedMotion } from "../ui/dom.js";
import { t } from "../i18n.js";
import { handGrid, fastMode, painted, RESULT_WORD } from "../ui/widgets.js";
import { handArt } from "../ui/art.js";
import { setSetting } from "../ui/store.js";
import { chantWords } from "../views/matrix.js";
import { formatById } from "../games/match.js";
import { topBar, bigTitle, copyText } from "./common.js";
import { forgetRank } from "./rank.js";
import { noticeSlot } from "./notice.js";
import { avatar } from "./avatar.js";
import { peopleRing, timerDial, midText } from "./people-ring.js";
import { emoteRow, emoteLabel, isEmote } from "./emotes.js";
import { variantOf } from "./games.js";
import { playerId, meFields, myFace } from "./identity.js";
import { openSocket } from "./socket.js";
import { PROTOCOL, shareLink } from "./config.js";
import { CLOSE, EMOTE_GAP_MS, REVEAL_MS } from "./protocol.js";
import { serverNow } from "./net.js";
import { rulesEditor, rulesRows, gameName, isGroup } from "./rules.js";
import { sidesOf, seatName, seatBot, secondsLeft, canSit, finalFor, duelRound, groupRound, headcount, ringOrder, readyInfo, mmss, ranking } from "./room-model.js";
import { closeText, wsErrorText, noticeFor } from "./messages.js";

// 공개 연출: 한 마디 세는 시간, 결과를 적어도 보여 주는 시간. 셋을 세고(≈1.1초) 결과를 보여도 REVEAL_MS(2.5초) 안에 끝난다
const COUNT_MS = 360;
const SHOW_MS = 1300;

export function roomView(main, code) {
  setTitle(t("방 {code}", { code }));
  let room = null;
  let you = null;
  let V = null;
  let vKey = "";
  let panel = null;
  let panelKey = "";
  let left = false;
  let emoteAt = 0;
  // 화면에 공개해 보인 마지막 판. 손을 마지막으로 낸 state(ev throw)와 공개 state(ev reveal)가 같은 room 으로 잇달아 오므로
  // ev 가 아니라 hist 가 늘었는지로 공개 연출을 정한다. 처음 들어올 때는 지난 판을 다시 보이지 않는다
  let seenR = 0;
  const lastR = (r) => (r && r.hist && r.hist.length ? r.hist[r.hist.length - 1].r : 0);
  // 세 번 연달아 시간을 넘겨 컴퓨터가 내 자리를 이으면 서버는 나를 구경꾼(you null)으로 본다.
  // 그 자리를 기억해 두고 내 자리처럼 그린다. 손을 내거나 무엇이든 보내면 서버가 자리를 돌려준다(규약 3.5)
  let ghostSeat = null;

  const notices = noticeSlot();
  const body = h("div", { class: "room-body" });
  const announce = h("p", { class: "visually-hidden", "aria-live": "polite" });
  const root = h("div", { class: "online online-room" }, notices.el, body, announce);
  const fill = (...kids) => append(clear(body), kids);
  main.append(root);
  notices.set("wait", { title: t("방에 들어가는 중…"), spin: true });

  // ── 연결 ─────────────────
  const sock = openSocket(`/api/rooms/${code}/ws`, { v: PROTOCOL, pid: playerId(), ...meFields() }, { onMessage, onStatus });

  function onStatus(st) {
    if (st.state === "open") {
      notices.clear("wait", "drop", "limit");
      root.classList.remove("offline");
      return;
    }
    if (st.state === "connecting") {
      if (!room) notices.set("wait", { title: t("방에 들어가는 중…"), spin: true });
      return;
    }
    if (st.state === "retrying") {
      notices.clear("wait");
      const again = { label: t("다시"), run: () => sock.reconnect() };
      if (room) {
        root.classList.add("offline");
        notices.set("drop", { title: t("연결이 끊겼다"), text: t("다시 잇는 중… 화면을 닫지 마세요."), spin: true, action: again });
      } else {
        const n = noticeFor(st.code === CLOSE.busy ? "busy" : "network");
        notices.set(n.kind, { ...n, action: again });
      }
      return;
    }
    if (st.state === "closed") closed(st.code);
  }

  function onMessage(m) {
    if (m.t === "hello" || m.t === "state") {
      if (!m.room || !Array.isArray(m.room.seats)) return;
      const seated = Number.isInteger(m.you) ? m.you : null;
      if (seated !== null) ghostSeat = null;
      else {
        const ev = m.ev;
        if (ev && ev.k === "bot" && ev.why === "afk" && you !== null && ev.s === you) ghostSeat = you;
        const g = ghostSeat !== null ? m.room.seats[ghostSeat] : null;
        if (!g || g.kind !== "bot") ghostSeat = null;
      }
      you = seated !== null ? seated : ghostSeat;
      // 처음 들어오면 지난 판은 다시 보이지 않는다. 다시 하기로 hist 가 비면 처음부터 센다
      if (!room || lastR(m.room) < seenR) seenR = lastR(m.room);
      room = m.room;
      render(m.ev || null);
    } else if (m.t === "emote") {
      showEmote(m.s, m.e);
    } else if (m.t === "error") {
      notices.set("note", { title: wsErrorText(m.code) });
    }
  }

  function closed(closeCode) {
    if (left || closeCode === CLOSE.leave) return;
    clearInterval(ticker);
    if (panel && panel.destroy) panel.destroy();
    panel = null;
    notices.clear("wait", "drop", "limit");
    root.classList.remove("offline");
    const reload = { label: t("새로고침"), run: () => location.reload() };
    if (closeCode === CLOSE.version) notices.set("update", { ...noticeFor("version"), action: reload });
    const again =
      closeCode === CLOSE.replaced
        ? h("button", { type: "button", class: "btn btn-ink btn-big", onclick: () => location.reload() }, t("여기서 다시 들어가기"))
        : closeCode === CLOSE.version
          ? h("button", { type: "button", class: "btn btn-ink btn-big", onclick: () => location.reload() }, t("새로고침"))
          : null;
    fill(
      topBar({ href: "#/play", label: t("방") }, code).el,
      bigTitle(t("방 {code}", { code })),
      h("p", { class: "o-p" }, closeText(closeCode)),
      h("div", { class: "o-actions" }, again, h("a", { class: "btn btn-big" + (again ? "" : " btn-ink"), href: "#/play" }, t("온라인 첫 화면"))),
    );
  }

  function leaveRoom() {
    left = true;
    sock.close(CLOSE.leave);
    location.hash = "#/play";
  }

  /** 자리 이름. 처음부터 컴퓨터인 자리가 여럿이면 '컴퓨터 3' 처럼 자리 번호를 붙여 가른다 */
  function nameOf(i) {
    const seat = room.seats[i];
    if (seat && seat.kind === "bot" && !seat.name && room.seats.filter((x) => x.kind === "bot" && !x.name).length > 1) return t("컴퓨터 {n}", { n: i + 1 });
    return seatName(seat);
  }

  /** 내 자리를 컴퓨터가 잇고 있나 */
  const botHasMe = () => ghostSeat !== null && you === ghostSeat;
  const send = (msg) => {
    if (sock.send(msg)) return true;
    notices.set("note", { title: t("연결이 끊겨 보내지 못했다.") });
    return false;
  };

  // ── 그리기 ─────────────────
  function render(ev) {
    const r = room.rules;
    const key = isGroup(r) ? `g:${r.base}` : r.game === "custom" && r.custom ? `c:${r.custom.n}:${r.custom.k}:${r.custom.seed}` : r.game;
    if (key !== vKey) {
      vKey = key;
      V = isGroup(r) ? variantOf(r.base || "classic") : variantOf(r.game, r.custom);
    }
    root.dataset.phase = room.phase;
    const pk = [room.phase, vKey, you, room.host === you, isGroup(r) ? "g" : "d"].join("|");
    if (pk !== panelKey || !panel) {
      if (panel && panel.destroy) panel.destroy();
      panelKey = pk;
      panel = !V ? messagePanel(t("이 방의 게임을 이 화면이 아직 모른다. 새로고침해 주세요.")) : room.phase === "play" ? playPanel() : room.phase === "end" ? endPanel() : lobbyPanel();
      fill(panel.el);
    }
    panel.update(ev);
    if (ev) tell(ev);
  }

  // 화면 읽기 프로그램에 짧게 알린다(누가 들어옴·나감·봇이 이음)
  function tell(ev) {
    const who = (s) => (Number.isInteger(s) && room.seats[s] ? nameOf(s) : "");
    const lines = {
      join: () => t("{name} 들어옴", { name: who(ev.s) }),
      back: () => t("{name} 돌아옴", { name: who(ev.s) }),
      off: () => t("{name} 연결 끊김", { name: who(ev.s) }),
      gone: () => t("{name} 나감", { name: who(ev.s) }),
      bot: () => t("컴퓨터가 {n}번 자리를 이음", { n: ev.s + 1 }),
      host: () => t("방장이 {name}(으)로 바뀜", { name: who(ev.s) }),
      start: () => t("경기 시작"),
    };
    if (lines[ev.k]) announce.textContent = lines[ev.k]();
    if (ev.k === "bot" && ev.why === "afk" && ev.s === you) notices.set("note", { title: t("세 번 연달아 시간을 넘겨 컴퓨터가 내 자리를 이었다.") });
  }

  // ── 이모트 ─────────────────
  function sendEmote(id, row) {
    if (Date.now() - emoteAt < EMOTE_GAP_MS || !isEmote(id)) return;
    if (!send({ t: "emote", e: id })) return;
    emoteAt = Date.now();
    row.rest(EMOTE_GAP_MS);
  }
  function showEmote(s, e) {
    if (!room || !Number.isInteger(s) || !room.seats[s] || !isEmote(e)) return;
    if (panel && panel.bubble) panel.bubble(s, e);
    announce.textContent = `${s === you ? t("나") : nameOf(s)}: ${emoteLabel(e)}`;
  }
  function emoteBar() {
    if (you === null) return null;
    const row = emoteRow({ onPick: (id) => sendEmote(id, row) });
    if (Date.now() - emoteAt < EMOTE_GAP_MS) row.rest(EMOTE_GAP_MS - (Date.now() - emoteAt));
    return row;
  }

  // ── 고리에 놓을 사람 ─────────────────
  /**
   * phase: lobby | play | end. shown: 공개할 판 { hands: [손 번호|null], cmp?(0번 쪽), win?, out? }
   * 돌려주는 값: { people, order } (order[k] = 고리 k 번째 자리 번호)
   */
  /** 자리의 그림 꼴(서버가 seats[].face 를 준다). 내 사람 자리는 서버 값이 비어도(옛 서버·들어오는 중) 내가 고른 그림 */
  function whoOf(i) {
    const seat = room.seats[i];
    return i === you && seat.kind === "human" && !seat.face && myFace() ? { ...seat, face: myFace() } : seat;
  }

  function seatPeople(phase, shown = null) {
    const n = room.seats.length;
    const order = ringOrder(n, you);
    const now = serverNow();
    const group = isGroup(room.rules);
    const ri = readyInfo(room);
    const r = room.round;
    const people = order.map((i) => {
      const seat = room.seats[i];
      if (seat.kind === "empty") return { key: i, empty: true, emptyText: t("빈자리"), label: "", title: t("빈자리. 시작하면 컴퓨터가 앉는다.") };
      const me = i === you;
      const p = { key: i, who: whoOf(i), me, label: me ? t("나") : nameOf(i) };
      const subs = [];
      const say = [];
      const out = group && room.alive && phase !== "lobby" && !room.alive.includes(i);
      if (phase !== "play" && i === room.host && !room.random) p.host = t("방장");
      if (seat.kind === "human" && !seat.on) {
        p.away = true;
        p.dim = true;
        p.badge = { text: "!", kind: "away", say: t("끊김") };
        subs.push(seat.until ? t("자리 비움 {time}", { time: mmss(secondsLeft(seat.until, now)) }) : t("끊김"));
      } else if (phase === "lobby" && ri.supported && seat.kind === "human") {
        if (i === room.host || seat.ready) p.badge = { text: "✓", kind: "ok", say: t("준비") };
        else subs.push(t("준비 전"));
      } else if (phase === "play" && r && r.done[i] === true && !shown) {
        p.badge = { text: "✓", kind: "ok", say: t("냈다") };
      }
      if (me && seat.kind === "bot") subs.push(t("컴퓨터가 잇는 중"));
      else if (seat.kind === "bot" && !group && phase === "lobby") subs.push(seatBot(seat));
      if (!group && phase !== "lobby" && !(me && seat.kind === "bot")) subs.push(t("{n}승", { n: (room.score && room.score[i]) || 0 }));
      if (out && !shown) {
        p.dim = true;
        subs.push(room.rules.mode === "loser" ? t("빠져나감") : t("빠짐"));
      }
      if (shown && (shown.hands[i] === null || shown.hands[i] === undefined)) p.dim = true; // 이미 빠진 자리
      if (shown && shown.hands[i] !== null && shown.hands[i] !== undefined) {
        p.hand = { V, i: shown.hands[i] };
        if (!group && shown.cmp !== 0 && (shown.cmp > 0 ? 0 : 1) === i) p.badge = { text: "+1", kind: "plus", say: t("이김") };
      }
      if (phase === "end") {
        if (!group && room.winner === i) p.badge = { text: "👑", kind: "crown", say: t("우승") };
        if (group && room.last === i) p.badge = room.rules.mode === "loser" ? { text: t("술래"), kind: "away", say: t("술래") } : { text: "👑", kind: "crown", say: t("우승") };
        if (p.badge && p.badge.kind === "crown") p.strong = true;
      }
      p.sub = subs.filter(Boolean).join(" · ");
      p.title = [p.label, p.host, p.badge && p.badge.say, p.sub].concat(say).filter(Boolean).join(", ");
      return p;
    });
    return { people, order };
  }

  /** 공개한 판의 화살표(이긴 손 → 진 손) */
  function shownArrows(order, shown) {
    const at = (seat) => order.indexOf(seat);
    const arrows = [];
    if (!shown) return arrows;
    if (!isGroup(room.rules)) {
      if (shown.cmp === 0) return arrows;
      const w = shown.cmp > 0 ? 0 : 1;
      return [{ from: at(w), to: at(1 - w), hand: { V, i: shown.hands[w] } }];
    }
    if (shown.win === null || shown.win === undefined) return arrows;
    shown.hands.forEach((hw, w) => {
      if (hw !== shown.win) return;
      shown.hands.forEach((hl, l) => {
        if (hl === null || hl === undefined || hl === shown.win) return;
        arrows.push({ from: at(w), to: at(l), hand: { V, i: hw } });
      });
    });
    return arrows;
  }

  /** hist 한 줄 → 공개할 판 꼴 */
  function shownOf(entry) {
    if (!entry) return null;
    if (isGroup(room.rules)) {
      const g = groupRound(V, entry);
      return { r: g.r, hands: g.hands, win: g.win, out: g.out };
    }
    const hands = entry.hands.map((id) => (V.index[id] === undefined ? null : V.index[id]));
    if (hands.some((x) => x === null)) return null;
    return { r: entry.r, hands, cmp: entry.cmp };
  }

  /** 공개한 판의 가운데 글 */
  function shownText(shown) {
    if (isGroup(room.rules)) {
      if (shown.win === null || shown.win === undefined) return midText(t("다시!"), t("아무도 빠지지 않는다"));
      const n = shown.out.length;
      return midText(t("{h} 승", { h: V.hands[shown.win].name }), room.rules.mode === "loser" ? t("{n}명 빠져나감", { n }) : t("{n}명 빠짐", { n }));
    }
    const { me, op } = sidesOf(you);
    const cmp = me === 0 ? shown.cmp : -shown.cmp;
    const mi = shown.hands[me];
    const oi = shown.hands[op];
    const line = cmp !== 0 && V.cmp(mi, oi) === cmp ? V.sentence(mi, oi) : "";
    if (you === null) return midText(cmp === 0 ? t("비김") : t("{h} 승", { h: V.hands[cmp > 0 ? mi : oi].name }), line);
    return midText(RESULT_WORD[cmp], line, cmp > 0 ? "win" : cmp < 0 ? "lose" : "");
  }

  /**
   * 판 공개(11-08 사용자: "셋 둘 하나가 버벅인다, 3 2 1 로, 좀 더 박진감 있게"):
   *   고리 가운데에서 3 → 2 → 1(가위바위보는 가위! 바위! 보!)을 한 마디씩 크게 세고(그려진 뒤부터 COUNT_MS),
   *   모두의 손을 한꺼번에 뒤집듯 띄운 뒤 이긴 손 → 진 손 화살표를 긋고, 가운데에 결과를 쾅 찍는다.
   *   서버는 공개 뒤 REVEAL_MS 만큼 다음 판 시간을 늘려 두므로 그 안에서 연출한다(결과는 적어도 SHOW_MS 보인다).
   * 빨리 하기·움직임 줄이기면 세지 않고 바로 보인다. 더 새 공개가 시작되면(isLive 가 거짓) 그만둔다
   */
  async function revealOn(ring, entry, { hold = REVEAL_MS, isLive = () => true } = {}) {
    const shown = shownOf(entry);
    if (!shown) return;
    const t0 = Date.now();
    const quick = fastMode() || reducedMotion();
    if (!quick) {
      for (const w of countWords()) {
        ring.center(midText(w, "", "count"));
        await painted();
        await sleep(COUNT_MS);
        if (!isLive()) return;
      }
    }
    if (!isLive()) return;
    const { people, order } = seatPeople("play", shown);
    ring.el.classList.add("revealing");
    ring.set({ people, arrows: shownArrows(order, shown) });
    ring.center(shownText(shown));
    const rest = quick ? (fastMode() ? 1200 : hold) - (Date.now() - t0) : Math.max(hold - (Date.now() - t0), SHOW_MS);
    if (rest > 0) await sleep(rest);
    if (isLive()) ring.el.classList.remove("revealing");
  }
  /** 세는 말: 가위바위보 셋이면 가위! 바위! 보!(영어는 Rock! Paper! Scissors!), 아니면 3 2 1 */
  function countWords() {
    return chantWords(V).slice(0, 3);
  }

  // 위쪽 사람의 이름 줄이 가운데(시간 원·준비 수)와 겹치지 않을 만큼
  function ringHeight(n, phase) {
    if (phase === "play") return 330;
    if (n <= 2) return 280;
    return n <= 4 ? 290 : n <= 6 ? 310 : 330;
  }

  // ── 대기실 ─────────────────
  function lobbyPanel() {
    const host = you !== null && room.host === you;
    const top = topBar({ href: "#/play", label: t("방") });
    const ring = peopleRing({ height: ringHeight(room.seats.length, "lobby") });
    const editor = host ? rulesEditor(room.rules, { onChange: (r) => (setSetting("online.rules", r), send({ t: "rules", rules: r })) }) : null;
    const rows = h("dl", { class: "rules-rows" });
    const rulesCard = h(
      "section",
      { class: "o-card rules-card" },
      h("div", { class: "o-row" }, h("h2", { class: "o-h3 o-grow" }, t("규칙")), h("span", { class: "o-p o-small" }, t("방장만 바꾼다"))),
      editor ? editor.el : rows,
    );
    const info = h("p", { class: "o-p o-center" });
    const start = host ? h("button", { type: "button", class: "btn btn-ink btn-big", onclick: () => send({ t: "start" }) }) : null;
    const ready = h("button", { type: "button", class: "btn btn-big", hidden: true, "aria-pressed": "false" });
    ready.addEventListener("click", () => {
      const s = room.seats[you];
      if (s && s.kind === "human") send({ t: "ready", on: !s.ready });
    });
    const sit = h("button", { type: "button", class: "btn btn-big", onclick: () => send({ t: "sit" }) }, t("자리에 앉기"));
    const leave = h("button", { type: "button", class: "btn btn-sm btn-quiet", onclick: leaveRoom }, t("방 나가기"));
    const emotes = emoteBar();
    const el = h(
      "div",
      { class: "room-lobby" },
      top.el,
      room.random ? null : codeCard(),
      ring.el,
      info,
      emotes ? emotes.el : null,
      rulesCard,
      h("div", { class: "o-actions o-bottom" }, start, ready, sit),
      h("div", { class: "o-actions o-center-row" }, leave),
    );
    return {
      el,
      update() {
        const n = room.seats.length;
        top.right.textContent = room.random ? t("랜덤 매칭") : t("{n}명 방", { n });
        const { people } = seatPeople("lobby");
        ring.set({ people, height: ringHeight(n, "lobby") });
        const ri = readyInfo(room);
        const hc = headcount(room);
        ring.center(ri.supported ? midText(`${ri.ready}/${ri.total}`, t("준비")) : midText(`${hc.humans}/${hc.total}`, t("모임")));
        if (editor) editor.set(room.rules);
        else rows.replaceChildren(...rulesRows(room.rules).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]));
        const mine = you !== null ? room.seats[you] : null;
        ready.hidden = !(ri.supported && !host && mine && mine.kind === "human");
        if (!ready.hidden) {
          ready.textContent = mine.ready ? t("준비 취소") : t("준비");
          ready.setAttribute("aria-pressed", String(!!mine.ready));
          ready.classList.toggle("btn-ink", !mine.ready);
        }
        if (start) {
          start.textContent = hc.empty ? t("시작 (빈자리는 컴퓨터)") : t("시작");
          start.classList.toggle("ready-all", ri.all && ri.total > 1);
        }
        sit.hidden = !(you === null && canSit(room));
        info.textContent = [room.random
          ? t("랜덤 매칭 방이다. 둘 다 들어오면 바로 시작한다.")
          : you === null
            ? t("구경하는 중이다.")
            : host
              ? ri.supported && ri.total > 1
                ? ri.all
                  ? t("다 준비했다. 시작해 보세요.")
                  : t("준비한 사람이 {a}명, 아직 {b}명.", { a: ri.ready, b: ri.total - ri.ready })
                : hc.empty
                  ? t("친구에게 코드를 알려 주세요. 빈자리 {n}곳은 시작하면 컴퓨터가 앉는다.", { n: hc.empty })
                  : t("다 모였다. 시작해 보세요.")
              : t("방장이 시작하기를 기다린다."), room.watchers ? t("구경 {n}명", { n: room.watchers }) : ""].filter(Boolean).join(" ");
      },
      bubble: (s, e) => ring.bubble(s, e),
      tick() {
        if (room.seats.some((s) => s.kind === "human" && !s.on && s.until)) ring.set({ people: seatPeople("lobby").people });
      },
      destroy: () => ring.destroy(),
    };
  }

  /** 방 코드 카드: 큰 코드 + 복사(링크) + 공유 */
  function codeCard() {
    const url = shareLink(`/room/${code}`);
    const share = { title: t("가위바위보 방"), text: t("가위바위보 방 {code}에 들어와. 링크를 열면 바로 들어온다.", { code }), url };
    const done = h("span", { class: "copy-done", role: "status" });
    const copy = h("button", { type: "button", class: "btn btn-sm" }, t("복사"));
    copy.addEventListener("click", async () => {
      done.textContent = (await copyText(url)) ? t("방 링크를 복사했다.") : t("복사하지 못했다. 코드를 알려 주세요.");
      setTimeout(() => (done.textContent = ""), 3000);
    });
    const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
    const shareBtn = canShare ? h("button", { type: "button", class: "btn btn-sm", onclick: () => navigator.share(share).catch(() => {}) }, t("공유")) : null;
    return h(
      "section",
      { class: "o-card code-card" },
      h("div", { class: "o-row" }, h("div", { class: "o-grow" }, h("p", { class: "o-label" }, t("방 코드")), h("p", { class: "room-code" }, code)), copy, shareBtn),
      done,
    );
  }

  // ── 대전 ─────────────────
  function playPanel() {
    const group = isGroup(room.rules);
    const watcher = you === null;
    const top = topBar({ href: "#/play", label: t("방 {code}", { code }) });
    const ring = peopleRing({ height: ringHeight(room.seats.length, "play") });
    const dial = timerDial();
    const line = h("p", { class: "o-p o-center room-line" });
    const awayLine = h("p", { class: "o-p o-center room-away", hidden: true });
    const grid = watcher ? null : handGrid(V, { onPick: throwHand });
    const emotes = emoteBar();
    const reclaimBtn = h("button", { type: "button", class: "btn btn-ink btn-sm", onclick: () => sock.reconnect() }, t("자리 되찾기"));
    const reclaim = h("p", { class: "reclaim", hidden: true }, h("span", {}, t("컴퓨터가 내 자리를 잇고 있다. 손을 내면 돌아온다.")), reclaimBtn);
    const hist = histBox();
    const leave = h("button", { type: "button", class: "btn btn-sm btn-quiet", onclick: leaveRoom }, t("방 나가기"));
    let revealing = false;
    let revealSeq = 0; // 공개가 겹치면(판이 빨리 이어지면) 앞의 것은 그만둔다
    let live = true;
    let localPick = null; // 서버 답이 오기 전에 누른 손 { r, i }

    function throwHand(i) {
      const r = room.round;
      if (!r || room.mine || revealing || (group && !(room.alive || []).includes(you))) return;
      if (!send({ t: "throw", r: r.r, h: V.hands[i].id })) return;
      localPick = { r: r.r, i };
      markPicked(i);
      if (grid) grid.lock(true);
      tick();
    }
    function markPicked(i) {
      if (!grid) return;
      grid.buttons.forEach((b, k) => {
        b.classList.toggle("picked", k === i);
        b.setAttribute("aria-pressed", String(k === i));
      });
    }
    function mineNow() {
      const r = room.round;
      if (room.mine && V.index[room.mine] !== undefined) return V.index[room.mine];
      return localPick && r && localPick.r === r.r ? localPick.i : null;
    }
    function drawRing() {
      const { people } = seatPeople("play");
      ring.set({ people });
      ring.center(dial.el);
    }
    async function reveal(entry) {
      const my = ++revealSeq;
      revealing = true;
      if (grid) grid.lock(true);
      line.textContent = "";
      await revealOn(ring, entry, { isLive: () => live && my === revealSeq });
      if (!live || my !== revealSeq) return;
      revealing = false;
      update(null);
    }
    function update() {
      const last = room.hist[room.hist.length - 1];
      if (last && last.r > seenR) {
        seenR = last.r;
        reveal(last);
        return;
      }
      if (revealing) return;
      const r = room.round;
      // 랜덤 방 첫 경기(사람끼리)는 순위에 든다(규약 4.1)
      top.right.textContent = [r ? t("{r}판", { r: r.r }) : "", gameName(room.rules), room.rank ? t("순위 경기") : ""].filter(Boolean).join(" · ");
      const mine = mineNow();
      markPicked(mine);
      const alive = !group || (room.alive || []).includes(you);
      if (grid) grid.lock(!r || mine !== null || !alive);
      reclaim.hidden = !botHasMe();
      drawRing();
      tick();
    }
    function tick() {
      if (revealing) return;
      const r = room.round;
      const now = serverNow();
      const sec = r ? secondsLeft(r.deadline, now) : null;
      const total = room.rules.timer || 0;
      if (!r || !total || r.paused || sec === null) {
        dial.set(null, 0);
        ring.center(midText(r ? t("{r}판", { r: r.r }) : "", r && r.paused ? t("@timer:멈춤") : t("시간 제한 없음")));
      } else {
        dial.set(sec, sec / total, sec <= 5 && mineNow() === null && !!grid);
        if (!ring.el.querySelector(".dial")) ring.center(dial.el);
      }
      // 아래 줄: 몇 명이 냈나 · 시간이 지나면 대신 낸다
      const done = r ? r.done.filter((x) => x === true).length : 0;
      const alive = !group || (room.alive || []).includes(you);
      const parts = [];
      if (r) parts.push(t("{n}명 냈다", { n: done }));
      if (room.watchers) parts.push(t("구경 {n}명", { n: room.watchers }));
      if (watcher) parts.push(t("구경하는 중이다."));
      else if (!alive) parts.push(t("나는 빠졌다. 끝까지 볼 수 있다."));
      else if (mineNow() !== null) parts.push(group ? t("다른 사람을 기다린다") : t("상대를 기다린다"));
      else if (r && r.paused) parts.push(t("아무도 내지 않아 시간을 멈췄다"));
      else if (total) parts.push(t("시간이 지나면 아무 손이나 대신 낸다"));
      line.textContent = parts.join(" · ");
      // 끊긴 사람
      const away = room.seats.map((s, i) => [s, i]).filter(([s]) => s.kind === "human" && !s.on && s.until);
      awayLine.hidden = !away.length;
      if (away.length) {
        const [s] = away[0];
        awayLine.textContent = t("{name:이가} 나갔다. {n}초 안에 안 오면 컴퓨터가 잇는다.", { name: s.name, n: secondsLeft(s.until, now) });
        ring.set({ people: seatPeople("play").people });
      }
    }
    const el = h(
      "div",
      { class: "room-play" + (group ? " group" : "") },
      top.el,
      ring.el,
      line,
      awayLine,
      reclaim,
      grid ? grid.el : null,
      emotes ? emotes.el : null,
      hist.el,
      h("div", { class: "o-actions o-center-row" }, leave),
    );
    return {
      el,
      update() {
        update();
        hist.update();
      },
      tick,
      bubble: (s, e) => ring.bubble(s, e),
      onKey: (e) => (grid && !revealing ? grid.keyHandler(e) : false),
      destroy() {
        live = false;
        ring.destroy();
      },
    };
  }

  // ── 끝 ─────────────────
  function endPanel() {
    const group = isGroup(room.rules);
    const host = you !== null && room.host === you;
    const top = topBar({ href: "#/play", label: t("방 {code}", { code }) }, group ? t("경기 끝") : t("{format} 끝", { format: formatById(room.rules.format).name }));
    const head = h("div", { class: "end-head" });
    const ring = peopleRing({ height: ringHeight(room.seats.length, "end") });
    const ranks = h("ol", { class: "rank-list" });
    const rankCard = h("section", { class: "o-card rank-card", hidden: true }, ranks);
    const again = host ? h("button", { type: "button", class: "btn btn-ink btn-big", onclick: () => send({ t: "start" }) }, t("한 번 더 (같은 방)")) : null;
    const ready = h("button", { type: "button", class: "btn btn-big", hidden: true });
    ready.addEventListener("click", () => {
      const s = room.seats[you];
      if (s && s.kind === "human") send({ t: "ready", on: !s.ready });
    });
    const sit = h("button", { type: "button", class: "btn btn-big", onclick: () => send({ t: "sit" }) }, t("자리에 앉기"));
    const leave = h("button", { type: "button", class: "btn btn-big", onclick: leaveRoom }, t("나가기"));
    const info = h("p", { class: "o-p o-center" });
    const rated = h("p", { class: "o-p o-center rated-line", "aria-live": "polite", hidden: true });
    const editor = host ? rulesEditor(room.rules, { onChange: (r) => (setSetting("online.rules", r), send({ t: "rules", rules: r })) }) : null;
    const rulesCard = editor
      ? h("details", { class: "o-card rules-card" }, h("summary", { class: "o-h3" }, t("규칙 바꾸기")), editor.el)
      : null;
    const emotes = emoteBar();
    const hist = histBox();
    const lastEntry = room.hist[room.hist.length - 1];
    let intro = !!lastEntry && lastEntry.r > seenR; // 방금 끝난 판을 먼저 공개한다
    if (lastEntry) seenR = Math.max(seenR, lastEntry.r);
    let live = true;
    const el = h(
      "div",
      { class: "room-end" },
      top.el,
      head,
      rated,
      ring.el,
      rankCard,
      info,
      emotes ? emotes.el : null,
      h("div", { class: "o-actions o-bottom" + (again ? " two" : "") }, again, ready, sit, leave),
      rulesCard,
      hist.el,
    );

    async function runIntro() {
      const last = room.hist[room.hist.length - 1];
      head.replaceChildren();
      await revealOn(ring, last, { isLive: () => live });
      if (!live) return;
      intro = false;
      update();
    }
    function update() {
      hist.update();
      if (intro) return;
      const { people } = seatPeople("end");
      ring.set({ people });
      ring.center();
      head.replaceChildren(bigTitle(...finalTitle()));
      showRated();
      // 순위
      const list = ranking(room);
      ranks.replaceChildren(
        ...list.map((row) => {
          const s = room.seats[row.seat];
          const name = row.seat === you ? t("나") : nameOf(row.seat);
          const value = group
            ? row.out === null
              ? room.rules.mode === "loser"
                ? t("술래")
                : t("우승")
              : row.out
                ? room.rules.mode === "loser"
                  ? t("{r}판에 빠져나감", { r: row.out })
                  : t("{r}판에 빠짐", { r: row.out })
                : "—"
            : t("{n}승", { n: row.score });
          return h(
            "li",
            { class: "rank" + (row.seat === you ? " me" : "") },
            h("span", { class: "rank-n" }, String(row.rank)),
            avatar(whoOf(row.seat), { size: 28 }),
            h("span", { class: "rank-name" }, name),
            h("b", { class: "rank-v" }, value),
          );
        }),
      );
      rankCard.hidden = false;
      if (editor) editor.set(room.rules);
      const ri = readyInfo(room);
      const mine = you !== null ? room.seats[you] : null;
      ready.hidden = !(ri.supported && !host && mine && mine.kind === "human");
      if (!ready.hidden) {
        ready.textContent = mine.ready ? t("준비 취소") : t("한 번 더 준비");
        ready.setAttribute("aria-pressed", String(!!mine.ready));
        ready.classList.toggle("btn-ink", !mine.ready);
      }
      if (again) again.classList.toggle("ready-all", ri.all && ri.total > 1);
      sit.hidden = !(you === null && canSit(room));
      info.textContent =
        you === null ? t("구경하는 중이다.") : host ? t("같은 자리로 다시 하거나, 규칙을 바꾼 뒤 다시 할 수 있다.") : t("방장이 다시 시작하기를 기다린다.");
    }
    /** 순위 경기였으면 내 새 점수와 바뀐 만큼(+12). 끝(end) 바로 뒤에 ev rated 로 온다 */
    function showRated() {
      const rk = room.rank;
      if (!rk || you === null || group) {
        rated.hidden = true;
        return;
      }
      rated.hidden = false;
      if (rk.skip) {
        rated.replaceChildren(t("이번 경기는 순위에 들지 않았다."));
        return;
      }
      const mine = Array.isArray(rk.after) ? rk.after[you] : null;
      if (!mine || !Number.isFinite(mine.rating)) {
        rated.replaceChildren(t("점수를 세는 중…"));
        return;
      }
      forgetRank(room.rules.game);
      const d = Number.isFinite(mine.delta) ? Math.round(mine.delta) : 0;
      rated.replaceChildren(
        t("내 점수 {n}", { n: Math.round(mine.rating) }),
        " ",
        h("b", { class: d > 0 ? "tone-win" : d < 0 ? "tone-lose" : "" }, `(${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)})`),
        " · ",
        h("a", { class: "o-link", href: `#/rank/${encodeURIComponent(room.rules.game)}` }, t("@page:순위표"), h("span", { "aria-hidden": "true" }, " →")),
      );
    }
    function finalTitle() {
      if (group) {
        const last = room.last;
        const mine = last === you;
        const who = Number.isInteger(last) && room.seats[last] ? nameOf(last) : "?";
        if (room.rules.mode === "loser") return mine ? [t("내가 술래!"), "lose"] : [t("{who} 술래!", { who }), you === null ? "" : "win"];
        return mine ? [t("나 우승!"), "win"] : [t("{who} 우승!", { who }), you === null ? "" : "lose"];
      }
      const { me, op } = sidesOf(you);
      const fin = finalFor(room, me);
      if (you === null) return fin === 0 ? [t("비겼다"), ""] : [t("{who} 우승!", { who: seatName(room.seats[fin > 0 ? me : op]) }), ""];
      return fin > 0 ? [t("경기에서 이겼다!"), "win"] : fin < 0 ? [t("경기에서 졌다"), "lose"] : [t("비겼다"), ""];
    }
    if (intro) runIntro();
    return {
      el,
      update,
      bubble: (s, e) => ring.bubble(s, e),
      tick() {
        if (!intro && room.seats.some((s) => s.kind === "human" && !s.on && s.until)) ring.set({ people: seatPeople("end").people });
      },
      destroy() {
        live = false;
        ring.destroy();
      },
    };
  }

  /** 지난 판(접어 둔 목록) */
  function histBox() {
    const list = h("ol", { class: "room-hist", reversed: true });
    const sum = h("summary", {});
    const el = h("details", { class: "room-hist-box", hidden: true }, sum, list);
    return {
      el,
      update() {
        const items = room.hist || [];
        el.hidden = !items.length || !V;
        if (el.hidden) return;
        sum.textContent = t("지난 판 {n}", { n: items.length });
        const group = isGroup(room.rules);
        const { me, op } = sidesOf(you);
        list.replaceChildren(
          ...items
            .slice()
            .reverse()
            .map((e) => {
              if (group) {
                const g = groupRound(V, e);
                const text =
                  g.win === null
                    ? t("다시")
                    : t("{h} 승 · {names}", { h: V.hands[g.win].name, names: g.out.map((s) => (s === you ? t("나") : nameOf(s))).join(", ") || "—" });
                return h("li", { value: e.r }, text);
              }
              const d = duelRound(V, e, me);
              if (!d) return h("li", { value: e.r }, "?");
              const word =
                you === null
                  ? d.cmp === 0
                    ? t("비김")
                    : t("{name} 승", { name: seatName(room.seats[d.cmp > 0 ? me : op]) })
                  : d.cmp > 0
                    ? t("이김")
                    : d.cmp < 0
                      ? t("짐")
                      : t("비김");
              return h(
                "li",
                { value: e.r, class: you === null ? "" : d.cmp > 0 ? "win" : d.cmp < 0 ? "lose" : "" },
                handArt(V.hands[d.mi], "hist-art"),
                h("span", {}, `${V.hands[d.mi].name} : ${V.hands[d.oi].name}`),
                handArt(V.hands[d.oi], "hist-art"),
                h("span", { class: "hist-word" }, word),
              );
            }),
        );
      },
    };
  }

  function messagePanel(text) {
    return { el: h("div", {}, topBar({ href: "#/play", label: t("방") }, code).el, h("p", { class: "o-p" }, text)), update() {} };
  }

  // 남은 시간·끊긴 자리 초를 1초마다 고친다
  const ticker = setInterval(() => {
    if (room && panel && panel.tick) panel.tick();
  }, 1000);

  return {
    onKey: (e) => (panel && panel.onKey ? panel.onKey(e) : false),
    destroy() {
      clearInterval(ticker);
      notices.destroy();
      if (panel && panel.destroy) panel.destroy();
      // 화면을 옮기면 자리를 60초 지켜 준다(나가기 단추는 바로 비운다)
      if (!left) sock.close(1000);
    },
  };
}
