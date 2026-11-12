// 직접 만들기(RPS-n): 손 개수와 이기는 수를 정하면 고리 규칙을 만들어 바로 겨룬다.

import { h, clear } from "../ui/dom.js";
import { t } from "../i18n.js";
import { compileVariant } from "../core/engine.js";
import { makeCustomDef, maxWins, CUSTOM_MIN, CUSTOM_MAX } from "../data/custom.js";
import { buildMatrixPage } from "./matrix.js";
import { randomSeed } from "../core/rng.js";

export function customView(main, entry, params) {
  let n = clampInt(params.n, CUSTOM_MIN, CUSTOM_MAX, 9);
  let k = clampInt(params.k, 1, maxWins(n), maxWins(n));
  let seed = clampInt(params.seed, 1, 2 ** 31, (randomSeed() % 100000) + 1);
  let page = null;
  const host = h("div", { class: "custom-page" });
  main.append(host);

  function render() {
    if (page && page.destroy) page.destroy();
    clear(host);
    const def = makeCustomDef({ n, k, seed });
    const V = compileVariant(def);
    history.replaceState(null, "", `#/v/custom?n=${n}&k=${k}&seed=${seed}`);
    page = buildMatrixPage(host, { ...entry, ...def, id: "custom", about: [...def.about, ...entry.about], sub: null, origin: t("직접 만들기") }, V, {
      extraControls: controls(),
      recordId: "custom",
    });
  }

  function controls() {
    const nOut = h("output", {}, String(n));
    const kOut = h("output", {}, String(k));
    const nIn = h("input", {
      type: "range",
      min: CUSTOM_MIN,
      max: CUSTOM_MAX,
      value: n,
      "aria-label": t("손 개수"),
      oninput: () => (nOut.textContent = nIn.value),
      onchange: () => {
        n = Number(nIn.value);
        k = maxWins(n); // 손 개수를 바꾸면 이기는 수는 가장 큰 값(비기는 짝이 가장 적은 판)으로 돌린다
        render();
      },
    });
    const kIn = h("input", {
      type: "range",
      min: 1,
      max: maxWins(n),
      value: k,
      "aria-label": t("손마다 이기는 수"),
      disabled: maxWins(n) <= 1,
      oninput: () => (kOut.textContent = kIn.value),
      onchange: () => {
        k = Number(kIn.value);
        render();
      },
    });
    return h(
      "section",
      { class: "panel", style: { marginBottom: "24px" }, "aria-label": t("규칙 만들기") },
      h(
        "div",
        { class: "controls", style: { marginBottom: "0" } },
        h("div", { class: "range" }, h("span", { class: "field-label" }, t("손 개수") + " ", nOut), nIn),
        h("div", { class: "range" }, h("span", { class: "field-label" }, t("손마다 이기는 수") + " ", kOut), kIn),
        h(
          "button",
          {
            class: "btn",
            type: "button",
            onclick: () => {
              seed = (randomSeed() % 100000) + 1;
              render();
            },
          },
          t("손 다시 뽑기"),
        ),
      ),
      h(
        "p",
        { class: "rec" },
        t("이기는 수가 손 개수의 절반보다 적으면 비기는 짝이 생깁니다. 러브레이스의 RPS-101처럼 손을 101개까지 만들 수 있습니다. 주소를 보내면 같은 규칙이 열립니다."),
      ),
    );
  }

  render();
  return {
    onKey: (e) => page && page.onKey && page.onKey(e),
    destroy: () => page && page.destroy && page.destroy(),
  };
}

function clampInt(v, lo, hi, fallback) {
  const x = Number.parseInt(v, 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(lo, Math.min(hi, x));
}
