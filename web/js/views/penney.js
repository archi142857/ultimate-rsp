// 동전 순서 겨루기(Penney's game) 화면. 앞뒤 세 개짜리 순서를 하나씩 고르고, 동전을 던져 먼저 나온 쪽이 이긴다.

import { h, clear, pct, sleep, reducedMotion } from "../ui/dom.js";
import { t } from "../i18n.js";
import { makeRng } from "../core/rng.js";
import { createPenney, penneyPick, allSequences, bestReply, firstChance } from "../games/penney.js";
import { fastMode, block, segmented, recordLine } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, stepList, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";
import { sfx } from "../sound/index.js";

const SEQS = allSequences(3);

/** 동전 하나: 앞(H)·뒤(T) */
export function coin(c, cls = "") {
  return h("span", { class: `coin coin-${c.toLowerCase()}${cls ? ` ${cls}` : ""}`, "aria-hidden": "true" }, c === "H" ? t("@coin:앞") : t("@coin:뒤"));
}
/** 순서를 읽는 말(화면 낭독용, 글로 쓸 때도) */
export function seqWords(seq) {
  return [...seq].map((c) => (c === "H" ? t("@coin:앞") : t("@coin:뒤"))).join("");
}
function seqEl(seq, cls = "") {
  return h("span", { class: "seq" + (cls ? ` ${cls}` : ""), role: "img", "aria-label": seqWords(seq) }, [...seq].map((c) => coin(c)));
}

export function penneyView(main, entry) {
  const rng = makeRng();
  let first = "op"; // 먼저 고르는 쪽
  let game = null;
  let busy = false;
  const wins = [0, 0];

  const score = scoreboard();
  const steps = stepList([t("앞앞뒤처럼 앞뒤 세 개의 순서를 하나씩 고름"), t("동전을 계속 던짐"), t("고른 순서가 먼저 나온 쪽이 이김")]);
  const picks = h("div", { class: "seq-picks" });
  const vs = h("div", { class: "seq-vs", "aria-live": "polite" });
  const flips = h("div", { class: "flips", "aria-label": t("던진 동전") });
  const msg = h("p", { class: "note note-top" });
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("penney")));
  const throwBtn = h("button", { class: "btn btn-ink btn-big", type: "button", hidden: true, onclick: () => run() }, t("동전 던지기"));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const buttons = SEQS.map((s) => h("button", { type: "button", class: "pick pick-seq", "aria-label": seqWords(s), onclick: () => choose(s) }, seqEl(s)));
  picks.append(...buttons);

  const fSeg = segmented({
    label: t("먼저 고르기"),
    small: true,
    value: first,
    options: [
      { id: "op", name: t("컴퓨터") },
      { id: "me", name: t("나") },
    ],
    onChange: (v) => ((first = v), newGame()),
  });

  function drawVs() {
    const [a, b] = game.picks;
    clear(vs).append(
      h("div", { class: "seq-side me" }, h("span", { class: "seq-who" }, t("나")), a ? seqEl(a) : h("span", { class: "seq-empty" }, t("고르는 중"))),
      h("div", { class: "seq-odds" }, a && b ? t("내가 이길 확률 {p}", { p: pct(firstChance(a, b)) }) : ""),
      h("div", { class: "seq-side op" }, h("span", { class: "seq-who" }, t("컴퓨터")), b ? seqEl(b) : h("span", { class: "seq-empty" }, first === "me" ? t("내가 고른 뒤에 고름") : "")),
    );
  }

  function newGame() {
    game = createPenney();
    busy = false;
    doneBar.hidden = true;
    throwBtn.hidden = true;
    clear(flips);
    if (first === "op") game.pick(1, penneyPick(rng));
    buttons.forEach((b, i) => {
      b.disabled = SEQS[i] === game.picks[1];
      b.setAttribute("aria-pressed", "false");
      b.inert = false;
    });
    picks.hidden = false;
    msg.textContent = first === "op" ? t("컴퓨터가 먼저 고름. 그 순서를 보고 내 순서 고르기") : t("내가 먼저 고름. 컴퓨터는 내 순서를 보고 고름");
    score.set(wins[0], wins[1], t("이긴 판"));
    steps.set(0);
    drawVs();
  }

  function choose(s) {
    if (busy || game.picks[0] || s === game.picks[1]) return;
    game.pick(0, s);
    if (!game.picks[1]) game.pick(1, penneyPick(rng, s));
    buttons.forEach((b, i) => {
      b.setAttribute("aria-pressed", String(SEQS[i] === s));
      b.inert = true;
    });
    picks.hidden = true;
    throwBtn.hidden = false;
    throwBtn.focus({ preventScroll: true });
    const p = firstChance(game.picks[0], game.picks[1]);
    msg.textContent = p > 0.5 ? t("내 순서가 유리") : p < 0.5 ? t("내 순서가 불리. 컴퓨터 순서가 먼저 나오기 쉬움") : t("반반");
    steps.set(1);
    drawVs();
  }

  async function run() {
    if (busy || game.done) return;
    busy = true;
    throwBtn.hidden = true;
    const g = game;
    const quick = fastMode() || reducedMotion();
    while (!g.done) {
      const c = rng.chance(0.5) ? "H" : "T";
      g.flip(c);
      flips.append(coin(c, "in"));
      if (!quick) await sleep(170);
      if (game !== g) return;
    }
    // 이긴 순서를 표시
    const coins = [...flips.children];
    coins.slice(-3).forEach((el) => el.classList.add(g.winner === 0 ? "hit-me" : "hit-op"));
    wins[g.winner] += 1;
    const won = g.winner === 0;
    sfx(won ? "win" : "lose");
    const seq = g.picks[g.winner];
    msg.textContent = won
      ? t("{n}번 만에 내 순서 {s:이가} 나옴", { n: g.flips.length, s: seqWords(seq) })
      : t("{n}번 만에 컴퓨터 순서 {s:이가} 나옴", { n: g.flips.length, s: seqWords(seq) });
    log.add(t("{a} 대 {b}: {n}번 던져 {who} 승리", { a: seqWords(g.picks[0]), b: seqWords(g.picks[1]), n: g.flips.length, who: won ? t("내가") : t("컴퓨터가") }), won ? "w" : "l");
    rec.textContent = recordLine(addRecord("penney", won ? 1 : -1));
    score.set(wins[0], wins[1], t("이긴 판"));
    steps.set(2);
    clear(doneBar).append(h("strong", {}, won ? t("승리!") : t("패배")), h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")));
    doneBar.hidden = false;
    busy = false;
  }

  const table = h(
    "table",
    { class: "seq-table" },
    h("thead", {}, h("tr", {}, h("th", {}, t("상대 순서")), h("th", {}, t("맞설 순서")), h("th", {}, t("이길 확률")))),
    h(
      "tbody",
      {},
      SEQS.map((s) => {
        const r = bestReply(s);
        return h("tr", {}, h("td", {}, seqEl(s)), h("td", {}, seqEl(r)), h("td", {}, pct(firstChance(r, s))));
      }),
    ),
  );
  const side = h(
    "div",
    { class: "side-panel" },
    block(t("하는 법"), steps.el),
    block(
      t("나중에 고르는 쪽이 유리"),
      h("p", {}, t("상대 순서의 가운데 것을 뒤집어 맨 앞에 두고, 그 뒤에 상대 순서의 앞 두 개를 붙이면 됩니다.")),
      table,
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("{name} 하기", { name: entry.name }) },
    h("div", { class: "controls" }, fSeg.el),
    score.el,
    vs,
    msg,
    picks,
    throwBtn,
    flips,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return {
    onKey(e) {
      if (e.key === "Enter" && !throwBtn.hidden) {
        run();
        return true;
      }
      return false;
    },
    destroy: () => (busy = true),
  };
}
