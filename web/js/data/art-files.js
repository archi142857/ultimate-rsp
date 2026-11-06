// scripts/art_list.mjs 가 web/art/ 를 보고 만든다. 손으로 고치지 않는다.
// 그림 이름 → 내용 해시(그림 주소 뒤 ?v= 에 붙여서, 그림을 고치면 캐시가 바로 바뀐다)

export const ART_FILES = new Map([
  ["hand-paper", "d2a4867b"],
  ["hand-rock", "79c9f3f3"],
  ["hand-scissors", "263e8c15"],
]);
