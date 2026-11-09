// 로그인·계정 주소(규약 5장). 입구(index.js)가 넘긴다. 계정 저장은 Accounts DO 하나(account-do.js).
//  GET  /api/auth?v=1                     켜진 로그인 방법
//  POST /api/auth/<제공자>/start          웹: 로그인 창 주소를 받는다(화면이 그 주소로 간다)
//  GET  /api/auth/<제공자>/callback       제공자가 돌려보내는 곳(출처 머리 없음). 끝나면 화면 주소?login=<한 번 쓰는 코드>
//  POST /api/auth/redeem                  웹: 한 번 쓰는 코드 → 세션 토큰
//  POST /api/auth/<제공자>/token          앱·스팀: 그 플랫폼이 준 토큰 → 세션 토큰
//  POST /api/auth/signup                  처음 보는 로그인: 가입 화면(이름·처리방침 동의·만 14세 이상)을 마치고 계정을 만든다
//  POST /api/auth/email/signup|verify|login|reset|reset/confirm   이메일·비밀번호(비밀번호는 화면이 PBKDF2 로 바꿔 보낸다)
//  POST /api/account[/profile|/logout|/unlink|/delete]   세션 토큰으로 계정 보기·이름·로그아웃·로그인 떼기·지우기
// 세션 토큰은 쿠키가 아니라 본문으로 주고받는다(웹·앱·스팀이 같은 방식. text/plain POST 라 CORS 미리 묻기도 없다)

import { backWith, checkBack, checkCode, checkConsent, checkEmail, checkHandoff, checkKey, checkNonce, checkTicket, checkToken, isState } from "./account.js";
import { PROVIDERS, enabledProviders, pkceChallenge, providerOf, randomId, sha256Hex } from "./auth.js";
import { checkFace, checkName, checkPid } from "./check.js";
import { Fail, checkVersion, json, originList, readBody } from "./http.js";
import { mailReady, mailTest, mailText, sendMail } from "./mail.js";
import { PRIVACY_VERSION } from "./protocol.js";
import { ipTag } from "./rank.js";
import { ACCOUNT_HINT } from "./where.js";

const AUTH_BODY_MAX = 8192;

/** 계정 DO 는 하나. 처음 만들 때 동북아에 둔다 */
function accounts(env) {
  return env.ACCOUNTS.get(env.ACCOUNTS.idFromName("accounts-1"), { locationHint: ACCOUNT_HINT });
}

async function call(fn) {
  let r;
  try {
    r = await fn();
  } catch (e) {
    if (e instanceof Fail) throw e;
    console.error("accounts error", (e && e.stack) || e);
    throw new Fail("busy");
  }
  if (r && r.error) throw new Fail(r.error);
  return r;
}

const optName = (v) => (v === undefined || v === null ? null : checkName(v));

function redirect(to) {
  return new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** state 가 없거나 지나서 돌아갈 화면을 모를 때 보이는 쪽 */
function stalePage(env) {
  const home = typeof env.HOME === "string" && /^https:\/\//.test(env.HOME) ? env.HOME : "";
  const link = home ? `<p><a href="${esc(home)}">Ultimate RSP</a></p>` : "";
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ultimate RSP</title>
<p>로그인 시간이 지났거나 잘못된 주소다. 처음 화면에서 다시 해 보자.</p><p lang="en">This sign-in link has expired or is not valid. Please start again.</p>${link}</html>`;
  return new Response(html, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

const redirectUri = (url, p) => `${url.origin}/api/auth/${p}/callback`;

/** GET /api/auth/<제공자>/callback. 출처 검사보다 먼저 온다(제공자가 보내는 이동이라 Origin 머리가 없다) */
export async function authCallback(env, p, url) {
  const state = url.searchParams.get("state");
  if (!isState(state) || !Object.hasOwn(PROVIDERS, p)) return stalePage(env);
  const { data } = await call(() => accounts(env).takeAuth({ state, provider: p }));
  if (!data) return stalePage(env);
  if (url.searchParams.get("error")) {
    const e = url.searchParams.get("error");
    return redirect(backWith(data.back, "login_error", e === "access_denied" ? "cancel" : "provider"));
  }
  const code = url.searchParams.get("code");
  if (!code || code.length > 2048) return redirect(backWith(data.back, "login_error", "provider"));
  let sub;
  try {
    const provider = providerOf(p, env, url);
    sub = await provider.exchange(env, { code, redirectUri: redirectUri(url, p), verifier: data.verifier, nonce: data.oidcNonce, fetch, now: Date.now() });
  } catch (e) {
    if (!(e instanceof Fail)) console.error("login exchange", (e && e.stack) || e);
    return redirect(backWith(data.back, "login_error", "provider"));
  }
  try {
    const r = await call(() =>
      accounts(env).login({ provider: p, sub, pid: data.pid, link: data.link, name: data.name, face: data.face, nonceHash: data.nonceHash, direct: false }),
    );
    return redirect(backWith(data.back, "login", r.code));
  } catch (e) {
    return redirect(backWith(data.back, "login_error", e instanceof Fail ? e.code : "server"));
  }
}

/** /api/auth… (출처 검사 뒤) */
export async function authRoute(request, env, rest, url, now, origin) {
  const m = request.method;
  if (rest.length === 0 && m === "GET") {
    checkVersion(url.searchParams.get("v"));
    const providers = enabledProviders(env, url);
    if (mailReady(env, url)) providers.push("email");
    return json({ providers, policy: PRIVACY_VERSION, now }, 200, origin);
  }
  if (rest.length === 1 && rest[0] === "signup" && m === "POST") {
    const body = await readBody(request);
    const ticket = checkTicket(body.ticket);
    const name = checkName(body.name);
    const face = checkFace(body.face);
    const consent = checkConsent(body);
    const r = await call(() => accounts(env).signup({ ticket, name, face, consent }));
    return json({ ...r, now }, 200, origin);
  }
  if (rest[0] === "email" && m === "POST") return emailRoute(request, env, rest.slice(1), url, now, origin);
  if (rest.length === 1 && rest[0] === "redeem" && m === "POST") {
    const body = await readBody(request);
    const code = checkHandoff(body.code);
    const nonceHash = await sha256Hex(checkNonce(body.nonce));
    const r = await call(() => accounts(env).redeem({ code, nonceHash }));
    return json({ ...r, now }, 200, origin);
  }
  if (rest.length === 2 && rest[1] === "start" && m === "POST") {
    const p = rest[0];
    const provider = providerOf(p, env, url);
    const body = await readBody(request);
    const pid = checkPid(body.pid);
    const back = checkBack(body.back, originList(env));
    const nonce = checkNonce(body.nonce);
    const token = body.token === undefined || body.token === null ? null : checkToken(body.token);
    const name = optName(body.name);
    const face = checkFace(body.face);
    const state = randomId(32);
    const verifier = randomId(32);
    const oidcNonce = randomId(16);
    // 주소를 먼저 만든다(틀린 값이면 저장 전에 멈춘다)
    const to = provider.authorizeUrl(env, { redirectUri: redirectUri(url, p), state, challenge: await pkceChallenge(verifier), nonce: oidcNonce, testSub: body.testSub });
    const nonceHash = await sha256Hex(nonce);
    await call(() => accounts(env).beginAuth({ state, provider: p, pid, back, nonceHash, verifier, oidcNonce, name, face, token }));
    return json({ url: to, now }, 200, origin);
  }
  if (rest.length === 2 && rest[1] === "token" && m === "POST") {
    const p = rest[0];
    const provider = providerOf(p, env, url);
    if (typeof provider.verify !== "function") throw new Fail("no_provider");
    // 플랫폼 토큰(구글 ID 토큰·스팀 티켓)은 길어서 본문 상한을 늘린다
    const body = await readBody(request, AUTH_BODY_MAX);
    const pid = checkPid(body.pid);
    const linkToken = body.token === undefined || body.token === null ? null : checkToken(body.token);
    const name = optName(body.name);
    const face = checkFace(body.face);
    const sub = await provider.verify(env, { credential: body.credential, fetch, now });
    const r = await call(() => accounts(env).login({ provider: p, sub, pid, linkToken, name, face, direct: true }));
    return json({ ...r, now }, 200, origin);
  }
  throw new Fail("not_found");
}

/** /api/account… (출처 검사 뒤). 모두 POST {v, token, …} */
export async function accountRoute(request, env, rest, now, origin) {
  if (request.method !== "POST" || rest.length > 1) throw new Fail("not_found");
  const body = await readBody(request);
  const token = checkToken(body.token);
  const what = rest[0] || "";
  let r;
  if (what === "") r = await call(() => accounts(env).me({ token }));
  else if (what === "profile") {
    const name = checkName(body.name);
    const face = checkFace(body.face);
    r = await call(() => accounts(env).setProfile({ token, name, face }));
  }
  else if (what === "logout") r = await call(() => accounts(env).logout({ token }));
  else if (what === "unlink") {
    if (typeof body.provider !== "string" || (!Object.hasOwn(PROVIDERS, body.provider) && body.provider !== "email")) throw new Fail("bad_request");
    r = await call(() => accounts(env).unlink({ token, provider: body.provider }));
  } else if (what === "delete") r = await call(() => accounts(env).remove({ token }));
  else throw new Fail("not_found");
  return json({ ...r, now }, 200, origin);
}

/** 메일을 보낸다(로컬 시험이면 보내지 않고 코드를 답에 싣는다) */
async function deliver(env, url, email, mail) {
  if (!mail) return {};
  if (mailTest(env, url)) return { devKind: mail.kind, devCode: mail.code ?? null };
  await sendMail(env, { to: email, ...mailText(mail.kind, mail.code) });
  return {};
}

/** /api/auth/email/… 이메일·비밀번호 */
async function emailRoute(request, env, rest, url, now, origin) {
  if (!mailReady(env, url)) throw new Fail("no_provider");
  const what = rest.join("/");
  const body = await readBody(request);
  const email = checkEmail(body.email);
  const ip = await ipTag(request.headers.get("CF-Connecting-IP"), now);
  if (what === "signup") {
    const key = checkKey(body.key);
    const pid = checkPid(body.pid);
    const token = body.token === undefined || body.token === null ? null : checkToken(body.token);
    // 로그인한 채 더하기(token)면 계정이 이미 있으니 이름·동의는 묻지 않는다
    const name = token ? null : checkName(body.name);
    const face = token ? null : checkFace(body.face);
    const consent = token ? null : checkConsent(body);
    const r = await call(() => accounts(env).emailSignup({ email, key, pid, name, face, consent, token, ip }));
    return json({ sent: true, ...(await deliver(env, url, email, r.mail)), now }, 200, origin);
  }
  if (what === "verify") {
    const code = checkCode(body.code);
    const r = await call(() => accounts(env).emailVerify({ email, code }));
    return json({ ...r, now }, 200, origin);
  }
  if (what === "login") {
    const key = checkKey(body.key);
    const r = await call(() => accounts(env).emailLogin({ email, key, ip }));
    return json({ ...r, now }, 200, origin);
  }
  if (what === "reset") {
    const r = await call(() => accounts(env).emailReset({ email, ip }));
    return json({ sent: true, ...(await deliver(env, url, email, r.mail)), now }, 200, origin);
  }
  if (what === "reset/confirm") {
    const code = checkCode(body.code);
    const key = checkKey(body.key);
    const r = await call(() => accounts(env).emailResetConfirm({ email, code, key }));
    return json({ ...r, now }, 200, origin);
  }
  throw new Fail("not_found");
}
