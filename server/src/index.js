// Ultimate RSP 온라인 대전 서버의 입구(Cloudflare Worker).
// 출처와 값을 검사하고 맞는 Durable Object 로 넘긴다. 무거운 일은 하지 않는다. 주소와 메시지는 온라인 규약을 따른다.

import { Challenge } from "./challenge-do.js";
import { RoomHost, refuse } from "./room-do.js";
import { MatchQueue } from "./match-do.js";
import { makeChallenge } from "./challenge.js";
import { checkName, checkPid, makeCode, normCode } from "./check.js";
import { matrixIds, normRules, warmUp } from "./games.js";
import { Fail, allowedOrigin, checkVersion, json, originList, preflight, readBody } from "./http.js";
import { CLOSE, CODE_LEN, MATCH_FORMATS, PROTOCOL } from "./protocol.js";

export { Challenge, RoomHost, MatchQueue };

// 시작할 때(전역) 도감 변종을 컴파일해 둔다. 요청 안에서는 꺼내 쓰기만 한다(무료 플랜 CPU 10ms)
warmUp();

/** 새 코드가 이미 쓰이고 있을 때 다시 뽑는 횟수 */
const TRIES = 4;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const okOrigin = allowedOrigin(origin, originList(env)) ? origin : null;
    const now = Date.now();
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const parts = path.split("/").slice(1);
    // WebSocket 은 HTTP 오류를 화면이 못 읽으니, 받은 뒤 오류 메시지와 닫는 코드로 알린다
    if ((request.headers.get("Upgrade") || "").toLowerCase() === "websocket") return socketRoute(request, env, url, parts, okOrigin);
    try {
      if (request.method === "OPTIONS") return preflight(okOrigin);
      if (path === "/" && request.method === "GET") {
        return new Response("Ultimate RSP server\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
      if (path === "/robots.txt" && request.method === "GET") {
        // 검색 로봇은 hello 만 보게 한다(다른 주소는 출처 검사로 403 이라, 없으면 로봇이 전부 막힌 것으로 본다)
        return new Response("User-agent: *\nAllow: /api/hello\nDisallow: /\n", {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      if ((path === "/api/hello" || path === "/hello") && request.method === "GET") {
        // 규약 번호는 있을 때만 본다. 없으면 서버 번호를 알려 주고 화면이 맞춰 본다
        const v = url.searchParams.get("v");
        if (v !== null) checkVersion(v);
        return json({ ok: true, v: PROTOCOL, now }, 200, okOrigin);
      }
      if (!okOrigin) throw new Fail("origin");
      if (parts[0] === "api" && parts[1] === "c") return await challengeRoute(request, env, parts.slice(2), url, now, okOrigin);
      if (parts[0] === "api" && parts[1] === "rooms" && parts.length === 2 && request.method === "POST") {
        return await createRoom(request, env, now, okOrigin);
      }
      throw new Fail("not_found");
    } catch (e) {
      if (e instanceof Fail) return json({ error: e.code, ...(e.extra || {}), now }, e.status, okOrigin);
      console.error("server error", (e && e.stack) || e);
      return json({ error: "server", now }, 500, okOrigin);
    }
  },
};

function stub(ns, name) {
  return ns.get(ns.idFromName(name));
}

/** Durable Object 부르기. 한도에 닿거나 Cloudflare 쪽 탈이면 busy 로 답한다 */
async function callDO(fn) {
  try {
    return await fn();
  } catch (e) {
    console.error("durable object error", (e && e.stack) || e);
    throw new Fail("busy");
  }
}

function reply(r, now, origin) {
  if (r.error) {
    const { error, status, ...rest } = r;
    return json({ error, ...rest, now }, status || 400, origin);
  }
  return json({ ...r.view, now }, 200, origin);
}

// POST /api/c · GET /api/c/<코드> · POST /api/c/<코드>/answer
async function challengeRoute(request, env, rest, url, now, origin) {
  const m = request.method;
  if (rest.length === 0 && m === "POST") {
    const rec = makeChallenge(await readBody(request), now);
    for (let i = 0; i < TRIES; i++) {
      rec.code = makeCode(CODE_LEN.challenge);
      const r = await callDO(() => stub(env.CHALLENGES, rec.code).create(rec));
      if (!r.taken) return json({ code: rec.code, expires: rec.expires, now }, 201, origin);
    }
    throw new Fail("busy");
  }
  const code = normCode(rest[0], CODE_LEN.challenge);
  if (!code) throw new Fail("not_found");
  if (rest.length === 1 && m === "GET") {
    checkVersion(url.searchParams.get("v"));
    return reply(await callDO(() => stub(env.CHALLENGES, code).view()), now, origin);
  }
  if (rest.length === 2 && rest[1] === "answer" && m === "POST") {
    const body = await readBody(request);
    return reply(await callDO(() => stub(env.CHALLENGES, code).answer(body)), now, origin);
  }
  throw new Fail("not_found");
}

// POST /api/rooms: 새 방. 만든 사람이 방장(0번 자리)
async function createRoom(request, env, now, origin) {
  const body = await readBody(request);
  const host = { pid: checkPid(body.pid), name: checkName(body.name) };
  const rules = normRules(body.rules);
  for (let i = 0; i < TRIES; i++) {
    const code = makeCode(CODE_LEN.room);
    const r = await callDO(() => stub(env.ROOMS, code).init({ code, rules, host }));
    if (!r.taken) return json({ code, now }, 201, origin);
  }
  throw new Fail("busy");
}

// GET /api/rooms/<코드>/ws · GET /api/match/ws (WebSocket)
async function socketRoute(request, env, url, parts, okOrigin) {
  if (!okOrigin) return refuse("origin", CLOSE.origin);
  const q = url.searchParams;
  if (Number(q.get("v")) !== PROTOCOL) return refuse("version", CLOSE.version);
  let pid;
  let name;
  try {
    pid = checkPid(q.get("pid"));
    name = checkName(q.get("name"));
  } catch (e) {
    return refuse(e instanceof Fail ? e.code : "bad_request", CLOSE.bad_request);
  }
  let ns;
  let id;
  const fwd = new URL(url);
  fwd.searchParams.set("name", name);
  if (parts[0] === "api" && parts[1] === "rooms" && parts[3] === "ws" && parts.length === 4) {
    const code = normCode(parts[2], CODE_LEN.room);
    if (!code) return refuse("not_found", CLOSE.not_found);
    ns = env.ROOMS;
    id = code;
  } else if (parts[0] === "api" && parts[1] === "match" && parts[2] === "ws" && parts.length === 3) {
    const game = q.get("game");
    const format = q.get("format");
    if (!matrixIds().includes(game)) return refuse("bad_game", CLOSE.bad_request);
    if (!MATCH_FORMATS.includes(format)) return refuse("bad_rules", CLOSE.bad_request);
    ns = env.MATCH;
    id = `${game}:${format}`;
  } else {
    return refuse("not_found", CLOSE.not_found);
  }
  try {
    return await stub(ns, id).fetch(new Request(fwd, request));
  } catch (e) {
    console.error("durable object error", (e && e.stack) || e);
    return refuse("busy", CLOSE.busy);
  }
}
