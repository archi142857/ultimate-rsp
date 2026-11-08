// 온라인 첫 화면(#/play, 디자인 시안2 ① 깔끔한 세 칸). 맨 위 줄: 왼쪽 프로필 칩(누르면 이름 바꾸기), 오른쪽 '전체 순위표 →'.
// 그 아래 제목과 세 칸: 랜덤 매칭(게임 고르기 + 시작, 이 게임 순위) · 방(만들기, 코드로 들어가기) · 도전장(쓰기, 내 도전장).
// 폭 900px 이상이면 세 칸을 나란히, 그 아래에서는 랜덤 → 방 → 도전장 차례로 쌓는다.
// 서버가 답하기 전에는 단추를 잠가 둔다(서버가 꺼졌거나 하루 한도를 넘었을 때 만들다가 막히지 않게).
// 순위 자리(순위표 링크, 이 게임 순위, 순위 안내 글)는 서버가 답한 뒤에 보인다(순위가 없는 옛 서버면 다시 거둔다).

import { h, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { setting, setSetting } from "../ui/store.js";
import { bigTitle } from "./common.js";
import { noticeSlot } from "./notice.js";
import { peopleRing } from "./people-ring.js";
import { profileChip } from "./profile.js";
import { parchmentArt } from "./parchment.js";
import { rankBox, rankGameOf } from "./rank-view.js";
import { mineRows } from "./mine-view.js";
import { myChallenges } from "./mine.js";
import { randomGames, randomGame } from "./games.js";
import { playerId, meFields, meWho } from "./identity.js";
import { hello } from "./net.js";
import { noticeFor } from "./messages.js";
import { createRoom } from "./api.js";
import { checkCode, normalizeCode, CODE_LEN } from "./ids.js";
import { cleanRules } from "./rules.js";

const MINE_SHOWN = 3;

export function onlineHomeView(main, params = {}) {
  setTitle(t("온라인 대전"));
  const ctl = new AbortController();
  const notices = noticeSlot();
  const gated = []; // 서버가 답해야 쓰는 단추
  const ranked = []; // 순위가 있을 때만 보이는 것
  const rings = [];
  let game = [setting("online.matchGame", null), "classic"].find((id) => id && randomGame(id));

  // ── 맨 위 줄 ─────────────────
  const chip = profileChip({ onChange: rename });
  const allRanks = h(
    "a",
    { class: "o-link", href: `#/rank/${encodeURIComponent(rankGameOf())}`, hidden: true },
    h("span", { class: "o-wide-only" }, t("전체 순위표"), h("span", { "aria-hidden": "true" }, " →")),
    h("span", { class: "o-narrow-only" }, t("@page:순위표")),
  );
  ranked.push(allRanks);
  const head = h("div", { class: "o-head" }, chip.el, h("span", { class: "o-grow" }), allRanks);
  const titleRow = h("div", { class: "o-titlerow" }, bigTitle(t("온라인 대전")), h("p", { class: "o-p o-wide-only" }, t("아무나와, 친구와, 링크로 붙는다.")));

  // ── 랜덤 매칭 ─────────────────
  const randomRing = deco([
    { key: "q1", empty: true, emptyText: "?" },
    { key: "q2", empty: true, emptyText: "?" },
    { key: "q3", empty: true, emptyText: "?" },
  ]);
  const randomText = h("p", { class: "o-p" }, t("게임을 고르면 아무나와 붙는다."));
  const select = h(
    "select",
    { "aria-label": t("게임") },
    randomGames().map((e) => h("option", { value: e.id }, e.name)),
  );
  select.value = game;
  // '시작'은 판 수와 게임을 고르는 랜덤 매칭 화면을 연다(고른 게임이 골라진 채, 11-08 사용자 요청)
  const find = h("a", { class: "btn btn-ink" }, t("시작"));
  gated.push(find);
  const board = rankBox({ onMissing: () => showRanks(false) });
  const setGame = (id) => {
    game = id;
    find.href = `#/match?v=${encodeURIComponent(id)}`;
  };
  setGame(game);
  select.addEventListener("change", () => {
    if (!randomGame(select.value)) return;
    setGame(select.value);
    setSetting("online.matchGame", game);
    if (!board.el.hidden) board.load(game);
  });
  const randomCol = col(
    randomRing.el,
    h("h2", { class: "o-col-title" }, t("랜덤 매칭")),
    randomText,
    h("div", { class: "o-row o-pick" }, h("span", { class: "select o-select o-grow" }, select), find),
    board.el,
  );

  // ── 방 ─────────────────
  const roomRing = deco([
    { key: "a", who: { art: "bear" } },
    { key: "b", who: { art: "cat" } },
    { key: "c", who: { kind: "bot" } },
  ]);
  const make = h("button", { type: "button", class: "btn btn-ink" }, t("방 만들기"));
  gated.push(make);
  make.addEventListener("click", async () => {
    make.disabled = true;
    try {
      const code = await createRoom({ rules: cleanRules(setting("online.rules", {})), ...meFields(), pid: playerId() });
      location.hash = `#/room/${code}`;
    } catch (e) {
      const n = noticeFor(e.code);
      notices.set(n.kind, n);
      make.disabled = false;
    }
  });
  const codeInput = h("input", {
    type: "text",
    class: "text-input code-input o-grow",
    size: 1,
    maxlength: CODE_LEN.room + 2,
    autocomplete: "off",
    autocapitalize: "characters",
    spellcheck: "false",
    enterkeyhint: "go",
    placeholder: t("코드 {n}자리", { n: CODE_LEN.room }),
    "aria-label": t("방 코드"),
  });
  const join = h("button", { type: "submit", class: "btn" }, t("들어가기"));
  gated.push(join);
  const form = h("form", { class: "code-form" }, codeInput, join);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = checkCode(codeInput.value, "room");
    if (code) location.hash = `#/room/${code}`;
    else {
      codeInput.setAttribute("aria-invalid", "true");
      notices.set("note", { title: t("방 코드는 {n}글자다. 받은 코드를 다시 확인해 주세요.", { n: CODE_LEN.room }) });
    }
  });
  codeInput.addEventListener("input", () => {
    codeInput.removeAttribute("aria-invalid");
    const v = normalizeCode(codeInput.value);
    if (v !== codeInput.value) codeInput.value = v;
  });
  const roomNote = h("p", { class: "o-p o-small o-col-foot", hidden: true }, t("방과 도전장 경기는 순위에 들지 않는다."));
  ranked.push(roomNote);
  const roomCol = col(
    roomRing.el,
    h("h2", { class: "o-col-title" }, t("방")),
    h("p", { class: "o-p" }, t("코드로 친구와 모인다. 빈자리는 컴퓨터가 채운다.")),
    make,
    form,
    roomNote,
  );

  // ── 도전장 ─────────────────
  const write = h("a", { class: "btn btn-ink", href: "#/c/new" }, t("도전장 쓰기"));
  gated.push(write);
  const all = myChallenges();
  const rows = mineRows(all.slice(0, MINE_SHOWN));
  const challengeCol = col(
    h("div", { class: "o-col-art" }, parchmentArt()),
    h("h2", { class: "o-col-title" }, t("도전장")),
    h("p", { class: "o-p" }, t("손을 숨기고 밀랍으로 봉인해 링크로 보낸다.")),
    write,
    rows
      ? h(
          "div",
          { class: "mine" },
          h("div", { class: "rkbox-head" }, h("h3", { class: "rkbox-title" }, t("@list:내 도전장")), h("a", { class: "o-link o-small", href: "#/c/mine" }, t("모두 보기"))),
          rows,
        )
      : null,
  );

  // 서버가 답할 때까지 잠근다
  function setReady(ok) {
    for (const el of gated) {
      if (el.tagName === "A") {
        el.toggleAttribute("aria-disabled", !ok);
        if (ok) el.removeAttribute("tabindex");
        else el.setAttribute("tabindex", "-1");
      } else el.disabled = !ok;
    }
  }
  function showRanks(on) {
    for (const el of ranked) el.hidden = !on;
    randomText.textContent = on ? t("게임을 고르면 아무나와 붙는다. 사람끼리 끝난 경기는 순위에 든다.") : t("게임을 고르면 아무나와 붙는다.");
    if (on) board.load(game);
    else board.el.hidden = true;
    chip.setRanked(on);
  }
  async function check() {
    notices.set("wait", { title: t("서버에 잇는 중…"), text: t("잠깐이면 된다."), spin: true });
    notices.clear("limit", "drop", "update");
    try {
      await hello({ signal: ctl.signal });
      notices.clear("wait");
      setReady(true);
      showRanks(true);
    } catch (e) {
      if (ctl.signal.aborted) return;
      notices.clear("wait");
      setReady(false);
      const n = noticeFor(e.code);
      const action = n.kind === "update" ? { label: t("새로고침"), run: () => location.reload() } : { label: t("다시"), run: check };
      notices.set(n.kind, { ...n, action });
    }
  }

  /** 꾸밈 고리: 나(맨 아래, --focus 테두리) + 셋 */
  function deco(others) {
    const ring = peopleRing({ height: 124, size: 34, radius: 42, minWidth: 124, label: "" });
    const people = [{ key: "me", who: meWho(), me: true }, ...others];
    ring.set({ people });
    ring.el.setAttribute("aria-hidden", "true");
    ring.el.classList.add("pring-deco");
    rings.push({ ring, people });
    return ring;
  }

  function rename() {
    for (const { ring, people } of rings) {
      people[0] = { ...people[0], who: meWho() };
      ring.set({ people });
    }
    board.rename();
  }

  setReady(false);
  main.append(
    h(
      "div",
      { class: "online online-home" },
      notices.el,
      head,
      titleRow,
      h("div", { class: "o-cols" }, randomCol, roomCol, challengeCol),
    ),
  );
  check();
  // 다른 화면의 '이름 바꾸기'(#/play?name=1)에서 왔으면 바로 연다
  if (params.name) requestAnimationFrame(() => chip.open());
  return {
    destroy() {
      ctl.abort();
      for (const { ring } of rings) ring.destroy();
      board.destroy();
      chip.destroy();
      notices.destroy();
    },
  };
}

/** 세 칸의 한 칸(카드) */
function col(...children) {
  return h("section", { class: "o-col" }, ...children);
}
