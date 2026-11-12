// 소리를 만드는 곳. index.js 가 소리를 켠 사람에게만 뒤늦게 불러온다(첫 화면 무게에 들지 않는다).
// 방향(사용자 11-11): 단추는 부드러운 톡, 손 내기는 책상 위 물건 소리(가위 싹둑, 바위 딱, 보 책장),
//   세기·공개·결과는 나무토막과 마림바와 손뼉. 나무 악기는 코드로 만들고, 물건 소리는 녹음(CC0, web/sound/)을 튼다.
// 소리 하나는 (k, out, at) 을 받아 at(초)부터 소리를 걸어 두고 끝나는 때를 돌려준다.
//   k: 그 AudioContext 의 재료(잡음, 녹음, 난수), out: 이을 곳
// AudioContext 와 OfflineAudioContext 에서 똑같이 돈다(점검할 때 오프라인으로 뽑아 크기를 잰다).
// 불러오기만 해서는 브라우저 기능을 건드리지 않는다(Node 테스트가 표와 순수 함수를 읽는다).

// ── 표 ─────────────────────────────────────
/** 녹음: 이름 → web/sound/ 의 파일. 출처는 web/sound/LICENSE */
export const SAMPLES = {
  snip: "snip.wav", // 가위: 전지가위 싹둑
  knock_1: "knock-1.wav", // 책상에 닿는 톡(셋)
  knock_2: "knock-2.wav",
  knock_3: "knock-3.wav",
  clack: "clack.wav", // 칩이 부딪는 딱
  flip: "flip.wav", // 책장 넘기기
  thud: "thud.wav", // 책을 내려놓는 쿵
  crumple: "crumple.wav", // 종이 구기기
};

/** 화면이 부르는 소리 이름. result(판 결과 값)와 match(승패 없는 경기 끝)는 아래 play 가 다른 이름으로 바꾼다 */
export const SOUNDS = ["tap", "throw", "count", "reveal", "win", "lose", "draw", "matchwin", "matchlose", "go", "right", "wrong"];

const KINDS = {
  scissors: ["hand-scissors", "scissors"],
  rock: ["hand-rock", "rock"],
  paper: ["hand-paper", "paper", "book"],
};
/** 손(도감의 손 객체나 그 id) → 내는 소리 갈래: 가위는 싹둑, 바위는 딱, 보(종이·책)는 책장, 나머지는 가볍게 톡 */
export function handKind(hand) {
  const keys = typeof hand === "string" ? [hand] : hand ? [hand.art, hand.id] : [];
  for (const [kind, list] of Object.entries(KINDS)) if (keys.some((x) => list.includes(x))) return kind;
  return "other";
}

const COUNT_HZ = [523, 587, 660, 740, 830];
/** 세는 소리의 높이: n 마디 가운데 i 번째(0부터). 몇 마디를 세든 마지막이 가장 높게 끝난다(셋이면 660 → 740 → 830) */
export function countHz(i, n) {
  const j = COUNT_HZ.length - n + i;
  return COUNT_HZ[Math.max(0, Math.min(COUNT_HZ.length - 1, j))];
}

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 음 이름("G#5")이나 Hz → Hz */
export function hz(n) {
  if (typeof n === "number") return n;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  if (!m) throw new Error("모르는 음: " + n);
  const midi = 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 음량(0~1) → 곱할 값. 귀에 고르게 들리도록 제곱한다 */
export const gainOf = (v) => Math.pow(Math.min(1, Math.max(0, v)), 2);

/** WAV(16비트 PCM) → { sampleRate, data: Float32Array }. 여러 채널이면 하나로 섞는다 */
export function parseWav(bytes) {
  const v = new DataView(bytes);
  const tag = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (v.byteLength < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("WAV 가 아니다");
  let fmt = null;
  let body = null;
  for (let o = 12; o + 8 <= v.byteLength; ) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    if (id === "fmt ") fmt = { format: v.getUint16(o + 8, true), channels: v.getUint16(o + 10, true), sampleRate: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
    else if (id === "data") body = { at: o + 8, size: Math.min(size, v.byteLength - o - 8) };
    o += 8 + size + (size & 1);
  }
  if (!fmt || !body || fmt.format !== 1 || fmt.bits !== 16 || fmt.channels < 1) throw new Error("16비트 PCM WAV 만 읽는다");
  const n = Math.floor(body.size / (2 * fmt.channels));
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c++) sum += v.getInt16(body.at + 2 * (i * fmt.channels + c), true);
    data[i] = sum / fmt.channels / 32768;
  }
  return { sampleRate: fmt.sampleRate, data };
}

// ── 녹음 받기(컨텍스트와 상관없이 한 번만) ──────────────
const PCM = new Map(); // 이름 → { sampleRate, data }
const asked = new Map(); // 이름 → Promise

/** 녹음 파일을 받아 둔다. AudioContext 가 없어도 된다(소리를 켜 둔 사람은 한가할 때 미리 받는다) */
export function preload(names = Object.keys(SAMPLES)) {
  return Promise.all(
    names.map((name) => {
      if (!asked.has(name)) {
        const p = fetch(new URL(`../../sound/${SAMPLES[name]}`, import.meta.url))
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${SAMPLES[name]}: ${r.status}`))))
          .then((bytes) => PCM.set(name, parseWav(bytes)));
        // 못 받았으면 그 소리만 빼고 낸다. 다음에 다시 받아 본다
        asked.set(name, p.catch(() => void asked.delete(name)));
      }
      return asked.get(name);
    }),
  );
}

// ── 재료(컨텍스트마다 한 번) ─────────────────────
const KITS = new WeakMap();
export function kitOf(ctx) {
  let k = KITS.get(ctx);
  if (k) return k;
  const sr = ctx.sampleRate;
  const len = sr * 2;
  let s = 0x2f6e2b1; // 늘 같은 잡음(잴 때마다 같은 값이 나오게)
  const white = ctx.createBuffer(1, len, sr);
  const w = white.getChannelData(0);
  for (let i = 0; i < len; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    w[i] = ((s >>> 0) / 4294967296) * 2 - 1;
  }
  // 누를 때마다 조금씩 다르게 하는 난수(같은 차례로 나온다)
  let a = 0x9e3779b9;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  k = { ctx, white, n: 0, bufs: new Map(), turn: {}, rnd };
  KITS.set(ctx, k);
  return k;
}

function bufOf(k, name) {
  let b = k.bufs.get(name);
  if (!b && PCM.has(name)) {
    const { sampleRate, data } = PCM.get(name);
    b = k.ctx.createBuffer(1, data.length, sampleRate);
    b.getChannelData(0).set(data);
    k.bufs.set(name, b);
  }
  return b || null;
}

// ── 바탕 소리: 음, 걸러 낸 잡음, 녹음 ────────────────
/** 크기 모양: a 초 동안 올라가 d 초 동안 사라진다(d 는 60dB 줄어드는 시간) */
function shape(p, at, vol, a, d) {
  p.setValueAtTime(0, at);
  p.linearRampToValueAtTime(vol, at + a);
  p.exponentialRampToValueAtTime(vol * 0.001, at + a + d);
  p.linearRampToValueAtTime(0, at + a + d + 0.005);
  return at + a + d + 0.006;
}
function tone(k, out, o) {
  const { ctx } = k;
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(hz(o.f), o.at);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(hz(o.to), o.at + (o.glide || 0.05));
  const g = ctx.createGain();
  const end = shape(g.gain, o.at, o.vol, o.a ?? 0.004, o.d ?? 0.1);
  osc.connect(g);
  g.connect(out);
  osc.start(o.at);
  osc.stop(end + 0.02);
  return end;
}
function hiss(k, out, o) {
  const { ctx } = k;
  const src = ctx.createBufferSource();
  src.buffer = k.white;
  src.loop = true;
  let node = src;
  for (const [type, f, q] of o.filters) {
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    if (q) fl.Q.value = q;
    node.connect(fl);
    node = fl;
  }
  const g = ctx.createGain();
  const end = shape(g.gain, o.at, o.vol, o.a ?? 0.001, o.d ?? 0.05);
  node.connect(g);
  g.connect(out);
  src.start(o.at, (k.n++ * 0.173) % 1.7);
  src.stop(end + 0.02);
  return end;
}
/** 녹음 하나를 튼다. rate 는 빠르기(음높이). 아직 못 받은 녹음이면 그 소리만 건너뛴다 */
function smp(k, out, o) {
  const buf = bufOf(k, o.s);
  if (!buf) return o.at;
  const rate = o.rate || 1;
  const src = k.ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = k.ctx.createGain();
  g.gain.value = o.vol;
  src.connect(g);
  g.connect(out);
  src.start(o.at);
  return o.at + buf.duration / rate;
}
// 녹음은 누를 때마다 빠르기를 조금(±pct%) 달리해 똑같이 되풀이되지 않게 한다. 같은 녹음을 잇달아 쓰지 않게 돌려 쓴다
const vary = (k, pct = 2.5) => 1 + ((k.rnd() - 0.5) * pct) / 50;
const turn = (k, key, list) => list[(k.turn[key] = ((k.turn[key] ?? -1) + 1) % list.length)];

// ── 악기 ────────────────────────────────────
const wood = {
  /** 나무토막 */
  block(k, out, at, f = 880, vol = 0.3, d = 0.11) {
    tone(k, out, { f: f * 2.76, at, vol: vol * 0.3, a: 0.001, d: d * 0.45 });
    hiss(k, out, { at, vol: vol * 0.5, a: 0.0005, d: 0.02, filters: [["bandpass", f * 1.6, 1.2]] });
    return tone(k, out, { f, at, vol, a: 0.001, d });
  },
  /** 손뼉. 걸러 낸 잡음은 같은 vol 이면 다른 소리보다 훨씬 작게 들려 안에서 2.6배 한다 */
  clap(k, out, at, vol = 0.3, tail = 0.16) {
    for (const [dt, v] of [[0, 0.7], [0.011, 0.8], [0.022, 0.9]])
      hiss(k, out, { at: at + dt, vol: vol * v * 2.6, a: 0.001, d: 0.018, filters: [["bandpass", 1300, 1.4], ["highpass", 600]] });
    return hiss(k, out, { at: at + 0.031, vol: vol * 2.6, a: 0.001, d: tail, filters: [["bandpass", 1150, 0.9], ["highpass", 500]] });
  },
  /** 마림바 */
  mallet(k, out, at, note, vol = 0.25, len = 0.5) {
    const f = hz(note);
    tone(k, out, { f: f * 4, at, vol: vol * 0.22, a: 0.001, d: len * 0.22 });
    if (f * 9.2 < 9000) tone(k, out, { f: f * 9.2, at, vol: vol * 0.06, a: 0.001, d: 0.05 });
    hiss(k, out, { at, vol: vol * 0.25, a: 0.0005, d: 0.015, filters: [["bandpass", Math.min(f * 3, 5000), 1]] });
    return tone(k, out, { f, at, vol, a: 0.002, d: len });
  },
};
/** 부드러운 톡: 음이 살짝 올라가는 짧은 소리 */
const pop = (k, out, at, f1, f2, vol = 0.22, d = 0.1) => tone(k, out, { f: f1, to: f2, glide: 0.05, at, vol, a: 0.004, d });

// ── 소리마다의 짜임 ─────────────────────────────
// 크기는 시안에서 맞춘 값 그대로다(가장 큰 0.1초의 A 가중 크기: 단추 −30, 손 내기 −27, 세기 −26, 공개 −21,
// 승리 −21.5, 패배 −25, 무승부 −27.5 dB). 경기 끝은 판 결과보다 조금 크고 길다(경기 승리 −20, 경기 패배 −24).
// 값을 바꾸면 귀로만 믿지 말고 오프라인으로 뽑아 다시 잰다.
export const RECIPES = {
  tap: (k, o, at) => pop(k, o, at, 480, 720, 0.2, 0.09),
  throw_scissors: (k, o, at) => smp(k, o, { s: "snip", at, vol: 0.35, rate: vary(k, 3) }),
  throw_rock(k, o, at) {
    const end = smp(k, o, { s: "clack", at, vol: 0.33, rate: vary(k) });
    return Math.max(end, smp(k, o, { s: "knock_2", at, vol: 0.75, rate: vary(k) }));
  },
  throw_paper: (k, o, at) => smp(k, o, { s: "flip", at, vol: 0.68, rate: vary(k, 3) }),
  // 가위·바위·보가 아닌 손: 책상에 가볍게 톡
  throw_other(k, o, at) {
    const [s, vol] = turn(k, "other", [["knock_1", 0.6], ["knock_3", 0.7]]);
    return smp(k, o, { s, at, vol, rate: vary(k, 4) });
  },
  // 세는 소리 한 마디: 나무토막
  count: (k, o, at, i = 2, n = 3) => wood.block(k, o, at, countHz(i, n), 0.28),
  // 공개: 책을 내려놓는 쿵에 손뼉과 나무토막
  reveal(k, o, at) {
    wood.block(k, o, at, 990, 0.2);
    const end = wood.clap(k, o, at, 0.3, 0.18);
    return Math.max(end, smp(k, o, { s: "thud", at, vol: 0.55 }));
  },
  win(k, o, at) {
    ["G4", "B4", "D5", "G5"].forEach((n, i) => wood.mallet(k, o, at + i * 0.07, n, 0.15, 0.35));
    wood.clap(k, o, at + 0.31, 0.08, 0.12);
    wood.mallet(k, o, at + 0.31, "B5", 0.13, 0.7);
    return wood.mallet(k, o, at + 0.31, "D6", 0.12, 0.7);
  },
  // 내려가는 마림바 가락에, 마지막 음에서 종이 구기는 소리
  lose(k, o, at) {
    wood.mallet(k, o, at, "E4", 0.24, 0.4);
    wood.mallet(k, o, at + 0.2, "C4", 0.24, 0.5);
    smp(k, o, { s: "crumple", at: at + 0.36, vol: 0.38, rate: vary(k, 3) });
    return wood.mallet(k, o, at + 0.4, "A3", 0.29, 0.8);
  },
  draw(k, o, at) {
    wood.block(k, o, at, 880, 0.21);
    return wood.block(k, o, at + 0.12, 880, 0.21);
  },
  // 경기 승리: 승리 가락을 올린 뒤 손뼉에 맞춰 세 번 딛고 올라가 길게 맺는다
  matchwin(k, o, at) {
    ["G4", "B4", "D5", "G5"].forEach((n, i) => wood.mallet(k, o, at + i * 0.07, n, 0.15, 0.35));
    const steps = [
      [0.31, ["B5", "D6"], 0.12, 0.5, 0.08],
      [0.52, ["C6", "E6"], 0.12, 0.5, 0.08],
      [0.73, ["B5", "D6", "G6"], 0.095, 1.1, 0.09],
    ];
    let end = at;
    for (const [dt, notes, vol, len, clap] of steps) {
      wood.clap(k, o, at + dt, clap, 0.12);
      for (const n of notes) end = wood.mallet(k, o, at + dt, n, vol, len);
    }
    wood.mallet(k, o, at + 0.73, "G3", 0.14, 1.1);
    smp(k, o, { s: "thud", at: at + 0.73, vol: 0.25 });
    return end;
  },
  // 경기 패배: 패배 가락을 한 음씩 천천히 내려가 낮게 맺는다
  matchlose(k, o, at) {
    ["E4", "D4", "C4"].forEach((n, i) => wood.mallet(k, o, at + i * 0.22, n, 0.24, 0.45));
    smp(k, o, { s: "crumple", at: at + 0.62, vol: 0.4, rate: vary(k, 3) });
    wood.mallet(k, o, at + 0.66, "A2", 0.22, 1.1);
    return wood.mallet(k, o, at + 0.66, "A3", 0.29, 1.1);
  },
  // 지금 누를 때(먼저 누르기 놀이): 나무토막이 빠르게 두 번 올라간다. 공개 소리와 같이 나면(after) 뒤의 것만 낸다
  go(k, o, at, after = false) {
    if (!after) wood.block(k, o, at, 990, 0.24);
    wood.clap(k, o, at + 0.09, 0.1, 0.1);
    return wood.block(k, o, at + 0.09, 1319, 0.26);
  },
  // 맞음(빠르게 잇달아 답하는 놀이): 높은 나무토막 한 번
  right: (k, o, at) => wood.block(k, o, at, 1175, 0.17, 0.09),
  // 틀림: 낮은 마림바 두 음이 반음으로 부딪힌다
  wrong(k, o, at) {
    wood.mallet(k, o, at, "E4", 0.2, 0.26);
    return wood.mallet(k, o, at, "F4", 0.2, 0.26);
  },
};

const JINGLES = ["win", "lose", "draw", "matchwin", "matchlose"];
const AFTER_REVEAL = 0.3; // 공개 소리 뒤 결과 가락까지
const AFTER_THROW = 0.18; // (세지 않을 때) 손 내는 소리 뒤 결과 가락까지
const WITH_THROW = 0.15; // 손 내는 소리와 이만큼 안에 겹치는 세는 소리는 내지 않는다
const AFTER_PICK = 0.07; // 손 내는 소리 뒤 맞음·틀림 소리까지

/**
 * 소리를 걸 때 지금보다 얼마나 뒤로 거는가(초). 오디오 시계는 장치가 한 번에 받아 가는 만큼(baseLatency)씩 뛴다.
 * 시계를 읽고 소리를 거는 사이에 한 번 뛰어도 소리 머리가 잘리지 않게 그보다 조금 길게 잡는다(0.01~0.03초)
 */
export const leadOf = (ctx) => Math.min(0.03, Math.max(0.01, (ctx.baseLatency || 0.012) + 0.006));

/**
 * 한 AudioContext 에 소리 길을 놓는다: 소리들 → 음량 → 누르개(겹쳐도 찢어지지 않게) → 스피커.
 * play(name, detail) 로 소리를 낸다. 소리를 걸었으면 true 를 돌려준다. 겹치는 차례는 여기서 정리한다:
 *   결과 가락은 공개 소리(나 손 내는 소리)가 지나간 뒤에 나온다.
 *   새 손, 새로 세기 시작, 공개, 새 가락이 오면 앞 가락은 거둔다. 다만 경기 끝 가락이 울리는 동안 판 가락은 내지 않는다.
 */
export function createEngine(ctx, { volume = 0.8 } = {}) {
  const k = kitOf(ctx);
  const master = ctx.createGain();
  master.gain.value = gainOf(volume);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 10;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  master.connect(comp);
  comp.connect(ctx.destination);
  const bus = () => {
    const g = ctx.createGain();
    g.connect(master);
    return g;
  };
  const fx = bus(); // 누르는 소리, 세는 소리, 공개
  let jingle = null; // 결과 가락 { bus, name, asked, end }
  const mark = { tap: -9, throw: -9, reveal: -9, count: -9, i: 0 };
  const lead = leadOf(ctx);
  // 데워 두기: 브라우저는 오실레이터·필터·녹음을 처음 쓸 때 준비에 몇 ms 를 쓴다.
  // 들리지 않게 한 번 걸어 두어 진짜 첫 소리가 제때 나게 한다
  const mute = bus();
  mute.gain.value = 0;
  for (const name of ["tap", "count", "reveal", "throw_rock"]) RECIPES[name](k, mute, ctx.currentTime + lead);

  /** 걸려 있는 결과 가락을 거둔다 */
  function cut() {
    if (!jingle) return;
    const b = jingle.bus;
    jingle = null;
    b.gain.setTargetAtTime(0, ctx.currentTime, 0.012);
    setTimeout(() => b.disconnect(), 200);
  }

  function play(name, detail) {
    const at = ctx.currentTime + lead;
    if (name === "result") name = detail > 0 ? "win" : detail < 0 ? "lose" : detail === 0 ? "draw" : "";
    if (name === "match") name = "draw";
    if (name === "tap") {
      if (at - mark.tap < 0.05) return false;
      mark.tap = at;
      RECIPES.tap(k, fx, at);
    } else if (name === "throw") {
      cut();
      // 녹음을 아직 못 받아 소리가 안 났으면 낸 것으로 치지 않는다(세는 소리가 첫 마디부터 난다)
      if (!(RECIPES["throw_" + handKind(detail)](k, fx, at) > at)) return false;
      mark.throw = at;
    } else if (name === "count") {
      const n = detail > 0 ? Math.round(detail) : 3;
      // 잇달아 오는 마디를 차례로 센다. 한참 쉬었거나 다 셌으면 처음부터
      if (at - mark.count > 0.9 || mark.i >= n) mark.i = 0;
      if (mark.i === 0) cut(); // 새 판이 시작됐다
      // 손을 내자마자 세기 시작하면 손 내는 소리가 그 마디를 대신한다(두 소리가 겹쳐 뭉개지지 않게)
      const sounds = at - mark.throw >= WITH_THROW;
      if (sounds) RECIPES.count(k, fx, at, mark.i, n);
      mark.i += 1;
      mark.count = at;
      return sounds;
    } else if (name === "reveal") {
      cut();
      mark.reveal = at;
      mark.i = 0;
      RECIPES.reveal(k, fx, at);
      if (JINGLES.includes(detail)) play(detail);
    } else if (name === "go") {
      // 방금 건 승패 가락 대신 이 소리를 낸다('막기!' 같은 글은 결과가 아니라 누르라는 신호다)
      cut();
      RECIPES.go(k, fx, at, at - mark.reveal < 0.06);
    } else if (name === "right" || name === "wrong") {
      RECIPES[name](k, fx, at - mark.throw < AFTER_PICK ? mark.throw + AFTER_PICK : at);
    } else if (JINGLES.includes(name)) {
      if (jingle) {
        // 같은 순간에 같은 가락은 한 번만
        if (jingle.name === name && at - jingle.asked < 0.08) return false;
        // 경기 끝 가락이 울리는 동안에는 판 가락을 내지 않는다
        if (!name.startsWith("match") && jingle.name.startsWith("match") && at < jingle.end) return false;
      }
      cut();
      const start = Math.max(at, at - mark.reveal < AFTER_REVEAL ? mark.reveal + AFTER_REVEAL : 0, at - mark.throw < AFTER_THROW ? mark.throw + AFTER_THROW : 0);
      const b = bus();
      const end = RECIPES[name](k, b, start);
      jingle = { bus: b, name, asked: at, end };
    } else return false;
    return true;
  }

  return {
    play,
    setVolume(v) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(gainOf(v), now + 0.015);
    },
    /** 다 끈다(이 뒤로는 쓰지 않는다) */
    stop() {
      jingle = null;
      master.disconnect();
    },
  };
}
