// 도감에 싣는 모든 가위바위보. kind 가 matrix 인 것은 engine.compileVariant 로 바로 판정한다.
// 글은 docs/variants.md 와 같이 고친다(출처도 그쪽에 더 자세히 있다).

import { OBJECT_VERBS } from "./verbs.js";
import { lang, onLang } from "../i18n.js";
import { localizeCatalog } from "./catalog-en.js";

// ── 손 모음 ─────────────────────────────────────────────
const H = {
  scissors: { id: "scissors", art: "hand-scissors", name: "가위", emoji: "✌️", how: "검지와 중지만 펴서 V 자를 만든다" },
  rock: { id: "rock", art: "hand-rock", name: "바위", emoji: "✊", how: "주먹을 쥔다" },
  paper: { id: "paper", art: "hand-paper", name: "보", emoji: "✋", how: "다섯 손가락을 모두 편다. 보자기다" },
};

const CLASSIC_REL = [
  ["rock", "scissors", "부순다"],
  ["scissors", "paper", "자른다"],
  ["paper", "rock", "감싼다"],
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
  queen: { id: "queen", name: "여왕", emoji: "👸" },
  prince: { id: "prince", name: "왕자", emoji: "🤴" },
  princess: { id: "princess", name: "공주", emoji: "👗" },
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
    title: "셋이 물고 무는 꼴",
    blurb: "규칙은 가위바위보와 같고 손에 담은 이야기가 다르다. 일본에서는 이런 놀이를 산스쿠미켄(셋이 서로 꼼짝 못 하는 손 놀이)이라 불렀다.",
  },
  {
    id: "more",
    title: "손을 더한 꼴",
    blurb: "손을 넷, 다섯, 백한 개까지 늘렸다. 고르게 늘린 판도 있고, 일부러 한쪽으로 기운 판도 있다.",
  },
  {
    id: "flow",
    title: "가위바위보 위에 쌓은 놀이",
    blurb: "가위바위보 한 판으로 끝나지 않는다. 공격과 수비를 바꾸고, 두 손을 내고, 계단을 오른다.",
  },
  {
    id: "group",
    title: "여럿이 하는 놀이",
    blurb: "셋 이상이 한꺼번에 하는 가위바위보. 직접 하거나, 여러 사람이 하는 모습을 지켜본다.",
  },
  {
    id: "sim",
    title: "시뮬레이션",
    blurb: "컴퓨터 전략끼리 수천 판을 겨루게 하고, 가위바위보처럼 서로 물고 무는 생물이 어떻게 함께 사는지 본다.",
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
      "중국에서 일본으로 건너간 손 놀이가 19세기 말 일본에서 지금의 세 손 꼴로 굳었고, 20세기에 세계로 퍼졌다.",
      "한국말 '보'는 종이가 아니라 보자기다. 동아시아에서는 편 손바닥을 천으로 본다.",
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
      { id: "frog", name: "개구리", emoji: "🐸", how: "엄지를 세운다" },
      { id: "snake", name: "뱀", emoji: "🐍", how: "검지를 세운다" },
      { id: "slug", name: "민달팽이", emoji: "🐌", how: "새끼손가락을 세운다" },
    ],
    order: ["frog", "slug", "snake"],
    rel: [
      ["frog", "slug", "잡아먹는다"],
      ["slug", "snake", "녹인다"],
      ["snake", "frog", "삼킨다"],
    ],
    about: [
      "일본에서 가장 오래된 산스쿠미켄으로, 중국에서 바로 들어왔다. 엄지가 개구리, 검지가 뱀, 새끼손가락이 민달팽이다.",
      "민달팽이가 뱀을 이기는 건 민달팽이 점액이 뱀을 녹인다는 옛 믿음 때문이다.",
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
      { id: "fox", name: "여우", emoji: "🦊", how: "두 손을 귀처럼 들어 손바닥을 상대에게 보인다" },
      { id: "headman", name: "촌장", emoji: "🧓", how: "두 손을 무릎에 얹는다" },
      { id: "hunter", name: "사냥꾼", emoji: "🏹", how: "총을 쥐고 겨누는 시늉을 한다" },
    ],
    order: ["fox", "headman", "hunter"],
    rel: [
      ["fox", "headman", "홀린다"],
      ["headman", "hunter", "부린다"],
      ["hunter", "fox", "쏜다"],
    ],
    about: [
      "한때 일본에서 가장 널리 하던 산스쿠미켄으로, 도하치켄(東八拳)이라고도 했다. 다른 놀이와 달리 두 손을 다 쓴다.",
      "여우는 촌장을 홀리고, 촌장은 사냥꾼을 부리고, 사냥꾼은 여우를 쏜다.",
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
      { id: "watonai", name: "와토나이", emoji: "⚔️", how: "창을 든 무사 시늉" },
      { id: "tiger", name: "호랑이", emoji: "🐯", how: "엎드려 기는 호랑이 시늉" },
      { id: "mother", name: "어머니", emoji: "👵", how: "지팡이를 짚은 노모 시늉" },
    ],
    order: ["watonai", "tiger", "mother"],
    rel: [
      ["watonai", "tiger", "물리친다"],
      ["tiger", "mother", "덮친다"],
      ["mother", "watonai", "꾸짖는다"],
    ],
    about: [
      "지카마쓰 몬자에몬의 인형극 「국성야 합전(国性爺合戦)」에서 나온 놀이다. 호랑이를 물리친 무사 와토나이도 어머니 말은 거스르지 못한다.",
      "병풍 뒤에 있다가 몸짓을 하며 나와 겨룬다. 술자리 놀이였다.",
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
      { id: "elephant", name: "코끼리", emoji: "🐘", how: "엄지를 세운다" },
      { id: "human", name: "사람", emoji: "🧑", how: "검지를 세운다" },
      { id: "ant", name: "개미", emoji: "🐜", how: "새끼손가락을 세운다" },
    ],
    order: ["elephant", "human", "ant"],
    rel: [
      ["elephant", "human", "짓밟는다"],
      ["human", "ant", "눌러 잡는다"],
      ["ant", "elephant", "괴롭힌다"],
    ],
    about: [
      "인도네시아에서는 가위바위보를 흔히 수트(suit)라 부르고, 손가락 하나로 코끼리·사람·개미를 내는 꼴도 함께 한다.",
      "작은 개미가 큰 코끼리를 이기는 게 재미다. 코나 귀로 기어 들어가 괴롭힌다고 한다.",
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
      { id: "bird", name: "새", emoji: "🐦", how: "손끝을 모아 부리처럼 만든다" },
      { id: "water", name: "물", emoji: "💧", how: "손을 편다. 보와 같다" },
      { id: "stone", art: "rock", name: "돌", emoji: "🪨", how: "주먹을 쥔다" },
    ],
    order: ["bird", "water", "stone"],
    rel: [
      ["bird", "water", "마신다"],
      ["water", "stone", "가라앉힌다"],
      ["stone", "bird", "맞혀 떨어뜨린다"],
    ],
    about: [
      "가위 자리에 새, 보 자리에 물이 들어간다. 새는 물을 마시고, 물은 돌을 가라앉히고, 돌은 새를 맞힌다.",
      "말레이시아에서는 'One, Two, Zum' 하고 외치며 낸다.",
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
    origin: "몸으로 하는 판",
    hands: [
      { id: "hunter", name: "사냥꾼", emoji: "🏹", how: "총을 겨누는 자세" },
      { id: "bear", name: "곰", emoji: "🐻", how: "두 팔을 들고 덮칠 듯한 자세" },
      { id: "ninja", name: "닌자", emoji: "🥷", how: "칼을 뽑아 든 자세" },
    ],
    order: ["hunter", "bear", "ninja"],
    rel: [
      ["hunter", "bear", "쏜다"],
      ["bear", "ninja", "덮친다"],
      ["ninja", "hunter", "해치운다"],
    ],
    about: [
      "손 대신 몸 전체로 한다. 등을 맞대고 섰다가 신호에 맞춰 돌아서며 자세를 잡는다.",
      "사냥꾼은 곰을 쏘고, 곰은 닌자를 덮치고, 닌자는 사냥꾼을 해치운다.",
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
      ["stick", "tiger", "때려잡는다"],
      ["tiger", "chicken", "잡아먹는다"],
      ["chicken", "stick", "쪼아 부순다"],
    ],
    about: [
      "손 대신 말로 한다. 젓가락을 세 번 맞부딪친 뒤 셋 가운데 하나를 외친다. 아이들도 하고 술자리에서도 한다.",
      "막대기가 호랑이를 이기는 건 몽둥이로 호랑이를 때려잡은 무송 이야기 덕분이다.",
    ],
    sources: [{ t: "USC Digital Folklore Archives, Game – China", u: "https://folklore.usc.edu/game-china/" }],
  },

  // 손을 더한 꼴
  {
    id: "well",
    kind: "matrix",
    cat: "more",
    name: "우물",
    sub: "Pierre-papier-ciseaux-puits",
    origin: "프랑스",
    hands: [H.scissors, H.rock, H.paper, { id: "well", name: "우물", emoji: "🕳️", how: "엄지와 검지로 동그라미를 만든다" }],
    order: ["rock", "scissors", "paper", "well"],
    rel: [...CLASSIC_REL, ["well", "rock", "빠뜨린다"], ["well", "scissors", "빠뜨린다"], ["paper", "well", "덮는다"]],
    about: [
      "가위·바위·보에 우물을 더했다. 바위와 가위는 우물에 빠지고, 보는 우물을 덮는다.",
      "넷이라 고르지 않다. 바위는 어떤 손을 만나도 우물보다 못하거나 같아서, 잘 두는 사람은 바위를 내지 않는다.",
    ],
    sources: [{ t: "Wikipedia, Rock paper scissors (Additional weapons)", u: "https://en.wikipedia.org/wiki/Rock_paper_scissors" }],
  },
  {
    id: "dynamite",
    kind: "matrix",
    cat: "more",
    name: "다이너마이트",
    origin: "놀이터",
    hands: [H.scissors, H.rock, H.paper, { id: "dynamite", name: "다이너마이트", emoji: "🧨", how: "주먹을 쥐고 엄지를 세운다. 엄지가 심지다" }],
    order: ["rock", "scissors", "paper", "dynamite"],
    rel: [
      ...CLASSIC_REL,
      ["dynamite", "rock", "날려 버린다"],
      ["dynamite", "paper", "불사른다"],
      ["scissors", "dynamite", null, "가위가 다이너마이트 심지를 자른다"],
    ],
    about: [
      "놀이터에서 몰래 더하던 손. 바위를 날리고 보를 태우지만, 가위가 심지를 자른다. 진지한 대회에서는 반칙이다.",
      "따져 보면 보는 다이너마이트보다 늘 못하거나 같다. 보를 빼면 바위·가위·다이너마이트가 셋이 물고 무는 꼴이 된다.",
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
    hands: [H.scissors, H.rock, H.paper, { id: "fire", name: "불", emoji: "🔥", how: "다섯 손가락을 꼼지락거린다" }, { id: "water", name: "물", emoji: "💧" }],
    order: ["rock", "scissors", "paper", "fire", "water"],
    rel: [
      ...CLASSIC_REL,
      ["fire", "scissors", "녹인다"],
      ["fire", "rock", "달군다"],
      ["fire", "paper", "태운다"],
      ["water", "fire", "끈다"],
      ["rock", "water", "가로막는다"],
      ["scissors", "water", "가른다"],
      ["paper", "water", "빨아들인다"],
    ],
    about: [
      "불은 물 말고는 다 이기고, 물은 불만 이긴다. 가위·바위·보끼리는 그대로다.",
      "최적 섞기는 가위·바위·보를 1/9씩, 불과 물을 1/3씩 내는 것이다. 사람들은 물을 너무 적게 내는 버릇이 있다.",
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
      "stick>tiger": "때려잡는다",
      "tiger>chicken": "잡아먹는다",
      "chicken>worm": "쪼아 먹는다",
      "worm>stick": "갉아 먹는다",
    },
    about: [
      "넷이 고리를 이뤄 바로 다음 것만 이긴다. 막대기는 호랑이를, 호랑이는 닭을, 닭은 벌레를, 벌레는 막대기를 이긴다.",
      "마주 보는 둘(막대기와 닭, 호랑이와 벌레)은 비긴다. 그래서 아무렇게나 내면 두 번에 한 번은 비긴다.",
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
      { id: "lizard", name: "도마뱀", emoji: "🦎", how: "손가락을 모아 입처럼 벌린다" },
      { id: "spock", name: "스팍", emoji: "🖖", how: "검지·중지와 약지·새끼를 둘씩 붙이고 가운데를 벌린다" },
    ],
    order: ["scissors", "lizard", "paper", "spock", "rock"],
    cycle: 2,
    verbs: {
      "scissors>lizard": "베어 버린다",
      "scissors>paper": "자른다",
      "lizard>paper": "먹어 버린다",
      "lizard>spock": "독으로 쓰러뜨린다",
      "paper>spock": "반박한다",
      "paper>rock": "감싼다",
      "spock>rock": "증발시킨다",
      "spock>scissors": "박살 낸다",
      "rock>scissors": "부순다",
      "rock>lizard": "깔아뭉갠다",
    },
    about: [
      "샘 카스와 캐런 브라일라가 만든 다섯 손 꼴. 손이 다섯이라 비길 확률이 1/3에서 1/5로 준다.",
      "손마다 둘을 이기고 둘에 진다. 고리에서 바로 다음과 그다음을 이긴다.",
    ],
    sources: [{ t: "Wikipedia, Rock paper scissors (Additional weapons)", u: "https://en.wikipedia.org/wiki/Rock_paper_scissors" }],
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
    about: ["가위·바위·보에 불·스펀지·공기·물을 더한 일곱 손 꼴. 손마다 셋을 이기고 셋에 진다."],
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
    about: ["RPS-7 에 사람과 총을 더했다. 손마다 넷을 이기고 넷에 진다."],
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
    about: ["RPS-9 에 늑대와 악마를 더했다. 손마다 다섯을 이기고 다섯에 진다."],
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
    about: ["RPS-11 에 뱀·나무·용·번개를 더했다. 손마다 일곱을 이기고 일곱에 진다. 고리 그림이 열다섯 꼭짓점 별이 된다."],
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
      "사람을 남자와 여자로 나누고 해·달·원숭이·바퀴벌레·외계인·핵폭탄 같은 손을 더한 스물다섯 손 꼴. 손마다 열둘을 이기고 열둘에 진다. 비길 확률은 1/25, 4%다.",
      "러브레이스는 이어서 손 101개짜리 RPS-101 을 만들었다.",
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
      "러브레이스가 RPS-25 다음에 1년 가까이 들여 만든 손 101개짜리 판. 손마다 50개를 이기고 50개에 진다. 승부가 나는 짝은 5,050가지다.",
      "RPS-25 의 손을 모두 담았지만 그대로 늘린 꼴은 아니다. 늑대와 핵폭탄은 승부가 뒤집혀서 여기서는 핵폭탄이 늑대를 이긴다.",
      "러브레이스는 짝마다 이기는 까닭을 한 문장씩 썼다. 이 앱은 RPS-15 손끼리 만날 때만 새로 쓴 문장을 보여 주고, 나머지는 '이긴다'로 적는다.",
      "채찍·전기톱·철창·순무·백금·울타리·메두사·레이저·탱크처럼 이모지가 없는 손은 가까운 그림으로 대신했다.",
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
      "손 개수를 정하면 고리 꼴 규칙을 만든다. 손마다 고리에서 다음 몇 개를 이긴다.",
      "이기는 개수를 가장 크게 잡으면, 손이 홀수일 때는 같은 손끼리가 아니면 늘 승부가 나고 짝수일 때는 맞은편 손과도 비긴다.",
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
      "가위바위보로 공격을 정한다. 공격이 '묵!(바위)', '찌!(가위)', '빠!(보)' 하고 외치며 손을 바꿀 때 수비도 같이 바꾼다.",
      "수비가 공격과 같은 손을 내면 공격이 이긴다. 다르면 그 손끼리 가위바위보를 해서 이긴 쪽이 공격이 된다.",
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
      "가위바위보에 이긴 사람이 '아치무이테 호이!' 하며 위·아래·왼쪽·오른쪽 가운데 하나를 가리키고, 진 사람은 같은 순간 고개를 돌린다.",
      "가리킨 쪽으로 고개를 돌리면 진다. 다른 쪽이면 다시 가위바위보부터 한다.",
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
      "두 손으로 동시에 가위바위보를 낸다. 서로 두 손을 본 뒤 '하나 빼기!'에 한 손을 거두고, 남은 손끼리 겨룬다. 비기면 처음부터 다시 한다.",
      "「오징어 게임」 시즌 2 에 나와 널리 알려졌다.",
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
      "계단 아래에서 가위바위보를 하고, 이긴 사람만 이긴 손에 따라 오른다. 바위로 이기면 グ·リ·コ 3칸, 가위는 チ·ヨ·コ·レ·イ·ト 6칸, 보는 パ·イ·ナ·ツ·プ·ル 6칸.",
      "먼저 꼭대기에 닿으면 이긴다. 칸 수가 달라서 셋을 똑같이 섞는 게 더는 최선이 아니다.",
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
      "가위·바위·보 카드를 4장씩 12장, 별을 3개씩 들고 시작한다. 한 판에 카드 한 장씩 같이 내고, 이기면 상대 별 하나를 가져온다.",
      "서로 남은 카드 수가 보인다. 카드를 다 쓰면 별이 많은 쪽이 이기고, 별을 다 잃으면 바로 진다. 만화 「도박묵시록 카이지」의 '한정 가위바위보'를 둘이 하는 판으로 줄였다.",
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
      "다이너마이트는 가위·바위·보를 모두 이기지만 몇 개만 쓸 수 있고, 물풍선은 다이너마이트만 이기고 나머지에는 진다.",
      "봇끼리 겨루는 프로그래밍 대회에서 쓰던 규칙이다. 이 앱에서는 비긴 판의 점수를 다음 판으로 넘길 수 있게 했다. 켜면 비긴 다음 판이 무거워져서 다이너마이트를 언제 쓸지가 승부를 가른다.",
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
      "화면이 손 하나와 '이겨라', '져라', '비겨라' 가운데 하나를 보여 준다. 시킨 대로 되는 손을 빨리 낸다.",
      "30초 동안 몇 개를 맞히는지 센다. 이기는 손뿐 아니라 지는 손과 비기는 손도 바로바로 떠올려야 한다.",
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
      "셋 이상이 한꺼번에 낸다. 세 가지 손이 다 나오거나 모두 같으면 다시 한다. 두 가지만 나오면 진 손을 낸 사람이 빠진다.",
      "사람이 많을수록 승부가 잘 안 난다. 8명이면 열 번에 아홉 번쯤은 다시 해야 한다.",
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
      "가까운 사람과 가위바위보를 해서, 진 사람이 이긴 사람 뒤에 붙어 어깨를 잡는다. 맨 앞끼리 또 겨뤄 진 쪽 기차가 통째로 뒤에 붙는다.",
      "모두가 한 줄이 되면 끝. 사람이 두 배가 될 때마다 겨루는 차례가 한 번쯤 는다.",
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
      "모두 알에서 시작한다. 같은 단계끼리 만나 가위바위보를 하고, 이기면 한 단계 오르고 지면 한 단계 내려간다. 알은 더 내려가지 않는다.",
      "꼭대기에 오른 사람은 빠져서 구경한다. 더 겨룰 짝이 없으면 끝나는데, 끝나면 단계마다 많아야 한 사람씩 남는다.",
    ],
    sources: [
      { t: "playmeo, Evolution", u: "https://playmeo.com/?p=1105" },
      { t: "Allegheny College, Evolution", u: "https://sites.allegheny.edu/studentinvolvement/?p=6156" },
    ],
  },

  // 시뮬레이션
  {
    id: "league",
    kind: "sim",
    cat: "sim",
    name: "전략 리그",
    origin: "컴퓨터끼리",
    about: [
      "컴퓨터 전략들이 서로 수천 판씩 겨룬다. 아무렇게나 내는 전략은 누구에게도 크게 지지 않고, 버릇이 있는 전략은 그 버릇을 읽는 전략에게 진다.",
      "전략끼리도 가위바위보처럼 물고 무는 사이가 생긴다.",
    ],
    sources: [{ t: "Wang, Xu & Zhou (2014), Social cycling and conditional responses in the Rock-Paper-Scissors game", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5376050/" }],
  },
  {
    id: "lattice",
    kind: "sim",
    cat: "sim",
    name: "자연 속 가위바위보",
    sub: "격자 생태계",
    origin: "도마뱀과 대장균",
    about: [
      "옆줄무늬도마뱀 수컷은 목 색에 따라 주황이 파랑을, 파랑이 노랑을, 노랑이 주황을 이긴다. 대장균도 독을 만드는 균, 독에 약한 균, 독을 견디는 균이 서로 물고 문다.",
      "칸마다 생물이 살고 이웃끼리만 겨루면 셋이 소용돌이를 그리며 함께 산다. 많이 돌아다닐수록, 그리고 잘 섞일수록 한 종만 남기 쉽다.",
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
    origin: "부딪히면 바뀐다",
    about: [
      "가위·바위·보가 판 위를 떠돌다 부딪히면 진 쪽이 이긴 쪽으로 바뀐다. 한 가지만 남으면 끝난다.",
      "처음 수가 같아도 매번 다른 손이 이긴다. 한 가지가 먼저 사라지면 남은 둘 가운데 이기는 쪽이 판을 다 차지하므로, 우승은 '자기를 이기는 손이 먼저 사라진 손'에게 간다.",
    ],
  },
];

// ── 언어에 따라 바뀌는 도감 ─────────────────────
// CATALOG·CATEGORIES 는 지금 언어의 자료를 가리킨다(언어를 바꾸면 새로 가리킨다). 영어판은 catalog-en.js.
export let CATEGORIES = CATEGORIES_KO;
export let CATALOG = CATALOG_KO;
let english = null;

function useLang(l) {
  if (l === "en") {
    english ||= localizeCatalog(CATEGORIES_KO, CATALOG_KO, OBJECT_VERBS);
    CATEGORIES = english.categories;
    CATALOG = english.catalog;
  } else {
    CATEGORIES = CATEGORIES_KO;
    CATALOG = CATALOG_KO;
  }
}
useLang(lang());
onLang(useLang);

export function findEntry(id) {
  return CATALOG.find((e) => e.id === id) || null;
}
