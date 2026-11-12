// 소리의 앞문. 화면은 여기만 부른다: sfx("win") 처럼 한 줄.
//   sfx("throw", 손)  손을 냈을 때(손에 따라 가위 싹둑, 바위 딱, 보 책장, 나머지 톡)
//   sfx("count", n)   셋을 셀 때 한 마디마다(n 은 세는 마디 수)
//   sfx("reveal")     손을 공개할 때. sfx("reveal", "win") 처럼 그 판 결과를 같이 주면 뒤이어 결과 가락을 낸다
//   sfx("win") · sfx("lose") · sfx("draw") · sfx("result", cmp)   판 결과(cmp 는 1, 0, −1)
//   sfx("matchwin") · sfx("matchlose") · sfx("match")            경기 끝(match 는 승패가 없을 때)
//   sfx("go")         지금 눌러야 할 때(먼저 누르기 놀이). 방금 건 승패 가락 대신 이 소리가 난다
//   sfx("right") · sfx("wrong")   빠르게 잇달아 답하는 놀이에서 맞음과 틀림
//   단추와 링크를 누르는 소리(tap)는 여기서 알아서 낸다. 제 소리를 낸 단추는 겹쳐 내지 않는다.
// 소리는 화면에 이미 보이는 것을 한 번 더 알릴 뿐이다(소리로만 전하는 것은 없다).
// 배경음악은 설정(music)이 켜져 있으면 첫 손짓 뒤에 저절로 흐른다. 화면이 부를 것은 없다.
// 가볍게 둔다: 소리를 만드는 engine.js, 곡(music.js), 녹음은 그것을 켠 사람에게만 뒤늦게 받는다.
// AudioContext 는 첫 손짓 뒤에 만든다(브라우저가 그 전에는 소리를 막는다). 다 끄면 엔진도 오디오 장치도 놓는다.

import { setting, setSetting } from "../ui/store.js";

// 처음 온 사람의 값(B9, 사용자 11-12 09:31): 효과음·배경음악 둘 다 켬. 머리글 소리 단추(ui/sound-btn.js)로 끈다.
const DEFAULTS = { sfx: true, music: true, volume: 0.8 };
const KEYS = { sfx: "sound.sfx", music: "sound.music", volume: "sound.vol" };

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

function read() {
  const v = Number(setting(KEYS.volume, DEFAULTS.volume));
  return {
    sfx: setting(KEYS.sfx, DEFAULTS.sfx) === true,
    music: setting(KEYS.music, DEFAULTS.music) === true,
    volume: Number.isFinite(v) ? clamp01(v) : DEFAULTS.volume,
  };
}

let state = read();
const listeners = new Set();
const firsts = new Set(); // 첫 소리를 기다리는 것들
let sounded = false; // 이 쪽에서 소리가 한 번이라도 났는가
let ctx = null; // AudioContext
let engine = null; // engine.js 의 createEngine(ctx)
let loading = null; // import("./engine.js")
let claimed = false; // 지금 누른 단추가 제 소리를 냈는가
let tapping = false; // 지금 누른 것이 단추 소리를 낼 단추인가
let previewed = 0;
const queue = []; // 엔진이 준비되기 전에 부른 소리. 잠깐만 기다려 준다(늦은 소리는 없느니만 못하다)
const WAIT_MS = 250;

const wanted = () => state.sfx || state.music;
const ready = () => !!engine && ctx.state === "running";

/** 지금 설정: { sfx: 효과음 켬, music: 배경음악 켬, volume: 0~1 } */
export function soundState() {
  return { ...state };
}

/**
 * 설정을 바꾼다: setSound({ sfx: true }), setSound({ volume: 0.5 }). 이 브라우저에 남고 바로 반영된다.
 * 켜는 것은 누른 그 자리(click 같은 손짓 안)에서 불러야 브라우저가 소리를 허락한다.
 */
export function setSound(patch = {}) {
  const next = { ...state };
  if ("sfx" in patch) next.sfx = !!patch.sfx;
  if ("music" in patch) next.music = !!patch.music;
  if ("volume" in patch && Number.isFinite(Number(patch.volume))) next.volume = clamp01(Number(patch.volume));
  for (const key of Object.keys(KEYS)) if (next[key] !== state[key]) setSetting(KEYS[key], next[key]);
  const moved = next.volume !== state.volume;
  apply(next, true);
  // 음량을 바꾸면 바뀐 크기로 한 번 들려준다(이 누름의 단추 소리는 이것으로 대신한다)
  if (moved && state.sfx && now() - previewed > 150) {
    previewed = now();
    claimed = true;
    setTimeout(() => sfx("tap"), 40);
  }
}

/** 설정이 바뀔 때마다 fn(soundState()) 를 부른다. 돌려주는 함수를 부르면 그만 듣는다 */
export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 배경음악이 들어 있는가(소리 단추는 이 값이 참일 때 배경음악 줄을 보인다) */
export const HAS_MUSIC = true;

/**
 * 이 쪽에서 첫 소리(효과음이든 배경음악이든)가 날 때 fn() 을 한 번 부른다(처음 온 사람에게 '소리 켜짐'을 알릴 때 쓴다).
 * 이미 소리가 났으면 곧바로 부른다. 돌려주는 함수를 부르면 그만 기다린다
 */
export function onFirstSound(fn) {
  if (sounded) Promise.resolve().then(fn);
  else firsts.add(fn);
  return () => firsts.delete(fn);
}

function apply(next, byHand) {
  const changed = Object.keys(KEYS).some((key) => next[key] !== state[key]);
  state = next;
  if (!wanted()) rest();
  else if (byHand) wake();
  if (engine) {
    engine.setVolume(state.volume);
    if (ready()) engine.setMusic(state.music);
    if (changed) load().catch(() => {}); // 새로 켠 쪽의 녹음을 받는다
  }
  if (changed) for (const fn of [...listeners]) fn(soundState());
}

/** 소리를 낸다. 꺼져 있거나 아직 손짓이 없었으면 아무 일도 하지 않는다. 소리 때문에 화면이 멈추는 일은 없게 한다 */
export function sfx(name, detail) {
  claimed = true;
  if (!state.sfx || !ctx || (typeof document !== "undefined" && document.hidden)) return;
  if (ready()) return void play(name, detail);
  queue.push({ name, detail, at: now() });
  if (queue.length > 6) queue.shift();
}

function play(name, detail) {
  try {
    if (engine.play(name, detail)) heard();
  } catch (e) {
    console.error(e);
  }
}

/** 소리가 났다: 첫 소리를 기다리던 것들을 부른다. 지금 누름이 끝난 뒤에 부른다(손을 뗄 때 화면이 바뀌면 그 click 이 사라진다) */
function heard() {
  if (sounded) return;
  sounded = true;
  const waiting = [...firsts];
  firsts.clear();
  setTimeout(() => waiting.forEach((fn) => fn()), 0);
}

/** 오디오가 돌기 시작했다: 배경음악을 맞추고, 기다리던 소리를 낸다 */
function flush() {
  if (!ready()) return;
  engine.setMusic(state.music);
  const t0 = now();
  // 기다린 것 가운데 아직 늦지 않은 것만, 같은 소리는 마지막 것 하나만 낸다. 이미 공개했으면 세는 소리는 버린다
  const fresh = new Map();
  for (const q of queue.splice(0)) if (t0 - q.at < WAIT_MS) fresh.set(q.name, q);
  if (fresh.has("reveal")) fresh.delete("count");
  if (state.sfx) for (const q of fresh.values()) play(q.name, q.detail);
}

/** 엔진과, 켜 둔 쪽의 녹음·곡을 받아 둔다 */
function load() {
  if (!loading) {
    loading = import("./engine.js");
    loading.catch(() => (loading = null)); // 못 받았으면 다음 손짓에 다시
  }
  return loading.then((m) => {
    if (state.sfx) m.preload();
    if (state.music) m.loadMusic().catch(() => {});
    return m;
  });
}

/** 손짓 안에서 부른다: 오디오를 열고 엔진을 받는다 */
function wake() {
  if (!wanted() || typeof window === "undefined") return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) {
    try {
      ctx = new AC({ latencyHint: "interactive" });
    } catch {
      return;
    }
    ctx.onstatechange = flush;
  }
  if (ctx.state !== "running") Promise.resolve(ctx.resume()).catch(() => {});
  if (engine) return;
  const mine = ctx;
  load()
    .then((m) => {
      if (ctx !== mine || engine || !wanted()) return;
      engine = m.createEngine(ctx, { volume: state.volume, onMusic: heard });
      flush();
    })
    .catch(() => {});
}

/** 다 껐다: 엔진과 오디오 장치를 놓는다 */
function rest() {
  queue.length = 0;
  if (engine) engine.stop();
  engine = null;
  if (ctx) {
    const old = ctx;
    ctx = null;
    old.onstatechange = null;
    Promise.resolve()
      .then(() => old.close())
      .catch(() => {});
  }
}

/**
 * 온라인 방에서 방금 공개한 판이 나에게 어땠는지: "win" | "lose" | "draw" | ""(구경꾼이거나 이번 판에 내지 않음).
 * shown 은 room.js 의 공개할 판 꼴({ hands, cmp } 또는 여럿이의 { hands, out }), you 는 내 자리 번호(구경꾼은 null).
 */
export function roundTone({ shown, you, group = false, mode = "" } = {}) {
  if (!shown || !Number.isInteger(you)) return "";
  if (!group) {
    const cmp = you === 1 ? -shown.cmp : shown.cmp;
    return cmp > 0 ? "win" : cmp < 0 ? "lose" : "draw";
  }
  const hand = shown.hands ? shown.hands[you] : null;
  if (hand === null || hand === undefined) return "";
  const out = Array.isArray(shown.out) ? shown.out : [];
  if (!out.length) return "draw"; // 아무도 안 빠짐: 다시
  // 살아남기에서는 빠지면 지고, 술래 정하기에서는 빠져나가면 이긴다
  return (mode === "loser") === out.includes(you) ? "win" : "lose";
}

// ── 브라우저에서만: 손짓, 단추 소리, 탭 숨김, 다른 탭에서 바꾼 설정 ──────────
const TAPPABLE = 'button, a[href], summary, input[type="checkbox"], input[type="radio"], [role="button"], [role="tab"], [role="switch"]';

if (typeof window !== "undefined" && typeof document !== "undefined") {
  // 주소로도 켜고 끈다: ?sound=1·0(효과음), ?music=1·0(배경음악). 이 브라우저에 남기고, 주소에서는 바로 지운다(남에게 건넨 주소가 그 사람 소리를 바꾸지 않게)
  try {
    const url = new URL(location.href);
    let seen = false;
    for (const [name, key] of [["sound", KEYS.sfx], ["music", KEYS.music]]) {
      const q = url.searchParams.get(name);
      if (q === null) continue;
      const v = /^(1|on|true)$/i.test(q) ? true : /^(0|off|false)$/i.test(q) ? false : null;
      if (v !== null) setSetting(key, v);
      url.searchParams.delete(name);
      seen = true;
    }
    if (seen) {
      state = read();
      history.replaceState(history.state, "", url);
    }
  } catch {
    /* 주소를 못 읽어도 그대로 간다 */
  }

  // 오디오는 브라우저가 손짓으로 쳐 주는 때에만 연다(손가락을 뗄 때와 누름. 그 전에 열면 막히고 경고가 뜬다)
  for (const ev of ["pointerup", "touchend"]) window.addEventListener(ev, wake, { capture: true, passive: true });
  // 단추·링크를 누르는 소리. 누를 수 있는 단추였는지는 누르는 순간에 본다(누르자마자 스스로 잠기는 단추가 있다).
  // 그 단추가 제 소리(손 내기 같은)를 냈으면 겹쳐 내지 않는다
  window.addEventListener(
    "click",
    (e) => {
      claimed = false;
      wake();
      const el = e.target instanceof Element ? e.target.closest(TAPPABLE) : null;
      tapping = !!el && !el.disabled && el.getAttribute("aria-disabled") !== "true";
    },
    true,
  );
  document.addEventListener("click", () => {
    if (tapping && !claimed && state.sfx) sfx("tap");
    tapping = false;
  });

  // 안 보이는 탭에서는 소리를 내지 않고 오디오도 쉬게 한다
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    queue.length = 0;
    Promise.resolve(document.hidden ? ctx.suspend() : wanted() ? ctx.resume() : null).catch(() => {});
  });

  // 다른 탭에서 바꾼 설정을 따라간다
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key.startsWith("ursp.set.sound.")) apply(read(), false);
  });

  // 소리를 켜 둔 사람은 한가할 때 엔진과 녹음(과 곡)을 미리 받아 둔다(첫 소리가 늦지 않게)
  if (wanted()) (window.requestIdleCallback || ((fn) => setTimeout(fn, 1200)))(() => wanted() && load().catch(() => {}));
}
