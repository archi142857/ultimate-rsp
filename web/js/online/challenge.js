// 도전장(#/c/코드). 서버에서 읽어 와서
//  - 열려 있고 내가 만든 것(이 브라우저에 적어 둔 것): 링크 보내기, 내 손, 결과 확인
//  - 열려 있고 남이 만든 것: 게임과 고리 그림만 보고 손을 골라 답하기(만든 사람의 손은 서버만 안다)
//  - 끝난 것: 두 손과 결과. 내가 낸 쪽이 왼쪽. 승패는 서버가 답할 때 적어 둔 값(cmp·winner)을 쓴다
// 지금은 한 판짜리만 연다(규약은 1·3·5판). 여러 판짜리는 '아직 못 연다'고 알린다.

import { h, clear, append, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { stage, chant, RESULT_WORD } from "../ui/widgets.js";
import { chantWords } from "../views/matrix.js";
import { onlineHead, statusLine, ringPanel, handPicker, myHandLine, linkBox, dateText } from "./common.js";
import { variantOf } from "./games.js";
import { myName, playerId } from "./identity.js";
import { fetchChallenge, answerChallenge } from "./api.js";
import { myChallenge, rememberChallenge } from "./mine.js";
import { errorText } from "./messages.js";
import { shareLink } from "./config.js";

// 만든 사람이 다른 앱에서 링크를 보내고 돌아오면 결과를 한 번 본다. 너무 자주 묻지 않게 간격을 둔다(폴링은 하지 않는다)
const RECHECK_MS = 15000;

export function challengeView(main, code) {
  setTitle(t("도전장"));
  const ctl = new AbortController();
  const root = h("div", { class: "online online-wide" });
  main.append(root);
  let onKey = null;
  let waiting = null; // 내가 만든 열린 도전장을 보고 있으면 { refresh }
  let lastFetch = 0;

  function loading() {
    const st = statusLine();
    st.set("wait", t("도전장을 불러오는 중…"));
    clear(root).append(onlineHead(t("도전장")), st.el);
  }

  async function load(note = null) {
    loading();
    try {
      lastFetch = Date.now();
      show(await fetchChallenge(code, { signal: ctl.signal }), { note });
    } catch (e) {
      if (!ctl.signal.aborted) failed(e.code);
    }
  }

  function failed(why) {
    onKey = null;
    waiting = null;
    setTitle(t("도전장"));
    const msg = why === "unsupported" ? t("이 도전장은 이 화면에서 아직 열 수 없다. 새로고침해 주세요.") : errorText(why);
    clear(root).append(
      onlineHead(t("도전장")),
      h("p", { class: "note" }, msg),
      h(
        "div",
        { class: "form-actions" },
        why === "not_found"
          ? h("a", { class: "btn btn-ink", href: "#/c/new" }, t("도전장 만들기"))
          : h("button", { type: "button", class: "btn btn-ink", onclick: () => load() }, t("다시 해 보기")),
      ),
    );
  }

  function show(c, { note = null, reveal = false } = {}) {
    onKey = null;
    waiting = null;
    const V = variantOf(c.game, c.custom);
    if (!V || c.rounds !== 1) return failed("unsupported");
    const mine = myChallenge(c.code);
    if (!c.open) return result(c, V, mine, { note, reveal });
    if (mine && mine.role === "maker") return waitView(c, V, mine);
    return answerView(c, V);
  }

  // ── 받은 사람: 손 고르기 ─────────────────
  function answerView(c, V) {
    const head = t("{name}의 도전장", { name: c.from });
    setTitle(head);
    const rp = ringPanel(V, { rulesLink: c.game === "custom" ? null : `#/v/${c.game}` });
    const go = h("button", { type: "button", class: "btn btn-ink", disabled: true }, t("이 손으로 겨루기"));
    const picker = handPicker(V, { ring: rp.ring, label: t("낼 손"), onPick: () => (go.disabled = false) });
    const status = statusLine({ hidden: true });
    onKey = (e) => picker.keyHandler(e);
    go.addEventListener("click", async () => {
      if (picker.picked === null || go.disabled) return;
      const hand = V.hands[picker.picked].id;
      go.disabled = true;
      picker.lock(true);
      status.set("wait", t("겨루는 중…"));
      try {
        const done = await answerChallenge(c.code, { hands: [hand], name: myName(), pid: playerId() }, { signal: ctl.signal });
        rememberChallenge({ id: c.code, role: "taker", game: c.game, hand, at: Date.now(), label: labelOf(c, V) });
        show(done, { reveal: true });
      } catch (e) {
        if (ctl.signal.aborted) return;
        // 그사이 다른 사람이 먼저 답했으면 그 결과를 보여 준다
        if (e.code === "closed") return e.result ? show(e.result, { note: t("다른 사람이 먼저 답했다.") }) : load(t("다른 사람이 먼저 답했다."));
        // 내가 만든 도전장인데 이 브라우저에 기록이 없었다(저장이 막혔거나 다른 창) → 만든 사람 화면으로
        if (e.code === "own") {
          rememberChallenge({ id: c.code, role: "maker", game: c.game, hand: "", at: Date.now(), label: labelOf(c, V) });
          return waitView(c, V, null);
        }
        status.set("bad", errorText(e.code));
        go.disabled = false;
        picker.lock(false);
      }
    });
    clear(root).append(
      onlineHead(V.name, head),
      h(
        "div",
        { class: "entry-grid" },
        rp.el,
        h(
          "section",
          { class: "panel challenge-form", "aria-label": t("손 고르기") },
          h("p", { class: "challenge-lead" }, t("{name:이가} 손을 정해 두었다. 무엇을 냈는지 모른 채 손을 고르세요.", { name: c.from })),
          picker.el,
          h("p", { class: "online-note" }, t("내 이름: {name}", { name: myName() }), " · ", h("a", { href: "#/play" }, t("이름 바꾸기"))),
          h("div", { class: "form-actions" }, go),
          status.el,
        ),
      ),
    );
  }

  // ── 만든 사람: 링크 보내고 기다리기 ─────────────────
  function waitView(c, V, mine) {
    setTitle(t("@page:내 도전장"));
    const rp = ringPanel(V, { rulesLink: c.game === "custom" ? null : `#/v/${c.game}` });
    const hi = mine ? V.index[mine.hand] : undefined;
    if (hi !== undefined) rp.ring.focus(hi);
    const status = statusLine({ hidden: true });
    const check = h("button", { type: "button", class: "btn" }, t("결과 확인"));
    async function refresh(byHand) {
      lastFetch = Date.now();
      if (byHand) status.set("wait", t("결과를 확인하는 중…"));
      try {
        const now = await fetchChallenge(code, { signal: ctl.signal });
        if (!now.open) return show(now, { reveal: true });
        if (byHand) status.set("ok", t("아직 아무도 답하지 않았다."));
      } catch (e) {
        if (!ctl.signal.aborted && byHand) status.set("bad", errorText(e.code));
      }
    }
    check.addEventListener("click", () => refresh(true));
    waiting = { refresh };
    const share = {
      title: t("가위바위보 도전장"),
      text: t("{name}의 {game} 도전장이 왔다. 손을 골라 겨뤄 보세요.", { name: c.from, game: V.name }),
    };
    clear(root).append(
      onlineHead(V.name, t("@page:내 도전장")),
      h(
        "div",
        { class: "entry-grid" },
        rp.el,
        h(
          "section",
          { class: "panel challenge-form", "aria-label": t("@page:내 도전장") },
          h("p", { class: "challenge-lead" }, t("도전장을 만들었다. 이 링크를 보내 주세요.")),
          linkBox(shareLink(`/c/${c.code}`), share),
          hi !== undefined ? myHandLine(V, hi, t("내가 낸 손: {name}. 상대는 결과가 나올 때까지 모른다.", { name: V.hands[hi].name })) : null,
          h(
            "p",
            { class: "online-note" },
            t("상대가 손을 고르면 여기서 결과를 볼 수 있다."),
            c.expires ? " " + t("링크는 {date}까지 열려 있다.", { date: dateText(c.expires) }) : "",
          ),
          h("div", { class: "form-actions" }, check),
          status.el,
        ),
      ),
    );
  }

  // ── 끝난 도전장: 두 손과 결과 ─────────────────
  async function result(c, V, mine, { note, reveal }) {
    const mi = V.index[c.hands.from[0]];
    const ti = V.index[c.hands.to[0]];
    if (mi === undefined || ti === undefined) return failed("unsupported");
    const role = mine ? mine.role : null;
    const takerSide = role === "taker";
    // 왼쪽은 나. 둘 다 아니면 만든 사람이 왼쪽
    const [li, ri] = takerSide ? [ti, mi] : [mi, ti];
    const leftName = role ? t("나") : c.from;
    const rightName = takerSide ? c.from : c.to;
    // 서버가 적어 둔 판정(만든 사람 쪽에서 본 값)을 왼쪽에서 본 값으로
    const cmp = takerSide ? -c.cmp[0] : c.cmp[0];
    const rp = ringPanel(V, { rulesLink: c.game === "custom" ? null : `#/v/${c.game}` });
    const st = stage({ meLabel: leftName, opLabel: rightName });
    const head = role === "maker" ? t("@page:내 도전장") : t("{name}의 도전장", { name: c.from });
    setTitle(head);
    const again = c.game === "custom" ? "#/c/new" : `#/c/new?v=${encodeURIComponent(c.game)}`;
    append(clear(root), [
      onlineHead(V.name, head),
      note ? h("p", { class: "note" }, note) : null,
      h(
        "div",
        { class: "entry-grid" },
        rp.el,
        h(
          "section",
          { class: "panel challenge-form", "aria-label": t("결과") },
          st.el,
          h(
            "div",
            { class: "form-actions" },
            h("a", { class: "btn btn-ink", href: again }, t("이 게임으로 도전장 보내기")),
            h("a", { class: "btn", href: "#/play" }, t("온라인 첫 화면")),
          ),
        ),
      ),
    ]);
    st.me.set(V, null);
    st.op.set(V, null);
    if (reveal) {
      await chant(st, chantWords(V));
      if (ctl.signal.aborted) return;
    }
    st.me.set(V, li);
    st.op.set(V, ri);
    st.me.mark(cmp > 0 ? "won" : cmp < 0 ? "lost" : null);
    st.op.mark(cmp < 0 ? "won" : cmp > 0 ? "lost" : null);
    if (role) st.say(RESULT_WORD[cmp], cmp > 0 ? "win" : cmp < 0 ? "lose" : "");
    // 구경꾼: 이름이 길 수 있어 작은 글씨로
    else st.say(c.winner === -1 ? t("비겼다") : t("{name} 승리", { name: c.winner === 0 ? c.from : c.to }), "named");
    // 도감 규칙이 그 뒤에 바뀌었으면 지금 규칙의 문장이 서버 판정과 어긋날 수 있다. 그때는 문장을 빼고 판정만 보여 준다
    st.sub(V.cmp(li, ri) === cmp ? `${V.sentence(li, ri)}.` : "");
    rp.ring.bout(li, ri);
  }

  // 만든 사람이 다른 앱에서 링크를 보내고 돌아오면 결과를 한 번 본다
  const onVisible = () => {
    if (document.visibilityState === "visible" && waiting && Date.now() - lastFetch > RECHECK_MS) waiting.refresh(false);
  };
  document.addEventListener("visibilitychange", onVisible);

  load();
  return {
    onKey: (e) => (onKey ? onKey(e) : false),
    destroy() {
      ctl.abort();
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}

/** '내 도전장' 목록에 쓸 게임 이름. 직접 만들기는 RPS-n(언어와 상관없다) */
function labelOf(c, V) {
  return c.game === "custom" ? V.name : null;
}
