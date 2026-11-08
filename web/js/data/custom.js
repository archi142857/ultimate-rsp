// '직접 만들기'(RPS-n): 손 개수 n 과 '다음 몇 개를 이기는지' k 로 고리 꼴 규칙을 만든다.

import { makeRng } from "../core/rng.js";
import { lang, t } from "../i18n.js";

export const POOL = [
  ["🐶", "강아지"], ["🐱", "고양이"], ["🐭", "생쥐"], ["🐹", "햄스터"], ["🐰", "토끼"], ["🦊", "여우"], ["🐻", "곰"],
  ["🐼", "판다"], ["🐨", "코알라"], ["🐯", "호랑이"], ["🦁", "사자"], ["🐮", "소"], ["🐷", "돼지"], ["🐸", "개구리"],
  ["🐵", "원숭이"], ["🐔", "닭"], ["🐧", "펭귄"], ["🐦", "새"], ["🐤", "병아리"], ["🦆", "오리"], ["🦅", "독수리"],
  ["🦉", "부엉이"], ["🦇", "박쥐"], ["🐺", "늑대"], ["🐗", "멧돼지"], ["🐴", "말"], ["🦄", "유니콘"], ["🐝", "꿀벌"],
  ["🐛", "애벌레"], ["🦋", "나비"], ["🐌", "달팽이"], ["🐞", "무당벌레"], ["🐜", "개미"], ["🕷️", "거미"], ["🦂", "전갈"],
  ["🐢", "거북"], ["🐍", "뱀"], ["🦎", "도마뱀"], ["🐙", "문어"], ["🦑", "오징어"], ["🦀", "게"], ["🐡", "복어"],
  ["🐠", "열대어"], ["🐬", "돌고래"], ["🐳", "고래"], ["🦈", "상어"], ["🐊", "악어"], ["🐘", "코끼리"], ["🦒", "기린"],
  ["🦓", "얼룩말"], ["🐪", "낙타"], ["🦔", "고슴도치"], ["🌵", "선인장"], ["🌲", "소나무"], ["🌻", "해바라기"], ["🌹", "장미"],
  ["🍄", "버섯"], ["🍀", "네잎클로버"], ["🌙", "달"], ["⭐", "별"], ["☀️", "해"], ["⛅", "구름"], ["🌈", "무지개"],
  ["⚡", "번개"], ["❄️", "눈송이"], ["🔥", "불"], ["💧", "물방울"], ["🌊", "파도"], ["🍎", "사과"], ["🍌", "바나나"],
  ["🍇", "포도"], ["🍉", "수박"], ["🍓", "딸기"], ["🍑", "복숭아"], ["🥕", "당근"], ["🌽", "옥수수"], ["🍞", "식빵"],
  ["🧀", "치즈"], ["🍙", "주먹밥"], ["🍜", "라면"], ["🍦", "아이스크림"], ["🍩", "도넛"], ["🍪", "쿠키"], ["☕", "커피"],
  ["⚽", "축구공"], ["🏀", "농구공"], ["🎈", "풍선"], ["🎲", "주사위"], ["🧩", "퍼즐"], ["🎸", "기타"], ["🥁", "북"],
  ["📚", "책"], ["✏️", "연필"], ["📎", "클립"], ["🔑", "열쇠"], ["🔔", "종"], ["💡", "전구"], ["🧲", "자석"],
  ["🪁", "연"], ["🚀", "로켓"], ["🚲", "자전거"],
];

/** POOL 과 같은 차례의 영어 이름 */
export const POOL_EN = [
  "Puppy", "Cat", "Mouse", "Hamster", "Rabbit", "Fox", "Bear", "Panda",
  "Koala", "Tiger", "Lion", "Cow", "Pig", "Frog", "Monkey", "Chicken",
  "Penguin", "Bird", "Chick", "Duck", "Eagle", "Owl", "Bat", "Wolf",
  "Boar", "Horse", "Unicorn", "Bee", "Caterpillar", "Butterfly", "Snail", "Ladybug",
  "Ant", "Spider", "Scorpion", "Turtle", "Snake", "Lizard", "Octopus", "Squid",
  "Crab", "Blowfish", "Tropical fish", "Dolphin", "Whale", "Shark", "Crocodile", "Elephant",
  "Giraffe", "Zebra", "Camel", "Hedgehog", "Cactus", "Pine", "Sunflower", "Rose",
  "Mushroom", "Four-leaf clover", "Moon", "Star", "Sun", "Cloud", "Rainbow", "Lightning",
  "Snowflake", "Fire", "Droplet", "Wave", "Apple", "Banana", "Grapes", "Watermelon",
  "Strawberry", "Peach", "Carrot", "Corn", "Bread", "Cheese", "Rice ball", "Ramen",
  "Ice cream", "Donut", "Cookie", "Coffee", "Soccer ball", "Basketball", "Balloon", "Die",
  "Puzzle", "Guitar", "Drum", "Books", "Pencil", "Paper clip", "Key", "Bell",
  "Light bulb", "Magnet", "Kite", "Rocket", "Bicycle",
];
const PLURAL_EN = new Set(["Grapes", "Books"]);

export const CUSTOM_MIN = 3;
export const CUSTOM_MAX = POOL.length; // 101

/** n 개 손에서 고를 수 있는 가장 큰 k(이기는 수). 짝수면 맞은편과 비기도록 하나 줄인다 */
export function maxWins(n) {
  return Math.floor((n - 1) / 2);
}

export function makeCustomDef({ n = 7, k = maxWins(n), seed = 1 } = {}) {
  n = Math.max(CUSTOM_MIN, Math.min(CUSTOM_MAX, Math.round(n)));
  k = Math.max(1, Math.min(maxWins(n), Math.round(k)));
  const rng = makeRng(seed);
  const picks = rng.shuffle(POOL.map((_, i) => i)).slice(0, n);
  const en = lang() === "en";
  const hands = picks.map((p, i) => {
    const name = en ? POOL_EN[p] : POOL[p][1];
    return { id: `h${i + 1}`, name, emoji: POOL[p][0], plural: en && PLURAL_EN.has(name) };
  });
  const draws = n - 1 - 2 * k;
  return {
    id: "custom",
    kind: "matrix",
    cat: "more",
    lang: lang(),
    name: `RPS-${n}`,
    origin: t("직접 만들기"),
    hands,
    cycle: k,
    custom: { n, k, seed },
    about: [
      t("손 {n}개가 고리를 이룬다. 손마다 고리에서 다음 {k}개를 이기고 앞의 {k}개에 진다.", { n, k }) +
        (draws > 0 ? t(" 나머지 {d}개와는 비긴다.", { d: draws }) : t(" 같은 손이 아니면 늘 승부가 난다.")),
    ],
  };
}
