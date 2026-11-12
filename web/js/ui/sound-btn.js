// 머리글 소리 단추(디자인 11-12 최종 ③ 누르면 펼치는 칸, 사용자 결정 컨셉 11-12 09:31).
// 누르면 단추 아래에 칸이 펼쳐진다: 효과음 스위치 → 배경음악 스위치(배경음악이 들어 있을 때만) → 음량.
// 칸 안에서 바꿔도 닫히지 않고, 바깥을 누르거나 Esc·화면을 옮기면 닫힌다.
// 아이콘: 소리가 하나라도 켜져 있으면 물결(음량 50% 아래면 한 줄, 0 이면 없음), 다 꺼지면 사선.
// 처음 온 사람(소리 설정을 손대지 않은 사람)에게는 첫 소리가 날 때 단추 아래에 한 번만 '소리 켜짐 · 끄기'(6초 뒤 닫힘).
// 소리 설정은 sound/index.js 가 갖고 있다. 여기서는 그것을 보이고 바꾸기만 한다.

import { h } from "./dom.js";
import { t } from "../i18n.js";
import { setting, setSetting } from "./store.js";
import { soundState, setSound, onSoundChange, onFirstSound, HAS_MUSIC } from "../sound/index.js";

const NOTE_KEY = "soundNote"; // 처음 안내를 보였는가(이 브라우저에서 한 번)
const NOTE_MS = 6000;

const SPEAKER = '<path d="M3.5 9.2h3.6l5.2-4.2v14l-5.2-4.2H3.5z" stroke-linejoin="round"/>';
const WAVE1 = '<path d="M15.6 9.2a4 4 0 0 1 0 5.6"/>';
const WAVE2 = '<path d="M18.4 6.4a8 8 0 0 1 0 11.2"/>';
const SLASH = '<path d="M3.5 3.5l17 17"/>';

/** 아이콘 svg 글. on: 소리가 하나라도 켜짐, volume: 0~1 */
export function soundIcon(on, volume) {
  const waves = !on || volume <= 0 ? "" : volume < 0.5 ? WAVE1 : WAVE1 + WAVE2;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">${SPEAKER}${on ? waves : SLASH}</svg>`;
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
  const volOut = h("output", { class: "sound-vol-out" });
  const volLabel = h("span", { class: "sound-row-label" });
  const volRow = h("label", { class: "sound-row sound-vol-row" }, volLabel, volIn, volOut);
  volIn.addEventListener("input", () => setSound({ volume: Number(volIn.value) / 100 }));
  const panel = h("div", { class: "sound-panel", id: "sound-panel", role: "group", hidden: true }, sfxSw.el, musicSw ? musicSw.el : null, volRow);
  // 처음 안내
  const noteText = h("span", {});
  const noteOff = h("button", { type: "button", class: "sound-note-off" });
  const note = h("div", { class: "sound-note", role: "status", hidden: true }, noteText, noteOff);
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
    const word = t("소리: {s}", { s: on ? t("켬") : t("끔") });
    btn.setAttribute("aria-label", word);
    btn.title = word;
    btn.classList.toggle("off", !on);
    panel.setAttribute("aria-label", t("소리"));
    sfxSw.draw(s);
    if (musicSw) musicSw.draw(s);
    volLabel.textContent = t("음량");
    volIn.setAttribute("aria-label", t("음량"));
    volIn.value = String(Math.round(s.volume * 100));
    volOut.textContent = `${Math.round(s.volume * 100)}%`;
    // 소리가 다 꺼져도 음량은 움직일 수 있다(흐리게만)
    volRow.classList.toggle("dim", !on);
    noteText.textContent = t("소리 켜짐");
    noteOff.textContent = t("끄기");
  }

  function setOpen(next, { focusBtn = false } = {}) {
    if (open === next) return;
    open = next;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.classList.toggle("on", open);
    if (open) {
      hideNote();
      draw();
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
  }
  const untouched = () => setting("sound.sfx", null) === null && setting("sound.music", null) === null;
  if (!setting(NOTE_KEY, false) && untouched() && soundOn(soundState())) {
    onFirstSound(() => {
      if (setting(NOTE_KEY, false) || open || !soundOn(soundState())) return;
      setSetting(NOTE_KEY, true);
      draw();
      note.hidden = false;
      noteTimer = setTimeout(hideNote, NOTE_MS);
    });
  }

  onSoundChange(() => draw());
  draw();
  return { draw };
}
