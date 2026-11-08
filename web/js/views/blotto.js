// 블로토 대령 화면. 병사 10명을 싸움터 3곳에 나눠 보내고, 싸움터를 더 많이 가진 쪽이 그 판을 이긴다.

import { h, clear } from "../ui/dom.js";
import { t } from "../i18n.js";
import { makeRng } from "../core/rng.js";
import { createBlotto, blottoPick } from "../games/blotto.js";
import { chant, fastToggle, block, recordLine, countChant, stage } from "../ui/widgets.js";
import { entryHead, entryBody, scoreboard } from "./common.js";
import { flowLayout, stepList, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

const FIELDS = 3;
const TROOPS = 10;
const TARGET = 3;

export function blottoView(main, entry) {
  const rng = makeRng();
  let game = null;
  let busy = false;
  let mine = [3, 3, 4];

  const score = scoreboard();
  const st = stage();
  st.el.classList.add("stage-solo");
  const steps = stepList([t("병사 10명을 싸움터 3곳에 몰래 나눈다"), t("싸움터마다 많이 보낸 쪽이 차지한다"), t("싸움터를 더 많이 가진 쪽이 그 판을 이긴다")]);
  const left = h("p", { class: "blotto-left", "aria-live": "polite" });
  const fields = h("div", { class: "blotto", role: "group", "aria-label": t("싸움터") });
  const log = logList();
  const rec = h("p", { class: "rec" }, recordLine(record("blotto")));
  const go = h("button", { class: "btn btn-ink btn-big", type: "button", onclick: () => play() }, t("보내기"));
  const doneBar = h("div", { class: "done-bar", hidden: true });
  let lastRound = null;

  const sum = () => mine.reduce((a, b) => a + b, 0);

  function draw() {
    const rest = TROOPS - sum();
    left.textContent = rest > 0 ? t("남은 병사 {n}명", { n: rest }) : rest < 0 ? t("{n}명 넘었다", { n: -rest }) : t("{n}명을 다 나눴다", { n: TROOPS });
    left.classList.toggle("bad", rest !== 0);
    clear(fields).append(
      ...mine.map((x, i) => {
        const r = lastRound;
        const theirs = r ? r.b[i] : null;
        const res = r ? Math.sign(r.a[i] - r.b[i]) : null;
        return h(
          "div",
          { class: "field-box" + (res === 1 ? " won" : res === -1 ? " lost" : "") },
          h("span", { class: "field-name" }, t("싸움터 {n}", { n: i + 1 })),
          h(
            "div",
            { class: "stepper" },
            h("button", { type: "button", class: "btn step", "aria-label": t("싸움터 {n}에서 한 명 빼기", { n: i + 1 }), disabled: busy || game.done || x <= 0, onclick: () => bump(i, -1) }, "−"),
            h("b", { class: "troops", "aria-label": t("싸움터 {n}: {x}명", { n: i + 1, x }) }, String(x)),
            h("button", { type: "button", class: "btn step", "aria-label": t("싸움터 {n}에 한 명 더", { n: i + 1 }), disabled: busy || game.done || TROOPS - sum() <= 0, onclick: () => bump(i, 1) }, "+"),
          ),
          h("span", { class: "field-op" }, theirs === null ? t("컴퓨터 ?") : t("컴퓨터 {n}", { n: theirs })),
        );
      }),
    );
    go.disabled = busy || game.done || sum() !== TROOPS;
  }

  function bump(i, d) {
    if (busy || game.done) return;
    const next = mine[i] + d;
    if (next < 0 || (d > 0 && sum() >= TROOPS)) return;
    mine[i] = next;
    lastRound = null;
    draw();
  }

  function newGame() {
    game = createBlotto({ fields: FIELDS, troops: TROOPS, target: TARGET });
    busy = false;
    lastRound = null;
    doneBar.hidden = true;
    log.clear();
    st.say("");
    st.sub(t("나눌 병사를 정하고 보내자."));
    score.set(0, 0, t("{n}판 먼저", { n: TARGET }));
    steps.set(0);
    draw();
  }

  async function play() {
    if (busy || game.done || sum() !== TROOPS) return;
    busy = true;
    lastRound = null;
    draw();
    await chant(st, countChant());
    const theirs = blottoPick(rng, FIELDS, TROOPS);
    const r = game.play(mine.slice(), theirs);
    lastRound = r;
    const [a, b] = r.won;
    st.say(r.cmp > 0 ? t("이 판은 내가") : r.cmp < 0 ? t("이 판은 컴퓨터가") : t("비겼다"), r.cmp > 0 ? "win" : r.cmp < 0 ? "lose" : "");
    st.sub(t("싸움터 {a}곳 대 {b}곳", { a, b }));
    log.add(t("나 {x}, 컴퓨터 {y}: {a}곳 대 {b}곳.", { x: r.a.join("·"), y: r.b.join("·"), a, b }), r.cmp > 0 ? "w" : r.cmp < 0 ? "l" : "");
    score.set(game.score[0], game.score[1], t("{n}판 먼저", { n: TARGET }));
    steps.set(game.done ? 2 : 1);
    if (game.done) {
      const won = game.winner === 0;
      rec.textContent = recordLine(addRecord("blotto", won ? 1 : -1));
      clear(doneBar).append(
        h("strong", {}, won ? t("{n}판 먼저 이겼다", { n: TARGET }) : t("컴퓨터가 {n}판 먼저 이겼다", { n: TARGET })),
        h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")),
      );
      doneBar.hidden = false;
    }
    busy = false;
    draw();
  }

  const side = h(
    "div",
    { class: "side-panel" },
    block(t("하는 법"), steps.el),
    h(
      "p",
      { class: "note" },
      h("b", {}, t("늘 이기는 나눔은 없다. ")),
      t("3·3·4로 고르게 나누면 4·4·2에 지고, 4·4·2는 5·5·0에, 5·5·0은 6·0·4에 진다. 어떤 나눔이든 그걸 이기는 나눔이 있다. 컴퓨터는 계산해 둔 비율대로 섞어 나눈다."),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("{name} 하기", { name: entry.name }) },
    h("div", { class: "controls" }, fastToggle()),
    score.el,
    st.el,
    fields,
    left,
    go,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return {
    onKey(e) {
      if (e.key === "Enter" && !go.disabled) {
        play();
        return true;
      }
      return false;
    },
    destroy: () => (busy = true),
  };
}
