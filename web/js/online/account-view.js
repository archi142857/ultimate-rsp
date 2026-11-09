// 로그인 화면의 공용 조각(디자인 '로그인 칸 ③ 따로 화면', 사용자 11-09):
// 프로필 칸 머리의 알약('계정 · 로그인 ›' / '✓ 계정 ›'), 로그인 단추(구글 → 카카오 → 이메일), 묻기 창,
// 로그인 결과 마무리(다른 기기의 계정이면 바꾸기 전에 묻는다), 로그인에서 돌아왔을 때의 알림.
// 계정 화면·가입 화면·이메일 화면은 account-page.js.

import { h } from "../ui/dom.js";
import { t } from "../i18n.js";
import { toast } from "../ui/toast.js";
import { OnlineError } from "./net.js";
import { errorText } from "./messages.js";
import { signedIn, loginMethods, knownMethods, takeLoginReturn, finishLogin, changesPid, useLogin, dropLogin, onAccount } from "./account.js";

export const PRIVACY_URL = "privacy.html";

/** 공식 로고 파일(구글 브랜드 가이드라인 묶음의 G, 카카오 리소스의 말풍선 심볼). web/icons/brand/ 에 넣으면 여기에 적는다 */
// 공식 그림(사용자 11-10 받음: 구글 signin-assets 의 G 만 있는 단추, 카카오 리소스의 큰 단추에서 단추 틀·글만 뺐다. 모양·색 그대로, 카카오 심볼은 규정 #000000)
const MARKS = { google: "icons/brand/google-g.svg", kakao: "icons/brand/kakao-symbol.svg" };

/** 방법 이름 */
export function providerName(p) {
  switch (p) {
    case "google":
      return t("구글");
    case "kakao":
      return t("카카오");
    case "email":
      return t("이메일");
    case "test":
      return t("시험");
    default:
      return p;
  }
}

/** '구글로 로그인함' 같은 작은 알약 글(가입 화면) */
export function signedWithText(p) {
  switch (p) {
    case "google":
      return t("구글로 로그인함");
    case "kakao":
      return t("카카오로 로그인함");
    case "email":
      return t("이메일로 가입함");
    default:
      return t("시험 로그인함");
  }
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

export const codeOf = (e) => (e instanceof OnlineError && e.code ? e.code : "server");

/** 방법 그림 파일(봉투, 구글 G, 카카오 말풍선). 공식 그림을 아직 받지 못했으면 null */
export function markSrc(p) {
  return p === "email" ? "icons/envelope.svg" : (MARKS[p] ?? null);
}

/**
 * 줄 머리 방법 그림(계정 화면 줄 22, 가입 화면 알약 18). 그림이 없으면 빈 칸(줄 글자는 그대로 맞춘다).
 * 카카오는 노란 바탕에 말풍선(카카오 규정)
 */
export function providerMark(p) {
  const src = markSrc(p);
  return h("span", { class: `acct-row-mark mark-${p}`, "aria-hidden": "true" }, src ? h("img", { src, alt: "" }) : null);
}

/**
 * 로그인 단추(디자인 ②: 셋 다 높이 46). 구글·카카오는 각 회사 규정 색과 글('Google 계정으로 로그인', '카카오 로그인'),
 * 이메일은 우리 단추에 봉투. 시험(로컬)은 우리 단추
 */
export function signInButton(p, onClick) {
  const text = { google: t("Google 계정으로 로그인"), kakao: t("카카오 로그인"), email: t("이메일로 로그인") }[p] ?? t("시험 로그인");
  const src = markSrc(p);
  // 구글 G 20(구글 단추 규정), 카카오 심볼 13(높이 46 공식 단추와 같게), 봉투 22
  const size = { google: 20, kakao: 13, email: 22 }[p] ?? 20;
  const mark = src ? h("img", { class: "sso-mark", src, alt: "", width: size, height: size }) : null;
  const b = h("button", { type: "button", class: `sso sso-${p}` }, mark, h("span", { class: "sso-text" }, text));
  b.addEventListener("click", () => onClick(p, b));
  return b;
}

/**
 * 프로필 칸 머리 오른쪽 알약(디자인 ①⑨): 손님이면 '계정 · 로그인 ›', 로그인했으면 '✓ 계정 ›'. 누르면 #/account.
 * 손님인데 켜진 방법이 없으면(라이브 지금) 숨긴다. onGo(): 누를 때(프로필 칸을 닫는다)
 */
export function accountPill({ onGo = null } = {}) {
  const a = h("a", { class: "acct-pill", href: "#/account", hidden: true });
  function draw() {
    if (signedIn()) {
      a.className = "acct-pill on";
      a.replaceChildren(h("span", { class: "acct-pill-check", "aria-hidden": "true" }, "✓"), h("span", {}, t("계정")), h("span", { class: "acct-pill-go", "aria-hidden": "true" }, "›"));
      a.hidden = false;
      return;
    }
    const list = knownMethods();
    if (list === null) loginMethods().then(draw, () => {});
    a.className = "acct-pill";
    a.replaceChildren(h("img", { class: "acct-pill-cloud", src: "art/cloud.svg", alt: "" }), h("span", {}, t("계정 · 로그인")), h("span", { class: "acct-pill-go", "aria-hidden": "true" }, "›"));
    a.hidden = !(list && list.length);
  }
  a.addEventListener("click", () => {
    if (onGo) onGo();
  });
  const off = onAccount(draw);
  draw();
  return { el: a, draw, destroy: off };
}

let askSeq = 0;
/**
 * 묻기 창(디자인 ⑪: 가운데 대화 상자, 뒤는 scrim). check: { label, note, on } 이면 확인 칸 하나.
 * 답: { ok, checked }. Esc·바깥·취소는 ok:false
 */
export function askDialog({ title, text, check = null, yes, no = t("취소"), danger = false }) {
  return new Promise((resolve) => {
    const id = `ask-${++askSeq}`;
    const box = check ? h("input", { type: "checkbox", class: "ask-box", id: `${id}-check` }) : null;
    if (box) box.checked = Boolean(check.on);
    const noBtn = h("button", { type: "button", class: "btn btn-big" }, no);
    const yesBtn = h("button", { type: "button", class: "btn btn-big " + (danger ? "btn-danger" : "btn-ink") }, yes);
    const d = h(
      "dialog",
      { class: "ask", "aria-labelledby": `${id}-title`, "aria-describedby": `${id}-text` },
      h("h2", { class: "ask-title", id: `${id}-title` }, title),
      h("p", { class: "o-p ask-text", id: `${id}-text` }, text),
      check
        ? h("label", { class: "ask-check", for: `${id}-check` }, box, h("span", { class: "ask-check-text" }, h("span", {}, check.label), check.note ? h("small", {}, check.note) : null))
        : null,
      h("div", { class: "ask-act" }, noBtn, yesBtn),
    );
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try {
        d.close();
      } catch {
        /* 이미 닫힘 */
      }
      d.remove();
      resolve({ ok, checked: box ? box.checked : false });
    };
    noBtn.addEventListener("click", () => finish(false));
    yesBtn.addEventListener("click", () => finish(true));
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      finish(false);
    });
    // 바깥(뒤판)을 누르면 취소
    d.addEventListener("click", (e) => {
      if (e.target === d) finish(false);
    });
    document.body.append(d);
    d.showModal();
    (danger ? noBtn : yesBtn).focus();
  });
}

/**
 * 로그인 결과({ result } · { signup })를 마무리한다. 가입 표면 가입 화면으로.
 * 다른 기기에서 만든 계정이면(pid 가 바뀐다) 바꾸기 전에 묻고(디자인 ④), 그만두면 받은 토큰을 끝낸다.
 * 썼으면 true
 */
export async function settleLogin(res) {
  if (!res) return false;
  if (res.signup) {
    location.hash = "#/account/signup";
    return false;
  }
  const r = res.result;
  if (!res.link && changesPid(r)) {
    const { ok } = await askDialog({
      title: t("이 계정으로 바꾸시겠습니까?"),
      text: t("다른 기기에서 만든 계정입니다. 바꾸면 그 계정의 이름과 기록이 보이고, 이 기기에서 손님으로 쌓은 기록은 따로 남습니다."),
      yes: t("@switch:바꾸기"),
      no: t("취소"),
    });
    if (!ok) {
      await dropLogin(r);
      toast(t("로그인 취소됨"), t("이 기기는 손님 그대로입니다."));
      return false;
    }
  }
  const out = useLogin(r);
  if (out.linked) toast(t("{p} 연결됨", { p: providerName(res.provider) }));
  else if (out.switched) toast(t("로그인됨"), t("계정의 이름과 기록으로 바꿨습니다."));
  else if (out.fresh) toast(t("로그인됨"), t("이제 다른 기기에서도 이 기록과 이름을 씁니다."));
  else toast(t("로그인됨"));
  return true;
}

/** 라우터가 그리기 전에 부른다: 주소에서 login·login_error 를 지우고, 로그인을 마치고, 결과를 알린다 */
export function handleLoginReturn() {
  const ret = takeLoginReturn();
  if (!ret) return;
  finishLogin(ret).then(
    (res) => {
      if (!res) return;
      if (res.error) {
        toast(res.link ? t("로그인 연결 실패") : t("로그인 실패"), loginErrorText(res.error), { kind: res.error === "cancel" ? "note" : "drop" });
        return;
      }
      settleLogin(res);
    },
    (e) => toast(t("로그인 실패"), loginErrorText(codeOf(e)), { kind: "drop" }),
  );
}
