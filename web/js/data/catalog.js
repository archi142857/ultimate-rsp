// 도감에 싣는 모든 가위바위보. kind 가 matrix 인 것은 engine.compileVariant 로 바로 판정한다.
// 글은 docs/variants.md 와 같이 고친다(출처도 그쪽에 더 자세히 있다).

import { OBJECT_VERBS } from "./verbs.js";
import { lang, onLang } from "../i18n.js";
import { localizeCatalog } from "./catalog-en.js";

// ── 손 모음 ─────────────────────────────────────────────
const H = {
  scissors: { id: "scissors", art: "hand-scissors", name: "가위", emoji: "✌️", how: "검지와 중지만 펴서 V 자를 만듦" },
  rock: { id: "rock", art: "hand-rock", name: "바위", emoji: "✊", how: "주먹을 쥠" },
  paper: { id: "paper", art: "hand-paper", name: "보", emoji: "✋", how: "다섯 손가락을 모두 폄(보자기)" },
};

const CLASSIC_REL = [
  ["rock", "scissors", "부숨"],
  ["scissors", "paper", "자름"],
  ["paper", "rock", "감쌈"],
];

const O = {
  rock: { id: "rock", name: "바위", emoji: "🪨" },
  fire: { id: "fire", name: "불", emoji: "🔥" },
  scissors: { id: "scissors", name: "가위", emoji: "✂️" },
  snake: { id: "snake", name: "뱀", emoji: "🐍" },
  human: { id: "human", name: "사람", emoji: "🧍" },
  tree: { id: "tree", name: "나무", emoji: "🌳" },
  wolf: { id: "wolf", name: "늑대", emoji: "🐺" },
  sponge: { id: "sponge", name: "스펀지", emoji: "🧽" },
  paper: { id: "paper", name: "종이", emoji: "📄" },
  air: { id: "air", name: "공기", emoji: "🌬️" },
  water: { id: "water", name: "물", emoji: "💧" },
  dragon: { id: "dragon", name: "용", emoji: "🐉" },
  devil: { id: "devil", name: "악마", emoji: "😈" },
  lightning: { id: "lightning", name: "번개", emoji: "⚡" },
  gun: { id: "gun", name: "총", emoji: "🔫" },
  sun: { id: "sun", name: "해", emoji: "☀️" },
  axe: { id: "axe", name: "도끼", emoji: "🪓" },
  monkey: { id: "monkey", name: "원숭이", emoji: "🐒" },
  woman: { id: "woman", name: "여자", emoji: "👩", verbKey: "human" },
  man: { id: "man", name: "남자", emoji: "👨", verbKey: "human" },
  cockroach: { id: "cockroach", name: "바퀴벌레", emoji: "🪳" },
  moon: { id: "moon", name: "달", emoji: "🌙" },
  bowl: { id: "bowl", name: "그릇", emoji: "🥣" },
  alien: { id: "alien", name: "외계인", emoji: "👽" },
  nuke: { id: "nuke", name: "핵폭탄", emoji: "☢️" },
  dynamite: { id: "dynamite", name: "다이너마이트", emoji: "🧨" },
  // RPS-101 에만 나오는 손 (이모지가 없는 것은 가까운 그림으로 대신한다)
  tornado: { id: "tornado", name: "토네이도", emoji: "🌪️" },
  quicksand: { id: "quicksand", name: "모래늪", emoji: "🏜️" },
  pit: { id: "pit", name: "구덩이", emoji: "🕳️" },
  chain: { id: "chain", name: "쇠사슬", emoji: "⛓️" },
  law: { id: "law", name: "법", emoji: "⚖️" },
  whip: { id: "whip", name: "채찍", emoji: "🪢" },
  sword: { id: "sword", name: "칼", emoji: "🗡️" },
  death: { id: "death", name: "죽음", emoji: "💀" },
  wall: { id: "wall", name: "벽", emoji: "🧱" },
  camera: { id: "camera", name: "카메라", emoji: "📷" },
  chainsaw: { id: "chainsaw", name: "전기톱", emoji: "🪚" },
  school: { id: "school", name: "학교", emoji: "🏫" },
  poison: { id: "poison", name: "독", emoji: "🧪" },
  cage: { id: "cage", name: "철창", emoji: "🔒" },
  peace: { id: "peace", name: "평화", emoji: "☮️" },
  computer: { id: "computer", name: "컴퓨터", emoji: "💻" },
  castle: { id: "castle", name: "성", emoji: "🏰" },
  blood: { id: "blood", name: "피", emoji: "🩸" },
  porcupine: { id: "porcupine", name: "호저", emoji: "🦔" },
  vulture: { id: "vulture", name: "독수리", emoji: "🦅" },
  king: { id: "king", name: "왕", emoji: "👑" },
  queen: { id: "queen", name: "여왕", emoji: "🫅" },
  prince: { id: "prince", name: "왕자", emoji: "🤴" },
  princess: { id: "princess", name: "공주", emoji: "👸" },
  police: { id: "police", name: "경찰", emoji: "👮" },
  baby: { id: "baby", name: "아기", emoji: "👶" },
  home: { id: "home", name: "집", emoji: "🏠" },
  train: { id: "train", name: "기차", emoji: "🚆" },
  car: { id: "car", name: "자동차", emoji: "🚗" },
  noise: { id: "noise", name: "소음", emoji: "📢" },
  bicycle: { id: "bicycle", name: "자전거", emoji: "🚲" },
  turnip: { id: "turnip", name: "순무", emoji: "🧅" },
  duck: { id: "duck", name: "오리", emoji: "🦆" },
  cat: { id: "cat", name: "고양이", emoji: "🐈" },
  bird: { id: "bird", name: "새", emoji: "🐦" },
  fish: { id: "fish", name: "물고기", emoji: "🐟" },
  spider: { id: "spider", name: "거미", emoji: "🕷️" },
  brain: { id: "brain", name: "뇌", emoji: "🧠" },
  community: { id: "community", name: "공동체", emoji: "👥" },
  cross: { id: "cross", name: "십자가", emoji: "✝️" },
  money: { id: "money", name: "돈", emoji: "💰" },
  vampire: { id: "vampire", name: "뱀파이어", emoji: "🧛" },
  church: { id: "church", name: "교회", emoji: "⛪" },
  butter: { id: "butter", name: "버터", emoji: "🧈" },
  book: { id: "book", name: "책", emoji: "📖" },
  cloud: { id: "cloud", name: "구름", emoji: "☁️" },
  airplane: { id: "airplane", name: "비행기", emoji: "✈️" },
  grass: { id: "grass", name: "풀", emoji: "🌿" },
  film: { id: "film", name: "필름", emoji: "🎞️" },
  toilet: { id: "toilet", name: "변기", emoji: "🚽" },
  planet: { id: "planet", name: "행성", emoji: "🪐" },
  guitar: { id: "guitar", name: "기타", emoji: "🎸" },
  cup: { id: "cup", name: "컵", emoji: "☕" },
  beer: { id: "beer", name: "맥주", emoji: "🍺" },
  rain: { id: "rain", name: "비", emoji: "🌧️" },
  tv: { id: "tv", name: "텔레비전", emoji: "📺" },
  rainbow: { id: "rainbow", name: "무지개", emoji: "🌈" },
  ufo: { id: "ufo", name: "비행접시", emoji: "🛸" },
  prayer: { id: "prayer", name: "기도", emoji: "🙏" },
  mountain: { id: "mountain", name: "산", emoji: "⛰️" },
  satan: { id: "satan", name: "사탄", emoji: "👿" },
  diamond: { id: "diamond", name: "다이아몬드", emoji: "💎" },
  platinum: { id: "platinum", name: "백금", emoji: "🥈" },
  gold: { id: "gold", name: "금", emoji: "🥇" },
  fence: { id: "fence", name: "울타리", emoji: "🚧" },
  videogame: { id: "videogame", name: "비디오 게임", emoji: "🎮" },
  math: { id: "math", name: "수학", emoji: "🧮" },
  robot: { id: "robot", name: "로봇", emoji: "🤖" },
  heart: { id: "heart", name: "하트", emoji: "❤️" },
  electricity: { id: "electricity", name: "전기", emoji: "🔌" },
  medusa: { id: "medusa", name: "메두사", emoji: "🗿" },
  power: { id: "power", name: "힘", emoji: "💪" },
  laser: { id: "laser", name: "레이저", emoji: "🔦" },
  sky: { id: "sky", name: "하늘", emoji: "🌌" },
  tank: { id: "tank", name: "탱크", emoji: "🪖" },
  helicopter: { id: "helicopter", name: "헬리콥터", emoji: "🚁" },
};
const objs = (ids) => ids.map((id) => O[id]);

const LOVELACE_SRC = { t: "David C. Lovelace, RPS 확장판 모음 (umop.com)", u: "https://www.umop.com/rps.htm" };

// ── 갈래 ─────────────────────────────────────────────
const CATEGORIES_KO = [
  {
    id: "three",
    title: "셋이 물고 물리는 놀이",
    blurb: "규칙은 가위바위보와 같고 손에 담은 이야기가 다릅니다. 일본에서는 이런 놀이를 산스쿠미켄(셋이 서로 꼼짝 못 하는 손 놀이)이라 불렀습니다.",
  },
  {
    id: "more",
    title: "손을 더한 변종",
    blurb: "손을 넷, 다섯, 백한 개까지 늘렸습니다. 고르게 늘린 것도 있고, 일부러 한쪽으로 기울인 것도 있습니다.",
  },
  {
    id: "flow",
    title: "가위바위보 위에 쌓은 놀이",
    blurb: "가위바위보 한 판에 규칙을 더 얹었습니다. 공격과 수비를 바꾸고, 두 손을 내고, 계단을 오릅니다.",
  },
  {
    id: "cousin",
    title: "가위바위보를 닮은 놀이",
    blurb: "손 대신 동전, 주사위, 손가락 수, 병사로 겨룹니다. 어떤 수를 골라도 그 수를 이기는 수가 있습니다.",
  },
  {
    id: "group",
    title: "여럿이 하는 놀이",
    blurb: "셋 이상이 한꺼번에 가위바위보를 합니다. 직접 하거나 여러 사람이 하는 모습을 지켜봅니다.",
  },
  {
    id: "sim",
    title: "시뮬레이션",
    blurb: "컴퓨터 전략끼리 수천 판을 겨루게 하고, 가위바위보처럼 물고 물리는 생물이 어떻게 함께 사는지 봅니다.",
  },
];

// ── 도감 ─────────────────────────────────────────────
const CATALOG_KO = [
  // 셋이 물고 무는 꼴
  {
    id: "classic",
    kind: "matrix",
    cat: "three",
    name: "가위바위보",
    origin: "동아시아에서 세계로",
    hands: [H.scissors, H.rock, H.paper],
    order: ["rock", "scissors", "paper"],
    rel: CLASSIC_REL,
    about: [
      "중국에서 일본으로 건너간 손 놀이가 19세기 말 일본에서 지금의 세 손 모양으로 굳었고, 20세기에 세계로 퍼졌습니다.",
      "한국말 '보'는 종이가 아니라 보자기입니다. 동아시아에서는 편 손바닥을 천으로 봅니다.",
    ],
    aka: [
      ["じゃんけん (잔켄)", "일본"],
      ["石头剪刀布 (스터우 젠다오 부)", "중국"],
      ["Rock paper scissors, Rochambeau", "영어권"],
      ["Bato-bato-pik, Jak-en-poy", "필리핀"],
    ],
    sources: [
      { t: "Wikipedia, Rock paper scissors", u: "https://en.wikipedia.org/wiki/Rock_paper_scissors" },
      { t: "조대현, 가위바위보를 이용한 승부결정과 모의실험 (응용통계연구, 2010)", u: "https://koreascience.kr/article/JAKO201007049666093.pdf" },
    ],
  },
  {
    id: "mushiken",
    kind: "matrix",
    cat: "three",
    name: "무시켄",
    sub: "虫拳, 벌레 권",
    origin: "일본 (중국에서 들어옴)",
    hands: [
      { id: "frog", name: "개구리", emoji: "🐸", how: "엄지를 세움" },
      { id: "snake", name: "뱀", emoji: "🐍", how: "검지를 세움" },
      { id: "slug", name: "민달팽이", emoji: "🐌", how: "새끼손가락을 세움" },
    ],
    order: ["frog", "slug", "snake"],
    rel: [
      ["frog", "slug", "잡아먹음"],
      ["slug", "snake", "녹임"],
      ["snake", "frog", "삼킴"],
    ],
    about: [
      "일본에서 가장 오래된 산스쿠미켄으로, 중국에서 바로 들어왔습니다. 엄지가 개구리, 검지가 뱀, 새끼손가락이 민달팽이입니다.",
      "민달팽이가 뱀을 이기는 건 민달팽이 점액이 뱀을 녹인다는 옛 믿음 때문입니다.",
    ],
    sources: [
      { t: "Wikipedia, Sansukumi-ken", u: "https://en.wikipedia.org/wiki/Sansukumi-ken" },
      { t: "じゃんけんの由来 (オペレーションズ・リサーチ 28권 9호)", u: "https://orsj.org/wp-content/or-archives50/pdf/bul/Vol.28_09_424.pdf" },
    ],
  },
  {
    id: "kitsuneken",
    kind: "matrix",
    cat: "three",
    name: "키츠네켄",
    sub: "狐拳, 여우 권",
    origin: "일본",
    hands: [
      { id: "fox", name: "여우", emoji: "🦊", how: "두 손을 귀처럼 들어 손바닥을 상대에게 보임" },
      { id: "headman", name: "촌장", emoji: "🧓", how: "두 손을 무릎에 얹음" },
      { id: "hunter", name: "사냥꾼", emoji: "🏹", how: "총을 쥐고 겨누는 시늉을 함" },
    ],
    order: ["fox", "headman", "hunter"],
    rel: [
      ["fox", "headman", "홀림"],
      ["headman", "hunter", "부림"],
      ["hunter", "fox", "쏨"],
    ],
    about: [
      "한때 일본에서 가장 널리 하던 산스쿠미켄으로, 도하치켄(東八拳)이라고도 했습니다. 다른 놀이와 달리 두 손을 다 씁니다.",
      "여우는 촌장을 홀리고, 촌장은 사냥꾼을 부리고, 사냥꾼은 여우를 쏩니다.",
    ],
    sources: [
      { t: "Wikipedia, Sansukumi-ken", u: "https://en.wikipedia.org/wiki/Sansukumi-ken" },
      { t: "Old Photos of Japan, Tohachiken", u: "https://www.oldphotosjapan.com/photos/898/tohachiken-kitsuneken-headman-hunter-fox-traditional-japanese-game" },
    ],
  },
  {
    id: "toraken",
    kind: "matrix",
    cat: "three",
    name: "토라켄",
    sub: "虎拳, 호랑이 권",
    origin: "일본",
    hands: [
      { id: "watonai", name: "와토나이", emoji: "⚔️", how: "창을 든 무사 시늉을 함" },
      { id: "tiger", name: "호랑이", emoji: "🐯", how: "엎드려 기는 호랑이 시늉을 함" },
      { id: "mother", name: "어머니", emoji: "👵", how: "지팡이를 짚은 노모 시늉을 함" },
    ],
    order: ["watonai", "tiger", "mother"],
    rel: [
      ["watonai", "tiger", "물리침"],
      ["tiger", "mother", "덮침"],
      ["mother", "watonai", "꾸짖음"],
    ],
    about: [
      "지카마쓰 몬자에몬의 인형극 「국성야 합전(国性爺合戦)」에서 나온 놀이입니다. 호랑이를 물리친 무사 와토나이도 어머니 말은 거스르지 못합니다.",
      "병풍 뒤에 있다가 몸짓을 하며 나와 겨룹니다. 술자리 놀이였습니다.",
    ],
    sources: [
      { t: "じゃんけんの由来 (オペレーションズ・リサーチ 28권 9호)", u: "https://orsj.org/wp-content/or-archives50/pdf/bul/Vol.28_09_424.pdf" },
      { t: "Culture Trip, 11 Japanese drinking games", u: "https://theculturetrip.com/asia/japan/articles/11-japanese-drinking-games-to-try-at-your-peril" },
      { t: "Old Photos of Japan, Tohachiken", u: "https://www.oldphotosjapan.com/photos/898/tohachiken-kitsuneken-headman-hunter-fox-traditional-japanese-game" },
    ],
  },
  {
    id: "suit",
    kind: "matrix",
    cat: "three",
    name: "수트",
    sub: "Suit, 개미·사람·코끼리",
    origin: "인도네시아",
    hands: [
      { id: "elephant", name: "코끼리", emoji: "🐘", how: "엄지를 세움" },
      { id: "human", name: "사람", emoji: "🧑", how: "검지를 세움" },
      { id: "ant", name: "개미", emoji: "🐜", how: "새끼손가락을 세움" },
    ],
    order: ["elephant", "human", "ant"],
    rel: [
      ["elephant", "human", "짓밟음"],
      ["human", "ant", "눌러 잡음"],
      ["ant", "elephant", "괴롭힘"],
    ],
    about: [
      "인도네시아에서는 가위바위보를 흔히 수트(suit)라 부릅니다. 손가락 하나로 코끼리·사람·개미를 내는 수트도 함께 합니다.",
      "작은 개미가 큰 코끼리를 이기는 게 재미입니다. 코나 귀로 기어 들어가 괴롭힌다고 합니다.",
    ],
    sources: [
      { t: "Britannica, How is rock-paper-scissors played in Indonesia?", u: "https://britannica.com/one-good-fact/how-is-rock-paper-scissors-played-in-indonesia" },
      { t: "Wikipedia, Rock paper scissors", u: "https://en.wikipedia.org/wiki/Rock_paper_scissors" },
    ],
  },
  {
    id: "birdwaterstone",
    kind: "matrix",
    cat: "three",
    name: "새·물·돌",
    origin: "말레이시아·싱가포르",
    hands: [
      { id: "bird", name: "새", emoji: "🐦", how: "손끝을 모아 부리처럼 만듦" },
      { id: "water", name: "물", emoji: "💧", how: "손을 폄(보와 같음)" },
      { id: "stone", art: "rock", name: "돌", emoji: "🪨", how: "주먹을 쥠" },
    ],
    order: ["bird", "water", "stone"],
    rel: [
      ["bird", "water", "마심"],
      ["water", "stone", "가라앉힘"],
      ["stone", "bird", "맞혀 떨어뜨림"],
    ],
    about: [
      "가위 자리에 새, 보 자리에 물이 들어갑니다. 새는 물을 마시고, 물은 돌을 가라앉히고, 돌은 새를 맞힙니다.",
      "말레이시아에서는 'One, Two, Zum' 하고 외치며 냅니다.",
    ],
    sources: [
      { t: "Campus.sg, Rock paper scissors and Ji Gu Pa", u: "https://www.campus.sg/rock-paper-scissors-and-ji-gu-pa-are-more-than-just-games-campus-sg" },
      { t: "Cats at Cards, Rock Paper Scissors", u: "https://catsatcards.com/Games/RPS.html" },
    ],
  },
  {
    id: "bearhunterninja",
    kind: "matrix",
    cat: "three",
    name: "곰·사냥꾼·닌자",
    origin: "몸으로 하는 놀이",
    hands: [
      { id: "hunter", name: "사냥꾼", emoji: "🏹", how: "총을 겨눔" },
      { id: "bear", name: "곰", emoji: "🐻", how: "두 팔을 들어 덮칠 듯이 섬" },
      { id: "ninja", name: "닌자", emoji: "🥷", how: "칼을 뽑아 듦" },
    ],
    order: ["hunter", "bear", "ninja"],
    rel: [
      ["hunter", "bear", "쏨"],
      ["bear", "ninja", "덮침"],
      ["ninja", "hunter", "해치움"],
    ],
    about: [
      "손 대신 몸 전체로 합니다. 등을 맞대고 섰다가 신호에 맞춰 돌아서며 자세를 잡습니다.",
      "사냥꾼은 곰을 쏘고, 곰은 닌자를 덮치고, 닌자는 사냥꾼을 해치웁니다.",
    ],
    sources: [
      { t: "Wikipedia, Rock paper scissors", u: "https://en.wikipedia.org/wiki/Rock_paper_scissors" },
      { t: "Campus.sg, Rock paper scissors and Ji Gu Pa", u: "https://www.campus.sg/rock-paper-scissors-and-ji-gu-pa-are-more-than-just-games-campus-sg" },
    ],
  },
  {
    id: "tigerstickchicken",
    kind: "matrix",
    cat: "three",
    name: "호랑이·막대기·닭",
    sub: "老虎·棒子·鸡",
    origin: "중국",
    hands: [
      { id: "stick", name: "막대기", emoji: "🪵" },
      { id: "tiger", name: "호랑이", emoji: "🐯" },
      { id: "chicken", name: "닭", emoji: "🐔" },
    ],
    order: ["stick", "tiger", "chicken"],
    rel: [
      ["stick", "tiger", "때려잡음"],
      ["tiger", "chicken", "잡아먹음"],
      ["chicken", "stick", "쪼아 부숨"],
    ],
    about: [
      "손 대신 말로 합니다. 젓가락을 세 번 맞부딪친 뒤 셋 가운데 하나를 외칩니다. 아이들도 하고 술자리에서도 합니다.",
      "막대기가 호랑이를 이기는 건 몽둥이로 호랑이를 때려잡은 무송 이야기 덕분입니다.",
    ],
    sources: [{ t: "USC Digital Folklore Archives, Game – China", u: "https://folklore.usc.edu/game-china/" }],
  },
  {
    id: "giantwizardelf",
    kind: "matrix",
    cat: "three",
    name: "거인·마법사·요정",
    sub: "Giants, Wizards, Elves",
    origin: "영미권 단체 놀이",
    hands: [
      { id: "giant", name: "거인", emoji: "🧌", how: "발끝으로 서서 두 팔을 높이 올림" },
      { id: "wizard", name: "마법사", emoji: "🧙", how: "몸을 뒤로 젖히고 손가락을 뻗어 주문을 외움" },
      { id: "elf", name: "요정", emoji: "🧝", how: "공처럼 몸을 웅크림" },
    ],
    order: ["giant", "elf", "wizard"],
    rel: [
      ["giant", "elf", "밟음"],
      ["elf", "wizard", "속임"],
      ["wizard", "giant", "마법으로 묶음"],
    ],
    about: [
      "스카우트와 체육 수업에서 하는 단체 놀이입니다. 두 편이 몰래 하나를 정해 다 같이 냅니다. 진 편은 제 선으로 달아나고 이긴 편이 잡으러 갑니다. 잡히면 상대 편이 됩니다.",
      "거인은 요정을 밟고, 요정은 마법사를 속이고, 마법사는 거인을 마법으로 묶습니다. 방향을 거꾸로 적은 자료도 있습니다.",
    ],
    sources: [
      { t: "Scouts, Giants, wizards and elves", u: "https://www.scouts.org.uk/activities/giants-wizards-and-elves/" },
      { t: "The Physical Educator, Giants, Elves, & Wizards", u: "https://thephysicaleducator.com/game/giants-elves-wizards" },
      { t: "Scouts Canada, Giants Wizards Elves", u: "https://scouts.ca/resources/activity-finder/giants-wizards-elves.html" },
    ],
  },
  {
    id: "grandmawarriordragon",
    kind: "matrix",
    cat: "three",
    name: "할머니·용사·용",
    sub: "Oma, Krieger, Drache",
    origin: "독일",
    hands: [
      { id: "grandma", art: "mother", name: "할머니", emoji: "👵", how: "검지를 들어 나무라며 몸을 한 바퀴 돌림" },
      { id: "warrior", name: "용사", emoji: "⚔️", how: "싸우는 자세로 칼을 휘두름" },
      { id: "dragon", name: "용", emoji: "🐉", how: "두 팔을 벌리고 크게 으르렁댐" },
    ],
    order: ["dragon", "grandma", "warrior"],
    rel: [
      ["dragon", "grandma", "잡아먹음"],
      ["grandma", "warrior", "꾸짖음"],
      ["warrior", "dragon", "벰"],
    ],
    about: [
      "두 편이 3~4m 떨어져 서서 몰래 하나를 정합니다. 잡힌 사람은 상대 편으로 가고, 한 편에 아무도 남지 않으면 끝납니다.",
      "용은 할머니를 잡아먹고, 할머니는 용사를 꾸짖어 이기고, 용사는 용을 벱니다. 토라켄의 무사처럼 용을 이기는 용사도 꾸중에는 집니다.",
    ],
    sources: [{ t: "youngstarswiki, Oma, Krieger, Drache", u: "https://youngstarswiki.org/es/print/pdf/node/709" }],
  },
  {
    id: "bearfishmosquito",
    kind: "matrix",
    cat: "three",
    name: "곰·물고기·모기",
    sub: "Bear, Fish, Mosquito",
    origin: "캐나다 캘거리",
    hands: [
      { id: "bear", name: "곰", emoji: "🐻", how: "두 손을 들고 손가락을 발톱처럼 구부림" },
      { id: "fish", name: "물고기", emoji: "🐟", how: "두 손바닥을 모아 헤엄치듯 움직임" },
      { id: "mosquito", name: "모기", emoji: "🦟", how: "검지를 앞으로 뻗음" },
    ],
    order: ["bear", "fish", "mosquito"],
    rel: [
      ["bear", "fish", "잡음"],
      ["fish", "mosquito", "잡아먹음"],
      ["mosquito", "bear", "물어 버림"],
    ],
    about: [
      "캘거리 시가 그 고장 동물로 하는 가위바위보로 소개했습니다. 미국 체육 수업에서는 몸풀기로 합니다.",
      "곰은 물고기를 잡고, 물고기는 모기를 잡아먹고, 모기는 곰을 뭅니다. 가장 작은 모기가 가장 큰 곰을 이깁니다.",
    ],
    sources: [
      { t: "City of Calgary, Bear, Fish, Mosquito", u: "https://calgary.ca/parks-rec-programs/at-home/bear-fish-mosquito.html" },
      { t: "Gopher PE blog, Rock-Paper-Scissors Warm-Up", u: "https://blog.gophersport.com/rock-paper-scissors-warm-up/" },
    ],
  },
  {
    id: "greetings",
    kind: "matrix",
    cat: "three",
    name: "악수·주먹 인사·포옹",
    sub: "Wow, this is awkward!",
    origin: "미국 청소년 모임",
    hands: [
      { id: "handshake", name: "악수", emoji: "🤝", how: "손을 내밀어 악수를 청함" },
      { id: "fistbump", name: "주먹 인사", emoji: "👊", how: "주먹을 앞으로 뻗음" },
      { id: "hug", name: "포옹", emoji: "🫂", how: "두 팔을 벌림" },
    ],
    order: ["handshake", "fistbump", "hug"],
    rel: [
      ["handshake", "fistbump", "감쌈"],
      ["fistbump", "hug", "막아 냄"],
      ["hug", "handshake", "끌어안음"],
    ],
    about: [
      "둘이 등을 맞대고 셋을 센 뒤 돌아서며 인사 하나를 건넵니다. 진 사람은 이긴 사람의 인사를 따라 하고, 둘이 같이 \"와, 이거 어색하다!\"를 외칩니다.",
      "악수는 주먹 인사를, 주먹 인사는 포옹을, 포옹은 악수를 이깁니다. 이긴 사람끼리 다시 겨뤄 한 명이 남을 때까지 합니다.",
    ],
    sources: [{ t: "YouthWorker, Wow, this is awkward!", u: "https://youthworker.com/wow-this-is-awkward" }],
  },
  {
    id: "reverse",
    kind: "matrix",
    cat: "three",
    name: "거꾸로 가위바위보",
    sub: "じゃんぽんけん",
    origin: "일본",
    hands: [H.scissors, H.rock, H.paper],
    order: ["scissors", "rock", "paper"],
    rel: [
      ["scissors", "rock", null, "가위가 바위에 부서져서 이김"],
      ["rock", "paper", null, "바위가 보에 싸여서 이김"],
      ["paper", "scissors", null, "보가 가위에 잘려서 이김"],
    ],
    about: [
      "이기고 지는 쪽을 뒤집었습니다. 평소에 지는 손이 이깁니다. 비기는 판은 그대로입니다.",
      "손 모양이 그대로라서, 이기는 손을 떠올린 뒤 한 번 더 뒤집어야 합니다.",
    ],
    sources: [{ t: "Wikipedia (Japanese), じゃんけん", u: "https://ja.wikipedia.org/wiki/%E3%81%98%E3%82%83%E3%82%93%E3%81%91%E3%82%93" }],
  },

  // 손을 더한 꼴
  {
    id: "well",
    kind: "matrix",
    cat: "more",
    name: "우물",
    sub: "Pierre-papier-ciseaux-puits",
    origin: "프랑스",
    hands: [H.scissors, H.rock, H.paper, { id: "well", name: "우물", emoji: "🕳️", how: "엄지와 검지로 동그라미를 만듦" }],
    order: ["rock", "scissors", "paper", "well"],
    rel: [...CLASSIC_REL, ["well", "rock", "빠뜨림"], ["well", "scissors", "빠뜨림"], ["paper", "well", "덮음"]],
    about: [
      "가위·바위·보에 우물을 더했습니다. 바위와 가위는 우물에 빠지고, 보는 우물을 덮습니다.",
      "손이 넷이라 고르지 않습니다. 바위는 어떤 손을 만나도 우물보다 나을 게 없어서, 잘하는 사람은 바위를 내지 않습니다.",
    ],
    sources: [{ t: "Wikipedia, Rock paper scissors (Additional weapons)", u: "https://en.wikipedia.org/wiki/Rock_paper_scissors" }],
  },
  {
    id: "dynamite",
    kind: "matrix",
    cat: "more",
    name: "다이너마이트",
    origin: "놀이터",
    hands: [H.scissors, H.rock, H.paper, { id: "dynamite", name: "다이너마이트", emoji: "🧨", how: "주먹을 쥐고 엄지를 세움(엄지가 심지)" }],
    order: ["rock", "scissors", "paper", "dynamite"],
    rel: [
      ...CLASSIC_REL,
      ["dynamite", "rock", "날려 버림"],
      ["dynamite", "paper", "불사름"],
      ["scissors", "dynamite", null, "가위가 다이너마이트 심지를 자름"],
    ],
    about: [
      "놀이터에서 아이들이 몰래 더하던 손입니다. 바위를 날리고 보를 태우지만, 가위가 심지를 자릅니다. 진지한 대회에서는 반칙입니다.",
      "따져 보면 보는 다이너마이트보다 나을 때가 없습니다. 보를 빼면 바위·가위·다이너마이트 셋이 물고 물리는 고리가 됩니다.",
    ],
    sources: [
      { t: "The Straight Dope, Rock, paper, scissors – dynamite?", u: "https://boards.straightdope.com/t/rock-paper-scissors-dynamite-bird-spock/141800" },
      { t: "The Washington Times (2004), Rock Paper Scissors", u: "https://www.washingtontimes.com/news/2004/dec/10/20041210-120729-4008r/" },
    ],
  },
  {
    id: "firewater",
    kind: "matrix",
    cat: "more",
    name: "불과 물",
    origin: "놀이터",
    hands: [H.scissors, H.rock, H.paper, { id: "fire", name: "불", emoji: "🔥", how: "다섯 손가락을 꼼지락거림" }, { id: "water", name: "물", emoji: "💧" }],
    order: ["rock", "scissors", "paper", "fire", "water"],
    rel: [
      ...CLASSIC_REL,
      ["fire", "scissors", "녹임"],
      ["fire", "rock", "달굼"],
      ["fire", "paper", "태움"],
      ["water", "fire", "끔"],
      ["rock", "water", "가로막음"],
      ["scissors", "water", "가름"],
      ["paper", "water", "빨아들임"],
    ],
    about: [
      "불은 물 말고는 다 이기고, 물은 불만 이깁니다. 가위·바위·보끼리는 그대로입니다.",
      "최적 비율로 내려면 가위·바위·보를 1/9씩, 불과 물을 1/3씩 냅니다. 사람들은 물을 너무 적게 내는 버릇이 있습니다.",
    ],
    sources: [{ t: "Wikipedia, Rock paper scissors (Additional weapons)", u: "https://en.wikipedia.org/wiki/Rock_paper_scissors" }],
  },
  {
    id: "sticktigerchickenworm",
    kind: "matrix",
    cat: "more",
    name: "막대기·호랑이·닭·벌레",
    sub: "棒子·老虎·鸡·虫",
    origin: "중국",
    hands: [
      { id: "stick", name: "막대기", emoji: "🪵" },
      { id: "tiger", name: "호랑이", emoji: "🐯" },
      { id: "chicken", name: "닭", emoji: "🐔" },
      { id: "worm", name: "벌레", emoji: "🐛" },
    ],
    order: ["stick", "tiger", "chicken", "worm"],
    cycle: 1,
    verbs: {
      "stick>tiger": "때려잡음",
      "tiger>chicken": "잡아먹음",
      "chicken>worm": "쪼아 먹음",
      "worm>stick": "갉아 먹음",
    },
    about: [
      "넷이 고리를 이뤄 바로 다음 것만 이깁니다. 막대기는 호랑이를, 호랑이는 닭을, 닭은 벌레를, 벌레는 막대기를 이깁니다.",
      "마주 보는 둘(막대기와 닭, 호랑이와 벌레)은 비깁니다. 그래서 아무렇게나 내면 두 번에 한 번은 비깁니다.",
    ],
    sources: [{ t: "GTPlanet, King of the Jungle", u: "https://gtplanet.net/forum/threads/king-of-the-jungle.306465" }],
  },
  {
    id: "rpsls",
    kind: "matrix",
    cat: "more",
    name: "가위바위보 도마뱀 스팍",
    origin: "미국 (샘 카스·캐런 브라일라)",
    hands: [
      H.scissors,
      H.rock,
      H.paper,
      { id: "lizard", name: "도마뱀", emoji: "🦎", how: "손가락을 모아 입처럼 벌림" },
      { id: "spock", name: "스팍", emoji: "🖖", how: "검지·중지와 약지·새끼를 둘씩 붙이고 가운데를 벌림" },
    ],
    order: ["scissors", "lizard", "paper", "spock", "rock"],
    cycle: 2,
    verbs: {
      "scissors>lizard": "베어 버림",
      "scissors>paper": "자름",
      "lizard>paper": "먹어 버림",
      "lizard>spock": "독으로 쓰러뜨림",
      "paper>spock": "반박함",
      "paper>rock": "감쌈",
      "spock>rock": "증발시킴",
      "spock>scissors": "박살 냄",
      "rock>scissors": "부숨",
      "rock>lizard": "깔아뭉갬",
    },
    about: [
      "샘 카스와 캐런 브라일라가 가위바위보에 도마뱀과 스팍을 더했습니다. 손이 다섯이라 비길 확률이 1/3에서 1/5로 줄어듭니다.",
      "손마다 둘을 이기고 둘에 집니다. 고리에서 바로 다음과 그다음을 이깁니다.",
    ],
    sources: [{ t: "Wikipedia, Rock paper scissors (Additional weapons)", u: "https://en.wikipedia.org/wiki/Rock_paper_scissors" }],
  },
  {
    id: "moropinzee",
    kind: "matrix",
    cat: "more",
    name: "원숭이·로봇·해적·닌자·좀비",
    sub: "Monkey-Robot-Pirate-Ninja-Zombie",
    origin: "작가 Mark Rayner (2010)",
    hands: [
      { id: "monkey", name: "원숭이", emoji: "🐒" },
      { id: "robot", name: "로봇", emoji: "🤖" },
      { id: "pirate", name: "해적", emoji: "🏴‍☠️" },
      { id: "ninja", name: "닌자", emoji: "🥷" },
      { id: "zombie", name: "좀비", emoji: "🧟" },
    ],
    order: ["monkey", "robot", "ninja", "zombie", "pirate"],
    rel: [
      ["monkey", "ninja", "속임"],
      ["monkey", "robot", null, "원숭이가 로봇의 플러그를 뽑음"],
      ["robot", "ninja", "옥죔"],
      ["robot", "zombie", "부숨"],
      ["pirate", "robot", "물에 빠뜨림"],
      ["pirate", "monkey", "칼로 찌름"],
      ["ninja", "pirate", "손날로 내리침"],
      ["ninja", "zombie", "벰"],
      ["zombie", "pirate", "잡아먹음"],
      ["zombie", "monkey", "물어 버림"],
    ],
    about: [
      "작가 마크 레이너가 2010년 블로그에 올렸습니다. 손마다 둘을 이기고 둘에 집니다.",
      "손 다섯이 저마다 둘씩 이기는 고리는 한 가지뿐이라, 이기고 지는 관계가 가위바위보 도마뱀 스팍과 같습니다. 고리 그림을 겹쳐 보면 손 자리만 다릅니다.",
    ],
    sources: [
      {
        t: "Mark A. Rayner, How to Play Monkey-Robot-Pirate-Ninja-Zombie",
        u: "https://www.goodreads.com/author_blog_posts/1206993-how-to-play-monkey-robot-pirate-ninja-zombie-moropinzee",
      },
      { t: "Laughing Squid, Monkey-Pirate-Robot-Ninja-Zombie", u: "https://laughingsquid.com/monkey-pirate-robot-ninja-zombie-an-updated-version-of-rock-paper-scissors/" },
    ],
  },
  {
    id: "rps7",
    kind: "matrix",
    cat: "more",
    name: "RPS-7",
    origin: "David C. Lovelace",
    hands: objs(["rock", "fire", "scissors", "sponge", "paper", "air", "water"]),
    cycle: 3,
    verbs: OBJECT_VERBS,
    about: ["가위·바위·보에 불·스펀지·공기·물을 더했습니다. 손마다 셋을 이기고 셋에 집니다."],
    sources: [{ t: "David C. Lovelace, RPS-7", u: "https://www.umop.com/rps7.htm" }, LOVELACE_SRC],
  },
  {
    id: "rps9",
    kind: "matrix",
    cat: "more",
    name: "RPS-9",
    origin: "David C. Lovelace",
    hands: objs(["rock", "fire", "scissors", "human", "sponge", "paper", "air", "water", "gun"]),
    cycle: 4,
    verbs: OBJECT_VERBS,
    about: ["RPS-7에 사람과 총을 더했습니다. 손마다 넷을 이기고 넷에 집니다."],
    sources: [{ t: "David C. Lovelace, RPS-9", u: "https://www.umop.com/rps9.htm" }, LOVELACE_SRC],
  },
  {
    id: "rps11",
    kind: "matrix",
    cat: "more",
    name: "RPS-11",
    origin: "David C. Lovelace",
    hands: objs(["rock", "fire", "scissors", "human", "wolf", "sponge", "paper", "air", "water", "devil", "gun"]),
    cycle: 5,
    verbs: OBJECT_VERBS,
    about: ["RPS-9에 늑대와 악마를 더했습니다. 손마다 다섯을 이기고 다섯에 집니다."],
    sources: [{ t: "David C. Lovelace, RPS-11", u: "https://www.umop.com/rps11.htm" }, LOVELACE_SRC],
  },
  {
    id: "rps15",
    kind: "matrix",
    cat: "more",
    name: "RPS-15",
    origin: "David C. Lovelace",
    hands: objs(["rock", "fire", "scissors", "snake", "human", "tree", "wolf", "sponge", "paper", "air", "water", "dragon", "devil", "lightning", "gun"]),
    cycle: 7,
    verbs: OBJECT_VERBS,
    about: ["RPS-11에 뱀·나무·용·번개를 더했습니다. 손마다 일곱을 이기고 일곱에 집니다. 고리 그림이 열다섯 꼭짓점 별이 됩니다."],
    sources: [{ t: "David C. Lovelace, RPS-15", u: "https://www.umop.com/rps15.htm" }, LOVELACE_SRC],
  },
  {
    id: "rps25",
    kind: "matrix",
    cat: "more",
    name: "RPS-25",
    origin: "David C. Lovelace",
    hands: objs([
      "rock", "sun", "fire", "scissors", "axe", "snake", "monkey", "woman", "man", "tree", "cockroach", "wolf", "sponge",
      "paper", "moon", "air", "bowl", "water", "alien", "dragon", "devil", "lightning", "nuke", "dynamite", "gun",
    ]),
    cycle: 12,
    verbs: OBJECT_VERBS,
    about: [
      "사람을 남자와 여자로 나누고, 해·달·원숭이·바퀴벌레·외계인·핵폭탄 같은 손을 더했습니다. 손마다 열둘을 이기고 열둘에 집니다. 비길 확률은 1/25, 4%입니다.",
      "러브레이스는 이어서 손 101개짜리 RPS-101을 만들었습니다.",
    ],
    sources: [{ t: "David C. Lovelace, RPS-25", u: "https://www.umop.com/rps25.htm" }, LOVELACE_SRC],
  },
  {
    id: "rps101",
    kind: "matrix",
    cat: "more",
    name: "RPS-101",
    origin: "David C. Lovelace",
    hands: objs([
      "dynamite", "tornado", "quicksand", "pit", "chain", "gun", "law", "whip", "sword", "rock",
      "death", "wall", "sun", "camera", "fire", "chainsaw", "school", "scissors", "poison", "cage",
      "axe", "peace", "computer", "castle", "snake", "blood", "porcupine", "vulture", "monkey", "king",
      "queen", "prince", "princess", "police", "woman", "baby", "man", "home", "train", "car",
      "noise", "bicycle", "tree", "turnip", "duck", "wolf", "cat", "bird", "fish", "spider",
      "cockroach", "brain", "community", "cross", "money", "vampire", "sponge", "church", "butter", "book",
      "paper", "cloud", "airplane", "moon", "grass", "film", "toilet", "air", "planet", "guitar",
      "bowl", "cup", "beer", "rain", "water", "tv", "rainbow", "ufo", "alien", "prayer",
      "mountain", "satan", "dragon", "diamond", "platinum", "gold", "devil", "fence", "videogame", "math",
      "robot", "heart", "electricity", "lightning", "medusa", "power", "laser", "nuke", "sky", "tank",
      "helicopter",
    ]),
    cycle: 50,
    verbs: OBJECT_VERBS,
    about: [
      "러브레이스가 RPS-25 다음에 1년 가까이 들여 만들었습니다. 손마다 50개를 이기고 50개에 집니다. 승부가 나는 짝은 5,050가지입니다.",
      "RPS-25의 손을 모두 담았지만 그대로 늘린 것은 아닙니다. 늑대와 핵폭탄은 승부가 뒤집혀서 여기서는 핵폭탄이 늑대를 이깁니다.",
      "러브레이스는 짝마다 이기는 까닭을 한 문장씩 썼습니다. 이 앱은 RPS-15 손끼리 만날 때만 새로 쓴 문장을 보여 주고, 나머지는 '이김'으로 적습니다.",
      "채찍·전기톱·철창·순무·백금·울타리·메두사·레이저·탱크처럼 이모지가 없는 손은 가까운 그림으로 대신했습니다.",
    ],
    sources: [
      { t: "David C. Lovelace, RPS-101", u: "https://www.umop.com/rps101.htm" },
      { t: "David C. Lovelace, RPS-101 판정 5,050가지", u: "https://www.umop.com/rps101/alloutcomes.htm" },
    ],
  },
  {
    id: "custom",
    kind: "custom",
    cat: "more",
    name: "직접 만들기",
    sub: "RPS-n",
    origin: "고리 규칙으로",
    about: [
      "손 개수를 정하면 고리 규칙을 만들어 줍니다. 손마다 고리에서 다음 몇 개를 이깁니다.",
      "이기는 개수를 가장 크게 잡으면 손이 홀수일 때는 같은 손끼리만 비깁니다. 짝수일 때는 맞은편 손과도 비깁니다.",
    ],
  },

  // 가위바위보 위에 쌓은 놀이
  {
    id: "mukjjippa",
    kind: "game",
    cat: "flow",
    name: "묵찌빠",
    origin: "한국",
    base: "classic",
    about: [
      "가위바위보로 공격을 정합니다. 공격이 '묵!(바위)', '찌!(가위)', '빠!(보)' 하고 외치며 손을 바꿀 때 수비도 같이 바꿉니다.",
      "수비가 공격과 같은 손을 내면 공격이 이깁니다. 다르면 그 손끼리 가위바위보를 해서 이긴 쪽이 공격이 됩니다.",
    ],
    sources: [
      { t: "Wikipedia, Muk-jji-ppa", u: "https://en.wikipedia.org/wiki/Muk-jji-ppa" },
      { t: "Hancinema, Play muk-zzi-ppa!", u: "https://www.hancinema.net/play-muk-zzi-ppa-the-upgraded-rock-paper-scissors-30907.html" },
    ],
  },
  {
    id: "acchimuite",
    kind: "game",
    cat: "flow",
    name: "아치무이테호이",
    sub: "あっち向いてホイ",
    origin: "일본",
    base: "classic",
    about: [
      "가위바위보에 이긴 사람이 '아치무이테 호이!' 하며 위·아래·왼쪽·오른쪽 가운데 하나를 가리키고, 진 사람은 같은 순간 고개를 돌립니다.",
      "가리킨 쪽으로 고개를 돌리면 집니다. 다른 쪽이면 다시 가위바위보부터 합니다.",
    ],
    sources: [
      { t: "国際交流基金 エリンが挑戦!, あっちむいてホイ!", u: "https://www.erin.jpf.go.jp/materials/let-us-try/download/erin_lesson07_let-us-try_explanation_pt.pdf" },
      { t: "RAG Music, あっちむいてほい", u: "https://www.ragnet.co.jp/line-games/6" },
    ],
  },
  {
    id: "minusone",
    kind: "game",
    cat: "flow",
    name: "하나빼기",
    sub: "가위바위보 하나 빼기",
    origin: "한국",
    base: "classic",
    about: [
      "두 손으로 동시에 가위바위보를 냅니다. 서로 두 손을 본 뒤 '하나 빼기!'에 한 손을 거두고, 남은 손끼리 겨룹니다. 비기면 처음부터 다시 합니다.",
      "「오징어 게임」 시즌 2에 나와 널리 알려졌습니다.",
    ],
    sources: [
      { t: "Wikipedia, Rock paper scissors (Regional versions)", u: "https://en.wikipedia.org/wiki/Rock_paper_scissors" },
      { t: "TV리포트, '오징어게임2' 미리보기", u: "https://tvreport.co.kr/movie/article/871051/" },
    ],
  },
  {
    id: "glico",
    kind: "game",
    cat: "flow",
    name: "글리코",
    sub: "グリコ, 계단 가위바위보",
    origin: "일본",
    base: "classic",
    about: [
      "계단 아래에서 가위바위보를 하고, 이긴 사람만 이긴 손에 따라 오릅니다. 바위는 グ·リ·コ 3칸, 가위는 チ·ヨ·コ·レ·イ·ト 6칸, 보는 パ·イ·ナ·ツ·プ·ル 6칸입니다.",
      "먼저 꼭대기에 닿으면 이깁니다. 칸 수가 달라서 셋을 같은 비율로 내는 게 더는 최선이 아닙니다.",
    ],
    sources: [
      { t: "栃木県, じゃんけんグリコ", u: "https://www.pref.tochigi.lg.jp/m12/education/sports/genkikids/documents/jump7.pdf" },
      { t: "岐阜大学, グリコじゃんけんのミニマックス原理", u: "https://www1.gifu-u.ac.jp/~math/gifumathj/2011-1-9.pdf" },
    ],
  },
  {
    id: "limited",
    kind: "game",
    cat: "flow",
    name: "한정 가위바위보",
    sub: "카드 12장과 별 3개",
    origin: "일본 만화",
    base: "classic",
    about: [
      "가위·바위·보 카드를 4장씩 12장, 별을 3개씩 들고 시작합니다. 한 판에 카드 한 장씩 같이 내고, 이기면 상대 별 하나를 가져옵니다.",
      "서로 남은 카드 수가 보입니다. 카드를 다 쓰면 별이 많은 쪽이 이기고, 별을 다 잃으면 바로 집니다. 만화 「도박묵시록 카이지」의 '한정 가위바위보'를 둘이 하는 놀이로 줄였습니다.",
    ],
    sources: [{ t: "TVDB, 逆境無頼カイジ 1화 줄거리", u: "https://thetvdb.com/series/kaiji/episodes/357041" }],
  },
  {
    id: "dynamitewb",
    kind: "game",
    cat: "flow",
    name: "다이너마이트와 물풍선",
    origin: "프로그래밍 봇 대회",
    about: [
      "다이너마이트는 가위·바위·보를 모두 이기지만 몇 개만 쓸 수 있고, 물풍선은 다이너마이트만 이기고 나머지에는 집니다.",
      "봇끼리 겨루는 프로그래밍 대회에서 쓰던 규칙입니다. 이 앱에서는 비긴 판의 점수를 다음 판으로 넘길 수 있게 했습니다. 켜면 비긴 다음 판이 무거워져서 다이너마이트를 언제 쓸지가 승부를 가릅니다.",
    ],
    sources: [
      { t: "Microsoft, Take the Rock Paper Azure Challenge", u: "https://learn.microsoft.com/es-es/archive/blogs/peterlau/take-the-rock-paper-azure-challenge" },
      { t: "DEV Community, Rock, Paper, Scissors – Scala", u: "https://dev.to/darbyo/rock-paper-scissors---scala-b37" },
    ],
  },
  {
    id: "command",
    kind: "game",
    cat: "flow",
    name: "명령 가위바위보",
    sub: "이겨라, 져라, 비겨라",
    origin: "두뇌 훈련",
    base: "classic",
    about: [
      "화면이 손 하나와 '이기기', '지기', '비기기' 가운데 하나를 보여 줍니다. 시킨 대로 되는 손을 빨리 냅니다.",
      "30초 동안 몇 개를 맞히는지 셉니다. 이기는 손뿐 아니라 지는 손과 비기는 손도 바로바로 떠올려야 합니다.",
    ],
  },

  // 11-08 에 더한 놀이. draft: true 는 화면이 생길 때까지 도감에 안 보인다(맨 아래 '언어에 따라 바뀌는 도감' 참고)
  {
    id: "hammer",
    kind: "game",
    cat: "flow",
    name: "뿅망치 가위바위보",
    sub: "たたいて・かぶって・ジャンケンポン",
    origin: "일본",
    base: "classic",
    about: [
      "가위바위보에 이긴 사람은 뿅망치로 상대 머리를 치고, 진 사람은 재빨리 헬멧을 씁니다. 헬멧을 먼저 쓰면 막은 것이고, 가위바위보부터 다시 합니다.",
      "막기 전에 치면 1점이고, 먼저 3점을 내면 이깁니다. 이 앱에서는 이긴 쪽은 '치기', 진 쪽은 '막기'를 누르고, 누가 먼저 눌렀는지로 정합니다.",
    ],
    sources: [
      { t: "RAG Music, たたいてかぶってジャンケンポン", u: "https://www.ragnet.co.jp/freshman-welcome-party-games/8" },
      { t: "App Store, たたいて・かぶって・ジャンケンは自動!", u: "https://apps.apple.com/us/app/id6443710921" },
    ],
  },
  {
    id: "donpappa",
    kind: "game",
    cat: "flow",
    name: "돈파파",
    sub: "ドンパッパ, グリンピース",
    origin: "일본 서쪽",
    base: "classic",
    about: [
      "바위는 그린, 가위는 치린, 보는 파린이라 부릅니다(グリン·チリン·パリン). 가위바위보로 선공을 정합니다. 선공이 '지금 손, 지금 손, 다음 손'을 외치며 세 번 내면, 후공도 박자에 맞춰 같이 냅니다.",
      "셋째 손이 같으면 먼저 '돈!'을 외친 사람이 이깁니다. 다르면 공격과 수비가 바뀝니다. 묵찌빠와 같은 갈래지만, 손이 같을 때 공격이 아니라 먼저 외친 사람이 이깁니다. 간사이에서는 손이 같아지기 전에 외치면 집니다.",
    ],
    sources: [
      { t: "pedia, ドンパッパ", u: "https://pedia.3rd-in.co.jp/wiki/%E3%83%89%E3%83%B3%E3%83%91%E3%83%83%E3%83%91" },
      { t: "東京都, そとあそび図鑑 vol.5 (からだグリンピース)", u: "https://www.sports-tokyo-info.metro.tokyo.lg.jp/suru/hajimeru_sotoasobi_zukan/data/sotoasobi_vol5.pdf" },
    ],
  },
  {
    id: "relay",
    kind: "game",
    cat: "flow",
    name: "가위바위보 릴레이",
    sub: "どんじゃんけん, Hoop Hop Showdown",
    origin: "일본, 미국 체육 수업",
    base: "classic",
    about: [
      "두 편이 길 양 끝 진지에 섭니다. 한 명씩 달려 나가 만나면 가위바위보를 합니다. 이긴 사람은 계속 가고, 진 편은 진지에서 다음 사람이 나옵니다. 상대 진지에 먼저 닿는 편이 이깁니다.",
      "FiveThirtyEight의 수학 퍼즐 코너 Riddler가 이 놀이로 문제를 냈습니다. 이 앱 규칙으로 한 칸에 1초, 가위바위보 한 번에 1초로 세면, 칸이 8개일 때 평균 2분쯤 걸립니다.",
    ],
    sources: [
      { t: "栃木県, 元気キッズ「走」プログラム", u: "https://www.pref.tochigi.lg.jp/m12/education/sports/genkikids/documents/run1.pdf" },
      { t: "GAME Watch, どんじゃんけん", u: "https://game.watch.impress.co.jp/docs/news/1138961.html" },
      { t: "The Game Gal, Hoop Hop Showdown", u: "https://www.thegamegal.com/?p=5862" },
      { t: "FiveThirtyEight, The Riddler", u: "https://fivethirtyeight.com/features/how-many-hoops-will-kids-jump-through-to-play-rock-paper-scissors" },
    ],
  },
  {
    id: "ecard",
    kind: "game",
    cat: "flow",
    name: "황제와 노예",
    sub: "E카드",
    origin: "일본 만화",
    about: [
      "황제는 시민을, 시민은 노예를, 노예는 황제를 이깁니다. 시민끼리는 비깁니다. 황제 쪽은 황제 1장과 시민 4장, 노예 쪽은 노예 1장과 시민 4장을 들고 한 장씩 같이 냅니다.",
      "12판을 하고 3판마다 쪽을 바꿉니다. 노예 쪽이 이기면 4점, 황제 쪽이 이기면 1점입니다. 둘 다 최적 비율로 내면 노예 쪽은 다섯 판에 한 번 이깁니다. 그래서 노예 쪽 승리를 4점으로 하면 두 쪽 기대 점수가 같습니다. 만화 「도박묵시록 카이지」의 E카드를 둘이 하는 놀이로 줄였습니다. 만화에서는 노예 쪽이 이기면 5배를 받습니다.",
    ],
    sources: [
      { t: "Kaiji Wiki, E-Card", u: "https://kaiji.fandom.com/wiki/E-Card" },
      { t: "E Card (fan-made web game)", u: "https://ecard-24ah.onrender.com" },
    ],
  },
  {
    id: "shogi",
    kind: "game",
    cat: "flow",
    name: "가위바위보 장기",
    sub: "じゃんけん将棋",
    origin: "일본 앱에서 따옴",
    about: [
      "가로 3칸, 세로 4칸짜리 장기판에 가위·바위·보 말과 왕 말을 놓습니다. 말은 가위바위보로 이기는 상대 말만 잡습니다. 왕은 무엇이든 잡지만 무엇에든 잡힙니다. 같은 말끼리 만나면 움직인 말이 위에 올라타고, 깔린 말은 못 움직입니다.",
      "잡은 말은 잡은 쪽 말이 되어, 차례에 움직이는 대신 빈칸에 놓을 수 있습니다. 상대 왕을 잡으면 이깁니다. 바위는 앞뒤와 양옆, 가위는 대각선, 보는 앞쪽 세 칸과 양옆으로 한 칸씩 갑니다. 일본 앱 「じゃんけん将棋」를 본떠 이 앱에서 규칙을 짰습니다.",
    ],
    sources: [
      { t: "QooApp, じゃんけん将棋", u: "https://m-apps.qoo-app.com/en_us/app/6426" },
      { t: "App Store, 対戦じゃんけん将棋", u: "https://apps.apple.com/jp/app/id1105790821" },
    ],
  },

  // 가위바위보를 닮은 놀이
  {
    id: "penney",
    kind: "game",
    cat: "cousin",
    name: "동전 순서 겨루기",
    sub: "Penney's game",
    origin: "Walter Penney (1969)",
    about: [
      "둘이 동전을 세 번 던졌을 때의 앞뒤 순서를 하나씩 고릅니다(예: 앞앞뒤). 동전을 계속 던져서, 고른 순서가 먼저 나온 사람이 이깁니다.",
      "나중에 고르는 쪽이 늘 유리합니다. 상대 순서의 가운데 것을 뒤집어 맨 앞에 두고, 그 뒤에 상대 순서의 앞 두 개를 붙이면 됩니다. 앞앞앞에는 뒤앞앞으로 맞서 8번에 7번 이깁니다. 어떤 순서에도 그 순서를 이기는 순서가 있어서 가위바위보처럼 고리가 생깁니다.",
    ],
    sources: [
      { t: "Wikipedia, Penney's game", u: "https://en.wikipedia.org/wiki/Penney%27s_game" },
      { t: "Nishiyama, Pattern Matching Probabilities and Paradoxes", u: "https://blogsarchive.sites.haverford.edu/mathproblemsolving/files/2011/06/Penney-Ante.pdf" },
    ],
  },
  {
    id: "dice",
    kind: "game",
    cat: "cousin",
    name: "이상한 주사위",
    sub: "Efron 주사위, Grime 주사위",
    origin: "Bradley Efron, James Grime",
    about: [
      "주사위마다 면에 적힌 눈이 다릅니다. Efron 주사위 넷은 A가 B를, B가 C를, C가 D를, D가 A를 3번에 2번 이깁니다. 그래서 상대가 먼저 고르면, 그 주사위를 이기는 주사위를 고를 수 있습니다.",
      "Grime 주사위 다섯은 하나씩 굴리면 고리가 둘 생깁니다. 둘씩 굴려 합을 겨루면 그 가운데 한 고리가 거꾸로 돕니다. 워런 버핏이 빌 게이츠에게 이런 주사위로 내기를 걸려 한 일화가 있습니다.",
    ],
    sources: [
      { t: "Wikipedia, Intransitive dice", u: "https://en.wikipedia.org/wiki/Intransitive_dice" },
      { t: "SAS blog, Intransitive dice", u: "https://blogs.sas.com/content/iml/2020/11/30/intransitive-dice.html" },
    ],
  },
  {
    id: "morra",
    kind: "game",
    cat: "cousin",
    name: "모라",
    sub: "Morra, 划拳",
    origin: "고대 로마, 중국",
    about: [
      "둘이 동시에 손가락을 0~5개 펴면서, 두 사람 손가락 수의 합을 외칩니다. 한 사람만 맞히면 그 사람이 1점을 얻고, 둘 다 맞히거나 다 틀리면 점수가 없습니다. 3점을 먼저 내면 이깁니다.",
      "고대 로마 때부터 했고, 중국에서는 화취안(划拳)이라 부르며 술자리에서 합니다. 한쪽은 홀, 한쪽은 짝을 맡아 손가락 합이 홀인지 짝인지로 정하는 홀짝 놀이도 있습니다.",
    ],
    sources: [{ t: "Wikipedia, Morra (game)", u: "https://en.wikipedia.org/wiki/Morra_(game)" }],
  },
  {
    id: "blotto",
    kind: "game",
    cat: "cousin",
    name: "블로토 대령",
    sub: "Colonel Blotto",
    origin: "Émile Borel (1921)",
    about: [
      "둘이 병사 10명을 싸움터 3곳에 몰래 나눠 보냅니다. 싸움터마다 많이 보낸 쪽이 이기고, 더 많은 싸움터에서 이긴 쪽이 그 판을 이깁니다. 먼저 3판을 이기면 경기에서 이깁니다.",
      "병사가 넉넉하면 어떻게 나눠도 늘 이길 수는 없습니다. 고르게 나누면 두 곳에 조금씩 더 보낸 쪽에게 지고, 몰아 보내면 다른 곳을 내줍니다. 컴퓨터는 최적 비율에 가깝게 배치를 고릅니다.",
    ],
    sources: [
      { t: "Wikipedia, Blotto game", u: "https://en.wikipedia.org/wiki/Blotto_game" },
      { t: "Colonel Blotto (web game)", u: "https://blotto.incoherency.co.uk" },
    ],
  },

  // 여럿이
  {
    id: "group",
    kind: "game",
    cat: "group",
    name: "여럿이 가위바위보",
    origin: "어디서나",
    base: "classic",
    about: [
      "셋 이상이 한꺼번에 냅니다. 세 가지 손이 다 나오거나 모두 같으면 다시 합니다. 두 가지만 나오면 진 손을 낸 사람이 빠집니다.",
      "사람이 많을수록 승부가 잘 안 납니다. 8명이면 열 번에 아홉 번쯤은 다시 해야 합니다.",
    ],
    sources: [
      { t: "Wikipedia, Rock paper scissors (Multiple players)", u: "https://en.wikipedia.org/wiki/Rock_paper_scissors" },
      { t: "조대현, 두 팀 사이의 가위바위보 게임 (응용통계연구, 2019)", u: "https://koreascience.or.kr/article/JAKO201919341608265.pdf" },
    ],
  },
  {
    id: "train",
    kind: "game",
    cat: "group",
    name: "가위바위보 기차",
    sub: "じゃんけん列車",
    origin: "일본",
    base: "classic",
    about: [
      "가까운 사람과 가위바위보를 해서, 진 사람이 이긴 사람 뒤에 붙어 어깨를 잡습니다. 맨 앞끼리 또 겨뤄 진 쪽 기차가 통째로 뒤에 붙습니다.",
      "모두 한 줄이 되면 끝납니다. 사람이 두 배가 될 때마다 겨루는 차례가 한 번쯤 늘어납니다.",
    ],
    sources: [
      { t: "鳥取県, ジャンケン列車", u: "https://www.pref.tottori.lg.jp/secure/1185102/kosodate-3icebreak.pdf" },
      { t: "RAG Music, じゃんけん列車", u: "https://www.ragnet.co.jp/kids-small-people-games/2" },
    ],
  },
  {
    id: "evolution",
    kind: "game",
    cat: "group",
    name: "진화 가위바위보",
    origin: "모둠 놀이",
    base: "classic",
    about: [
      "모두 알에서 시작합니다. 같은 단계끼리 만나 가위바위보를 하고, 이기면 한 단계 오르고 지면 한 단계 내려갑니다. 알은 더 내려가지 않습니다.",
      "꼭대기에 오른 사람은 빠져서 구경합니다. 더 겨룰 짝이 없으면 끝납니다. 끝나면 단계마다 많아야 한 사람씩 남습니다.",
    ],
    sources: [
      { t: "playmeo, Evolution", u: "https://playmeo.com/?p=1105" },
      { t: "Allegheny College, Evolution", u: "https://sites.allegheny.edu/studentinvolvement/?p=6156" },
    ],
  },

  {
    id: "majority",
    kind: "game",
    cat: "group",
    name: "많은 손 이기기",
    sub: "多い勝ち, 少ない勝ち",
    origin: "일본",
    base: "classic",
    about: [
      "셋 이상이 같이 내고, 가장 많이 나온 손을 낸 사람이 남습니다. 거꾸로 가장 적게 나온 손을 낸 사람이 남는 적은 손 이기기도 있습니다. 가장 많은 손이나 가장 적은 손이 둘 이상이면 다시 합니다.",
      "적은 손 이기기는 미리 짜고 내지 못하게 하려고 합니다. 한 명이 남을 때까지 되풀이하는 게이머 가위바위보는 보드게임에서 선을 정할 때 많이 씁니다. 둘만 남으면 보통 가위바위보로 끝냅니다.",
    ],
    sources: [
      { t: "Wikipedia (Japanese), じゃんけん", u: "https://ja.wikipedia.org/wiki/%E3%81%98%E3%82%83%E3%82%93%E3%81%91%E3%82%93" },
      { t: "thewiki, 가위바위보", u: "https://thewiki.kr/w/%EC%9F%8C%EC%BC%84" },
    ],
  },
  {
    id: "choki",
    kind: "game",
    cat: "group",
    name: "셋 다 나오면 가위 승",
    sub: "チョキじゃんけん",
    origin: "일본",
    base: "classic",
    about: [
      "여럿이 할 때 가위·바위·보가 다 나와 비기면 가위를 낸 사람이 이깁니다. 나머지는 여럿이 가위바위보와 같습니다.",
      "여럿이 가위바위보는 사람이 많을수록 잘 안 끝납니다. 8명이면 열 번에 아홉 번쯤 다시 합니다. 이 규칙은 다시 하는 횟수를 줄이는 대신, 사람이 많을수록 가위가 유리해집니다.",
    ],
    sources: [{ t: "Wikipedia (Japanese), じゃんけん", u: "https://ja.wikipedia.org/wiki/%E3%81%98%E3%82%83%E3%82%93%E3%81%91%E3%82%93" }],
  },
  {
    id: "host",
    kind: "game",
    cat: "group",
    name: "진행자 이기기",
    sub: "審判方式",
    origin: "일본, ZEP 미니 게임",
    base: "classic",
    about: [
      "진행자가 먼저 손을 정하고 모두 각자 냅니다. 진행자에게 지면 빠지고, 이기면 10점, 비기면 5점을 얻고 남습니다. 한 명이 남거나 10판이 끝나면 끝납니다.",
      "끝까지 둘 이상 남으면 점수가 높은 사람이 이깁니다. 메타버스 ZEP의 가위바위보 미니 게임이 이렇게 점수를 줍니다. 남은 사람이 모두 지면 이 앱에서는 그 판을 없던 것으로 합니다.",
    ],
    sources: [
      { t: "Wikipedia (Japanese), じゃんけん", u: "https://ja.wikipedia.org/wiki/%E3%81%98%E3%82%83%E3%82%93%E3%81%91%E3%82%93" },
      { t: "ZEP 공식 가이드, 가위바위보", u: "https://docs.channel.io/zep-guide/ko/articles/%EA%B0%80%EC%9C%84%EB%B0%94%EC%9C%84%EB%B3%B4-f03cf86c" },
    ],
  },
  {
    id: "teamtag",
    kind: "game",
    cat: "group",
    name: "편 가위바위보 술래잡기",
    sub: "Rock Paper Scissors Tag",
    origin: "영미권 체육 수업",
    base: "classic",
    about: [
      "두 편이 몰래 손 하나씩을 정해 다 같이 냅니다. 이긴 편이 쫓고 진 편은 제 선으로 달아납니다. 잡힌 사람은 상대 편이 됩니다.",
      "모두 한 편이 되면 끝납니다. 거인·마법사·요정이나 할머니·용사·용도 원래 이렇게 하는 놀이입니다. 이 앱에서는 진 편 사람이 저마다 반반 확률로 잡히고, 20판이 지나면 사람이 많은 편이 이깁니다.",
    ],
    sources: [
      { t: "Playworks, Rock Paper Scissor Tag", u: "https://playworks.org/game-library/rock-paper-scissor-tag" },
      { t: "Sport Aberdeen, Rock Paper Scissors", u: "https://www.sportaberdeen.co.uk/wp-content/uploads/2020/11/Rock-Paper-Scissors-_-Complete.pdf" },
    ],
  },
  {
    id: "teamsplit",
    kind: "game",
    cat: "group",
    name: "편 가르기",
    sub: "グーパー, 엎어라 뒤집어라",
    origin: "일본, 한국",
    base: "classic",
    about: [
      "모두 바위나 보 하나를 내서 같은 손끼리 한 편이 됩니다. 두 편 수가 같아질 때까지 다시 냅니다. 손바닥을 위나 아래로 하는 일본의 우라오모테(うらおもて)와 한국의 엎어라 뒤집어라도 같은 방법입니다.",
      "10명이 아무렇게나 내면 다섯 대 다섯으로 갈릴 확률이 1/4쯤이라, 평균 네 번은 내야 합니다. 구호는 고장마다 다릅니다.",
    ],
    sources: [
      { t: "Wikipedia (Japanese), じゃんけん", u: "https://ja.wikipedia.org/wiki/%E3%81%98%E3%82%83%E3%82%93%E3%81%91%E3%82%93" },
      {
        t: "prompie, 편 가르기 구호 이야기",
        u: "https://academy.prompie.com/communities/posts/%EC%9D%B4%EA%B1%B4-%EC%A7%80%EC%97%AD%EB%A7%88%EB%8B%A4-%EB%8B%A4%EB%A5%B8%EA%B1%B0%EB%9D%BC%EB%8A%94%EB%8D%B0-9hi8giQr/",
      },
    ],
  },

  // 시뮬레이션
  {
    id: "league",
    kind: "sim",
    cat: "sim",
    // 전략의 진화(장을 넘기는 이야기). 이름·소개는 web/js/sims/evolution-story.js 의 EVO_CATALOG 와 같다(tests/evolution-view.test.mjs)
    name: "전략의 진화",
    origin: "컴퓨터끼리",
    about: [
      "컴퓨터 전략 아홉 가지가 리그를 거듭하며 겨룹니다. 꼴찌는 빠지고 1등은 늘어나서, 세대가 지나면 어떤 전략이 퍼지는지 보입니다.",
      "경기 길이, 실수, 점수를 바꾸면 살아남는 전략도 바뀝니다. Nicky Case 의 '신뢰의 진화'처럼 장을 넘기며 직접 해 봅니다.",
    ],
    sources: [
      { t: "Wang, Xu & Zhou (2014), Social cycling and conditional responses in the Rock-Paper-Scissors game", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5376050/" },
      { t: "Nicky Case (2017), The Evolution of Trust", u: "https://ncase.me/trust/" },
    ],
  },
  {
    id: "lattice",
    kind: "sim",
    cat: "sim",
    name: "자연 속 가위바위보",
    sub: "격자 생태계",
    origin: "도마뱀과 대장균",
    about: [
      "옆줄무늬도마뱀 수컷은 목 색에 따라 주황이 파랑을, 파랑이 노랑을, 노랑이 주황을 이깁니다. 대장균도 독을 만드는 균, 독에 약한 균, 독을 견디는 균이 서로 물고 물립니다.",
      "칸마다 생물이 살고 이웃끼리만 겨루면 셋이 소용돌이를 그리며 함께 삽니다. 많이 돌아다닐수록, 그리고 잘 섞일수록 한 종만 남기 쉽습니다.",
    ],
    sources: [
      { t: "Sinervo & Lively (1996), Nature 380", u: "https://www.nature.com/articles/380240a0" },
      { t: "Kerr, Riley, Feldman & Bohannan (2002), Nature 418", u: "https://www.nature.com/articles/nature00823" },
      { t: "Reichenbach, Mobilia & Frey (2007), Nature 448", u: "https://arxiv.org/abs/0709.0217" },
    ],
  },
  {
    id: "war",
    kind: "sim",
    cat: "sim",
    name: "가위바위보 전쟁",
    origin: "부딪히면 바뀜",
    about: [
      "가위·바위·보가 화면 위를 떠돌다 부딪히면 진 쪽이 이긴 쪽으로 바뀝니다. 한 가지만 남으면 끝납니다.",
      "처음 수가 같아도 매번 다른 손이 이깁니다. 한 가지가 먼저 사라지면 남은 둘 가운데 이기는 쪽이 화면을 다 차지하므로, 우승은 '자기를 이기는 손이 먼저 사라진 손'에게 갑니다.",
    ],
  },
];

// ── 언어에 따라 바뀌는 도감 ─────────────────────
// CATALOG·CATEGORIES 는 지금 언어의 자료를 가리킨다(언어를 바꾸면 새로 가리킨다). 영어판은 catalog-en.js.
// draft: true 인 항목은 화면이 아직 없어서 CATALOG 에서 빼고 DRAFTS 에 둔다. 들어 있는 항목이 없는 갈래도 뺀다.
// 화면을 붙이면 그 항목의 draft 줄을 지운다(프론트엔드가 지워도 된다).
export let CATEGORIES = CATEGORIES_KO;
export let CATALOG = CATALOG_KO;
export let DRAFTS = [];
let english = null;
let korean = null;

function split(categories, entries) {
  const live = entries.filter((e) => !e.draft);
  return {
    categories: categories.filter((c) => live.some((e) => e.cat === c.id)),
    catalog: live,
    drafts: entries.filter((e) => e.draft),
  };
}

function useLang(l) {
  let s;
  if (l === "en") {
    if (!english) {
      const en = localizeCatalog(CATEGORIES_KO, CATALOG_KO, OBJECT_VERBS);
      english = split(en.categories, en.catalog);
    }
    s = english;
  } else {
    korean ||= split(CATEGORIES_KO, CATALOG_KO);
    s = korean;
  }
  CATEGORIES = s.categories;
  CATALOG = s.catalog;
  DRAFTS = s.drafts;
}
useLang(lang());
onLang(useLang);

export function findEntry(id) {
  return CATALOG.find((e) => e.id === id) || null;
}

/** 화면 준비 중인 항목(DRAFTS)까지 찾는다. 화면을 만들 때 쓴다 */
export function findAnyEntry(id) {
  return findEntry(id) || DRAFTS.find((e) => e.id === id) || null;
}
