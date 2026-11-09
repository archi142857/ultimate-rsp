// 로그인과 계정(온라인 규약 8장). 로그인은 고를 수 있다. 안 해도 지금처럼 논다.
// 계정은 게임 속 나(pid)를 어느 기기에서든 되찾는 열쇠다. 게임 주소(방·도전장·랜덤·순위)는 그대로 pid 만 본다.
// 세션 토큰은 이 기기에만 둔다(ursp.set.online.token). 화면에 보이지 않는다.
// 웹 로그인(8.3): nonce 를 sessionStorage 에 두고 start → 제공자 창 → 화면 주소?login=<코드> → redeem.
// 처음 보는 로그인이면 로그인 결과 대신 가입 표(8.3b)가 온다: 가입 화면에서 이름·동의를 받고 signup.
// 이메일(8.8): 비밀번호는 보내지 않고 PBKDF2 열쇠로 바꿔 보낸다.
// 화면(글·창)은 account-view.js·account-page.js 가 맡는다. 여기서는 결과를 돌려주기만 한다.

import { api, OnlineError } from "./net.js";
import { PROTOCOL } from "./config.js";
import { PRIVACY_VERSION, EMAIL_KDF, AUTH_SIGNUP_MS } from "./protocol.js";
import { setting, setSetting } from "../ui/store.js";
import { playerId, setPlayerId, myName, myFace, setMyName, setMyFace, newId, meFields, cleanName, faceId, newGuest } from "./identity.js";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const PENDING = "ursp.login"; // sessionStorage: { nonce, provider, link } (로그인을 시작한 이 창만 안다)
const SIGNUP = "ursp.signup"; // sessionStorage: { ticket, provider, profile, until } 가입 표(15분, 한 번)
const TICKET_MS = AUTH_SIGNUP_MS;
/** 화면이 아는 방법(이 차례로 그린다: 사용자 11-09 '구글이 제일 위로'). 서버 목록에 없는 것은 그리지 않는다 */
export const PROVIDERS = ["google", "kakao", "email", "test"];

// ── 토큰 ─────────────────
export function myToken() {
  const v = setting("online.token", null);
  return typeof v === "string" && TOKEN.test(v) ? v : null;
}
export const signedIn = () => myToken() !== null;

// ── 바뀌면 알린다(프로필 칩·계정 화면이 다시 그린다) ─────────────────
const listeners = new Set();
export function onAccount(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function changed(what) {
  for (const cb of [...listeners]) {
    try {
      cb(what);
    } catch (e) {
      console.error(e);
    }
  }
}

let account = null; // 마지막으로 받은 계정 { id, made, logins: [{ provider, made }], policy }
export const lastAccount = () => account;

/** 새 손님으로(새 pid·무작위 이름) */
export function becomeGuest() {
  newGuest();
  changed("guest");
}

/** 이 기기에서만 로그아웃된 것으로(토큰이 끝났거나 로그아웃·지우기 뒤) */
function forget() {
  setSetting("online.token", null);
  account = null;
  changed("logout");
}

// ── 켜진 방법 ─────────────────
let methods = null;
/** 서버에 켜진 로그인 방법(규약 8.2, 이메일 포함). 5분 동안 기억한다. 옛 서버(주소 없음)면 빈 목록 */
export async function loginMethods({ signal } = {}) {
  if (methods && Date.now() - methods.at < 5 * 60_000) return methods.list;
  let list = [];
  try {
    const d = await api(`/api/auth?v=${PROTOCOL}`, { signal });
    if (Array.isArray(d.providers)) list = PROVIDERS.filter((p) => d.providers.includes(p));
  } catch (e) {
    if (!(e instanceof OnlineError) || !["not_found", "http_404"].includes(e.code)) throw e;
  }
  methods = { list, at: Date.now() };
  return list;
}
/** 이미 받아 둔 목록(없으면 null). 칩이 기다리지 않고 그릴 때 */
export const knownMethods = () => (methods ? methods.list : null);

// ── 웹 로그인 ─────────────────
/** 지금 주소에서 login·login_error 를 뺀 것(로그인 뒤 돌아올 주소. # 주소도 그대로) */
function backUrl() {
  const u = new URL(location.href);
  u.searchParams.delete("login");
  u.searchParams.delete("login_error");
  return u.href;
}

/** 로컬 시험 제공자(test)가 쓸 사람(영소문자·숫자). 시험 스크립트가 localStorage 로 고른다 */
function testSub() {
  try {
    const v = localStorage.getItem("ursp.dev.testsub");
    return v && /^[a-z0-9]{1,20}$/.test(v) ? v : "alice";
  } catch {
    return "alice";
  }
}

/**
 * 로그인 창으로 간다. link 면 로그인한 채 다른 방법을 더한다(지금 토큰을 같이 보낸다).
 * 성공하면 이 화면을 떠나므로 돌아오지 않는다. 실패하면 OnlineError
 */
export async function startLogin(provider, { link = false } = {}) {
  const nonce = newId(24);
  const body = { v: PROTOCOL, pid: playerId(), back: backUrl(), nonce, ...meFields() };
  if (link) {
    const token = myToken();
    if (!token) throw new OnlineError("bad_token");
    body.token = token;
  }
  if (provider === "test") body.testSub = testSub();
  try {
    sessionStorage.setItem(PENDING, JSON.stringify({ nonce, provider, link }));
  } catch {
    // 이 창이 nonce 를 기억하지 못하면 돌아와도 로그인을 마칠 수 없다(사생활 보호 창 등)
    throw new OnlineError("no_storage");
  }
  const d = await api(`/api/auth/${encodeURIComponent(provider)}/start`, { body });
  if (typeof d.url !== "string" || !/^https?:\/\//.test(d.url)) throw new OnlineError("bad_reply", d);
  location.assign(d.url);
}

/**
 * 로그인에서 돌아온 주소면(?login= · ?login_error=) 곧바로 주소에서 지우고 { code, error, pending } 를 돌려준다.
 * 아니면 null. 라우터가 그리기 전에 부른다
 */
export function takeLoginReturn() {
  let u;
  try {
    u = new URL(location.href);
  } catch {
    return null;
  }
  const code = u.searchParams.get("login");
  const error = u.searchParams.get("login_error");
  if (code === null && error === null) return null;
  u.searchParams.delete("login");
  u.searchParams.delete("login_error");
  try {
    history.replaceState(history.state, "", u.href);
  } catch {
    /* 주소를 못 고쳐도 아래는 그대로 */
  }
  let pending = null;
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING) || "null");
    sessionStorage.removeItem(PENDING);
  } catch {
    pending = null;
  }
  if (!pending || typeof pending.nonce !== "string") pending = null;
  return { code, error, pending };
}

/**
 * 돌아온 로그인을 받는다(규약 8.3 의 4). 이 창이 시작한 로그인이 아니면(nonce 없음) null.
 * 결과: { error } | { signup } (처음 보는 로그인, 가입 표를 남겨 둔다) | { result } (로그인 결과, 아직 쓰지 않았다).
 * 셋 모두 provider·link 가 붙는다. 서버 오류는 OnlineError
 */
export async function finishLogin(ret) {
  if (!ret) return null;
  const p = ret.pending;
  if (!p) return null;
  const tag = { provider: p.provider, link: Boolean(p.link) };
  if (ret.error !== null) return { error: ret.error, ...tag };
  const r = await api("/api/auth/redeem", { body: { v: PROTOCOL, code: ret.code, nonce: p.nonce } });
  return readResult(r, tag);
}

/** 로그인 결과이거나 가입 표 */
function readResult(r, tag = {}) {
  if (r && r.signup && typeof r.signup.ticket === "string") {
    keepSignup(r.signup);
    return { signup: r.signup, ...tag };
  }
  if (!r || typeof r.token !== "string" || !TOKEN.test(r.token)) throw new OnlineError("bad_reply", r);
  return { result: r, ...tag };
}

/** 이 로그인 결과를 쓰면 pid 가 바뀌는가(다른 기기에서 만든 계정: 바꾸기 전에 묻는다) */
export const changesPid = (r) => typeof r.pid === "string" && r.pid !== playerId();

/** 로그인 결과(규약 8.3b)를 쓴다: 토큰, 계정 pid, 계정 이름·그림(없으면 지금 것을 올린다) */
export function useLogin(r) {
  const before = playerId();
  setSetting("online.token", r.token);
  const switched = r.pid !== before && setPlayerId(r.pid);
  account = r.account || null;
  if (r.profile && cleanName(r.profile.name)) {
    setMyName(r.profile.name);
    setMyFace(faceId(r.profile.face));
  } else pushProfile().catch(() => {});
  changed("login");
  return { switched, fresh: r.fresh === true, linked: r.linked === true };
}

/** 쓰지 않기로 한 로그인 결과: 받은 토큰을 서버에서도 끝낸다(이 기기는 손님 그대로) */
export async function dropLogin(r) {
  try {
    await api("/api/account/logout", { body: { v: PROTOCOL, token: r.token } });
  } catch {
    /* 끝내지 못해도 180일 뒤 저절로 끝난다 */
  }
}

// ── 가입 표(규약 8.3b) ─────────────────
function keepSignup(s) {
  try {
    sessionStorage.setItem(SIGNUP, JSON.stringify({ ticket: s.ticket, provider: s.provider, profile: s.profile || null, until: Date.now() + TICKET_MS }));
  } catch {
    /* 새로고침하면 다시 로그인해야 한다 */
  }
  pendingSignup = { ticket: s.ticket, provider: s.provider, profile: s.profile || null, until: Date.now() + TICKET_MS };
}
let pendingSignup = null;
/** 남아 있는 가입 표(15분 안). 없으면 null */
export function signupTicket() {
  let s = pendingSignup;
  if (!s) {
    try {
      s = JSON.parse(sessionStorage.getItem(SIGNUP) || "null");
    } catch {
      s = null;
    }
  }
  if (!s || typeof s.ticket !== "string" || !(s.until > Date.now())) return null;
  return (pendingSignup = s);
}
/** 가입 표를 버린다(가입했거나, 그만두었거나, 손님으로 놀기) */
export function dropSignup() {
  pendingSignup = null;
  try {
    sessionStorage.removeItem(SIGNUP);
  } catch {
    /* 없으면 그만 */
  }
}

/** 가입: 이름·그림·동의 둘(만 14세 이상·처리방침 판) → 로그인 결과({ result }) */
export async function signup({ name, face }) {
  const s = signupTicket();
  if (!s) throw new OnlineError("bad_login");
  const r = await api("/api/auth/signup", { body: { v: PROTOCOL, ticket: s.ticket, name, face: face ?? null, agree: true, age14: true, policy: PRIVACY_VERSION } });
  dropSignup();
  return readResult(r, { provider: s.provider, link: false });
}

// ── 이메일(규약 8.8) ─────────────────
/** 서버와 같게 다듬은 메일 */
export const normEmail = (e) => String(e ?? "").trim().normalize("NFC").toLowerCase();
/** 서버(checkEmail)와 같은 모양 검사 */
export function emailOk(e) {
  const m = normEmail(e);
  return m.length >= 3 && m.length <= 254 && /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\.]{2,}$/u.test(m) && !/\.\./.test(m);
}
/** 비밀번호는 8자 이상(서버는 비밀번호를 모른다. 화면이 본다) */
export const PASSWORD_MIN = 8;

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 비밀번호 → 열쇠(PBKDF2-HMAC-SHA256, 600000번, 32바이트 → 43자). 폰에서 1초 안팎 */
export async function emailKey(email, password) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: EMAIL_KDF.hash, salt: enc.encode(EMAIL_KDF.salt + normEmail(email)), iterations: EMAIL_KDF.iterations },
    base,
    EMAIL_KDF.bytes * 8,
  );
  return b64url(new Uint8Array(bits));
}

/**
 * 이메일 가입(확인 코드 메일을 보낸다). link 면 로그인한 계정에 이메일을 더한다(이름·동의 없이 토큰과 함께).
 * 답: { sent, devCode? }(로컬 시험이면 코드가 실려 온다)
 */
export async function emailSignup({ email, key, name = null, face = null, link = false }) {
  const body = { v: PROTOCOL, email: normEmail(email), key, pid: playerId() };
  if (link) {
    const token = myToken();
    if (!token) throw new OnlineError("bad_token");
    body.token = token;
  } else Object.assign(body, { name, face: face ?? null, agree: true, age14: true, policy: PRIVACY_VERSION });
  return api("/api/auth/email/signup", { body });
}

/** 확인 코드 → { result }(가입이면 fresh, 더하기면 linked) */
export async function emailVerify(email, code, { link = false } = {}) {
  const r = await api("/api/auth/email/verify", { body: { v: PROTOCOL, email: normEmail(email), code } });
  return readResult(r, { provider: "email", link });
}

/** 이메일 로그인 → { result }. 없는 주소와 틀린 비밀번호는 같은 bad_login */
export async function emailLogin(email, key) {
  const r = await api("/api/auth/email/login", { body: { v: PROTOCOL, email: normEmail(email), key } });
  return readResult(r, { provider: "email", link: false });
}

/** 비밀번호 찾기: 코드 메일(가입된 주소에만 가지만 답은 같다) */
export async function emailReset(email) {
  return api("/api/auth/email/reset", { body: { v: PROTOCOL, email: normEmail(email) } });
}

/** 코드와 새 비밀번호 → { result }. 다른 기기는 모두 로그아웃된다 */
export async function emailResetConfirm(email, code, key) {
  const r = await api("/api/auth/email/reset/confirm", { body: { v: PROTOCOL, email: normEmail(email), code, key } });
  return readResult(r, { provider: "email", link: false });
}

// ── 계정(규약 8.5) ─────────────────
async function call(path, extra = {}) {
  const token = myToken();
  if (!token) throw new OnlineError("bad_token");
  try {
    return await api(`/api/account${path}`, { body: { v: PROTOCOL, token, ...extra } });
  } catch (e) {
    // 틀리거나 끝난 토큰: 지우고 로그아웃된 것으로
    if (e instanceof OnlineError && e.code === "bad_token") forget();
    throw e;
  }
}

/** 계정의 이름·그림·pid 를 이 기기에 맞춘다(다른 기기에서 바꿨으면 따라간다) */
function useAccount(r) {
  if (r.account) account = r.account;
  let moved = false;
  if (typeof r.pid === "string" && r.pid !== playerId()) moved = setPlayerId(r.pid);
  const p = r.profile;
  if (p && cleanName(p.name) && (cleanName(p.name) !== myName() || faceId(p.face) !== myFace())) {
    setMyName(p.name);
    setMyFace(faceId(p.face));
    moved = true;
  }
  changed(moved ? "profile" : "account");
}

/** 계정 보기: { account, pid, profile } */
export async function accountInfo() {
  const r = await call("");
  useAccount(r);
  return r;
}

let synced = false;
/** 로그인했으면 페이지를 열 때 한 번 계정을 읽어 이름·그림을 맞춘다. 끝난 토큰이면 로그아웃된 것으로(조용히) */
export async function syncAccount() {
  if (synced || !signedIn()) return null;
  synced = true;
  try {
    return await accountInfo();
  } catch (e) {
    if (!(e instanceof OnlineError) || e.code !== "bad_token") synced = false;
    return null;
  }
}

/** 지금 이름·그림을 계정에 올린다(로그인했을 때만. 다른 기기에도 따라가게) */
export async function pushProfile() {
  if (!signedIn()) return null;
  return call("/profile", { name: myName(), face: myFace() });
}

/** 로그인 방법 떼기. 마지막 방법이면 last_login */
export async function unlinkLogin(provider) {
  const r = await call("/unlink", { provider });
  useAccount(r);
  return r;
}

/** 이 기기만 로그아웃. 서버에 닿지 않아도 이 기기에서는 지운다 */
export async function signOut() {
  try {
    await call("/logout");
  } catch (e) {
    if (!(e instanceof OnlineError) || e.code !== "bad_token") console.warn("logout", e.code || e);
  } finally {
    if (signedIn()) forget();
  }
}

/** 계정 지우기: 계정·로그인·세션을 모두 지운다(모든 기기 로그아웃). 게임 기록은 남는다 */
export async function deleteAccount() {
  const r = await call("/delete");
  forget();
  return r;
}
