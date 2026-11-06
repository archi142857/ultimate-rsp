// 손 색. 손 8개까지는 색각 이상 시뮬레이션으로 검사한 차례의 8색을 고리 차례대로 쓰고,
// 그보다 많으면 색상환을 고르게 나눈다(이때 손은 이모지와 이름으로 알아본다).

export const LIGHT8 = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const DARK8 = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

/** 고리 차례 p 번째 손의 [밝은 화면 색, 어두운 화면 색] */
export function ringColor(p, n) {
  if (n <= 8) return [LIGHT8[p], DARK8[p]];
  const h = (250 + (360 * p) / n) % 360;
  return [oklchToHex(0.64, 0.13, h), oklchToHex(0.66, 0.12, h)];
}

/** 손 번호 → [밝은, 어두운]. V.order(고리 차례)를 따른다. 변종이 colors 를 주면 그것을 쓴다 */
export function handColors(V) {
  const out = new Array(V.n);
  V.order.forEach((handIndex, p) => {
    out[handIndex] = V.colors ? [V.colors.light[p], V.colors.dark[p]] : ringColor(p, V.n);
  });
  return out;
}

/** CSS 변수로 넘길 꼴 */
export function handVars(V, i) {
  const c = (V._colors ||= handColors(V))[i];
  return { "--cl": c[0], "--cd": c[1] };
}

export function isDark() {
  return document.documentElement.dataset.scheme === "dark";
}

export function handColor(V, i) {
  const c = (V._colors ||= handColors(V))[i];
  return isDark() ? c[1] : c[0];
}

export function oklchToHex(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const enc = (x) => {
    x = Math.max(0, Math.min(1, x));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  };
  return "#" + [r, g, bb].map((x) => Math.round(enc(x) * 255).toString(16).padStart(2, "0")).join("");
}

export function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
