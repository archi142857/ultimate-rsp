// 화면 이동(주소의 # 뒤를 본다)과 밝기·언어 설정.

import { clear, h, setTitle } from "./ui/dom.js";
import { t, lang, setLang } from "./i18n.js";
import { setting, setSetting } from "./ui/store.js";
import { findEntry } from "./data/catalog.js";
import { homeView } from "./views/home.js";
import { aboutView } from "./views/about.js";
import { entryView } from "./views/entry.js";
import { onlineView, parseOnline } from "./online/index.js";

const main = document.getElementById("main");
let current = null;
let first = true;

function parse() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  const params = Object.fromEntries(new URLSearchParams(query));
  return { path, params };
}

function route() {
  if (current && current.destroy) {
    try {
      current.destroy();
    } catch (e) {
      console.error(e);
    }
  }
  current = null;
  clear(main);
  const { path, params } = parse();
  let nav = "home";
  try {
    if (path === "/" || path === "") current = homeView(main, {});
    else if (path === "/sims") {
      nav = "sims";
      current = homeView(main, { focus: "sim" });
    } else if (path === "/about") {
      nav = "about";
      current = aboutView(main);
    } else if (path.startsWith("/v/")) {
      // 깨진 주소(%E0%A4%A 같은)는 '찾을 수 없다'로(검수 11-08)
      let id = null;
      try {
        id = decodeURIComponent(path.slice(3));
      } catch {
        /* 아래에서 notFound */
      }
      const entry = id === null ? null : findEntry(id);
      if (!entry) notFound();
      else {
        nav = entry.cat === "sim" ? "sims" : "home";
        current = entryView(main, entry, params);
      }
    } else {
      // 온라인: #/play, #/c/번호, #/room/코드
      const online = parseOnline(path);
      if (online) {
        nav = "online";
        current = onlineView(main, online, params);
      } else notFound();
    }
  } catch (e) {
    console.error(e);
    clear(main);
    setTitle(t("화면을 불러오지 못했다"));
    main.append(
      h("div", { class: "entry-head" }, h("h1", { class: "entry-title" }, t("화면을 불러오지 못했다")), h("p", {}, String(e && e.message))),
    );
  }
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === nav) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (!first) {
    if (!(current && current.keepScroll)) window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  first = false;
}

function notFound() {
  setTitle(t("화면을 찾을 수 없다"));
  main.append(
    h(
      "div",
      { class: "entry-head" },
      h("a", { class: "back", href: "#/" }, t("도감")),
      h("h1", { class: "entry-title" }, t("화면을 찾을 수 없다")),
      h("p", { class: "entry-sub" }, t("주소를 다시 확인하거나 도감에서 고르면 된다.")),
    ),
  );
}

window.addEventListener("hashchange", route);

document.addEventListener("keydown", (e) => {
  if (!current || !current.onKey) return;
  const el = e.target;
  if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
  if (current.onKey(e)) e.preventDefault();
});

// ── 밝기: 기기 설정 → 밝게 → 어둡게 ─────────────────
const SCHEMES = ["system", "light", "dark"];
const SCHEME_NAME = { system: "기기 설정", light: "밝게", dark: "어둡게" };
const ICONS = {
  system:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  light:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
};
const media = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;

/** 저장된 밝기. 모르는 값(예: "auto")이면 기기 설정으로 본다(검수 11-08: 빈 화면이 됐다) */
function schemeSetting() {
  const s = setting("scheme", "system");
  return SCHEMES.includes(s) ? s : "system";
}

export function applyScheme() {
  const s = schemeSetting();
  const dark = s === "dark" || (s !== "light" && media && media.matches);
  const before = document.documentElement.dataset.scheme;
  document.documentElement.dataset.scheme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#0f1126" : "#f1f3f8";
  const btn = document.getElementById("theme-btn");
  if (btn) {
    btn.innerHTML = ICONS[s];
    btn.setAttribute("aria-label", t("화면 밝기: {s}. 눌러서 바꾸기", { s: t(SCHEME_NAME[s]) }));
    btn.title = t("화면 밝기: {s}", { s: t(SCHEME_NAME[s]) });
  }
  if (before !== document.documentElement.dataset.scheme) window.dispatchEvent(new CustomEvent("schemechange"));
}

document.getElementById("theme-btn").addEventListener("click", () => {
  const s = schemeSetting();
  setSetting("scheme", SCHEMES[(SCHEMES.indexOf(s) + 1) % SCHEMES.length]);
  applyScheme();
});
if (media && media.addEventListener) media.addEventListener("change", applyScheme);

// ── 언어: 한국어 ↔ English ─────────────────
function applyLangChrome() {
  document.documentElement.lang = lang();
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.content = t("세계 곳곳의 가위바위보 변종을 모았다. 누가 누구를 이기는지 고리 그림으로 보고, 컴퓨터나 친구와 바로 겨룬다.");
  // 단추는 바꿀 언어를 그 언어로 보여 준다
  const btn = document.getElementById("lang-btn");
  if (btn) {
    const toEn = lang() === "ko";
    btn.textContent = toEn ? "EN" : "한";
    btn.lang = toEn ? "en" : "ko";
    btn.setAttribute("aria-label", toEn ? "Switch to English (영어로 보기)" : "한국어로 보기 (Switch to Korean)");
    btn.title = toEn ? "English" : "한국어";
  }
}

document.getElementById("lang-btn").addEventListener("click", () => {
  setLang(lang() === "ko" ? "en" : "ko");
  applyLangChrome();
  applyScheme();
  route();
});

applyLangChrome();
applyScheme();
route();
