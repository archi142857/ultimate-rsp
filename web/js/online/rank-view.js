// 순위표(#/rank/게임, 디자인 시안2 ①)와 첫 화면 랜덤 칸의 '(게임) 순위'.
// 넓은 화면: 왼쪽 250px 에 게임 찾기와 게임 목록, 오른쪽 표(순위 · 이름 · 점수 · 경기 · 승률, 50위까지, 내 줄은 맨 아래에 붙인다).
// 좁은 화면: 게임 고르기(select), '내 순위' 카드, 그 아래 목록. 한 벌의 줄을 CSS 가 두 꼴로 놓는다.
// 1–3위 순위 숫자는 금·은·동. 내가 50위 안이면 그 줄을 칠하고 아래 내 줄은 뺀다. 5경기 전이면 순위 대신 'N경기 더 하면 오른다'.
// 점수·경기 수가 같으면 같은 순위(서버 규약 4.1).

import { h, clear, append, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { setting, setSetting } from "../ui/store.js";
import { compileVariant } from "../core/engine.js";
import { BOARD_MIN_GAMES, RATING_START } from "../core/rating.js";
import { bigTitle, miniHands } from "./common.js";
import { noticeSlot } from "./notice.js";
import { avatar, fillFace } from "./avatar.js";
import { profileChip } from "./profile.js";
import { randomGames, randomGame } from "./games.js";
import { myName, playerId, meWho } from "./identity.js";
import { noticeFor } from "./messages.js";
import { fetchRank, knownRank, winRate, gamesLeft, myIndex, RANK_TOP } from "./rank.js";

const compiled = new Map();
const variant = (entry) => {
  if (!compiled.has(entry.id)) compiled.set(entry.id, compileVariant(entry));
  return compiled.get(entry.id);
};

/** 순위표에서 볼 게임: 주소 → 마지막에 본 순위표 → 가위바위보 */
export function rankGameOf(id = null) {
  return [id, setting("online.rankGame", null), "classic"].find((x) => x && randomGame(x));
}

// 순위표에 오르기 전: '순위표까지 4경기'(그냥 '오른다'면 점수가 오르는지 헷갈린다, 11-08 사용자)
const leftText = (rec) => t("순위표까지 {n}경기", { n: gamesLeft(rec) });
const statText = (rec) => [t("{n}경기", { n: rec.games }), t("승률 {n}%", { n: winRate(rec) })].join(" · ");
const arrow = () => h("span", { "aria-hidden": "true" }, " →");

// ── 순위표 화면 ─────────────────
export function rankView(main, gameId = null) {
  let game = rankGameOf(gameId);
  setTitle(t("@page:순위표"));
  if (gameId !== game) history.replaceState(null, "", `#/rank/${encodeURIComponent(game)}`);
  const ctl = new AbortController();
  const notices = noticeSlot();
  let board = null;
  let loading = 0;

  const chip = profileChip({ align: "end", ranked: true, onChange: () => draw() });
  const head = h(
    "div",
    { class: "o-head" },
    h("a", { class: "o-back", href: "#/play" }, h("span", { class: "o-arrow", "aria-hidden": "true" }, "←"), " ", t("온라인")),
    h("span", { class: "o-grow" }),
    chip.el,
  );
  const titleRow = h(
    "div",
    { class: "o-titlerow" },
    bigTitle(t("@page:순위표")),
    h(
      "p",
      { class: "o-p o-wide-only" },
      t("랜덤 매칭에서 사람끼리 끝난 경기만 센다. {n}경기부터 오르고, 점수는 {start}에서 시작한다(Elo).", { n: BOARD_MIN_GAMES, start: RATING_START }),
      " ",
      // 같은 곳(서버 2a825ec)·처음 온 사람(컨셉 50d48eb NEWCOMER_WEIGHT)
      t("같은 곳에서 온 사람끼리 한 경기는 세지 않고, 처음 온 사람과 한 경기는 점수가 반만 움직인다."),
    ),
  );

  // 게임 고르기: 넓으면 찾기 칸 + 목록, 좁으면 select
  const games = randomGames();
  const search = h("input", { type: "search", class: "text-input lb-search", size: 1, placeholder: t("게임 찾기"), "aria-label": t("게임 찾기"), autocomplete: "off" });
  const items = games.map((e) => {
    const n = h("small", { class: "lb-game-n" });
    const btn = h(
      "button",
      { type: "button", class: "lb-game", "data-id": e.id },
      miniHands(variant(e), 3),
      h("span", { class: "lb-game-body" }, h("span", { class: "lb-game-name" }, e.name), n),
    );
    btn.addEventListener("click", () => pick(e.id));
    return { e, btn, n };
  });
  const list = h("div", { class: "lb-games", role: "group", "aria-label": t("게임") }, items.map((x) => x.btn));
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    for (const { e, btn } of items) btn.hidden = !!q && !`${e.name} ${e.id}`.toLowerCase().includes(q);
  });
  const select = h("select", { "aria-label": t("게임") }, games.map((e) => h("option", { value: e.id }, e.name)));
  select.addEventListener("change", () => pick(select.value));

  const mine = h("div", { class: "lb-mine", "aria-live": "polite" });
  const box = h("div", { class: "lb-box", role: "table", "aria-label": t("@page:순위표") });
  const root = h(
    "div",
    { class: "online online-rank" },
    notices.el,
    head,
    titleRow,
    h(
      "div",
      { class: "lb" },
      h("div", { class: "lb-side" }, search, list),
      h("div", { class: "lb-body" }, h("span", { class: "select o-select lb-pick" }, select), mine, box),
    ),
  );

  function showPicked() {
    select.value = game;
    for (const { e, btn } of items) {
      btn.classList.toggle("on", e.id === game);
      btn.setAttribute("aria-pressed", String(e.id === game));
    }
  }

  function pick(id) {
    if (!randomGame(id) || id === game) return;
    game = id;
    setSetting("online.rankGame", id);
    history.replaceState(null, "", `#/rank/${encodeURIComponent(id)}`);
    showPicked();
    load();
  }

  async function load(fresh = false) {
    const my = ++loading;
    notices.clear("limit", "drop", "note");
    notices.set("wait", { title: t("순위를 불러오는 중…"), spin: true });
    box.setAttribute("aria-busy", "true");
    try {
      const b = await fetchRank(game, { pid: playerId(), signal: ctl.signal, fresh });
      if (my !== loading) return;
      board = b;
      notices.clear("wait");
      draw();
    } catch (e) {
      if (ctl.signal.aborted || my !== loading) return;
      notices.clear("wait");
      const n = noticeFor(e.code);
      notices.set(n.kind, { ...n, action: n.kind === "update" ? { label: t("새로고침"), run: () => location.reload() } : { label: t("다시"), run: () => load(true) } });
    } finally {
      if (my === loading) box.removeAttribute("aria-busy");
    }
  }

  function draw() {
    if (!board) return;
    // 'N명' 은 받아 본 게임만(서버는 고른 게임의 수만 준다)
    for (const { e, n } of items) {
      const b = e.id === game ? board : knownRank(e.id);
      n.textContent = b && Number.isInteger(b.n) ? t("@players:{n}명", { n: b.n }) : "";
    }
    const me = board.me;
    const at = myIndex(board);
    // 좁은 화면의 내 순위 카드
    clear(mine);
    mine.append(
      avatar(meWho(), { size: 36 }),
      h(
        "div",
        { class: "o-grow" },
        h("p", { class: "o-strong" }, me && me.rank ? t("내 순위 {n}위", { n: me.rank }) : leftText(me)),
        me ? h("p", { class: "o-p o-small" }, [t("{n}점", { n: me.rating }), statText(me)].join(" · ")) : null,
      ),
    );
    // 표
    const rows = board.top.map((rec, k) => boardRow(rec, { me: k === at }));
    const empty = !board.top.length
      ? h("div", { class: "lb-empty", role: "row" }, h("span", { role: "cell" }, t("아직 순위표가 비었다.")))
      : null;
    const dots =
      board.top.length >= RANK_TOP
        ? h("div", { class: "lb-dots", role: "row" }, h("span", { role: "cell" }, h("span", { "aria-hidden": "true" }, "⋮ "), t("{n}위까지", { n: RANK_TOP })))
        : null;
    const pinned = at < 0 ? myRow(me) : null;
    append(clear(box), [headRow(), rows, empty, dots, pinned]);
  }

  main.append(root);
  showPicked();
  setSetting("online.rankGame", game);
  load();

  return {
    destroy() {
      ctl.abort();
      chip.destroy();
      notices.destroy();
    },
  };
}

function headRow() {
  const th = (text, cls) => h("span", { class: cls, role: "columnheader" }, text);
  return h(
    "div",
    { class: "lb-row lb-th", role: "row" },
    th(t("순위"), "lb-n"),
    th(t("이름"), "lb-name"),
    th(t("점수"), "lb-score"),
    th(t("경기"), "lb-games-n"),
    th(t("승률"), "lb-rate"),
  );
}

/** 표 한 줄. 좁은 화면에서는 경기·승률 칸을 이름 아래 작은 글로 옮긴다. 내 줄 그림은 지금 내 그림 */
function boardRow(rec, { me = false } = {}) {
  const n = rec.rank;
  return h(
    "div",
    { class: "lb-row" + (n <= 3 ? ` top${n}` : "") + (me ? " me" : ""), role: "row", "aria-current": me ? "true" : undefined },
    h("b", { class: "lb-n", role: "cell" }, String(n)),
    h(
      "span",
      { class: "lb-name", role: "cell" },
      avatar(me ? meWho() : { kind: "human", name: rec.name, face: rec.face }, { size: 26 }),
      h("span", { class: "lb-name-body" }, h("span", { class: "lb-nm" }, rec.name), h("small", { class: "lb-sub" }, statText(rec))),
    ),
    h("span", { class: "lb-score", role: "cell" }, String(rec.rating)),
    h("span", { class: "lb-games-n", role: "cell" }, String(rec.games)),
    h("span", { class: "lb-rate", role: "cell" }, `${winRate(rec)}%`),
  );
}

/** 표 맨 아래 내 줄(넓은 화면). 5경기 전이면 순위 칸은 비우고 이름 옆에 남은 경기 수 */
function myRow(me) {
  const name = myName();
  return h(
    "div",
    { class: "lb-row me pinned", role: "row" },
    h("b", { class: "lb-n", role: "cell" }, me && me.rank ? String(me.rank) : "–"),
    h(
      "span",
      { class: "lb-name", role: "cell" },
      avatar(meWho(), { size: 26 }),
      h(
        "span",
        { class: "lb-name-body" },
        h("span", { class: "lb-nm" }, h("b", {}, t("나")), ` · ${name}`),
        me && me.rank ? null : h("small", { class: "lb-left" }, leftText(me)),
      ),
    ),
    h("span", { class: "lb-score", role: "cell" }, me ? String(me.rating) : "–"),
    h("span", { class: "lb-games-n", role: "cell" }, me ? String(me.games) : "0"),
    h("span", { class: "lb-rate", role: "cell" }, me && me.games ? `${winRate(me)}%` : "–"),
  );
}

// ── 첫 화면 랜덤 칸의 '(게임) 순위' ─────────────────
/** 1–3위와 내 줄. 서버가 순위를 줄 때만 보인다(처음엔 숨김). load(게임) 로 바꾼다 */
export function rankBox({ onMissing = null } = {}) {
  const ctl = new AbortController();
  const link = h("a", { class: "o-link o-small" }, t("@page:순위표"), arrow());
  const title = h("h3", { class: "rkbox-title" });
  const list = h("ul", { class: "rk-list" });
  const msg = h("p", { class: "o-p o-small", hidden: true });
  const el = h(
    "div",
    { class: "rkbox", hidden: true },
    h("div", { class: "rkbox-head" }, title, link),
    list,
    msg,
  );
  let game = null;
  let loading = 0;

  function line(n, who, right, { me = false, label = null } = {}) {
    return h(
      "li",
      { class: "rk" + (me ? " me" : "") },
      h("b", { class: "rk-n" }, n),
      avatar(who, { size: 22 }),
      h("span", { class: "rk-name" + (label ? " rk-name-me" : "") }, label || who.name),
      right,
    );
  }

  function draw(board) {
    const at = myIndex(board);
    // 내 줄은 지금 내 그림(서버에 남은 그림보다 방금 고른 것)
    const whoOf = (rec, k) => (k === at ? meWho() : { kind: "human", name: rec.name, face: rec.face });
    const top = board.top.slice(0, 3).map((rec, k) => line(String(rec.rank), whoOf(rec, k), h("span", { class: "rk-v" }, String(rec.rating)), { me: k === at }));
    const me = board.me;
    const mine =
      at >= 0 && at < 3
        ? null
        : me && me.rank
          ? line(String(me.rank), meWho(), h("span", { class: "rk-v" }, String(me.rating)), { me: true, label: t("나") })
          : line("–", meWho(), h("span", { class: "rk-left" }, leftText(me)), { me: true, label: t("나") });
    append(clear(list), [top, mine]);
    msg.hidden = board.top.length > 0;
    msg.textContent = board.top.length ? "" : t("아직 순위표가 비었다.");
  }

  async function load(id) {
    game = id;
    const e = randomGame(id);
    title.textContent = t("{g} 순위", { g: e ? e.name : id });
    link.href = `#/rank/${encodeURIComponent(id)}`;
    el.hidden = false;
    const my = ++loading;
    el.setAttribute("aria-busy", "true");
    try {
      const board = await fetchRank(id, { pid: playerId(), signal: ctl.signal });
      if (my !== loading) return;
      draw(board);
    } catch (e) {
      if (ctl.signal.aborted || my !== loading) return;
      // 순위가 없는 (옛) 서버면 순위 자리를 거둔다
      if (e.code === "not_found" && onMissing) return onMissing();
      clear(list);
      msg.hidden = false;
      msg.replaceChildren(t("순위를 불러오지 못했다."), " ", h("button", { type: "button", class: "o-linkbtn", onclick: () => load(game) }, t("다시")));
    } finally {
      if (my === loading) el.removeAttribute("aria-busy");
    }
  }

  return {
    el,
    load,
    /** 내 이름이 바뀌면 내 줄 그림을 다시 */
    rename() {
      for (const li of list.querySelectorAll(".rk.me")) {
        const av = li.querySelector(".av");
        if (av) fillFace(av, meWho());
      }
    },
    destroy() {
      ctl.abort();
    },
  };
}
