// 한 판짜리 변종 화면: 고리 그림 + 컴퓨터와 겨루기 + 규칙·전략.

import { h, clear, frac, append } from "../ui/dom.js";
import { t, lower, listWords, scriptLang } from "../i18n.js";
import { handArt } from "../ui/art.js";
import { compileVariant } from "../core/engine.js";
import { BOTS, createBot } from "../core/bots.js";
import { makeRng } from "../core/rng.js";
import { createMatch, FORMATS, formatById } from "../games/match.js";
import { createRing } from "../ui/ring.js";
import { handGrid, selectBox, segmented, stage, chant, fastToggle, RESULT_WORD, mixBar, block, recordLine, rpsChant, countChant } from "../ui/widgets.js";
import { addRecord, record, setting, setSetting } from "../ui/store.js";
import { entryHead, entryBody, scoreboard, histItem } from "./common.js";
import { sfx } from "../sound/index.js";

const CLASSIC_IDS = ["scissors", "rock", "paper"];

export function chantWords(V) {
  const ids = V.hands.map((x) => x.id);
  if (V.n === 3 && CLASSIC_IDS.every((id) => ids.includes(id))) return rpsChant();
  return countChant();
}

export function drawChance(V) {
  let draws = 0;
  for (let a = 0; a < V.n; a++) for (let b = 0; b < V.n; b++) if (V.cmp(a, b) === 0) draws += 1;
  return draws / (V.n * V.n);
}

export function matrixView(main, entry) {
  const V = compileVariant(entry);
  return buildMatrixPage(main, entry, V);
}

/** 고리·겨루기·본문을 그린다. 직접 만들기 화면도 이것을 쓴다(extraControls 로 손 개수 고르기를 넣는다) */
export function buildMatrixPage(main, entry, V, { extraControls = null, recordId = entry.id } = {}) {
  const rng = makeRng();
  let botId = setting("bot", "human");
  if (!BOTS.some((b) => b.id === botId)) botId = "human";
  let fmt = formatById(setting("format", "bo3"));
  let bot = createBot(botId, V, rng);
  let match = createMatch(V, { target: fmt.target });
  let busy = false;

  const ring = createRing(V, { size: 440 });
  const st = stage();
  const score = scoreboard();
  const hist = h("ol", { class: "hist", "aria-label": t("지난 판") });
  const rec = h("p", { class: "rec" }, recordLine(record(recordId)));
  const doneBar = h("div", { class: "done-bar", hidden: true });

  const grid = handGrid(V, { onPick: (i) => play(i) });
  grid.buttons.forEach((b, k) => {
    b.addEventListener("mouseenter", () => !busy && ring.focus(k));
    b.addEventListener("mouseleave", () => !busy && ring.focus(null));
    b.addEventListener("focus", () => !busy && ring.focus(k));
    b.addEventListener("blur", () => !busy && ring.focus(null));
  });

  const botSel = selectBox({
    label: t("컴퓨터 전략"),
    value: botId,
    options: BOTS.map((b) => ({ id: b.id, name: b.name })),
    onChange(id) {
      botId = id;
      setSetting("bot", id);
      bot = createBot(id, V, rng);
      botDesc.textContent = BOTS.find((b) => b.id === id).desc;
      newMatch();
    },
  });
  const botDesc = h("p", { class: "rec" }, BOTS.find((b) => b.id === botId).desc);
  const fmtSeg = segmented({
    label: t("판 수"),
    value: fmt.id,
    options: FORMATS.map((f) => ({ id: f.id, name: f.name })),
    onChange(id) {
      fmt = formatById(id);
      setSetting("format", id);
      newMatch();
    },
  });

  function newMatch() {
    match = createMatch(V, { target: fmt.target });
    bot.reset && bot.reset();
    busy = false;
    grid.lock(false);
    doneBar.hidden = true;
    clear(hist);
    st.reset();
    st.me.set(V, null);
    st.op.set(V, null);
    st.say("");
    st.sub(fmt.target === Infinity ? t("끝없이 겨룹니다. 원하는 만큼 하면 됩니다.") : t("먼저 {n}번 이기면 끝납니다. 비긴 판은 세지 않습니다.", { n: fmt.target }));
    ring.clear();
    updateScore();
  }

  function updateScore() {
    const note = fmt.target === Infinity ? t("{n}판째", { n: match.rounds.length }) : t("먼저 {n}승", { n: fmt.target });
    score.set(match.score[0], match.score[1], note);
  }

  async function play(i) {
    if (busy || match.done) return;
    busy = true;
    grid.lock(true);
    ring.clear();
    st.reset();
    const j = bot.pick({ history: match.historyFor(1), allowed: match.allowed(1) });
    st.me.set(V, null);
    st.op.set(V, null);
    await chant(st, chantWords(V));
    const r = match.play(i, j);
    st.me.set(V, i);
    st.op.set(V, j);
    st.say(RESULT_WORD[r.cmp], r.cmp > 0 ? "win" : r.cmp < 0 ? "lose" : "");
    if (r.cmp === 0) sfx("draw");
    st.sub(r.cmp === 0 ? `${V.sentence(i, j)}. ${t("다시 내기")}` : r.sentence);
    st.me.mark(r.cmp > 0 ? "won" : r.cmp < 0 ? "lost" : null);
    st.op.mark(r.cmp < 0 ? "won" : r.cmp > 0 ? "lost" : null);
    ring.bout(i, j);
    updateScore();
    hist.prepend(histItem(V, i, j, r.cmp));
    while (hist.children.length > 16) hist.lastChild.remove();
    rec.textContent = recordLine(addRecord(recordId, r.cmp));
    if (match.done) {
      const won = match.winner === 0;
      if (fmt.target > 1) sfx(won ? "matchwin" : "matchlose");
      clear(doneBar).append(
        h("strong", {}, won ? t("{f} 승리", { f: fmt.name }) : t("{f} 패배", { f: fmt.name })),
        h("button", { class: "btn btn-ink", type: "button", onclick: newMatch }, t("새 경기")),
      );
      doneBar.hidden = false;
    } else {
      grid.lock(false);
    }
    busy = false;
  }

  const k = V.beats(0).length;
  const facts = [
    [t("손"), t("{n}개", { n: V.n })],
    [t("아무렇게나 낼 때 비길 확률"), frac(drawChance(V))],
    [t("@fact:균형"), V.balanced ? t("고름(손마다 {k}개를 이김)", { k }) : t("고르지 않음")],
  ];

  const playPanel = h(
    "section",
    { class: "panel", "aria-label": t("컴퓨터와 겨루기") },
    h("div", { class: "controls" }, botSel.el, fmtSeg.el, fastToggle()),
    botDesc,
    score.el,
    st.el,
    grid.el,
    doneBar,
    hist,
    rec,
  );

  const ringPanel = h(
    "div",
    { class: "ring-panel" },
    h("div", { class: "ring-box" }, ring.el),
    h("p", { class: "ring-note" }, t("화살표는 이기는 손에서 지는 손으로 갑니다. 손을 누르면 그 손이 이기는 상대는 같은 색으로, 지는 상대는 진하게 보입니다.") + (hasDraws(V) ? t(" 선이 없는 두 손은 비깁니다.") : "")),
  );

  append(main, [
    entryHead(entry, { facts, title: V.name, sub: entry.sub }),
    extraControls,
    h("div", { class: "entry-grid" }, ringPanel, playPanel),
    entryBody(entry, relationsBlock(V), howBlock(V), strategyBlock(V), akaBlock(entry)),
  ]);
  newMatch();

  return {
    onKey: (e) => grid.keyHandler(e),
    destroy() {
      busy = true;
    },
  };
}

function hasDraws(V) {
  for (let a = 0; a < V.n; a++) for (let b = a + 1; b < V.n; b++) if (V.cmp(a, b) === 0) return true;
  return false;
}

function relationsBlock(V) {
  // 손이 아주 많으면 손마다 늘어놓지 않고 고리 차례만 보여 준다(고리 그림에서 짚으면 바로 보인다)
  if (V.n > 25 && V.cycle) {
    return block(
      t("누가 누구를 이기는지"),
      h("p", {}, t("손을 아래 차례대로 고리에 놓습니다. 손마다 바로 뒤의 {k}개를 이기고, 끝에서는 처음으로 돌아가 셉니다. 고리 그림에서 손을 누르면 누구를 이기는지 보입니다.", { k: V.cycle })),
      h("ol", { class: "ringlist" }, V.order.map((i) => h("li", {}, handArt(V.hands[i]), ` ${V.hands[i].name}`))),
    );
  }
  const names = (ks) => listWords(ks.map((x) => lower(V.hands[x].name, V.hands[x].proper)));
  const items = V.hands.map((hd) => {
    const w = V.beats(hd.i);
    const l = V.beatenBy(hd.i);
    return h(
      "li",
      {},
      handArt(hd, "e"),
      h(
        "span",
        {},
        h("b", {}, hd.name),
        " ",
        w.length ? t("{w:을를} 이김. ", { w: names(w) }) : "",
        l.length ? t("{l}에 짐", { l: names(l) }) : "",
      ),
    );
  });
  const parts = [h("ul", { class: "relist" }, items)];
  if (V.n <= 9) parts.push(h("div", { class: "table-wrap" }, matrixTable(V)));
  return block(t("누가 누구를 이기는지"), ...parts);
}

function matrixTable(V) {
  const head = h(
    "tr",
    {},
    h("th", { scope: "col" }, h("span", { class: "sr" }, t("내 손 / 상대 손"))),
    V.hands.map((hd) => h("th", { scope: "col", class: "e", title: hd.name }, handArt(hd), h("span", { class: "sr" }, hd.name))),
  );
  const rows = V.hands.map((a) =>
    h(
      "tr",
      {},
      h("th", { scope: "row", class: "e", title: a.name }, handArt(a), h("span", { class: "sr" }, a.name)),
      V.hands.map((b) => {
        const c = V.cmp(a.i, b.i);
        if (a.i === b.i) return h("td", { class: "s", title: t("같은 손") }, "–");
        return h("td", { class: c > 0 ? "w" : c < 0 ? "l" : "", title: V.sentence(a.i, b.i) }, c > 0 ? t("승") : c < 0 ? t("패") : t("무"));
      }),
    ),
  );
  return h(
    "table",
    { class: "grid" },
    h("caption", { class: "sr" }, t("판정표: 줄이 내 손, 칸이 상대 손")),
    h("thead", {}, head),
    h("tbody", {}, rows),
  );
}

function howBlock(V) {
  const withHow = V.hands.filter((hd) => hd.how);
  if (!withHow.length) return null;
  return block(
    t("손 모양"),
    h(
      "ul",
      { class: "howlist" },
      withHow.map((hd) => h("li", {}, handArt(hd, "e"), h("span", {}, h("b", {}, hd.name), ` ${hd.how}`))),
    ),
  );
}

function strategyBlock(V) {
  const eq = V.equilibrium;
  if (eq.uniform) {
    return block(
      t("내는 방법"),
      h(
        "p",
        {},
        t("모든 손을 똑같이 {p}씩 섞어 내면 됩니다. 그러면 상대가 무엇을 내든 길게 보면 이기는 판과 지는 판이 같아집니다. ", { p: frac(1 / V.n) }) +
          t("대신 상대에게 버릇이 있으면 그 버릇을 노려야 이깁니다. '컴퓨터 전략'에서 고집이나 돌림처럼 버릇 있는 상대를 골라 보십시오."),
      ),
    );
  }
  const zero = V.hands.filter((hd) => eq.mix[hd.i] < 1e-9).map((hd) => lower(hd.name, hd.proper));
  return block(
    t("내는 방법"),
    h("p", {}, t("이 변종은 고르지 않아서 손마다 낼 비율이 다릅니다. 선형 계획법으로 구한 최적 비율은 이렇습니다.")),
    mixBar(V, eq.mix),
    zero.length
      ? h("p", { class: "note" }, h("b", {}, t("{z:은는} 내지 않습니다.", { z: listWords(zero) })), t(" 어떤 손을 만나도 다른 손보다 낫지 않기 때문입니다."))
      : null,
  );
}

function akaBlock(entry) {
  if (!entry.aka) return null;
  return block(
    t("다른 이름"),
    h(
      "dl",
      { class: "aka" },
      entry.aka.map(([name, where]) => [h("dt", {}, where), h("dd", { lang: scriptLang(name) }, name)]),
    ),
  );
}
