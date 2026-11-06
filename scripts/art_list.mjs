// web/art/ 의 손 그림 목록(web/js/data/art-files.js)을 다시 만든다.
//   node scripts/art_list.mjs
// 그림을 넣거나 빼거나 고친 뒤에 돌린다. 규격에 어긋나는 파일은 알려 주고 목록에 넣지 않는다.
// 규격은 tests/art.test.mjs 와 같다(세션소통\자료\그림_규격.md).

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artDir = join(root, "web", "art");
const outFile = join(root, "web", "js", "data", "art-files.js");

/** 규격 검사. 어긋난 까닭들을 돌려준다(없으면 빈 배열) */
export function checkSvg(text) {
  const bad = [];
  // 크기는 그림만 잰다. 파일에 붙어 오는 <metadata>(만든 도구·출처 정보)는 세지 않는다.
  // 보통 40KB 아래지만 Fluent 원본이 복잡한 것(여왕 73KB)이 있어 80KB 까지 둔다. 압축해서 보내면 10KB 안팎이다
  const drawing = text.replace(/<metadata\b[\s\S]*?<\/metadata>/gi, "");
  if (Buffer.byteLength(drawing, "utf8") > 80 * 1024) bad.push("그림이 80KB 를 넘는다");
  if (!/<svg\b[^>]*\bviewBox="0 0 64 64"/.test(text)) bad.push('viewBox="0 0 64 64" 가 아니다');
  if (/<script\b/i.test(text)) bad.push("script 가 있다");
  if (/<foreignObject\b/i.test(text)) bad.push("foreignObject 가 있다");
  if (/<image\b/i.test(text)) bad.push("image(바깥 그림)가 있다");
  if (/<text\b/i.test(text)) bad.push("글자(text)가 있다");
  if (/\son[a-z]+\s*=/i.test(text)) bad.push("on… 속성이 있다");
  if (/(?:xlink:)?href\s*=\s*"(?!#)/i.test(text)) bad.push("바깥 주소(href)가 있다");
  if (/url\(\s*['"]?(?!#)/i.test(text)) bad.push("바깥 주소(url)가 있다");
  return bad;
}

export function scanArt() {
  const files = existsSync(artDir) ? readdirSync(artDir).filter((f) => f.endsWith(".svg")).sort() : [];
  const ok = [];
  const problems = [];
  for (const f of files) {
    const key = f.slice(0, -4);
    const text = readFileSync(join(artDir, f), "utf8");
    const bad = checkSvg(text);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) bad.push("파일 이름은 영문 소문자·숫자·하이픈만");
    if (bad.length) problems.push([f, bad]);
    else ok.push([key, createHash("sha256").update(text).digest("hex").slice(0, 8)]);
  }
  return { ok, problems };
}

export function renderList(ok) {
  const rows = ok.map(([k, v]) => `  ["${k}", "${v}"],`).join("\n");
  return [
    "// scripts/art_list.mjs 가 web/art/ 를 보고 만든다. 손으로 고치지 않는다.",
    "// 그림 이름 → 내용 해시(그림 주소 뒤 ?v= 에 붙여서, 그림을 고치면 캐시가 바로 바뀐다)",
    "",
    `export const ART_FILES = new Map([${rows ? `\n${rows}\n` : ""}]);`,
    "",
  ].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { ok, problems } = scanArt();
  for (const [f, bad] of problems) console.error(`빼고 넣음 ${f}: ${bad.join(", ")}`);
  writeFileSync(outFile, renderList(ok));
  console.log(`web/js/data/art-files.js: 그림 ${ok.length}장${problems.length ? `, 규격에 안 맞아 뺀 것 ${problems.length}장` : ""}`);
  if (problems.length) process.exitCode = 1;
}
