// 계정 규칙(순수). 계정은 '게임 속 나(pid)를 어느 기기·플랫폼에서든 되찾는 열쇠'다.
// 계정 하나에 로그인 여러 개(구글·카카오, 나중에 애플·스팀)를 붙일 수 있고, 게임 서버는 지금처럼 pid 만 본다.
// 저장(account-do.js)과 입구(index.js)가 쓴다. Cloudflare 없이 돈다.

import { Fail, allowedOrigin } from "./http.js";
import { randomId } from "./auth.js";
import { PRIVACY_VERSION } from "./protocol.js";

/** 화면과 같은 pid 꼴(16바이트 → 22자). 서버가 새 pid 를 줄 때 쓴다 */
export const newPid = () => randomId(16);

const NONCE = /^[A-Za-z0-9_-]{16,64}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const HANDOFF = /^[A-Za-z0-9_-]{32}$/;
const STATE = /^[A-Za-z0-9_-]{43}$/;

/** 로그인을 시작한 화면만 아는 값(로그인 끝에 다시 보인다). 남이 만든 로그인 주소로 남의 계정에 들어가게 하는 것을 막는다 */
export function checkNonce(n) {
  if (typeof n !== "string" || !NONCE.test(n)) throw new Fail("bad_request");
  return n;
}

/** 세션 토큰(32바이트). 꼴이 틀리면 bad_token */
export function checkToken(t) {
  if (typeof t !== "string" || !TOKEN.test(t)) throw new Fail("bad_token");
  return t;
}

export function checkHandoff(c) {
  if (typeof c !== "string" || !HANDOFF.test(c)) throw new Fail("bad_login");
  return c;
}

export function isState(s) {
  return typeof s === "string" && STATE.test(s);
}

/**
 * 로그인 뒤 돌아갈 화면 주소. 받는 출처(ORIGINS, 로컬 시험 주소)의 http(s) 주소만 받는다(남의 사이트로 보내는 것을 막는다)
 */
export function checkBack(back, origins) {
  if (typeof back !== "string" || back.length > 600) throw new Fail("bad_back");
  let u;
  try {
    u = new URL(back);
  } catch {
    throw new Fail("bad_back");
  }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password || !allowedOrigin(u.origin, origins)) throw new Fail("bad_back");
  return u.href;
}

/** 돌아갈 주소에 login(한 번 쓰는 코드)이나 login_error 를 단다. 화면의 # 주소는 그대로 둔다 */
export function backWith(back, key, value) {
  const u = new URL(back);
  u.searchParams.delete("login");
  u.searchParams.delete("login_error");
  u.searchParams.set(key, value);
  return u.href;
}

/**
 * 로그인 정하기. idAcc: 이 로그인(제공자·번호)이 붙은 계정, linkAcc: 로그인한 채 다른 방법을 더할 때 그 계정,
 * pidAcc: 화면이 보낸 pid 가 붙은 계정(모두 없으면 null).
 *  - { act: "login", account }: 이 로그인의 계정으로 들어간다(pid 는 계정 것으로 바뀔 수 있다)
 *  - { act: "attach", account }: linkAcc 에 이 로그인을 붙인다
 *  - { act: "same", account }: 이미 그 계정에 붙어 있다
 *  - { act: "create", keepPid }: 새 계정. 화면 pid 가 다른 계정 것이 아니면 그 pid(손님 기록을 그대로 이어 간다), 맞으면 새 pid
 *  - { act: "in_use" }: 이 로그인은 다른 계정에 붙어 있다(이어 붙일 수 없다)
 * pid 를 안다고 그 계정에 로그인을 붙이지는 않는다(pid 는 주소에도 실리니 계정 열쇠보다 약하다). 붙이려면 세션 토큰이 있어야 한다
 */
export function planLogin({ idAcc = null, linkAcc = null, pidAcc = null }) {
  if (linkAcc) {
    if (!idAcc) return { act: "attach", account: linkAcc };
    if (idAcc === linkAcc) return { act: "same", account: linkAcc };
    return { act: "in_use" };
  }
  if (idAcc) return { act: "login", account: idAcc };
  return { act: "create", keepPid: !pidAcc };
}

const TICKET = /^[A-Za-z0-9_-]{43}$/;
/** 가입 표(새 로그인 → 가입 화면 → POST /api/auth/signup) */
export function checkTicket(t) {
  if (typeof t !== "string" || !TICKET.test(t)) throw new Fail("bad_login");
  return t;
}

/**
 * 가입 동의: 개인정보 처리방침 동의(agree)와 만 14세 이상(age14)이 둘 다 true 여야 한다.
 * policy 는 화면이 보여 준 처리방침 판. 지금 판(PRIVACY_VERSION)과 다르면 old_policy(화면이 새로 읽고 다시 묻는다)
 */
export function checkConsent(body) {
  if (!body || body.agree !== true || body.age14 !== true) throw new Fail("need_agree");
  if (body.policy !== PRIVACY_VERSION) throw new Fail("old_policy");
  return { policy: PRIVACY_VERSION, age14: true };
}

/**
 * 메일 주소 다듬기: 앞뒤 빈칸 지우기, NFC, 소문자. 꼴은 넉넉하게 본다(로컬@도메인.끝, 254자까지, 빈칸·꺾쇠 없음).
 * 다듬은 값이 같으면 같은 계정이다(화면도 같은 방식으로 다듬어 PBKDF2 소금에 쓴다)
 */
export function checkEmail(e) {
  if (typeof e !== "string") throw new Fail("bad_email");
  const m = e.trim().normalize("NFC").toLowerCase();
  if (m.length < 3 || m.length > 254 || !/^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\.]{2,}$/u.test(m) || /\.\./.test(m)) throw new Fail("bad_email");
  return m;
}

const KEY = /^[A-Za-z0-9_-]{43}$/;
/** 화면이 비밀번호로 만든 열쇠(PBKDF2 32바이트 → 43자). 비밀번호 자체는 오지 않는다 */
export function checkKey(k) {
  if (typeof k !== "string" || !KEY.test(k)) throw new Fail("bad_request");
  return k;
}

/** 메일로 보낸 6자리 확인 코드 */
export function checkCode(c) {
  if (typeof c !== "string" || !/^[0-9]{6}$/.test(c)) throw new Fail("bad_code");
  return c;
}

/** 6자리 확인 코드(000000–999999, 고르게) */
export function newCode() {
  const a = new Uint32Array(1);
  let x;
  do {
    crypto.getRandomValues(a);
    x = a[0];
  } while (x >= 4_294_000_000); // 1,000,000 의 배수 아래만 써서 고르게
  return String(x % 1_000_000).padStart(6, "0");
}
