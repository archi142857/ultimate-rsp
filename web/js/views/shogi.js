// 가위바위보 장기 화면. 가로 3칸 × 세로 4칸 판. 내 말(아래)을 눌러 갈 칸을 고르거나, 손에 든 말을 빈칸에 놓는다.

import { h, clear, sleep } from "../ui/dom.js";
import { t } from "../i18n.js";
import { handArt } from "../ui/art.js";
import { compileVariant } from "../core/engine.js";
import { makeRng } from "../core/rng.js";
import { findEntry } from "../data/catalog.js";
import { createShogi, shogiPick, sameMove, stepsOf, SHOGI_W, SHOGI_H } from "../games/shogi.js";
import { block, segmented, recordLine } from "../ui/widgets.js";
import { entryHead, entryBody } from "./common.js";
import { flowLayout, logList } from "./flow.js";
import { addRecord, record } from "../ui/store.js";

const KING = { id: "king", art: "king", emoji: "🤴", name: "" };

export function shogiView(main, entry) {
  const V = compileVariant(findEntry("classic"));
  const rng = makeRng();
  let depth = 3;
  let game = null;
  let busy = false;
  let sel = null; // { kind: "move", from } | { kind: "drop", type }
  let last = null; // 마지막 수

  const names = () => ({ rock: V.hands[V.index.rock].name, scissors: V.hands[V.index.scissors].name, paper: V.hands[V.index.paper].name, king: t("왕") });
  const handOf = (type) => (type === "king" ? KING : V.hands[V.index[type]]);
  const msg = h("p", { class: "shogi-msg", "aria-live": "polite" });
  const board = h("div", { class: "shogi-board", role: "grid", "aria-label": t("장기판") });
  const myHand = h("div", { class: "shogi-hand me", role: "group", "aria-label": t("내 손에 든 말") });
  const opHand = h("div", { class: "shogi-hand op", "aria-label": t("컴퓨터 손에 든 말") });
  const log = logList({ max: 10 });
  const rec = h("p", { class: "rec" });
  const doneBar = h("div", { class: "done-bar", hidden: true });

  const dSeg = segmented({
    label: t("컴퓨터 수 읽기"),
    small: true,
    value: String(depth),
    options: [
      { id: "2", name: t("한 수") },
      { id: "3", name: t("두 수") },
      { id: "4", name: t("세 수") },
    ],
    onChange: (v) => ((depth = Number(v)), newGame()),
  });

  const key = () => `shogi-${depth}`;
  const cellName = (x, y) => `${"ABC"[x]}${SHOGI_H - y}`; // 칸 이름: 왼쪽부터 A·B·C, 아래부터 1~4

  function pieceEl(p, small = false) {
    return h("span", { class: `shogi-piece ${p.owner === 0 ? "me" : "op"}${small ? " under" : ""}`, "aria-hidden": "true" }, handArt(handOf(p.type)));
  }
  function describe(stack) {
    if (!stack.length) return t("빈칸");
    const who = (p) => (p.owner === 0 ? t("내 {p}", { p: names()[p.type] }) : t("컴퓨터 {p}", { p: names()[p.type] }));
    const top = stack[stack.length - 1];
    return stack.length > 1 ? t("{a}, 아래에 {b}", { a: who(top), b: who(stack[0]) }) : who(top);
  }

  /** 지금 고른 것으로 갈 수 있는 칸 */
  function targets() {
    if (!sel || game.turn !== 0 || game.done) return [];
    return game
      .moves()
      .filter((m) => (sel.kind === "move" ? m.kind === "move" && m.from[0] === sel.from[0] && m.from[1] === sel.from[1] : m.kind === "drop" && m.type === sel.type))
      .map((m) => m.to);
  }

  function draw() {
    const g = game;
    const tg = targets();
    const isTarget = (x, y) => tg.some(([a, b]) => a === x && b === y);
    const lastCells = last ? [last.move.to, last.move.kind === "move" ? last.move.from : null].filter(Boolean) : [];
    clear(board);
    for (let y = 0; y < SHOGI_H; y++)
      for (let x = 0; x < SHOGI_W; x++) {
        const stack = g.board[y][x];
        const top = stack[stack.length - 1];
        const mine = top && top.owner === 0;
        const selected = sel && sel.kind === "move" && sel.from[0] === x && sel.from[1] === y;
        const cls = ["shogi-cell"];
        if (isTarget(x, y)) cls.push("target");
        if (selected) cls.push("selected");
        if (lastCells.some(([a, b]) => a === x && b === y)) cls.push("last");
        if (stack.length > 1) cls.push("stacked");
        board.append(
          h(
            "button",
            {
              type: "button",
              class: cls.join(" "),
              role: "gridcell",
              "aria-label": `${cellName(x, y)}: ${describe(stack)}${isTarget(x, y) ? `, ${t("갈 수 있다")}` : ""}`,
              "aria-pressed": selected ? "true" : undefined,
              disabled: busy || g.done || g.turn !== 0 || !(mine || isTarget(x, y)),
              onclick: () => click(x, y),
            },
            stack.length > 1 ? pieceEl(stack[0], true) : null,
            top ? pieceEl(top) : null,
            top && mine && selected ? dots(top) : null,
          ),
        );
      }
    const handRow = (side, el) => {
      const hd = g.hands[side];
      const items = ["rock", "scissors", "paper"].filter((tp) => hd[tp] > 0);
      clear(el).append(
        h("span", { class: "shogi-hand-who" }, side === 0 ? t("내 손") : t("컴퓨터 손")),
        ...(items.length
          ? items.map((tp) =>
              side === 0
                ? h(
                    "button",
                    {
                      type: "button",
                      class: "shogi-drop" + (sel && sel.kind === "drop" && sel.type === tp ? " selected" : ""),
                      disabled: busy || g.done || g.turn !== 0,
                      "aria-label": t("{p} 놓기, {n}개", { p: names()[tp], n: hd[tp] }),
                      onclick: () => pickDrop(tp),
                    },
                    pieceEl({ type: tp, owner: 0 }),
                    h("b", {}, `×${hd[tp]}`),
                  )
                : h("span", { class: "shogi-drop" }, pieceEl({ type: tp, owner: 1 }), h("b", {}, `×${hd[tp]}`)),
            )
          : [h("span", { class: "muted" }, t("없음"))]),
      );
    };
    handRow(0, myHand);
    handRow(1, opHand);
  }

  /** 고른 말이 갈 수 있는 방향(작은 점으로) */
  function dots(p) {
    return h(
      "span",
      { class: "shogi-dirs", "aria-hidden": "true" },
      stepsOf(p.type, 0).map(([dx, dy]) => h("i", { style: { left: `${50 + dx * 38}%`, top: `${50 + dy * 38}%` } })),
    );
  }

  function say(text) {
    msg.textContent = text;
  }

  function newGame() {
    game = createShogi();
    busy = false;
    sel = null;
    last = null;
    doneBar.hidden = true;
    log.clear();
    rec.textContent = recordLine(record(key()));
    say(t("내 차례. 움직일 말을 누르자. 상대 왕을 잡으면 이긴다."));
    draw();
  }

  function pickDrop(tp) {
    if (busy || game.done || game.turn !== 0) return;
    sel = sel && sel.kind === "drop" && sel.type === tp ? null : { kind: "drop", type: tp };
    say(sel ? t("{p:을를} 놓을 빈칸을 누르자.", { p: names()[tp] }) : t("내 차례."));
    draw();
  }

  function click(x, y) {
    if (busy || game.done || game.turn !== 0) return;
    const tg = targets();
    if (sel && tg.some(([a, b]) => a === x && b === y)) {
      const move = sel.kind === "move" ? { kind: "move", from: sel.from, to: [x, y] } : { kind: "drop", type: sel.type, to: [x, y] };
      if (game.moves().some((m) => sameMove(m, move))) return commit(move);
    }
    const stack = game.board[y][x];
    const top = stack[stack.length - 1];
    if (top && top.owner === 0) {
      const same = sel && sel.kind === "move" && sel.from[0] === x && sel.from[1] === y;
      sel = same ? null : { kind: "move", from: [x, y] };
      const can = sel ? targets().length : 0;
      say(sel ? (can ? t("{p:이가} 갈 칸을 누르자.", { p: names()[top.type] }) : t("이 말은 지금 갈 데가 없다.")) : t("내 차례."));
      draw();
    }
  }

  function line(r) {
    const who = r.by === 0 ? t("나") : t("컴퓨터");
    const p = names()[r.type];
    const to = cellName(r.move.to[0], r.move.to[1]);
    if (r.move.kind === "drop") return t("{who}: {p:을를} {to}에 놓았다.", { who, p, to });
    if (r.captured) return t("{who}: {p:이가} {to}의 {q:을를} 잡았다.", { who, p, to, q: names()[r.captured] });
    if (r.stacked) return t("{who}: {p:이가} {to}의 같은 말 위에 올라탔다.", { who, p, to });
    return t("{who}: {p:이가} {to:으로로} 갔다.", { who, p, to });
  }

  async function commit(move) {
    const g = game;
    busy = true;
    sel = null;
    last = g.play(move);
    log.add(line(last), last.captured ? "w" : "");
    draw();
    if (g.done) return finish();
    say(t("컴퓨터가 생각하는 중"));
    await sleep(350);
    if (game !== g) return;
    const reply = shogiPick(g, rng, depth);
    last = g.play(reply);
    log.add(line(last), last.captured ? "l" : "");
    busy = false;
    if (g.done) return finish();
    say(last.captured ? t("컴퓨터가 {q:을를} 잡았다. 내 차례.", { q: names()[last.captured] }) : t("내 차례."));
    draw();
  }

  function finish() {
    const g = game;
    busy = false;
    const won = g.winner === 0;
    const tie = g.winner === -1;
    const why =
      g.end === "king"
        ? won
          ? t("컴퓨터 왕을 잡았다!")
          : t("컴퓨터가 내 왕을 잡았다")
        : g.end === "repeat"
          ? t("같은 판이 세 번 나와 비겼다")
          : g.end === "plies"
            ? t("{n}수가 지나 비겼다", { n: g.maxPlies })
            : won
              ? t("컴퓨터가 둘 수가 없다")
              : t("둘 수가 없다");
    say(why);
    rec.textContent = recordLine(addRecord(key(), tie ? 0 : won ? 1 : -1));
    clear(doneBar).append(h("strong", {}, tie ? t("비겼다") : won ? t("이겼다!") : t("졌다")), h("button", { class: "btn btn-ink", type: "button", onclick: newGame }, t("한 판 더")));
    doneBar.hidden = false;
    draw();
  }

  const moveRow = (type, text) => h("li", {}, h("span", { class: "shogi-legend" }, handArt(handOf(type))), h("span", {}, text));
  const side = h(
    "div",
    { class: "side-panel" },
    block(
      t("말이 가는 곳"),
      h(
        "ul",
        { class: "shogi-moves" },
        moveRow("king", t("왕: 여덟 방향 한 칸. 무엇이든 잡지만 무엇에게든 잡힌다")),
        moveRow("rock", t("바위: 앞뒤옆 한 칸")),
        moveRow("scissors", t("가위: 대각선 한 칸")),
        moveRow("paper", t("보: 앞쪽 세 칸과 양옆")),
      ),
      h("p", {}, t("가위바위보로 이기는 말만 잡는다. 같은 말끼리는 위에 올라타고, 깔린 말은 못 움직인다. 잡은 말은 손에 들었다가 내 차례에 빈칸에 놓을 수 있다.")),
    ),
  );
  const panel = h(
    "section",
    { class: "panel", "aria-label": t("{name} 하기", { name: entry.name }) },
    h("div", { class: "controls" }, dSeg.el),
    opHand,
    board,
    myHand,
    msg,
    doneBar,
    log.el,
    rec,
  );
  main.append(entryHead(entry), flowLayout(side, panel), entryBody(entry));
  newGame();
  return {
    onKey(e) {
      if (e.key === "Escape" && sel) {
        sel = null;
        say(t("내 차례."));
        draw();
        return true;
      }
      return false;
    },
    destroy: () => (busy = true),
  };
}
