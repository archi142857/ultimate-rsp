// 시안 ③ 고리의 계산: 사람 그림(이름 끝 동물), 고리 자리, 알림 순서, 준비 수, 순위, 도전장 결과 기록.
import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { NICK_ART, NICK_WORDS } = await import("../web/js/i18n/nicknames.js");
const { ART_FILES } = await import("../web/js/data/art-files.js");
const { animalOf, initialOf, faceOf } = await import("../web/js/online/avatar.js");
const { ringLayout, sideLayout, SIDE_H, nodeSize } = await import("../web/js/online/people-ring.js");
const { topNotice, NOTICE_RANK } = await import("../web/js/online/notice.js");
const { noticeFor } = await import("../web/js/online/messages.js");
const { ringOrder, readyInfo, ranking, mmss } = await import("../web/js/online/room-model.js");
const { myChallenges, rememberChallenge, noteChallenge } = await import("../web/js/online/mine.js");
const { emoteIds } = await import("../web/js/online/emotes.js");
const { EMOTES } = await import("../web/js/online/protocol.js");
const fs = await import("node:fs");

test("닉네임 동물은 모두 그림이 있고, 이름에서 그림을 찾는다", () => {
  for (const key of [...NICK_ART, "robot"]) assert.ok(ART_FILES.has(key), `web/art/${key}.svg 가 없다`);
  for (const l of Object.keys(NICK_WORDS)) assert.equal(NICK_WORDS[l].noun.length, NICK_ART.length, l);
  assert.equal(animalOf("날쌘 여우 42"), "fox");
  assert.equal(animalOf("Sleepy Bear 7"), "bear");
  assert.equal(animalOf("용감한 고양이 19"), "cat");
  assert.equal(animalOf("Courageous Kitten 19"), "cat");
  assert.equal(animalOf("곰돌이"), null); // 낱말 하나로 떨어져 있어야 한다
  assert.equal(animalOf("늑대와 여우"), "fox"); // 끝 동물
  assert.equal(animalOf("철수"), null);
  assert.equal(initialOf("철수"), "철");
  assert.equal(initialOf("mina"), "M");
  assert.equal(initialOf("  "), "?");
  assert.deepEqual(faceOf({ kind: "bot" }), { art: "robot" });
  assert.deepEqual(faceOf({ kind: "human", name: "kim" }), { text: "K" });
  assert.deepEqual(faceOf({ kind: "empty" }), { text: "" });
});

test("고리: 0번(나)은 맨 아래, 다음 사람은 시계 방향, 이름 줄은 이웃과 안 겹친다", () => {
  const L = ringLayout(4, 328, 330, 56);
  const [me, a, b, c] = L.pos;
  assert.ok(Math.abs(me[0] - 164) < 1e-6 && me[1] > 165, "나는 맨 아래");
  assert.ok(a[0] < 164 && Math.abs(a[1] - 165) < 1e-6, "다음은 왼쪽(시계 방향)");
  assert.ok(b[1] < 165, "그다음은 위");
  assert.ok(c[0] > 164, "마지막은 오른쪽");
  // 동그라미와 이름이 칸 안에 들어간다
  for (const [x, y] of L.pos) {
    assert.ok(x - 28 >= 0 && x + 28 <= 328, `x ${x}`);
    assert.ok(y - 28 >= 0 && y + 28 + 20 <= 330 + 1, `y ${y}`);
  }
  assert.equal(L.labelW, 104);
  const many = ringLayout(10, 288, 330, nodeSize(10));
  assert.ok(many.labelW < 104 && many.labelW >= 44);
  assert.deepEqual([2, 4, 5, 6, 7, 8, 9, 10].map(nodeSize), [56, 56, 48, 48, 42, 42, 38, 38]);
  assert.deepEqual(ringOrder(4, 2), [2, 3, 0, 1]);
  assert.deepEqual(ringOrder(3, null), [0, 1, 2]);
});

test("나란히(둘이서, 낮은 화면): 나는 왼쪽·상대는 오른쪽, 위에 낸 손 자리, 가운데 시계와 안 겹친다", () => {
  for (const W of [288, 328, 360]) {
    const L = sideLayout(W, SIDE_H, 56);
    const [[mx, my], [ox, oy]] = L.pos;
    assert.ok(mx < W / 2 && ox > W / 2 && my === oy && L.cy === my, `W ${W}`);
    // 이름 줄(104px)이 칸 안에
    assert.ok(mx - L.labelW / 2 >= 0 && ox + L.labelW / 2 <= W, `이름 줄 W ${W}`);
    // 동그라미 위에 낸 손(52px, 6px 띄움)이 들어가고, 아래에 이름 두 줄(40px)
    assert.ok(my - 28 - 6 - 52 >= 0, `손 자리 W ${W}`);
    assert.ok(my + 28 + 40 <= SIDE_H, `이름 자리 W ${W}`);
    // 가운데 시계(98px)와 동그라미 사이가 띈다
    assert.ok(W / 2 - 49 - (mx + 28) >= 8, `시계 W ${W}`);
  }
});

test("알림: 끊김 > 한도 > 잇는 중 > 새 판 > 짧은 알림, 오류 코드는 알맞은 종류로", () => {
  assert.equal(topNotice(["note", "update", "wait"]), "wait");
  assert.equal(topNotice(["wait", "limit"]), "limit");
  assert.equal(topNotice(["limit", "drop", "note"]), "drop");
  assert.equal(topNotice([]), null);
  assert.ok(NOTICE_RANK.drop > NOTICE_RANK.limit && NOTICE_RANK.limit > NOTICE_RANK.wait && NOTICE_RANK.wait > NOTICE_RANK.update);
  assert.equal(noticeFor("offline").kind, "drop");
  assert.equal(noticeFor("version").kind, "update");
  for (const c of ["network", "busy", "server", "timeout", "http_503"]) assert.equal(noticeFor(c).kind, "limit", c);
  assert.equal(noticeFor("bad_name").kind, "note");
});

test("준비 수: 방장은 늘 준비, 서버가 ready 를 줄 때만 쓴다", () => {
  const seats = [
    { kind: "human", name: "a", on: true },
    { kind: "human", name: "b", on: true },
    { kind: "empty" },
  ];
  assert.equal(readyInfo({ host: 0, seats }).supported, false);
  const r = readyInfo({ host: 0, seats: [{ ...seats[0], ready: false }, { ...seats[1], ready: true }, seats[2]] });
  assert.deepEqual(r, { supported: true, ready: 2, total: 2, all: true });
  assert.equal(readyInfo({ host: 0, seats: [{ ...seats[0], ready: false }, { ...seats[1], ready: false }] }).all, false);
  assert.equal(mmss(42), "0:42");
  assert.equal(mmss(61.9), "1:01");
});

test("순위: 둘이서는 이긴 판, 여럿이는 빠진 차례(같은 판은 같은 등수)", () => {
  const duel = { rules: { game: "classic" }, seats: [{ kind: "human" }, { kind: "bot" }], score: [1, 2] };
  assert.deepEqual(ranking(duel).map((r) => [r.seat, r.rank]), [[1, 1], [0, 2]]);
  const tie = { rules: { game: "classic" }, seats: [{ kind: "human" }, { kind: "human" }], score: [3, 3] };
  assert.deepEqual(ranking(tie).map((r) => r.rank), [1, 1]);
  const group = { rules: { game: "group", mode: "survive" }, seats: [{ kind: "human" }, { kind: "bot" }, { kind: "human" }, { kind: "bot" }], last: 2, hist: [{ r: 1, out: [1] }, { r: 2, out: [] }, { r: 3, out: [0, 3] }] };
  assert.deepEqual(ranking(group).map((r) => [r.seat, r.rank]), [[2, 1], [0, 2], [3, 2], [1, 4]]);
  // 술래 한 명: 일찍 빠져나갈수록 위, 술래가 꼴찌
  assert.deepEqual(ranking({ ...group, rules: { game: "group", mode: "loser" } }).map((r) => [r.seat, r.rank]), [[1, 1], [0, 2], [3, 2], [2, 4]]);
});

test("내 도전장: 결과와 상대 이름을 적고 차례는 그대로", () => {
  mem.clear();
  rememberChallenge({ id: "AAAA2222", role: "maker", game: "classic", hand: "rock", at: 1000 });
  rememberChallenge({ id: "BBBB3333", role: "taker", game: "classic", hand: "paper", at: 2000, result: -1, vs: "날쌘 여우 42" });
  noteChallenge("AAAA2222", { result: 1, vs: "  Sleepy   Bear 7 " });
  const list = myChallenges();
  assert.deepEqual(list.map((r) => r.id), ["BBBB3333", "AAAA2222"]);
  assert.equal(list[1].result, 1);
  assert.equal(list[1].vs, "Sleepy Bear 7");
  assert.equal(list[0].result, -1);
  assert.equal(noteChallenge("NONE7777", { result: 1 }), null);
});

test("이모트 그림 8개가 web/icons/emotes 에 있다", () => {
  assert.deepEqual(emoteIds(), EMOTES);
  for (const id of EMOTES) {
    const svg = fs.readFileSync(new URL(`../web/icons/emotes/${id}.svg`, import.meta.url), "utf8");
    assert.match(svg, /viewBox="0 0 64 64"/, id);
    assert.ok(!/<script|javascript:|\son\w+=/i.test(svg), `${id}: 스크립트가 없어야 한다`);
  }
  assert.ok(fs.existsSync(new URL("../web/icons/emotes/LICENSE-fluentui-emoji.txt", import.meta.url)));
});
