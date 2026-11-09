// 전략의 진화 이야기: 장마다 쓸 값(씨앗·사람·규칙)과 글(한국어·영어).
// Nicky Case 의 '신뢰의 진화'(The Evolution of Trust, 2017)처럼 장을 넘기며 직접 해 본다(꼴만 빌림).
// 장마다 씨앗을 정해 두어 결과가 늘 같다. 글에 적은 결과는 tests/evolution-story.test.mjs 가 계산으로 확인한다.
// 화면(장 넘기기·대전 칸·고리·그래프)은 프론트엔드가 만든다. 인물 그림·색은 디자인 시안(`자료\전략의_진화_시안\`).

import { createBot } from "../core/bots.js";
import { makeRng } from "../core/rng.js";
import { createEvolution, EVO_DEFAULTS } from "./evolution.js";
import { runLeague } from "./league.js";

/** 인물 아홉(화면에 늘어놓는 차례) */
export const EVO_CAST = ["stubborn", "cycle", "mirror", "avenger", "random", "human", "freq", "pattern", "nash"];

/** 2·3·4장의 단순한 다섯 */
export const SIMPLE_FIVE = ["stubborn", "cycle", "mirror", "avenger", "random"];

/** 6–8장: 계산기를 뺀 여덟 전략, 25명 */
export const EIGHT = { stubborn: 3, cycle: 3, mirror: 3, avenger: 3, human: 3, freq: 3, pattern: 3, random: 4 };

/**
 * 장 목록. kind 마다 화면이 하는 일
 *  - text: 글만
 *  - one: 상대(bot, seed) 와 한 판
 *  - duel: 상대 foes 와 차례로 rounds 판씩. 끝나면 정체·해설
 *  - league: bots 가 서로 한 번씩 rounds 판 경기(runLeague). 시작 전에 한 명에게 건다
 *  - evolve: 세대를 거듭한다(evolutionFor). '한 세대'·'끝까지'(maxGen 이나 한 가지만 남을 때까지)
 *  - choice: choices 가운데 하나를 고르면 그 값으로 evolve 와 같이 돌린다
 *  - sandbox: 놀이터. 처음 값과 밀대 범위
 */
export const EVO_CHAPTERS = [
  { id: "intro", kind: "text" },
  { id: "one", kind: "one", bot: "random", seed: 7 },
  {
    id: "duel",
    kind: "duel",
    rounds: 10,
    foes: [
      { id: "stubborn", seed: 1 },
      { id: "cycle", seed: 3 },
      { id: "mirror", seed: 2 },
      { id: "avenger", seed: 4 },
      { id: "random", seed: 5 },
    ],
  },
  { id: "league", kind: "league", bots: SIMPLE_FIVE, rounds: 10, seed: 10 },
  { id: "evolve", kind: "evolve", setup: { population: { stubborn: 5, cycle: 5, mirror: 5, avenger: 5, random: 5 }, rounds: 10, seed: 9, maxGen: 10 } },
  {
    id: "readers",
    kind: "choice",
    setup: { population: { mirror: 24 }, rounds: 10, seed: 10, maxGen: 12 },
    choices: [
      { id: "pattern", set: { population: { mirror: 24, pattern: 1 } } },
      { id: "freq", set: { population: { mirror: 24, freq: 1 } } },
      { id: "human", set: { population: { mirror: 24, human: 1 } } },
    ],
  },
  {
    id: "rounds",
    kind: "choice",
    setup: { population: EIGHT, rounds: 10, seed: 10, maxGen: 20 },
    choices: [
      { id: "3", set: { rounds: 3 } },
      { id: "10", set: { rounds: 10 } },
      { id: "30", set: { rounds: 30 } },
    ],
  },
  {
    id: "noise",
    kind: "choice",
    setup: { population: EIGHT, rounds: 10, seed: 8, maxGen: 20 },
    choices: [
      { id: "0", set: { noise: 0 } },
      { id: "5", set: { noise: 0.05 } },
      { id: "20", set: { noise: 0.2 } },
    ],
  },
  {
    id: "draw",
    kind: "choice",
    setup: { population: EIGHT, rounds: 10, seed: 8, maxGen: 20 },
    choices: [
      { id: "0", set: { payoff: { win: 1, tie: 0, lose: -1 } } },
      { id: "half", set: { payoff: { win: 1, tie: 0.5, lose: -1 } } },
    ],
  },
  {
    id: "sandbox",
    kind: "sandbox",
    setup: {
      variant: "classic",
      population: { stubborn: 3, cycle: 3, mirror: 3, avenger: 3, random: 3, human: 3, freq: 3, pattern: 3, nash: 1 },
      rounds: 30,
      cull: 5,
      noise: 0.05,
      payoff: { win: 1, tie: 0, lose: -1 },
      seed: 1,
      maxGen: 30,
    },
    limits: { people: [0, 25], total: [2, 50], rounds: [3, 100], cull: [0, 12], noise: [0, 0.5] },
  },
  { id: "outro", kind: "text" },
];

export function evoChapter(id) {
  const ch = EVO_CHAPTERS.find((c) => c.id === id);
  if (!ch) throw new Error(`모르는 장: ${id}`);
  return ch;
}

/** 장(과 고른 것)의 값: { population, rounds, cull, noise, payoff, seed, maxGen } */
export function evoSetup(ch, choiceId) {
  const base = { cull: EVO_DEFAULTS.cull, noise: EVO_DEFAULTS.noise, payoff: EVO_DEFAULTS.payoff, ...ch.setup };
  if (ch.kind !== "choice") return base;
  const c = ch.choices.find((x) => x.id === choiceId);
  if (!c) throw new Error(`${ch.id} 장에 없는 고르기: ${choiceId}`);
  return { ...base, ...c.set };
}

/** 세대를 거듭할 진화(createEvolution). 화면은 step() 을 maxGen 까지 부른다(done 이면 멈춤) */
export function evolutionFor(V, ch, choiceId) {
  const s = evoSetup(ch, choiceId);
  return createEvolution(V, s.population, { rounds: s.rounds, cull: s.cull, noise: s.noise, payoff: s.payoff, seed: s.seed });
}

/** 끝까지(한 가지만 남거나 maxGen 세대) 돌린다 */
export function runChapter(V, ch, choiceId) {
  const evo = evolutionFor(V, ch, choiceId);
  const max = evoSetup(ch, choiceId).maxGen;
  while (!evo.done && evo.generation < max) evo.step();
  return evo;
}

/**
 * 3장 리그 한 번. 짝마다 { a, b, w, l, d }(a 쪽에서 본 판 수), 사람마다 점수(판마다 이김 +1·짐 −1),
 * order 는 점수가 높은 차례(같으면 bots 차례)
 */
export function leagueFor(V, ch) {
  const r = runLeague(V, ch.bots, ch.rounds, ch.seed);
  const pairs = [];
  for (let i = 0; i < ch.bots.length; i++) for (let j = i + 1; j < ch.bots.length; j++) pairs.push({ a: ch.bots[i], b: ch.bots[j], ...r.wdl[i][j] });
  const totals = Object.fromEntries(ch.bots.map((id, i) => [id, r.wdl[i].reduce((s, x, j) => (j === i ? s : s + x.w - x.l), 0)]));
  const order = [...ch.bots].sort((a, b) => totals[b] - totals[a] || ch.bots.indexOf(a) - ch.bots.indexOf(b));
  return { pairs, totals, order };
}

/** 1장·2장의 상대. index 는 2장 foes 차례(1장은 생략) */
export function opponentFor(V, ch, index = 0) {
  const f = ch.kind === "duel" ? ch.foes[index] : { id: ch.bot, seed: ch.seed };
  if (!f) throw new Error(`${ch.id} 장에 없는 상대: ${index}`);
  return createBot(f.id, V, makeRng(f.seed));
}

/** 인물 말버릇(말풍선). 인물이 하는 말이라 반말 */
export const EVO_LINES = {
  ko: {
    stubborn: "난 한 손만 내.",
    cycle: "바위, 가위, 보. 그리고 또 바위.",
    mirror: "네가 낸 거 나도 낼래.",
    avenger: "방금 그 손? 이기는 손으로 갚아 줄게.",
    random: "몰라, 굴려 보자!",
    human: "이기면 그대로, 지면 바꿔.",
    freq: "너 그 손 자주 내더라.",
    pattern: "다음은 그거 낼 차례지?",
    nash: "정해진 비율대로, 정확하게.",
  },
  en: {
    stubborn: "One hand. Always.",
    cycle: "Rock, scissors, paper. Then rock again.",
    mirror: "Whatever you throw, I'll throw next.",
    avenger: "That last hand of yours? I'll beat it.",
    random: "No idea. Let's roll.",
    human: "Win, stay. Lose, switch.",
    freq: "You throw that one a lot.",
    pattern: "That one's next, right?",
    nash: "Right on the mix, every time.",
  },
};

/**
 * 장마다 글. title(제목), body(문단), end(장 끝 해설 상자), foes(2장 상대마다 정체 해설),
 * choices(고르기 단추 label 과 고른 뒤 result), credit(맺음의 출처 한 줄)
 * 문장은 하십시오체, 단추 이름은 짧게(`자료\문구_규칙.md`). 문구가 다듬는다
 */
export const EVO_TEXT = {
  ko: {
    title: "전략의 진화",
    intro: {
      title: "들어가며",
      body: [
        "가위바위보는 운이라고들 합니다. 둘 다 아무렇게나 내면 정말 운입니다.",
        "그런데 사람은 아무렇게나 내지 못합니다. 360명이 함께 한 실험에서도 이긴 사람은 같은 손을 다시 내는 일이 많았고, 진 사람은 손을 바꾸는 일이 많았습니다.",
        "버릇은 읽힙니다. 이제 컴퓨터 전략 아홉 가지가 저마다의 버릇으로 겨룹니다. 누가 살아남는지 장을 넘기며 지켜보십시오.",
      ],
    },
    one: {
      title: "한 판",
      body: ["모르는 상대와 딱 한 판을 합니다. 손을 하나 고르십시오."],
      end: "한 판으로는 무엇을 내도 이길 확률이 같습니다. 한 판은 운입니다.",
    },
    duel: {
      title: "여러 판",
      body: ["이번에는 한 상대와 10판을 합니다. 상대 다섯이 차례로 나오고, 누구인지는 10판이 끝나야 밝혀집니다.", "몇 판 하다 보면 버릇이 보일 수 있습니다."],
      foes: {
        stubborn: "10판 내내 바위만 냈습니다. 보만 냈다면 다 이겼습니다. 한 손만 고집하면 금방 읽힙니다.",
        cycle: "바위, 가위, 보 차례로 돌았습니다. 돌림이 방금 낸 손을 그대로 내면 다음 판을 이깁니다.",
        mirror: "방금 낸 손을 그대로 따라 냈습니다. 방금 낸 손을 이기는 손을 내면 이깁니다.",
        avenger: "방금 낸 손을 이기는 손을 냈습니다. 방금 낸 손에게 지는 손을 내면 이깁니다.",
        random: "아무렇게나 냈습니다. 버릇이 없어서 읽을 수 없습니다. 오래 하면 이기지도 지지도 않습니다.",
      },
      end: "버릇이 있는 상대는 읽으면 이깁니다. 그럼 컴퓨터끼리 붙이면 누가 이기겠습니까?",
    },
    league: {
      title: "리그 한 번",
      body: ["다섯이 서로 한 번씩, 10판짜리 경기를 합니다. 판마다 이기면 +1점, 지면 −1점, 비기면 0점입니다.", "누가 1등을 하겠습니까? 시작하기 전에 한 명에게 거십시오."],
      end: "따라쟁이가 1등입니다. 돌림을 크게 이기고 앙갚음에게만 졌습니다. 고집은 네 상대 모두에게 졌습니다. 그럼 리그를 거듭하면 어떻게 되겠습니까?",
    },
    evolve: {
      title: "리그를 거듭하면",
      body: ["이번에는 25명입니다. 다섯 전략이 다섯 명씩 있습니다.", "리그가 끝날 때마다 꼴찌 5명은 빠지고, 1등 5명은 하나씩 더 생깁니다. 세대가 지나면 누가 남겠습니까?"],
      end: "1세대에 고집이 사라지고, 3세대에 돌림과 앙갚음, 7세대에 주사위가 사라집니다. 7세대 만에 25명 모두 따라쟁이입니다.",
    },
    readers: {
      title: "읽는 사람이 오면",
      body: ["따라쟁이만 24명인 세상에 한 명을 들여보냅니다. 누구를 넣겠습니까?"],
      choices: {
        pattern: { label: "수 읽기", result: "수 읽기는 따라쟁이가 내 온 순서를 외웁니다. 하나였던 수 읽기가 8세대 만에 25명이 됩니다." },
        freq: { label: "버릇 읽기", result: "버릇 읽기는 따라쟁이가 자주 내는 손을 노립니다. 수 읽기보다 조금 느리게, 10세대 만에 25명이 됩니다." },
        human: { label: "사람 흉내", result: "사람 흉내는 따라쟁이에게 집니다. 첫 세대에 바로 빠집니다." },
      },
      end: "따라쟁이처럼 버릇이 뚜렷하면, 읽는 사람이 하나만 와도 세상이 바뀝니다.",
    },
    rounds: {
      title: "판 수를 바꾸면",
      body: ["이번에는 여덟 전략이 모두 모였습니다. 25명입니다.", "한 경기가 몇 판인지만 바꿔 보십시오."],
      choices: {
        3: { label: "3판", result: "3판으로는 읽을 틈이 없습니다. 14세대 만에 모두 따라쟁이입니다." },
        10: { label: "10판", result: "20세대가 지나도 주사위와 수 읽기가 비슷하게 나눠 가집니다. 읽는 사람이 많으면 읽히지 않는 주사위가 버팁니다." },
        30: { label: "30판", result: "30판이면 수 읽기가 상대를 충분히 배웁니다. 9세대 만에 모두 수 읽기입니다." },
      },
      end: "짧게 만나면 읽을 틈이 없고, 오래 만나면 읽는 쪽이 이깁니다.",
    },
    noise: {
      title: "실수가 섞이면",
      body: ["사람은 실수를 합니다. 이번에는 마음먹은 손 대신 아무 손이나 나가는 일이 섞입니다.", "한 경기는 다시 10판입니다. 실수할 확률을 고르십시오."],
      choices: {
        0: { label: "실수 없음", result: "실수가 없으면 12세대 만에 모두 수 읽기입니다." },
        5: { label: "5%", result: "실수가 조금 섞여도 수 읽기가 이깁니다. 11세대 만에 모두 수 읽기입니다." },
        20: { label: "20%", result: "실수가 잦으면 읽은 대로 되지 않습니다. 수 읽기는 사라지고, 20세대에 앙갚음 21명과 따라쟁이 4명이 남습니다." },
      },
      end: "실수가 많을 때는 방금 한 판만 보는 앙갚음과 따라쟁이가 버텼습니다.",
    },
    draw: {
      title: "비김 점수를 올리면",
      body: ["지금까지는 판마다 이기면 +1점, 비기면 0점, 지면 −1점이었습니다.", "비김 점수만 0.5점으로 올리면 어떻게 되겠습니까? 실수 없이 10판씩입니다."],
      choices: {
        0: { label: "비김 0점", result: "지금까지와 같습니다. 12세대 만에 모두 수 읽기입니다." },
        half: { label: "비김 0.5점", result: "같은 25명인데 이번에는 앙갚음이 20세대 만에 모두를 차지합니다." },
      },
      end: "점수 매기는 법만 바꿔도 이기는 전략이 바뀝니다.",
    },
    sandbox: {
      title: "놀이터",
      body: [
        "이제 마음대로 바꿔 보십시오. 전략마다 사람 수를 정하고, 판 수와 실수와 점수를 바꿀 수 있습니다. 변종도 고를 수 있습니다.",
        "씨앗을 바꾸면 같은 조건에서 다른 결과가 나옵니다.",
        "계산기는 최적 비율대로 냅니다. 보통 가위바위보에서는 주사위와 같고, 손이 많거나 비대칭인 변종에서만 다르게 냅니다.",
      ],
    },
    outro: {
      title: "마치며",
      body: [
        "전략끼리도 가위바위보처럼 물고 물립니다. 수 읽기는 돌림을, 돌림은 앙갚음을, 앙갚음은 수 읽기를 이깁니다. 영원한 1등은 없습니다.",
        "아무렇게나 내는 주사위는 누구에게도 크게 지지 않습니다. 대신 누구도 크게 이기지 못합니다.",
        "사람은 주사위처럼 내기 어렵습니다. 상대의 버릇을 읽고, 자기 버릇은 숨기십시오.",
      ],
      credit: "이야기의 꼴은 Nicky Case 의 '신뢰의 진화'(The Evolution of Trust, 2017)에서 빌렸습니다.",
    },
  },
  en: {
    title: "The Evolution of Strategy",
    intro: {
      title: "Before we start",
      body: [
        "People say rock paper scissors is luck. If both players throw at random, it really is.",
        "But people can't throw at random. In a study of 360 players, winners often threw the same hand again, and losers often switched.",
        "Habits can be read. Next, nine computer strategies play each other, each with its own habit. Turn the pages and see who survives.",
      ],
    },
    one: {
      title: "One round",
      body: ["You play one round against someone you don't know. Pick a hand."],
      end: "In a single round, every hand has the same chance to win. One round is luck.",
    },
    duel: {
      title: "Many rounds",
      body: ["Now you play 10 rounds against each opponent. Five opponents come one by one, and you find out who they are only after the 10 rounds.", "After a few rounds, you might spot a habit."],
      foes: {
        stubborn: "It threw rock all 10 rounds. Paper every time would have won them all. One hand forever is easy to read.",
        cycle: "It went rock, scissors, paper, in order. Throw the hand it just threw, and you beat its next one.",
        mirror: "It copied the hand you just threw. Throw the hand that beats your last one, and you win.",
        avenger: "It threw the hand that beats your last one. Throw the hand your last one beats, and you win.",
        random: "It threw at random. With no habit, there's nothing to read. Over many rounds, it neither wins nor loses.",
      },
      end: "An opponent with a habit loses once you read it. So what happens when the computers play each other?",
    },
    league: {
      title: "One league",
      body: ["The five play each other once, in 10-round matches. Each round, a win is +1, a loss is −1 and a draw is 0.", "Who will come first? Pick one before it starts."],
      end: "The Copycat comes first. It crushed the Cycler and lost only to the Avenger. The Stubborn one lost to all four opponents. So what happens if the league goes on and on?",
    },
    evolve: {
      title: "League after league",
      body: ["Now there are 25 players: five of each strategy.", "After each league, the bottom five leave and the top five each get one more copy. Who's left after a few generations?"],
      end: "The Stubborn ones go in generation 1, the Cyclers and Avengers in generation 3, and the Dice in generation 7. By generation 7, all 25 are Copycats.",
    },
    readers: {
      title: "Enter the readers",
      body: ["Into a world of 24 Copycats, you send in one newcomer. Who will it be?"],
      choices: {
        pattern: { label: "Pattern reader", result: "The Pattern reader learns the order the Copycats throw in. From one player, it grows to all 25 by generation 8." },
        freq: { label: "Habit reader", result: "The Habit reader goes after the hand the Copycats throw most. A little slower than the Pattern reader, it takes all 25 by generation 10." },
        human: { label: "Human-like", result: "The Copycats beat the Human-like player. It's gone in the first generation." },
      },
      end: "When a habit is this clear, a single reader is enough to change the whole world.",
    },
    rounds: {
      title: "Change the match length",
      body: ["Now all eight strategies are here, 25 players in all.", "Change only how many rounds a match lasts."],
      choices: {
        3: { label: "3 rounds", result: "Three rounds leave no time to read. By generation 14, everyone is a Copycat." },
        10: { label: "10 rounds", result: "Even after 20 generations, the Dice and the Pattern readers split the world almost evenly. When many players are reading, the Dice, who can't be read, hold on." },
        30: { label: "30 rounds", result: "Thirty rounds give the Pattern reader time to learn everyone. By generation 9, everyone is a Pattern reader." },
      },
      end: "Short meetings leave no time to read. Long ones go to the readers.",
    },
    noise: {
      title: "Add mistakes",
      body: ["People make mistakes. This time, a random hand sometimes comes out instead of the one a player meant.", "Matches are 10 rounds again. Pick how often mistakes happen."],
      choices: {
        0: { label: "No mistakes", result: "With no mistakes, everyone is a Pattern reader by generation 12." },
        5: { label: "5%", result: "A few mistakes don't stop the Pattern reader. Everyone is a Pattern reader by generation 11." },
        20: { label: "20%", result: "With frequent mistakes, reading stops working. The Pattern readers die out, and after 20 generations 21 Avengers and 4 Copycats are left." },
      },
      end: "With many mistakes, the Avengers and Copycats, who only look at the last round, held on.",
    },
    draw: {
      title: "Raise the draw points",
      body: ["So far, each round gave +1 for a win, 0 for a draw and −1 for a loss.", "What if a draw is worth 0.5 instead? No mistakes, 10 rounds a match."],
      choices: {
        0: { label: "Draw 0", result: "Same as before. Everyone is a Pattern reader by generation 12." },
        half: { label: "Draw 0.5", result: "Same 25 players, but this time the Avengers take everyone by generation 20." },
      },
      end: "Changing only how points are counted changes which strategy wins.",
    },
    sandbox: {
      title: "Sandbox",
      body: [
        "Now change anything you like. Set how many players each strategy has, and change the match length, mistakes and points. You can pick a variant too.",
        "A new seed gives a different result under the same settings.",
        "The Calculator throws the best mix. In plain rock paper scissors it's the same as the Dice. It only plays differently in variants with many hands or uneven rules.",
      ],
    },
    outro: {
      title: "Wrapping up",
      body: [
        "Strategies beat each other in a cycle too, just like rock paper scissors. The Pattern reader beats the Cycler, the Cycler beats the Avenger, and the Avenger beats the Pattern reader. Nobody stays on top forever.",
        "The Dice, throwing at random, never lose by much. They never win by much either.",
        "People can't throw like dice. Read the other player's habits, and hide your own.",
      ],
      credit: "The format is borrowed from Nicky Case's The Evolution of Trust (2017).",
    },
  },
};

/** 화면을 올리는 커밋에서 도감 '전략 리그'(league)를 이걸로 바꾼다(주소 #/… 는 그대로) */
export const EVO_CATALOG = {
  ko: {
    name: "전략의 진화",
    origin: "컴퓨터끼리",
    about: [
      "컴퓨터 전략 아홉 가지가 리그를 거듭하며 겨룹니다. 꼴찌는 빠지고 1등은 늘어나서, 세대가 지나면 어떤 전략이 퍼지는지 보입니다.",
      "경기 길이, 실수, 점수를 바꾸면 살아남는 전략도 바뀝니다. Nicky Case 의 '신뢰의 진화'처럼 장을 넘기며 직접 해 봅니다.",
    ],
  },
  en: {
    name: "The Evolution of Strategy",
    origin: "Computers only",
    about: [
      "Nine computer strategies play league after league. The bottom players leave and the top ones multiply, so you can see which strategy spreads over the generations.",
      "Change the match length, mistakes or points, and a different strategy survives. Like Nicky Case's The Evolution of Trust, you turn the pages and try it yourself.",
    ],
  },
};
