// 계정 화면(디자인 '로그인 칸 ③ 따로 화면', 규약 8장):
//   #/account          손님: 구름 + '기록을 다른 기기에서도' + 켜진 방법 단추(구글 → 카카오 → 이메일)
//                      로그인함: 나 카드(이름 바꾸기), 로그인 방법(연결됨·떼기 / 더하기), 로그아웃, 계정 지우기
//   #/account/signup   가입 화면(처음 로그인, 8.3b): 이름·그림·처리방침 동의·만 14세 이상, '손님으로 놀기'
//   #/account/email    이메일(8.8): 로그인 | 가입 탭, 6자리 메일 확인, 비밀번호 찾기
//   #/account/email/link  로그인한 채 이메일 더하기
// 비밀번호는 이 화면에서 열쇠로 바꿔 보낸다(account.js emailKey). 열쇠는 이 화면의 변수에만 둔다.

import { h, setTitle } from "../ui/dom.js";
import { t } from "../i18n.js";
import { toast } from "../ui/toast.js";
import { topBar, dateText } from "./common.js";
import { avatar, fillFace } from "./avatar.js";
import { facePicker } from "./face-picker.js";
import { profileChip } from "./profile.js";
import { myName, myFace, cleanName, NAME_MAX, meWho } from "./identity.js";
import { errorText } from "./messages.js";
import {
  PROVIDERS,
  signedIn,
  lastAccount,
  loginMethods,
  knownMethods,
  startLogin,
  accountInfo,
  unlinkLogin,
  signOut,
  deleteAccount,
  becomeGuest,
  onAccount,
  signupTicket,
  dropSignup,
  signup,
  emailOk,
  normEmail,
  emailKey,
  emailSignup,
  emailVerify,
  emailLogin,
  emailReset,
  emailResetConfirm,
  PASSWORD_MIN,
} from "./account.js";
import { PRIVACY_URL, providerName, signedWithText, loginErrorText, codeOf, signInButton, providerMark, markSrc, askDialog, settleLogin } from "./account-view.js";
import { EMAIL_CODE_MS } from "./protocol.js";

/** 확인 코드를 쓸 수 있는 분 */
const CODE_MIN = Math.round(EMAIL_CODE_MS / 60_000);

const MARK = "\u0001";
let seq = 0;

/** '{p}에 동의합니다' 꼴 틀의 MARK 자리에 처리방침 링크를 넣는다 */
function withLink(text, link) {
  const [pre, post = ""] = text.split(MARK);
  return [pre, link, post];
}
const privacyLink = (text = t("개인정보 처리방침")) => h("a", { href: PRIVACY_URL, target: "_blank", rel: "noopener" }, text);

/** 단추 아래 빨간 한 줄(디자인 ⑧). action {label, run} 을 주면 줄 끝에 작은 단추 */
function errLine() {
  const el = h("p", { class: "acct-err", role: "alert", hidden: true });
  return {
    el,
    show(text, action = null) {
      el.replaceChildren(text);
      if (action) {
        const b = h("button", { type: "button", class: "acct-link acct-err-act" }, action.label);
        b.addEventListener("click", action.run);
        el.append(" ", b);
      }
      el.hidden = false;
    },
    clear() {
      el.hidden = true;
      el.replaceChildren();
    },
  };
}

/**
 * 처리방침이 바뀌었으면(old_policy) 화면이 옛 판이다: 새로 고쳐 새 판을 받고 다시 동의한다
 * (가입 표는 sessionStorage 에 남아 새로 고쳐도 가입 화면으로 온다)
 */
const reloadAction = () => ({ label: t("새로고침"), run: () => location.reload() });

/** 이메일 화면에서 쓰는 오류 문장(같은 코드라도 이메일 맥락에 맞게) */
function emailErrorText(code) {
  switch (code) {
    case "bad_login":
      return t("이메일이나 비밀번호가 맞지 않습니다.");
    case "too_fast":
      return t("너무 여러 번 시도했습니다. 잠시 뒤 다시 해 주십시오.");
    case "busy":
      return t("오늘 보낼 수 있는 메일이 다 찼습니다. 내일 다시 해 주십시오.");
    default:
      return loginErrorText(code);
  }
}

/** 동의 두 칸(가입 화면·이메일 가입): 처리방침 동의, 만 14세 이상 */
function consentBoxes(onChange) {
  const id = `consent-${++seq}`;
  const agree = h("input", { type: "checkbox", id: `${id}-agree` });
  const age = h("input", { type: "checkbox", id: `${id}-age` });
  for (const b of [agree, age]) b.addEventListener("change", onChange);
  const el = h(
    "div",
    { class: "acct-consent" },
    h("label", { class: "acct-check", for: `${id}-agree` }, agree, h("span", {}, ...withLink(t("{p}에 동의합니다", { p: MARK }), privacyLink()))),
    h("label", { class: "acct-check", for: `${id}-age` }, age, h("span", {}, t("만 14세 이상입니다"))),
  );
  return {
    el,
    get ok() {
      return agree.checked && age.checked;
    },
    uncheckAgree() {
      agree.checked = false;
      onChange();
    },
    lock(on) {
      agree.disabled = age.disabled = on;
    },
  };
}

/** 칸 이름 + 입력 */
function field(label, input, extra = null, { hideLabel = false } = {}) {
  const id = input.id || `f-${++seq}`;
  input.id = id;
  return h("div", { class: "acct-field" }, h("label", { class: hideLabel ? "visually-hidden" : "acct-label", for: id }, label), input, extra);
}

/** 비밀번호 칸('보기'로 글자를 보인다) */
function passwordInput(autocomplete) {
  const input = h("input", { type: "password", class: "text-input", autocomplete, minlength: PASSWORD_MIN, spellcheck: "false" });
  const see = h("button", { type: "button", class: "acct-see", "aria-pressed": "false" }, t("보기"));
  see.addEventListener("click", () => {
    const on = input.type === "password";
    input.type = on ? "text" : "password";
    see.setAttribute("aria-pressed", String(on));
  });
  return { input, el: h("div", { class: "acct-pw" }, input, see), see };
}

/** 비밀번호 칸 묶음: 이름 + 칸('보기') + 작은 도움말 */
function pwField(label, pw, hint = null) {
  pw.input.id = `pw-${++seq}`;
  return h("div", { class: "acct-field" }, h("label", { class: "acct-label", for: pw.input.id }, label), pw.el, hint ? h("small", { class: "acct-hint" }, hint) : null);
}

/** 6자리 코드 칸(디자인 ⑦): 진짜 입력은 하나(붙여 넣기·자동 채우기), 보이는 칸은 여섯 */
function codeInput() {
  const input = h("input", {
    type: "text",
    class: "code6-input",
    inputmode: "numeric",
    autocomplete: "one-time-code",
    maxlength: 6,
    pattern: "[0-9]{6}",
    "aria-label": t("확인 코드 6자리"),
  });
  const boxes = Array.from({ length: 6 }, () => h("span", { class: "code6-box" }));
  const el = h("div", { class: "code6" }, h("div", { class: "code6-boxes", "aria-hidden": "true" }, boxes), input);
  const draw = () => {
    const v = input.value;
    const focused = document.activeElement === input;
    boxes.forEach((b, i) => {
      b.textContent = v[i] || "";
      b.classList.toggle("on", focused && i === Math.min(v.length, 5));
    });
  };
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D+/g, "").slice(0, 6);
    draw();
  });
  input.addEventListener("focus", draw);
  input.addEventListener("blur", draw);
  draw();
  return {
    el,
    input,
    get value() {
      return input.value;
    },
    clear() {
      input.value = "";
      draw();
    },
  };
}

/** 칸들을 잠근다(열쇠를 만드는 1초 동안, 보내는 동안) */
const lockAll = (root, on) => {
  for (const x of root.querySelectorAll("input, button, select, textarea")) x.disabled = on;
};

// ─────────────────────────────────────────────

export function accountView(main, route) {
  if (route.kind === "account-signup") return signupView(main);
  if (route.kind === "account-email") return emailView(main, { link: Boolean(route.link) });
  return accountHome(main);
}

/** #/account */
function accountHome(main) {
  setTitle(t("계정"));
  const ctl = new AbortController();
  const page = h("div", { class: "online acct" });
  main.append(page);
  let chip = null;
  let alive = true;

  async function draw() {
    if (chip) chip.destroy();
    chip = null;
    const bar = topBar({ href: "#/play", label: t("온라인") }, h("span", { class: "acct-top-label" }, t("계정")));
    if (!signedIn()) return guest(bar);
    page.replaceChildren(bar.el, h("p", { class: "o-p o-small" }, t("계정 불러오는 중…")));
    let acc = lastAccount();
    let list = [];
    const err = errLine();
    try {
      const [r, l] = await Promise.all([accountInfo(), loginMethods().catch(() => [])]);
      acc = r.account;
      list = l;
    } catch (e) {
      if (!alive) return;
      if (!signedIn()) return; // 끝난 토큰: onAccount 가 손님 화면으로 다시 그린다
      err.show(loginErrorText(codeOf(e)));
    }
    if (!alive) return;
    signedInView(bar, acc, list, err);
  }

  async function guest(bar) {
    const btns = h("div", { class: "sso-list" });
    const err = errLine();
    page.replaceChildren(
      bar.el,
      h(
        "div",
        { class: "acct-guest" },
        h("img", { class: "acct-cloud", src: "art/cloud.svg", alt: "" }),
        h("h1", { class: "o-h1 acct-h1" }, t("기록을 다른 기기에서도")),
        h("p", { class: "o-p" }, t("로그인하면 이름·그림·기록·순위가 계정에 저장되어 휴대폰에서도 컴퓨터에서도 이어집니다. 로그인하지 않아도 모두 할 수 있습니다.")),
        btns,
        h("div", { class: "acct-soon" }, h("span", { class: "acct-soon-pill" }, t("Apple 준비 중")), h("span", { class: "acct-soon-pill" }, t("Steam 준비 중"))),
        err.el,
        h("p", { class: "o-p o-small acct-foot" }, t("처음 로그인하면 가입 화면을 한 번 거칩니다."), h("br"), privacyLink()),
      ),
    );
    let list = [];
    try {
      list = await loginMethods({ signal: ctl.signal });
    } catch (e) {
      if (!alive) return;
      err.show(loginErrorText(codeOf(e)));
    }
    if (!alive) return;
    if (!list.length) {
      btns.replaceChildren(h("p", { class: "o-p" }, t("지금은 로그인할 수 없습니다.")));
      return;
    }
    btns.replaceChildren(
      ...list.map((p) =>
        signInButton(p, async (prov, b) => {
          if (prov === "email") {
            location.hash = "#/account/email";
            return;
          }
          err.clear();
          lockAll(btns, true);
          b.classList.add("busy");
          try {
            await startLogin(prov);
          } catch (e) {
            err.show(loginErrorText(codeOf(e)));
            lockAll(btns, false);
            b.classList.remove("busy");
          }
        }),
      ),
    );
  }

  function signedInView(bar, acc, list, err) {
    // 나 카드: 그림 46 + 이름 + 'n월 n일 가입' + 이름 바꾸기(프로필 칸을 연다)
    const face = avatar(meWho(), { size: 46, cls: "acct-me-av" });
    const nameEl = h("b", { class: "acct-me-name" }, myName());
    chip = profileChip({
      align: "end",
      button: t("이름 바꾸기"),
      onChange: () => {
        nameEl.textContent = myName();
        fillFace(face, meWho());
      },
    });
    const made = acc && acc.made ? t("{date} 가입", { date: dateText(acc.made) }) : "";
    const devices = acc && Number.isInteger(acc.devices) && acc.devices > 0 ? t("기기 {n}대", { n: acc.devices }) : "";
    const me = h("section", { class: "acct-me" }, face, h("div", { class: "acct-me-text" }, nameEl, h("small", {}, [made, devices].filter(Boolean).join(" · "))), chip.el);

    const logins = acc && Array.isArray(acc.logins) ? acc.logins : [];
    const linked = new Map();
    for (const l of logins) if (!linked.has(l.provider)) linked.set(l.provider, l);
    const only = linked.size <= 1;
    // 그리는 방법: 붙은 것과 켜진 것(구글 → 카카오 → 이메일 → 시험)
    const shown = PROVIDERS.filter((p) => linked.has(p) || list.includes(p));
    const rows = shown.map((p) => {
      const l = linked.get(p);
      let right;
      if (l) {
        const off = h("button", { type: "button", class: "btn btn-sm acct-off", disabled: only }, t("떼기"));
        off.addEventListener("click", async () => {
          off.disabled = true;
          err.clear();
          try {
            await unlinkLogin(p);
            toast(t("{p} 로그인 뗌", { p: providerName(p) }));
            draw();
          } catch (e) {
            err.show(loginErrorText(codeOf(e)));
            off.disabled = false;
          }
        });
        right = h("span", { class: "acct-row-right" }, h("span", { class: "acct-on" }, t("연결됨")), off);
      } else {
        const add = h("button", { type: "button", class: "acct-add" }, t("더하기"));
        add.addEventListener("click", async () => {
          if (p === "email") {
            location.hash = "#/account/email/link";
            return;
          }
          add.disabled = true;
          err.clear();
          try {
            await startLogin(p, { link: true });
          } catch (e) {
            err.show(loginErrorText(codeOf(e)));
            add.disabled = false;
          }
        });
        right = h("span", { class: "acct-row-right" }, add);
      }
      return h(
        "li",
        { class: "acct-row" },
        providerMark(p),
        h("span", { class: "acct-row-text" }, h("b", {}, providerName(p)), h("small", {}, l ? t("{date}에 붙임", { date: dateText(l.made) }) : t("붙이지 않음"))),
        right,
      );
    });

    const out = h("button", { type: "button", class: "btn btn-big acct-out" }, t("로그아웃"));
    out.addEventListener("click", async () => {
      const a = await askDialog({
        title: t("로그아웃하시겠습니까?"),
        text: t("이 기기에서만 로그아웃됩니다. 다른 기기는 그대로입니다."),
        check: { label: t("새 손님으로 시작"), note: t("여럿이 쓰는 기기라면 권합니다"), on: true },
        yes: t("로그아웃"),
      });
      if (!a.ok) return;
      await signOut();
      if (a.checked) becomeGuest();
      toast(t("로그아웃됨"), a.checked ? t("새 손님으로 시작합니다.") : "");
    });
    const del = h("button", { type: "button", class: "btn btn-big btn-danger-soft" }, t("계정 지우기"));
    del.addEventListener("click", async () => {
      const a = await askDialog({
        title: t("계정을 지우시겠습니까?"),
        text: t("계정과 로그인 방법이 모두 지워지고, 모든 기기에서 로그아웃됩니다. 지운 계정은 되살릴 수 없습니다."),
        check: { label: t("새 손님으로 시작"), note: t("여럿이 쓰는 기기라면 권합니다"), on: true },
        yes: t("@delete:지우기"),
        danger: true,
      });
      if (!a.ok) return;
      err.clear();
      try {
        await deleteAccount();
      } catch (e) {
        if (signedIn()) err.show(loginErrorText(codeOf(e)));
        return;
      }
      if (a.checked) becomeGuest();
      toast(t("계정 지워짐"), a.checked ? t("새 손님으로 시작합니다.") : "");
    });

    page.replaceChildren(
      bar.el,
      h("h1", { class: "o-h1" }, t("계정")),
      me,
      h("h2", { class: "acct-h2" }, t("로그인 방법")),
      h("ul", { class: "acct-rows" }, rows),
      only ? h("p", { class: "o-p o-small" }, t("로그인 방법이 하나뿐이면 뗄 수 없습니다.")) : null,
      err.el,
      h("div", { class: "acct-actions" }, out, del),
      h("p", { class: "o-p o-small acct-foot" }, privacyLink()),
    );
  }

  // 로그인·로그아웃·새 손님이면 다시 그린다(계정 화면에 머문 채)
  const off = onAccount((what) => {
    if (what === "login" || what === "logout" || what === "guest") draw();
  });
  draw();
  return {
    destroy() {
      alive = false;
      ctl.abort();
      off();
      if (chip) chip.destroy();
    },
  };
}

/** #/account/signup: 가입 화면(규약 8.3b) */
function signupView(main) {
  setTitle(t("가입"));
  const s = signupTicket();
  const leave = h("a", { class: "o-back", href: "#/account" }, h("span", { class: "o-arrow", "aria-hidden": "true" }, "←"), " ", t("그만두기"));
  leave.addEventListener("click", () => dropSignup());
  const bar = h("div", { class: "o-top" }, leave, h("span", { class: "o-top-right" }, h("span", { class: "acct-top-label" }, t("가입"))));
  const page = h("div", { class: "online acct" }, bar);
  main.append(page);
  if (!s) {
    page.append(
      h("h1", { class: "o-h1" }, t("계정 만들기")),
      h("p", { class: "o-p" }, t("가입 시간이 지났습니다. 처음부터 다시 로그인해 주십시오.")),
      h("a", { class: "btn btn-ink btn-big", href: "#/account" }, t("계정")),
    );
    return {};
  }

  const input = h("input", { type: "text", class: "text-input", maxlength: NAME_MAX * 2, autocomplete: "nickname", spellcheck: "false", value: (s.profile && cleanName(s.profile.name)) || myName() });
  const typed = () => ({ kind: "human", name: cleanName(input.value) || myName() });
  const picker = facePicker({ value: (s.profile && s.profile.face) || myFace(), autoWho: typed });
  input.addEventListener("input", () => picker.refreshAuto());
  const go = h("button", { type: "submit", class: "btn btn-ink btn-big", disabled: true }, t("가입"));
  const need = h("p", { class: "o-p o-small acct-need" }, t("두 칸을 모두 골라야 가입할 수 있습니다."));
  const consent = consentBoxes(() => {
    go.disabled = !consent.ok;
    need.hidden = consent.ok;
  });
  const err = errLine();
  const form = h(
    "form",
    { class: "acct-form", novalidate: true },
    h("h1", { class: "o-h1" }, t("계정 만들기")),
    h("p", { class: "acct-with" }, markSrc(s.provider) ? providerMark(s.provider) : null, signedWithText(s.provider)),
    field(t("이름"), input),
    h("div", { class: "acct-field" }, h("span", { class: "acct-label" }, t("그림")), h("div", { class: "acct-faces" }, picker.el)),
    consent.el,
    go,
    need,
    err.el,
  );
  const guestBtn = h("button", { type: "button", class: "btn btn-big" }, t("손님으로 놀기"));
  guestBtn.addEventListener("click", () => {
    dropSignup();
    location.hash = "#/play";
  });
  page.append(form, h("div", { class: "acct-box" }, h("p", { class: "o-p o-small" }, t("만 14세 미만이면 가입하지 않고 손님으로 놀 수 있습니다.")), guestBtn));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.clear();
    const name = cleanName(input.value);
    if (!name) {
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    if (!consent.ok) return;
    lockAll(form, true);
    try {
      const res = await signup({ name, face: picker.value });
      if (await settleLogin(res)) location.hash = "#/account";
      else lockAll(form, false);
    } catch (e2) {
      const code = codeOf(e2);
      lockAll(form, false);
      go.disabled = !consent.ok;
      if (code === "old_policy") {
        consent.uncheckAgree();
        err.show(loginErrorText(code), reloadAction());
        return;
      }
      if (code === "bad_login") {
        dropSignup();
        err.show(t("가입 시간이 지났습니다. 처음부터 다시 로그인해 주십시오."));
        lockAll(form, true);
        return;
      }
      err.show(loginErrorText(code));
    }
  });
  input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
  return {};
}

/** #/account/email(·/link): 이메일 로그인·가입·메일 확인·비밀번호 찾기(규약 8.8) */
function emailView(main, { link }) {
  setTitle(t("이메일"));
  const back = topBar({ href: "#/account", label: t("계정") }, h("span", { class: "acct-top-label" }, t("이메일")));
  const page = h("div", { class: "online acct" }, back.el);
  main.append(page);
  if (link && !signedIn()) {
    page.append(h("p", { class: "o-p" }, t("로그인한 뒤에 이메일을 더할 수 있습니다.")), h("a", { class: "btn btn-ink btn-big", href: "#/account" }, t("계정")));
    return {};
  }
  const body = h("div", { class: "acct-email" });
  page.append(body);
  let alive = true;
  // 확인 코드를 기다리는 가입(코드 다시 보내기에 쓴다). 열쇠는 이 변수에만 둔다
  let waiting = null;

  function tabs(on) {
    if (link) return null;
    const mk = (mode, label) => {
      const b = h("button", { type: "button", role: "tab", class: "acct-tab", "aria-selected": String(on === mode) }, label);
      b.addEventListener("click", () => (mode === "login" ? loginStep() : signupStep()));
      return b;
    };
    return h("div", { class: "acct-tabs", role: "tablist", "aria-label": t("이메일") }, mk("login", t("로그인")), mk("signup", t("가입")));
  }

  function loginStep(prefill = "") {
    const email = h("input", { type: "email", class: "text-input", autocomplete: "email", spellcheck: "false", value: prefill });
    const pw = passwordInput("current-password");
    const go = h("button", { type: "submit", class: "btn btn-ink btn-big" }, t("로그인"));
    const err = errLine();
    const forgot = h("button", { type: "button", class: "acct-link" }, t("비밀번호 찾기"));
    forgot.addEventListener("click", () => resetStep(email.value));
    const form = h("form", { class: "acct-form", novalidate: true }, field(t("이메일"), email), pwField(t("비밀번호"), pw), go, err.el, forgot);
    body.replaceChildren(h("h1", { class: "o-h1" }, t("이메일로 로그인")), tabs("login"), form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.clear();
      if (!emailOk(email.value)) return err.show(errorText("bad_email"));
      if (!pw.input.value) return pw.input.focus();
      lockAll(form, true);
      go.textContent = t("확인하는 중");
      try {
        const key = await emailKey(email.value, pw.input.value);
        const res = await emailLogin(email.value, key);
        if (!alive) return;
        if (await settleLogin(res)) location.hash = "#/account";
        else {
          lockAll(form, false);
          go.textContent = t("로그인");
        }
      } catch (e2) {
        if (!alive) return;
        lockAll(form, false);
        go.textContent = t("로그인");
        err.show(emailErrorText(codeOf(e2)));
      }
    });
    email.focus();
  }

  function signupStep() {
    const email = h("input", { type: "email", class: "text-input", autocomplete: "email", spellcheck: "false" });
    const pw = passwordInput("new-password");
    const pw2 = h("input", { type: "password", class: "text-input", autocomplete: "new-password", spellcheck: "false" });
    const name = h("input", { type: "text", class: "text-input", maxlength: NAME_MAX * 2, autocomplete: "nickname", spellcheck: "false", value: myName() });
    const go = h("button", { type: "submit", class: "btn btn-ink btn-big" }, link ? t("더하기") : t("가입"));
    const err = errLine();
    const consent = link ? null : consentBoxes(() => {});
    const form = h(
      "form",
      { class: "acct-form", novalidate: true },
      field(t("이메일"), email),
      pwField(t("비밀번호"), pw, t("{n}자 이상", { n: PASSWORD_MIN })),
      field(t("비밀번호 확인"), pw2),
      link ? null : field(t("이름"), name),
      consent ? consent.el : null,
      go,
      err.el,
    );
    body.replaceChildren(h("h1", { class: "o-h1" }, link ? t("이메일 더하기") : t("이메일로 가입")), tabs("signup"), form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.clear();
      if (!emailOk(email.value)) return err.show(errorText("bad_email"));
      if (pw.input.value.length < PASSWORD_MIN) return err.show(t("비밀번호는 {n}자 이상이어야 합니다.", { n: PASSWORD_MIN }));
      if (pw.input.value !== pw2.value) return err.show(t("비밀번호 확인이 맞지 않습니다."));
      if (!link && !cleanName(name.value)) return err.show(errorText("bad_name"));
      if (consent && !consent.ok) return err.show(t("두 칸을 모두 골라야 가입할 수 있습니다."));
      lockAll(form, true);
      go.textContent = t("확인하는 중");
      try {
        const key = await emailKey(email.value, pw.input.value);
        const params = { email: normEmail(email.value), key, name: link ? null : cleanName(name.value), face: myFace(), link };
        await emailSignup(params);
        if (!alive) return;
        waiting = params;
        verifyStep();
      } catch (e2) {
        if (!alive) return;
        lockAll(form, false);
        go.textContent = link ? t("더하기") : t("가입");
        const code = codeOf(e2);
        if (code === "old_policy") {
          consent?.uncheckAgree();
          err.show(emailErrorText(code), reloadAction());
        } else err.show(emailErrorText(code));
      }
    });
    email.focus();
  }

  function verifyStep() {
    const code = codeInput();
    const go = h("button", { type: "submit", class: "btn btn-ink btn-big" }, t("확인"));
    const again = h("button", { type: "button", class: "acct-link" }, t("코드 다시 보내기"));
    const err = errLine();
    const sent = h("p", { class: "o-p o-small", role: "status" });
    again.addEventListener("click", async () => {
      err.clear();
      again.disabled = true;
      try {
        await emailSignup(waiting);
        sent.textContent = t("코드를 다시 보냈습니다.");
        code.clear();
        code.input.focus();
      } catch (e) {
        err.show(emailErrorText(codeOf(e)));
      } finally {
        again.disabled = false;
      }
    });
    const form = h(
      "form",
      { class: "acct-form", novalidate: true },
      h("p", { class: "o-p" }, t("{email} 주소로 6자리 코드를 보냈습니다. {n}분 안에 넣어 주십시오.", { email: waiting.email, n: CODE_MIN })),
      code.el,
      go,
      err.el,
      again,
      sent,
    );
    body.replaceChildren(h("h1", { class: "o-h1" }, t("메일 확인")), form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.clear();
      if (code.value.length !== 6) return code.input.focus();
      lockAll(form, true);
      try {
        const res = await emailVerify(waiting.email, code.value, { link: waiting.link });
        if (!alive) return;
        waiting = null;
        if (await settleLogin(res)) location.hash = "#/account";
        else lockAll(form, false);
      } catch (e2) {
        if (!alive) return;
        lockAll(form, false);
        err.show(emailErrorText(codeOf(e2)));
        code.clear();
        code.input.focus();
      }
    });
    code.input.focus();
  }

  function resetStep(prefill = "") {
    const email = h("input", { type: "email", class: "text-input", autocomplete: "email", spellcheck: "false", value: prefill });
    const send = h("button", { type: "submit", class: "btn btn-big" }, t("코드 보내기"));
    const err1 = errLine();
    const step1 = h("form", { class: "acct-form acct-step", novalidate: true }, h("p", { class: "acct-step-label" }, t("1. 메일")), field(t("이메일"), email, null, { hideLabel: true }), send, err1.el);
    const code = codeInput();
    const pw = passwordInput("new-password");
    const pw2 = h("input", { type: "password", class: "text-input", autocomplete: "new-password", spellcheck: "false" });
    const change = h("button", { type: "submit", class: "btn btn-ink btn-big" }, t("비밀번호 바꾸기"));
    const err2 = errLine();
    const sent = h("p", { class: "o-p o-small", role: "status" });
    const step2 = h(
      "form",
      { class: "acct-form acct-step", novalidate: true, hidden: true },
      h("p", { class: "acct-step-label" }, t("2. 코드와 새 비밀번호")),
      sent,
      h("div", { class: "acct-field" }, h("span", { class: "acct-label" }, t("확인 코드")), code.el),
      pwField(t("새 비밀번호"), pw, t("{n}자 이상", { n: PASSWORD_MIN })),
      field(t("새 비밀번호 확인"), pw2),
      change,
      err2.el,
      h("p", { class: "o-p o-small" }, t("바꾸면 다른 기기에서는 모두 로그아웃됩니다.")),
    );
    body.replaceChildren(h("h1", { class: "o-h1" }, t("비밀번호 찾기")), step1, step2);
    let mail = "";
    step1.addEventListener("submit", async (e) => {
      e.preventDefault();
      err1.clear();
      if (!emailOk(email.value)) return err1.show(errorText("bad_email"));
      lockAll(step1, true);
      try {
        mail = normEmail(email.value);
        await emailReset(mail);
        if (!alive) return;
        sent.textContent = t("{email} 주소로 6자리 코드를 보냈습니다. {n}분 안에 넣어 주십시오.", { email: mail, n: CODE_MIN });
        step2.hidden = false;
        lockAll(step1, false);
        code.input.focus();
      } catch (e2) {
        if (!alive) return;
        lockAll(step1, false);
        err1.show(emailErrorText(codeOf(e2)));
      }
    });
    step2.addEventListener("submit", async (e) => {
      e.preventDefault();
      err2.clear();
      if (code.value.length !== 6) return code.input.focus();
      if (pw.input.value.length < PASSWORD_MIN) return err2.show(t("비밀번호는 {n}자 이상이어야 합니다.", { n: PASSWORD_MIN }));
      if (pw.input.value !== pw2.value) return err2.show(t("비밀번호 확인이 맞지 않습니다."));
      lockAll(step2, true);
      change.textContent = t("확인하는 중");
      try {
        const key = await emailKey(mail, pw.input.value);
        const res = await emailResetConfirm(mail, code.value, key);
        if (!alive) return;
        if (await settleLogin(res)) {
          toast(t("비밀번호 바뀜"), t("다른 기기에서는 모두 로그아웃됐습니다."));
          location.hash = "#/account";
        } else {
          lockAll(step2, false);
          change.textContent = t("비밀번호 바꾸기");
        }
      } catch (e2) {
        if (!alive) return;
        lockAll(step2, false);
        change.textContent = t("비밀번호 바꾸기");
        err2.show(emailErrorText(codeOf(e2)));
      }
    });
    email.focus();
  }

  /** 이메일이 켜지지 않은 서버(라이브 지금)면 칸 대신 안내 */
  function closed() {
    body.replaceChildren(h("h1", { class: "o-h1" }, t("이메일")), h("p", { class: "o-p" }, t("지금은 이메일로 로그인할 수 없습니다.")), h("a", { class: "btn btn-big", href: "#/account" }, t("계정")));
  }
  const known = knownMethods();
  if (known && !known.includes("email")) closed();
  else {
    if (link) signupStep();
    else loginStep();
    if (!known)
      loginMethods()
        .then((list) => alive && !waiting && !list.includes("email") && closed())
        .catch(() => {});
  }
  return {
    destroy() {
      alive = false;
      waiting = null;
    },
  };
}
