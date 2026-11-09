// HTTP 응답, CORS, 오류. 서버는 늘 JSON 으로 답한다.

import { BODY_MAX, ERRORS, ORIGINS, PROTOCOL } from "./protocol.js";

export { PROTOCOL };

const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

/** 규약의 오류. code 는 화면이 보는 오류 코드(protocol.js 의 ERRORS), extra 는 응답에 더 실을 값 */
export class Fail extends Error {
  constructor(code, extra = null) {
    super(code);
    this.code = code;
    this.status = ERRORS[code] || 400;
    this.extra = extra;
  }
}

export function originList(env) {
  const s = env && typeof env.ORIGINS === "string" ? env.ORIGINS : "";
  const list = s.split(",").map((x) => x.trim()).filter(Boolean);
  return list.length ? list : ORIGINS;
}

export function allowedOrigin(origin, list = ORIGINS) {
  if (!origin) return false;
  return list.includes(origin) || LOCAL.test(origin);
}

function corsHeaders(origin) {
  if (!origin) return { Vary: "Origin" };
  return {
    Vary: "Origin",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

/** origin: 허용된 출처일 때만 넘긴다(그때만 CORS 머리를 단다) */
export function json(data, status = 200, origin = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
    },
  });
}

export function preflight(origin) {
  return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });
}

/** 규약 번호 검사. 문자열("1")이나 숫자(1) 모두 받는다 */
export function checkVersion(v) {
  if (Number(v) !== PROTOCOL) throw new Fail("version", { v: PROTOCOL });
}

/** POST 본문(JSON)을 읽는다. Content-Type 은 보지 않는다(화면은 text/plain 으로 보낸다). max: 바이트 상한(로그인 토큰은 더 길다) */
export async function readBody(request, max = BODY_MAX) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > max) throw new Fail("bad_request");
  const text = await request.text();
  if (text.length > max) throw new Fail("bad_request");
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Fail("bad_request");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Fail("bad_request");
  checkVersion(body.v);
  return body;
}
