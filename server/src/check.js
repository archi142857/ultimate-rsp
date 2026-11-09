// 값 검사와 코드 만들기. Cloudflare 없이 돌아서 시험(tests/)에서 바로 쓴다.

import { Fail } from "./http.js";
import { CODE_ABC, CODE_LEN, EMOTES, NAME_MAX } from "./protocol.js";
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

/** 방을 만들 때 화면이 미리 채운 코드. 안 주면 null(서버가 뽑는다), 꼴이 틀리면 bad_request */
export function checkRoomCode(code) {
  if (code === undefined || code === null) return null;
  const c = normCode(code, CODE_LEN.room);
  if (!c) throw new Fail("bad_request");
  return c;
}

const PID = /^[A-Za-z0-9_-]{16,64}$/;

export function checkPid(pid) {
  if (typeof pid !== "string" || !PID.test(pid)) throw new Fail("bad_pid");
  return pid;
}

// 줄바꿈·제어 문자, 보이지 않는 서식 문자 모두(\p{Cf}: 빈칸 U+200B, 방향 표시 U+200E·U+200F, 글 방향 뒤집기, 소프트 하이픈 U+00AD,
// 태그 글자 U+E0001–E007F 등. 이모지를 잇는 U+200D 만 받는다), 빈칸처럼 보이는 글자(한글 채움 U+3164·U+FFA0·U+115F·U+1160,
// 점자 빈칸 U+2800, U+034F, 크메르 안 보이는 모음 U+17B4·U+17B5, 몽골 이체 선택자 U+180B–U+180F).
// 이체 선택자는 제 짝 글자 뒤에서만 받는다: U+FE0E·U+FE0F 는 그림 글자(\p{Extended_Pictographic})나 키캡 바탕(0–9 # *) 바로 뒤,
// U+E0100–U+E01EF 는 한자 바로 뒤. U+FE00–U+FE0D 는 안 받는다.
// 11-08·11-09 검수: 이 글자로 빈 이름이나 겉보기에 똑같은 이름('ab' 와 'a'+U+17B4+'b')을 만들 수 있었다. 화면 identity.js 의 HIDDEN 도 같은 모음으로
const BAD_NAME =
  /[\p{Cc}\u2028\u2029\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u2800\u3164\uFFA0\uFE00-\uFE0D]|(?!\u200D)\p{Cf}|(?<![\p{Extended_Pictographic}0-9#*])[\uFE0E\uFE0F]|(?<!\p{Ideographic})[\u{E0100}-\u{E01EF}]/u;
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
