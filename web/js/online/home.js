// 온라인 첫 화면(#/play, 디자인 시안 ③ 1번): 이름 카드 → 랜덤 매칭(가장 큰 단추) → 방(만들기 / 코드로 들어가기)
// → 도전장(만들기, 내 도전장 목록과 결과 칩). 서버 상태는 맨 위 알림 자리에.
// 서버가 답하기 전에는 단추를 잠가 둔다(서버가 꺼졌거나 하루 한도를 넘었을 때 만들다가 막히지 않게).

import { h, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { setting } from "../ui/store.js";
import { bigTitle, card } from "./common.js";
import { noticeSlot } from "./notice.js";
import { avatar, fillFace } from "./avatar.js";
import { peopleRing } from "./people-ring.js";
import { myChallenges } from "./mine.js";
import { challengeGame } from "./games.js";
import { myName, setMyName, randomName, playerId, NAME_MAX } from "./identity.js";
import { hello } from "./net.js";
import { noticeFor } from "./messages.js";
import { createRoom } from "./api.js";
import { checkCode, normalizeCode, CODE_LEN } from "./ids.js";
import { cleanRules } from "./rules.js";

export function onlineHomeView(main) {
  setTitle(t("온라인 대전"));
  const ctl = new AbortController();
  const notices = noticeSlot();
  const gated = []; // 서버가 답해야 쓰는 단추

  // ── 이름 카드 ─────────────────
  const face = avatar({ kind: "human", name: myName() }, { size: 44 });
  const input = h("input", {
    type: "text",
    id: "online-name",
    class: "name-input",
    // 기본 폭(size 20)은 한글 글꼴에서 350px 가까이 돼 좁은 화면을 넘친다. 폭은 CSS 가 정한다
    size: 1,
    // 이모지가 두 칸으로 세어져도 잘리지 않게 넉넉히. 실제로는 cleanName 이 20글자로 자른다
    maxlength: NAME_MAX * 2,
    autocomplete: "off",
    spellcheck: "false",
    enterkeyhint: "done",
    "aria-label": t("내 이름"),
    "aria-describedby": "online-name-note",
  });
  input.value = myName();
  const rename = (name) => {
    input.value = setMyName(name);
    fillFace(face, { kind: "human", name: input.value });
  };
  input.addEventListener("change", () => rename(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });
  const again = h("button", { type: "button", class: "btn btn-sm", onclick: () => rename(randomName()) }, t("새 이름"));
  const nameCard = card(
    h(
      "div",
      { class: "o-row" },
      face,
      h("div", { class: "o-grow" }, input, h("p", { class: "o-p o-small", id: "online-name-note" }, t("가입은 없다. 상대가 이 이름을 본다."))),
      again,
    ),
  );

  // ── 랜덤 매칭 ─────────────────
  const deco = peopleRing({ height: 118, size: 40, radius: 40, label: t("랜덤 매칭") });
  const randomGo = h("a", { class: "btn btn-ink btn-big", href: "#/match" }, t("랜덤 매칭"));
  gated.push(randomGo);
  const randomCard = h(
    "section",
    { class: "o-card o-card-center" },
    deco.el,
    randomGo,
    h("p", { class: "o-p" }, t("게임을 고르면 아무나와 붙여 준다.")),
  );
  deco.set({
    people: [
      { key: "me", who: { kind: "human", name: myName() }, me: true, label: "" },
      { key: "q1", empty: true, emptyText: "?", label: "" },
      { key: "q2", empty: true, emptyText: "?", label: "" },
      { key: "q3", empty: true, emptyText: "?", label: "" },
    ],
  });
  deco.el.setAttribute("aria-hidden", "true");

  // ── 방 ─────────────────
  const make = h("button", { type: "button", class: "btn btn-ink" }, t("방 만들기"));
  gated.push(make);
  make.addEventListener("click", async () => {
    make.disabled = true;
    try {
      const code = await createRoom({ rules: cleanRules(setting("online.rules", {})), name: myName(), pid: playerId() });
      location.hash = `#/room/${code}`;
    } catch (e) {
      const n = noticeFor(e.code);
      notices.set(n.kind, n);
      make.disabled = false;
    }
  });
  const codeInput = h("input", {
    type: "text",
    class: "text-input code-input",
    size: 1,
    maxlength: CODE_LEN.room + 2,
    autocomplete: "off",
    autocapitalize: "characters",
    spellcheck: "false",
    enterkeyhint: "go",
    placeholder: "K7Q2",
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
  const roomCard = card(
    h("h2", { class: "o-h3" }, t("방")),
    h("p", { class: "o-p" }, t("친구와 코드로 모인다. 빈자리는 컴퓨터가 채운다.")),
    h("div", { class: "o-row room-actions" }, make, form),
  );

  // ── 도전장 ─────────────────
  const newChallenge = h("a", { class: "btn btn-ink", href: "#/c/new" }, t("만들기"));
  gated.push(newChallenge);
  const challengeCard = card(
    h(
      "div",
      { class: "o-row" },
      h("div", { class: "o-grow" }, h("h2", { class: "o-h3" }, t("도전장")), h("p", { class: "o-p" }, t("손을 숨겨 링크로 보낸다."))),
      newChallenge,
    ),
    mineList(),
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
  async function check() {
    notices.set("wait", { title: t("서버에 잇는 중…"), text: t("잠깐이면 된다."), spin: true });
    notices.clear("limit", "drop", "update");
    try {
      await hello({ signal: ctl.signal });
      notices.clear("wait");
      setReady(true);
    } catch (e) {
      if (ctl.signal.aborted) return;
      notices.clear("wait");
      setReady(false);
      const n = noticeFor(e.code);
      const action = n.kind === "update" ? { label: t("새로고침"), run: () => location.reload() } : { label: t("다시"), run: check };
      notices.set(n.kind, { ...n, action });
    }
  }

  setReady(false);
  main.append(h("div", { class: "online online-home" }, notices.el, bigTitle(t("온라인 대전")), nameCard, randomCard, roomCard, challengeCard));
  check();
  return {
    destroy() {
      ctl.abort();
      deco.destroy();
      notices.destroy();
    },
  };
}

/** 이 브라우저에서 만들거나 답한 도전장(최근 5개)과 결과 칩. 결과는 열어 본 것만 안다 */
function mineList() {
  const list = myChallenges().slice(0, 5);
  if (!list.length) return null;
  return h(
    "div",
    { class: "mine" },
    h("h3", { class: "o-label" }, t("@page:내 도전장")),
    h(
      "ul",
      { class: "mine-list" },
      list.map((r) => {
        const e = challengeGame(r.game);
        const game = r.label || (e ? e.name : r.game);
        const chip =
          r.result === 1
            ? h("span", { class: "chip ok" }, t("@chip:이겼다"))
            : r.result === -1
              ? h("span", { class: "chip no" }, t("@chip:졌다"))
              : r.result === 0
                ? h("span", { class: "chip" }, t("@chip:비겼다"))
                : h("span", { class: "chip" }, r.role === "maker" ? t("기다리는 중") : t("받음"));
        return h(
          "li",
          {},
          h("a", { href: `#/c/${encodeURIComponent(r.id)}` }, h("span", { class: "mine-what" }, `${game} · ${r.vs || r.id}`), chip),
        );
      }),
    ),
  );
}
