// 메일 보내기(이메일 가입·비밀번호 찾기 확인 코드). Resend HTTP API 를 쓴다(무료 하루 100통, 우리 도메인 인증 필요).
// 열쇠(RESEND_API_KEY)와 보내는 주소(MAIL_FROM, 예: "궁극의 가위바위보 <no-reply@우리도메인>")가 있어야 켜진다.
// 로컬 시험(wrangler dev --var AUTH_TEST:1, localhost)에서는 보내지 않고 코드를 답에 실어 준다.
// Cloudflare 없이 돈다(fetch 는 넘겨받는다).

import { Fail } from "./http.js";

const RESEND = "https://api.resend.com/emails";
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)$/;

/** 로컬 시험 모드(메일 대신 답에 코드) */
export function mailTest(env, url) {
  return env.AUTH_TEST === "1" && Boolean(url) && LOCAL_HOST.test(url.hostname);
}

/** 메일을 보낼 수 있나(이메일 가입이 켜지나) */
export function mailReady(env, url) {
  return Boolean(env.RESEND_API_KEY && env.MAIL_FROM) || mailTest(env, url);
}

/**
 * 보낼 글. kind: signup(가입 확인 코드), exists(이미 가입된 주소로 다시 가입하려 함), reset(비밀번호 찾기 코드), link(로그인 방법 더하기 확인 코드).
 * 화면 말투(11-09)대로 문장은 하십시오체. 한국어 뒤에 영어
 */
export function mailText(kind, code) {
  const min = 30;
  const tail = "요청하지 않았다면 이 메일은 무시하셔도 됩니다.\nIf you did not ask for this, you can ignore this email.";
  if (kind === "exists") {
    return {
      subject: "[궁극의 가위바위보] 이미 가입된 메일 주소입니다",
      text: `이 메일 주소로 이미 가입되어 있습니다. 비밀번호가 기억나지 않으면 로그인 화면의 '비밀번호 찾기'를 이용해 주십시오.\n\nThis email address already has an account. If you forgot the password, use "Forgot password" on the sign-in screen.\n\n${tail}`,
    };
  }
  const what = kind === "reset" ? "비밀번호 찾기" : kind === "link" ? "로그인 방법 더하기" : "가입";
  const whatEn = kind === "reset" ? "password reset" : kind === "link" ? "adding a sign-in method" : "sign-up";
  return {
    subject: `[궁극의 가위바위보] 확인 코드 ${code}`,
    text: `${what} 확인 코드는 ${code} 입니다. ${min}분 안에 화면에 입력해 주십시오.\n\nYour ${whatEn} code is ${code}. Enter it within ${min} minutes.\n\n${tail}`,
  };
}

/** 메일 한 통. 실패하면 busy(사용자는 잠시 뒤 다시) */
export async function sendMail(env, { to, subject, text }, f = fetch) {
  let res;
  try {
    res = await f(RESEND, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
    });
  } catch (e) {
    console.error("mail fetch", (e && e.message) || e);
    throw new Fail("busy");
  }
  if (!res.ok) {
    console.error("mail status", res.status);
    throw new Fail("busy");
  }
}
