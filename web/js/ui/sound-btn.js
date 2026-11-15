// 머리글 소리 단추(디자인 11-12 최종 ③ 누르면 펼치는 칸, `세션소통\자료\소리_단추_시안\설명.md`. 사용자 결정 컨셉 11-12 09:34).
// 누르면 단추 아래에 칸이 펼쳐진다: 효과음 스위치 → 배경음악 스위치(배경음악이 들어 있을 때만) → 음량.
// 열면 첫 스위치로 초점이 간다. 칸 안에서 바꿔도 닫히지 않고, 바깥을 누르거나 Tab 으로 벗어나거나 Esc·화면 이동이면 닫힌다.
// 아이콘: 소리가 하나라도 켜져 있으면 물결(음량 0 이면 없음, 50% 아래면 한 줄), 다 꺼지면 사선.
// 처음 온 사람(소리 설정을 손대지 않은 사람)에게는 첫 소리가 날 때 단추 아래에 한 번만 '소리 켜짐 · 끄기'(6초 뒤 닫힘).
// 소리 설정은 sound/index.js 가 갖고 있다. 여기서는 그것을 보이고 바꾸기만 한다(켜고 음량을 바꿀 때의 소리도 그쪽이 낸다).

import { h } from "./dom.js";
import { t } from "../i18n.js";
import { setting, setSetting } from "./store.js";
import { soundState, setSound, onSoundChange, onFirstSound, HAS_MUSIC } from "../sound/index.js";

const NOTE_KEY = "soundNote"; // 처음 안내를 보였는가(이 브라우저에서 한 번)
const NOTE_MS = 6000;

// 디자인 아이콘(24 격자, 선 1.8, currentColor). 끔은 사선 둘레를 가려 스피커와 겹치는 데가 비어 보이게
const SPK = '<path d="M4 9.5h3l4.5-4v13l-4.5-4H4z" stroke-linejoin="round"/>';
const OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">';
const ICONS = {
  on2: `${OPEN}${SPK}<path d="M14.8 9.6a3.4 3.4 0 0 1 0 4.8"/><path d="M17.4 7a7 7 0 0 1 0 10"/></svg>`,
  on1: `${OPEN}${SPK}<path d="M14.8 9.6a3.4 3.4 0 0 1 0 4.8"/></svg>`,
  on0: `${OPEN}${SPK}</svg>`,
  off: `${OPEN}<mask id="snd-cut"><rect width="24" height="24" fill="#fff"/><path d="M3.5 3.5L20.5 20.5" stroke="#000" stroke-width="5.2"/></mask><g mask="url(#snd-cut)">${SPK}</g><path d="M3.5 3.5L20.5 20.5"/></svg>`,
};

/** 아이콘 svg 글. on: 소리가 하나라도 켜짐, volume: 0~1 */
export function soundIcon(on, volume) {
  return !on ? ICONS.off : volume <= 0 ? ICONS.on0 : volume < 0.5 ? ICONS.on1 : ICONS.on2;
}

/** 소리가 하나라도 켜져 있나(배경음악은 곡이 들어 있을 때만 센다) */
export const soundOn = (s) => s.sfx || (HAS_MUSIC && s.music);

/** 머리글의 단추(#sound-btn)에 칸과 안내를 붙인다. 돌려주는 draw() 는 언어를 바꾼 뒤 다시 부른다 */
export function mountSoundButton(btn) {
  if (!btn) return { draw() {} };
  const box = btn.parentElement;
  let open = false;
  let noteTimer = 0;

  // ── 칸 ─────────────────
  const sfxSw = switchRow("sfx");
  const musicSw = HAS_MUSIC ? switchRow("music") : null;
  const volIn = h("input", { type: "range", class: "sound-vol", min: "0", max: "100", step: "5" });
  const volOut = h("span", { class: "sound-vol-out", "aria-hidden": "true" });
  const volLabel = h("span", { class: "sound-row-label" });
  const volRow = h("label", { class: "sound-row sound-vol-row" }, volLabel, volIn, volOut);
  volIn.addEventListener("input", () => setSound({ volume: Number(volIn.value) / 100 }));
  const panel = h("div", { class: "sound-panel", id: "sound-panel", role: "group", hidden: true }, sfxSw.el, musicSw ? musicSw.el : null, volRow);
  // 처음 안내: '소리 켜짐'(낭독은 이것만) + 끄기
  const noteText = h("span", { class: "sound-note-text", role: "status" });
  const noteOff = h("button", { type: "button", class: "sound-note-off" });
  const note = h("div", { class: "sound-note", hidden: true }, noteText, noteOff);
  noteOff.addEventListener("click", () => {
    setSound({ sfx: false, music: false });
    hideNote();
  });
  box.append(panel, note);
  btn.setAttribute("aria-controls", "sound-panel");
  btn.setAttribute("aria-expanded", "false");

  function switchRow(key) {
    const label = h("span", { class: "sound-row-label" });
    const state = h("span", { class: "sound-sw-state", "aria-hidden": "true" });
    const sw = h("button", { type: "button", class: "sound-sw", role: "switch" }, h("span", { class: "sound-sw-knob", "aria-hidden": "true" }));
    sw.addEventListener("click", () => setSound({ [key]: !soundState()[key] }));
    const el = h("div", { class: "sound-row" }, label, state, sw);
    return {
      el,
      sw,
      draw(s) {
        const on = !!s[key];
        label.textContent = key === "sfx" ? t("효과음") : t("배경음악");
        state.textContent = on ? t("켬") : t("끔");
        sw.setAttribute("aria-checked", String(on));
        sw.setAttribute("aria-label", label.textContent);
      },
    };
  }

  function draw() {
    const s = soundState();
    const on = soundOn(s);
    btn.innerHTML = soundIcon(on, s.volume);
    const word = on ? t("소리: 켜짐") : t("소리: 꺼짐");
    btn.setAttribute("aria-label", word);
    btn.title = word;
    panel.setAttribute("aria-label", t("소리"));
    sfxSw.draw(s);
    if (musicSw) musicSw.draw(s);
    const pct = Math.round(s.volume * 100);
    volLabel.textContent = t("음량");
    volIn.setAttribute("aria-label", t("음량"));
    volIn.setAttribute("aria-valuetext", `${pct}%`);
    volIn.value = String(pct);
    volIn.style.setProperty("--v", `${pct}%`);
    volOut.textContent = `${pct}%`;
    // 소리가 다 꺼져도 음량은 움직일 수 있다(흐리게만)
    volRow.classList.toggle("dim", !on);
    noteOff.textContent = t("끄기");
    if (!note.hidden) noteText.textContent = t("소리 켜짐");
  }

  function setOpen(next, { focusBtn = false } = {}) {
    if (open === next) return;
    open = next;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) {
      hideNote();
      draw();
      sfxSw.sw.focus();
    } else if (focusBtn) btn.focus();
  }

  btn.addEventListener("click", () => setOpen(!open));
  // 바깥을 누르면 닫는다(칸 안·단추는 빼고)
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (open && !box.contains(e.target)) setOpen(false);
    },
    true,
  );
  document.addEventListener("focusin", (e) => {
    if (open && !box.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) setOpen(false, { focusBtn: box.contains(document.activeElement) });
  });
  window.addEventListener("hashchange", () => setOpen(false));

  // ── 처음 안내: 소리 설정을 손대지 않은 사람에게 첫 소리 때 한 번 ─────────────────
  function hideNote() {
    clearTimeout(noteTimer);
    note.hidden = true;
    noteText.textContent = "";
  }
  const untouched = () => setting("sound.sfx", null) === null && setting("sound.music", null) === null;
  if (!setting(NOTE_KEY, false) && untouched() && soundOn(soundState())) {
    onFirstSound(() => {
      if (setting(NOTE_KEY, false) || open || !untouched() || !soundOn(soundState())) return;
      setSetting(NOTE_KEY, true);
      note.hidden = false;
      // 꼬리가 스피커 가운데를 가리키게(단추 여백은 폭마다 다르다)
      const b = btn.getBoundingClientRect();
      const r = box.getBoundingClientRect();
      note.style.setProperty("--tail", `${Math.round(r.right - (b.left + b.width / 2))}px`);
      noteText.textContent = t("소리 켜짐");
      draw();
      noteTimer = setTimeout(hideNote, NOTE_MS);
    });
  }

  onSoundChange(() => draw());
  draw();
  return { draw };
}
