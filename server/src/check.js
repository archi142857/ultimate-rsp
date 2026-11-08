// 값 검사와 코드 만들기. Cloudflare 없이 돌아서 시험(tests/)에서 바로 쓴다.

import { Fail } from "./http.js";
import { CODE_ABC, EMOTES, NAME_MAX } from "./protocol.js";
import { ART_FILES } from "../../web/js/data/art-files.js";

function randomBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

/** 무작위 코드. 256 을 31 로 나눈 나머지 쏠림이 없게 248 이상은 버린다 */
export function makeCode(len, bytes = randomBytes) {
  const limit = 256 - (256 % CODE_ABC.length);
  let out = "";
  while (out.length < len) {
    for (const b of bytes(len * 2)) {
      if (b >= limit) continue;
      out += CODE_ABC[b % CODE_ABC.length];
      if (out.length === len) break;
    }
  }
  return out;
}

/** 사람이 친 코드를 정리한다(대문자로). 꼴이 틀리면 null */
export function normCode(s, len) {
  if (typeof s !== "string" || s.length !== len) return null;
  const up = s.toUpperCase();
  for (const ch of up) if (!CODE_ABC.includes(ch)) return null;
  return up;
}

const PID = /^[A-Za-z0-9_-]{16,64}$/;

export function checkPid(pid) {
  if (typeof pid !== "string" || !PID.test(pid)) throw new Fail("bad_pid");
  return pid;
}

// 줄바꿈·제어 문자, 보이지 않는 빈칸, 글 방향을 뒤집는 글자. 화면(web/js/online/identity.js 의 HIDDEN)과 같은 모음이고,
// 이모지를 잇는 글자(U+200D)는 받는다
const BAD_NAME = /[\p{Cc}\u2028\u2029\u200B\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/u;
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

/** 닉네임: 줄바꿈·제어 문자가 있으면 안 받는다. 앞뒤 공백을 떼고, 가운데 공백은 하나로. 1–20자(코드 포인트) */
export function checkName(name) {
  if (typeof name !== "string") throw new Fail("bad_name");
  const raw = name.normalize("NFC");
  if (BAD_NAME.test(raw)) throw new Fail("bad_name");
  const s = raw.trim().replace(/\s+/gu, " ");
  const len = [...s].length;
  if (len < 1 || len > NAME_MAX || !VISIBLE.test(s)) throw new Fail("bad_name");
  return s;
}

/** 이모트 id. optional 이면 빈 값은 null */
/** 프로필 그림(web/art 그림 이름). 이름처럼 남에게 보이는 값. 없거나 모르는 값은 오류 없이 null */
export function checkFace(face) {
  return typeof face === "string" && ART_FILES.has(face) ? face : null;
}

export function checkEmote(e, optional = false) {
  if (optional && (e === undefined || e === null)) return null;
  if (typeof e !== "string" || !EMOTES.includes(e)) throw new Fail("bad_request");
  return e;
}
