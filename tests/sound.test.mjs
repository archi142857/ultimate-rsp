// node --test 로 돈다. 소리: 앞문(설정·판 결과 읽기), 표(손 → 소리, 녹음 파일), 짜임과 겹치는 차례.
// 귀로 듣는 것은 여기서 못 본다. 가짜 AudioContext 에 걸린 것(무엇을 언제 얼마나)만 본다.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sfx, soundState, setSound, onSoundChange, onFirstSound, HAS_MUSIC, roundTone } from "../web/js/sound/index.js";
import { SAMPLES, SOUNDS, RECIPES, handKind, countHz, hz, gainOf, leadOf, parseWav, preload, kitOf, createEngine } from "../web/js/sound/engine.js";
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
  assert.equal(HAS_MUSIC, false, "배경음악을 넣으면 참으로 바꾼다");
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
  assert.deepEqual([...src.matchAll(/^import[^\n]*from\s+"([^"]+)"/gm)].map((m) => m[1]), ["../ui/store.js"]);
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

test("짜임: 녹음을 받은 뒤에는 모든 소리가 제때 시작하고 끝난다", async () => {
  // 브라우저의 fetch 대신 파일을 읽는다(엔진이 찾는 주소가 web/sound/ 를 가리키는지도 같이 본다)
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    const b = readFileSync(fileURLToPath(url));
    return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
  };
  try {
    await preload();
    await preload(); // 두 번 불러도 한 번만 받는다
  } finally {
    globalThis.fetch = real;
  }
  assert.equal(asked.length, Object.keys(SAMPLES).length);
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
