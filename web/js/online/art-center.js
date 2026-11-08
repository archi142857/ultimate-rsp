// 프로필 그림을 동그라미 가운데에(11-08 사용자: "구덩이, 카메라, 민달팽이 중심 좀 맞춰줘").
// Fluent 그림은 물건을 판 아래쪽에 놓은 것이 많아 동그라미 얼굴로 쓰면 아래로 쏠려 보인다.
// 얼굴로 쓸 때만(사람 그림·그림 고르기) 보이는 부분의 가운데를 그림 가운데로 옮긴다. 놀이 화면의 손 그림은 그대로.
// 값 [x, y]: 보이는 부분(256px 로 그려 알파 > 24 인 픽셀 상자)의 가운데가 그림 가운데에서 비킨 정도. 그림 한 변에 대한 비율, 오른쪽·아래가 +.
// 2% 넘는 것만 적었다. 민달팽이는 몸통이 오른쪽 아래로 쏠려 무게 가운데와 반씩 섞었고, 사냥꾼(활)·물풍선(물방울)은 옆에 붙은 것 때문에
// 상자만 비켜서 뺐다. 그림이 바뀌면 다시 잰다(tests/online-faces.test.mjs 는 이름이 그림 목록에 있는지만 본다).

export const ART_CENTER = {
  bear: [0.004, 0.029], bicycle: [0, 0.082], book: [0.004, 0.082], butter: [0, 0.117], camera: [0, 0.105], car: [0, 0.082], chainsaw: [0.01, 0.049],
  community: [-0.012, 0.084], diamond: [0, 0.07], dynamite: [0, -0.039], fence: [0, -0.031], fish: [-0.002, 0.045], grass: [-0.008, 0.029], gun: [-0.01, 0.125],
  heart: [0, 0.025], helicopter: [-0.014, 0.035], laser: [0.016, -0.025], monkey: [0.004, 0.031], moon: [0.018, 0.033], mountain: [0, 0.023],
  nuke: [-0.031, 0.035], pit: [0, 0.141], porcupine: [0.006, 0.035], quicksand: [0, 0.049], rain: [0, -0.035], slug: [0.049, 0.084], tank: [0.029, 0.043],
  ufo: [-0.008, 0.051], videogame: [0, 0.074], vulture: [0, 0.021], watonai: [0.002, 0.023], well: [0, -0.023], whip: [-0.016, 0.033]
};

/** 그림을 가운데로 옮기는 CSS 변수(--fx, --fy). 옮길 것이 없으면 null */
export function centerVars(id) {
  const c = Object.prototype.hasOwnProperty.call(ART_CENTER, id) ? ART_CENTER[id] : null;
  if (!c) return null;
  const pct = (v) => `${+(-v * 100).toFixed(1)}%`;
  return { "--fx": pct(c[0]), "--fy": pct(c[1]) };
}
