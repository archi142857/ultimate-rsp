// 이상한 주사위 화면. 주사위를 하나씩 고르고 10번 굴려 높은 수가 많이 나온 쪽이 이긴다.

import { h, clear, pct, sleep, reducedMotion } from "../ui/dom.js";
import { t } from "../i18n.js";
import { makeRng } from "../core/rng.js";
import { createDiceDuel, dicePick, duelOdds, bestDie, dieOf, DICE_SETS } from "../games/dice.js";
import { fastMode, block, segmented, recordLine } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, stepList, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";
import { sfx } from "../sound/index.js";

const ROLLS = 10;

/** 주사위 하나: 이름과 여섯 면 */
function dieEl(d, cls = "") {
  return h(
    "span",
    { class: "die" + (cls ? ` ${cls}` : ""), role: "img", "aria-label": t("주사위 {id}: {faces}", { id: d.id, faces: d.faces.join(", ") }) },
    h("b", { class: "die-id" }, d.id),
    h("span", { class: "die-faces", "aria-hidden": "true" }, d.faces.map((f) => h("span", { class: "pip" }, String(f)))),
  );
}

export function diceView(main, entry) {
  const rng = makeRng();
  let set = "efron";
  let count = 1;
  let first = "op";
  let game = null;
  let busy = false;
  const wins = [0, 0];

  const score = scoreboard();
  const steps = stepList([t("주사위를 하나씩 고름"), t("{n}번 같이 굴림", { n: ROLLS }), t("높은 수가 더 많이 나온 쪽이 이김")]);
  const picks = h("div", { class: "dice-picks" });
  const vs = h("div", { class: "seq-vs", "aria-live": "polite" });
  const msg = h("p", { class: "note note-top" });
  const rolls = h("ol", { class: "rolls", "aria-label": t("굴린 결과") });
  const log = logList();
  const rec = h("p", { class: "rec" });
  const rollBtn = h("button", { class: "btn btn-ink btn-big", type: "button", hidden: true, onclick: () => run() }, t("{n}번 굴리기", { n: ROLLS }));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  const relation = h("div", {});

  const setSeg = segmented({
    label: t("주사위 묶음"),
    small: true,
    value: set,
    options: [
      { id: "efron", name: t("Efron 4개") },
      { id: "grime", name: t("Grime 5개") },
    ],
    onChange: (v) => ((set = v), newGame()),
  });
  const cSeg = segmented({
    label: t("한 번에"),
    small: true,
    value: String(count),
    options: [
      { id: "1", name: t("하나씩") },
      { id: "2", name: t("둘씩 합") },
    ],
    onChange: (v) => ((count = Number(v)), newGame()),
  });
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

  const key = () => `dice-${set}-${count}`;

  function drawVs() {
    const [a, b] = game.dice;
    const odds = a && b ? duelOdds(dieOf(set, a), dieOf(set, b), count) : null;
    clear(vs).append(
      h("div", { class: "seq-side me" }, h("span", { class: "seq-who" }, t("나")), a ? dieEl(dieOf(set, a)) : h("span", { class: "seq-empty" }, t("고르는 중"))),
      h("div", { class: "seq-odds" }, odds ? t("한 번에 내가 이길 확률 {p}", { p: pct(odds.win) }) : ""),
      h("div", { class: "seq-side op" }, h("span", { class: "seq-who" }, t("컴퓨터")), b ? dieEl(dieOf(set, b)) : h("span", { class: "seq-empty" }, first === "me" ? t("내가 고른 뒤에 고름") : "")),
    );
  }

  function drawRelation() {
    const dice = DICE_SETS[set];
    clear(relation).append(
      h("p", {}, count === 1 ? t("주사위마다 그 주사위를 가장 잘 이기는 주사위:") : t("둘씩 굴려 합을 겨룰 때, 주사위마다 그 주사위를 가장 잘 이기는 주사위:")),
      h(
        "table",
        { class: "seq-table" },
        h("thead", {}, h("tr", {}, h("th", {}, t("상대 주사위")), h("th", {}, t("맞설 주사위")), h("th", {}, t("한 번에 이길 확률")))),
        h(
          "tbody",
          {},
          dice.map((d) => {
            const b = dieOf(set, bestDie(set, d.id, count));
            return h("tr", {}, h("td", {}, d.id), h("td", {}, b.id), h("td", {}, pct(duelOdds(b, d, count).win)));
          }),
        ),
      ),
    );
  }

  function newGame() {
    game = createDiceDuel({ set, count, rolls: ROLLS });
    busy = false;
    doneBar.hidden = true;
    rollBtn.hidden = true;
    clear(rolls);
    if (first === "op") game.choose(1, dicePick(rng, set, null, count));
    clear(picks).append(
      ...DICE_SETS[set].map((d) =>
        h("button", { type: "button", class: "pick pick-die", disabled: d.id === game.dice[1], "aria-label": t("주사위 {id}: {faces}", { id: d.id, faces: d.faces.join(", ") }), onclick: () => choose(d.id) }, dieEl(d)),
      ),
    );
    picks.hidden = false;
    msg.textContent = first === "op" ? t("컴퓨터가 먼저 고름. 그 주사위를 보고 내 주사위 고르기") : t("내가 먼저 고름. 컴퓨터는 내 주사위를 보고 고름");
    score.set(wins[0], wins[1], t("이긴 경기"));
    rec.textContent = recordLine(record(key()));
    steps.set(0);
    drawVs();
    drawRelation();
  }

  function choose(id) {
    if (busy || game.dice[0] || id === game.dice[1]) return;
    game.choose(0, id);
    if (!game.dice[1]) game.choose(1, dicePick(rng, set, id, count));
    picks.hidden = true;
    rollBtn.hidden = false;
    rollBtn.focus({ preventScroll: true });
    const o = duelOdds(dieOf(set, game.dice[0]), dieOf(set, game.dice[1]), count);
    msg.textContent = o.win > o.lose ? t("내 주사위가 유리") : o.win < o.lose ? t("내 주사위가 불리. 컴퓨터 주사위가 더 자주 이김") : t("반반");
    steps.set(1);
    drawVs();
  }

  async function run() {
    if (busy || game.done) return;
    busy = true;
    rollBtn.hidden = true;
    const g = game;
    const quick = fastMode() || reducedMotion();
    while (!g.done) {
      const r = g.roll(rng);
      const cls = r.cmp > 0 ? "w" : r.cmp < 0 ? "l" : "d";
      const show = (xs, sum) => (count === 1 ? String(sum) : `${xs.join("+")}=${sum}`);
      rolls.append(
        h(
          "li",
          { class: cls },
          h("span", { class: "roll-me" }, show(r.faces[0], r.sums[0])),
          h("span", { class: "roll-mid", "aria-hidden": "true" }, r.cmp > 0 ? ">" : r.cmp < 0 ? "<" : "="),
          h("span", { class: "roll-op" }, show(r.faces[1], r.sums[1])),
        ),
      );
      score.set(r.wins[0], r.wins[1], t("{n}/{m}번", { n: g.log.length, m: ROLLS }));
      if (!quick) await sleep(220);
      if (game !== g) return;
    }
    const won = g.winner === 0;
    const tie = g.winner === -1;
    sfx("result", tie ? 0 : won ? 1 : -1);
    if (!tie) wins[g.winner] += 1;
    msg.textContent = t("{a} 대 {b}, 비김 {d}번", { a: g.wins[0], b: g.wins[1], d: g.ties });
    log.add(t("{x} 대 {y}: {a} 대 {b}", { x: g.dice[0], y: g.dice[1], a: g.wins[0], b: g.wins[1] }), tie ? "" : won ? "w" : "l");
    rec.textContent = recordLine(addRecord(key(), tie ? 0 : won ? 1 : -1));
    score.set(wins[0], wins[1], t("이긴 경기"));
    steps.set(2);
    clear(doneBar).append(h("strong", {}, tie ? t("무승부") : won ? t("승리!") : t("패배")), h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")));
    doneBar.hidden = false;
    busy = false;
  }

  const side = h("div", { class: "side-panel" }, block(t("하는 법"), steps.el), block(t("나중에 고르는 쪽이 유리"), relation));
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("{name} 하기", { name: entry.name }) },
    h("div", { class: "controls" }, setSeg.el, cSeg.el, fSeg.el),
    score.el,
    vs,
    msg,
    picks,
    rollBtn,
    rolls,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return {
    onKey(e) {
      if (e.key === "Enter" && !rollBtn.hidden) {
        run();
        return true;
      }
      return false;
    },
    destroy: () => (busy = true),
  };
}
