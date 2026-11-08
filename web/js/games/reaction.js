// 누르기 빠르기를 쓰는 놀이(뿅망치, 돈파파)가 같이 쓰는 컴퓨터 반응 시간.
// 시간은 손을 보인 뒤부터 잰 ms 다. 안 눌렀으면 Infinity 로 넘긴다.

/** 컴퓨터 세기별 평균 반응 시간(ms) */
export const REACTION_LEVELS = {
  easy: 600,
  normal: 450,
  hard: 330,
};

/**
 * 컴퓨터가 누르는 시각. 평균 둘레로 퍼지고(균등 난수 셋의 평균이라 가운데가 잦다) min 아래로는 안 내려간다.
 * level 은 REACTION_LEVELS 의 열쇠나 평균 ms 숫자.
 */
export function reactionMs(rng, level = "normal", { spread = 180, min = 180 } = {}) {
  const mean = typeof level === "number" ? level : REACTION_LEVELS[level] ?? REACTION_LEVELS.normal;
  const u = (rng.next() + rng.next() + rng.next()) / 3;
  return Math.max(min, Math.round(mean + (u - 0.5) * 2 * spread));
}

/** 누른 시각 둘 가운데 먼저 누른 쪽(0, 1). 둘 다 안 눌렀거나 limit 을 넘겼으면 null, 같으면 tie 쪽 */
export function firstPress(ms0, ms1, { limit = Infinity, tie = 0 } = {}) {
  const ok0 = Number.isFinite(ms0) && ms0 <= limit;
  const ok1 = Number.isFinite(ms1) && ms1 <= limit;
  if (!ok0 && !ok1) return null;
  if (ok0 && !ok1) return 0;
  if (ok1 && !ok0) return 1;
  if (ms0 === ms1) return tie;
  return ms0 < ms1 ? 0 : 1;
}
