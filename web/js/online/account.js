// 로그인과 계정(온라인 규약 8장, 서버 ba47c12). 로그인은 고를 수 있다. 안 해도 지금처럼 논다.
// 계정은 게임 속 나(pid)를 어느 기기에서든 되찾는 열쇠다. 게임 주소(방·도전장·랜덤·순위)는 그대로 pid 만 본다.
// 세션 토큰은 이 기기에만 둔다(ursp.set.online.token). 화면에 보이지 않는다.
// 웹 로그인(8.3): nonce 를 sessionStorage 에 두고 start → 제공자 창 → 화면 주소?login=<코드> → redeem.
// 화면(글·시트)은 account-view.js 가 맡는다.

import { api, OnlineError } from "./net.js";
import { PROTOCOL } from "./config.js";
import { setting, setSetting } from "../ui/store.js";
import { playerId, setPlayerId, myName, myFace, setMyName, setMyFace, newId, meFields, cleanName, faceId, newGuest } from "./identity.js";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const PENDING = "ursp.login"; // sessionStorage: { nonce, provider, link } (로그인을 시작한 이 창만 안다)
/** 화면이 아는 제공자(이 차례로 단추를 그린다). 서버 목록에 없는 것은 그리지 않는다 */
export const PROVIDERS = ["google", "kakao", "test"];

// ── 토큰 ─────────────────
export function myToken() {
  const v = setting("online.token", null);
  return typeof v === "string" && TOKEN.test(v) ? v : null;
}
export const signedIn = () => myToken() !== null;

// ── 바뀌면 알린다(프로필 칩이 이름·그림·로그인 칸을 다시 그린다) ─────────────────
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

let account = null; // 마지막으로 받은 계정 { id, made, logins: [{ provider, made }] }
export const lastAccount = () => account;

/** 새 손님으로(새 pid·무작위 이름). 로그아웃·계정 지우기 뒤 고를 수 있다 */
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
/** 서버에 켜진 로그인 방법(규약 8.2). 5분 동안 기억한다. 옛 서버(주소 없음)면 빈 목록 */
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
 * 로그인 창으로 간다. link 면 로그인한 채 다른 방법을 더한다(이어 붙이기, 지금 토큰을 같이 보낸다).
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
 * 돌아온 로그인을 마친다(규약 8.3 의 4). 이 창이 시작한 로그인이 아니면(nonce 없음) 아무것도 하지 않고 null.
 * 결과: { error, provider, link } 이거나 { switched, fresh, linked, provider, link }. 서버 오류는 OnlineError
 */
export async function finishLogin(ret) {
  if (!ret) return null;
  const p = ret.pending;
  if (ret.error !== null) return p ? { error: ret.error, provider: p.provider, link: Boolean(p.link) } : null;
  if (!p) return null;
  const r = await api("/api/auth/redeem", { body: { v: PROTOCOL, code: ret.code, nonce: p.nonce } });
  return { ...useLogin(r), provider: p.provider, link: Boolean(p.link) };
}

/** 로그인 결과(규약 8.3): 토큰을 두고, pid 가 다르면 계정 pid 로, 계정 이름·그림이 있으면 그것으로(없으면 지금 것을 올린다) */
function useLogin(r) {
  if (!r || typeof r.token !== "string" || !TOKEN.test(r.token)) throw new OnlineError("bad_reply", r);
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
