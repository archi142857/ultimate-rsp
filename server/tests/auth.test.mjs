// 로그인(auth.js·account.js): 토큰 꼴, PKCE, ID 토큰 확인(위조·만료·받는 쪽), 제공자, 로그인 정하기, 돌아갈 주소.
// Cloudflare 없이 돈다. 제공자 서버는 가짜 fetch 로 흉내 낸다.

import test from "node:test";
import assert from "node:assert/strict";
import { b64url, unb64url, randomId, sha256Hex, hmacHex, pkceChallenge, verifyJwt, clearJwks, PROVIDERS, enabledProviders, providerOf } from "../src/auth.js";
import { planLogin, checkBack, backWith, checkNonce, checkToken, checkHandoff, isState, newPid, checkEmail, checkKey, checkCode, checkConsent, checkTicket, newCode } from "../src/account.js";
import { mailReady, mailTest, mailText, sendMail } from "../src/mail.js";
import { Fail } from "../src/http.js";
import { AUTH_PROVIDERS, EMAIL_KDF, PRIVACY_VERSION } from "../src/protocol.js";

const enc = new TextEncoder();
const NOW = 1_800_000_000_000;

async function failCode(fn) {
  try {
    await fn();
  } catch (e) {
    assert.ok(e instanceof Fail, `Fail 이 아닌 오류: ${e && e.stack}`);
    return e.code;
  }
  return null;
}

// ---- 시험용 RSA 열쇠와 ID 토큰 ----

const pair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const other = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);
const JWKS = { keys: [{ kty: "RSA", kid: "k1", use: "sig", alg: "RS256", n: pub.n, e: pub.e }] };
const JWKS_URL = "https://example.test/jwks";

const part = (o) => b64url(enc.encode(JSON.stringify(o)));
async function sign(header, payload, key = pair.privateKey) {
  const head = `${part(header)}.${part(payload)}`;
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(head)));
  return `${head}.${b64url(sig)}`;
}
const goodHead = { alg: "RS256", kid: "k1", typ: "JWT" };
const goodBody = (extra = {}) => ({ iss: "https://accounts.google.com", aud: "web-client", sub: "1234567890", iat: NOW / 1000 - 10, exp: NOW / 1000 + 3600, nonce: "n0nce", ...extra });

function fakeFetch(routes, calls = []) {
  return async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    const r = routes[u.split("?")[0]];
    if (!r) return new Response("no route", { status: 404 });
    const out = typeof r === "function" ? await r(u, init) : r;
    return new Response(JSON.stringify(out.body ?? out), { status: out.status ?? 200, headers: { "Content-Type": "application/json" } });
  };
}

const opts = (f, extra = {}) => ({ jwks: JWKS_URL, issuers: ["https://accounts.google.com"], audiences: ["web-client"], now: NOW, fetch: f, ...extra });

test("base64url·무작위 값·해시: 꼴과 알려진 값", async () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
  assert.deepEqual(unb64url(b64url(bytes)), bytes);
  assert.doesNotMatch(b64url(bytes), /[+/=]/);
  assert.match(randomId(16), /^[A-Za-z0-9_-]{22}$/);
  assert.match(randomId(32), /^[A-Za-z0-9_-]{43}$/);
  assert.match(newPid(), /^[A-Za-z0-9_-]{22}$/, "화면 pid 꼴(22자)과 같다");
  assert.notEqual(randomId(), randomId());
  assert.throws(() => unb64url("a+b"));
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  // RFC 4231 시험 1
  assert.equal(await hmacHex("0b".repeat(20), "Hi There"), "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
  // RFC 7636 부록 B
  assert.equal(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("ID 토큰: 바른 토큰은 통과하고 열쇠 목록은 한 번만 받는다", async () => {
  clearJwks();
  const calls = [];
  const f = fakeFetch({ [JWKS_URL]: JWKS }, calls);
  const t = await sign(goodHead, goodBody());
  const p = await verifyJwt(t, opts(f, { nonce: "n0nce" }));
  assert.equal(p.sub, "1234567890");
  await verifyJwt(t, opts(f));
  assert.equal(calls.length, 1, "받아 둔 열쇠를 다시 쓴다");
  assert.equal((await verifyJwt(await sign(goodHead, goodBody({ aud: ["x", "web-client"] })), opts(f))).sub, "1234567890", "aud 가 목록이어도");
});

test("ID 토큰: 위조·바꿔치기·만료·받는 쪽·nonce·sub 는 bad_login", async () => {
  clearJwks();
  const f = fakeFetch({ [JWKS_URL]: JWKS });
  const t = await sign(goodHead, goodBody());
  const [h, b, s] = t.split(".");
  const cases = {
    "다른 열쇠로 서명": await sign(goodHead, goodBody(), other.privateKey),
    "내용 바꿔치기": `${h}.${part(goodBody({ sub: "attacker" }))}.${s}`,
    "서명 없음(alg none)": `${part({ alg: "none", kid: "k1" })}.${b}.`,
    "HS256 머리": `${part({ alg: "HS256", kid: "k1" })}.${b}.${s}`,
    "kid 없음": `${part({ alg: "RS256" })}.${b}.${s}`,
    "다른 발급자": await sign(goodHead, goodBody({ iss: "https://evil.test" })),
    "다른 받는 쪽": await sign(goodHead, goodBody({ aud: "someone-else" })),
    "만료": await sign(goodHead, goodBody({ exp: NOW / 1000 - 3600 })),
    "앞으로 발급": await sign(goodHead, goodBody({ iat: NOW / 1000 + 3600 })),
    "sub 없음": await sign(goodHead, goodBody({ sub: "" })),
    "exp 없음": await sign(goodHead, goodBody({ exp: undefined })),
    "조각 둘": `${h}.${b}`,
    "base64 아님": `${h}.${b}.**`,
    "너무 김": "a".repeat(9000),
    "문자열 아님": 42,
  };
  for (const [name, tok] of Object.entries(cases)) assert.equal(await failCode(() => verifyJwt(tok, opts(f))), "bad_login", name);
  assert.equal(await failCode(() => verifyJwt(t, opts(f, { nonce: "other" }))), "bad_login", "nonce 가 다르면");
  assert.equal(await failCode(() => verifyJwt(t, opts(f, { audiences: [] }))), "bad_login", "받는 쪽 목록이 비면 아무것도 안 받는다");
});

test("ID 토큰: 모르는 kid 로 열쇠 목록을 계속 다시 받게 하지 못한다(5분에 한 번), 열쇠가 바뀌면 받는다", async () => {
  clearJwks();
  const calls = [];
  let jwks = JWKS;
  const f = fakeFetch({ [JWKS_URL]: () => jwks }, calls);
  await verifyJwt(await sign(goodHead, goodBody()), opts(f));
  const unknown = await sign({ ...goodHead, kid: "k2" }, goodBody());
  for (let i = 0; i < 5; i++) assert.equal(await failCode(() => verifyJwt(unknown, opts(f))), "bad_login");
  assert.equal(calls.length, 1, "최근에 받았으면 다시 받지 않는다");
  jwks = { keys: [...JWKS.keys, { ...JWKS.keys[0], kid: "k2" }] };
  assert.equal((await verifyJwt(unknown, opts(f, { now: NOW + 6 * 60_000 }))).sub, "1234567890", "5분 뒤 새 열쇠를 받는다");
  assert.equal(calls.length, 2);
  clearJwks();
  const down = fakeFetch({});
  assert.equal(await failCode(() => verifyJwt(unknown, opts(down))), "bad_login", "열쇠 목록을 못 받으면");
});

test("제공자: 열쇠가 있어야 켜지고, 시험 제공자는 로컬 주소에서만", () => {
  const live = new URL("https://ultimate-rsp.youngpyo.workers.dev/api/auth");
  const local = new URL("http://127.0.0.1:8787/api/auth");
  assert.deepEqual(enabledProviders({}, live), []);
  assert.deepEqual(enabledProviders({ GOOGLE_CLIENT_ID: "a" }, live), [], "시크릿이 없으면 구글은 꺼짐");
  assert.deepEqual(enabledProviders({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", KAKAO_REST_KEY: "c" }, live), ["google", "kakao"]);
  assert.deepEqual(enabledProviders({ AUTH_TEST: "1" }, live), [], "라이브 주소에서는 시험 제공자가 안 켜진다");
  assert.deepEqual(enabledProviders({ AUTH_TEST: "1" }, local), ["test"]);
  assert.deepEqual(enabledProviders({ AUTH_TEST: "true" }, local), []);
  for (const bad of ["nope", "__proto__", "constructor", "toString", "", null, 3]) {
    assert.throws(() => providerOf(bad, { AUTH_TEST: "1" }, local), (e) => e instanceof Fail && e.code === "no_provider", String(bad));
  }
  assert.throws(() => providerOf("google", {}, live), (e) => e.code === "no_provider");
  for (const id of AUTH_PROVIDERS) assert.ok(id === "email" || Object.hasOwn(PROVIDERS, id), id);
  assert.ok(!AUTH_PROVIDERS.includes("test"));
});

test("구글: 로그인 창 주소(PKCE·nonce·openid 만), 코드 바꾸기와 ID 토큰 확인, 앱 토큰", async () => {
  clearJwks();
  const env = { GOOGLE_CLIENT_ID: "web-client", GOOGLE_CLIENT_SECRET: "s3cret", GOOGLE_APP_CLIENT_IDS: "ios-client, android-client" };
  const g = PROVIDERS.google;
  const u = new URL(g.authorizeUrl(env, { redirectUri: "https://w.test/api/auth/google/callback", state: "S", challenge: "C", nonce: "N" }));
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  const q = Object.fromEntries(u.searchParams);
  assert.deepEqual(
    { ...q },
    { response_type: "code", client_id: "web-client", redirect_uri: "https://w.test/api/auth/google/callback", scope: "openid", state: "S", nonce: "N", code_challenge: "C", code_challenge_method: "S256", prompt: "select_account" },
    "이메일·이름은 묻지 않는다(scope openid 만)",
  );
  const idt = await sign(goodHead, goodBody({ nonce: "N" }));
  const calls = [];
  // 구글 열쇠 주소는 진짜 주소지만 가짜 fetch 가 시험 열쇠를 준다
  const f = fakeFetch({ "https://www.googleapis.com/oauth2/v3/certs": JWKS, "https://oauth2.googleapis.com/token": { id_token: idt } }, calls);
  assert.equal(await g.exchange(env, { code: "CODE", redirectUri: "https://w.test/cb", verifier: "V", nonce: "N", fetch: f, now: NOW }), "1234567890");
  const form = new URLSearchParams(String(calls.find((c) => c.url.startsWith("https://oauth2.googleapis.com")).init.body));
  assert.equal(form.get("code_verifier"), "V");
  assert.equal(form.get("client_secret"), "s3cret");
  assert.equal(await failCode(() => g.exchange(env, { code: "CODE", redirectUri: "x", verifier: "V", nonce: "다른 nonce", fetch: f, now: NOW })), "bad_login");
  const bad = fakeFetch({ "https://oauth2.googleapis.com/token": { status: 400, body: { error: "invalid_grant" } } });
  assert.equal(await failCode(() => g.exchange(env, { code: "C", redirectUri: "x", verifier: "V", nonce: "N", fetch: bad, now: NOW })), "bad_login");
  // 앱: 앱 클라이언트 ID 로 발급된 ID 토큰도 받는다, 남의 앱은 안 받는다
  assert.equal(await g.verify(env, { credential: await sign(goodHead, goodBody({ aud: "android-client" })), fetch: f, now: NOW }), "1234567890");
  const otherApp = await sign(goodHead, goodBody({ aud: "other-app" }));
  assert.equal(await failCode(() => g.verify(env, { credential: otherApp, fetch: f, now: NOW })), "bad_login");
});

test("카카오: 로그인 창 주소, 코드 → 액세스 토큰 → 회원번호, 앱 토큰은 우리 앱 것만", async () => {
  const env = { KAKAO_REST_KEY: "rest", KAKAO_CLIENT_SECRET: "ks", KAKAO_APP_ID: "777" };
  const k = PROVIDERS.kakao;
  const u = new URL(k.authorizeUrl(env, { redirectUri: "https://w.test/api/auth/kakao/callback", state: "S" }));
  assert.equal(u.origin + u.pathname, "https://kauth.kakao.com/oauth/authorize");
  assert.equal(u.searchParams.get("client_id"), "rest");
  assert.equal(u.searchParams.get("state"), "S");
  assert.equal(u.searchParams.get("scope"), null, "동의 항목을 묻지 않는다");
  const calls = [];
  const f = fakeFetch(
    {
      "https://kauth.kakao.com/oauth/token": { access_token: "AT" },
      "https://kapi.kakao.com/v2/user/me": (url, init) => (init.headers.Authorization === "Bearer AT" ? { id: 4123456789 } : { status: 401, body: {} }),
      "https://kapi.kakao.com/v1/user/access_token_info": (url, init) => (init.headers.Authorization === "Bearer APPTOKEN" ? { id: 4123456789, app_id: 777 } : { id: 1, app_id: 999 }),
    },
    calls,
  );
  assert.equal(await k.exchange(env, { code: "C", redirectUri: "https://w.test/cb", fetch: f }), "4123456789");
  assert.equal(new URLSearchParams(String(calls[0].init.body)).get("client_secret"), "ks");
  assert.equal(await k.verify(env, { credential: "APPTOKEN", fetch: f }), "4123456789");
  assert.equal(await failCode(() => k.verify(env, { credential: "OTHERAPP", fetch: f })), "bad_login", "다른 앱 토큰");
  assert.equal(await failCode(() => k.verify({ KAKAO_REST_KEY: "rest" }, { credential: "APPTOKEN", fetch: f })), "no_provider", "앱 ID 가 없으면 앱 로그인은 꺼짐");
  const big = fakeFetch({ "https://kauth.kakao.com/oauth/token": { access_token: "AT" }, "https://kapi.kakao.com/v2/user/me": { id: 2 ** 60 } });
  assert.equal(await failCode(() => k.exchange(env, { code: "C", redirectUri: "x", fetch: big })), "bad_login", "안전한 정수가 아닌 번호");
  const noSecret = [];
  await k.exchange({ KAKAO_REST_KEY: "rest" }, { code: "C", redirectUri: "x", fetch: fakeFetch({ "https://kauth.kakao.com/oauth/token": { access_token: "AT" }, "https://kapi.kakao.com/v2/user/me": { id: 5 } }, noSecret) });
  assert.equal(new URLSearchParams(String(noSecret[0].init.body)).get("client_secret"), null, "시크릿을 안 켰으면 보내지 않는다");
});

test("로그인 정하기(planLogin)", () => {
  assert.deepEqual(planLogin({}), { act: "create", keepPid: true }, "처음: 손님 pid 그대로 새 계정");
  assert.deepEqual(planLogin({ pidAcc: "A" }), { act: "create", keepPid: false }, "pid 가 남의 계정 것이면 새 pid");
  assert.deepEqual(planLogin({ idAcc: "A" }), { act: "login", account: "A" });
  assert.deepEqual(planLogin({ idAcc: "A", pidAcc: "B" }), { act: "login", account: "A" }, "로그인이 이긴다(pid 는 계정 것으로)");
  assert.deepEqual(planLogin({ linkAcc: "A" }), { act: "attach", account: "A" });
  assert.deepEqual(planLogin({ linkAcc: "A", idAcc: "A" }), { act: "same", account: "A" });
  assert.deepEqual(planLogin({ linkAcc: "A", idAcc: "B" }), { act: "in_use" }, "남의 계정에 붙은 로그인은 못 붙인다");
});

test("돌아갈 주소: 받는 출처만, 화면 # 주소는 그대로, login 은 하나만", () => {
  const origins = ["https://archi142857.github.io"];
  const ok = "https://archi142857.github.io/ultimate-rsp/?x=1#/play";
  assert.equal(checkBack(ok, origins), ok);
  assert.equal(checkBack("http://localhost:5173/#/play", origins), "http://localhost:5173/#/play", "로컬 시험 주소");
  for (const bad of [
    "https://evil.test/ultimate-rsp/",
    "https://archi142857.github.io.evil.test/",
    "https://user:pw@archi142857.github.io/",
    "javascript:alert(1)",
    "data:text/html,hi",
    "//archi142857.github.io/",
    "/ultimate-rsp/",
    "http://archi142857.github.io/",
    `https://archi142857.github.io/${"a".repeat(700)}`,
    null,
    42,
  ]) {
    assert.throws(() => checkBack(bad, origins), (e) => e instanceof Fail && e.code === "bad_back", String(bad));
  }
  const u = new URL(backWith(backWith(ok, "login_error", "cancel"), "login", "CODE"));
  assert.equal(u.searchParams.get("login"), "CODE");
  assert.equal(u.searchParams.get("login_error"), null, "앞 결과는 지운다");
  assert.equal(u.searchParams.get("x"), "1");
  assert.equal(u.hash, "#/play");
});

test("값 꼴: nonce·토큰·한 번 쓰는 코드·state", () => {
  assert.equal(checkNonce("abcdefghijklmnop"), "abcdefghijklmnop");
  for (const bad of ["short", "a".repeat(65), "has space here!!", null]) assert.throws(() => checkNonce(bad), (e) => e.code === "bad_request");
  const t = randomId(32);
  assert.equal(checkToken(t), t);
  for (const bad of [randomId(16), `${t}x`, "", null]) assert.throws(() => checkToken(bad), (e) => e.code === "bad_token");
  const c = randomId(24);
  assert.equal(checkHandoff(c), c);
  assert.throws(() => checkHandoff(t), (e) => e.code === "bad_login");
  assert.ok(isState(randomId(32)));
  assert.ok(!isState("x") && !isState(null) && !isState(`${randomId(32)}/`));
});

test("가입 동의: 처리방침 동의와 만 14세 이상이 둘 다 true, 판은 지금 판", () => {
  assert.deepEqual(checkConsent({ agree: true, age14: true, policy: PRIVACY_VERSION }), { policy: PRIVACY_VERSION, age14: true });
  for (const bad of [{}, { agree: true, policy: PRIVACY_VERSION }, { age14: true, policy: PRIVACY_VERSION }, { agree: "true", age14: true, policy: PRIVACY_VERSION }, { agree: 1, age14: 1, policy: PRIVACY_VERSION }, null]) {
    assert.throws(() => checkConsent(bad), (e) => e.code === "need_agree", JSON.stringify(bad));
  }
  assert.throws(() => checkConsent({ agree: true, age14: true, policy: "2026-01-01" }), (e) => e.code === "old_policy");
  assert.throws(() => checkConsent({ agree: true, age14: true }), (e) => e.code === "old_policy");
  const t = randomId(32);
  assert.equal(checkTicket(t), t);
  assert.throws(() => checkTicket(randomId(24)), (e) => e.code === "bad_login");
});

test("이메일: 다듬기(빈칸·대소문자·NFC)와 꼴, 열쇠·코드 꼴, 코드는 6자리", () => {
  assert.equal(checkEmail("  Foo.Bar@Example.COM "), "foo.bar@example.com");
  assert.equal(checkEmail("e\u0301@x.kr"), "\u00e9@x.kr", "NFC");
  assert.equal(checkEmail("가나@다라.한국"), "가나@다라.한국");
  for (const bad of ["x@y", "a b@c.de", "a@b..cd", "a@b.c", "<a@b.cd>", "a@@b.cd", "@b.cd", "a@.cd", `${"a".repeat(250)}@b.cd`, "", null, 3]) {
    assert.throws(() => checkEmail(bad), (e) => e.code === "bad_email", String(bad));
  }
  const k = randomId(32);
  assert.equal(checkKey(k), k);
  for (const bad of ["password123", randomId(16), `${k}=`, null]) assert.throws(() => checkKey(bad), (e) => e.code === "bad_request", String(bad));
  assert.equal(checkCode("012345"), "012345");
  for (const bad of ["12345", "1234567", "12a456", 123456, null]) assert.throws(() => checkCode(bad), (e) => e.code === "bad_code", String(bad));
  for (let i = 0; i < 50; i++) assert.match(newCode(), /^[0-9]{6}$/);
  assert.equal(EMAIL_KDF.iterations, 600_000, "OWASP 권장(PBKDF2-HMAC-SHA256)");
});

test("메일: 열쇠가 둘 다 있어야 켜지고, 로컬 시험은 보내지 않는다. 글은 한·영, 코드가 제목과 본문에", async () => {
  const live = new URL("https://ultimate-rsp.youngpyo.workers.dev/api/auth");
  const local = new URL("http://127.0.0.1:8787/api/auth");
  assert.equal(mailReady({}, live), false);
  assert.equal(mailReady({ RESEND_API_KEY: "k" }, live), false);
  assert.equal(mailReady({ RESEND_API_KEY: "k", MAIL_FROM: "a <b@c.d>" }, live), true);
  assert.equal(mailReady({ AUTH_TEST: "1" }, live), false);
  assert.equal(mailTest({ AUTH_TEST: "1" }, local), true);
  for (const kind of ["signup", "reset", "link"]) {
    const m = mailText(kind, "123456");
    assert.match(m.subject, /123456/);
    assert.match(m.text, /123456/);
    assert.match(m.text, /[가-힣]/);
    assert.match(m.text, /Your .* code is 123456/);
  }
  assert.doesNotMatch(mailText("exists").text, /[0-9]{6}/);
  const calls = [];
  await sendMail({ RESEND_API_KEY: "rk", MAIL_FROM: "RSP <no-reply@x.test>" }, { to: "a@b.cd", subject: "s", text: "t" }, async (u, init) => {
    calls.push({ u, init });
    return new Response("{}", { status: 200 });
  });
  assert.equal(calls[0].u, "https://api.resend.com/emails");
  assert.equal(calls[0].init.headers.Authorization, "Bearer rk");
  assert.deepEqual(JSON.parse(calls[0].init.body), { from: "RSP <no-reply@x.test>", to: ["a@b.cd"], subject: "s", text: "t" });
  await assert.rejects(sendMail({ RESEND_API_KEY: "rk", MAIL_FROM: "x" }, { to: "a@b.cd", subject: "s", text: "t" }, async () => new Response("no", { status: 429 })), (e) => e.code === "busy");
});
