// 한 판짜리 변종 화면: 고리 그림 + 컴퓨터와 겨루기 + 규칙·전략.

import { h, clear, frac, append } from "../ui/dom.js";
import { compileVariant } from "../core/engine.js";
import { BOTS, createBot } from "../core/bots.js";
import { makeRng } from "../core/rng.js";
import { createMatch, FORMATS, formatById } from "../games/match.js";
import { createRing } from "../ui/ring.js";
import { handGrid, selectBox, segmented, stage, chant, fastToggle, RESULT_WORD, mixBar, block, recordLine } from "../ui/widgets.js";
import { addRecord, record, setting, setSetting } from "../ui/store.js";
import { entryHead, entryBody, scoreboard, histItem } from "./common.js";
import { josa } from "../core/josa.js";

const CLASSIC_IDS = ["scissors", "rock", "paper"];

export function chantWords(V) {
  const ids = V.hands.map((x) => x.id);
  if (V.n === 3 && CLASSIC_IDS.every((id) => ids.includes(id))) return ["가위!", "바위!", "보!"];
  return ["하나!", "둘!", "셋!"];
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
  const hist = h("ol", { class: "hist", "aria-label": "지난 판" });
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
    label: "컴퓨터 전략",
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
    label: "판",
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
    st.sub(fmt.target === Infinity ? "끝없이 겨룬다. 몇 판이든 해 보자." : `먼저 ${fmt.target}번 이기면 끝난다. 비긴 판은 세지 않는다.`);
    ring.clear();
    updateScore();
  }

  function updateScore() {
    const t = fmt.target === Infinity ? `${match.rounds.length}판째` : `먼저 ${fmt.target}승`;
    score.set(match.score[0], match.score[1], t);
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
    st.sub(r.cmp === 0 ? (i === j ? `둘 다 ${V.hands[i].name}. 다시 낸다.` : `${r.sentence}. 다시 낸다.`) : `${r.sentence}.`);
    st.me.mark(r.cmp > 0 ? "won" : r.cmp < 0 ? "lost" : null);
    st.op.mark(r.cmp < 0 ? "won" : r.cmp > 0 ? "lost" : null);
    ring.bout(i, j);
    updateScore();
    hist.prepend(histItem(V, i, j, r.cmp));
    while (hist.children.length > 16) hist.lastChild.remove();
    rec.textContent = recordLine(addRecord(recordId, r.cmp));
    if (match.done) {
      const won = match.winner === 0;
      clear(doneBar).append(
        h("strong", {}, won ? `${fmt.name} 승리` : `${fmt.name} 패배`),
        h("button", { class: "btn btn-ink", type: "button", onclick: newMatch }, "새 경기"),
      );
      doneBar.hidden = false;
    } else {
      grid.lock(false);
    }
    busy = false;
  }

  const k = V.beats(0).length;
  const facts = [
    ["손", `${V.n}개`],
    ["아무렇게나 낼 때 비길 확률", frac(drawChance(V))],
    ["판", V.balanced ? `고르다, 저마다 ${k}개를 이긴다` : "고르지 않다"],
  ];

  const playPanel = h(
    "section",
    { class: "panel", "aria-label": "컴퓨터와 겨루기" },
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
    h("p", { class: "ring-note" }, "화살표는 이기는 손에서 지는 손으로 간다. 손을 짚으면 그 손이 이기는 쪽은 그 손 색으로, 지는 쪽은 진하게 보인다." + (hasDraws(V) ? " 선이 없는 두 손은 비긴다." : "")),
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
  const items = V.hands.map((hd) => {
    const w = V.beats(hd.i);
    const l = V.beatenBy(hd.i);
    return h(
      "li",
      {},
      h("span", { class: "e", "aria-hidden": "true" }, hd.emoji),
      h(
        "span",
        {},
        h("b", {}, hd.name),
        " ",
        w.length ? `${josa(w.map((x) => V.hands[x].name).join(", "), "을를")} 이긴다. ` : "",
        l.length ? `${l.map((x) => V.hands[x].name).join(", ")}에 진다.` : "",
      ),
    );
  });
  const parts = [h("ul", { class: "relist" }, items)];
  if (V.n <= 9) parts.push(h("div", { class: "table-wrap" }, matrixTable(V)));
  return block("누가 누구를 이기나", ...parts);
}

function matrixTable(V) {
  const head = h(
    "tr",
    {},
    h("th", { scope: "col" }, h("span", { class: "sr" }, "내 손 / 상대 손")),
    V.hands.map((hd) => h("th", { scope: "col", class: "e", title: hd.name }, hd.emoji)),
  );
  const rows = V.hands.map((a) =>
    h(
      "tr",
      {},
      h("th", { scope: "row", class: "e", title: a.name }, a.emoji),
      V.hands.map((b) => {
        const c = V.cmp(a.i, b.i);
        if (a.i === b.i) return h("td", { class: "s", title: "같은 손" }, "–");
        return h("td", { class: c > 0 ? "w" : c < 0 ? "l" : "", title: V.sentence(a.i, b.i) }, c > 0 ? "승" : c < 0 ? "패" : "무");
      }),
    ),
  );
  return h(
    "table",
    { class: "grid" },
    h("caption", { class: "sr" }, "판정표: 줄이 내 손, 칸이 상대 손"),
    h("thead", {}, head),
    h("tbody", {}, rows),
  );
}

function howBlock(V) {
  const withHow = V.hands.filter((hd) => hd.how);
  if (!withHow.length) return null;
  return block(
    "손 모양",
    h(
      "ul",
      { class: "howlist" },
      withHow.map((hd) => h("li", {}, h("span", { class: "e", "aria-hidden": "true" }, hd.emoji), h("span", {}, h("b", {}, hd.name), ` ${hd.how}`))),
    ),
  );
}

function strategyBlock(V) {
  const eq = V.equilibrium;
  if (eq.uniform) {
    return block(
      "어떻게 내야 할까",
      h(
        "p",
        {},
        `모든 손을 똑같이 ${frac(1 / V.n)}씩 섞어 내면 된다. 그러면 상대가 무엇을 내든 길게 보면 이기는 판과 지는 판이 같아진다. ` +
          "대신 상대에게 버릇이 있으면 그걸 노려야 이긴다. '컴퓨터 전략'에서 고집이나 돌림처럼 버릇 있는 상대를 골라 보자.",
      ),
    );
  }
  const zero = V.hands.filter((hd) => eq.mix[hd.i] < 1e-9).map((hd) => hd.name);
  return block(
    "어떻게 내야 할까",
    h("p", {}, "이 판은 고르지 않아서 손마다 내야 할 몫이 다르다. 선형 계획법으로 푼 최적 섞기는 이렇다."),
    mixBar(V, eq.mix),
    zero.length
      ? h("p", { class: "note" }, h("b", {}, `${josa(zero.join(", "), "은는")} 내지 않는다.`), " 어떤 손을 만나도 다른 손보다 못하거나 같기 때문이다.")
      : null,
  );
}

function akaBlock(entry) {
  if (!entry.aka) return null;
  return block(
    "다른 이름",
    h(
      "dl",
      { class: "aka" },
      entry.aka.map(([name, where]) => [h("dt", {}, where), h("dd", {}, name)]),
    ),
  );
}
