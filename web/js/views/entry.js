// 도감 항목을 알맞은 화면으로 보낸다.

import { setTitle } from "../ui/dom.js";
import { matrixView } from "./matrix.js";
import { customView } from "./custom.js";
import { mukjjippaView } from "./mukjjippa.js";
import { acchimuiteView } from "./acchimuite.js";
import { minusOneView } from "./minusone.js";
import { glicoView } from "./glico.js";
import { limitedView } from "./limited.js";
import { dynamiteWbView } from "./dynamitewb.js";
import { commandView } from "./command.js";
import { groupView } from "./group.js";
import { trainView } from "./train.js";
import { evolutionView } from "./evolution.js";
import { leagueView } from "./league.js";
import { latticeView } from "./lattice.js";
import { warView } from "./war.js";

const VIEWS = {
  mukjjippa: mukjjippaView,
  acchimuite: acchimuiteView,
  minusone: minusOneView,
  glico: glicoView,
  limited: limitedView,
  dynamitewb: dynamiteWbView,
  command: commandView,
  group: groupView,
  train: trainView,
  evolution: evolutionView,
  league: leagueView,
  lattice: latticeView,
  war: warView,
  majority: (main, entry, params) => groupView(main, entry, params, { rules: ["majority", "minority"] }),
  choki: (main, entry, params) => groupView(main, entry, params, { tie3: "scissors" }),
};

export function entryView(main, entry, params) {
  setTitle(entry.name);
  if (entry.kind === "matrix") return matrixView(main, entry, params);
  if (entry.kind === "custom") return customView(main, entry, params);
  const v = VIEWS[entry.id];
  if (!v) throw new Error(`화면이 없는 항목: ${entry.id}`);
  return v(main, entry, params);
}
