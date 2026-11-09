// 온라인 첫 화면(#/play, 디자인 시안2 ① 깔끔한 세 칸). 맨 위 줄: 왼쪽 프로필 칩(누르면 이름 바꾸기), 오른쪽 '전체 순위표 →'.
// 그 아래 제목과 세 칸: 랜덤 매칭(시작, 마지막에 고른 게임의 순위) · 방(미리 채운 코드로 만들기·친구 코드로 들어가기, 남의 방이면 한 번 묻기) · 도전장(쓰기, 내 도전장).
// 랜덤 칸에는 게임 고르는 칸을 두지 않는다. '시작'이 여는 매칭 화면에서 게임과 판 수를 고른다(11-08 사용자).
// 폭 900px 이상이면 세 칸을 나란히(세 칸의 단추가 같은 높이에), 그 아래에서는 랜덤 → 방 → 도전장 차례로 쌓는다.
// 서버가 답하기 전에는 단추를 잠가 둔다(서버가 꺼졌거나 하루 한도를 넘었을 때 만들다가 막히지 않게).
// 순위 자리(순위표 링크, 게임 순위, 순위 안내 글)는 서버가 답한 뒤에 보인다(순위가 없는 옛 서버면 다시 거둔다).

import { h, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { setting } from "../ui/store.js";
import { bigTitle } from "./common.js";
import { noticeSlot } from "./notice.js";
import { peopleRing } from "./people-ring.js";
import { avatar } from "./avatar.js";
import { profileChip } from "./profile.js";
import { parchmentArt } from "./parchment.js";
import { rankBox, rankGameOf } from "./rank-view.js";
import { mineRows } from "./mine-view.js";
import { myChallenges } from "./mine.js";
import { randomGame } from "./games.js";
import { playerId, meFields, meWho } from "./identity.js";
import { hello, OnlineError } from "./net.js";
import { syncAccount } from "./account.js";
import { noticeFor } from "./messages.js";
import { createRoom } from "./api.js";
import { checkCode, normalizeCode, randomCode, hasBadCodeChar, CODE_LEN } from "./ids.js";
import { cleanRules } from "./rules.js";

const MINE_SHOWN = 3;
const MARK = "\u0001";

/** 글 틀에 넣은 MARK 자리에 이름을 <bdi> 로 넣는다(오른쪽에서 쓰는 글자가 섞인 이름도 앞뒤 글 차례가 흔들리지 않게) */
function withName(text, name) {
  const [pre, post = ""] = text.split(MARK);
  return [pre, h("bdi", { class: "who-name" }, name), post];
}

export function onlineHomeView(main, params = {}) {
  setTitle(t("온라인 대전"));
  const ctl = new AbortController();
  const notices = noticeSlot();
  const gated = []; // 서버가 답해야 쓰는 단추
  const ranked = []; // 순위가 있을 때만 보이는 것
  const rings = [];
  // 순위 칸에 보일 게임: 매칭 화면에서 마지막에 고른 게임
  const game = [setting("online.matchGame", null), "classic"].find((id) => id && randomGame(id));

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
  // '시작'은 게임과 판 수를 고르는 랜덤 매칭 화면을 연다(마지막에 고른 게임이 골라진 채)
  const find = h("a", { class: "btn btn-ink", href: "#/match" }, t("시작"));
  gated.push(find);
  const board = rankBox({ onMissing: () => showRanks(false) });
  const randomCol = col(randomRing.el, h("h2", { class: "o-col-title" }, t("랜덤 매칭")), randomText, find, board.el);

  // ── 방 ─────────────────
  const roomRing = deco([
    { key: "a", who: { art: "bear" } },
    { key: "b", who: { art: "cat" } },
    { key: "c", who: { kind: "bot" } },
  ]);
  // 코드 칸에는 무작위 코드를 미리 채워 둔다(11-08 사용자). 그대로 누르면 그 코드로 방을 만들고(코드를 친구에게 알려 주면 된다),
  // 친구 코드를 넣으면 그 방으로 들어간다. 이미 있는 코드면 서버가 만들지 않고 taken 으로 알려 준다(규약 3.1).
  // 미리 채운 코드가 마침 남의 방이면 새 코드로 다시 한다. 단추 글은 코드를 고쳤는지에 따라 '방 만들기'·'들어가기'
  let fresh = randomCode("room");
  const codeInput = h("input", {
    type: "text",
    class: "text-input code-input room-code",
    size: 1,
    maxlength: CODE_LEN.room + 2,
    autocomplete: "off",
    autocapitalize: "characters",
    spellcheck: "false",
    enterkeyhint: "go",
    value: fresh,
    placeholder: t("코드 {n}자리", { n: CODE_LEN.room }),
    "aria-label": t("방 코드"),
    "aria-describedby": "room-code-hint",
  });
  // 단추 글 둘을 한 칸에 겹쳐 두고 하나만 보인다: 글을 바꿔도 단추 폭(옆 코드 칸 폭)이 흔들리지 않게
  const goMake = h("span", {}, t("방 만들기"));
  const goJoin = h("span", { class: "is-off" }, t("들어가기"));
  const go = h("button", { type: "submit", class: "btn btn-ink btn-swap" }, goMake, goJoin);
  gated.push(go);
  const typed = () => {
    const v = normalizeCode(codeInput.value, "room");
    return v !== "" && v !== fresh;
  };
  const relabel = () => {
    const join = typed();
    goMake.classList.toggle("is-off", join);
    goJoin.classList.toggle("is-off", !join);
  };
  const form = h("form", { class: "room-form" }, codeInput, go);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (go.disabled) return;
    const friend = typed();
    let code = friend ? checkCode(codeInput.value, "room") : fresh;
    if (!code) {
      codeInput.setAttribute("aria-invalid", "true");
      // 길이는 맞는데 안 쓰는 글자(0·1·I·L·O)가 있으면 그것부터 알려 준다(검수 11-09)
      notices.set("note", {
        title: hasBadCodeChar(codeInput.value)
          ? t("방 코드에는 0·1·I·L·O가 없다. 받은 코드를 다시 확인하자.")
          : t("방 코드는 {n}글자다. 받은 코드를 다시 확인하자.", { n: CODE_LEN.room }),
      });
      return;
    }
    go.disabled = true;
    try {
      for (let k = 0; k < 3; k++) {
        const r = await createRoom({ rules: cleanRules(setting("online.rules", {})), ...meFields(), pid: playerId(), code });
        if (r.taken && friend && r.host && !(await askJoin(r.host))) {
          go.disabled = false;
          codeInput.focus();
          return;
        }
        if (!r.taken || friend) {
          location.hash = `#/room/${r.code}`;
          return;
        }
        fresh = code = randomCode("room");
        codeInput.value = fresh;
      }
      throw new OnlineError("busy");
    } catch (err) {
      const n = noticeFor(err.code);
      notices.set(n.kind, n);
      go.disabled = false;
    }
  });
  // 한글 입력 상태로 쳐도(ㅠㅁㅠㄷ) 영문 자판 글자로 바꾼다. 글자를 조합하는 동안은 건드리지 않는다(조합이 깨진다)
  const tidy = () => {
    codeInput.removeAttribute("aria-invalid");
    const v = normalizeCode(codeInput.value, "room");
    if (v !== codeInput.value) codeInput.value = v;
    relabel();
  };
  codeInput.addEventListener("input", (e) => {
    if (!e.isComposing) tidy();
  });
  codeInput.addEventListener("compositionend", tidy);
  // 방 링크나 채팅 글을 통째로 붙여 넣으면 코드만(칸 길이에 잘리기 전에. 검수 11-09)
  codeInput.addEventListener("paste", (e) => {
    const text = e.clipboardData ? e.clipboardData.getData("text") : "";
    if (!text) return;
    e.preventDefault();
    codeInput.value = normalizeCode(text, "room").slice(0, CODE_LEN.room + 2);
    tidy();
  });
  // 친 코드가 남의 방이면 들어가기 전에 한 번 묻는다(사용자 11-09 '○○의 방 / 입장하시겠습니까?' 그대로).
  // 방장이 없으면(빈 방, 옛 서버) 묻지 않고 들어간다. 미리 채운 코드가 남의 방이면 묻지 않고 새 코드로 다시 한다
  const sheet = h("div", { class: "o-sheet-wrap", hidden: true });
  function askJoin(host) {
    return new Promise((resolve) => {
      const keys = new AbortController();
      const close = (ok) => {
        keys.abort();
        sheet.hidden = true;
        sheet.replaceChildren();
        resolve(ok);
      };
      const yes = h("button", { type: "button", class: "btn btn-ink btn-big", onclick: () => close(true) }, t("입장"));
      const no = h("button", { type: "button", class: "btn btn-big", onclick: () => close(false) }, t("취소"));
      sheet.replaceChildren(
        h("div", { class: "o-scrim", onclick: () => close(false) }),
        h(
          "div",
          { class: "o-sheet join-sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "join-title", "aria-describedby": "join-text" },
          h("div", { class: "join-host" }, avatar(host, { size: 48 }), h("h2", { class: "o-h2", id: "join-title" }, ...withName(t("{name}의 방", { name: MARK }), host.name))),
          h("p", { class: "o-p", id: "join-text" }, t("입장하시겠습니까?")),
          yes,
          no,
        ),
      );
      sheet.hidden = false;
      // Esc 는 취소, Tab 은 두 단추 사이만 돈다. 화면을 떠나면(ctl) 같이 거둔다
      const signal = AbortSignal.any ? AbortSignal.any([keys.signal, ctl.signal]) : keys.signal;
      document.addEventListener(
        "keydown",
        (e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            close(false);
          } else if (e.key === "Tab") {
            e.preventDefault();
            (document.activeElement === yes ? no : yes).focus();
          }
        },
        { signal },
      );
      yes.focus();
    });
  }
  const roomNote = h("p", { class: "o-p o-small o-col-foot", hidden: true }, t("방과 도전장 경기는 순위에 들지 않는다."));
  ranked.push(roomNote);
  const roomCol = col(
    roomRing.el,
    h("h2", { class: "o-col-title" }, t("방")),
    h("p", { class: "o-p" }, t("코드로 친구와 모인다. 빈자리는 컴퓨터가 채운다.")),
    form,
    h("p", { class: "o-p o-small", id: "room-code-hint" }, t("그대로 누르면 이 코드로 방이 생긴다. 친구 코드를 넣으면 그 방으로 들어간다.")),
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
    notices.set("wait", { title: t("서버에 연결하는 중…"), text: t("잠깐이면 된다."), spin: true });
    notices.clear("limit", "drop", "update");
    try {
      await hello({ signal: ctl.signal });
      notices.clear("wait");
      setReady(true);
      showRanks(true);
      // 로그인했으면 한 번 계정을 읽어 다른 기기에서 바꾼 이름·그림을 따른다(규약 8.5)
      syncAccount();
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
      sheet,
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
