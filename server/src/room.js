// 방(실시간 대전)의 규칙. 상태(state)는 JSON 하나라 Durable Object 저장소에 그대로 둔다.
// 통신·저장·알람은 room-do.js 가 하고, 여기는 값만 다룬다(그래서 시험이 Cloudflare 없이 돈다).
// 손은 공개 전까지 state.game.pend 에만 있다. 사람마다 보내는 꼴(view)에는 자기 손만 실린다.
// 판정은 web/js 의 match.js(둘이서)와 group.js(여럿이)를 그대로 쓴다. 저장된 판을 다시 두어 경기 객체를 되살린다.

import { createMatch, formatById } from "../../web/js/games/match.js";
import { createGroup } from "../../web/js/games/group.js";
import { createBot } from "../../web/js/core/bots.js";
import { makeRng } from "../../web/js/core/rng.js";
import { handIndex, normRules, rulesVariant } from "./games.js";
import { checkEmote } from "./check.js";
import { Fail } from "./http.js";
import { AFK_LIMIT, ENDLESS_MAX, GRACE_MS, HIST_MAX, IDLE_LIMIT, MATCH_SHOW_MS, REVEAL_MS, ROOM_DELETE_MS } from "./protocol.js";

/** 상태 꼴 번호(저장된 방을 읽을 때 본다) */
export const STATE_V = 1;
/** 봇만 남은 group 을 한 번에 끝까지 돌릴 때의 상한 */
const BOT_RUN_MAX = 500;

// 씨앗 섞기: 방 씨앗과 자리·판 번호로 정해지는 난수(서버가 잠들었다 깨도 같은 값)
function mix(...xs) {
  let h = 0x9e3779b9;
  for (const x of xs) {
    h = Math.imul(h ^ (x >>> 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}
const rngFor = (...xs) => makeRng(mix(...xs));

function human(pid, name, now, on) {
  return { kind: "human", pid, name, on, off: on ? null : now, afk: 0 };
}

export class Room {
  constructor(state) {
    this.s = state;
    this._V = null;
    this._e = null;
  }

  /**
   * 새 방. host: 방장 {pid, name}(0번 자리), reserve: 랜덤 매칭으로 잡아 둔 사람들 [{pid, name}]
   * 둘 다 처음엔 연결 전(on false)이라 들어오면 그 자리로 간다
   */
  static create({ code, rules, now, seed, host = null, reserve = null, random = false }) {
    const r = normRules(rules);
    const seats = Array.from({ length: r.seats }, () => ({ kind: "empty" }));
    const s = {
      v: STATE_V,
      code,
      random,
      seed: seed >>> 0,
      rules: r,
      phase: "lobby",
      host: null,
      seats,
      game: null,
      reserve: null,
      startAt: null,
      cleanupAt: now + ROOM_DELETE_MS,
      alarm: null,
    };
    if (host) {
      seats[0] = human(host.pid, host.name, now, false);
      s.host = 0;
    }
    if (reserve) {
      reserve.forEach((p, i) => (seats[i] = human(p.pid, p.name, now, false)));
      s.reserve = reserve.map((p) => p.pid);
      s.startAt = now + MATCH_SHOW_MS;
      s.host = 0;
    }
    return new Room(s);
  }

  get V() {
    return this._V || (this._V = rulesVariant(this.s.rules));
  }

  get group() {
    return this.s.rules.game === "group";
  }

  /** 경기 객체(match.js·group.js). 메모리에 두고, 없으면 저장된 판으로 되살린다 */
  engine() {
    const g = this.s.game;
    if (!g) return null;
    if (this._e) return this._e;
    let e;
    if (this.group) {
      e = createGroup(this.V, { players: this.s.seats.length, mode: this.s.rules.mode });
      for (const t of g.rounds) e.play(throwMap(t));
    } else {
      e = createMatch(this.V, { target: formatById(this.s.rules.format).target });
      for (const [a, b] of g.rounds) e.play(a, b);
    }
    return (this._e = e);
  }

  seatOf(pid) {
    return this.s.seats.findIndex((x) => x.kind === "human" && x.pid === pid);
  }

  /** 지금 판에 낼 자리들(group 은 남은 사람만) */
  alive() {
    if (this.group && this.s.game) return this.engine().alive.slice();
    return this.s.seats.map((_, i) => i);
  }

  // ---- 들어오고 나가기 ----

  /** pid 가 들어온다. 돌려주는 값: { seat, evs } (seat 가 null 이면 구경꾼) */
  join(pid, name, now) {
    const s = this.s;
    const evs = [];
    s.cleanupAt = null;
    let i = s.seats.findIndex((x) => x.pid === pid);
    if (i >= 0) {
      const seat = s.seats[i];
      if (seat.kind === "human") {
        const was = seat.on;
        Object.assign(seat, { on: true, off: null, name });
        if (!was) evs.push({ k: "back", s: i });
      } else {
        // 봇이 잇던 자리를 되찾는다. 봇이 이번 판에 낸 손은 지워서 사람이 고르게 한다
        s.seats[i] = human(pid, name, now, true);
        if (s.phase === "play") s.game.pend[i] = null;
        evs.push({ k: "back", s: i });
      }
    } else if (!s.reserve && (s.phase === "lobby" || s.phase === "end")) {
      i = freeSeat(s.seats);
      if (i >= 0) {
        s.seats[i] = human(pid, name, now, true);
        evs.push({ k: "join", s: i });
      }
    }
    if (i < 0) return { seat: null, evs: [{ k: "watch" }] };
    if (s.host === null) {
      s.host = i;
      evs.push({ k: "host", s: i });
    }
    // 랜덤 방: 잡아 둔 사람이 다 오면 바로 시작
    if (s.reserve && s.phase === "lobby" && s.seats.every((x) => x.kind !== "human" || x.on)) evs.push(...this.start(now));
    return { seat: i, evs };
  }

  /** pid 의 연결이 끊겼다. explicit 이면 스스로 나간 것(자리를 바로 비운다) */
  leave(pid, now, explicit = false) {
    const i = this.seatOf(pid);
    if (i < 0) return [{ k: "watch" }];
    if (explicit) return this.#vacate(i, now, "left", false);
    Object.assign(this.s.seats[i], { on: false, off: now });
    return [{ k: "off", s: i }];
  }

  /** 자리를 비운다: 대기실·끝이면 빈자리, 경기 중이면 봇이 잇는다(keep 이면 그 사람이 돌아와 되찾을 수 있다) */
  #vacate(i, now, why, keep) {
    const s = this.s;
    const x = s.seats[i];
    const evs = [];
    if (s.phase === "play") {
      s.seats[i] = { kind: "bot", bot: s.rules.bot, pid: keep ? x.pid : null, name: x.name, why };
      evs.push({ k: "bot", s: i, why });
      const g = s.game;
      if (this.alive().includes(i) && g.pend[i] === null) g.pend[i] = this.#botPick(i);
    } else {
      s.seats[i] = { kind: "empty" };
      evs.push({ k: "gone", s: i });
    }
    if (s.host === i) evs.push(...this.#newHost());
    if (s.phase === "play" && this.#allIn()) evs.push(...this.#resolve(now));
    return evs;
  }

  #newHost() {
    const s = this.s;
    const humans = s.seats.map((x, i) => [x, i]).filter(([x]) => x.kind === "human");
    const pick = humans.find(([x]) => x.on) || humans[0];
    s.host = pick ? pick[1] : null;
    return s.host === null ? [] : [{ k: "host", s: s.host }];
  }

  // ---- 화면이 보낸 메시지 ----

  /**
   * 자리 임자(또는 구경꾼)의 메시지. 돌려주는 값: { evs, emote }
   * 틀리면 Fail(WebSocket 오류 코드)을 던진다. 상태는 바뀌지 않는다
   */
  handle(pid, name, msg, now) {
    const s = this.s;
    const i = this.seatOf(pid);
    switch (msg && msg.t) {
      case "throw":
        return { evs: this.#throw(i, msg, now) };
      case "emote":
        if (i < 0) throw new Fail("phase");
        return { evs: [], emote: { s: i, e: checkEmote(msg.e) } };
      case "rules":
        this.#hostOnly(i);
        return { evs: this.#rules(msg.rules) };
      case "start":
        this.#hostOnly(i);
        return { evs: this.start(now) };
      case "sit":
        return { evs: this.#sit(i, pid, name, now) };
      default:
        throw new Fail("bad_request");
    }
  }

  #hostOnly(i) {
    if (i < 0 || this.s.host !== i) throw new Fail("not_host");
    if (this.s.phase === "play") throw new Fail("phase");
  }

  #sit(i, pid, name, now) {
    const s = this.s;
    if (i >= 0 || s.phase === "play") throw new Fail("phase");
    if (s.reserve) throw new Fail("full");
    const j = freeSeat(s.seats);
    if (j < 0) throw new Fail("full");
    s.seats[j] = human(pid, name, now, true);
    const evs = [{ k: "join", s: j }];
    if (s.host === null) {
      s.host = j;
      evs.push({ k: "host", s: j });
    }
    return evs;
  }

  #rules(input) {
    const s = this.s;
    const r = normRules(input);
    const humans = s.seats.map((x, i) => [x, i]).filter(([x]) => x.kind === "human");
    if (humans.length > r.seats) throw new Fail("bad_rules");
    // 사람은 되도록 제자리에, 자리가 줄면 앞쪽 빈자리로 옮긴다. 봇은 지운다
    const seats = Array.from({ length: r.seats }, () => ({ kind: "empty" }));
    const moved = new Map();
    for (const [x, i] of humans) if (i < r.seats) (seats[i] = x), moved.set(i, i);
    for (const [x, i] of humans) {
      if (i < r.seats) continue;
      const j = seats.findIndex((y) => y.kind === "empty");
      seats[j] = x;
      moved.set(i, j);
    }
    Object.assign(s, { rules: r, seats, phase: "lobby", game: null, host: moved.has(s.host) ? moved.get(s.host) : null });
    this._V = null;
    this._e = null;
    return [{ k: "rules" }];
  }

  // ---- 경기 ----

  /** 경기 시작(다시 하기도 같다). 빈자리는 봇. auto 면 랜덤 방에서 안 들어온 사람도 봇이 잇는다 */
  start(now, auto = false) {
    const s = this.s;
    const botId = s.rules.bot;
    s.seats = s.seats.map((x) => {
      if (x.kind === "empty") return { kind: "bot", bot: botId, pid: null, name: null, why: "fill" };
      if (auto && x.kind === "human" && !x.on) return { kind: "bot", bot: botId, pid: x.pid, name: x.name, why: "left" };
      return x;
    });
    s.reserve = null;
    s.startAt = null;
    s.phase = "play";
    s.game = { r: 0, rounds: [], pend: [], acted: [], deadline: null, paused: false, idle: 0, winner: null };
    this._e = null;
    if (s.host === null || s.seats[s.host].kind !== "human") this.#newHost();
    const evs = [{ k: "start" }];
    if (this.#open(now, false)) evs.push(...this.#resolve(now));
    return evs;
  }

  /**
   * 다음 판을 연다. 봇은 바로 낸다. 돌려주는 값: 바로 공개해도 되는지
   * (남은 자리가 다 봇인 group 은 사람이 구경하는 동안 끝까지 돈다. 사람이 한 명도 없는 경기는 멈춰 둔다)
   */
  #open(now, afterReveal) {
    const s = this.s;
    const g = s.game;
    g.r += 1;
    g.pend = s.seats.map(() => null);
    g.acted = s.seats.map(() => false);
    const t = s.rules.timer;
    g.deadline = g.paused || !t ? null : now + t * 1000 + (afterReveal ? REVEAL_MS : 0);
    for (const i of this.alive()) if (s.seats[i].kind === "bot") g.pend[i] = this.#botPick(i);
    if (!this.#allIn()) return false;
    if (this.group && s.seats.some((x) => x.kind === "human")) return true;
    g.paused = true;
    g.deadline = null;
    return false;
  }

  #allIn() {
    const g = this.s.game;
    return this.alive().every((i) => g.pend[i] !== null);
  }

  #throw(i, msg, now) {
    const s = this.s;
    if (s.phase !== "play" || i < 0) throw new Fail("phase");
    const g = s.game;
    if (msg.r !== g.r) throw new Fail("stale");
    if (!this.alive().includes(i)) throw new Fail("phase");
    if (g.pend[i] !== null) throw new Fail("already");
    g.pend[i] = handIndex(this.V, msg.h);
    g.acted[i] = true;
    g.idle = 0;
    s.seats[i].afk = 0;
    const evs = [{ k: "throw", s: i }];
    if (g.paused) {
      g.paused = false;
      g.deadline = s.rules.timer ? now + s.rules.timer * 1000 : null;
    }
    if (this.#allIn()) evs.push(...this.#resolve(now));
    return evs;
  }

  /** 모두 냈다: 공개하고, 끝났으면 end, 아니면 다음 판. 봇만 남은 group 은 끝까지 한 번에 돈다 */
  #resolve(now) {
    const s = this.s;
    const g = s.game;
    const first = g.r;
    let n = 0;
    for (;;) {
      const e = this.engine();
      if (this.group) {
        const throws = {};
        for (const i of e.alive) throws[i] = g.pend[i];
        e.play(throws);
        g.rounds.push(s.seats.map((_, i) => (i in throws ? throws[i] : null)));
      } else {
        e.play(g.pend[0], g.pend[1]);
        g.rounds.push([g.pend[0], g.pend[1]]);
      }
      n += 1;
      if (e.done || g.r >= ENDLESS_MAX) {
        s.phase = "end";
        g.deadline = null;
        g.paused = false;
        if (!this.group) g.winner = e.score[0] > e.score[1] ? 0 : e.score[1] > e.score[0] ? 1 : null;
        break;
      }
      if (!this.#open(now, true)) break;
      if (n >= BOT_RUN_MAX) {
        // 거의 없는 일: 봇끼리 너무 오래 비기면 멈춰 둔다
        g.paused = true;
        g.deadline = null;
        break;
      }
    }
    return [{ k: "reveal", r: first, n }];
  }

  /** 봇의 손. 시작 손(고집·돌림)은 자리마다 같고, 판마다 다른 난수를 쓴다(서버가 잠들었다 깨도 같은 값) */
  #botPick(i) {
    const s = this.s;
    const g = s.game;
    const V = this.V;
    if (this.group) return rngFor(s.seed, i, g.r).int(V.n);
    const rng = rngFor(s.seed, i);
    const bot = createBot(s.seats[i].bot, V, rng);
    for (let k = 0; k < g.r * 8; k++) rng.next();
    return bot.pick({ history: this.engine().historyFor(i) });
  }

  // ---- 시간 ----

  /** 시간이 된 일을 한다: 랜덤 방 시작, 끊긴 자리 60초, 손 낼 시간 */
  tick(now) {
    const s = this.s;
    const evs = [];
    if (s.phase === "lobby" && s.startAt !== null && now >= s.startAt) evs.push(...this.start(now, true));
    for (let i = 0; i < s.seats.length; i++) {
      const x = s.seats[i];
      if (x.kind !== "human" || x.on || x.off === null || now < x.off + GRACE_MS) continue;
      if (s.phase !== "play") evs.push(...this.#vacate(i, now, "left", false));
      else if (this.#otherHumanOn(i)) evs.push(...this.#vacate(i, now, "left", true));
    }
    const g = s.game;
    if (s.phase === "play" && g.deadline !== null && now >= g.deadline) evs.push(...this.#timeout(now));
    return evs;
  }

  #otherHumanOn(i) {
    return this.s.seats.some((x, j) => j !== i && x.kind === "human" && x.on);
  }

  /** 손 낼 시간이 지났다: 못 낸 사람은 아무 손이나. 3번 연달아 넘긴 사람은 봇이 잇고, 아무도 안 낸 판이 이어지면 멈춘다 */
  #timeout(now) {
    const s = this.s;
    const g = s.game;
    const alive = this.alive();
    const acted = alive.some((i) => s.seats[i].kind === "human" && g.acted[i]);
    const evs = [];
    for (const i of alive) {
      if (g.pend[i] !== null) continue;
      g.pend[i] = rngFor(s.seed, i, g.r, 7).int(this.V.n);
      if (s.seats[i].kind === "human") s.seats[i].afk += 1;
    }
    g.idle = acted ? 0 : g.idle + 1;
    if (acted) {
      for (const i of alive) {
        const x = s.seats[i];
        if (x.kind === "human" && x.afk >= AFK_LIMIT) {
          s.seats[i] = { kind: "bot", bot: s.rules.bot, pid: x.pid, name: x.name, why: "afk" };
          evs.push({ k: "bot", s: i, why: "afk" });
          if (s.host === i) evs.push(...this.#newHost());
        }
      }
    }
    if (g.idle >= IDLE_LIMIT) g.paused = true;
    evs.push(...this.#resolve(now));
    return evs;
  }

  /** 다음에 깨어나야 할 때(ms). 없으면 null. room-do.js 가 알람을 이 시각에 맞춘다 */
  nextWake() {
    const s = this.s;
    const t = [];
    if (s.cleanupAt !== null) t.push(s.cleanupAt);
    if (s.phase === "lobby" && s.startAt !== null) t.push(s.startAt);
    s.seats.forEach((x, i) => {
      if (x.kind !== "human" || x.on || x.off === null) return;
      if (s.phase !== "play" || this.#otherHumanOn(i)) t.push(x.off + GRACE_MS);
    });
    if (s.phase === "play" && s.game.deadline !== null) t.push(s.game.deadline);
    return t.length ? Math.min(...t) : null;
  }

  // ---- 보여 주기 ----

  /** you 자리(구경꾼은 null)에게 보낼 room. 남의 손은 공개 전까지 절대 안 싣는다 */
  view(you, watchers = 0) {
    const s = this.s;
    const g = s.game;
    const V = this.V;
    const e = this.engine();
    const id = (h) => (h === null || h === undefined ? null : V.hands[h].id);
    const alive = this.group && e ? e.alive.slice() : null;
    const seats = s.seats.map((x) => {
      if (x.kind === "human") return { kind: "human", name: x.name, on: x.on, until: x.on ? null : x.off + GRACE_MS };
      if (x.kind === "bot") return { kind: "bot", bot: this.group ? "random" : x.bot, name: x.name };
      return { kind: "empty" };
    });
    const round =
      s.phase === "play"
        ? { r: g.r, deadline: g.deadline, done: s.seats.map((_, i) => (alive && !alive.includes(i) ? null : g.pend[i] !== null)), paused: g.paused }
        : null;
    const mine = s.phase === "play" && you !== null && s.seats[you] && s.seats[you].kind === "human" ? id(g.pend[you]) : null;
    let hist = [];
    if (e) {
      const from = Math.max(0, e.rounds.length - HIST_MAX);
      hist = e.rounds.slice(from).map((r, k) => {
        const n = from + k + 1;
        if (!this.group) return { r: n, hands: [id(r.a), id(r.b)], cmp: r.cmp };
        return { r: n, hands: s.seats.map((_, i) => (i in r.throws ? id(r.throws[i]) : null)), win: id(r.winnerHand), out: r.out.slice() };
      });
    }
    return {
      code: s.code,
      phase: s.phase,
      random: s.random,
      rules: { ...s.rules, custom: s.rules.custom ? { ...s.rules.custom } : null },
      host: s.host,
      seats,
      watchers,
      round,
      mine,
      score: this.group ? null : e ? e.score.slice() : [0, 0],
      winner: !this.group && g && s.phase === "end" ? g.winner : null,
      alive,
      last: this.group && e && e.done ? e.last : null,
      hist,
    };
  }
}

/** 새로 앉을 자리: 빈자리, 없으면 처음부터 봇이던 자리 */
function freeSeat(seats) {
  const i = seats.findIndex((x) => x.kind === "empty");
  return i >= 0 ? i : seats.findIndex((x) => x.kind === "bot" && x.why === "fill");
}

/** 저장된 group 판([손|null, …])을 group.js 의 { 자리: 손 } 꼴로 */
function throwMap(arr) {
  const m = {};
  arr.forEach((h, i) => {
    if (h !== null) m[i] = h;
  });
  return m;
}
