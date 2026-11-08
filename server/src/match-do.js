// 랜덤 매칭 Durable Object. 게임·판 수마다 하나(이름 "classic:bo3" 같은 꼴).
// 기다리는 사람은 WebSocket 첨부(pid·이름·온 시각)로만 둔다. 저장소를 쓰지 않아 행 쓰기가 없다.
// 짝이 생기면 방을 만들어(두 자리를 두 사람 몫으로 잡아 둠) 둘에게 방 코드를 주고 연결을 닫는다.

import { DurableObject } from "cloudflare:workers";
import { refuse } from "./room-do.js";
import { makeCode } from "./check.js";
import { CLOSE, CODE_LEN, MATCH_TIMER, MSG_BURST, MSG_MAX, PING, PONG } from "./protocol.js";

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
    const me = { pid: q.get("pid"), name: q.get("name"), face: q.get("face") || null, game: q.get("game"), format: q.get("format"), at: Date.now() };
    if (!me.pid) return refuse("bad_request", CLOSE.bad_request);
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(me);
    for (const ws of this.#waiting(server)) if (att(ws).pid === me.pid) close(ws, CLOSE.replaced, "replaced");
    const partner = this.#waiting(server)
      .filter((ws) => att(ws).pid !== me.pid && !this.busy.has(att(ws).pid))
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
    // 봇과 하기: 혼자 방을 잡는다(빈자리는 시작할 때 봇이 앉는다)
    await this.#pair([ws]);
  }

  async webSocketClose(ws, code) {
    this.mem.delete(ws);
    close(ws, code === 1005 || code === 1006 ? 1000 : code, "bye");
  }

  async webSocketError(ws) {
    this.mem.delete(ws);
  }

  /** 짝(또는 혼자)으로 방을 만들고 방 코드를 준다. 먼저 온 사람이 0번 자리(방장) */
  async #pair(sockets) {
    const people = sockets.map((ws) => ({ pid: att(ws).pid, name: att(ws).name, face: att(ws).face ?? null }));
    const { game, format } = att(sockets[0]);
    for (const p of people) this.busy.add(p.pid);
    try {
      const code = await this.#makeRoom({ game, format, timer: MATCH_TIMER, bot: "human" }, people);
      for (const ws of sockets) {
        send(ws, { t: "matched", room: code, now: Date.now() });
        close(ws, CLOSE.matched, "matched");
      }
    } catch (e) {
      // 방을 못 만들면(한도 등) 계속 기다리게 두고 알린다
      console.error("match error", (e && e.stack) || e);
      for (const ws of sockets) send(ws, { t: "error", code: "busy" });
    } finally {
      for (const p of people) this.busy.delete(p.pid);
    }
  }

  async #makeRoom(rules, reserve) {
    for (let i = 0; i < TRIES; i++) {
      const code = makeCode(CODE_LEN.room);
      const stub = this.env.ROOMS.get(this.env.ROOMS.idFromName(code));
      const r = await stub.init({ code, rules, reserve, random: true });
      if (!r.taken) return code;
    }
    throw new Error("방 코드를 못 뽑았다");
  }

  #waiting(except = null) {
    return this.ctx.getWebSockets().filter((ws) => ws !== except && ws.readyState === 1);
  }
}
