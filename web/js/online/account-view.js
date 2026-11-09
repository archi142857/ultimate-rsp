// 로그인 화면(규약 8장): 프로필 칸 안의 로그인 칸, 계정 시트, 로그인에서 돌아왔을 때의 알림.
// 생김새는 디자인 시안이 정해지면 입힌다(백엔드 11-09 쪽지 9번). 지금은 다른 시트와 같은 꼴.

import { h } from "../ui/dom.js";
import { t } from "../i18n.js";
import { toast } from "../ui/toast.js";
import { OnlineError } from "./net.js";
import { errorText } from "./messages.js";
import { dateText } from "./common.js";
import {
  signedIn,
  lastAccount,
  loginMethods,
  startLogin,
  takeLoginReturn,
  finishLogin,
  accountInfo,
  unlinkLogin,
  signOut,
  deleteAccount,
  becomeGuest,
  onAccount,
} from "./account.js";

export const PRIVACY_URL = "privacy.html";

/** 제공자 이름 */
export function providerName(p) {
  return p === "google" ? "Google" : p === "kakao" ? t("카카오") : p === "test" ? t("시험") : p;
}

/** 로그인 단추 글 */
function signInText(p) {
  return p === "google" ? t("Google로 로그인") : p === "kakao" ? t("카카오로 로그인") : t("시험 로그인");
}

/** 로그인에서 돌아온 오류(?login_error=)와 로그인·계정 오류 코드의 문장 */
export function loginErrorText(code) {
  switch (code) {
    case "cancel":
      return t("로그인을 취소했습니다.");
    case "provider":
      return t("로그인하지 못했습니다. 다시 해 주십시오.");
    case "no_storage":
      return t("이 브라우저에서는 로그인할 수 없습니다. 사생활 보호 창이면 일반 창에서 해 주십시오.");
    case "not_found":
      // 옛 서버(로그인 주소가 없다)이거나 이미 뗀 방법
      return errorText("no_provider");
    default:
      return errorText(code);
  }
}

const isAuthCode = (e) => e instanceof OnlineError && Boolean(e.code);

// ── 돌아왔을 때 ─────────────────
/** 라우터가 그리기 전에 부른다: 주소에서 login·login_error 를 지우고, 로그인을 마치고, 결과를 알린다 */
export function handleLoginReturn() {
  const ret = takeLoginReturn();
  if (!ret) return;
  finishLogin(ret).then(
    (r) => {
      if (!r) return;
      if (r.error) {
        toast(r.link ? t("로그인 방법 더하기 실패") : t("로그인 실패"), loginErrorText(r.error), { kind: r.error === "cancel" ? "note" : "drop" });
        return;
      }
      if (r.linked) toast(t("{p} 로그인 더함", { p: providerName(r.provider) }), t("이제 이 방법으로도 같은 계정에 로그인할 수 있습니다."));
      else if (r.switched) toast(t("로그인함"), t("계정의 기록과 이름으로 바꿨습니다. 이 기기에서 손님으로 쌓은 기록은 따로 남습니다."));
      else if (r.fresh) toast(t("로그인함"), t("이제 다른 기기에서도 이 기록과 이름을 씁니다."));
      else toast(t("로그인함"));
    },
    (e) => toast(t("로그인 실패"), loginErrorText(isAuthCode(e) ? e.code : "server"), { kind: "drop" }),
  );
}

// ── 프로필 칸 안의 로그인 칸 ─────────────────
/**
 * 로그인하지 않았으면 켜진 방법의 로그인 단추(켜진 방법이 없으면 아무것도 없다), 로그인했으면 '계정' 단추.
 * beforeSheet(): 계정 시트를 열기 전에 부른다(프로필 칸을 닫는다). 시트를 닫은 뒤 초점을 줄 곳을 돌려준다
 */
export function loginBlock({ beforeSheet = null } = {}) {
  const el = h("div", { class: "plogin", hidden: true });
  let seq = 0;

  async function draw() {
    const my = ++seq;
    if (signedIn()) {
      const acc = lastAccount();
      const names = acc && Array.isArray(acc.logins) ? [...new Set(acc.logins.map((l) => providerName(l.provider)))].join(" · ") : "";
      const open = h("button", { type: "button", class: "btn" }, t("계정"));
      open.addEventListener("click", () => {
        const back = beforeSheet ? beforeSheet() : null;
        openAccountSheet({ returnTo: back });
      });
      el.replaceChildren(h("div", { class: "plogin-row" }, h("span", { class: "o-p o-small plogin-who" }, names ? t("로그인함 · {m}", { m: names }) : t("로그인함")), open));
      el.hidden = false;
      return;
    }
    let list = [];
    try {
      list = await loginMethods();
    } catch {
      list = [];
    }
    if (my !== seq) return;
    if (!list.length) {
      el.replaceChildren();
      el.hidden = true;
      return;
    }
    const msg = h("p", { class: "o-p o-small plogin-msg", role: "alert", hidden: true });
    const btns = list.map((p) => {
      const b = h("button", { type: "button", class: `btn plogin-btn plogin-${p}` }, signInText(p));
      b.addEventListener("click", async () => {
        for (const x of btns) x.disabled = true;
        msg.hidden = true;
        try {
          await startLogin(p);
        } catch (e) {
          msg.textContent = loginErrorText(isAuthCode(e) ? e.code : "server");
          msg.hidden = false;
          for (const x of btns) x.disabled = false;
        }
      });
      return b;
    });
    el.replaceChildren(
      h("div", { class: "pname-head" }, h("span", { class: "pname-label" }, t("로그인"))),
      h("p", { class: "o-p o-small" }, t("로그인하면 다른 기기에서도 같은 기록과 이름을 씁니다. 하지 않아도 됩니다.")),
      h("div", { class: "plogin-btns" }, ...btns),
      msg,
      h("a", { class: "o-link o-small", href: PRIVACY_URL }, t("개인정보 처리방침")),
    );
    el.hidden = false;
  }

  const off = onAccount(() => draw());
  return { el, draw, destroy: off };
}

// ── 계정 시트 ─────────────────
let sheetOpen = null;

/** 계정 시트(규약 8.5): 붙은 로그인 방법·떼기, 방법 더하기, 로그아웃, 계정 지우기. returnTo: 닫은 뒤 초점 */
export function openAccountSheet({ returnTo = null } = {}) {
  if (sheetOpen) return;
  const wrap = h("div", { class: "o-sheet-wrap account-wrap" });
  const body = h("div", { class: "o-sheet account-sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "account-title" });
  const keys = new AbortController();
  const back = returnTo || document.activeElement;
  const close = () => {
    keys.abort();
    wrap.remove();
    sheetOpen = null;
    if (back && back.isConnected && typeof back.focus === "function") back.focus({ preventScroll: true });
  };
  sheetOpen = { close };
  wrap.append(h("div", { class: "o-scrim", onclick: close }), body);
  document.body.append(wrap);
  // Esc 는 닫기, Tab 은 시트 안에서만 돈다
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab") {
        const all = [...body.querySelectorAll("button:not([disabled]), a[href]")].filter((x) => x.offsetParent !== null);
        if (!all.length) return;
        const i = all.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? all.length - 1 : i - 1) : i === -1 || i === all.length - 1 ? 0 : i + 1;
        e.preventDefault();
        all[next].focus();
      }
    },
    { signal: keys.signal },
  );
  const title = (text) => h("h2", { class: "o-h2", id: "account-title" }, text);
  const say = h("p", { class: "o-p o-small account-msg", role: "alert", hidden: true });
  const fail = (e) => {
    say.textContent = loginErrorText(isAuthCode(e) ? e.code : "server");
    say.hidden = false;
  };

  // 로그아웃·지우기 뒤: 새 손님으로 바꿀지 묻는다(함께 쓰는 기기에 계정 pid 가 남지 않게)
  function guestStep(done) {
    const fresh = h("button", { type: "button", class: "btn btn-ink btn-big" }, t("새 손님으로 바꾸기"));
    const keep = h("button", { type: "button", class: "btn btn-big" }, t("그대로 두기"));
    fresh.addEventListener("click", () => {
      becomeGuest();
      close();
      toast(done, t("새 손님으로 바꿨습니다. 이름과 기록을 새로 시작합니다."));
    });
    keep.addEventListener("click", () => {
      close();
      toast(done);
    });
    body.replaceChildren(title(t("새 손님으로 바꾸시겠습니까?")), h("p", { class: "o-p" }, t("이 기기를 다른 사람과 같이 쓴다면 바꾸면 됩니다. 이름과 기록을 새로 시작합니다.")), fresh, keep);
    fresh.focus();
  }

  function confirmDelete() {
    const yes = h("button", { type: "button", class: "btn btn-danger btn-big" }, t("계정 지우기"));
    const no = h("button", { type: "button", class: "btn btn-big" }, t("취소"));
    yes.addEventListener("click", async () => {
      yes.disabled = no.disabled = true;
      say.hidden = true;
      try {
        await deleteAccount();
        guestStep(t("계정 지움"));
      } catch (e) {
        fail(e);
        yes.disabled = no.disabled = false;
        if (!signedIn()) close();
      }
    });
    no.addEventListener("click", () => draw());
    body.replaceChildren(title(t("계정을 지우시겠습니까?")), h("p", { class: "o-p" }, t("로그인 방법과 모든 기기의 로그인이 사라집니다. 게임 기록과 순위는 남습니다.")), say, yes, no);
    no.focus();
  }

  async function draw() {
    say.hidden = true;
    body.replaceChildren(title(t("계정")), h("p", { class: "o-p o-small" }, t("계정 불러오는 중…")));
    let acc = lastAccount();
    let list = [];
    try {
      const [r, l] = await Promise.all([accountInfo(), loginMethods().catch(() => [])]);
      acc = r.account;
      list = l;
    } catch (e) {
      if (!signedIn()) {
        close();
        toast(t("로그인 끝남"), loginErrorText("bad_token"));
        return;
      }
      fail(e);
    }
    if (!sheetOpen) return;
    const logins = acc && Array.isArray(acc.logins) ? acc.logins : [];
    const rows = logins.map((l) => {
      const off = h("button", { type: "button", class: "btn btn-sm" }, t("떼기"));
      off.addEventListener("click", async () => {
        off.disabled = true;
        say.hidden = true;
        try {
          await unlinkLogin(l.provider);
          draw();
        } catch (e) {
          fail(e);
          off.disabled = false;
        }
      });
      return h(
        "li",
        { class: "account-login" },
        h("span", { class: "account-login-name" }, providerName(l.provider)),
        h("span", { class: "o-p o-small account-login-when" }, t("{date}에 붙임", { date: dateText(l.made) })),
        off,
      );
    });
    const have = new Set(logins.map((l) => l.provider));
    // 시험 제공자는 같은 방법으로 여러 사람을 붙여 볼 수 있게 늘 보인다
    const more = list.filter((p) => !have.has(p) || p === "test");
    const addBtns = more.map((p) => {
      const b = h("button", { type: "button", class: `btn plogin-btn plogin-${p}` }, signInText(p));
      b.addEventListener("click", async () => {
        b.disabled = true;
        say.hidden = true;
        try {
          await startLogin(p, { link: true });
        } catch (e) {
          fail(e);
          b.disabled = false;
        }
      });
      return b;
    });
    const out = h("button", { type: "button", class: "btn btn-big" }, t("로그아웃"));
    out.addEventListener("click", async () => {
      out.disabled = true;
      await signOut();
      guestStep(t("로그아웃함"));
    });
    const del = h("button", { type: "button", class: "btn btn-danger-ghost btn-big" }, t("계정 지우기"));
    del.addEventListener("click", confirmDelete);
    body.replaceChildren(
      title(t("계정")),
      h("p", { class: "o-p o-small" }, t("어느 기기에서든 로그인하면 이 계정의 기록과 이름을 씁니다.")),
      h("h3", { class: "pname-label" }, t("로그인 방법")),
      h("ul", { class: "account-logins" }, ...rows),
      addBtns.length ? h("h3", { class: "pname-label" }, t("로그인 방법 더하기")) : null,
      addBtns.length ? h("div", { class: "plogin-btns" }, ...addBtns) : null,
      say,
      out,
      del,
      h("a", { class: "o-link o-small account-privacy", href: PRIVACY_URL }, t("개인정보 처리방침")),
    );
    out.focus();
  }

  draw();
}
