// 작은 DOM 도구. h("div", { class: "x", onclick }, 자식...)

import { t as tr } from "../i18n.js";

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "vars") for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val);
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

const SVGNS = "http://www.w3.org/2000/svg";
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.setAttribute("class", v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const reducedMotion = () => {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 0.333 → "33%" , 작은 값은 소수 한 자리 */
export function pct(p) {
  const v = p * 100;
  if (v > 0 && v < 1) return v.toFixed(1) + "%";
  return Math.round(v) + "%";
}

/** 분수로 보기 좋게(1/3, 1/9 …) 안 되면 % */
export function frac(p) {
  for (let d = 1; d <= 30; d++) {
    const n = Math.round(p * d);
    if (Math.abs(n / d - p) < 1e-6) return n === 0 ? "0" : d === 1 ? String(n) : `${n}/${d}`;
  }
  return pct(p);
}

export function setTitle(title) {
  document.title = title ? `${title} — Ultimate RSP` : `Ultimate RSP — ${tr("궁극의 가위바위보")}`;
}
