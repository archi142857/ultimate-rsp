// 도전장(#/c/코드, 디자인 시안 ③ 3–6번 + 시안2 ① 양피지). 서버에서 읽어 와서
//  - 열려 있고 내가 만든 것: 막 만들었으면 '도전장이 준비됐다'(3/3, 양피지가 펼쳐지고 밀랍이 찍힌다),
//    다시 열면 펼친 양피지와 '아직 아무도 안 받았다' + 링크
//  - 열려 있고 남이 만든 것: 말린 양피지의 봉인을 뜯으면 펼쳐지고, 그 안 손 고리에서 손 누르기 → '○○으로 내기'
//  - 끝난 것: 내가 낸 쪽이면 큰 글씨(이겼다·졌다·비겼다)와 동사 문장, 손 고리에 두 손과 화살표.
//             남이 겨룬 것이면 두 사람과 화살표(이미 끝난 도전장)
// 승패는 서버가 답할 때 적어 둔 값(cmp·winner)을 쓴다. 지금은 한 판짜리만 연다(여러 판짜리는 '아직 못 연다').
// 여럿이 도전장(max ≥ 2, 규약 2.1–2.4): 보기 꼴에는 답한 사람 이름(열렸으면 결과)만 있고, 손은 pid 로 묻는 내 꼴(/me)에만 있다.
// 결과는 마감(다 참·만든 사람이 닫음) 때 모두에게 열린다(reveal "end", 서버 2a825ec: 버리는 pid 로 손을 엿보지 못하게).
//  - 만든 사람: 링크 + 답한 사람 줄(그 사람 손과 내 쪽에서 본 결과) + 마감하기
//  - 답한 사람: 마감 전이면 '냈다'와 내 손, 마감 뒤면 내 결과(큰 글씨·두 손) + 다른 사람 줄
//  - 아직 답하지 않았고 받는 중이면 봉인을 뜯고 손 고르기, 마감됐으면 모든 손과 결과 줄

import { h, clear, append, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { handGrid, chant, RESULT_WORD } from "../ui/widgets.js";
import { handArt } from "../ui/art.js";
import { chantWords } from "../views/matrix.js";
import { topBar, bigTitle, card, variantRow, handRing, linkBox, daysLeft } from "./common.js";
import { noticeSlot } from "./notice.js";
import { avatar } from "./avatar.js";
import { peopleRing } from "./people-ring.js";
import { emoteIcon, emoteLabel, isEmote } from "./emotes.js";
import { scroll } from "./parchment.js";
import { variantOf } from "./games.js";
import { myName, playerId, meFields, meWho } from "./identity.js";
import { fetchChallenge, fetchMyChallenge, answerChallenge, closeChallenge } from "./api.js";
import { myChallenge, rememberChallenge, noteChallenge, isFresh, takeFresh } from "./mine.js";
import { errorText, noticeFor } from "./messages.js";
import { shareLink } from "./config.js";

// 만든 사람이 다른 앱에서 링크를 보내고 돌아오면 결과를 한 번 본다. 너무 자주 묻지 않게 간격을 둔다(폴링은 하지 않는다)
const RECHECK_MS = 15000;

/** 남은 시간을 '5시간 20분'·'12분'으로 */
function leftHM(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  if (m < 60) return t("{m}분", { m });
  return m % 60 ? t("{h}시간 {m}분", { h: Math.floor(m / 60), m: m % 60 }) : t("{h}시간", { h: m / 60 });
}

export function challengeView(main, code) {
  setTitle(t("도전장"));
  const ctl = new AbortController();
  const notices = noticeSlot();
  const body = h("div", { class: "online-body" });
  const root = h("div", { class: "online" }, notices.el, body);
  main.append(root);
  const fill = (...kids) => append(clear(body), kids);
  let onKey = null;
  let waiting = null; // 내가 만든 열린 도전장을 보고 있으면 { refresh }
  let lastFetch = 0;
  let paper = null; // 지금 보이는 양피지(움직임 타이머를 치운다)
  const putPaper = (p) => {
    if (paper) paper.destroy();
    paper = p;
    return p;
  };

  async function load(note = null) {
    notices.set("wait", { title: t("도전장을 불러오는 중…"), spin: true });
    try {
      lastFetch = Date.now();
      const c = await fetchChallenge(code, { signal: ctl.signal });
      notices.clear("wait");
      show(c, { note });
    } catch (e) {
      if (ctl.signal.aborted) return;
      notices.clear("wait");
      failed(e.code);
    }
  }

  function failed(why) {
    onKey = null;
    waiting = null;
    setTitle(t("도전장"));
    const unsupported = why === "unsupported";
    const known = unsupported || ["not_found", "bad_reply", "bad_request", "origin"].includes(why);
    if (!known) {
      const n = noticeFor(why);
      notices.set(n.kind, { ...n, action: n.kind === "update" ? { label: t("새로고침"), run: () => location.reload() } : { label: t("다시"), run: () => load() } });
    }
    fill(
      topBar({ href: "#/play", label: t("온라인") }).el,
      bigTitle(t("도전장")),
      h("p", { class: "o-p" }, unsupported ? t("이 도전장은 이 화면에서 아직 열 수 없다. 새로고침하면 된다.") : errorText(why)),
      h(
        "div",
        { class: "o-actions" },
        why === "not_found"
          ? h("a", { class: "btn btn-ink btn-big", href: "#/c/new" }, t("나도 도전장 만들기"))
          : h("button", { type: "button", class: "btn btn-ink btn-big", onclick: () => load() }, t("다시 해 보기")),
      ),
    );
  }

  function show(c, { note = null, reveal = false } = {}) {
    onKey = null;
    waiting = null;
    putPaper(null);
    const V = variantOf(c.game, c.custom);
    if (!V || c.rounds !== 1) return failed("unsupported");
    if (c.max > 1) return many(c, V, { note, reveal });
    const mine = myChallenge(c.code);
    if (!c.open) return mine ? result(c, V, mine, { note, reveal }) : finished(c, V, { note });
    if (mine && mine.role === "maker") return waitView(c, V, mine);
    return answerView(c, V);
  }

  const leftText = (c) => (c.expires ? t("{n}일 남음", { n: daysLeft(c.expires) }) : null);
  const rulesLink = (c) => (c.game === "custom" ? null : h("a", { class: "o-link", href: `#/v/${c.game}` }, t("규칙")));

  // ── 받은 사람: 봉인을 뜯고 손 고르기 ─────────────────
  function answerView(c, V) {
    setTitle(t("{name}의 도전장", { name: c.from }));
    let picked = null;
    const go = h("button", { type: "button", class: "btn btn-ink btn-big", disabled: true }, t("손 고르기"));
    const ring = handRing(V, { size: 260, pickable: true, onPick: (i) => choose(i, "ring") });
    const grid = V.n > 7 ? handGrid(V, { onPick: (i) => choose(i, "grid") }) : null;
    if (grid) grid.buttons.forEach((b) => b.setAttribute("aria-pressed", "false"));
    function choose(i, from) {
      picked = i;
      if (from !== "ring") ring.set(i);
      if (grid)
        grid.buttons.forEach((b, k) => {
          b.classList.toggle("picked", k === i);
          b.setAttribute("aria-pressed", String(k === i));
        });
      go.textContent = t("{hand:으로로} 내기", { hand: V.hands[i].name });
      go.disabled = false;
    }
    go.addEventListener("click", async () => {
      if (picked === null || go.disabled) return;
      const hand = V.hands[picked].id;
      go.disabled = true;
      notices.set("wait", { title: t("겨루는 중…"), spin: true });
      try {
        const done = await answerChallenge(c.code, { hands: [hand], ...meFields(), pid: playerId() }, { signal: ctl.signal });
        notices.clear("wait");
        rememberChallenge({ id: c.code, role: "taker", game: c.game, hand, at: Date.now(), label: labelOf(c, V), result: done.cmp ? -done.cmp[0] : undefined, vs: c.from });
        show(done, { reveal: true });
      } catch (e) {
        if (ctl.signal.aborted) return;
        notices.clear("wait");
        // 그사이 다른 사람이 먼저 답했으면(여럿이면 자리가 다 찼으면) 그 결과를 보여 준다
        const why = c.max > 1 ? t("그사이 마감됐다.") : t("다른 사람이 먼저 답했다.");
        if (e.code === "closed") return e.result ? show(e.result, { note: why }) : load(why);
        // 내가 만든 도전장인데 이 브라우저에 기록이 없었다(저장이 막혔거나 다른 창) → 만든 사람 화면으로
        if (e.code === "own") {
          rememberChallenge({ id: c.code, role: "maker", game: c.game, hand: "", at: Date.now(), label: labelOf(c, V), max: c.max });
          return c.max > 1 ? load() : waitView(c, V, null);
        }
        const n = noticeFor(e.code);
        notices.set(n.kind, n);
        go.disabled = false;
      }
    });
    const title = t("{name}의 도전장", { name: c.from });
    // 봉인을 뜯기 전에는 종이 아래(변종·단추)도 숨긴다
    const hint = h("p", { class: "o-p o-small o-center" }, t("봉인을 눌러 뜯는다."));
    const rest = h(
      "div",
      { class: "online-body", hidden: true },
      variantRow(V, { right: rulesLink(c) }),
      h("p", { class: "o-p" }, t("손을 골라 누른다. 상대 손은 내가 낸 다음에 보인다.")),
      c.max > 1
        ? h(
            "p",
            { class: "o-p o-small" },
            c.reveal === "end"
              ? t("여럿이 받는 도전장이다({n}/{max}명 답함). 답하면 내 이름이 이 링크를 가진 사람 모두에게 보이고, 결과는 마감되면 공개된다.", { n: c.count, max: c.max })
              : t("여럿이 받는 도전장이다({n}/{max}명 답함). 답하면 내 이름과 결과가 이 링크를 가진 사람 모두에게 보인다.", { n: c.count, max: c.max }),
          )
        : null,
      grid ? grid.el : null,
      h("div", { class: "o-actions o-bottom" }, go),
      h("p", { class: "o-p o-small o-center" }, t("내 이름: {name}", { name: myName() }), " · ", h("a", { href: "#/play?name=1" }, t("이름 바꾸기"))),
    );
    const p = putPaper(
      scroll({
        mode: "recv",
        label: title,
        children: [
          h(
            "div",
            { class: "parch-from" },
            avatar({ kind: "human", name: c.from, face: c.fromFace }, { size: 34 }),
            isEmote(c.e) ? h("span", { class: "from-emote", title: emoteLabel(c.e), role: "img", "aria-label": emoteLabel(c.e) }, emoteIcon(c.e)) : null,
          ),
          h("h2", { class: "parch-title" }, title),
          h("p", { class: "parch-sub" }, t("무엇을 내시겠습니까?")),
          h("div", { class: "hand-ring-box parch-ring" }, ring.el),
        ],
        onOpen: (byKey) => {
          hint.remove();
          rest.hidden = false;
          onKey = grid ? (e) => grid.keyHandler(e) : null;
          // 키보드로 뜯었으면 첫 손으로 포커스를 옮긴다(봉인 단추가 사라지므로)
          if (byKey) {
            const first = ring.el.querySelector("[tabindex]");
            if (first) first.focus();
          }
        },
      }),
    );
    fill(topBar({ label: t("도전장") }, leftText(c)).el, p.el, hint, rest);
    p.start();
  }

  // ── 만든 사람: 링크 보내고 기다리기 ─────────────────
  function waitView(c, V, mine) {
    setTitle(t("@page:내 도전장"));
    const hi = mine && mine.hand ? V.index[mine.hand] : undefined;
    const handName = hi !== undefined ? V.hands[hi].name : null;
    const share = {
      title: t("가위바위보 도전장"),
      text: t("{name}의 {game} 도전장이 왔다. 손을 골라 겨뤄 보자.", { name: c.from, game: V.name }),
    };
    const url = shareLink(`/c/${c.code}`);
    const check = h("button", { type: "button", class: "btn btn-sm" }, t("결과 확인"));
    async function refresh(byHand) {
      lastFetch = Date.now();
      if (byHand) notices.set("wait", { title: t("결과를 확인하는 중…"), spin: true });
      try {
        const now = await fetchChallenge(code, { signal: ctl.signal });
        notices.clear("wait");
        if (!now.open) return show(now, { reveal: true });
        if (byHand) notices.set("note", { title: t("아직 아무도 답하지 않았다.") });
      } catch (e) {
        notices.clear("wait");
        if (!ctl.signal.aborted && byHand) {
          const n = noticeFor(e.code);
          notices.set(n.kind, n);
        }
      }
    }
    check.addEventListener("click", () => refresh(true));
    waiting = { refresh };
    // 내가 쓴 도전장: 종이에 '도전장 / ○○ 한 판 / ? / — 내 이름', 오른쪽 아래에 밀랍
    const p = putPaper(
      scroll({
        mode: "send",
        label: t("도전장"),
        children: [
          h("h2", { class: "parch-title" }, t("도전장")),
          h("p", { class: "parch-sub" }, t("{game} 한 판", { game: V.name })),
          h("span", { class: "parch-slot", "aria-hidden": "true" }, "?"),
          h("p", { class: "parch-sig" }, `— ${c.from}`),
        ],
      }),
    );
    if (isFresh(c.code)) {
      // 3/3: 막 만든 도전장. 양피지가 펼쳐지고 밀랍이 찍힌다
      fill(
        topBar({ href: "#/c/new", label: t("도전장 만들기") }, h("span", {}, h("b", {}, "3"), "/3")).el,
        bigTitle(t("도전장이 준비됐다")),
        p.el,
        handName ? h("p", { class: "o-p o-center" }, t("내 손: {name}", { name: handName })) : null,
        card(h("p", { class: "o-label" }, t("링크")), linkBox(url, share)),
        h(
          "p",
          { class: "o-p" },
          t("처음 답한 한 사람과 겨룬다."),
          c.expires ? " " + t("{n}일 동안 열려 있다.", { n: daysLeft(c.expires) }) : "",
          " ",
          t("결과는 이 링크와 온라인 첫 화면 '내 도전장'에서 본다."),
        ),
        h("div", { class: "o-actions" }, check),
      );
      p.start({ play: true });
      return;
    }
    const meta = [V.name, handName ? t("내 손: {name}", { name: handName }) : null, leftText(c)].filter(Boolean).join(" · ");
    fill(
      topBar({ href: "#/play", label: t("온라인") }, h("span", {}, t("@page:내 도전장"))).el,
      p.el,
      card(
        h(
          "div",
          { class: "o-row" },
          avatar({ ...meWho(), name: c.from }, { size: 40 }),
          h("div", { class: "o-grow" }, h("p", { class: "o-strong" }, t("아직 아무도 안 받았다")), h("p", { class: "o-p o-small o-ell" }, meta)),
        ),
        linkBox(url, { ...share, showUrl: false }),
      ),
      h("p", { class: "o-p" }, t("상대가 손을 고르면 여기서 결과를 볼 수 있다.")),
      h("div", { class: "o-actions" }, check),
    );
  }

  // ── 끝난 도전장(내가 겨룬 것): 큰 글씨와 두 손 ─────────────────
  async function result(c, V, mine, { note, reveal, extra = null }) {
    const mi = V.index[c.hands.from[0]];
    const ti = V.index[c.hands.to[0]];
    if (mi === undefined || ti === undefined) return failed("unsupported");
    const taker = mine.role === "taker";
    const [myI, opI] = taker ? [ti, mi] : [mi, ti];
    const opName = taker ? c.from : c.to;
    const opFace = taker ? c.fromFace : c.toFace;
    // 서버가 적어 둔 판정(만든 사람 쪽에서 본 값)을 내 쪽에서 본 값으로
    const cmp = taker ? -c.cmp[0] : c.cmp[0];
    noteChallenge(c.code, { result: cmp, vs: opName });
    setTitle(taker ? t("{name}의 도전장", { name: c.from }) : t("@page:내 도전장"));
    const word = bigTitle("", "");
    const sentence = h("p", { class: "o-p o-verb" });
    const ring = handRing(V);
    const again = c.game === "custom" ? "#/c/new" : `#/c/new?v=${encodeURIComponent(c.game)}`;
    const replay = h("button", { type: "button", class: "btn" }, t("다시 보기"));
    append(clear(body), [
      topBar({ label: t("도전장") }, t("끝남")).el,
      note ? h("p", { class: "o-note" }, note) : null,
      word,
      sentence,
      h("div", { class: "hand-ring-box" }, ring.el),
      ring.labels ? null : h("p", { class: "o-p o-center" }, `${t("나")}: ${V.hands[myI].name} · ${opName}: ${V.hands[opI].name}`),
      card(h("div", { class: "o-row" }, avatar({ kind: "human", name: opName, face: opFace }, { size: 30 }), h("p", { class: "o-p o-grow" }, t("{name}도 이 링크에서 결과를 본다.", { name: opName })))),
      extra,
      h("div", { class: "o-actions o-bottom two" }, h("a", { class: "btn btn-ink", href: again }, t("나도 도전장 보내기")), replay),
    ]);
    async function play(animate) {
      replay.disabled = true;
      ring.clear();
      sentence.textContent = "";
      word.className = "o-h1";
      if (animate) {
        const say = { say: (w) => (word.textContent = w) };
        await chant(say, chantWords(V), 320); // 결과 보기는 천천히 센다(방의 공개와 같은 박자)
        if (ctl.signal.aborted) return;
      }
      word.textContent = RESULT_WORD[cmp];
      word.className = "o-h1" + (cmp > 0 ? " tone-win" : cmp < 0 ? " tone-lose" : "");
      // 도감 규칙이 그 뒤에 바뀌었으면 지금 규칙의 문장이 서버 판정과 어긋날 수 있다. 그때는 문장을 빼고 판정만
      sentence.textContent = cmp !== 0 && V.cmp(myI, opI) === cmp ? `${V.sentence(myI, opI)}.` : cmp === 0 ? t("같은 손을 냈다.") : "";
      ring.bout(myI, opI, t("나"), opName);
      replay.disabled = false;
    }
    replay.addEventListener("click", () => play(true));
    await play(reveal);
  }

  // ── 여럿이 도전장 ─────────────────
  /** 내 꼴(/me)로 내가 만든 사람인지, 답한 사람인지 알아내고 그에 맞는 화면으로 */
  async function many(c, V, opts) {
    let me = c;
    if (c.you === undefined) {
      try {
        me = await fetchMyChallenge(code, { pid: playerId() }, { signal: ctl.signal });
      } catch (e) {
        if (ctl.signal.aborted) return;
        // 내 꼴을 못 받으면 누구나 보는 꼴로 보인다
      }
    }
    const mine = myChallenge(code);
    if (me.you === "from") return manyOwner(me, V, mine);
    if (Number.isInteger(me.you)) {
      if (!mine) rememberChallenge({ id: me.code, role: "taker", game: me.game, hand: me.hands.to[0], at: Date.now(), label: labelOf(me, V), vs: me.from });
      if (me.pending) return manyPending(me, V, opts);
      // 마감 뒤 처음 열면(이 브라우저가 아직 결과를 모르면) 결과 연출을 한다(컨셉 11-09)
      const first = !mine || ![1, 0, -1].includes(mine.result);
      return result(me, V, { role: "taker" }, { ...opts, reveal: opts.reveal || first, extra: answersCard(me, V, { skip: me.you, title: t("다른 사람"), empty: t("아직 다른 사람은 답하지 않았다.") }) });
    }
    if (me.open) return answerView(me, V);
    return manyFull(me, V, opts);
  }

  /** 답한 사람 줄. owner 면 그 사람 손과 내(만든 사람) 쪽에서 본 결과, 아니면 그 사람이 만든 사람에게 이겼는지 */
  function answersCard(c, V, { owner = false, skip = -1, title = t("답한 사람"), empty = t("아직 아무도 답하지 않았다.") } = {}) {
    const rows = c.answers
      .map((a, k) => ({ a, k }))
      .filter(({ k }) => k !== skip)
      .map(({ a }) => {
        const hi = a.hands ? V.index[a.hands[0]] : undefined;
        // winner: 0 만든 사람, 1 답한 사람, −1 비김, null 아직 안 열림(마감 전)
        const res = a.winner === null ? null : owner ? (a.winner === 0 ? 1 : a.winner === 1 ? -1 : 0) : a.winner === 1 ? 1 : a.winner === 0 ? -1 : 0;
        const chip =
          res === null
            ? h("span", { class: "chip" }, t("@chip:냈다"))
            : h("span", { class: "chip" + (res > 0 ? " ok" : res < 0 ? " no" : "") }, res > 0 ? t("@chip:이겼다") : res < 0 ? t("@chip:졌다") : t("@chip:비겼다"));
        return h(
          "li",
          { class: "ans-row" },
          avatar({ kind: "human", name: a.name, face: a.face }, { size: 30 }),
          h("span", { class: "ans-name" }, a.name),
          hi !== undefined ? h("span", { class: "ans-hand" }, V.hands[hi].name) : null,
          chip,
        );
      });
    const head = h("div", { class: "rkbox-head" }, h("h3", { class: "rkbox-title" }, title), h("span", { class: "o-p o-small" }, t("{n}/{max}명", { n: c.count, max: c.max })));
    const shown = c.answers.some((a, k) => k !== skip && a.winner !== null);
    return card(head, rows.length ? h("ul", { class: "ans-list" }, rows) : h("p", { class: "o-p o-small" }, empty), owner || !shown ? null : h("p", { class: "o-p o-small" }, t("결과는 답한 사람 쪽에서 본 것이다.")));
  }

  /** 만든 사람: 링크와 답한 사람 줄. 막 만들었으면 '도전장이 준비됐다'(3/3) */
  function manyOwner(c, V, mine) {
    setTitle(t("@page:내 도전장"));
    // 다른 브라우저에서 만든 것이면 이 브라우저의 '내 도전장'에도 넣는다
    if (mine) noteChallenge(c.code, { max: c.max, n: c.count });
    else rememberChallenge({ id: c.code, role: "maker", game: c.game, hand: c.hands && c.hands.from ? c.hands.from[0] : "", at: Date.now(), label: labelOf(c, V), max: c.max, n: c.count });
    const hi = c.hands && c.hands.from ? V.index[c.hands.from[0]] : mine && mine.hand ? V.index[mine.hand] : undefined;
    const handName = hi !== undefined ? V.hands[hi].name : null;
    const share = {
      title: t("가위바위보 도전장"),
      text: t("{name}의 {game} 도전장이 왔다. 손을 골라 겨뤄 보자.", { name: c.from, game: V.name }),
    };
    const url = shareLink(`/c/${c.code}`);
    const check = h("button", { type: "button", class: "btn btn-sm" }, t("결과 확인"));
    async function refresh(byHand) {
      lastFetch = Date.now();
      if (byHand) notices.set("wait", { title: t("결과를 확인하는 중…"), spin: true });
      try {
        const now = await fetchMyChallenge(code, { pid: playerId() }, { signal: ctl.signal });
        notices.clear("wait");
        if (now.count !== c.count || now.open !== c.open) return show(now);
        if (byHand) notices.set("note", { title: t("새 답이 없다.") });
      } catch (e) {
        notices.clear("wait");
        if (!ctl.signal.aborted && byHand) {
          const n = noticeFor(e.code);
          notices.set(n.kind, n);
        }
      }
    }
    check.addEventListener("click", () => refresh(true));
    waiting = c.open ? { refresh } : null;
    // 마감하기: 더 받지 않고 결과를 모두에게 연다(되돌릴 수 없어 한 번 더 묻는다)
    const closeBox = h("div", { class: "o-close" });
    const askClose = () => {
      const yes = h("button", { type: "button", class: "btn btn-sm btn-ink" }, t("마감하고 공개"));
      const no = h("button", { type: "button", class: "btn btn-sm" }, t("취소"));
      yes.addEventListener("click", async () => {
        yes.disabled = no.disabled = true;
        try {
          const now = await closeChallenge(code, { pid: playerId() }, { signal: ctl.signal });
          show(now);
        } catch (e) {
          if (ctl.signal.aborted) return;
          const n = noticeFor(e.code);
          notices.set(n.kind, n);
          yes.disabled = no.disabled = false;
        }
      });
      no.addEventListener("click", idleClose);
      closeBox.classList.add("asking");
      closeBox.replaceChildren(h("p", { class: "o-p o-small" }, t("더 받지 않고 지금까지의 결과를 모두에게 공개한다. 마감하시겠습니까?")), h("div", { class: "o-row" }, yes, no));
      yes.focus();
    };
    function idleClose() {
      const btn = h("button", { type: "button", class: "btn btn-sm" }, t("마감하고 공개"));
      btn.addEventListener("click", askClose);
      closeBox.classList.remove("asking");
      closeBox.replaceChildren(btn);
    }
    if (c.open) idleClose();
    const p = putPaper(
      scroll({
        mode: "send",
        label: t("도전장"),
        children: [
          h("h2", { class: "parch-title" }, t("도전장")),
          h("p", { class: "parch-sub" }, t("{game} 한 판", { game: V.name })),
          h("span", { class: "parch-slot", "aria-hidden": "true" }, "?"),
          h("p", { class: "parch-sig" }, `— ${c.from}`),
        ],
      }),
    );
    const openMeta = c.closesIn !== null ? t("{t} 뒤 저절로 마감", { t: leftHM(c.closesIn) }) : leftText(c);
    const meta = [handName ? t("내 손: {name}", { name: handName }) : null, c.open ? openMeta : c.closed ? t("마감했다") : c.count >= c.max ? t("자리가 다 찼다") : t("하루가 지나 마감됐다")].filter(Boolean).join(" · ");
    const fresh = takeFresh(c.code);
    fill(
      fresh
        ? topBar({ href: "#/c/new", label: t("도전장 만들기") }, h("span", {}, h("b", {}, "3"), "/3")).el
        : topBar({ href: "#/play", label: t("온라인") }, h("span", {}, t("@page:내 도전장"))).el,
      fresh ? bigTitle(t("도전장이 준비됐다")) : null,
      p.el,
      h("p", { class: "o-p o-center" }, meta),
      c.open ? card(h("p", { class: "o-label" }, t("링크")), linkBox(url, share)) : null,
      fresh ? h("p", { class: "o-p" }, t("{n}명까지 답하고, 답마다 따로 겨룬다.", { n: c.max }), " ", t("결과는 이 링크와 온라인 첫 화면 '내 도전장'에서 본다.")) : null,
      answersCard(c, V, { owner: true }),
      c.open && c.reveal === "end" ? h("p", { class: "o-p o-small" }, t("답한 사람은 마감할 때까지 결과를 모른다. {n}명이 다 답하거나 내가 마감하거나 하루가 지나면 모두에게 공개된다.", { n: c.max })) : null,
      c.open ? h("div", { class: "o-actions o-row-wrap" }, check, closeBox) : null,
    );
    if (fresh) p.start({ play: true });
  }

  /** 답했지만 마감 전(reveal "end"): 내 손과 '냈다', 누가 답했는지만 */
  function manyPending(c, V, { note }) {
    setTitle(t("{name}의 도전장", { name: c.from }));
    const hi = c.hands && c.hands.to ? V.index[c.hands.to[0]] : undefined;
    const again = c.game === "custom" ? "#/c/new" : `#/c/new?v=${encodeURIComponent(c.game)}`;
    const check = h("button", { type: "button", class: "btn" }, t("결과 확인"));
    async function refresh(byHand) {
      lastFetch = Date.now();
      if (byHand) notices.set("wait", { title: t("결과를 확인하는 중…"), spin: true });
      try {
        const now = await fetchMyChallenge(code, { pid: playerId() }, { signal: ctl.signal });
        notices.clear("wait");
        if (!now.pending) return show(now, { reveal: true });
        if (now.count !== c.count) return show(now);
        if (byHand) notices.set("note", { title: t("아직 마감하지 않았다.") });
      } catch (e) {
        notices.clear("wait");
        if (!ctl.signal.aborted && byHand) {
          const n = noticeFor(e.code);
          notices.set(n.kind, n);
        }
      }
    }
    check.addEventListener("click", () => refresh(true));
    waiting = { refresh };
    fill(
      topBar({ label: t("도전장") }, c.open && c.closesIn !== null ? t("{t} 뒤 저절로 마감", { t: leftHM(c.closesIn) }) : leftText(c)).el,
      note ? h("p", { class: "o-note" }, note) : null,
      bigTitle(t("냈다")),
      h(
        "p",
        { class: "o-p" },
        t("결과는 {name}의 도전장이 마감되면 보인다. {n}명이 다 답하거나, {name:이가} 직접 닫거나, 하루가 지나면 마감된다.", { name: c.from, n: c.max }),
      ),
      hi !== undefined ? card(h("div", { class: "o-row" }, h("span", { class: "ans-art", "aria-hidden": "true" }, handArt(V.hands[hi])), h("p", { class: "o-p o-grow" }, t("내 손: {name}", { name: V.hands[hi].name })))) : null,
      answersCard(c, V, { title: t("답한 사람") }),
      h("div", { class: "o-actions o-bottom two" }, h("a", { class: "btn btn-ink", href: again }, t("나도 도전장 보내기")), check),
    );
  }

  /** 마감된 여럿이 도전장(내가 답하지 않은 것): 만든 사람 손과 모든 답 */
  function manyFull(c, V, { note }) {
    setTitle(t("도전장"));
    const again = c.game === "custom" ? "#/c/new" : `#/c/new?v=${encodeURIComponent(c.game)}`;
    const fi = c.hands && c.hands.from ? V.index[c.hands.from[0]] : undefined;
    fill(
      topBar({ href: "#/play", label: t("온라인") }).el,
      note ? h("p", { class: "o-note" }, note) : null,
      h(
        "section",
        { class: "o-card o-card-center" },
        h("p", { class: "o-strong" }, c.closed || c.count < c.max ? t("마감된 도전장이다") : t("자리가 다 찬 도전장이다")),
        h("p", { class: "o-p" }, t("{name}의 도전장에 {n}명이 답했다.", { name: c.from, n: c.count }), fi !== undefined ? " " + t("{name}의 손: {hand}", { name: c.from, hand: V.hands[fi].name }) : ""),
        h("a", { class: "btn btn-ink btn-big", href: again }, t("나도 도전장 만들기")),
      ),
      answersCard(c, V),
    );
  }

  // ── 끝난 도전장(남이 겨룬 것) ─────────────────
  function finished(c, V, { note }) {
    setTitle(t("도전장"));
    const fi = V.index[c.hands.from[0]];
    const ti = V.index[c.hands.to[0]];
    if (fi === undefined || ti === undefined) return failed("unsupported");
    const win = c.winner; // 0 만든 사람, 1 받은 사람, −1 비김
    const ring = peopleRing({ height: 172, size: 54, radius: 80, chords: false, start: 180, label: t("도전장") });
    ring.set({
      people: [
        { key: "from", who: { kind: "human", name: c.from, face: c.fromFace }, label: c.from, hand: { V, i: fi }, badge: win === 0 ? { text: t("@badge:승"), kind: "ok", say: t("이김") } : null },
        { key: "to", who: { kind: "human", name: c.to, face: c.toFace }, label: c.to, hand: { V, i: ti }, badge: win === 1 ? { text: t("@badge:승"), kind: "ok", say: t("이김") } : null },
      ],
      arrows: win === 0 ? [{ from: 0, to: 1, hand: { V, i: fi } }] : win === 1 ? [{ from: 1, to: 0, hand: { V, i: ti } }] : [],
    });
    const again = c.game === "custom" ? "#/c/new" : `#/c/new?v=${encodeURIComponent(c.game)}`;
    fill(
      topBar({ href: "#/play", label: t("온라인") }).el,
      note ? h("p", { class: "o-note" }, note) : null,
      h(
        "section",
        { class: "o-card o-card-center" },
        ring.el,
        h("p", { class: "o-strong" }, t("이미 끝난 도전장이다")),
        h("p", { class: "o-p" }, t("{name:이가} 먼저 답했다.", { name: c.to }), " ", V.cmp(fi, ti) === c.cmp[0] && c.cmp[0] !== 0 ? `${V.sentence(fi, ti)}.` : ""),
        h("a", { class: "btn btn-ink btn-big", href: again }, t("나도 도전장 만들기")),
      ),
    );
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
      putPaper(null);
      notices.destroy();
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
}

/** '내 도전장' 목록에 쓸 게임 이름. 직접 만들기는 RPS-n(언어와 상관없다) */
function labelOf(c, V) {
  return c.game === "custom" ? V.name : null;
}
