// node --test 로 돈다. 소리: 앞문(설정·판 결과 읽기), 표(손 → 소리, 녹음 파일), 짜임과 겹치는 차례, 배경음악(악보·연주·엔진).
// 귀로 듣는 것은 여기서 못 본다. 가짜 AudioContext 에 걸린 것(무엇을 언제 얼마나)만 본다.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sfx, soundState, setSound, onSoundChange, onFirstSound, HAS_MUSIC, roundTone } from "../web/js/sound/index.js";
import { SAMPLES, SFX_SAMPLES, MUSIC_SAMPLES, MUSIC_LEVEL, SOUNDS, RECIPES, handKind, countHz, hz, gainOf, leadOf, parseWav, preload, loadMusic, kitOf, createEngine } from "../web/js/sound/engine.js";
import { BPM, STEP, BAR, TRACKS, SCORE, FORM, ONCE_STEPS, LOOP_STEPS, PAGE_LEAD, eventsOf, eventsAt, schedule, createMusic } from "../web/js/sound/music.js";
import { CATALOG, findEntry } from "../web/js/data/catalog.js";
import { POOL } from "../web/js/data/custom.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOUND_DIR = join(ROOT, "web/sound");
const read = (file) => {
  const b = readFileSync(join(SOUND_DIR, file));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

// ── 가짜 AudioContext: 걸린 것을 적어 둔다 ─────────────
class Param {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }
  setValueAtTime(v, at) {
    assert.ok(Number.isFinite(v) && Number.isFinite(at) && at >= 0);
    this.events.push(["set", v, at]);
    return this;
  }
  linearRampToValueAtTime(v, at) {
    assert.ok(Number.isFinite(v) && Number.isFinite(at));
    this.events.push(["lin", v, at]);
    return this;
  }
  exponentialRampToValueAtTime(v, at) {
    assert.ok(v > 0 && Number.isFinite(at), "exponentialRamp 는 0 으로 못 간다(브라우저가 던진다)");
    this.events.push(["exp", v, at]);
    return this;
  }
  setTargetAtTime(v, at, c) {
    assert.ok(Number.isFinite(v) && Number.isFinite(at) && c > 0);
    this.events.push(["target", v, at]);
    return this;
  }
  cancelScheduledValues(at) {
    assert.ok(Number.isFinite(at));
    return this;
  }
}
class FakeNode {
  constructor(ctx, kind, params = {}) {
    this.kind = kind;
    this.to = [];
    this.off = false;
    Object.assign(this, params);
    ctx.made.push(this);
  }
  connect(node) {
    assert.ok(node instanceof FakeNode);
    this.to.push(node);
    return node;
  }
  disconnect() {
    this.off = true;
    this.to = [];
  }
  start(at, offset = 0) {
    assert.ok(Number.isFinite(at) && at >= 0 && offset >= 0);
    assert.equal(this.startAt, undefined, "한 번만 시작한다");
    this.startAt = at;
  }
  stop(at) {
    assert.ok(Number.isFinite(at) && at >= this.startAt);
    this.stopAt = at;
  }
}
function fakeContext() {
  // baseLatency 0.004 면 소리를 0.01초 뒤로 건다(아래에서 5.01 처럼 쓰는 값)
  const ctx = { sampleRate: 48000, currentTime: 0, baseLatency: 0.004, made: [] };
  ctx.destination = new FakeNode(ctx, "destination");
  ctx.createGain = () => new FakeNode(ctx, "gain", { gain: new Param(1) });
  ctx.createOscillator = () => new FakeNode(ctx, "osc", { frequency: new Param(440), detune: new Param(0), type: "sine" });
  ctx.createBufferSource = () => new FakeNode(ctx, "src", { playbackRate: new Param(1), buffer: null, loop: false });
  ctx.createBiquadFilter = () => new FakeNode(ctx, "filter", { frequency: new Param(350), Q: new Param(1), type: "lowpass" });
  ctx.createDynamicsCompressor = () =>
    new FakeNode(ctx, "comp", { threshold: new Param(-24), knee: new Param(30), ratio: new Param(12), attack: new Param(0.003), release: new Param(0.25) });
  ctx.createBuffer = (channels, length, sampleRate) => {
    assert.ok(channels === 1 && length > 0 && sampleRate >= 22050 && sampleRate <= 96000);
    const data = new Float32Array(length);
    return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
  };
  return ctx;
}
/** 그 뒤로 시작한 소리들(오실레이터와 버퍼) */
const started = (ctx, from = 0) => ctx.made.slice(from).filter((n) => n.startAt !== undefined);
const firstStart = (ctx, from = 0) => Math.min(...started(ctx, from).map((n) => n.startAt));
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
/** 소리 길의 음량 마디(누르개로 이어진 것)와, 거기에 바로 이어진 갈래들 */
const masterOf = (ctx) => ctx.made.find((n) => n.kind === "gain" && n.to.some((x) => x.kind === "comp"));
const busesOf = (ctx, from = 0) => ctx.made.slice(from).filter((n) => n.kind === "gain" && n.to.includes(masterOf(ctx)));
const faded = (bus) => bus.gain.events.some((e) => e[0] === "target" && e[1] === 0);

// ── 앞문 ────────────────────────────────────
test("앞문: 처음에는 둘 다 켜져 있고(B9), 첫 손짓 전에는 불러도 아무 일이 없다", () => {
  assert.deepEqual(soundState(), { sfx: true, music: true, volume: 0.8 });
  for (const name of [...SOUNDS, "result", "match", "없는 소리"]) assert.equal(sfx(name, 1), undefined);
});

test("앞문: 설정을 바꾸면 알리고, 음량은 0~1 로 자른다", () => {
  setSound({ sfx: false, music: false, volume: 0.8 }); // 꺼진 데서 시작
  const seen = [];
  const off = onSoundChange((s) => seen.push(s));
  setSound({ sfx: true });
  setSound({ sfx: true }); // 그대로면 알리지 않는다
  setSound({ volume: 3 });
  setSound({ volume: "소리" }); // 수가 아니면 그대로
  setSound({ volume: -1, music: true });
  assert.deepEqual(seen, [
    { sfx: true, music: false, volume: 0.8 },
    { sfx: true, music: false, volume: 1 },
    { sfx: true, music: true, volume: 0 },
  ]);
  off();
  setSound({ sfx: false, music: false, volume: 0.8 });
  assert.equal(seen.length, 3, "그만 들은 뒤에는 오지 않는다");
  assert.deepEqual(soundState(), { sfx: false, music: false, volume: 0.8 });
  // 돌려받은 값을 고쳐도 안쪽 설정은 그대로
  soundState().sfx = true;
  assert.equal(soundState().sfx, false);
});

test("앞문: 소리 단추가 쓰는 값(배경음악이 있는지, 첫 소리 알림)", () => {
  assert.equal(HAS_MUSIC, true, "배경음악이 들어 있다(소리 단추가 배경음악 줄을 보인다)");
  let called = 0;
  const off = onFirstSound(() => (called += 1));
  assert.equal(typeof off, "function");
  sfx("tap"); // 꺼져 있으니 소리가 나지 않고, 알림도 없다
  assert.equal(called, 0);
  off();
});

test("앞문은 가볍다: 엔진은 뒤늦게만 부른다", () => {
  const src = readFileSync(join(ROOT, "web/js/sound/index.js"), "utf8");
  assert.ok(statSync(join(ROOT, "web/js/sound/index.js")).size < 12000, "앞문은 첫 화면에 같이 실린다");
  assert.ok(src.includes('import("./engine.js")'));
  assert.ok(!/^import[^\n]*engine\.js/m.test(src), "engine.js 를 바로 import 하지 않는다");
  assert.ok(!src.includes("music.js\""), "곡은 엔진이 부른다");
  const statics = (text) => [...text.matchAll(/^import[^\n]*from\s+"([^"]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(statics(src), ["../ui/store.js"]);
  // 엔진도 곡(music.js)은 배경음악을 켠 사람에게만 뒤늦게 부른다. 곡은 엔진의 악기를 쓴다
  const engine = readFileSync(join(ROOT, "web/js/sound/engine.js"), "utf8");
  assert.deepEqual(statics(engine), []);
  assert.ok(engine.includes('import("./music.js")'));
  assert.deepEqual(statics(readFileSync(join(ROOT, "web/js/sound/music.js"), "utf8")), ["./engine.js"]);
});

test("온라인 판 결과: 둘이서는 내 쪽에서 본 승패", () => {
  const shown = (cmp) => ({ hands: [0, 1], cmp });
  assert.equal(roundTone({ shown: shown(1), you: 0 }), "win");
  assert.equal(roundTone({ shown: shown(1), you: 1 }), "lose");
  assert.equal(roundTone({ shown: shown(-1), you: 1 }), "win");
  assert.equal(roundTone({ shown: shown(0), you: 0 }), "draw");
  assert.equal(roundTone({ shown: shown(1), you: null }), "", "구경꾼은 결과 가락이 없다");
  assert.equal(roundTone({ shown: null, you: 0 }), "");
  assert.equal(roundTone(), "");
});

test("온라인 판 결과: 여럿이는 살아남기와 술래 정하기가 거꾸로", () => {
  const g = (out, hands = [0, 1, 2, null]) => ({ hands, win: 0, lose: null, out });
  // 살아남기: 빠지면 지고 남으면 이긴다
  assert.equal(roundTone({ shown: g([1, 2]), you: 0, group: true, mode: "survive" }), "win");
  assert.equal(roundTone({ shown: g([1, 2]), you: 1, group: true, mode: "survive" }), "lose");
  // 술래 정하기: 빠져나가면 이기고 남으면 진다
  assert.equal(roundTone({ shown: g([0]), you: 0, group: true, mode: "loser" }), "win");
  assert.equal(roundTone({ shown: g([0]), you: 1, group: true, mode: "loser" }), "lose");
  // 아무도 안 빠짐: 다시
  assert.equal(roundTone({ shown: g([]), you: 0, group: true, mode: "survive" }), "draw");
  // 이미 빠져서 이번 판에 내지 않은 사람, 구경꾼
  assert.equal(roundTone({ shown: g([1]), you: 3, group: true, mode: "survive" }), "");
  assert.equal(roundTone({ shown: g([1]), you: null, group: true, mode: "survive" }), "");
});

// ── 표 ─────────────────────────────────────
test("손 → 소리 갈래: 가위·바위·보는 제 소리, 나머지는 톡", () => {
  const classic = findEntry("classic").hands;
  assert.deepEqual(classic.map(handKind), ["scissors", "rock", "paper"]);
  assert.equal(handKind("scissors"), "scissors");
  assert.equal(handKind({ id: "muk", art: "hand-rock" }), "rock");
  assert.equal(handKind({ id: "paper" }), "paper");
  assert.equal(handKind({ id: "book" }), "paper");
  assert.equal(handKind({ id: "dragon" }), "other");
  assert.equal(handKind(null), "other");
  assert.equal(handKind(undefined), "other");
  // 도감과 직접 만들기의 모든 손이 넷 가운데 하나로 가고, 그 소리의 짜임이 있다
  const hands = [...CATALOG.flatMap((e) => e.hands || []), ...POOL];
  assert.ok(hands.length > 200);
  for (const hd of hands) assert.equal(typeof RECIPES["throw_" + handKind(hd)], "function", hd.id);
  // 가위·바위·보 손 모양 그림을 쓰는 손은 이름이 달라도 그 소리가 난다
  for (const hd of hands) if (/^hand-(scissors|rock|paper)$/.test(hd.art || "")) assert.equal(handKind(hd), hd.art.slice(5));
});

test("세는 소리: 몇 마디를 세든 올라가서 같은 높이로 끝난다", () => {
  assert.deepEqual([0, 1, 2].map((i) => countHz(i, 3)), [660, 740, 830]);
  assert.deepEqual([0, 1, 2, 3].map((i) => countHz(i, 4)), [587, 660, 740, 830]);
  for (let n = 1; n <= 8; n++) {
    const f = Array.from({ length: n }, (_, i) => countHz(i, n));
    assert.equal(f[n - 1], 830);
    for (let i = 1; i < n; i++) assert.ok(f[i] >= f[i - 1]);
  }
});

test("음 이름과 음량", () => {
  assert.equal(hz("A4"), 440);
  assert.ok(near(hz("C4"), 261.6256, 1e-3));
  assert.ok(near(hz("F#5"), 739.9888, 1e-3));
  assert.ok(near(hz("Bb3"), hz("A#3")));
  assert.equal(hz(990), 990);
  assert.throws(() => hz("H2"));
  assert.equal(gainOf(0), 0);
  assert.equal(gainOf(1), 1);
  assert.ok(near(gainOf(0.8), 0.64));
  assert.equal(gainOf(7), 1);
  assert.equal(gainOf(-1), 0);
});

test("녹음 파일: 표에 있는 것이 모두 있고, 표에 없는 것은 없다", () => {
  const files = Object.values(SAMPLES);
  assert.equal(new Set(files).size, files.length);
  assert.deepEqual(readdirSync(SOUND_DIR).sort(), ["LICENSE", ...files].sort());
  let total = 0;
  for (const [name, file] of Object.entries(SAMPLES)) {
    const wav = parseWav(read(file));
    total += statSync(join(SOUND_DIR, file)).size;
    assert.ok([24000, 32000].includes(wav.sampleRate), `${file}: ${wav.sampleRate} Hz`);
    const sec = wav.data.length / wav.sampleRate;
    assert.ok(sec > 0.04 && sec < 1, `${name}: ${sec}초`);
    const peak = wav.data.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    assert.ok(peak > 0.3 && peak <= 1, `${name}: 최고 ${peak}`);
    // 딸깍 소리 없이 시작하고 끝난다
    assert.ok(Math.abs(wav.data[0]) < 0.05 && Math.abs(wav.data[wav.data.length - 1]) < 0.05, `${name}: 양 끝`);
  }
  assert.ok(total < 200_000, `녹음은 모두 합쳐 200KB 아래로: ${total}`);
  // 효과음 것과 배경음악 것으로 나뉜다(켜 둔 쪽 것만 받는다). 어디에도 안 쓰는 녹음은 없다
  assert.deepEqual([...new Set([...SFX_SAMPLES, ...MUSIC_SAMPLES])].sort(), Object.keys(SAMPLES).sort());
  assert.equal(new Set(SFX_SAMPLES).size, SFX_SAMPLES.length);
  assert.equal(new Set(MUSIC_SAMPLES).size, MUSIC_SAMPLES.length);
});

test("녹음 출처: 파일마다 LICENSE 에 적혀 있고 모두 CC0", () => {
  const text = readFileSync(join(SOUND_DIR, "LICENSE"), "utf8");
  for (const file of Object.values(SAMPLES)) assert.ok(text.includes(file), `${file} 의 출처가 없다`);
  assert.ok(text.includes("CC0"));
  assert.ok(text.includes("https://creativecommons.org/publicdomain/zero/1.0/"));
  // 줄마다 어디서 왔는지(주소)가 있다
  const rows = text.split("\n").filter((line) => /\.wav\b/.test(line));
  assert.equal(rows.length, Object.keys(SAMPLES).length);
});

test("WAV 읽기: 16비트 PCM 만, 두 채널은 섞는다", () => {
  const make = ({ format = 1, channels = 1, bits = 16, samples = [0, 16384, -32768, 32767] } = {}) => {
    const n = samples.length;
    const v = new DataView(new ArrayBuffer(44 + n * 2));
    const put = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    put(0, "RIFF");
    v.setUint32(4, 36 + n * 2, true);
    put(8, "WAVE");
    put(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, format, true);
    v.setUint16(22, channels, true);
    v.setUint32(24, 32000, true);
    v.setUint32(28, 32000 * channels * 2, true);
    v.setUint16(32, channels * 2, true);
    v.setUint16(34, bits, true);
    put(36, "data");
    v.setUint32(40, n * 2, true);
    samples.forEach((s, i) => v.setInt16(44 + 2 * i, s, true));
    return v.buffer;
  };
  const mono = parseWav(make());
  assert.equal(mono.sampleRate, 32000);
  assert.deepEqual([...mono.data], [0, 0.5, -1, 32767 / 32768]);
  const stereo = parseWav(make({ channels: 2 }));
  assert.deepEqual([...stereo.data], [0.25, (-32768 + 32767) / 2 / 32768]);
  assert.throws(() => parseWav(make({ format: 3 })));
  assert.throws(() => parseWav(make({ bits: 8 })));
  assert.throws(() => parseWav(new ArrayBuffer(10)));
  assert.throws(() => parseWav(new TextEncoder().encode("x".repeat(64)).buffer));
});

// ── 짜임과 엔진 ───────────────────────────────
test("짜임: 녹음을 아직 못 받았어도 나머지 소리는 난다", () => {
  const ctx = fakeContext();
  const k = kitOf(ctx);
  for (const [name, recipe] of Object.entries(RECIPES)) {
    const from = ctx.made.length;
    const end = recipe(k, ctx.destination, 1);
    assert.ok(Number.isFinite(end) && end >= 1, name);
    // 녹음만으로 된 소리(손 내기)는 조용히 건너뛴다
    if (name.startsWith("throw_")) assert.equal(started(ctx, from).length, 0, name);
    else assert.ok(started(ctx, from).length > 0, name);
  }
});

test("엔진: 녹음을 못 받아 손 내는 소리가 안 났으면 세는 소리가 첫 마디부터 난다", () => {
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  ctx.currentTime = 1;
  let from = ctx.made.length;
  engine.play("throw", "rock");
  assert.equal(started(ctx, from).length, 0);
  engine.play("count", 3);
  assert.ok(started(ctx, from).length > 0);
  // 결과 가락도 기다리지 않고 바로
  ctx.currentTime = 2;
  engine.play("throw", "paper");
  from = ctx.made.length;
  engine.play("win");
  assert.ok(near(firstStart(ctx, from), 2.01));
});

/** 브라우저의 fetch 대신 파일을 읽게 해 두고 fn 을 돈다. 엔진이 찾은 주소들을 돌려준다 */
async function withFiles(fn) {
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    const b = readFileSync(fileURLToPath(url));
    return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
  };
  try {
    await fn(asked);
  } finally {
    globalThis.fetch = real;
  }
  return asked;
}
/** 걸어 둔 약속(곡 받기)이 풀릴 틈을 준다 */
const settle = () => new Promise((ok) => setTimeout(ok, 0));

test("짜임: 녹음을 받은 뒤에는 모든 소리가 제때 시작하고 끝난다", async () => {
  // 엔진이 찾는 주소가 web/sound/ 를 가리키는지도 같이 본다
  const asked = await withFiles(async (seen) => {
    await preload();
    await preload(); // 두 번 불러도 한 번만 받는다
    assert.equal(seen.length, SFX_SAMPLES.length, "배경음악만 쓰는 녹음은 아직 받지 않는다");
    // 배경음악을 켠 사람은 곡과 함께 나머지 녹음을 받는다(효과음과 같이 쓰는 것은 다시 받지 않는다)
    const music = await loadMusic();
    assert.equal(typeof music.createMusic, "function");
    await loadMusic();
  });
  assert.equal(asked.length, Object.keys(SAMPLES).length);
  assert.equal(new Set(asked).size, asked.length);
  assert.ok(asked.every((u) => u.includes("/web/sound/")));

  const ctx = fakeContext();
  const k = kitOf(ctx);
  for (const [name, recipe] of Object.entries(RECIPES)) {
    const from = ctx.made.length;
    const end = recipe(k, ctx.destination, 1);
    const nodes = started(ctx, from);
    assert.ok(nodes.length > 0, name);
    assert.ok(end > 1 && end < 1 + 2.2, `${name}: ${end - 1}초`);
    for (const n of nodes) assert.ok(n.startAt >= 1 && n.startAt < end, `${name}: 시작 ${n.startAt}`);
    // 모든 소리는 끝이 있다(오실레이터와 잡음은 멈추는 때가 있고, 녹음은 한 번 틀고 끝난다)
    for (const n of nodes) assert.ok(n.stopAt !== undefined || (n.kind === "src" && !n.loop), `${name}: 멈추지 않는 소리`);
    // 크기는 0 보다 크고 1 을 넘지 않는다
    for (const g of ctx.made.slice(from).filter((n) => n.kind === "gain"))
      for (const [, v] of g.gain.events) assert.ok(v >= 0 && v <= 1, `${name}: 크기 ${v}`);
  }
  // 가위·바위·보는 서로 다른 녹음을 튼다
  const sample = (name) => {
    const from = ctx.made.length;
    RECIPES[name](k, ctx.destination, 1);
    return ctx.made.slice(from).filter((n) => n.kind === "src").map((n) => n.buffer.length).join("+");
  };
  const kinds = ["throw_scissors", "throw_rock", "throw_paper", "throw_other"].map(sample);
  assert.equal(new Set(kinds).size, 4);
  // 나머지 손은 두 녹음을 번갈아 튼다
  assert.notEqual(sample("throw_other"), sample("throw_other"));
});

test("엔진: 소리 길은 음량 → 누르개 → 스피커, 음량은 제곱으로", () => {
  const ctx = fakeContext();
  const engine = createEngine(ctx, { volume: 0.5 });
  const master = masterOf(ctx);
  assert.equal(master.gain.value, 0.25);
  assert.ok(ctx.made.find((n) => n.kind === "comp").to.includes(ctx.destination));
  engine.setVolume(1);
  assert.deepEqual(master.gain.events.at(-1).slice(0, 2), ["lin", 1]);
  engine.stop();
  assert.equal(master.off, true);
});

test("엔진: 소리는 장치가 한 번에 받아 가는 만큼보다 조금 뒤로 건다", () => {
  assert.equal(leadOf({ baseLatency: 0.004 }), 0.01);
  assert.ok(near(leadOf({ baseLatency: 0.01 }), 0.016));
  assert.ok(near(leadOf({}), 0.018), "모르면 넉넉히");
  assert.equal(leadOf({ baseLatency: 0.1 }), 0.03, "아무리 커도 0.03초");
  const ctx = fakeContext();
  ctx.baseLatency = 0.02;
  const engine = createEngine(ctx);
  ctx.currentTime = 2;
  const from = ctx.made.length;
  engine.play("tap");
  assert.ok(near(firstStart(ctx, from), 2.026));
});

test("엔진: 아는 이름은 모두 소리가 나고, 모르는 이름은 조용히 넘어간다", () => {
  for (const name of [...SOUNDS, "result", "match"]) {
    const ctx = fakeContext();
    const engine = createEngine(ctx);
    const from = ctx.made.length;
    engine.play(name, name === "throw" ? "rock" : name === "result" ? -1 : undefined);
    assert.ok(started(ctx, from).length > 0, name);
  }
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  const from = ctx.made.length;
  for (const name of ["", "없는 소리", "result", "throw_rock", "bgm"]) engine.play(name);
  assert.equal(started(ctx, from).length, 0);
});

test("엔진: 셋을 세면 660 → 740 → 830, 다 세면 처음부터", () => {
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  const base = () => {
    const from = ctx.made.length;
    engine.play("count", 3);
    ctx.currentTime += 0.2;
    // 나무토막의 가장 낮은 음
    return Math.min(...ctx.made.slice(from).filter((n) => n.kind === "osc").map((n) => n.frequency.events[0][1]));
  };
  assert.deepEqual([base(), base(), base(), base()], [660, 740, 830, 660]);
  // 세다 말고 한참 뒤에 다시 세면 처음부터
  ctx.currentTime += 2;
  assert.equal(base(), 660);
  // 공개한 뒤에도 처음부터
  base();
  engine.play("reveal");
  assert.equal(base(), 660);
});

test("엔진: 손을 내자마자 세기 시작하면 손 내는 소리가 첫 마디를 대신한다", () => {
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  const tick = () => {
    const from = ctx.made.length;
    engine.play("count", 3);
    const f = ctx.made.slice(from).filter((n) => n.kind === "osc").map((n) => n.frequency.events[0][1]);
    return f.length ? Math.min(...f) : null;
  };
  ctx.currentTime = 1;
  engine.play("throw", "scissors");
  assert.equal(tick(), null, "첫 마디는 손 내는 소리가 대신한다");
  ctx.currentTime = 1.2;
  assert.equal(tick(), 740, "둘째 마디부터는 제 높이로 이어진다");
  ctx.currentTime = 1.4;
  assert.equal(tick(), 830);
  // 손을 낸 지 좀 지나서 세기 시작하면(온라인에서 상대가 늦게 냄) 첫 마디부터 난다
  ctx.currentTime = 5;
  engine.play("throw", "rock");
  ctx.currentTime = 5.4;
  assert.equal(tick(), 660);
});

test("엔진: 결과 가락은 공개 소리 0.3초 뒤, 세지 않을 때는 손 내는 소리 0.18초 뒤", () => {
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  ctx.currentTime = 5;
  engine.play("reveal");
  let from = ctx.made.length;
  engine.play("win");
  assert.ok(near(firstStart(ctx, from), 5.01 + 0.3));
  // 공개에 결과를 같이 주면 한 번에
  ctx.currentTime = 10;
  from = ctx.made.length;
  engine.play("reveal", "lose");
  const starts = started(ctx, from).map((n) => n.startAt);
  assert.ok(near(Math.min(...starts), 10.01));
  assert.ok(starts.some((s) => near(s, 10.31)), "패배 가락의 첫 음");
  // 외치기 건너뛰기: 손 내는 소리 바로 뒤
  ctx.currentTime = 20;
  engine.play("throw", "paper");
  from = ctx.made.length;
  engine.play("result", 0);
  assert.ok(near(firstStart(ctx, from), 20.01 + 0.18));
  // 아무것도 없었으면 바로
  ctx.currentTime = 30;
  from = ctx.made.length;
  engine.play("lose");
  assert.ok(near(firstStart(ctx, from), 30.01));
});

test("엔진: 새 가락이나 새 손이 오면 앞 가락을 거둔다", () => {
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  const cut = () => busesOf(ctx).filter(faded).length;
  ctx.currentTime = 1;
  engine.play("win");
  assert.equal(cut(), 0);
  ctx.currentTime = 1.4;
  engine.play("throw", "rock");
  assert.equal(cut(), 1, "손을 내면 앞 판의 가락은 거둔다");
  ctx.currentTime = 2;
  engine.play("lose");
  ctx.currentTime = 2.3;
  engine.play("win");
  assert.equal(cut(), 2, "새 가락이 오면 앞 가락은 거둔다");
  // 단추 소리는 가락을 거두지 않는다
  engine.play("tap");
  assert.equal(cut(), 2);
  // 새로 세기 시작하면(새 판) 거둔다. 이어서 세는 마디는 그대로 둔다
  ctx.currentTime = 2.6;
  engine.play("count", 3);
  assert.equal(cut(), 3, "세기 시작하면 앞 판의 가락은 거둔다");
  engine.play("lose");
  ctx.currentTime = 2.8;
  engine.play("count", 3);
  assert.equal(cut(), 3, "둘째 마디는 가락을 거두지 않는다");
  // 공개도 거둔다
  ctx.currentTime = 3;
  engine.play("reveal");
  assert.equal(cut(), 4);
});

test("엔진: 같은 순간의 경기 끝 가락은 판 가락을 대신한다", () => {
  for (const order of [["win", "matchwin"], ["matchwin", "win"]]) {
    const ctx = fakeContext();
    const engine = createEngine(ctx);
    ctx.currentTime = 3;
    engine.play("reveal");
    const from = ctx.made.length;
    for (const name of order) engine.play(name);
    const live = busesOf(ctx, from).filter((b) => !faded(b));
    assert.equal(live.length, 1, order.join(" → "));
    // 살아 있는 가락은 경기 끝 가락(1.5초보다 길다)
    const last = Math.max(...started(ctx, from).filter((n) => chain(n).includes(live[0])).map((n) => n.stopAt ?? 0));
    assert.ok(last > 3.31 + 1.5, order.join(" → "));
  }
  // 같은 가락을 같은 순간에 두 번 부르면 한 번만
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  engine.play("lose");
  const n = ctx.made.length;
  engine.play("lose");
  assert.equal(ctx.made.length, n);
});

test("엔진: 경기 끝 가락이 울리는 동안에는 판 가락을 내지 않는다", () => {
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  ctx.currentTime = 1;
  assert.equal(engine.play("matchwin"), true);
  let from = ctx.made.length;
  // 놀이가 끝난 뒤 화면이 승패 글을 한 번 더 쓸 때(글리코의 '꼭대기!')
  ctx.currentTime = 1.6;
  assert.equal(engine.play("win"), false);
  assert.equal(engine.play("lose"), false);
  assert.equal(engine.play("draw"), false);
  assert.equal(started(ctx, from).length, 0);
  assert.equal(busesOf(ctx).filter(faded).length, 0, "경기 끝 가락은 그대로 울린다");
  // 다른 경기 끝 가락은 바꿔 낸다
  assert.equal(engine.play("matchlose"), true);
  assert.equal(busesOf(ctx).filter(faded).length, 1);
  // 새 손을 내면 거두고, 그 뒤의 판 가락은 난다
  ctx.currentTime = 2;
  engine.play("throw", "rock");
  assert.equal(busesOf(ctx).filter(faded).length, 2);
  assert.equal(engine.play("win"), true);
  // 다 울린 뒤에는 판 가락이 난다
  const quiet = fakeContext();
  const e2 = createEngine(quiet);
  e2.play("matchlose");
  quiet.currentTime = 4;
  from = quiet.made.length;
  assert.equal(e2.play("draw"), true);
  assert.ok(started(quiet, from).length > 0);
});

test("엔진: 누르라는 신호(go)는 방금 건 승패 가락을 대신한다", () => {
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  const blocks = (from) => ctx.made.slice(from).filter((n) => n.kind === "osc" && [990, 1319].includes(n.frequency.events[0][1])).map((n) => n.frequency.events[0][1]);
  // 외치기가 끝나 공개 소리가 난 바로 그때: 화면이 '막기!'(lose)를 쓰고 go 를 부른다
  ctx.currentTime = 1;
  engine.play("reveal");
  engine.play("lose");
  let from = ctx.made.length;
  assert.equal(engine.play("go"), true);
  assert.equal(busesOf(ctx).filter(faded).length, 1, "승패 가락은 거둔다");
  assert.deepEqual(blocks(from), [1319], "공개 소리가 앞 소리를 대신한다");
  assert.ok(near(firstStart(ctx, from), 1.01 + 0.09));
  // 공개 소리 없이 부르면 두 번 다 낸다
  ctx.currentTime = 5;
  from = ctx.made.length;
  engine.play("go");
  assert.deepEqual(blocks(from).sort(), [1319, 990].sort());
});

test("엔진: 맞음·틀림은 손 내는 소리 바로 뒤에 붙는다", () => {
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  ctx.currentTime = 1;
  engine.play("throw", "paper");
  let from = ctx.made.length;
  assert.equal(engine.play("right"), true);
  assert.ok(near(firstStart(ctx, from), 1.01 + 0.07));
  ctx.currentTime = 3;
  from = ctx.made.length;
  assert.equal(engine.play("wrong"), true);
  assert.ok(near(firstStart(ctx, from), 3.01));
  // 맞음·틀림은 가락이 아니다: 울리던 가락을 거두지 않는다
  engine.play("win");
  engine.play("right");
  assert.equal(busesOf(ctx).filter(faded).length, 0);
});

test("엔진: 소리를 걸었는지 돌려준다", () => {
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  assert.equal(engine.play("tap"), true);
  assert.equal(engine.play("tap"), false, "몰린 단추 소리");
  assert.equal(engine.play("없는 소리"), false);
  assert.equal(engine.play("result"), false, "값이 없는 판 결과");
  assert.equal(engine.play("result", 1), true);
  assert.equal(engine.play("win"), false, "같은 순간의 같은 가락");
  ctx.currentTime = 5;
  assert.equal(engine.play("throw", "rock"), true);
  assert.equal(engine.play("count", 3), false, "손 내는 소리가 대신한 마디");
  ctx.currentTime = 5.2;
  assert.equal(engine.play("count", 3), true);
  assert.equal(engine.play("reveal", "draw"), true);
});

test("엔진: 단추 소리는 한꺼번에 몰려도 한 번만", () => {
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  const from = ctx.made.length;
  engine.play("tap");
  engine.play("tap");
  ctx.currentTime += 0.02;
  engine.play("tap");
  assert.equal(started(ctx, from).length, 1);
  ctx.currentTime += 0.1;
  engine.play("tap");
  assert.equal(started(ctx, from).length, 2);
});

/** 소리 하나에서 스피커 쪽으로 이어진 마디들 */
function chain(node) {
  const seen = [];
  for (let at = node; at && at.to.length; at = at.to[0]) seen.push(at.to[0]);
  return seen;
}

// ── 배경음악 ──────────────────────────────────
const NOTE_RE = /^([A-G]#?)(\d)$/;
const SCALE = ["G", "A", "B", "C", "D", "E", "F#"];
const CHORDS = { G: ["G", "B", "D"], Em: ["E", "G", "B"], C: ["C", "E", "G"], D: ["D", "F#", "A"], D7: ["D", "F#", "A", "C"] };
const PARTS = [...FORM.once, ...FORM.loop];
const midi = (n) => Math.round(69 + 12 * Math.log2(hz(n) / 440));
const nameOf = (n) => NOTE_RE.exec(n)[1];
/** 그 칸의 화음("C|D" 는 마디의 앞 절반과 뒤 절반) */
const chordAt = (chords, step) => {
  const [a, b] = chords[Math.floor(step / BAR)].split("|");
  return CHORDS[b && step % BAR >= BAR / 2 ? b : a];
};

test("배경음악: 여는 네 마디 뒤에 스물여덟 마디를 되풀이한다(1분에 100박, 한 바퀴 67초)", () => {
  assert.equal(BPM, 100);
  assert.ok(near(STEP, 0.3));
  assert.deepEqual(FORM, { once: ["intro"], loop: ["a", "b", "a2", "rest"] });
  assert.deepEqual(Object.keys(SCORE).sort(), [...PARTS].sort(), "안 쓰는 대목은 없다");
  assert.deepEqual(PARTS.map((name) => SCORE[name].chords.length), [4, 8, 8, 8, 4]);
  assert.equal(ONCE_STEPS, 4 * BAR);
  assert.equal(LOOP_STEPS, 28 * BAR);
  assert.ok(near(LOOP_STEPS * STEP, 67.2));
  for (const name of PARTS) {
    const part = SCORE[name];
    for (const ch of part.chords) for (const c of ch.split("|")) assert.ok(CHORDS[c], `${name}: 화음 ${ch}`);
    for (const track of TRACKS) assert.equal(part[track].length, part.chords.length, `${name}.${track}: 마디 수`);
  }
  // 여는 대목이 지나면 되풀이 대목만 돈다
  for (const i of [0, 5, LOOP_STEPS - 1]) assert.equal(eventsAt(ONCE_STEPS + LOOP_STEPS + i), eventsAt(ONCE_STEPS + i));
  assert.equal(eventsAt(ONCE_STEPS + 3 * LOOP_STEPS), eventsAt(ONCE_STEPS));
  assert.notEqual(eventsAt(ONCE_STEPS + LOOP_STEPS), eventsAt(0));
});

test("배경음악 악보: 모든 음이 사장조 안에 있고, 줄마다 제 음역을 지킨다", () => {
  const RANGE = { lead: ["D5", "E6"], comp: ["D4", "C5"], bass: ["E2", "F#3"] };
  for (const name of PARTS) {
    const steps = SCORE[name].chords.length * BAR;
    for (const track of ["lead", "comp", "bass"]) {
      for (const e of eventsOf(track, SCORE[name][track])) {
        assert.match(e.note, NOTE_RE, `${name}.${track}`);
        assert.ok(SCALE.includes(nameOf(e.note)), `${name}.${track}: 조 밖의 음 ${e.note}`);
        assert.ok(midi(e.note) >= midi(RANGE[track][0]) && midi(e.note) <= midi(RANGE[track][1]), `${name}.${track}: 음역 밖 ${e.note}`);
        assert.ok(e.len >= 1 && e.step + e.len <= steps && e.cell === e.step % BAR, `${name}.${track}: ${e.note} 의 길이`);
      }
    }
    // 리듬 줄: t 쿵, k 톡, c 손뼉, s 싹둑, p 책장
    for (const e of eventsOf("beat", SCORE[name].beat)) assert.ok(["t", "k", "c", "s", "p"].includes(e.note) && e.len === 1, `${name}.beat: ${e.note}`);
  }
  // 가락은 반주보다 늘 위에 있다(두 줄이 같은 음에서 뭉개지지 않는다)
  assert.ok(midi(RANGE.lead[0]) > midi(RANGE.comp[1]) && midi(RANGE.comp[0]) > midi(RANGE.bass[1]));
  assert.throws(() => eventsOf("lead", ["B5 - D6"]), "한 마디는 여덟 칸");
  assert.deepEqual(eventsOf("lead", ["."]), [], "점 하나는 한 마디 쉼");
  // "-" 는 앞 음을 늘인다(마디를 넘어서도)
  assert.deepEqual(eventsOf("lead", ["G5 - . A5 - - . B5", "- - . . . . . ."]).map((e) => [e.note, e.step, e.len]), [["G5", 0, 2], ["A5", 3, 3], ["B5", 7, 3]]);
});

test("배경음악 악보: 반주와 베이스는 그 마디의 화음을 짚고, 가락은 센박에서 화음에 선다", () => {
  for (const name of PARTS) {
    const { chords } = SCORE[name];
    const fits = (e) => chordAt(chords, e.step).includes(nameOf(e.note));
    for (const e of eventsOf("comp", SCORE[name].comp)) assert.ok(fits(e), `${name}: 반주 ${e.note} (${e.step}칸)`);
    const bass = eventsOf("bass", SCORE[name].bass);
    bass.forEach((e, i) => {
      if (e.cell === 0) assert.equal(nameOf(e.note), chordAt(chords, e.step)[0], `${name}: 마디 첫 박의 베이스는 밑음`);
      if (fits(e)) return;
      // 화음 밖의 음은 한 걸음 올라가 화음에 닿는 지나가는 음뿐이다(레 · 미 파# → 솔)
      const next = bass[i + 1];
      assert.ok(next && [1, 2].includes(midi(next.note) - midi(e.note)) && fits(next), `${name}: 베이스 ${e.note}`);
    });
    const lead = eventsOf("lead", SCORE[name].lead);
    lead.forEach((e, i) => {
      if (e.cell % (BAR / 2) !== 0 || fits(e)) return;
      // 센박의 화음 밖 음은 바로 아래 화음음으로 풀린다(앞꾸밈음)
      const next = lead[i + 1];
      assert.ok(next && [1, 2].includes(midi(e.note) - midi(next.note)) && fits(next), `${name}: 센박의 ${e.note} (${e.step}칸)`);
    });
    // 가락은 한 옥타브 넘게 뛰지 않는다
    for (let i = 1; i < lead.length; i++) assert.ok(Math.abs(midi(lead[i].note) - midi(lead[i - 1].note)) <= 9, `${name}: ${lead[i - 1].note} → ${lead[i].note}`);
  }
});

test("배경음악 악보: 첫머리는 사용자가 고른 시안 ⑦의 네 마디 그대로다", () => {
  const SIAN = {
    lead: ["B5 - D6 B5 . A5 G5 -", "B5 - G5 E5 - - G5 -", "G5 - C6 G5 . E5 G5 -", "A5 - F#5 D5 . F#5 A5 -"],
    comp: ["D4 G4 B4 G4 D4 G4 B4 G4", "E4 G4 B4 G4 E4 G4 B4 G4", "E4 G4 C5 G4 E4 G4 C5 G4", "D4 F#4 A4 F#4 D4 F#4 A4 F#4"],
    bass: ["G2 . . G2 . . D3 .", "E2 . . E2 . . B2 .", "C3 . . C3 . . G2 .", "D3 . . D3 . . A2 ."],
    beat: ["t k c k t k c s", "t k c k . t c k", "t k c k t k c s"],
  };
  for (const name of ["a", "a2"]) for (const [track, bars] of Object.entries(SIAN)) assert.deepEqual(SCORE[name][track].slice(0, bars.length), bars, `${name}.${track}`);
  // 첫머리 앞에는 늘 솔 라로 들어간다(여는 대목, 나, 쉬어 가는 마디의 끝). 그 마디의 끝은 책장을 넘긴다
  for (const name of ["intro", "b", "rest"]) {
    const steps = SCORE[name].chords.length * BAR;
    assert.deepEqual(eventsOf("lead", SCORE[name].lead).slice(-2).map((e) => [e.note, e.step, e.len]), [["G5", steps - 2, 1], ["A5", steps - 1, 1]], name);
    assert.deepEqual(eventsOf("beat", SCORE[name].beat).at(-1).note, "p", name);
  }
  // 가′ 는 으뜸음에서 맺고, 쉬어 가는 마디에서는 가락이 (들어가는 두 음 말고는) 쉰다
  assert.equal(eventsOf("lead", SCORE.a2.lead).at(-1).note, "G5");
  assert.equal(eventsOf("lead", SCORE.rest.lead).length, 2);
  // 한 바퀴의 끝과 처음이 이어진다: 끝 마디는 딸림화음, 첫 마디는 으뜸화음
  assert.equal(SCORE[FORM.loop.at(-1)].chords.at(-1), "D");
  assert.equal(SCORE[FORM.loop[0]].chords[0], "G");
});

test("배경음악 연주: 칸마다 제때 걸리고 끝이 있으며, 크기는 1 을 넘지 않는다", async () => {
  await withFiles(() => loadMusic());
  const ctx = fakeContext();
  const k = kitOf(ctx);
  const T0 = 2;
  for (let pos = 0; pos < ONCE_STEPS + LOOP_STEPS; pos++) {
    const from = ctx.made.length;
    schedule(k, ctx.destination, T0, pos, pos + 1);
    const events = eventsAt(pos);
    const nodes = started(ctx, from);
    assert.ok(nodes.length >= events.length, `${pos}칸: 울릴 것 ${events.length}개에 소리 ${nodes.length}개`);
    if (!events.length) continue;
    // 박에서 ±6ms 안(사람 손맛)에 시작한다. 손뼉은 0.03초에 걸쳐 치고, 책장 넘기는 소리만 0.241초 당겨 튼다
    const at = T0 + pos * STEP;
    const early = events.some((e) => e.note === "p") ? PAGE_LEAD + 0.0061 : 0.0061;
    for (const n of nodes) {
      assert.ok(n.startAt >= at - early && n.startAt <= at + 0.04, `${pos}칸: ${n.startAt - at}`);
      assert.ok(n.stopAt !== undefined || (n.kind === "src" && !n.loop), `${pos}칸: 멈추지 않는 소리`);
    }
    for (const g of ctx.made.slice(from).filter((n) => n.kind === "gain")) {
      assert.ok(g.gain.value > 0 && g.gain.value <= 1);
      for (const [, v] of g.gain.events) assert.ok(v >= 0 && v <= 1, `${pos}칸: 크기 ${v}`);
    }
  }
  // 책장 넘기는 소리는 넘어가는 소리가 박에 오게 당겨 튼다
  const page = parseWav(read(SAMPLES.page));
  let peak = 0;
  page.data.forEach((v, i) => {
    if (Math.abs(v) > Math.abs(page.data[peak])) peak = i;
  });
  assert.ok(Math.abs(peak / page.sampleRate - PAGE_LEAD) < 0.01, `page.wav 의 가장 큰 곳 ${peak / page.sampleRate}초`);
});

test("배경음악 연주: 1초 앞까지만 미리 걸고, 같은 칸을 두 번 걸지 않으며, 밀린 칸은 버린다", () => {
  const ctx = fakeContext();
  const player = createMusic(ctx, kitOf(ctx), ctx.createGain());
  ctx.currentTime = 10;
  const from = ctx.made.length;
  // 여는 첫 마디는 반주만 있다: 칸마다 마림바 한 음(오실레이터 셋)이 박에 딱 맞게 걸린다
  const cells = (since = from) => started(ctx, since).filter((n) => n.kind === "osc").map((n) => Math.round(((n.startAt - 10.12) / STEP) * 1e6) / 1e6);
  try {
    player.tick(); // 시작하기 전에는 아무것도 걸지 않는다
    assert.equal(ctx.made.length, from);
    player.start();
    assert.deepEqual(cells(), [0, 0, 0, 1, 1, 1, 2, 2, 2], "첫 음은 0.12초 뒤, 1초 앞까지");
    assert.equal(player.pos, 3);
    player.tick(); // 시계가 그대로면 더 걸지 않는다
    assert.equal(cells().length, 9);
    ctx.currentTime = 10.45;
    player.tick();
    assert.deepEqual(cells().slice(9), [3, 3, 3, 4, 4, 4]);
    for (ctx.currentTime = 10.5; ctx.currentTime < 12.2; ctx.currentTime += 0.11) player.tick();
    assert.deepEqual([...new Set(cells())], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "빠진 칸도 겹친 칸도 없다");
    assert.equal(cells().length, 33);
    // 화면이 3초 멈췄다 돌아왔다: 밀린 칸(11~22)은 버리고 박자 그대로 이어 간다
    const before = ctx.made.length;
    ctx.currentTime = 16.8;
    player.tick();
    const late = started(ctx, before);
    assert.ok(late.length > 0);
    for (const n of late) assert.ok(n.startAt >= 16.8 + 0.02, `늦은 소리 ${n.startAt}`);
    assert.equal(Math.min(...cells(before)), 23);
    assert.equal(player.pos, 26);
    // 그만
    player.stop();
    const n = ctx.made.length;
    ctx.currentTime = 30;
    player.tick();
    assert.equal(ctx.made.length, n);
    // 다시 켜면 처음부터
    player.start();
    assert.equal(player.pos, 3);
    assert.ok(near(Math.min(...started(ctx, n).map((x) => x.startAt)), 30.12));
  } finally {
    player.stop();
  }
});

test("엔진: 배경음악을 켜면 곡을 받아 처음부터 틀고, 끄면 줄이며 멈춘다", async () => {
  await withFiles(() => loadMusic());
  const ctx = fakeContext();
  let heard = 0;
  const engine = createEngine(ctx, { onMusic: () => (heard += 1) });
  const master = masterOf(ctx);
  const outs = () => ctx.made.filter((n) => n.kind === "gain" && n.gain.value === MUSIC_LEVEL);
  try {
    ctx.currentTime = 3;
    const from = ctx.made.length;
    engine.setMusic(true);
    engine.setMusic(true);
    assert.equal(started(ctx, from).length, 0, "곡을 받은 뒤에 시작한다");
    await settle();
    assert.equal(heard, 1, "시작할 때 한 번 알린다");
    // 길: 곡 → 배경음악 크기 → 가락 때 낮추는 마디 → 음량
    assert.equal(outs().length, 1);
    const [out] = outs();
    const duck = out.to[0];
    assert.ok(duck.kind === "gain" && duck.gain.value === 1 && duck.to.includes(master));
    const notes = started(ctx, from);
    assert.ok(near(Math.min(...notes.map((n) => n.startAt)), 3.12));
    for (const n of notes) assert.ok(chain(n).includes(out) && chain(n).includes(duck));
    // 효과음은 그 길로 가지 않는다
    let at = ctx.made.length;
    engine.play("tap");
    engine.play("win");
    for (const n of started(ctx, at)) assert.ok(!chain(n).includes(duck) && chain(n).includes(master));
    // 켠 채로 다시 부르면 밀린 박을 채운다(탭이 숨었다 돌아왔을 때)
    ctx.currentTime = 4;
    at = ctx.made.length;
    engine.setMusic(true);
    assert.ok(started(ctx, at).length > 0);
    assert.equal(heard, 1);
    // 끄면 그 길을 줄여 미리 걸어 둔 음까지 사그라들게 하고, 더 걸지 않는다
    engine.setMusic(false);
    assert.ok(faded(out));
    ctx.currentTime = 9;
    at = ctx.made.length;
    engine.setMusic(false);
    await settle();
    assert.equal(started(ctx, at).length, 0);
    // 다시 켜면 새 길로 처음부터
    engine.setMusic(true);
    await settle();
    assert.equal(heard, 2);
    assert.equal(outs().length, 2);
    assert.ok(near(Math.min(...started(ctx, at).map((n) => n.startAt)), 9.12));
    assert.ok(!faded(outs()[1]));
    // 엔진을 놓으면 곡도 멈춘다
    engine.stop();
    ctx.currentTime = 20;
    at = ctx.made.length;
    engine.setMusic(true);
    await settle();
    assert.equal(ctx.made.length, at);
  } finally {
    engine.stop();
  }
  // 켜자마자 끄면 시작하지 않는다
  const ctx2 = fakeContext();
  let heard2 = 0;
  const engine2 = createEngine(ctx2, { onMusic: () => (heard2 += 1) });
  const at2 = ctx2.made.length;
  engine2.setMusic(true);
  engine2.setMusic(false);
  await settle();
  engine2.setMusic(true);
  engine2.stop();
  await settle();
  assert.equal(heard2, 0);
  assert.equal(started(ctx2, at2).length, 0);
});

test("엔진: 결과 가락이 울리는 동안 배경음악을 낮췄다가 되돌린다", async () => {
  await withFiles(() => loadMusic());
  const ctx = fakeContext();
  const engine = createEngine(ctx);
  try {
    engine.setMusic(true);
    await settle();
    const duck = ctx.made.find((n) => n.kind === "gain" && n.gain.value === MUSIC_LEVEL).to[0];
    const since = (n) => duck.gain.events.slice(n);
    ctx.currentTime = 5;
    let n = duck.gain.events.length;
    engine.play("win");
    let ev = since(n);
    assert.deepEqual(ev.map((e) => e.slice(0, 2)), [["target", 0.5], ["target", 1]]);
    assert.ok(near(ev[0][2], 5), "가락과 같이 낮춘다");
    assert.ok(ev[1][2] > 5.6 && ev[1][2] < 6.1, `가락이 사그라들 때 되돌린다: ${ev[1][2]}`);
    // 새 손을 내면 가락을 거두면서 배경음악도 바로 되돌린다
    ctx.currentTime = 5.3;
    n = duck.gain.events.length;
    engine.play("throw", "rock");
    ev = since(n);
    assert.deepEqual(ev.map((e) => e.slice(0, 2)), [["target", 1]]);
    assert.ok(near(ev[0][2], 5.3));
    // 세는 소리, 공개, 단추 소리에는 낮추지 않는다
    ctx.currentTime = 6;
    n = duck.gain.events.length;
    engine.play("count", 3);
    engine.play("reveal");
    engine.play("tap");
    engine.play("go");
    assert.equal(duck.gain.events.length, n);
    // 공개와 같이 온 가락은 가락이 시작할 때(공개 0.3초 뒤)에 맞춰 낮춘다
    ctx.currentTime = 7;
    n = duck.gain.events.length;
    engine.play("reveal", "lose");
    ev = since(n);
    assert.deepEqual(ev.map((e) => e.slice(0, 2)), [["target", 0.5], ["target", 1]]);
    assert.ok(near(ev[0][2], 7.01 + 0.3 - 0.03));
    // 짧은 무승부 소리에도 잠깐은 낮춘다
    ctx.currentTime = 9;
    n = duck.gain.events.length;
    engine.play("draw");
    ev = since(n);
    assert.deepEqual(ev.map((e) => e.slice(0, 2)), [["target", 1], ["target", 0.5], ["target", 1]], "앞 가락을 거두고 새로 낮춘다");
    assert.ok(ev[2][2] - ev[1][2] >= 0.1 - 1e-9);
  } finally {
    engine.stop();
  }
});

