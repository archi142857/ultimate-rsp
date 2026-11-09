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
import { evolutionStoryView } from "./evolution-story.js";
import { latticeView } from "./lattice.js";
import { warView } from "./war.js";
import { hostView } from "./host.js";
import { teamSplitView } from "./teamsplit.js";
import { teamTagView } from "./teamtag.js";
import { morraView } from "./morra.js";
import { penneyView } from "./penney.js";
import { diceView } from "./dice.js";
import { blottoView } from "./blotto.js";
import { hammerView } from "./hammer.js";
import { donpappaView } from "./donpappa.js";
import { relayView } from "./relay.js";
import { ecardView } from "./ecard.js";
import { shogiView } from "./shogi.js";

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
  league: evolutionStoryView, // 전략의 진화(옛 전략 리그 자리)
  lattice: latticeView,
  war: warView,
  majority: (main, entry, params) => groupView(main, entry, params, { rules: ["majority", "minority"] }),
  choki: (main, entry, params) => groupView(main, entry, params, { tie3: "scissors" }),
  host: hostView,
  teamtag: teamTagView,
  teamsplit: teamSplitView,
  morra: morraView,
  penney: penneyView,
  dice: diceView,
  blotto: blottoView,
  hammer: hammerView,
  donpappa: donpappaView,
  relay: relayView,
  ecard: ecardView,
  shogi: shogiView,
};

export function entryView(main, entry, params) {
  setTitle(entry.name);
  if (entry.kind === "matrix") return matrixView(main, entry, params);
  if (entry.kind === "custom") return customView(main, entry, params);
  const v = VIEWS[entry.id];
  if (!v) throw new Error(`화면이 없는 항목: ${entry.id}`);
  return v(main, entry, params);
}
