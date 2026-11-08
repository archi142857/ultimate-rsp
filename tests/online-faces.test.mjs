// node --test 로 돈다. 프로필 그림 고르기: 묶음(동물·사람·손·그 밖), 얼굴로 쓸 때 가운데 맞추기 표.

import test from "node:test";
import assert from "node:assert/strict";
import { faceGroups } from "../web/js/online/face-picker.js";
import { ART_CENTER, centerVars } from "../web/js/online/art-center.js";
import { ART_FILES } from "../web/js/data/art-files.js";

test("그림 묶음: 게임 그림을 한 번씩(피·변기만 빼고), 손 모양은 손 묶음", () => {
  const groups = faceGroups();
  assert.deepEqual(
    groups.map((g) => g.label),
    ["동물", "사람", "손", "그 밖"],
  );
  const ids = groups.flatMap((g) => g.ids);
  assert.equal(new Set(ids).size, ids.length, "두 묶음에 같은 그림이 없다");
  for (const id of ids) assert.ok(ART_FILES.has(id), id);
  const left = [...ART_FILES.keys()].filter((id) => !ids.includes(id)).sort();
  assert.deepEqual(left, ["blood", "toilet"]);
  const hands = groups.find((g) => g.label === "손").ids;
  for (const id of ["hand-rock", "hand-scissors", "hand-paper", "spock", "prayer"]) assert.ok(hands.includes(id), id);
  assert.ok(!hands.includes("power") && groups.find((g) => g.label === "그 밖").ids.includes("power"), "힘(💪)은 팔이라 그 밖");
  assert.ok(!groups.find((g) => g.label === "사람").ids.includes("spock"), "스팍(🖖)은 사람이 아니라 손");
});

test("가운데 맞추기 표: 그림 목록에 있는 이름, 크게 옮기지 않는다", () => {
  for (const [id, [x, y]] of Object.entries(ART_CENTER)) {
    assert.ok(ART_FILES.has(id), id);
    assert.ok(Math.abs(x) < 0.2 && Math.abs(y) < 0.2, id);
    assert.ok(Math.abs(x) >= 0.02 || Math.abs(y) >= 0.02, `${id}: 2% 안이면 적지 않는다`);
  }
  for (const id of ["pit", "camera", "slug"]) assert.ok(ART_CENTER[id], `${id}: 사용자가 말한 그림`);
  assert.deepEqual(centerVars("pit"), { "--fx": "0%", "--fy": "-14.1%" }, "아래로 쏠린 만큼 위로");
  assert.equal(centerVars("fox"), null);
  assert.equal(centerVars("__proto__"), null);
  assert.equal(centerVars("toString"), null);
});
