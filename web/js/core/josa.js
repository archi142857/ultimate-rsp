// 받침에 따라 조사를 붙인다: josa("바위", "이가") → "바위가", josa("스팍", "이가") → "스팍이"
// 짝: "이가", "을를", "은는", "과와", "으로로", "아야", "이랑랑"

const DIGIT_BATCHIM = { 0: 21, 1: 8, 2: 0, 3: 16, 4: 0, 5: 0, 6: 1, 7: 8, 8: 8, 9: 0 };
// 받침 번호: 0 없음, 1 ㄱ, 8 ㄹ, 16 ㅁ, 21 ㅇ (유니코드 한글 음절의 종성 순서)

function lastBatchim(word) {
  const s = String(word).trim();
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i];
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
    if (/[0-9]/.test(ch)) return DIGIT_BATCHIM[ch];
    if (/[a-zA-Z]/.test(ch)) return /[lmnr]/i.test(ch) ? 8 : 0; // 영어는 대충 읽는 소리로
    // 이모지·기호·괄호는 건너뛰고 앞 글자를 본다
    if (ch === ")" || ch === "]") {
      const open = s.lastIndexOf(ch === ")" ? "(" : "[", i);
      if (open > 0) {
        i = open;
        continue;
      }
    }
  }
  return 0;
}

export function josa(word, pair) {
  const b = lastBatchim(word);
  const has = b !== 0;
  switch (pair) {
    case "이가":
      return word + (has ? "이" : "가");
    case "을를":
      return word + (has ? "을" : "를");
    case "은는":
      return word + (has ? "은" : "는");
    case "과와":
      return word + (has ? "과" : "와");
    case "으로로":
      return word + (has && b !== 8 ? "으로" : "로");
    case "아야":
      return word + (has ? "아" : "야");
    case "이랑랑":
      return word + (has ? "이랑" : "랑");
    default:
      return word;
  }
}
