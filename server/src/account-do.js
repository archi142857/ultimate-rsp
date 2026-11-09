// 계정 Durable Object. 하나(이름 "accounts-1")에 계정 전부. SQLite 표 다섯 개.
// 로그인은 드물어서 하나로 충분하다(게임 중에는 부르지 않는다. 게임은 지금처럼 pid 만 본다).
//  - accounts: 계정(id, pid, 이름·그림). pid 는 계정마다 하나, 다른 계정과 겹치지 않는다
//  - logins:   로그인(제공자 + 번호)의 열쇠 → 계정. 번호는 그대로 두지 않고 이 DO 만 아는 값(pepper)으로 HMAC 한 값만 둔다
//  - sessions: 세션 토큰의 SHA-256 → 계정. 토큰 자체는 저장하지 않는다
//  - pending:  로그인 창에 다녀오는 동안의 값(state)과, 돌아온 화면이 한 번 쓰는 코드(handoff). 몇 분 뒤 지운다
//  - meta:     pepper
// 규칙은 account.js(planLogin), 제공자 확인은 auth.js. 입구(index.js)가 부른다.

import { DurableObject } from "cloudflare:workers";
import { planLogin, newPid } from "./account.js";
import { hmacHex, randomId, sha256Hex } from "./auth.js";
import { checkFace, checkName } from "./check.js";
import { Fail } from "./http.js";
import { AUTH_HANDOFF_MS, AUTH_STATE_MS, SESSION_IDLE_MS, SESSION_MAX } from "./protocol.js";

const TIDY_MS = 3600_000;
/** 세션을 쓴 때(used)는 하루에 한 번만 고쳐 쓴다(쓰기를 아끼려고) */
const TOUCH_MS = 24 * 3600_000;

export class Accounts extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID");
    this.sql.exec("CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, pid TEXT NOT NULL UNIQUE, made INTEGER NOT NULL, name TEXT, face TEXT) WITHOUT ROWID");
    this.sql.exec("CREATE TABLE IF NOT EXISTS logins (key TEXT PRIMARY KEY, account TEXT NOT NULL, provider TEXT NOT NULL, made INTEGER NOT NULL) WITHOUT ROWID");
    this.sql.exec("CREATE INDEX IF NOT EXISTS logins_account ON logins (account)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, account TEXT NOT NULL, made INTEGER NOT NULL, used INTEGER NOT NULL) WITHOUT ROWID");
    this.sql.exec("CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account, used)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS pending (hash TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, exp INTEGER NOT NULL) WITHOUT ROWID");
    this.sql.exec("CREATE INDEX IF NOT EXISTS pending_exp ON pending (exp)");
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
  }

  async #loginKey(provider, sub) {
    return hmacHex(this.#pepper(), `${provider}:${sub}`);
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
      account: { id: acc.id, made: acc.made, logins: logins.map((l) => ({ provider: l.provider, made: l.made })) },
      pid: acc.pid,
      profile: acc.name ? { name: acc.name, face: acc.face ?? null } : null,
    };
  }

  async #put(kind, code, data, exp) {
    this.sql.exec("INSERT OR REPLACE INTO pending (hash, kind, data, exp) VALUES (?, ?, ?, ?)", await sha256Hex(code), kind, JSON.stringify(data), exp);
  }

  async #take(kind, code, now) {
    const hash = await sha256Hex(code);
    const row = this.#one("SELECT kind, data, exp FROM pending WHERE hash = ?", hash);
    if (!row) return null;
    this.sql.exec("DELETE FROM pending WHERE hash = ?", hash);
    if (row.kind !== kind || row.exp < now) return null;
    return JSON.parse(row.data);
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
   * 제공자가 확인해 준 번호로 들어가기. 돌려주는 값은 한 번 쓰는 코드(handoff, 웹) 또는 세션(앱, direct)
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
    let account;
    let fresh = false;
    if (plan.act === "in_use") throw new Fail("in_use");
    if (plan.act === "create") {
      account = randomId(16);
      const pid = plan.keepPid ? r.pid : newPid();
      const name = r.name ? checkName(r.name) : null;
      const face = name ? checkFace(r.face ?? null) : null;
      this.sql.exec("INSERT INTO accounts (id, pid, made, name, face) VALUES (?, ?, ?, ?, ?)", account, pid, now, name, face);
      this.sql.exec("INSERT INTO logins (key, account, provider, made) VALUES (?, ?, ?, ?)", key, account, r.provider, now);
      fresh = true;
    } else if (plan.act === "attach") {
      account = plan.account;
      this.sql.exec("INSERT INTO logins (key, account, provider, made) VALUES (?, ?, ?, ?)", key, account, r.provider, now);
    } else {
      account = plan.account;
    }
    if (r.direct) {
      const token = await this.#newSession(account, now);
      const acc = this.#one("SELECT * FROM accounts WHERE id = ?", account);
      return { token, fresh, linked: plan.act === "attach", ...this.#view(acc) };
    }
    const code = randomId(24);
    await this.#put("handoff", code, { account, fresh, linked: plan.act === "attach", nonceHash: r.nonceHash }, now + AUTH_HANDOFF_MS);
    return { code };
  }

  /** 돌아온 화면이 한 번 쓰는 코드를 세션 토큰으로 바꾼다. 로그인을 시작한 화면의 nonce 가 맞아야 한다 */
  async #redeem({ code, nonceHash }) {
    const now = Date.now();
    const h = await this.#take("handoff", code, now);
    if (!h || h.nonceHash !== nonceHash) throw new Fail("bad_login");
    const acc = this.#one("SELECT * FROM accounts WHERE id = ?", h.account);
    if (!acc) throw new Fail("bad_login");
    const token = await this.#newSession(acc.id, now);
    return { token, fresh: h.fresh, linked: h.linked, ...this.#view(acc) };
  }

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

  /** 로그인 방법 하나 떼기. 마지막 하나는 못 뗀다(계정에 다시 들어올 길이 없어진다) */
  async #unlink({ token, provider }) {
    const { acc } = await this.#session(token, Date.now());
    const rows = this.sql.exec("SELECT key, provider FROM logins WHERE account = ?", acc.id).toArray();
    const drop = rows.filter((l) => l.provider === provider);
    if (!drop.length) throw new Fail("not_found");
    if (drop.length === rows.length) throw new Fail("last_login");
    for (const l of drop) this.sql.exec("DELETE FROM logins WHERE key = ?", l.key);
    return this.#view(acc);
  }

  /** 계정 지우기: 계정·로그인·세션을 모두 지운다. 게임 기록(pid)은 계정과 떨어져 남는다 */
  async #remove({ token }) {
    const { acc } = await this.#session(token, Date.now());
    this.sql.exec("DELETE FROM sessions WHERE account = ?", acc.id);
    this.sql.exec("DELETE FROM logins WHERE account = ?", acc.id);
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
