// Durable Object 를 어디에 만들지(location hint). 한 번 만든 DO 는 자리를 옮기지 않는다.
// 사람이 직접 만드는 방·도전장은 힌트 없이 둔다(만든 사람 가까이 생긴다).
// 랜덤 방은 대기열 DO 가 만들어서 대기열 자리에 생기므로, 두 사람이 있는 곳을 힌트로 준다.
// 순위표(게임마다 하나)는 대기열처럼 동북아에 둔다. 힌트는 처음 만들 때만 먹는다.
// 위치는 입구가 request.cf 로 본 나라·대륙만 쓴다(정확한 주소는 안 쓴다). 순수 모듈이라 시험이 바로 쓴다.

/** 대기열(랜덤 매칭 DO) 자리: 주로 쓰는 곳(한국)과 가까운 동북아 */
export const QUEUE_HINT = "apac-ne";

/** 순위표(랭킹 DO) 자리: 대기열과 같은 곳. 누가 처음 부르든(입구·방) 여기에 생긴다 */
export const RANK_HINT = QUEUE_HINT;

const NE = new Set(["KR", "JP", "TW", "HK", "MO", "CN", "MN"]);
const SE = new Set(["SG", "MY", "ID", "TH", "VN", "PH", "KH", "LA", "MM", "BN"]);
const ME = new Set(["AE", "SA", "QA", "KW", "BH", "OM", "IL", "JO", "LB", "IQ", "IR", "YE", "SY", "PS"]);

/** request.cf → 힌트(모르면 null). cf 는 { country, continent, longitude } 꼴 */
export function placeOf(cf) {
  if (!cf || typeof cf !== "object") return null;
  const c = cf.country;
  if (NE.has(c)) return "apac-ne";
  if (SE.has(c)) return "apac-se";
  if (ME.has(c)) return "me";
  switch (cf.continent) {
    case "AS":
      return "apac";
    case "OC":
      return "oc";
    case "EU":
      return "weur";
    case "NA":
      return Number(cf.longitude) < -100 ? "wnam" : "enam";
    case "SA":
      return "sam";
    case "AF":
      return "afr";
    default:
      return null;
  }
}

const HINTS = new Set(["apac", "apac-ne", "apac-se", "oc", "weur", "eeur", "wnam", "enam", "sam", "afr", "me"]);

/** 받은 값이 알려진 힌트면 그대로, 아니면 null */
export function checkHint(h) {
  return typeof h === "string" && HINTS.has(h) ? h : null;
}

/** 랜덤 방 자리: 먼저 기다린 사람 쪽(같은 곳이면 그곳). 둘 다 모르면 null(대기열 가까이) */
export function pairHint(places) {
  const known = places.map(checkHint).filter(Boolean);
  return known[0] || null;
}
