// 랜덤 매칭 Durable Object. 게임·판 수마다 하나(이름 "2:classic:bo3" 같은 꼴).
// 기다리는 사람은 WebSocket 첨부(pid·이름·온 시각)로만 둔다. 저장소를 쓰지 않아 행 쓰기가 없다.
// 짝이 생기면 방을 만들어(두 자리를 두 사람 몫으로 잡아 둠) 둘에게 방 코드를 주고 연결을 닫는다.
// 여럿이 가위바위보 대기열(이름 "2:group:<바탕>:<정하기>")은 최대 인원이 차면 바로, 최소 인원이 모이면 알람으로
// 잠깐 더 기다린 뒤 그때 모인 사람으로 방을 만든다(queue.js). 알람 하나만 저장소에 둔다.

import { DurableObject } from "cloudflare:workers";
import { refuse } from "./room-do.js";
import { makeCode } from "./check.js";
import { pairHint } from "./where.js";
import { groupDue, groupPlan, groupSeatRange, groupSeatsWithBots } from "./queue.js";
import { sameHome } from "./rank.js";
import { CLOSE, CODE_LEN, GROUP_MATCH_WAIT_MS, MATCH_TIMER, MSG_BURST, MSG_MAX, PING, PONG } from "./protocol.js";

const TRIES = 4;

function send(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    // 이미 닫힌 연결
  }
}

function close(ws, code, reason) {
  try {
    ws.close(code, reason);
  } catch {
    // 이미 닫힘
  }
}

function att(ws) {
  return ws.deserializeAttachment() || {};
}

/** 방이 정해졌다: 첨부에 적어 두고(닫기가 늦게 닿아도 다시 안 고른다) 방 코드를 주고 닫는다 */
function done(ws, code) {
  try {
    ws.serializeAttachment({ ...att(ws), matched: code });
  } catch {
    // 이미 닫힌 연결
  }
  send(ws, { t: "matched", room: code, now: Date.now() });
  close(ws, CLOSE.matched, "matched");
}

export class MatchQueue extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    /** 방을 만드는 중인 pid(그동안 다른 사람과 또 짝이 되지 않게) */
    this.busy = new Set();
    this.mem = new Map();
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  /** 대기열에 들어오기. 입구가 출처·규약 번호·pid·이름·게임·판 수를 이미 봤다 */
  async fetch(request) {
    const q = new URL(request.url).searchParams;
    const me = { pid: q.get("pid"), name: q.get("name"), face: q.get("face") || null, place: q.get("place") || null, ip: q.get("ip") || null, game: q.get("game"), format: q.get("format"), at: Date.now() };
    if (me.game === "group") Object.assign(me, { base: q.get("base"), mode: q.get("mode") });
    if (!me.pid) return refuse("bad_request", CLOSE.bad_request);
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(me);
    for (const ws of this.#waiting(server)) if (att(ws).pid === me.pid) close(ws, CLOSE.replaced, "replaced");
    if (me.game === "group") {
      // 연결을 먼저 돌려준 뒤에 센다(방을 만들면 그 안에서 닫는다)
      this.ctx.waitUntil(this.#groupCheck());
      return new Response(null, { status: 101, webSocket: client });
    }
    const partner = this.#waiting(server)
      .filter((ws) => att(ws).pid !== me.pid && !this.busy.has(att(ws).pid) && !att(ws).matched)
      .sort((a, b) => att(a).at - att(b).at)[0];
    if (partner) {
      // 연결을 먼저 돌려준 뒤에 짝을 맺는다(fetch 안에서 방을 만들고 닫으면 닫기가 화면에 안 닿는다)
      this.busy.add(me.pid).add(att(partner).pid);
      this.ctx.waitUntil(this.#pair([partner, server]));
    } else send(server, { t: "queued", now: Date.now() });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const m = this.mem.get(ws) || { since: Date.now(), n: 0 };
    this.mem.set(ws, m);
    if (Date.now() - m.since > MSG_BURST.ms) Object.assign(m, { since: Date.now(), n: 0 });
    if (++m.n > MSG_BURST.count) return close(ws, CLOSE.too_fast, "too_fast");
    let msg = null;
    try {
      if (typeof message === "string" && message.length <= MSG_MAX) msg = JSON.parse(message);
    } catch {
      msg = null;
    }
    if (!msg || msg.t !== "bot") return send(ws, { t: "error", code: "bad_request" });
    if (this.busy.has(att(ws).pid)) return;
    if (att(ws).game === "group") {
      // 여럿이 봇과 하기: 지금 기다리는 사람을 다 데려가고(부른 사람 먼저) 모자란 자리는 봇
      const range = groupSeatRange(att(ws).base);
      const rest = this.#free().filter((x) => x !== ws);
      if (await this.#groupStart([ws, ...rest].slice(0, range.max), groupSeatsWithBots(rest.length + 1, range))) await this.#groupCheck();
      return;
    }
    // 봇과 하기: 혼자 방을 잡는다(빈자리는 시작할 때 봇이 앉는다)
    await this.#pair([ws]);
  }

  async webSocketClose(ws, code) {
    this.mem.delete(ws);
    const group = att(ws).game === "group";
    close(ws, code === 1005 || code === 1006 ? 1000 : code, "bye");
    // 여럿이 대기열: 남은 사람들에게 몇 명인지 다시 알린다(최소 인원 아래로 떨어지면 알람도 지운다)
    if (group) await this.#groupCheck();
  }

  async webSocketError(ws) {
    this.mem.delete(ws);
  }

  /** 여럿이 대기열의 알람: 최소 인원이 남아 있으면 그 사람들로 시작 */
  async alarm() {
    const list = this.#free();
    if (!list.length) return;
    const n = groupDue(list.length, groupSeatRange(att(list[0]).base));
    if (n && !(await this.#groupStart(list.slice(0, n), n))) return this.ctx.storage.setAlarm(Date.now() + GROUP_MATCH_WAIT_MS);
    await this.#groupCheck();
  }

  /** 여럿이 대기열: 다 찼으면 시작, 최소 인원이면 알람을 걸고, 기다리는 사람들에게 몇 명인지 알린다 */
  async #groupCheck() {
    let list = this.#free();
    const range = list.length ? groupSeatRange(att(list[0]).base) : null;
    const was = await this.ctx.storage.getAlarm();
    if (!range) {
      if (was !== null) await this.ctx.storage.deleteAlarm();
      return;
    }
    const plan = groupPlan(list.length, range, was, Date.now());
    if (plan.start) {
      if (await this.#groupStart(list.slice(0, plan.start), plan.start)) return this.#groupCheck();
      // 방을 못 만들었다(한도 등). 되풀이하지 않고 잠시 뒤 알람으로 다시
      return this.ctx.storage.setAlarm(Date.now() + GROUP_MATCH_WAIT_MS);
    }
    if (plan.alarm !== was) {
      if (plan.alarm === null) await this.ctx.storage.deleteAlarm();
      else await this.ctx.storage.setAlarm(plan.alarm);
    }
    list = this.#free();
    for (const ws of list) send(ws, { t: "queued", n: list.length, min: range.min, max: range.max, start: plan.alarm, now: Date.now() });
  }

  /** 여럿이 방을 만들고 방 코드를 준다. 먼저 온 사람이 0번 자리(방장), seats 가 사람보다 많으면 시작할 때 봇이 앉는다. 됐으면 true */
  async #groupStart(sockets, seats) {
    const people = sockets.map((ws) => ({ pid: att(ws).pid, name: att(ws).name, face: att(ws).face ?? null, home: att(ws).ip ?? null }));
    const { base, mode } = att(sockets[0]);
    for (const p of people) this.busy.add(p.pid);
    try {
      const hint = pairHint(sockets.map((ws) => att(ws).place));
      const code = await this.#makeRoom({ game: "group", base, mode, seats, timer: MATCH_TIMER, bot: "human" }, people, hint);
      for (const ws of sockets) done(ws, code);
      return true;
    } catch (e) {
      console.error("match error", (e && e.stack) || e);
      for (const ws of sockets) send(ws, { t: "error", code: "busy" });
      return false;
    } finally {
      for (const p of people) this.busy.delete(p.pid);
    }
  }

  /** 기다리는 사람 중 방을 만드는 중이거나 이미 방이 정해진 사람을 뺀 사람, 온 차례대로 */
  #free() {
    return this.#waiting()
      .filter((ws) => !this.busy.has(att(ws).pid) && !att(ws).matched)
      .sort((a, b) => att(a).at - att(b).at);
  }

  /** 짝(또는 혼자)으로 방을 만들고 방 코드를 준다. 먼저 온 사람이 0번 자리(방장) */
  async #pair(sockets) {
    const people = sockets.map((ws) => ({ pid: att(ws).pid, name: att(ws).name, face: att(ws).face ?? null, home: att(ws).ip ?? null }));
    const { game, format } = att(sockets[0]);
    for (const p of people) this.busy.add(p.pid);
    try {
      const hint = pairHint(sockets.map((ws) => att(ws).place));
      const ranked = !sameHome(sockets.map((ws) => att(ws).ip));
      const code = await this.#makeRoom({ game, format, timer: MATCH_TIMER, bot: "human" }, people, hint, ranked);
      for (const ws of sockets) done(ws, code);
    } catch (e) {
      // 방을 못 만들면(한도 등) 계속 기다리게 두고 알린다
      console.error("match error", (e && e.stack) || e);
      for (const ws of sockets) send(ws, { t: "error", code: "busy" });
    } finally {
      for (const p of people) this.busy.delete(p.pid);
    }
  }

  /** 방은 두 사람 가까이 생기게 힌트를 준다(없으면 대기열 가까이) */
  async #makeRoom(rules, reserve, hint = null, ranked = true) {
    for (let i = 0; i < TRIES; i++) {
      const code = makeCode(CODE_LEN.room);
      const id = this.env.ROOMS.idFromName(code);
      const stub = hint ? this.env.ROOMS.get(id, { locationHint: hint }) : this.env.ROOMS.get(id);
      const r = await stub.init({ code, rules, reserve, random: true, ranked });
      if (!r.taken) return code;
    }
    throw new Error("방 코드를 못 뽑았다");
  }

  #waiting(except = null) {
    return this.ctx.getWebSockets().filter((ws) => ws !== except && ws.readyState === 1);
  }
}
