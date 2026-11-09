// 계정 Durable Object. 하나(이름 "accounts-1")에 계정 전부. SQLite 표.
// 로그인은 드물어서 하나로 충분하다(게임 중에는 부르지 않는다. 게임은 지금처럼 pid 만 본다).
//  - accounts:  계정(id, pid, 이름·그림, 동의한 처리방침 판·시각·만 14세 이상). pid 는 계정마다 하나, 다른 계정과 겹치지 않는다
//  - logins:    로그인(제공자 + 번호, 이메일은 다듬은 메일 주소)의 열쇠 → 계정. 번호·주소는 그대로 두지 않고 이 DO 만 아는 값(pepper)으로 HMAC 한 값만 둔다
//  - passwords: 이메일 로그인의 비밀번호. 화면이 PBKDF2 로 만든 열쇠(key)를 다시 HMAC 한 값만 둔다(비밀번호는 서버에 오지 않는다)
//  - sessions:  세션 토큰의 SHA-256 → 계정. 토큰 자체는 저장하지 않는다
//  - pending:   잠깐 두는 값: 로그인 창에 다녀오는 동안(state), 돌아온 화면이 한 번 쓰는 코드(handoff), 가입 화면 표(signup), 메일 확인 코드(email). 몇 분 뒤 지운다
//  - limits:    시도 횟수(메일 보내기·로그인 실패·하루 메일 수)
//  - meta:      pepper
// 규칙은 account.js(planLogin), 제공자 확인은 auth.js, 메일은 mail.js. 입구(account-route.js)가 부른다.

import { DurableObject } from "cloudflare:workers";
import { planLogin, newPid, newCode } from "./account.js";
import { hmacHex, randomId, sha256Hex } from "./auth.js";
import { checkFace, checkName } from "./check.js";
import { Fail } from "./http.js";
import {
  AUTH_HANDOFF_MS,
  AUTH_SIGNUP_MS,
  AUTH_STATE_MS,
  EMAIL_CODE_FAILS_PER_DAY,
  EMAIL_CODE_MS,
  EMAIL_CODE_TRIES,
  EMAIL_DAY_MAX,
  EMAIL_LOGIN_FAILS,
  EMAIL_SEND_PER_HOUR,
  SESSION_IDLE_MS,
  SESSION_MAX,
} from "./protocol.js";

const TIDY_MS = 3600_000;
/** 세션을 쓴 때(used)는 하루에 한 번만 고쳐 쓴다(쓰기를 아끼려고) */
const TOUCH_MS = 24 * 3600_000;
const HOUR = 3600_000;
const FAIL_WINDOW_MS = 15 * 60_000;
/** 같은 곳(IP 해시)에서: 한 시간에 메일 보내기 요청, 이메일 로그인 실패 */
const IP_SEND_PER_HOUR = 20;
const IP_FAILS_PER_HOUR = 50;

export class Accounts extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID");
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, pid TEXT NOT NULL UNIQUE, made INTEGER NOT NULL, name TEXT, face TEXT, policy TEXT, agreed INTEGER, age14 INTEGER) WITHOUT ROWID",
    );
    // 11-09 낮 판에서 만든 표에는 동의 칸이 없다(라이브 계정 DO 는 그 판에서 생기지 않았지만 로컬 시험 판을 위해)
    for (const col of ["policy TEXT", "agreed INTEGER", "age14 INTEGER"]) {
      try {
        this.sql.exec(`ALTER TABLE accounts ADD COLUMN ${col}`);
      } catch {
        // 이미 있다
      }
    }
    this.sql.exec("CREATE TABLE IF NOT EXISTS logins (key TEXT PRIMARY KEY, account TEXT NOT NULL, provider TEXT NOT NULL, made INTEGER NOT NULL) WITHOUT ROWID");
    this.sql.exec("CREATE INDEX IF NOT EXISTS logins_account ON logins (account)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS passwords (account TEXT PRIMARY KEY, login TEXT NOT NULL, hash TEXT NOT NULL, made INTEGER NOT NULL, changed INTEGER NOT NULL) WITHOUT ROWID");
    this.sql.exec("CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, account TEXT NOT NULL, made INTEGER NOT NULL, used INTEGER NOT NULL) WITHOUT ROWID");
    this.sql.exec("CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account, used)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS pending (hash TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, exp INTEGER NOT NULL) WITHOUT ROWID");
    this.sql.exec("CREATE INDEX IF NOT EXISTS pending_exp ON pending (exp)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS limits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL) WITHOUT ROWID");
    this.pepper_ = null;
    this.tidied = 0;
  }

  // ---- 안쪽 ----

  #one(q, ...args) {
    return this.sql.exec(q, ...args).toArray()[0] || null;
  }

  #pepper() {
    if (this.pepper_) return this.pepper_;
    let row = this.#one("SELECT v FROM meta WHERE k = 'pepper'");
    if (!row) {
      const a = new Uint8Array(32);
      crypto.getRandomValues(a);
      row = { v: [...a].map((x) => x.toString(16).padStart(2, "0")).join("") };
      this.sql.exec("INSERT INTO meta (k, v) VALUES ('pepper', ?)", row.v);
    }
    return (this.pepper_ = row.v);
  }

  #tidy(now) {
    if (now - this.tidied < TIDY_MS) return;
    this.tidied = now;
    this.sql.exec("DELETE FROM pending WHERE exp < ?", now);
    this.sql.exec("DELETE FROM sessions WHERE used < ?", now - SESSION_IDLE_MS);
    this.sql.exec("DELETE FROM limits WHERE until < ?", now);
  }

  /** 횟수 하나 세기. 창(windowMs) 안에서 max 를 넘으면 false(세지 않는다) */
  #hit(k, max, windowMs, now) {
    const row = this.#one("SELECT n, until FROM limits WHERE k = ?", k);
    if (!row || row.until < now) {
      this.sql.exec("INSERT OR REPLACE INTO limits (k, n, until) VALUES (?, 1, ?)", k, now + windowMs);
      return true;
    }
    if (row.n >= max) return false;
    this.sql.exec("UPDATE limits SET n = n + 1 WHERE k = ?", k);
    return true;
  }

  #over(k, max, now) {
    const row = this.#one("SELECT n, until FROM limits WHERE k = ?", k);
    return Boolean(row && row.until >= now && row.n >= max);
  }

  async #loginKey(provider, sub) {
    return hmacHex(this.#pepper(), `${provider}:${sub}`);
  }

  async #mac(s) {
    return hmacHex(this.#pepper(), s);
  }

  /** 세션 토큰 → 계정 줄. 없거나 오래 안 썼으면 bad_token */
  async #session(token, now) {
    const hash = await sha256Hex(token);
    const s = this.#one("SELECT account, used FROM sessions WHERE hash = ?", hash);
    if (!s || s.used < now - SESSION_IDLE_MS) {
      if (s) this.sql.exec("DELETE FROM sessions WHERE hash = ?", hash);
      throw new Fail("bad_token");
    }
    const acc = this.#one("SELECT * FROM accounts WHERE id = ?", s.account);
    if (!acc) {
      this.sql.exec("DELETE FROM sessions WHERE hash = ?", hash);
      throw new Fail("bad_token");
    }
    if (now - s.used > TOUCH_MS) this.sql.exec("UPDATE sessions SET used = ? WHERE hash = ?", now, hash);
    return { acc, hash };
  }

  async #newSession(account, now) {
    const token = randomId(32);
    this.sql.exec("INSERT INTO sessions (hash, account, made, used) VALUES (?, ?, ?, ?)", await sha256Hex(token), account, now, now);
    const extra = this.sql.exec("SELECT hash FROM sessions WHERE account = ? ORDER BY used DESC LIMIT -1 OFFSET ?", account, SESSION_MAX).toArray();
    for (const r of extra) this.sql.exec("DELETE FROM sessions WHERE hash = ?", r.hash);
    return token;
  }

  #view(acc) {
    const logins = this.sql.exec("SELECT provider, made FROM logins WHERE account = ? ORDER BY made", acc.id).toArray();
    return {
      account: { id: acc.id, made: acc.made, logins: logins.map((l) => ({ provider: l.provider, made: l.made })), policy: acc.policy ?? null },
      pid: acc.pid,
      profile: acc.name ? { name: acc.name, face: acc.face ?? null } : null,
    };
  }

  /** 로그인 결과(세션을 새로 만든다) */
  async #result(account, now, { fresh = false, linked = false } = {}) {
    const token = await this.#newSession(account, now);
    const acc = this.#one("SELECT * FROM accounts WHERE id = ?", account);
    return { token, fresh, linked, ...this.#view(acc) };
  }

  /** 새 계정. 화면 pid 가 다른 계정 것이 아니면 그 pid(손님 기록을 이어 간다), 맞으면 새 pid */
  #create({ key, provider, pid, name, face, consent, now }) {
    const account = randomId(16);
    const taken = this.#one("SELECT id FROM accounts WHERE pid = ?", pid);
    const use = taken ? newPid() : pid;
    this.sql.exec(
      "INSERT INTO accounts (id, pid, made, name, face, policy, agreed, age14) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      account,
      use,
      now,
      name,
      name ? face : null,
      consent.policy,
      now,
      consent.age14 ? 1 : 0,
    );
    this.sql.exec("INSERT INTO logins (key, account, provider, made) VALUES (?, ?, ?, ?)", key, account, provider, now);
    return account;
  }

  // ---- 잠깐 두는 값(pending) ----

  async #put(kind, id, data, exp) {
    this.sql.exec("INSERT OR REPLACE INTO pending (hash, kind, data, exp) VALUES (?, ?, ?, ?)", await sha256Hex(id), kind, JSON.stringify(data), exp);
  }

  /** 한 번만 꺼낸다(없거나 지났거나 다른 종류면 null) */
  async #take(kind, id, now) {
    const hash = await sha256Hex(id);
    const row = this.#one("SELECT kind, data, exp FROM pending WHERE hash = ?", hash);
    if (!row) return null;
    this.sql.exec("DELETE FROM pending WHERE hash = ?", hash);
    if (row.kind !== kind || row.exp < now) return null;
    return JSON.parse(row.data);
  }

  /** 지우지 않고 본다(확인 코드: 틀린 횟수를 세야 해서) */
  async #peek(kind, id, now) {
    const hash = await sha256Hex(id);
    const row = this.#one("SELECT kind, data, exp FROM pending WHERE hash = ?", hash);
    if (!row) return null;
    if (row.kind !== kind || row.exp < now) {
      this.sql.exec("DELETE FROM pending WHERE hash = ?", hash);
      return null;
    }
    return { hash, data: JSON.parse(row.data), exp: row.exp };
  }

  /**
   * 메일 확인 코드 맞추기. 틀리면 횟수를 세고 EMAIL_CODE_TRIES 번이면 그 코드를 버린다.
   * 코드를 새로 받아 틀린 횟수를 지우는 것을 막으려고 메일 하나에 하루 EMAIL_CODE_FAILS_PER_DAY 번까지만 틀릴 수 있다
   */
  async #checkCode(ek, id, code, now) {
    if (this.#over(`vfail:${ek}`, EMAIL_CODE_FAILS_PER_DAY, now)) throw new Fail("too_fast");
    const p = await this.#peek("email", id, now);
    if (!p) throw new Fail("bad_code");
    if (p.data.codeHash !== (await this.#mac(`code:${code}`))) {
      this.#hit(`vfail:${ek}`, EMAIL_CODE_FAILS_PER_DAY, 24 * HOUR, now);
      const tries = (p.data.tries || 0) + 1;
      if (tries >= EMAIL_CODE_TRIES) this.sql.exec("DELETE FROM pending WHERE hash = ?", p.hash);
      else this.sql.exec("UPDATE pending SET data = ? WHERE hash = ?", JSON.stringify({ ...p.data, tries }), p.hash);
      throw new Fail("bad_code");
    }
    this.sql.exec("DELETE FROM pending WHERE hash = ?", p.hash);
    return p.data;
  }

  /**
   * 메일 요청 세기: 그 주소 한 시간 5번, 같은 곳 한 시간 20번(넘으면 too_fast), 하루 전체 90통(넘으면 busy).
   * 가입된 주소인지와 상관없이 똑같이 센다(횟수 차이로 가입 여부를 알아내지 못하게). 실제로 보낼 때만 spendMail 로 하루 수를 쓴다
   */
  #mailRequest(ek, ip, now) {
    if (this.#over(`send:${ek}`, EMAIL_SEND_PER_HOUR, now) || (ip && this.#over(`ipsend:${ip}`, IP_SEND_PER_HOUR, now))) throw new Fail("too_fast");
    if (this.#over(`mail:${this.#day(now)}`, EMAIL_DAY_MAX, now)) throw new Fail("busy");
    this.#hit(`send:${ek}`, EMAIL_SEND_PER_HOUR, HOUR, now);
    if (ip) this.#hit(`ipsend:${ip}`, IP_SEND_PER_HOUR, HOUR, now);
  }

  #spendMail(now) {
    this.#hit(`mail:${this.#day(now)}`, EMAIL_DAY_MAX, 26 * HOUR, now);
  }

  #day(now) {
    return new Date(now).toISOString().slice(0, 10);
  }

  // ---- 입구가 부르는 것(아래 공개 메서드로 연다) ----

  /**
   * 로그인 창에 가기 전: state 로 값을 둔다. token 이 있으면(로그인한 채 다른 방법 더하기) 그 계정에 붙인다.
   * s: { state, provider, pid, back, nonceHash, verifier, oidcNonce, name, face, token }
   */
  async #beginAuth(s) {
    const now = Date.now();
    this.#tidy(now);
    const link = s.token ? (await this.#session(s.token, now)).acc.id : null;
    const data = { provider: s.provider, pid: s.pid, back: s.back, nonceHash: s.nonceHash, verifier: s.verifier, oidcNonce: s.oidcNonce, name: s.name, face: s.face, link };
    await this.#put("state", s.state, data, now + AUTH_STATE_MS);
    return { ok: true };
  }

  /** 돌아왔을 때: state 를 한 번만 꺼낸다(없거나 지났거나 다른 제공자면 null) */
  async #takeAuth({ state, provider }) {
    const data = await this.#take("state", state, Date.now());
    return { data: data && data.provider === provider ? data : null };
  }

  /**
   * 제공자가 확인해 준 번호로 들어가기. 처음 보는 로그인이면 계정을 바로 만들지 않고 가입 표(signup)를 준다(가입 화면을 거친다).
   * 돌려주는 값: 웹은 한 번 쓰는 코드(code), 앱(direct)은 로그인 결과나 { signup }
   * r: { provider, sub, pid, link | linkToken, name, face, nonceHash, direct }
   */
  async #login(r) {
    const now = Date.now();
    this.#tidy(now);
    // 이어 붙이기: 웹은 state 에 둔 계정(link), 앱은 함께 보낸 세션 토큰(linkToken)
    const link = r.linkToken ? (await this.#session(r.linkToken, now)).acc.id : r.link || null;
    const key = await this.#loginKey(r.provider, r.sub);
    const idAcc = this.#one("SELECT account FROM logins WHERE key = ?", key)?.account ?? null;
    let linkAcc = null;
    if (link) {
      linkAcc = this.#one("SELECT id FROM accounts WHERE id = ?", link)?.id ?? null;
      if (!linkAcc) throw new Fail("bad_token");
    }
    const pidAcc = this.#one("SELECT id FROM accounts WHERE pid = ?", r.pid)?.id ?? null;
    const plan = planLogin({ idAcc, linkAcc, pidAcc });
    if (plan.act === "in_use") throw new Fail("in_use");
    let out;
    if (plan.act === "create") {
      const ticket = randomId(32);
      await this.#put("signup", ticket, { key, provider: r.provider, pid: r.pid }, now + AUTH_SIGNUP_MS);
      out = { signup: { ticket, provider: r.provider, profile: r.name ? { name: r.name, face: r.face ?? null } : null } };
    } else {
      if (plan.act === "attach") this.sql.exec("INSERT INTO logins (key, account, provider, made) VALUES (?, ?, ?, ?)", key, plan.account, r.provider, now);
      out = { account: plan.account, linked: plan.act === "attach" };
    }
    if (r.direct) return out.signup ? out : this.#result(out.account, now, { linked: out.linked });
    const code = randomId(24);
    await this.#put("handoff", code, { ...out, nonceHash: r.nonceHash }, now + AUTH_HANDOFF_MS);
    return { code };
  }

  /** 돌아온 화면이 한 번 쓰는 코드를 세션 토큰(또는 가입 표)으로 바꾼다. 로그인을 시작한 화면의 nonce 가 맞아야 한다 */
  async #redeem({ code, nonceHash }) {
    const now = Date.now();
    const h = await this.#take("handoff", code, now);
    if (!h || h.nonceHash !== nonceHash) throw new Fail("bad_login");
    if (h.signup) return { signup: h.signup };
    if (!this.#one("SELECT id FROM accounts WHERE id = ?", h.account)) throw new Fail("bad_login");
    return this.#result(h.account, now, { linked: h.linked });
  }

  /** 가입 화면을 마침: 표를 한 번 쓰고 계정을 만든다(그사이 같은 로그인으로 계정이 생겼으면 그 계정으로 들어간다) */
  async #signup({ ticket, name, face, consent }) {
    const now = Date.now();
    const d = await this.#take("signup", ticket, now);
    if (!d) throw new Fail("bad_login");
    const idAcc = this.#one("SELECT account FROM logins WHERE key = ?", d.key)?.account ?? null;
    if (idAcc) return this.#result(idAcc, now);
    const account = this.#create({ key: d.key, provider: d.provider, pid: d.pid, name, face, consent, now });
    return this.#result(account, now, { fresh: true });
  }

  // ---- 이메일 ----

  /**
   * 이메일 가입(또는 token 이 있으면 로그인한 계정에 이메일 로그인 더하기): 확인 코드를 만든다. 이미 가입된 주소면 그 사실을 메일로만 알린다(답은 같다).
   * 돌려주는 값 { mail: { kind, code? } } → 입구가 보낸다
   */
  async #emailSignup({ email, key, pid, name, face, consent, token, ip }) {
    const now = Date.now();
    this.#tidy(now);
    const ek = await this.#loginKey("email", email);
    const link = token ? (await this.#session(token, now)).acc.id : null;
    if (link && this.#one("SELECT account FROM passwords WHERE account = ?", link)) throw new Fail("in_use");
    this.#mailRequest(ek, ip, now);
    this.#spendMail(now);
    if (this.#one("SELECT account FROM logins WHERE key = ?", ek)) return { mail: { kind: "exists" } };
    const code = newCode();
    await this.#put(
      "email",
      `es:${ek}`,
      { ek, pwHash: await this.#mac(`pw:${key}`), pid, name, face, consent, link, codeHash: await this.#mac(`code:${code}`), tries: 0 },
      now + EMAIL_CODE_MS,
    );
    return { mail: { kind: link ? "link" : "signup", code } };
  }

  /** 이메일 가입 확인: 코드가 맞으면 계정을 만들거나(가입) 로그인한 계정에 붙인다 */
  async #emailVerify({ email, code }) {
    const now = Date.now();
    const ek = await this.#loginKey("email", email);
    const d = await this.#checkCode(ek, `es:${ek}`, code, now);
    if (this.#one("SELECT account FROM logins WHERE key = ?", ek)) throw new Fail("in_use");
    let account;
    let fresh = false;
    if (d.link) {
      if (!this.#one("SELECT id FROM accounts WHERE id = ?", d.link)) throw new Fail("bad_token");
      if (this.#one("SELECT account FROM passwords WHERE account = ?", d.link)) throw new Fail("in_use");
      account = d.link;
      this.sql.exec("INSERT INTO logins (key, account, provider, made) VALUES (?, ?, 'email', ?)", ek, account, now);
    } else {
      account = this.#create({ key: ek, provider: "email", pid: d.pid, name: d.name, face: d.face, consent: d.consent, now });
      fresh = true;
    }
    this.sql.exec("INSERT OR REPLACE INTO passwords (account, login, hash, made, changed) VALUES (?, ?, ?, ?, ?)", account, ek, d.pwHash, now, now);
    return this.#result(account, now, { fresh, linked: Boolean(d.link) });
  }

  /** 이메일 로그인. 없는 주소와 틀린 비밀번호는 같은 오류(bad_login). 메일 하나에 15분 10번, 같은 곳 한 시간 50번 틀리면 too_fast */
  async #emailLogin({ email, key, ip }) {
    const now = Date.now();
    this.#tidy(now);
    const ek = await this.#loginKey("email", email);
    if (this.#over(`fail:${ek}`, EMAIL_LOGIN_FAILS, now) || (ip && this.#over(`ipfail:${ip}`, IP_FAILS_PER_HOUR, now))) throw new Fail("too_fast");
    const login = this.#one("SELECT account FROM logins WHERE key = ?", ek);
    const pw = login ? this.#one("SELECT hash FROM passwords WHERE account = ?", login.account) : null;
    const h = await this.#mac(`pw:${key}`); // 없는 주소여도 같은 일을 한다(시간 차이를 줄인다)
    if (!pw || pw.hash !== h) {
      this.#hit(`fail:${ek}`, EMAIL_LOGIN_FAILS, FAIL_WINDOW_MS, now);
      if (ip) this.#hit(`ipfail:${ip}`, IP_FAILS_PER_HOUR, HOUR, now);
      throw new Fail("bad_login");
    }
    this.sql.exec("DELETE FROM limits WHERE k = ?", `fail:${ek}`);
    return this.#result(login.account, now);
  }

  /** 비밀번호 찾기: 가입된 주소면 코드를 만든다. 없는 주소면 아무것도 보내지 않는다(답은 같다) */
  async #emailReset({ email, ip }) {
    const now = Date.now();
    this.#tidy(now);
    const ek = await this.#loginKey("email", email);
    this.#mailRequest(ek, ip, now);
    const login = this.#one("SELECT account FROM logins WHERE key = ?", ek);
    if (!login) return { mail: null };
    this.#spendMail(now);
    const code = newCode();
    await this.#put("email", `er:${ek}`, { account: login.account, codeHash: await this.#mac(`code:${code}`), tries: 0 }, now + EMAIL_CODE_MS);
    return { mail: { kind: "reset", code } };
  }

  /** 비밀번호 바꾸기(코드 확인): 새 비밀번호를 두고 모든 기기를 로그아웃한 뒤 이 기기만 로그인 */
  async #emailResetConfirm({ email, code, key }) {
    const now = Date.now();
    const ek = await this.#loginKey("email", email);
    const d = await this.#checkCode(ek, `er:${ek}`, code, now);
    const login = this.#one("SELECT account FROM logins WHERE key = ?", ek);
    if (!login || login.account !== d.account) throw new Fail("bad_code");
    this.sql.exec("INSERT OR REPLACE INTO passwords (account, login, hash, made, changed) VALUES (?, ?, ?, COALESCE((SELECT made FROM passwords WHERE account = ?), ?), ?)", d.account, ek, await this.#mac(`pw:${key}`), d.account, now, now);
    this.sql.exec("DELETE FROM sessions WHERE account = ?", d.account);
    this.sql.exec("DELETE FROM limits WHERE k = ?", `fail:${ek}`);
    return this.#result(d.account, now);
  }

  // ---- 계정 ----

  async #me({ token }) {
    const { acc } = await this.#session(token, Date.now());
    return this.#view(acc);
  }

  /** 계정에 이름·그림을 둔다(다른 기기에서 로그인해도 같은 이름) */
  async #setProfile({ token, name, face }) {
    const { acc } = await this.#session(token, Date.now());
    const n = checkName(name);
    const f = checkFace(face ?? null);
    this.sql.exec("UPDATE accounts SET name = ?, face = ? WHERE id = ?", n, f, acc.id);
    return { profile: { name: n, face: f } };
  }

  /** 이 기기만 로그아웃(토큰을 지운다). 이미 없는 토큰이어도 괜찮다 */
  async #logout({ token }) {
    this.sql.exec("DELETE FROM sessions WHERE hash = ?", await sha256Hex(token));
    return { ok: true };
  }

  /** 로그인 방법 하나 떼기. 마지막 하나는 못 뗀다(계정에 다시 들어올 길이 없어진다). 이메일을 떼면 비밀번호도 지운다 */
  async #unlink({ token, provider }) {
    const { acc } = await this.#session(token, Date.now());
    const rows = this.sql.exec("SELECT key, provider FROM logins WHERE account = ?", acc.id).toArray();
    const drop = rows.filter((l) => l.provider === provider);
    if (!drop.length) throw new Fail("not_found");
    if (drop.length === rows.length) throw new Fail("last_login");
    for (const l of drop) this.sql.exec("DELETE FROM logins WHERE key = ?", l.key);
    if (provider === "email") this.sql.exec("DELETE FROM passwords WHERE account = ?", acc.id);
    return this.#view(acc);
  }

  /** 계정 지우기: 계정·로그인·비밀번호·세션을 모두 지운다. 게임 기록(pid)은 계정과 떨어져 남는다 */
  async #remove({ token }) {
    const { acc } = await this.#session(token, Date.now());
    this.sql.exec("DELETE FROM sessions WHERE account = ?", acc.id);
    this.sql.exec("DELETE FROM logins WHERE account = ?", acc.id);
    this.sql.exec("DELETE FROM passwords WHERE account = ?", acc.id);
    this.sql.exec("DELETE FROM accounts WHERE id = ?", acc.id);
    return { ok: true, pid: acc.pid };
  }

  // ---- RPC 로 여는 것 ----
  // DO 안에서 Fail 을 던지면 RPC 를 지나며 꼴을 잃으니, 오류는 { error, status } 로 돌려준다(입구가 다시 던진다)

  async #safe(fn) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Fail) return { error: e.code, status: e.status, ...(e.extra || {}) };
      throw e;
    }
  }

  beginAuth(arg) {
    return this.#safe(() => this.#beginAuth(arg));
  }

  takeAuth(arg) {
    return this.#safe(() => this.#takeAuth(arg));
  }

  login(arg) {
    return this.#safe(() => this.#login(arg));
  }

  redeem(arg) {
    return this.#safe(() => this.#redeem(arg));
  }

  signup(arg) {
    return this.#safe(() => this.#signup(arg));
  }

  emailSignup(arg) {
    return this.#safe(() => this.#emailSignup(arg));
  }

  emailVerify(arg) {
    return this.#safe(() => this.#emailVerify(arg));
  }

  emailLogin(arg) {
    return this.#safe(() => this.#emailLogin(arg));
  }

  emailReset(arg) {
    return this.#safe(() => this.#emailReset(arg));
  }

  emailResetConfirm(arg) {
    return this.#safe(() => this.#emailResetConfirm(arg));
  }

  me(arg) {
    return this.#safe(() => this.#me(arg));
  }

  setProfile(arg) {
    return this.#safe(() => this.#setProfile(arg));
  }

  logout(arg) {
    return this.#safe(() => this.#logout(arg));
  }

  unlink(arg) {
    return this.#safe(() => this.#unlink(arg));
  }

  remove(arg) {
    return this.#safe(() => this.#remove(arg));
  }
}
