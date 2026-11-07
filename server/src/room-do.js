// 방 Durable Object. 방 코드 하나에 하나. 규칙은 room.js, 여기는 연결·저장·알람만 한다.
// WebSocket Hibernation: 메시지가 없으면 잠들고(요금 없음), 메시지·알람이 오면 깨어 저장된 상태로 이어 간다.
// 저장은 키 하나("room")에 상태 전체, 알람은 하나(가장 이른 할 일)만 둔다. 연결마다 pid·이름은 첨부(attachment)에 둔다.

import { DurableObject } from "cloudflare:workers";
import { Room } from "./room.js";
import { Fail } from "./http.js";
import { CLOSE, EMOTE_GAP_MS, MSG_BURST, MSG_MAX, PING, PONG, PROTOCOL, ROOM_DELETE_MS, ROOM_SOCKETS } from "./protocol.js";

const KEY = "room";

function send(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    // 이미 닫힌 연결
  }
}

/** 받기 전에 오류를 알리고 닫는다(잠들지 않는 짧은 연결) */
export function refuse(code, closeCode) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  send(server, { t: "error", code });
  server.close(closeCode, code);
  return new Response(null, { status: 101, webSocket: client });
}

export class RoomHost extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    /** 연결마다 메시지 수·이모트 시각(잠들면 사라져도 된다) */
    this.mem = new Map();
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    ctx.blockConcurrencyWhile(async () => {
      const s = await ctx.storage.get(KEY);
      if (s) this.room = new Room(s);
    });
  }

  /** 입구·매칭이 부른다: 새 방. 이미 쓰는 코드면 { taken: true } */
  async init({ code, rules, host = null, reserve = null, random = false }) {
    if (this.room) return { taken: true };
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    this.room = Room.create({ code, rules, now: Date.now(), seed, host, reserve, random });
    await this.#commit();
    return { taken: false };
  }

  /** WebSocket 들어오기. 입구가 출처·규약 번호·pid·이름 꼴을 이미 봤다 */
  async fetch(request) {
    const url = new URL(request.url);
    const pid = url.searchParams.get("pid");
    const name = url.searchParams.get("name");
    if (!this.room) return refuse("not_found", CLOSE.not_found);
    const open = this.#sockets();
    const same = open.filter((ws) => att(ws).pid === pid);
    if (!same.length && open.length >= ROOM_SOCKETS) return refuse("full", CLOSE.full);

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ pid, name });
    for (const ws of same) {
      try {
        ws.close(CLOSE.replaced, "replaced");
      } catch {
        // 이미 닫힘
      }
    }
    const now = Date.now();
    const { seat, evs } = this.room.join(pid, name, now);
    send(server, { t: "hello", v: PROTOCOL, now, you: seat, room: this.room.view(seat, this.#watchers()) });
    await this.#commit(evs, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (!this.room) {
      ws.close(CLOSE.deleted, "deleted");
      return;
    }
    const now = Date.now();
    const m = this.#mem(ws);
    if (now - m.since > MSG_BURST.ms) Object.assign(m, { since: now, n: 0 });
    m.n += 1;
    if (m.n > MSG_BURST.count) {
      ws.close(CLOSE.too_fast, "too_fast");
      return;
    }
    if (typeof message !== "string" || message.length > MSG_MAX) return send(ws, { t: "error", code: "bad_request" });
    let msg;
    try {
      msg = JSON.parse(message);
    } catch {
      return send(ws, { t: "error", code: "bad_request" });
    }
    const { pid, name } = att(ws);
    if (msg && msg.t === "emote" && now - m.emoteAt < EMOTE_GAP_MS) return;
    let out;
    try {
      out = this.room.handle(pid, name, msg, now);
    } catch (e) {
      if (e instanceof Fail) return send(ws, { t: "error", code: e.code });
      // 규칙 코드의 탈: 반쯤 바뀐 상태를 버리고 저장된 상태로 돌아간다
      console.error("room error", (e && e.stack) || e);
      this.room = new Room(await this.ctx.storage.get(KEY));
      return send(ws, { t: "error", code: "server" });
    }
    if (out.emote) {
      m.emoteAt = now;
      for (const o of this.#sockets()) send(o, { t: "emote", ...out.emote });
      return;
    }
    if (out.evs.length) await this.#commit(out.evs);
  }

  async webSocketClose(ws, code) {
    await this.#gone(ws, code === CLOSE.leave);
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, "bye");
    } catch {
      // 이미 닫힘
    }
  }

  async webSocketError(ws) {
    await this.#gone(ws, false);
  }

  async #gone(ws, explicit) {
    this.mem.delete(ws);
    if (!this.room) return;
    const { pid } = att(ws);
    const rest = this.#sockets(ws);
    // 같은 pid 가 다른 탭으로 다시 붙어서 닫힌 것이면 자리는 그대로
    if (rest.some((o) => att(o).pid === pid)) return;
    const now = Date.now();
    const evs = this.room.leave(pid, now, explicit);
    if (!rest.length) this.room.s.cleanupAt = now + ROOM_DELETE_MS;
    await this.#commit(evs, ws);
  }

  async alarm() {
    if (!this.room) return;
    const now = Date.now();
    const s = this.room.s;
    s.alarm = null;
    const open = this.#sockets();
    if (s.cleanupAt !== null && now >= s.cleanupAt) {
      if (!open.length) {
        this.room = null;
        await this.ctx.storage.deleteAll();
        return;
      }
      s.cleanupAt = null;
    }
    await this.#commit(this.room.tick(now));
  }

  /** 알람을 가장 이른 할 일에 맞추고, 상태를 저장하고, 모두에게 알린다 */
  async #commit(evs = [], except = null) {
    const r = this.room;
    const next = r.nextWake();
    if (next !== r.s.alarm) {
      if (next === null) await this.ctx.storage.deleteAlarm();
      else await this.ctx.storage.setAlarm(next);
      r.s.alarm = next;
    }
    await this.ctx.storage.put(KEY, r.s);
    if (!evs.length) return;
    const now = Date.now();
    const watchers = this.#watchers();
    for (const ws of this.#sockets(except)) {
      const seat = r.seatOf(att(ws).pid);
      const you = seat < 0 ? null : seat;
      const room = r.view(you, watchers);
      for (const ev of evs) send(ws, { t: "state", now, you, room, ev });
    }
  }

  #sockets(except = null) {
    return this.ctx.getWebSockets().filter((ws) => ws !== except && ws.readyState === 1);
  }

  #watchers() {
    return this.#sockets().filter((ws) => this.room.seatOf(att(ws).pid) < 0).length;
  }

  #mem(ws) {
    let m = this.mem.get(ws);
    if (!m) this.mem.set(ws, (m = { since: Date.now(), n: 0, emoteAt: 0 }));
    return m;
  }
}

function att(ws) {
  return ws.deserializeAttachment() || {};
}
