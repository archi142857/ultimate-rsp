// 배경음악: 악보와 연주. engine.js 가 배경음악을 켠 사람에게만 뒤늦게 불러온다(첫 화면 무게에 들지 않는다).
// 방향(사용자 11-11, 시안 ⑦ 나무 책상): 마림바 세 줄(가락·반주·베이스)에 책상 위 물건으로 치는 리듬.
// 사장조, 1분에 100박. 시안에서 들은 네 마디(G–Em–C–D)를 첫머리로 삼아 한 곡으로 키웠다:
//   여는 네 마디(한 번) → [가 여덟 마디 → 나 여덟 마디 → 가′ 여덟 마디 → 쉬어 가는 네 마디] 를 되풀이(한 바퀴 67초).
// 악보는 한 마디를 글 한 줄로 적는다. 한 칸이 8분음표 하나, "." 은 쉼, "-" 는 앞 음을 이어 간다. "." 하나면 한 마디를 쉰다.
// 리듬 줄의 글자: t 책 덮는 쿵, k 책상 톡, c 손뼉, s 가위 싹둑, p 책장 넘기기.
// 불러오기만 해서는 브라우저 기능을 건드리지 않는다(Node 테스트가 악보를 읽는다).

import { wood, smp, turn } from "./engine.js";

export const BPM = 100;
/** 한 칸(8분음표)의 길이(초) */
export const STEP = 60 / BPM / 2;
/** 한 마디의 칸 수 */
export const BAR = 8;
export const TRACKS = ["lead", "comp", "bass", "beat"];

// 반주: 화음을 펼친 여덟 칸과, 박마다 하나씩만 치는 성긴 네 음(4분음표라 조금 더 길게 울린다)
const ARP = {
  G: "D4 G4 B4 G4 D4 G4 B4 G4",
  Em: "E4 G4 B4 G4 E4 G4 B4 G4",
  C: "E4 G4 C5 G4 E4 G4 C5 G4",
  D: "D4 F#4 A4 F#4 D4 F#4 A4 F#4",
  D7: "D4 F#4 A4 C5 D4 F#4 A4 C5",
};
const THIN = {
  G: "D4 - B4 - G4 - B4 -",
  Em: "E4 - B4 - G4 - B4 -",
  C: "E4 - C5 - G4 - C5 -",
  D: "D4 - A4 - F#4 - A4 -",
};
// 베이스: 셋·셋·둘로 짚는다. 걸어 올라가는 마디(UP)는 다음 마디의 G 로 이어진다
const LOW = {
  G: "G2 . . G2 . . D3 .",
  Em: "E2 . . E2 . . B2 .",
  C: "C3 . . C3 . . G2 .",
  D: "D3 . . D3 . . A2 .",
  UP: "D3 . . D3 . . E3 F#3",
};
// 첫머리(시안의 네 마디)와 그 리듬
const THEME = ["B5 - D6 B5 . A5 G5 -", "B5 - G5 E5 - - G5 -", "G5 - C6 G5 . E5 G5 -", "A5 - F#5 D5 . F#5 A5 -"];
const GROOVE = ["t k c k t k c s", "t k c k . t c k"];
const FILL = "t k c k t c c p"; // 손뼉 두 번에 책장을 넘기며 다음 대목으로
/** 첫머리로 들어가는 못갖춘마디(솔 라 → 시) */
const PICKUP = ". . . . . . G5 A5";

/** 대목마다: 마디의 화음(시험이 음을 맞춰 본다)과 네 줄 */
export const SCORE = {
  // 여는 마디: 반주부터, 책상 소리와 베이스가 차례로 들어온다
  intro: {
    chords: ["G", "Em", "C", "D"],
    lead: [".", ".", ".", PICKUP],
    comp: [ARP.G, ARP.Em, ARP.C, ARP.D],
    bass: [".", ".", LOW.C, LOW.UP],
    beat: [".", ". k . k . k . k", "t k . k t k . k", "t k c k t k c p"],
  },
  // 가: 첫머리 네 마디와, 더 높이 올라갔다 딸림화음에 멈추는 네 마디
  a: {
    chords: ["G", "Em", "C", "D", "G", "Em", "C", "D"],
    lead: [...THEME, "D6 - B5 G5 . B5 D6 -", "E6 - D6 B5 - - G5 -", "G5 - C6 E6 . D6 C6 -", "B5 - A5 F#5 . D5 A5 -"],
    comp: [ARP.G, ARP.Em, ARP.C, ARP.D, ARP.G, ARP.Em, ARP.C, ARP.D],
    bass: [LOW.G, LOW.Em, LOW.C, LOW.D, LOW.G, LOW.Em, LOW.C, LOW.D],
    beat: [...GROOVE, ...GROOVE, ...GROOVE, GROOVE[0], "t k c k . t c p"],
  },
  // 나: 단조로 내려앉아 긴 음으로 쉬다가, 다시 차올라 첫머리로 돌아간다
  b: {
    chords: ["Em", "C", "G", "D", "Em", "C", "D", "D7"],
    lead: [
      "E5 - - G5 - B5 - -",
      "C6 - - B5 - G5 - -",
      "D5 - - G5 - B5 - -",
      "A5 - - F#5 - D5 - -",
      "E5 - G5 B5 - - E6 -",
      "E6 - C6 G5 - - E5 -",
      "F#5 - A5 D6 - - A5 -",
      "C6 - B5 A5 - - G5 A5",
    ],
    comp: [THIN.Em, THIN.C, THIN.G, THIN.D, ARP.Em, ARP.C, ARP.D, ARP.D7],
    bass: ["E2 . . . B2 . . .", "C3 . . . G2 . . .", "G2 . . . D3 . . .", "D3 . . . A2 . . .", LOW.Em, LOW.C, LOW.D, LOW.UP],
    beat: ["t . c . t . c k", "t . c . t k c .", "t . c . t . c k", "t . c k t k c s", ...GROOVE, GROOVE[0], FILL],
  },
  // 가′: 첫머리를 다시 하고 으뜸음으로 맺는다
  a2: {
    chords: ["G", "Em", "C", "D", "G", "Em", "C|D", "G"],
    lead: [...THEME, "D6 - B5 G5 . B5 D6 -", "E6 - D6 B5 - - G5 -", "E6 - C6 - B5 - A5 -", "G5 - - . . . . ."],
    comp: [ARP.G, ARP.Em, ARP.C, ARP.D, ARP.G, ARP.Em, "E4 G4 C5 G4 D4 F#4 A4 F#4", ARP.G],
    bass: [LOW.G, LOW.Em, LOW.C, LOW.D, LOW.G, LOW.Em, "C3 . . . D3 . . D3", LOW.G],
    beat: [...GROOVE, ...GROOVE, ...GROOVE, GROOVE[0], "t k c k . t c p"],
  },
  // 쉬어 가는 마디: 가락이 쉬고 책상 소리가 앞에 나온다. 끝에서 첫머리로 들어간다
  rest: {
    chords: ["G", "G", "C", "D"],
    lead: [".", ".", ".", PICKUP],
    comp: [THIN.G, THIN.G, ARP.C, ARP.D],
    bass: [LOW.G, LOW.G, LOW.C, LOW.UP],
    beat: ["t k k c k k c k", "t k k c k s c s", "t k c k t k c k", FILL],
  },
};
/** 차례: 한 번만 하는 대목과 되풀이하는 대목 */
export const FORM = { once: ["intro"], loop: ["a", "b", "a2", "rest"] };

function cellsOf(bar) {
  const cells = bar.trim().split(/\s+/);
  if (cells.length === 1 && cells[0] === ".") return Array(BAR).fill(".");
  if (cells.length !== BAR) throw new Error(`한 마디는 ${BAR}칸이다: ${bar}`);
  return cells;
}
/** 악보 한 줄(마디들) → 울릴 것들 [{ track, note, len(칸), step(그 대목의 처음부터), cell(마디 안 자리) }] */
export function eventsOf(track, bars) {
  const out = [];
  let cur = null;
  bars.forEach((bar, b) =>
    cellsOf(bar).forEach((c, i) => {
      if (c === "-") {
        if (cur) cur.len += 1; // 마디를 넘어 이어 가도 된다
        return;
      }
      cur = null;
      if (c !== ".") out.push((cur = { track, note: c, len: 1, step: b * BAR + i, cell: i }));
    }),
  );
  return out;
}
/** 대목들을 이어 칸마다 울릴 것들의 표로 만든다 */
function table(names) {
  const steps = [];
  for (const name of names) {
    const part = SCORE[name];
    const base = steps.length;
    for (let i = 0; i < part.chords.length * BAR; i++) steps.push([]);
    for (const track of TRACKS) for (const e of eventsOf(track, part[track])) steps[base + e.step].push(e);
  }
  return steps;
}
const ONCE = table(FORM.once);
const LOOP = table(FORM.loop);
/** 여는 대목과 되풀이 대목의 칸 수 */
export const ONCE_STEPS = ONCE.length;
export const LOOP_STEPS = LOOP.length;

/** 처음부터 센 칸 pos 에서 울릴 것들. 여는 대목이 지나면 되풀이 대목을 돈다 */
export function eventsAt(pos) {
  return pos < ONCE.length ? ONCE[pos] : LOOP[(pos - ONCE.length) % LOOP.length];
}

// ── 연주 ────────────────────────────────────
// 사람 손맛: 박을 조금 흔들고(±ms) 세기도 조금씩 다르게 한다
const wob = (k, ms) => ((k.rnd() - 0.5) * ms) / 500;
const vel = (k, v, spread = 0.15) => v * (1 - spread + 2 * spread * k.rnd());
// 반주의 세기: 박에 오는 음을 조금 세게
const ACCENT = [1, 0.8, 0.9, 0.8, 0.96, 0.8, 0.9, 0.8];
/** 책장 넘기는 녹음은 넘어가는 소리가 0.241초 뒤에 온다. 그만큼 당겨 틀어 그 소리가 박에 오게 한다 */
export const PAGE_LEAD = 0.241;

/** 울릴 것 하나를 at(초)에 건다. 크기는 시안에서 맞춘 값이다(가락 0.18, 반주 0.16 안팎, 베이스 0.3) */
export function voice(k, out, at, e) {
  if (e.track === "lead") return wood.mallet(k, out, at + wob(k, 5), e.note, vel(k, 0.18, 0.06), 0.4 + 0.1 * Math.min(e.len, 3));
  if (e.track === "comp") return wood.mallet(k, out, at, e.note, 0.18 * ACCENT[e.cell], e.len > 1 ? 0.42 : 0.3);
  if (e.track === "bass") return wood.mallet(k, out, at, e.note, 0.3, 0.9);
  const u = at + wob(k, 6);
  if (e.note === "t") return smp(k, out, { s: "thud_b", at: u, vol: 0.5 });
  if (e.note === "k") return smp(k, out, { s: turn(k, "knock", ["knock_1", "knock_2", "knock_3"]), at: u, vol: vel(k, 0.4) });
  if (e.note === "c") return wood.clap(k, out, at, 0.17, 0.12);
  if (e.note === "s") return smp(k, out, { s: "snip_b", at: u, vol: 0.3 });
  // p: 당겨 틀 틈이 없으면(화면이 멈췄다 막 돌아온 때) 이번 것은 건너뛴다
  return u - PAGE_LEAD > k.ctx.currentTime ? smp(k, out, { s: "page", at: u - PAGE_LEAD, vol: 0.4 }) : at;
}

/** from 칸부터 to 칸 앞까지를 걸어 둔다. 칸 pos 는 t0 + pos × STEP 에 울린다(오프라인으로 뽑아 잴 때도 이것을 쓴다) */
export function schedule(k, out, t0, from, to) {
  for (let pos = from; pos < to; pos++) for (const e of eventsAt(pos)) voice(k, out, t0 + pos * STEP, e);
}

const START = 0.12; // 켜고 나서 첫 음까지
const AHEAD = 1; // 이만큼 앞까지 미리 걸어 둔다(화면이 잠깐 바빠도 끊기지 않게)
const EDGE = 0.03; // 이보다 가까운 칸은 이미 늦었다
const EVERY_MS = 250;

/**
 * 곡을 이어서 건다. start() 로 처음부터, stop() 으로 그만. 소리를 줄이고 끊는 것은 out 을 쥔 쪽(엔진)이 한다.
 * 오디오 시계로만 박을 센다: 탭이 숨어 시계가 멈추면 같이 멈췄다가 그 자리에서 이어 간다.
 * 화면이 한참 멈췄다 돌아오면 밀린 칸은 버리고 박자 그대로 이어 간다(밀린 음을 한꺼번에 쏟지 않는다).
 */
export function createMusic(ctx, k, out) {
  let t0 = 0;
  let pos = 0;
  let timer = null;
  function tick() {
    if (timer === null) return;
    const now = ctx.currentTime;
    pos = Math.max(pos, Math.ceil((now + EDGE - t0) / STEP));
    const to = Math.floor((now + AHEAD - t0) / STEP) + 1;
    if (to > pos) {
      schedule(k, out, t0, pos, to);
      pos = to;
    }
  }
  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }
  return {
    start() {
      stop();
      t0 = ctx.currentTime + START;
      pos = 0;
      timer = setInterval(tick, EVERY_MS);
      if (timer && timer.unref) timer.unref(); // Node(테스트)에서 이 시계 때문에 끝나지 않는 일이 없게
      tick();
    },
    stop,
    tick,
    /** 다음에 걸 칸(처음부터 센 것) */
    get pos() {
      return pos;
    },
  };
}
