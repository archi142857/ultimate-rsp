// 전략의 진화: Nicky Case 의 '신뢰의 진화'(The Evolution of Trust, 2017)처럼 장을 넘기며 직접 해 보는 이야기.
// 위쪽 탭 '전략의 진화'로 연다(주소 #/v/league, ?ch=0–10 으로 장을 바로 연다).
// 머리 아래 남은 화면이 무대다. 문서는 스크롤하지 않고, 무대를 화면에 맞춰 키우거나 줄여 장마다 모든 것이 한 화면에 보인다(사용자 11-12).
// 값·씨앗·글은 컨셉의 web/js/sims/evolution-story.js, 꼴은 디자인 '전략의 진화 시안'(① 책장 + ③ 만화).
// 장마다 할 일(kind): text 글만 · one 한 판 · duel 다섯 상대와 10판씩 · league 리그 한 번(걸기) ·
// evolve 세대 거듭 · choice 고르면 끝까지 · sandbox 놀이터

import { h, s, reducedMotion, sleep } from "../ui/dom.js";
import { t, num, lang } from "../i18n.js";
import { compileVariant } from "../core/engine.js";
import { botInfo } from "../core/bots.js";
import { randomSeed } from "../core/rng.js";
import { CATALOG, findEntry } from "../data/catalog.js";
import { handArt } from "../ui/art.js";
import { handGrid, selectBox, sourcesList, fastMode } from "../ui/widgets.js";
import { setting, setSetting } from "../ui/store.js";
import { createEvolution } from "../sims/evolution.js";
import { EVO_CHAPTERS, EVO_CAST, EVO_TEXT, EVO_LINES, evoSetup, leagueFor, opponentFor } from "../sims/evolution-story.js";

/** 인물 그림(web/icons/cast/). 그림을 바꾸면 올린다 */
const CAST_VERSION = "1";
const castUrl = (id) => new URL(`../../icons/cast/bot-${id}.svg?v=${CAST_VERSION}`, import.meta.url).href;
const MINUS = "−";
const fmt = (v) => (Number.isInteger(v) ? num(v) : v.toFixed(1));
/** +7 · 0 · −13 */
const signed = (v) => (v > 0 ? `+${fmt(v)}` : v < 0 ? `${MINUS}${fmt(-v)}` : "0");
const typing = (e) => {
  const el = e.target;
  return el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
};

// ── 작은 조각 ─────────────────
/** 얼굴 동그라미(테두리는 인물 색). q: 정체 모름, me: 나 */
function face(id, size, { q = false, me = false, badge = null } = {}) {
  const el = h("span", { class: "evo-face" + (q ? " q" : "") + (me ? " me" : ""), "data-bot": q || me ? undefined : id });
  if (size) el.style.setProperty("--s", `${size}px`);
  if (q) el.append(h("span", { "aria-hidden": "true" }, "?"));
  else if (me) el.append(h("span", { "aria-hidden": "true" }, t("나")));
  else el.append(h("img", { src: castUrl(id), alt: "", draggable: "false", decoding: "async" }));
  if (badge) el.append(sticker(badge, "evo-badge"));
  return el;
}
const sticker = (text, cls = "evo-tag") => h("span", { class: cls }, text);
/** 말풍선. dir: down(꼬리 아래), up(위), left(왼쪽) */
const bubble = (text, dir = "down") => h("span", { class: `evo-bub evo-bub-${dir}` }, text);
const card = (...children) => h("section", { class: "evo-card" }, ...children);
const cardTitle = (text, extra = null) => h("h2", { class: "evo-card-t" }, text, extra);
const botName = (id) => botInfo(id).name;

// ── 25명 고리 ─────────────────
/**
 * 사람들을 동그랗게 앉힌다(12시부터 시계 방향, 같은 전략끼리 붙어 앉는다).
 * 사람마다 key 가 있어 세대가 바뀌면 제자리에서 새 자리로 옮겨 간다.
 */
function peopleRing() {
  const genNum = h("b", { class: "evo-gen-n" });
  const genSub = h("small");
  const box = h("div", { class: "evo-ring" }, h("div", { class: "evo-gen", "aria-live": "polite" }, genNum, genSub));
  const els = new Map(); // key → 얼굴
  const at = new Map(); // key → [left, top] (%)

  function seat(p) {
    const el = face(p.id, 0);
    el.classList.add("evo-seat");
    el.setAttribute("title", botName(p.id));
    els.set(p.key, el);
    box.append(el);
    return el;
  }
  function place(el, key, x, y) {
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    at.set(key, [x, y]);
  }
  /** list 차례대로 앉힌다. 없어진 사람은 지운다 */
  function layout(list) {
    const n = list.length;
    // 얼굴 크기(고리 너비의 %): 25명이면 10%, 많으면 줄인다
    const size = Math.min(10, (100 * 0.93 * Math.PI) / (n + 0.93 * Math.PI));
    box.style.setProperty("--fs", `${size}%`);
    const r = 50 - size / 2 - 1.5;
    const keep = new Set(list.map((p) => p.key));
    for (const [k, el] of els) {
      if (!keep.has(k)) {
        el.remove();
        els.delete(k);
        at.delete(k);
      }
    }
    list.forEach((p, i) => {
      const el = els.get(p.key) || seat(p);
      const a = (2 * Math.PI * i) / n;
      place(el, p.key, 50 + r * Math.sin(a), 50 - r * Math.cos(a));
    });
  }
  return {
    el: box,
    els,
    layout,
    setGen(g, n) {
      genNum.textContent = t("{n}세대", { n: num(g) });
      genSub.textContent = t("@people:{n}명", { n: num(n) });
    },
    /** 한 세대 연출: 빠질 사람 흐림(−) → 1등들 +1 → 빠지고, 새 사람이 부모 옆에서 나와 다시 모여 앉는다 */
    async animate(prev, res, next, tops, speed, live) {
      box.style.setProperty("--t", `${Math.round(400 * speed)}ms`);
      if (speed > 0) {
        for (const i of res.out) {
          const el = els.get(prev[i].key);
          if (el) {
            el.classList.add("gone");
            el.append(sticker(MINUS, "evo-badge evo-badge-minus"));
          }
        }
        await sleep(300 * speed);
        if (!live()) return;
        for (const k of tops) els.get(k)?.append(sticker("+1", "evo-badge evo-badge-plus"));
        await sleep(300 * speed);
        if (!live()) return;
      }
      // 새 사람은 부모 자리에서 시작한다
      for (const p of next) {
        if (els.has(p.key)) continue;
        const el = seat(p);
        const from = p.from != null ? at.get(p.from) : null;
        if (from) place(el, p.key, from[0], from[1]);
        el.classList.add("born");
      }
      void box.offsetWidth; // 시작 자리를 먼저 그린다
      layout(next);
      if (speed > 0) await sleep(420 * speed);
      for (const el of els.values()) {
        el.classList.remove("born", "gone");
        el.querySelectorAll(".evo-badge").forEach((b) => b.remove());
      }
    },
  };
}

// ── 세대 그래프(쌓인 넓이) ─────────────────
function genChart() {
  const W = 300;
  const H = 120;
  const areas = s("g");
  const ticks = s("g", { class: "evo-ticks" });
  const svg = s("svg", { class: "evo-area", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", "aria-hidden": "true" }, s("rect", { class: "evo-area-bg", x: 0, y: 0, width: W, height: H }), areas, ticks);
  const left = h("span");
  const right = h("span");
  const legend = h("ul", { class: "evo-legend" });
  const el = h("div", { class: "evo-chart" }, svg, h("div", { class: "evo-axis" }, left, right), legend);
  let order = [];
  let maxGen = 10;
  return {
    el,
    reset(o, m) {
      order = o;
      maxGen = m;
      left.textContent = t("{n}세대", { n: 0 });
      right.textContent = t("{n}세대", { n: num(m) });
    },
    update(history) {
      const gens = history.slice(0, maxGen + 1);
      const total = Object.values(gens[0]).reduce((a, b) => a + b, 0) || 1;
      const x = (g) => ((g / maxGen) * W).toFixed(2);
      const y = (v) => (H - (v / total) * H).toFixed(2);
      areas.replaceChildren();
      if (gens.length > 1) {
        const below = gens.map(() => 0);
        for (const id of order) {
          const above = gens.map((c, g) => below[g] + (c[id] || 0));
          if (above.some((v, g) => v !== below[g])) {
            const pts = gens.map((_, g) => `${x(g)},${y(above[g])}`).concat(gens.map((_, g) => `${x(gens.length - 1 - g)},${y(below[gens.length - 1 - g])}`).filter(Boolean));
            areas.append(s("polygon", { points: pts.join(" "), style: { fill: `var(--c-${id})` } }));
          }
          above.forEach((v, g) => (below[g] = v));
        }
      }
      ticks.replaceChildren(...gens.slice(1, -1).map((_, i) => s("line", { x1: x(i + 1), x2: x(i + 1), y1: 0, y2: H, "vector-effect": "non-scaling-stroke" })));
      const now = gens[gens.length - 1];
      legend.replaceChildren(...order.map((id) => h("li", { "data-bot": id }, face(id, 18), h("span", {}, botName(id)), h("b", {}, num(now[id] || 0)))));
    },
  };
}

/**
 * 세대를 거듭하는 세상(4–9장): 고리 카드 + 그래프 카드.
 * reset(setup, V) 로 처음(0세대)으로, step(speed) 로 한 세대, run() 으로 끝까지(maxGen 이나 한 가지만 남을 때까지)
 */
function evoWorld(live) {
  const ring = peopleRing();
  const chart = genChart();
  const hint = h("p", { class: "evo-sm evo-center evo-hint" });
  const status = h("p", { class: "sr", "aria-live": "polite" });
  let evo = null;
  let people = [];
  let order = [];
  let max = 10;
  let key = 0;
  let busy = false; // 한 세대를 그리는 중
  let running = false; // 끝까지 도는 중
  let epoch = 0; // reset·stop 마다 하나씩: 그 전에 시작한 세대는 그리다 멈춘다
  const quick = () => reducedMotion() || fastMode();
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f());

  function arrange(prev, res) {
    const out = new Set(res.out);
    // 1등들: 남은 사람 가운데 점수가 높은 차례로, 새로 생긴 봇마다 한 명씩
    const ranked = prev.map((_, i) => i).filter((i) => !out.has(i));
    ranked.sort((a, b) => res.scores[b] - res.scores[a]);
    const used = new Set();
    const parents = res.born.map((id) => {
      const i = ranked.find((j) => !used.has(j) && prev[j].id === id);
      if (i === undefined) return null;
      used.add(i);
      return prev[i].key;
    });
    const keep = prev.filter((_, i) => !out.has(i));
    const add = res.born.map((id, k) => ({ key: ++key, id, from: parents[k] }));
    // createEvolution 과 같은 차례(같은 봇끼리, 안정 정렬). 어긋나면 새로 앉힌다
    const next = keep.concat(add).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    if (next.map((p) => p.id).join() !== evo.people.join()) return { next: evo.people.map((id) => ({ key: ++key, id })), tops: [] };
    return { next, tops: parents.filter((k) => k != null) };
  }
  const finished = () => !evo || evo.done || evo.generation >= max;
  function say() {
    const c = evo.counts();
    status.textContent = `${t("{n}세대", { n: num(evo.generation) })}: ${order.map((id) => `${botName(id)} ${num(c[id])}`).join(", ")}`;
  }
  /** 한 세대. speed 1 은 '한 세대' 단추, 작으면 빠르게(움직임 줄이기면 움직임 없이). 그렸으면 참 */
  async function step(speed) {
    if (finished() || busy) return false;
    busy = true;
    const ep = epoch;
    emit();
    await sleep(0); // 단추가 눌린 모습을 먼저 그린다
    if (ep !== epoch || !live()) return false;
    const prev = people;
    const res = evo.step();
    const { next, tops } = arrange(prev, res);
    people = next;
    await ring.animate(prev, res, next, tops, quick() ? 0 : speed, () => live() && ep === epoch);
    if (ep !== epoch || !live()) return false;
    ring.setGen(evo.generation, people.length);
    chart.update(evo.history);
    say();
    busy = false;
    emit();
    return true;
  }

  return {
    ring,
    chart,
    hint,
    status,
    get evo() {
      return evo;
    },
    get busy() {
      return busy || running;
    },
    finished,
    onChange(f) {
      listeners.add(f);
    },
    reset(setup, V) {
      epoch += 1;
      busy = false;
      running = false;
      order = Object.keys(setup.population);
      max = setup.maxGen;
      evo = createEvolution(V, setup.population, { rounds: setup.rounds, cull: setup.cull, noise: setup.noise, payoff: setup.payoff, seed: setup.seed });
      people = evo.people.map((id) => ({ key: ++key, id }));
      ring.el.style.setProperty("--t", "0ms");
      ring.layout(people);
      ring.setGen(0, people.length);
      chart.reset(order, max);
      chart.update(evo.history);
      const k = Math.max(0, Math.min(setup.cull, Math.floor(people.length / 2)));
      hint.textContent = t("흐려진 {n}명은 빠지고, +1이 붙은 {n}명과 같은 전략이 한 명씩 들어옵니다.", { n: num(k) });
      emit();
    },
    step: (speed = 1) => step(speed),
    /** 끝까지(maxGen 이나 한 가지만 남을 때까지) */
    async run() {
      if (running || busy) return;
      running = true;
      const ep = epoch;
      emit();
      try {
        while (live() && ep === epoch && !finished()) {
          if (!(await step(0.35))) break;
          if (quick()) await sleep(30);
        }
      } finally {
        if (ep === epoch) {
          running = false;
          emit();
        }
      }
    },
    stop() {
      epoch += 1;
      busy = false;
      running = false;
    },
  };
}


/** 고리 카드와 그래프 카드(놀이터는 이 둘을 따로 놓는다) */
function worldParts(world) {
  return {
    ringCard: h("section", { class: "evo-card evo-ringcard" }, world.ring.el, world.hint),
    chartCard: h("section", { class: "evo-card evo-chartcard" }, cardTitle(t("세대마다 사람 수")), world.chart.el),
  };
}
/** 고리 · 그래프 · 단추 줄. 넓은 화면은 고리 아래 단추, 좁은 화면은 고리와 작은 그래프를 나란히 두고 단추를 그 아래에 */
function worldBox(world, buttons) {
  const { ringCard, chartCard } = worldParts(world);
  return h("div", { class: "evo-world" }, ringCard, chartCard, buttons ? h("div", { class: "evo-btns" }, ...buttons) : null, world.status);
}

/** 탭 묶음. 칸들을 한 자리에 겹쳐 두어(보이는 칸만 바꾼다) 탭을 바꿔도 높이가 그대로다 */
let tabSeq = 0;
function tabsBox(items, first) {
  const base = `evo-tabs-${++tabSeq}`;
  const bar = h("div", { class: "evo-tabs", role: "tablist" });
  const panes = h("div", { class: "evo-panes" });
  let on = null;
  const list = items.map((it, k) => {
    const tab = h("button", { type: "button", role: "tab", class: "evo-tab", id: `${base}-t${k}`, "aria-controls": `${base}-p${k}`, onclick: () => select(it.id, true) }, it.label);
    const pane = h("div", { role: "tabpanel", class: "evo-pane", id: `${base}-p${k}`, "aria-labelledby": `${base}-t${k}` }, it.el);
    bar.append(tab);
    panes.append(pane);
    return { id: it.id, tab, pane };
  });
  bar.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const vis = list.filter((x) => !x.tab.hidden);
    const i = vis.findIndex((x) => x.id === on);
    const nx = vis[(i + (e.key === "ArrowRight" ? 1 : -1) + vis.length) % vis.length];
    select(nx.id, true);
    nx.tab.focus();
    e.preventDefault();
  });
  const api = {
    el: h("div", { class: "evo-tabbox" }, bar, panes),
    touched: false,
    get on() {
      return on;
    },
    select,
    /** 탭 하나를 보이거나 감춘다(감춘 칸은 높이에도 들지 않는다) */
    show(id, yes) {
      const x = list.find((y) => y.id === id);
      if (!x) return;
      x.tab.hidden = !yes;
      x.pane.hidden = !yes;
    },
  };
  function select(id, byUser = false) {
    on = id;
    for (const x of list) {
      const yes = x.id === id;
      x.tab.setAttribute("aria-selected", String(yes));
      x.tab.tabIndex = yes ? 0 : -1;
      x.pane.classList.toggle("on", yes);
    }
    if (byUser) api.touched = true;
  }
  select(first);
  return api;
}

/** 장 끝 해설 자리: 이 장에서 나올 수 있는 가장 긴 해설(상대·고른 결과 가운데 가장 긴 것 + 마무리)로 자리를 미리 잡는다 */
function narrGhost(tx) {
  const pool = [...Object.values(tx.foes || {}), ...Object.values(tx.choices || {}).map((c) => c.result)];
  const lines = [];
  if (pool.length) lines.push(pool.reduce((a, b) => (b.length > a.length ? b : a)));
  if (tx.end) lines.push(tx.end);
  return lines.length ? lines : null;
}

// ── 무대 ─────────────────
// 장마다 높이가 달라 장을 넘길 때마다 화면 전체 스크롤바가 생겼다 없어졌다 했다(사용자 11-12).
// '신뢰의 진화'처럼 머리 아래 남은 화면을 고정된 무대로 쓴다.
// - 배율 s: 넓은 화면은 논리 너비 1100·높이 600, 세로 화면은 너비 380·높이 560 이 들어가게(무대는 남은 화면을 꽉 채운다)
// - 장 배율 f: 그래도 장이 무대 칸보다 길면 그 장만 더 줄인다. 장 안에서 나중에 나오는 것(해설·결과·정체)은 자리를 미리 잡아 두어 f 가 흔들리지 않는다
const GEOM = {
  wide: { w: 1100, h: 600, max: 1.25 },
  tall: { w: 380, h: 560, max: 1.35 },
};
const WIDE_AT = 1.2; // 남은 화면의 가로 ÷ 세로가 이 이상이면 넓은 배치
const S_MIN = 0.5;
const ROTATE_AT = 0.7; // 손으로 쥔 기기가 가로인데 무대가 이보다 작으면 '세로로 돌리면' 띠를 한 번 띄운다(디자인 11-12)
const F_MIN = 0.6; // 이보다 더 줄여야 하면 더 줄이지 않고 장 칸 안에서 스크롤한다(아주 낮은 창)

// ── 이야기 전체 ─────────────────
export function evolutionStoryView(main, entry, params) {
  const V = compileVariant(findEntry("classic"));
  const LAST = EVO_CHAPTERS.length - 1;
  const T = EVO_TEXT[lang() === "en" ? "en" : "ko"];
  const done = new Set(); // 놀이를 끝낸 장(2·3장의 ▶ 를 켠다)
  const root = document.documentElement;
  let alive = true;
  let token = 0;
  let cur = null; // { n, api, slide, fit, f }
  let mode = null;

  const where = h("b");
  const body = h("div", { class: "evo-body" });
  const navBox = h("div", { class: "evo-navbox" });
  const page = h("article", { class: "evo-page" }, h("div", { class: "evo-top" }, h("span", { class: "evo-where" }, T.title, " · ", where)), body, navBox);
  const stage = h("div", { class: "evo-stage" }, page);
  // 폰 가로처럼 무대가 많이 작아질 때만 뜨는 띠(무대 밖이라 배율을 타지 않는다). 닫으면 다시 안 뜬다
  const rotate = h(
    "div",
    { class: "evo-rotate", hidden: true },
    h("span", {}, t("세로로 돌리면 더 크게 보입니다.")),
    h("button", { type: "button", class: "evo-rotate-x", "aria-label": t("알림 닫기"), onclick: () => (setSetting("evo.rotateHint", false), (rotate.hidden = true)) }, "×"),
  );
  const book = h("div", { class: "evo-book" }, stage, rotate);
  main.append(book);
  root.classList.add("evo-on");
  window.scrollTo(0, 0);

  const onKey = (e) => {
    if (typing(e) || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented || !cur) return;
    if (cur.api.key && cur.api.key(e)) {
      e.preventDefault();
      return;
    }
    // ← → 로 장을 넘긴다('신뢰의 진화'처럼, 검수 11-10). 탭 묶음 안의 화살표는 탭을 옮기고, 끝내야 열리는 장은 ▶ 와 같이 막는다
    if ((e.key !== "ArrowRight" && e.key !== "ArrowLeft") || e.shiftKey || e.repeat) return;
    if (e.target && e.target.closest && e.target.closest('[role="tablist"]')) return;
    if (e.key === "ArrowRight" && cur.n < LAST && !cur.next.disabled) go(cur.n + 1);
    else if (e.key === "ArrowLeft" && cur.n > 0) go(cur.n - 1);
    else return;
    e.preventDefault();
  };
  document.addEventListener("keydown", onKey);
  let settle = 0;
  const onResize = () => {
    if (!alive) return;
    book.classList.add("evo-resizing");
    frame();
    arrange();
    fitNow(false);
    clearTimeout(settle);
    settle = setTimeout(() => book.classList.remove("evo-resizing"), 200);
  };
  window.addEventListener("resize", onResize);
  // 장 안의 것이 커지거나 작아지면(글꼴이 늦게 오거나 해설이 길어지면) 다시 맞춘다
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => alive && fitNow(true)) : null;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => alive && (frame(), arrange(), fitNow(false)));

  const first = Number.parseInt(params && params.ch, 10);
  try {
    frame();
    show(Number.isInteger(first) && first >= 0 && first <= LAST ? first : 0, 0);
  } catch (e) {
    // 그리다 멈추면 문서 스크롤을 되돌려 놓는다(오류 화면은 app.js 가 그린다)
    alive = false;
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    if (ro) ro.disconnect();
    root.classList.remove("evo-on");
    throw e;
  }

  return {
    destroy() {
      alive = false;
      token += 1;
      if (cur && cur.api.destroy) cur.api.destroy();
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      clearTimeout(settle);
      if (ro) ro.disconnect();
      root.classList.remove("evo-on");
    },
  };

  /** 무대 크기와 배율, 넓은·세로 배치를 정한다 */
  function frame() {
    const head = document.querySelector("body > header");
    const topY = head ? head.offsetTop + head.offsetHeight : 0;
    const W = root.clientWidth;
    const H = Math.max(120, window.innerHeight - topY);
    const m = W / H >= WIDE_AT ? "wide" : "tall";
    const g = GEOM[m];
    const sc = Math.max(S_MIN, Math.min(g.max, W / g.w, H / g.h));
    book.style.height = `${H}px`;
    stage.style.width = `${W / sc}px`;
    stage.style.height = `${H / sc}px`;
    stage.style.transform = `scale(${sc})`;
    book.dataset.scale = sc.toFixed(3);
    mode = m;
    page.dataset.mode = m;
    const handheld = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    rotate.hidden = !(sc < ROTATE_AT && handheld && W > H && setting("evo.rotateHint", true));
  }

  /** 배치(넓은·세로)와 장 칸 너비에 따라 장이 제 것들을 다시 놓는다(장마다 바뀔 때만 옮긴다) */
  function arrange() {
    if (cur && cur.api.onMode) cur.api.onMode(mode, body.clientWidth);
  }

  /** 지금 장을 장 칸에 맞춘다(넘치면 f 배로 줄여 가운데에) */
  function fitNow(animate) {
    if (!cur) return;
    const bw = body.clientWidth;
    const bh = body.clientHeight;
    page.style.setProperty("--bw", `${bw}px`);
    page.style.setProperty("--bh", `${bh}px`);
    const box = cur.fit;
    box.style.width = `${bw}px`;
    const nh = box.offsetHeight;
    let f = nh > bh + 1 ? bh / nh : 1;
    const scroll = f < F_MIN;
    if (scroll) f = F_MIN;
    f = Math.floor(f * 1000) / 1000;
    cur.slide.classList.toggle("evo-scroll", scroll);
    box.classList.toggle("evo-anim", Boolean(animate) && cur.f !== undefined && cur.f !== f);
    box.style.setProperty("--f", String(f));
    cur.f = f;
    cur.slide.dataset.f = String(f);
  }

  function go(n) {
    if (!alive || n < 0 || n > LAST || (cur && cur.n === n)) return;
    show(n, cur && n < cur.n ? -1 : 1);
  }

  /** 앞 장은 밀려 나가고 새 장이 들어온다(움직임 줄이기면 바로 바뀐다) */
  function swap(old, slide, dir) {
    if (!old) return;
    old.classList.add("leaving");
    old.inert = true;
    old.setAttribute("aria-hidden", "true");
    if (!dir || reducedMotion() || !slide.animate) {
      old.remove();
      return;
    }
    const dx = 56 * Math.sign(dir);
    const easing = "cubic-bezier(.2,.7,.2,1)";
    const out = old.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${-dx}px)` }], { duration: 240, easing, fill: "forwards" });
    out.finished.then(
      () => old.remove(),
      () => old.remove(),
    );
    slide.animate([{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: "none" }], { duration: 340, easing });
  }

  function show(n, dir) {
    if (cur && cur.api.destroy) cur.api.destroy();
    const my = ++token;
    const live = () => alive && my === token;
    const ch = EVO_CHAPTERS[n];
    const tx = T[ch.id];
    try {
      history.replaceState(history.state, "", `#/v/${entry.id}?ch=${n}`);
    } catch {
      /* 주소를 못 바꿔도 이야기는 이어진다 */
    }

    const title = h("h1", { class: "evo-title", tabindex: "-1" }, tx.title);
    const paras = h("div", { class: "evo-paras" }, ...tx.body.map((p) => h("p", { class: "evo-txt" }, p)));
    const ghost = narrGhost(tx);
    // 보이는 해설 상자는 글 길이만큼, 자리는 가장 긴 해설을 담은 보이지 않는 상자가 잡는다
    const narrNow = h("div", { class: "evo-narr", "aria-live": "polite" });
    const narrBox = ghost ? h("div", { class: "evo-narr-wrap" }, h("div", { class: "evo-narr evo-narr-ghost", "aria-hidden": "true" }, ghost.map((l) => h("p", {}, l))), narrNow) : null;
    const text = h("div", { class: "evo-text" }, paras, narrBox);
    const story = h("div", { class: "evo-story" }, h("header", { class: "evo-head" }, sticker(t("{n}장", { n }), "evo-tag"), title), text);
    const left = h("div", { class: "evo-left" }, story);
    const play = h("div", { class: "evo-play" });
    const grid = h("div", { class: "evo-grid" }, left, play);
    const fit = h("div", { class: "evo-fit" }, grid);
    const slide = h("div", { class: "evo-slide", "data-kind": ch.kind, "data-ch": ch.id }, fit);

    const gated = (ch.kind === "duel" || ch.kind === "league") && !done.has(ch.id);
    const next =
      n < LAST
        ? h("button", { class: "evo-next", type: "button", disabled: gated, onclick: () => go(n + 1) }, t("{n}장", { n: n + 1 }), " ▶")
        : h("button", { class: "evo-next", type: "button", onclick: () => go(0) }, t("처음부터"));
    navBox.replaceChildren(
      h(
        "nav",
        { class: "evo-nav", "aria-label": t("장 넘기기") },
        n > 0 ? h("button", { class: "evo-prev", type: "button", onclick: () => go(n - 1) }, "← ", t("{n}장", { n: n - 1 })) : h("span"),
        h(
          "div",
          { class: "evo-dots" },
          EVO_CHAPTERS.map((c, i) =>
            h("button", {
              type: "button",
              class: i === n ? "on" : i < n ? "past" : "",
              "aria-label": t("{n}장: {title}", { n: i, title: T[c.id].title }),
              "aria-current": i === n ? "step" : undefined,
              onclick: () => go(i),
            }),
          ),
        ),
        next,
      ),
    );
    where.textContent = `${n} / ${LAST}`;

    const old = cur ? cur.slide : null;
    body.append(slide);
    const ctx = {
      V,
      ch,
      tx,
      T,
      n,
      entry,
      story,
      paras,
      left,
      play,
      grid,
      live,
      narr(...lines) {
        if (!narrBox) return;
        const list = lines.filter(Boolean);
        narrNow.replaceChildren(...list.map((l) => h("p", {}, l)));
        narrNow.classList.toggle("on", list.length > 0);
        text.classList.toggle("narrated", list.length > 0);
      },
      finish() {
        done.add(ch.id);
        next.disabled = false;
      },
    };
    const api = (BUILD[ch.kind] || textChapter)(ctx) || {};
    cur = { n, api, slide, fit, next, f: undefined };
    arrange();
    fitNow(false);
    if (ro) {
      ro.disconnect();
      ro.observe(fit);
    }
    swap(old, slide, dir);
    if (dir) title.focus({ preventScroll: true });
  }
}

const BUILD = { text: textChapter, one: oneChapter, duel: duelChapter, league: leagueChapter, evolve: evolveChapter, choice: choiceChapter, sandbox: sandboxChapter };

// ── 0·10장: 글 ─────────────────
function textChapter(ctx) {
  return ctx.ch.id === "intro" ? introChapter(ctx) : outroChapter(ctx);
}

function introChapter({ play }) {
  play.append(h("div", { class: "evo-cast-row", "aria-hidden": "true" }, EVO_CAST.map((id) => face(id, 0))));
  return {};
}

function outroChapter({ tx, story, play, grid, entry }) {
  if (tx.credit) story.append(h("p", { class: "evo-credit" }, tx.credit));
  const L = EVO_LINES[lang() === "en" ? "en" : "ko"];
  // 넓은 화면: 아홉 명을 다 펼친다
  const list = h(
    "ul",
    { class: "evo-cast" },
    EVO_CAST.map((id) => h("li", { "data-bot": id }, face(id, 0), h("div", {}, h("b", {}, botName(id)), bubble(L[id], "left"), h("p", { class: "evo-sm" }, botInfo(id).desc)))),
  );
  // 세로 화면: 얼굴을 누르면 아래에 그 사람 소개가 나온다(소개 아홉을 한 칸에 겹쳐 두어 높이가 그대로다)
  const details = EVO_CAST.map((id) => h("div", { class: "evo-pick-d", "data-bot": id }, h("b", {}, botName(id)), bubble(L[id], "up"), h("p", { class: "evo-sm" }, botInfo(id).desc)));
  const btns = EVO_CAST.map((id) =>
    h("button", { type: "button", class: "evo-pick-b", "data-bot": id, "aria-pressed": "false", onclick: () => pick(id) }, face(id, 0), h("span", {}, botName(id))),
  );
  function pick(id) {
    btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.bot === id)));
    details.forEach((d) => d.classList.toggle("on", d.dataset.bot === id));
  }
  pick(EVO_CAST[0]);
  const picker = h("div", { class: "evo-pick" }, h("div", { class: "evo-pick-faces", role: "group", "aria-label": t("등장인물") }, btns), h("div", { class: "evo-pick-ds" }, details));
  play.append(card(cardTitle(t("등장인물")), list, picker));
  if (entry.sources && entry.sources.length) grid.append(h("section", { class: "evo-srcs" }, h("h2", { class: "evo-card-t" }, t("출처")), sourcesList(entry.sources)));
  return {};
}

// ── 1장: 한 판 ─────────────────
function oneChapter({ V, ch, tx, play, narr }) {
  const bot = opponentFor(V, ch);
  const hist = []; // 봇 쪽에서 본 기록
  const opHand = h("span", { class: "evo-big" });
  const myHand = h("span", { class: "evo-big" });
  const verdict = h("p", { class: "evo-verdict", "aria-live": "polite" });
  // '한 판 더'는 자리를 잡아 두고 보이기만 바꾼다(나타날 때 장 높이가 바뀌지 않게)
  const again = h("button", { class: "btn evo-again evo-off", type: "button", onclick: () => ready() }, t("한 판 더"));
  const grid = handGrid(V, { onPick: pick, label: t("낼 손") });
  const vs = h(
    "div",
    { class: "evo-vs" },
    h("div", { class: "evo-side-col" }, face(null, 56, { q: true }), h("b", {}, t("상대")), opHand),
    h("div", { class: "evo-score" }, "VS"),
    h("div", { class: "evo-side-col" }, face(null, 56, { me: true }), h("b", {}, t("나")), myHand),
  );
  play.append(card(vs, h("div", { class: "evo-verdict-row" }, verdict, again), grid.el));
  function pick(i) {
    const b = bot.pick({ history: hist });
    hist.push({ me: b, op: i });
    const c = V.cmp(i, b);
    opHand.replaceChildren(handArt(V.hands[b]));
    myHand.replaceChildren(handArt(V.hands[i]));
    verdict.textContent = c > 0 ? t("이김") : c < 0 ? t("짐") : t("비김");
    verdict.dataset.r = c > 0 ? "w" : c < 0 ? "l" : "t";
    grid.lock(true);
    again.classList.remove("evo-off");
    narr(tx.end);
    again.focus({ preventScroll: true });
  }
  function ready() {
    opHand.replaceChildren();
    myHand.replaceChildren();
    verdict.textContent = "";
    delete verdict.dataset.r;
    grid.lock(false);
    again.classList.add("evo-off");
  }
  return { key: (e) => grid.keyHandler(e) };
}

// ── 2장: 다섯 상대와 10판씩 ─────────────────
function duelChapter({ V, ch, tx, play, narr, finish }) {
  const R = ch.rounds;
  const F = ch.foes.length;
  const L = EVO_LINES[lang() === "en" ? "en" : "ko"];
  const known = new Set();
  let fi = 0;
  let bot = null;
  let hist = [];
  let rows = [];

  const progress = h("div", { class: "evo-opp" });
  const score = h("b");
  const sub = h("small");
  const cells = h("div", { class: "evo-hist", role: "list", "aria-label": t("지난 판") });
  const grid = handGrid(V, { onPick: pick, label: t("낼 손") });
  const vs = h(
    "div",
    { class: "evo-vs" },
    h("div", { class: "evo-side-col" }, face(null, 56, { q: true }), bubble("…", "up")),
    h("div", { class: "evo-score", "aria-live": "polite" }, score, sub),
    h("div", { class: "evo-side-col" }, face(null, 56, { me: true }), h("b", {}, t("나"))),
  );
  const key = h(
    "div",
    { class: "evo-key evo-sm" },
    h("span", {}, t("위: 상대 · 아래: 나")),
    h("span", {}, h("i", { class: "w" }), t("이김"), " ", h("i", { class: "l" }), t("짐"), " ", h("i", { class: "t" }), t("비김")),
  );
  const nextBtn = h("button", { class: "btn btn-ink evo-wide", type: "button", onclick: () => start(fi + 1) });
  const revealBox = h("div", { class: "evo-reveal" });
  // 열 판을 마치면 손 단추 자리에 상대 정체가 나온다(같은 칸에 겹쳐 두어 높이가 그대로다)
  const reveal = h("div", { class: "evo-reveal-box evo-off" }, revealBox, nextBtn);
  play.append(progress, card(vs, key, cells, h("div", { class: "evo-slot" }, grid.el, reveal)));

  function draw() {
    progress.replaceChildren(
      h("span", { class: "evo-sm" }, t("상대 {i} / {n}", { i: fi + 1, n: F })),
      ...ch.foes.map((f, i) => {
        const el = known.has(i) ? face(f.id, 30) : face(null, 30, { q: true });
        if (i === fi && !known.has(i)) el.classList.add("now");
        el.setAttribute("title", known.has(i) ? botName(f.id) : t("상대 {i}", { i: i + 1 }));
        return el;
      }),
    );
    const w = rows.filter((r) => r.c > 0).length;
    const l = rows.filter((r) => r.c < 0).length;
    score.textContent = `${num(l)} : ${num(w)}`;
    sub.textContent = `${t("{n} / {total}판", { n: rows.length, total: R })} · ${t("비김 {n}", { n: rows.length - w - l })}`;
    cells.replaceChildren(
      ...Array.from({ length: R }, (_, k) => {
        const r = rows[k];
        if (!r) return h("div", { class: "e", role: "listitem", "aria-label": t("@round:{n}판", { n: k + 1 }) });
        const res = r.c > 0 ? "w" : r.c < 0 ? "l" : "t";
        return h(
          "div",
          { class: res, role: "listitem", "aria-label": `${t("@round:{n}판", { n: k + 1 })}: ${V.hands[r.op].name} / ${V.hands[r.me].name}, ${res === "w" ? t("이김") : res === "l" ? t("짐") : t("비김")}` },
          handArt(V.hands[r.op]),
          h("i"),
          handArt(V.hands[r.me]),
        );
      }),
    );
  }
  function start(i) {
    fi = i;
    bot = opponentFor(V, ch, i);
    hist = [];
    rows = [];
    reveal.classList.add("evo-off");
    grid.el.classList.remove("evo-off");
    grid.lock(false);
    draw();
  }
  function pick(my) {
    if (rows.length >= R) return;
    const b = bot.pick({ history: hist });
    hist.push({ me: b, op: my });
    rows.push({ me: my, op: b, c: V.cmp(my, b) });
    draw();
    if (rows.length === R) showReveal();
  }
  function showReveal() {
    const id = ch.foes[fi].id;
    known.add(fi);
    grid.lock(true);
    draw();
    revealBox.replaceChildren(face(id, 64, { badge: t("정체") }), h("div", {}, h("h3", { class: "evo-reveal-t" }, botName(id)), bubble(L[id], "left")));
    const last = fi === F - 1;
    nextBtn.hidden = last;
    nextBtn.textContent = t("다음 상대 ({i} / {n})", { i: fi + 2, n: F });
    grid.el.classList.add("evo-off");
    reveal.classList.remove("evo-off");
    narr(tx.foes[id], last ? tx.end : null);
    if (last) finish();
    else nextBtn.focus({ preventScroll: true });
  }
  start(0);
  return { key: (e) => grid.keyHandler(e) };
}

// ── 3장: 리그 한 번(걸고 보기) ─────────────────
function leagueChapter({ V, ch, tx, play, narr, finish, live }) {
  const ids = ch.bots;
  const L = EVO_LINES[lang() === "en" ? "en" : "ko"];
  let bet = null;
  // 오각형(12시부터 시계 방향): 너비 310·높이 250 을 기준으로 한 %
  const W = 310;
  const HT = 250;
  const pos = ids.map((_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / ids.length;
    return [W / 2 + 92 * Math.cos(a), 118 + 92 * Math.sin(a)];
  });
  const lines = new Map();
  const svg = s("svg", { class: "evo-net", viewBox: `0 0 ${W} ${HT}`, "aria-hidden": "true" });
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const ln = s("line", { x1: pos[i][0].toFixed(1), y1: pos[i][1].toFixed(1), x2: pos[j][0].toFixed(1), y2: pos[j][1].toFixed(1) });
      lines.set(`${ids[i]}|${ids[j]}`, ln);
      svg.append(ln);
    }
  const who = ids.map((id, i) => {
    const f = face(id, 52);
    const b = h("button", { class: "evo-who", type: "button", "aria-pressed": "false", style: { left: `${(100 * pos[i][0]) / W}%`, top: `${(100 * pos[i][1]) / HT}%` }, onclick: () => choose(id) }, f, h("b", {}, botName(id)));
    return b;
  });
  const net = h("div", { class: "evo-league" }, svg, ...who);
  const hint = h("p", { class: "evo-sm evo-center" }, t("얼굴을 눌러 한 명에게 거십시오."));
  const startBtn = h("button", { class: "btn btn-ink evo-wide", type: "button", disabled: true, onclick: () => run() }, t("리그 시작"));
  const act = h("div", { class: "evo-lg-act" }, hint, startBtn);
  // 결과 막대는 처음부터 0 에서 인물 차례로 서 있다가, 리그가 끝나면 순위대로 다시 선다
  // (처음부터 순위 차례면 막대가 자라기 전에 1등이 보여서 건 재미가 없다: 컨셉 11-10)
  const bars = h("div", { class: "evo-bars" });
  const rows = new Map(
    ids.map((id) => {
      const fill = h("i");
      const val = h("span", { class: "evo-bar-v" }, "0");
      const row = h("div", { class: "evo-bar", "data-bot": id }, face(id, 26), h("span", {}, botName(id)), h("span", { class: "evo-bar-tr" }, fill), val);
      bars.append(row);
      return [id, { row, fill, val }];
    }),
  );
  const winRow = h("div", { class: "evo-win1" });
  const betLine = h("p", { class: "evo-sm evo-bet", "aria-live": "polite" });
  const res = h("div", { class: "evo-lg-res" }, bars, winRow, betLine);
  // 넓은 화면: 오각형 카드 옆에 결과 카드. 세로 화면: 결과가 오각형 아래 '리그 시작' 자리에 겹쳐 나온다
  const slot = h("div", { class: "evo-slot evo-lg-slot" }, act);
  const resCard = card(cardTitle(t("결과"), h("small", { class: "evo-sm" }, ` ${t("한 경기 {n}판", { n: ch.rounds })}`)));
  play.classList.add("two");
  play.dataset.state = "ready";
  play.append(h("section", { class: "evo-card evo-lg-card" }, net, slot), resCard);

  function choose(id) {
    if (play.dataset.state !== "ready") return;
    bet = id;
    who.forEach((b, i) => {
      const on = ids[i] === id;
      b.setAttribute("aria-pressed", String(on));
      b.querySelector(".evo-badge")?.remove();
      if (on) b.firstChild.append(sticker(t("내 선택"), "evo-badge"));
    });
    startBtn.disabled = false;
  }
  async function run() {
    play.dataset.state = "run";
    startBtn.disabled = true;
    who.forEach((b) => (b.disabled = true));
    const r = leagueFor(V, ch);
    const max = Math.max(1, ...Object.values(r.totals).map(Math.abs));
    const now = Object.fromEntries(ids.map((id) => [id, 0]));
    const setBar = (id) => {
      const v = now[id];
      const w = (50 * Math.abs(v)) / max;
      const { fill, val } = rows.get(id);
      fill.style.left = v >= 0 ? "50%" : `${50 - w}%`;
      fill.style.width = `${w}%`;
      val.textContent = signed(v);
    };
    const quick = reducedMotion() || fastMode();
    for (const p of r.pairs) {
      if (!live()) return;
      const winner = p.w > p.l ? p.a : p.w < p.l ? p.b : null;
      const ln = lines.get(`${p.a}|${p.b}`);
      ln.classList.add("done");
      if (winner) ln.style.stroke = `var(--c-${winner})`;
      now[p.a] += p.w - p.l;
      now[p.b] += p.l - p.w;
      setBar(p.a);
      setBar(p.b);
      if (!quick) await sleep(300);
    }
    if (!live()) return;
    if (!quick) await sleep(300);
    if (!live()) return;
    reorder(bars, r.order.map((id) => rows.get(id).row), quick);
    if (!quick) await sleep(480);
    if (!live()) return;
    const top = r.order[0];
    rows.get(top).row.querySelector(".evo-face").append(sticker(t("1등"), "evo-badge"));
    winRow.replaceChildren(face(top, 44, { badge: t("1등") }), bubble(L[top], "left"));
    const place = r.order.indexOf(bet) + 1;
    betLine.textContent = place === 1 ? t("내 선택이 1등!") : t("내 선택은 {n}등", { n: place });
    play.dataset.state = "done";
    narr(tx.end);
    finish();
  }
  let laid = null;
  return {
    onMode(m) {
      if (m === laid) return;
      laid = m;
      if (m === "tall") {
        slot.append(res);
        resCard.hidden = true;
      } else {
        resCard.append(res);
        resCard.hidden = false;
      }
    },
  };
}

/** 줄들을 새 차례로 옮긴다. 움직임을 줄이지 않았으면 있던 자리에서 미끄러져 간다(FLIP). 무대가 배율로 커져 있어 화면 좌표 대신 offsetTop 으로 잰다 */
function reorder(parent, els, quick) {
  const before = quick ? null : new Map(els.map((el) => [el, el.offsetTop]));
  parent.append(...els);
  if (!before) return;
  for (const el of els) {
    const dy = before.get(el) - el.offsetTop;
    if (Math.abs(dy) > 0.5 && el.animate) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 450, easing: "cubic-bezier(.2,.7,.2,1)" });
  }
}

// ── 4장: 리그를 거듭하면 ─────────────────
function evolveChapter({ V, ch, tx, play, narr, live }) {
  const world = evoWorld(live);
  const setup = evoSetup(ch);
  const stepBtn = h("button", { class: "btn btn-ink", type: "button", onclick: () => world.step(1) }, t("한 세대"));
  const runBtn = h("button", { class: "btn", type: "button", onclick: () => world.run() }, t("끝까지"));
  // '처음부터'는 끝나야 보이지만 자리는 늘 잡아 둔다
  const againBtn = h("button", { class: "btn evo-off", type: "button", onclick: () => (narr(), world.reset(setup, V)) }, t("처음부터"));
  play.append(worldBox(world, [stepBtn, runBtn, againBtn]));
  world.onChange(() => {
    const end = world.finished();
    stepBtn.disabled = runBtn.disabled = end || world.busy;
    againBtn.classList.toggle("evo-off", !end);
    if (end && world.evo.generation > 0) narr(tx.end);
  });
  world.reset(setup, V);
  return { destroy: () => world.stop() };
}

// ── 5–8장: 고르면 끝까지 ─────────────────
function choiceChapter({ V, ch, tx, story, play, narr, live }) {
  const world = evoWorld(live);
  let picked = null;
  const btns = ch.choices.map((c) =>
    h("button", { class: "evo-choice", type: "button", "aria-pressed": "false", "data-id": c.id, onclick: () => pick(c.id) }, tx.choices[c.id].label),
  );
  // 고르기는 질문 글 바로 아래(해설은 그 아래)
  story.append(h("div", { class: "evo-choices", role: "group", "aria-label": t("고르기") }, ...btns));
  play.append(worldBox(world, null));
  world.onChange(() => {
    if (picked && world.finished() && world.evo.generation > 0) narr(tx.choices[picked].result, tx.end);
  });
  // 고르기 전에는 처음 값(0세대)을 보여 준다
  world.reset({ ...evoSetup({ ...ch, kind: "evolve" }) }, V);
  world.hint.textContent = t("하나를 고르면 끝까지 돌립니다.");
  async function pick(id) {
    picked = id;
    btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
    narr();
    world.reset(evoSetup(ch, id), V);
    await sleep(0);
    if (live() && picked === id) world.run();
  }
  return { destroy: () => world.stop() };
}

// ── 9장: 놀이터 ─────────────────
function sandboxChapter({ ch, tx, play, live }) {
  const base = evoSetup(ch);
  const lim = ch.limits;
  const st = { population: { ...base.population }, rounds: base.rounds, cull: base.cull, noise: base.noise, payoff: { ...base.payoff }, seed: base.seed, maxGen: base.maxGen, variant: base.variant };
  const variants = CATALOG.filter((e) => e.kind === "matrix");
  let V = compileVariant(findEntry(st.variant));
  const world = evoWorld(live);
  const total = () => Object.values(st.population).reduce((a, b) => a + b, 0);

  // 사람: 3×3, − n +
  const sum = h("p", { class: "evo-sm evo-sum" });
  const cells = EVO_CAST.map((id) => {
    const n = h("b", {}, num(st.population[id]));
    const minus = h("button", { type: "button", class: "evo-step", "aria-label": t("{name} 한 명 빼기", { name: botName(id) }), onclick: () => bump(id, -1) }, MINUS);
    const plus = h("button", { type: "button", class: "evo-step", "aria-label": t("{name} 한 명 더하기", { name: botName(id) }), onclick: () => bump(id, 1) }, "+");
    return { id, n, minus, plus, el: h("div", { class: "evo-cnt", "data-bot": id }, face(id, 28), h("span", {}, botName(id)), h("div", { class: "evo-cnt-n" }, minus, n, plus)) };
  });
  function bump(id, d) {
    const v = st.population[id] + d;
    if (v < lim.people[0] || v > lim.people[1] || total() + d < lim.total[0] || total() + d > lim.total[1]) return;
    st.population[id] = v;
    changed();
  }

  // 규칙: 변종 · 밀대 셋
  const vSel = selectBox({ label: t("변종"), value: st.variant, options: variants.map((v) => ({ id: v.id, name: v.name })), onChange: (id) => ((st.variant = id), (V = compileVariant(findEntry(id))), changed()) });
  const slider = (label, key, [lo, hi], step, show) => {
    const out = h("output", {});
    const input = h("input", { type: "range", min: lo, max: hi, step, value: st[key], "aria-label": label });
    const sync = () => (out.textContent = show(st[key]));
    input.addEventListener("input", () => {
      st[key] = Number(input.value);
      sync();
      changed();
    });
    sync();
    return h("label", { class: "evo-sl" }, h("span", { class: "evo-sl-t" }, h("span", {}, label), out), input, h("span", { class: "evo-sl-ends" }, h("span", {}, show(lo)), h("span", {}, show(hi))));
  };
  const pctOf = (v) => `${Math.round(v * 100)}%`;
  // 점수: 이김 · 비김 · 짐
  const payBox = (label, key, lo, hi) => {
    const v = h("b", {}, signed(st.payoff[key]));
    const set = (d) => {
      const x = Math.round((st.payoff[key] + d) * 2) / 2;
      if (x < lo || x > hi) return;
      st.payoff[key] = x;
      v.textContent = signed(x);
      changed();
    };
    return h(
      "div",
      { class: "evo-pay" },
      h("span", {}, label),
      v,
      h(
        "div",
        { class: "evo-cnt-n" },
        h("button", { type: "button", class: "evo-step", "aria-label": t("{what} 점수 내리기", { what: label }), onclick: () => set(-0.5) }, MINUS),
        h("button", { type: "button", class: "evo-step", "aria-label": t("{what} 점수 올리기", { what: label }), onclick: () => set(0.5) }, "+"),
      ),
    );
  };
  // 세로 화면에서는 이야기 글(설명)과 그래프도 탭으로 들어간다. 넓은 화면은 글이 왼쪽 칸에, 그래프가 따로 카드에 있어 두 탭을 감춘다
  const chartPane = h("div", { class: "evo-chartpane" });
  const panel = tabsBox(
    [
      { id: "about", label: t("설명"), el: h("div", { class: "evo-paras" }, ...tx.body.map((p) => h("p", { class: "evo-txt" }, p))) },
      { id: "people", label: t("사람"), el: h("div", {}, h("div", { class: "evo-cnts" }, cells.map((c) => c.el)), sum) },
      {
        id: "rules",
        label: t("규칙"),
        el: h(
          "div",
          {},
          vSel.el,
          slider(t("한 경기 판 수"), "rounds", lim.rounds, 1, (v) => t("{n}판", { n: num(v) })),
          slider(t("세대마다 바꿀 사람"), "cull", lim.cull, 1, (v) => t("@people:{n}명", { n: num(v) })),
          slider(t("실수"), "noise", lim.noise, 0.01, pctOf),
        ),
      },
      { id: "score", label: t("점수"), el: h("div", { class: "evo-pays" }, payBox(t("이김"), "win", 0, 3), payBox(t("비김"), "tie", -1, 1), payBox(t("짐"), "lose", -3, 0)) },
      { id: "chart", label: t("그래프"), el: chartPane },
    ],
    "people",
  );
  const panelCard = h("section", { class: "evo-card evo-panel" }, panel.el);

  const seedNote = h("p", { class: "evo-sm evo-center evo-seed" });
  const stepBtn = h("button", { class: "btn btn-ink", type: "button", onclick: () => world.step(1) }, t("한 세대"));
  const runBtn = h("button", { class: "btn", type: "button", onclick: () => world.run() }, t("끝까지"));
  const resetBtn = h("button", { class: "btn", type: "button", onclick: () => world.reset(setup(), V) }, t("처음부터"));
  const seedBtn = h("button", { class: "btn", type: "button", onclick: () => ((st.seed = randomSeed() % 100000), world.reset(setup(), V)) }, t("씨앗 바꾸기"));
  const btnRow = h("div", { class: "evo-btns evo-btns-4" }, stepBtn, runBtn, resetBtn, seedBtn);
  const ringCard = h("section", { class: "evo-card evo-ringcard" }, world.ring.el);
  const chartBody = h("div", { class: "evo-chartbody" }, cardTitle(t("세대마다 사람 수")), world.chart.el);
  const chartCard = h("section", { class: "evo-card evo-chartcard" });
  world.onChange(() => {
    const end = world.finished();
    stepBtn.disabled = runBtn.disabled = end || world.busy;
    seedNote.textContent = t("씨앗 {n}", { n: st.seed });
  });

  const setup = () => ({ population: { ...st.population }, rounds: st.rounds, cull: st.cull, noise: st.noise, payoff: { ...st.payoff }, seed: st.seed, maxGen: st.maxGen });
  function changed() {
    const n = total();
    sum.textContent = t("합 {n}명", { n: num(n) });
    for (const c of cells) {
      c.n.textContent = num(st.population[c.id]);
      c.minus.disabled = st.population[c.id] <= lim.people[0] || n <= lim.total[0];
      c.plus.disabled = st.population[c.id] >= lim.people[1] || n >= lim.total[1];
    }
    world.reset(setup(), V);
  }
  changed();
  let laid = null;
  return {
    destroy: () => world.stop(),
    // 넓은 화면: [고리 · 단추] [탭(사람·규칙·점수)] [그래프 카드]. 칸이 모자라면 그래프도 탭으로.
    // 세로 화면: [고리 | 단추] 아래에 탭(설명·사람·규칙·점수·그래프)
    onMode(m, bw) {
      const v = m === "tall" ? "tall" : bw >= 1320 ? "wide4" : "wide3";
      if (v === laid) return;
      laid = v;
      const chartTab = v !== "wide4";
      (chartTab ? chartPane : chartCard).append(chartBody);
      play.dataset.v = v;
      if (v === "tall") play.replaceChildren(h("div", { class: "evo-sb-top" }, ringCard, h("div", { class: "evo-col" }, btnRow, seedNote)), panelCard, world.status);
      else play.replaceChildren(...[h("div", { class: "evo-col evo-sb-a" }, ringCard, btnRow, seedNote), panelCard, chartTab ? null : chartCard, world.status].filter(Boolean));
      panel.show("about", v === "tall");
      panel.show("chart", chartTab);
      if (v !== "tall" && panel.on === "about") panel.select("people");
      if (!chartTab && panel.on === "chart") panel.select("people");
      if (v === "tall" && !panel.touched) panel.select("about");
    },
  };
}
