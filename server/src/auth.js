// 로그인 제공자(구글·카카오, 나중에 애플·스팀). 제공자마다 '확인된 계정 번호(sub)'만 얻는 작은 모듈이고,
// 서버는 그 번호로 우리 계정을 찾는다(account-do.js). 서버는 어느 제공자인지 몰라도 된다.
//  - 웹: 제공자 로그인 창에 다녀오는 인가 코드 방식(authorizeUrl → 제공자 → callback → exchange)
//  - 앱·스팀: 그 플랫폼 SDK 가 준 토큰을 서버가 확인(verify). 예) 구글 ID 토큰, 카카오 액세스 토큰, 나중에 스팀 세션 티켓
// 클라이언트 ID·시크릿은 Worker secrets 에만 있다(배포가 GitHub Secrets 에서 넣는다). 열쇠가 없는 제공자는 꺼져 있다.
// Cloudflare 없이 돈다(fetch 는 넘겨받는다). 시험은 server/tests/auth.test.mjs.

import { Fail } from "./http.js";

const enc = new TextEncoder();
const dec = new TextDecoder();

/** 바이트 → URL 에 써도 되는 base64(끝 = 없음) */
export function b64url(bytes) {
  let bin = "";
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** URL base64 → 바이트. 틀린 글자면 던진다 */
export function unb64url(s) {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("base64url");
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 무작위 값(URL base64). 16바이트 → 22자, 32바이트 → 43자 */
export function randomId(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(s) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** HMAC-SHA256(열쇠는 16진 문자열) → 16진 */
export async function hmacHex(keyHex, s) {
  const raw = new Uint8Array(keyHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(s)));
}

/** PKCE: 비밀 verifier 의 SHA-256 을 제공자에게 먼저 보내 두고, 코드를 바꿀 때 verifier 를 보인다 */
export async function pkceChallenge(verifier) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(verifier))));
}

// ---- JWT(RS256) 확인: 구글·애플·카카오(OIDC) ID 토큰 ----

const SKEW_MS = 60_000;
const JWKS_TTL_MS = 3600_000;
/** 모르는 kid 가 오면 열쇠 목록을 다시 받되, 최근에 받았으면 다시 받지 않는다(아무 kid 로 계속 받게 만드는 것을 막는다) */
const JWKS_RETRY_MS = 300_000;
const jwksCache = new Map();

/** 시험용: 받아 둔 열쇠 목록을 비운다 */
export function clearJwks() {
  jwksCache.clear();
}

async function fetchJwks(url, f, now) {
  let body = null;
  try {
    const res = await f(url, { headers: { Accept: "application/json" } });
    if (res.ok) body = await res.json();
  } catch {
    body = null;
  }
  if (!body || !Array.isArray(body.keys)) throw new Fail("bad_login");
  const keys = new Map();
  for (const k of body.keys) {
    if (k && k.kty === "RSA" && typeof k.kid === "string" && typeof k.n === "string" && typeof k.e === "string" && (!k.use || k.use === "sig") && (!k.alg || k.alg === "RS256")) {
      keys.set(k.kid, k);
    }
  }
  const entry = { at: now, keys, imported: new Map() };
  jwksCache.set(url, entry);
  return entry;
}

async function keyFor(url, kid, f, now) {
  let e = jwksCache.get(url);
  if (!e || now - e.at > JWKS_TTL_MS || (!e.keys.has(kid) && now - e.at > JWKS_RETRY_MS)) e = await fetchJwks(url, f, now);
  const jwk = e.keys.get(kid);
  if (!jwk) throw new Fail("bad_login");
  let key = e.imported.get(kid);
  if (!key) {
    key = await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    e.imported.set(kid, key);
  }
  return key;
}

/**
 * ID 토큰 확인. RS256 만 받는다(alg none·HS256 바꿔치기 막기). 서명, 발급자(iss), 받는 쪽(aud), 만료(exp), 발급 시각(iat), nonce.
 * 돌려주는 값: 토큰 내용(payload). 틀리면 bad_login
 */
export async function verifyJwt(token, { jwks, issuers, audiences, nonce = null, now, fetch: f }) {
  if (typeof token !== "string" || token.length > 8192) throw new Fail("bad_login");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Fail("bad_login");
  let header, payload, sig;
  try {
    header = JSON.parse(dec.decode(unb64url(parts[0])));
    payload = JSON.parse(dec.decode(unb64url(parts[1])));
    sig = unb64url(parts[2]);
  } catch {
    throw new Fail("bad_login");
  }
  if (!header || typeof header !== "object" || header.alg !== "RS256" || typeof header.kid !== "string") throw new Fail("bad_login");
  if (!payload || typeof payload !== "object") throw new Fail("bad_login");
  const key = await keyFor(jwks, header.kid, f, now);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, enc.encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Fail("bad_login");
  if (!issuers.includes(payload.iss)) throw new Fail("bad_login");
  const want = audiences.filter((a) => typeof a === "string" && a);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!want.length || !aud.some((a) => want.includes(a))) throw new Fail("bad_login");
  if (typeof payload.exp !== "number" || payload.exp * 1000 < now - SKEW_MS) throw new Fail("bad_login");
  if (typeof payload.iat === "number" && payload.iat * 1000 > now + SKEW_MS) throw new Fail("bad_login");
  if (nonce !== null && payload.nonce !== nonce) throw new Fail("bad_login");
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 255) throw new Fail("bad_login");
  return payload;
}

// ---- 제공자 ----

const GOOGLE = {
  auth: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  jwks: "https://www.googleapis.com/oauth2/v3/certs",
  iss: ["https://accounts.google.com", "accounts.google.com"],
};

const KAKAO = {
  auth: "https://kauth.kakao.com/oauth/authorize",
  token: "https://kauth.kakao.com/oauth/token",
  // 회원번호·앱 ID·남은 시간만 준다. 사용자 정보(/v2/user/me)는 부르지 않아 동의 항목 값은 아예 받지 않는다
  tokenInfo: "https://kapi.kakao.com/v1/user/access_token_info",
};

const LOCAL_HOST = /^(localhost|127\.0\.0\.1)$/;
const TEST_SUB = /^[a-z0-9]{1,20}$/;

const list = (s) => (typeof s === "string" ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** 카카오 회원번호(숫자). 안전한 정수가 아니면 받지 않는다(큰 수가 반올림돼 남의 번호와 겹치지 않게) */
function kakaoId(v) {
  if (Number.isSafeInteger(v) && v > 0) return String(v);
  if (typeof v === "string" && /^[1-9]\d{0,19}$/.test(v)) return v;
  throw new Fail("bad_login");
}

/** 액세스 토큰 → 회원번호. appId 를 주면 그 앱에서 나온 토큰만 받는다 */
async function kakaoTokenInfo(accessToken, f, appId = null) {
  const res = await f(KAKAO.tokenInfo, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await readJson(res);
  if (!res.ok || !body) throw new Fail("bad_login");
  if (appId && String(body.app_id) !== String(appId)) throw new Fail("bad_login");
  return kakaoId(body.id);
}

/**
 * 제공자 목록. 모두 같은 꼴:
 *  - ready(env, url): 열쇠가 있어 켜져 있나
 *  - authorizeUrl(env, { redirectUri, state, challenge, nonce, testSub }): 웹 로그인 창 주소
 *  - exchange(env, { code, redirectUri, verifier, nonce, fetch, now }): 돌아온 코드 → sub
 *  - verify(env, { credential, fetch, now }): 앱·스팀이 준 토큰 → sub (없는 제공자는 웹만)
 * 새 제공자(apple, steam)는 여기에 하나 더하면 된다
 */
export const PROVIDERS = {
  google: {
    ready: (env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    authorizeUrl(env, { redirectUri, state, challenge, nonce }) {
      const q = new URLSearchParams({
        response_type: "code",
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        scope: "openid",
        state,
        nonce,
        code_challenge: challenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      });
      return `${GOOGLE.auth}?${q}`;
    },
    async exchange(env, { code, redirectUri, verifier, nonce, fetch: f, now }) {
      const res = await f(GOOGLE.token, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        }),
      });
      const body = await readJson(res);
      if (!res.ok || !body || typeof body.id_token !== "string") throw new Fail("bad_login");
      const p = await verifyJwt(body.id_token, { jwks: GOOGLE.jwks, issuers: GOOGLE.iss, audiences: [env.GOOGLE_CLIENT_ID], nonce, now, fetch: f });
      return p.sub;
    },
    // 앱: 구글 로그인 SDK 가 준 ID 토큰. 받는 쪽(aud)은 웹 클라이언트 ID 나 앱 클라이언트 ID(GOOGLE_APP_CLIENT_IDS, 쉼표)
    async verify(env, { credential, fetch: f, now }) {
      const p = await verifyJwt(credential, {
        jwks: GOOGLE.jwks,
        issuers: GOOGLE.iss,
        audiences: [env.GOOGLE_CLIENT_ID, ...list(env.GOOGLE_APP_CLIENT_IDS)],
        now,
        fetch: f,
      });
      return p.sub;
    },
  },

  kakao: {
    // 클라이언트 시크릿은 카카오 앱에서 켰을 때만 넣는다(KAKAO_CLIENT_SECRET)
    ready: (env) => Boolean(env.KAKAO_REST_KEY),
    authorizeUrl(env, { redirectUri, state }) {
      const q = new URLSearchParams({ response_type: "code", client_id: env.KAKAO_REST_KEY, redirect_uri: redirectUri, state });
      return `${KAKAO.auth}?${q}`;
    },
    async exchange(env, { code, redirectUri, fetch: f }) {
      const form = { grant_type: "authorization_code", client_id: env.KAKAO_REST_KEY, redirect_uri: redirectUri, code };
      if (env.KAKAO_CLIENT_SECRET) form.client_secret = env.KAKAO_CLIENT_SECRET;
      const res = await f(KAKAO.token, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams(form),
      });
      const body = await readJson(res);
      if (!res.ok || !body || typeof body.access_token !== "string") throw new Fail("bad_login");
      // 우리 REST 키로 바꾼 토큰이라 우리 앱 것이다(앱 ID 는 안 맞춰 본다)
      return kakaoTokenInfo(body.access_token, f);
    },
    // 앱: 카카오 SDK 가 준 액세스 토큰. 우리 앱(KAKAO_APP_ID)에서 나온 토큰인지 본다
    async verify(env, { credential, fetch: f }) {
      if (!env.KAKAO_APP_ID) throw new Fail("no_provider");
      if (typeof credential !== "string" || !credential || credential.length > 1024) throw new Fail("bad_login");
      return kakaoTokenInfo(credential, f, env.KAKAO_APP_ID);
    },
  },

  // 로컬 시험 전용(wrangler dev --var AUTH_TEST:1, 주소가 localhost·127.0.0.1 일 때만). 로그인 창 없이 바로 돌아온다
  test: {
    ready: (env, url) => env.AUTH_TEST === "1" && Boolean(url) && LOCAL_HOST.test(url.hostname),
    authorizeUrl(env, { redirectUri, state, testSub }) {
      if (!TEST_SUB.test(testSub || "")) throw new Fail("bad_request");
      return `${redirectUri}?${new URLSearchParams({ state, code: testSub })}`;
    },
    async exchange(env, { code }) {
      if (!TEST_SUB.test(code || "")) throw new Fail("bad_login");
      return code;
    },
    async verify(env, { credential }) {
      if (!TEST_SUB.test(credential || "")) throw new Fail("bad_login");
      return credential;
    },
  },
};

/** 켜진 제공자 id(화면이 단추를 그린다). 시험 제공자는 로컬에서만 */
export function enabledProviders(env, url) {
  return Object.keys(PROVIDERS).filter((id) => PROVIDERS[id].ready(env || {}, url));
}

/** 켜진 제공자만 받는다 */
export function providerOf(id, env, url) {
  if (typeof id !== "string" || !Object.hasOwn(PROVIDERS, id) || !PROVIDERS[id].ready(env || {}, url)) throw new Fail("no_provider");
  return PROVIDERS[id];
}
