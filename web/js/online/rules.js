// 방 규칙(온라인 규약 3.2): 방장이 고르는 칸(rulesEditor)과 모두에게 보이는 한 줄(rulesLine).
// 서버가 규칙을 다듬어 state 로 돌려주므로, 화면은 받은 규칙을 그대로 보여 주고 바꿀 때만 통째로 보낸다.

import { h, clear } from "../ui/dom.js";
import { t } from "../i18n.js";
import { selectBox, segmented } from "../ui/widgets.js";
import { BOTS, botInfo } from "../core/bots.js";
import { formatById } from "../games/match.js";
import { findEntry } from "../data/catalog.js";
import { variantOf, roomGameIds } from "./games.js";
import { groupBases as groupBaseIds, isOnlineGame, seatRange, groupRuleOf } from "../data/online.js";
import { FORMATS, TIMERS, GROUP_SEATS, GROUP_MODES, ROOM_DEFAULTS } from "./protocol.js";

/** 여럿이 가위바위보의 바탕이 될 수 있는 도감 변종(data/online.js 의 groupBases, 맨 앞 classic) */
export function groupBases() {
  return groupBaseIds().map(findEntry).filter(Boolean);
}

export const isGroup = (rules) => !!rules && rules.game === "group";

/** 여럿이 바탕 id 의 인원 범위(컨셉 seatRange: 손 셋 3–8명, 손 많음 3–20명). 모르는 id 면 보통 범위 */
export function seatsOf(base) {
  return seatRange(base) || { min: GROUP_SEATS.min, max: GROUP_SEATS.max };
}

/** 손 많은 바탕은 점수로 정한다는 한 줄(groupRuleOf 가 "score" 일 때, 컨셉 11-08). 아니면 null */
export function groupRuleNote(rules) {
  if (!isGroup(rules) || groupRuleOf(rules.base) !== "score") return null;
  return t("손이 많아 점수로 정한다. 그 손이 이긴 사람 수에서 그 손을 이긴 사람 수를 뺀 것이 점수이고, 점수가 가장 높은 손이 남는다(술래 한 명은 가장 낮은 손).");
}

/** 고를 수 있는 여럿이 인원의 천장(바탕 가운데 가장 많은 것) */
export function maxGroupSeats() {
  return Math.max(GROUP_SEATS.min, ...groupBases().map((e) => seatsOf(e.id).max));
}

/** 보낼 규칙 꼴로 다듬기(서버 normRules 와 같은 기본값). 둘이서면 seats 2, 여럿이면 format 을 빼고 base·mode 를 넣는다 */
export function cleanRules(r = {}) {
  const bot = BOTS.some((b) => b.id === r.bot) ? r.bot : ROOM_DEFAULTS.bot;
  const timer = TIMERS.includes(r.timer) ? r.timer : ROOM_DEFAULTS.timer;
  if (r.game === "group") {
    const base = groupBases().some((e) => e.id === r.base) ? r.base : "classic";
    const mode = GROUP_MODES.includes(r.mode) ? r.mode : GROUP_MODES[0];
    // 인원은 바탕마다 다르다(손 셋은 8명까지). 범위 밖이면 기본값을 그 범위 안으로
    const range = seatsOf(base);
    const seats = Number.isInteger(r.seats) && r.seats >= range.min && r.seats <= range.max ? r.seats : Math.min(GROUP_SEATS.default, range.max);
    return { game: "group", base, mode, seats, bot, timer };
  }
  const custom = r.game === "custom" && r.custom ? { n: r.custom.n, k: r.custom.k, seed: r.custom.seed } : null;
  const game = custom || (isOnlineGame("room", r.game) && r.game !== "custom" && r.game !== "group") ? r.game : ROOM_DEFAULTS.game;
  const format = FORMATS.includes(r.format) ? r.format : ROOM_DEFAULTS.format;
  const out = { game, format, seats: 2, bot, timer };
  if (custom) out.custom = custom;
  return out;
}

export function gameName(rules) {
  if (isGroup(rules)) {
    const g = findEntry("group");
    const b = findEntry(rules.base || "classic");
    const name = g ? g.name : t("여럿이 가위바위보");
    return rules.base && rules.base !== "classic" && b ? `${name} (${b.name})` : name;
  }
  if (rules.game === "custom") {
    const V = variantOf("custom", rules.custom);
    return V ? V.name : "RPS-n";
  }
  const e = findEntry(rules.game);
  return e ? e.name : rules.game;
}

export const modeName = (mode) => (mode === "loser" ? t("술래 한 명") : t("마지막 한 명"));
export const timerName = (s) => (s ? t("{n}초", { n: s }) : t("시간 제한 없음"));

/** "가위바위보 · 삼세판 · 20초", "여럿이 가위바위보 · 마지막 한 명 · 5명 · 20초" */
export function rulesLine(rules) {
  const parts = [gameName(rules)];
  if (isGroup(rules)) parts.push(modeName(rules.mode), t("@seats:{n}명", { n: rules.seats }));
  else parts.push(formatById(rules.format).name);
  parts.push(timerName(rules.timer));
  return parts.join(" · ");
}

/** 모두에게 보이는 규칙 줄들(방장이 아닌 사람): [[이름, 값], …] */
export function rulesRows(rules) {
  const rows = [[t("게임"), gameName(rules)]];
  if (isGroup(rules)) {
    rows.push([t("정하기"), modeName(rules.mode)], [t("인원"), t("@seats:{n}명", { n: rules.seats })]);
  } else {
    rows.push([t("판 수"), formatById(rules.format).name], [t("컴퓨터"), botInfo(rules.bot).name]);
  }
  rows.push([t("시간"), timerName(rules.timer)]);
  return rows;
}

/**
 * 방장이 규칙을 고르는 칸(시안 ③ 규칙 카드: 이름 + 고르기 한 줄씩). onChange(rules) 는 바뀐 규칙 전체(cleanRules 꼴).
 * set(rules) 로 서버가 돌려준 규칙에 맞춘다(고르던 칸을 다시 만들지 않아 초점이 그대로다).
 * 인원을 먼저 고른다(11-08 사용자): 2명이면 게임 목록·판 수·컴퓨터, 3명부터는 여럿이 가위바위보의 게임(바탕)·정하기.
 * 인원을 오가도 둘이서 고른 것과 여럿이 고른 것을 따로 기억해 둔다(인원이 바뀌어 대기실이 다시 그려져도: memo).
 */
const memo = {
  duo: { game: ROOM_DEFAULTS.game, custom: null, format: ROOM_DEFAULTS.format, bot: ROOM_DEFAULTS.bot },
  many: { base: "classic", mode: GROUP_MODES[0], seats: GROUP_SEATS.default },
};
export function rulesEditor(initial, { onChange }) {
  let rules = cleanRules(initial);
  const remember = () => {
    if (isGroup(rules)) memo.many = { base: rules.base, mode: rules.mode, seats: rules.seats };
    else memo.duo = { game: rules.game, custom: rules.custom || null, format: rules.format, bot: rules.bot };
  };
  remember();
  const el = h("div", { class: "rules-editor" });
  const emit = (patch) => {
    rules = cleanRules({ ...rules, ...patch });
    remember();
    onChange(rules);
  };
  const gameSel = selectBox({
    label: t("게임"),
    value: rules.game,
    options: roomGameIds()
      .filter((id) => id !== "group")
      .map((id) => ({ id, name: gameName({ game: id }) })),
    onChange: (id) => emit({ game: id, custom: null }),
  });
  const baseSel = selectBox({
    label: t("게임"),
    value: rules.base || "classic",
    options: groupBases().map((e) => ({ id: e.id, name: e.name })),
    onChange: (id) => emit({ base: id }),
  });
  /** 지금 인원을 받는 바탕만 고를 수 있게 */
  const fitBases = () => {
    for (const o of baseSel.sel.options) o.disabled = isGroup(rules) && seatsOf(o.value).max < rules.seats;
  };
  const botSel = selectBox({
    label: t("컴퓨터"),
    value: rules.bot,
    options: BOTS.map((b) => ({ id: b.id, name: b.name })),
    onChange: (id) => emit({ bot: id }),
  });
  const formatSeg = segmented({
    label: t("판 수"),
    value: rules.format || ROOM_DEFAULTS.format,
    options: FORMATS.map((id) => ({ id, name: formatById(id).name })),
    onChange: (id) => emit({ format: id }),
    small: true,
  });
  const modeSeg = segmented({
    label: t("정하기"),
    value: rules.mode || GROUP_MODES[0],
    options: GROUP_MODES.map((id) => ({ id, name: modeName(id) })),
    onChange: (id) => emit({ mode: id }),
    small: true,
  });
  // 인원: 2명 + 여럿이 3명부터 바탕 가운데 가장 많은 수까지. 많으면(손 많은 바탕을 열면 20명) 고르기 상자로
  const top = maxGroupSeats();
  const seatOptions = [2, ...Array.from({ length: top - GROUP_SEATS.min + 1 }, (_, k) => GROUP_SEATS.min + k)].map((n) => ({ id: String(n), name: String(n) }));
  const onSeats = (id) => {
    const n = Number(id);
    if (n === 2) return emit({ ...memo.duo, seats: 2 });
    // 고른 인원을 받는 바탕으로(기억한 바탕이 못 받으면 받는 첫 바탕)
    const base = seatsOf(memo.many.base).max >= n ? memo.many.base : (groupBases().find((e) => seatsOf(e.id).max >= n) || { id: "classic" }).id;
    emit({ game: "group", custom: null, base, mode: memo.many.mode, seats: n });
  };
  const seatsSeg =
    seatOptions.length <= 10
      ? segmented({ label: t("인원"), value: String(rules.seats), options: seatOptions, onChange: onSeats, small: true })
      : (() => {
          const box = selectBox({ label: t("인원"), value: String(rules.seats), options: seatOptions.map((o) => ({ ...o, name: t("@seats:{n}명", { n: Number(o.id) }) })), onChange: onSeats });
          return { el: box.el, set: (v) => (box.sel.value = v) };
        })();
  const timerSeg = segmented({
    label: t("시간"),
    value: String(rules.timer),
    options: TIMERS.map((sec) => ({ id: String(sec), name: sec ? t("{n}초", { n: sec }) : t("@timer:없음") })),
    onChange: (id) => emit({ timer: Number(id) }),
    small: true,
  });

  function layout() {
    const group = isGroup(rules);
    // 여럿이 할 때 컴퓨터는 늘 아무 손이나 낸다(규약 3.2)
    clear(el).append(seatsSeg.el, ...(group ? [baseSel.el, modeSeg.el] : [gameSel.el, formatSeg.el, botSel.el]), timerSeg.el);
  }
  function set(next) {
    const wasGroup = isGroup(rules);
    rules = cleanRules(next);
    remember();
    if (rules.game !== "custom") gameSel.sel.value = rules.game;
    if (rules.format) formatSeg.set(rules.format);
    if (rules.base) baseSel.sel.value = rules.base;
    fitBases();
    if (rules.mode) modeSeg.set(rules.mode);
    seatsSeg.set(String(rules.seats));
    botSel.sel.value = rules.bot;
    timerSeg.set(String(rules.timer));
    if (wasGroup !== isGroup(rules)) layout();
  }
  layout();
  fitBases();
  return {
    el,
    set,
    get rules() {
      return rules;
    },
  };
}
