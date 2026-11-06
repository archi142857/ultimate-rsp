// 화면 이동(주소의 # 뒤를 본다)과 밝기 설정.

import { clear, h } from "./ui/dom.js";
import { setting, setSetting } from "./ui/store.js";
import { findEntry } from "./data/catalog.js";
import { homeView } from "./views/home.js";
import { aboutView } from "./views/about.js";
import { entryView } from "./views/entry.js";

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
      const id = decodeURIComponent(path.slice(3));
      const entry = findEntry(id);
      if (!entry) notFound();
      else {
        nav = entry.cat === "sim" ? "sims" : "home";
        current = entryView(main, entry, params);
      }
    } else notFound();
  } catch (e) {
    console.error(e);
    clear(main);
    main.append(
      h("div", { class: "entry-head" }, h("h1", { class: "entry-title" }, "화면을 그리지 못했다"), h("p", {}, String(e && e.message))),
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
  main.append(
    h(
      "div",
      { class: "entry-head" },
      h("a", { class: "back", href: "#/" }, "도감"),
      h("h1", { class: "entry-title" }, "없는 화면"),
      h("p", { class: "entry-sub" }, "주소를 다시 확인하거나 도감에서 골라 주세요."),
    ),
  );
}

window.addEventListener("hashchange", route);

document.addEventListener("keydown", (e) => {
  if (!current || !current.onKey) return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
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

export function applyScheme() {
  const s = setting("scheme", "system");
  const dark = s === "dark" || (s !== "light" && media && media.matches);
  const before = document.documentElement.dataset.scheme;
  document.documentElement.dataset.scheme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#0f1126" : "#f1f3f8";
  const btn = document.getElementById("theme-btn");
  if (btn) {
    btn.innerHTML = ICONS[s];
    btn.setAttribute("aria-label", `화면 밝기: ${SCHEME_NAME[s]}. 눌러서 바꾸기`);
    btn.title = `화면 밝기: ${SCHEME_NAME[s]}`;
  }
  if (before !== document.documentElement.dataset.scheme) window.dispatchEvent(new CustomEvent("schemechange"));
}

document.getElementById("theme-btn").addEventListener("click", () => {
  const s = setting("scheme", "system");
  setSetting("scheme", SCHEMES[(SCHEMES.indexOf(s) + 1) % SCHEMES.length]);
  applyScheme();
});
if (media && media.addEventListener) media.addEventListener("change", applyScheme);

applyScheme();
route();
