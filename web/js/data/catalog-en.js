// 도감 영문판: catalog.js 의 한국어 자료 위에 덮어 쓸 영어. 판정 동사는 3인칭 단수 꼴로 적는다
// (주어가 복수인 손(scissors 등)은 엔진이 원형으로 바꾼다). RPS 확장판의 판정 문장은 이 앱이 새로 쓴
// 한국어(verbs.js)를 옮긴 것이고, 러브레이스의 문장을 가져오지 않았다.

/** 손 이름. plural: 영어에서 복수로 받는 이름, proper: 문장 가운데서도 대문자로 쓰는 이름 */
export const EN_HANDS = {
  // 가위바위보 손
  scissors: { name: "Scissors", plural: true },
  rock: { name: "Rock" },
  paper: { name: "Paper" },
  // 셋이 물고 무는 꼴
  frog: { name: "Frog" },
  snake: { name: "Snake" },
  slug: { name: "Slug" },
  fox: { name: "Fox" },
  headman: { name: "Village head" },
  hunter: { name: "Hunter" },
  watonai: { name: "Watōnai", proper: true },
  tiger: { name: "Tiger" },
  mother: { name: "Mother" },
  elephant: { name: "Elephant" },
  human: { name: "Human" },
  ant: { name: "Ant" },
  bird: { name: "Bird" },
  water: { name: "Water" },
  stone: { name: "Stone" },
  bear: { name: "Bear" },
  ninja: { name: "Ninja" },
  stick: { name: "Stick" },
  chicken: { name: "Chicken" },
  // 손을 더한 꼴
  well: { name: "Well" },
  dynamite: { name: "Dynamite" },
  fire: { name: "Fire" },
  worm: { name: "Worm" },
  lizard: { name: "Lizard" },
  spock: { name: "Spock", proper: true },
  // RPS-7 ~ RPS-101 물건
  tree: { name: "Tree" },
  wolf: { name: "Wolf" },
  sponge: { name: "Sponge" },
  air: { name: "Air" },
  dragon: { name: "Dragon" },
  devil: { name: "Devil" },
  lightning: { name: "Lightning" },
  gun: { name: "Gun" },
  sun: { name: "Sun" },
  axe: { name: "Axe" },
  monkey: { name: "Monkey" },
  woman: { name: "Woman" },
  man: { name: "Man" },
  cockroach: { name: "Cockroach" },
  moon: { name: "Moon" },
  bowl: { name: "Bowl" },
  alien: { name: "Alien" },
  nuke: { name: "Nuke" },
  tornado: { name: "Tornado" },
  quicksand: { name: "Quicksand" },
  pit: { name: "Pit" },
  chain: { name: "Chain" },
  law: { name: "Law" },
  whip: { name: "Whip" },
  sword: { name: "Sword" },
  death: { name: "Death" },
  wall: { name: "Wall" },
  camera: { name: "Camera" },
  chainsaw: { name: "Chainsaw" },
  school: { name: "School" },
  poison: { name: "Poison" },
  cage: { name: "Cage" },
  peace: { name: "Peace" },
  computer: { name: "Computer" },
  castle: { name: "Castle" },
  blood: { name: "Blood" },
  porcupine: { name: "Porcupine" },
  vulture: { name: "Vulture" },
  king: { name: "King" },
  queen: { name: "Queen" },
  prince: { name: "Prince" },
  princess: { name: "Princess" },
  police: { name: "Police", plural: true },
  baby: { name: "Baby" },
  home: { name: "Home" },
  train: { name: "Train" },
  car: { name: "Car" },
  noise: { name: "Noise" },
  bicycle: { name: "Bicycle" },
  turnip: { name: "Turnip" },
  duck: { name: "Duck" },
  cat: { name: "Cat" },
  fish: { name: "Fish" },
  spider: { name: "Spider" },
  brain: { name: "Brain" },
  community: { name: "Community" },
  cross: { name: "Cross" },
  money: { name: "Money" },
  vampire: { name: "Vampire" },
  church: { name: "Church" },
  butter: { name: "Butter" },
  book: { name: "Book" },
  cloud: { name: "Cloud" },
  airplane: { name: "Airplane" },
  grass: { name: "Grass" },
  film: { name: "Film" },
  toilet: { name: "Toilet" },
  planet: { name: "Planet" },
  guitar: { name: "Guitar" },
  cup: { name: "Cup" },
  beer: { name: "Beer" },
  rain: { name: "Rain" },
  tv: { name: "TV" },
  rainbow: { name: "Rainbow" },
  ufo: { name: "UFO" },
  prayer: { name: "Prayer" },
  mountain: { name: "Mountain" },
  satan: { name: "Satan", proper: true },
  diamond: { name: "Diamond" },
  platinum: { name: "Platinum" },
  gold: { name: "Gold" },
  fence: { name: "Fence" },
  videogame: { name: "Video game" },
  math: { name: "Math" },
  robot: { name: "Robot" },
  heart: { name: "Heart" },
  electricity: { name: "Electricity" },
  medusa: { name: "Medusa", proper: true },
  power: { name: "Power" },
  laser: { name: "Laser" },
  sky: { name: "Sky" },
  tank: { name: "Tank" },
  helicopter: { name: "Helicopter" },
};

/** 손 모양 설명(손 id → 영어). 변종마다 다른 것은 EN_ENTRIES 의 how 가 이긴다 */
const HOW = {
  scissors: "Make a V with your index and middle fingers",
  rock: "Make a fist",
  paper: "Open all five fingers. In Korean it is a wrapping cloth (bojagi)",
};

/** RPS-7 ~ RPS-101 에서 쓰는 판정 동사 (verbs.js 의 한국어를 옮김) */
export const EN_OBJECT_VERBS = {
  "rock>fire": "smothers",
  "rock>scissors": "crushes",
  "rock>snake": "squashes",
  "rock>human": "trips up",
  "rock>tree": "pins down",
  "rock>wolf": "drives off",
  "rock>sponge": "flattens",
  "fire>scissors": "melts",
  "fire>snake": "scorches",
  "fire>human": "burns",
  "fire>tree": "burns down",
  "fire>wolf": "scares off",
  "fire>sponge": "shrivels",
  "fire>paper": "incinerates",
  "scissors>snake": "chops up",
  "scissors>human": "pokes",
  "scissors>tree": "prunes",
  "scissors>wolf": "shears",
  "scissors>sponge": "cuts up",
  "scissors>paper": "cuts",
  "scissors>air": "slices through",
  "snake>human": "bites",
  "snake>tree": "coils around",
  "snake>wolf": "poisons",
  "snake>sponge": "swallows",
  "snake>paper": "slithers over",
  "snake>air": "breathes in",
  "snake>water": "swims across",
  "human>tree": "chops down",
  "human>wolf": "tames",
  "human>sponge": "wrings out",
  "human>paper": "folds",
  "human>air": "pollutes",
  "human>water": "drinks",
  "human>dragon": "slays",
  "tree>wolf": "blocks",
  "tree>sponge": "dries out",
  "tree>paper": "begets",
  "tree>air": "cleans",
  "tree>water": "draws up",
  "tree>dragon": "entangles",
  "tree>devil": "drives out",
  "wolf>sponge": "chews up",
  "wolf>paper": "shreds",
  "wolf>air": "howls into",
  "wolf>water": "laps up",
  "wolf>dragon": "chases off",
  "wolf>devil": "drives away",
  "wolf>lightning": "outruns",
  "sponge>paper": "soaks",
  "sponge>air": "traps",
  "sponge>water": "absorbs",
  "sponge>dragon": "washes",
  "sponge>devil": "wipes away",
  "sponge>lightning": "soaks up",
  "sponge>gun": "plugs",
  "paper>air": "fans",
  "paper>water": "covers",
  "paper>dragon": "captures",
  "paper>devil": "wards off",
  "paper>lightning": "catches",
  "paper>gun": "ties up",
  "paper>rock": "wraps",
  "air>water": "ripples",
  "air>dragon": "blows away",
  "air>devil": "chokes",
  "air>lightning": "scatters",
  "air>gun": "deflects",
  "air>rock": "erodes",
  "air>fire": "blows out",
  "water>dragon": "cools",
  "water>devil": "washes away",
  "water>lightning": "conducts",
  "water>gun": "soaks",
  "water>rock": "wears down",
  "water>fire": "puts out",
  "water>scissors": "rusts",
  "dragon>devil": "expels",
  "dragon>lightning": "commands",
  "dragon>gun": "shrugs off",
  "dragon>rock": "smashes",
  "dragon>fire": "breathes",
  "dragon>scissors": "blunts",
  "dragon>snake": "rules over",
  "devil>lightning": "hurls",
  "devil>gun": "seizes",
  "devil>rock": "throws",
  "devil>fire": "masters",
  "devil>scissors": "mocks",
  "devil>snake": "lures",
  "devil>human": "tempts",
  "lightning>gun": "melts",
  "lightning>rock": "splits",
  "lightning>fire": "starts",
  "lightning>scissors": "strikes",
  "lightning>snake": "stuns",
  "lightning>human": "shocks",
  "lightning>tree": "cleaves",
  "gun>rock": "shatters",
  "gun>fire": "shoots out",
  "gun>scissors": "blasts away",
  "gun>snake": "shoots",
  "gun>human": "aims at",
  "gun>tree": "pierces",
  "gun>wolf": "shoots at",
};

const CLASSIC_VERBS = { "rock>scissors": "crushes", "scissors>paper": "cuts", "paper>rock": "wraps" };

export const EN_CATEGORIES = {
  three: {
    title: "Three in a cycle",
    blurb: "Same rules as rock paper scissors, different stories in the hands. In Japan these are called sansukumi-ken: hand games where three hold each other in check.",
  },
  more: {
    title: "More hands",
    blurb: "Four hands, five, all the way to a hundred and one. Some grow evenly, some are lopsided on purpose.",
  },
  flow: {
    title: "Games built on RPS",
    blurb: "One throw is not the end. Swap attack and defense, throw two hands, climb the stairs.",
  },
  group: {
    title: "Group games",
    blurb: "Rock paper scissors with three or more at once. Play yourself or watch a crowd play.",
  },
  sim: {
    title: "Simulations",
    blurb: "Pit computer strategies against each other for thousands of rounds, and watch how creatures that beat each other in a cycle live together.",
  },
};

/** 변종마다: 이름, 부제, 나온 곳, 설명, 다른 이름, 손 모양(how), 판정 동사(verbs: "이긴 손>진 손"), 통문장(phrases) */
export const EN_ENTRIES = {
  classic: {
    name: "Rock Paper Scissors",
    origin: "From East Asia to the world",
    about: [
      "A hand game that traveled from China to Japan took its three-hand form in late-19th-century Japan and spread around the world in the 20th century.",
      "In Korean the open hand, bo, is a wrapping cloth rather than paper. Across East Asia the flat palm is read as cloth.",
    ],
    aka: [
      ["가위바위보 (gawi bawi bo)", "Korea"],
      ["じゃんけん (janken)", "Japan"],
      ["石头剪刀布 (shítou jiǎndāo bù)", "China"],
      ["Rock paper scissors, Rochambeau", "English-speaking countries"],
      ["Bato-bato-pik, Jak-en-poy", "Philippines"],
    ],
    verbs: CLASSIC_VERBS,
  },
  mushiken: {
    name: "Mushi-ken",
    sub: "虫拳, insect fist",
    origin: "Japan (from China)",
    about: [
      "The oldest sansukumi-ken in Japan, brought straight from China. The thumb is a frog, the index finger a snake, and the little finger a slug.",
      "The slug beats the snake because of an old belief that slug slime dissolves snakes.",
    ],
    how: { frog: "Thumb up", snake: "Index finger up", slug: "Little finger up" },
    verbs: { "frog>slug": "eats", "slug>snake": "dissolves", "snake>frog": "swallows" },
  },
  kitsuneken: {
    name: "Kitsune-ken",
    sub: "狐拳, fox fist",
    origin: "Japan",
    about: [
      "Once the most widely played sansukumi-ken in Japan, also called Tōhachi-ken (東八拳). Unlike the others, it uses both hands.",
      "The fox bewitches the village head, the village head orders the hunter around, and the hunter shoots the fox.",
    ],
    how: {
      fox: "Raise both hands like ears, palms toward the other player",
      headman: "Put both hands on your knees",
      hunter: "Pretend to hold and aim a gun",
    },
    verbs: { "fox>headman": "bewitches", "headman>hunter": "orders around", "hunter>fox": "shoots" },
  },
  toraken: {
    name: "Tora-ken",
    sub: "虎拳, tiger fist",
    origin: "Japan",
    about: [
      "It comes from Chikamatsu Monzaemon's puppet play The Battles of Coxinga (国性爺合戦). Watōnai, the warrior who subdues a tiger, cannot defy his mother.",
      "Players wait behind a folding screen and step out striking a pose. It was a drinking game.",
    ],
    how: { watonai: "Pose as a warrior holding a spear", tiger: "Crawl on all fours like a tiger", mother: "Pose as an old mother leaning on a cane" },
    verbs: { "watonai>tiger": "subdues", "tiger>mother": "pounces on", "mother>watonai": "scolds" },
  },
  suit: {
    name: "Suit",
    sub: "Ant, human, elephant",
    origin: "Indonesia",
    about: [
      "In Indonesia rock paper scissors is often called suit, and a version that shows an elephant, a human, or an ant with one finger is played too.",
      "The fun is the tiny ant beating the big elephant. They say it crawls into the elephant's trunk or ear and torments it.",
    ],
    how: { elephant: "Thumb up", human: "Index finger up", ant: "Little finger up" },
    verbs: { "elephant>human": "tramples", "human>ant": "squishes", "ant>elephant": "torments" },
  },
  birdwaterstone: {
    name: "Bird, Water, Stone",
    origin: "Malaysia and Singapore",
    about: [
      "A bird takes the place of scissors and water the place of paper. The bird drinks the water, the water sinks the stone, and the stone knocks down the bird.",
      "In Malaysia players call out 'One, two, zum' as they throw.",
    ],
    how: { bird: "Pinch your fingertips together like a beak", water: "Open your hand, the same as paper", stone: "Make a fist" },
    verbs: { "bird>water": "drinks", "water>stone": "sinks", "stone>bird": "knocks down" },
  },
  bearhunterninja: {
    name: "Bear, Hunter, Ninja",
    origin: "Played with the whole body",
    about: [
      "You play with your whole body instead of a hand. Stand back to back, then turn on the signal and strike a pose.",
      "The hunter shoots the bear, the bear pounces on the ninja, and the ninja takes down the hunter.",
    ],
    how: { hunter: "Aim a gun", bear: "Raise both arms as if to pounce", ninja: "Draw a sword" },
    verbs: { "hunter>bear": "shoots", "bear>ninja": "pounces on", "ninja>hunter": "takes down" },
  },
  tigerstickchicken: {
    name: "Tiger, Stick, Chicken",
    sub: "老虎·棒子·鸡",
    origin: "China",
    about: [
      "Played with words instead of hands. Tap chopsticks together three times, then call out one of the three. Children play it, and so do people at the dinner table.",
      "The stick beats the tiger thanks to the tale of Wu Song, who clubbed a tiger to death.",
    ],
    verbs: { "stick>tiger": "clubs", "tiger>chicken": "eats", "chicken>stick": "pecks apart" },
  },
  well: {
    name: "Well",
    sub: "Pierre-papier-ciseaux-puits",
    origin: "France",
    about: [
      "A well added to rock, paper, and scissors. Rock and scissors fall into the well, and paper covers it.",
      "Four hands make it lopsided. Against any hand rock does no better than the well, so good players never throw rock.",
    ],
    how: { well: "Make a circle with your thumb and index finger" },
    verbs: { ...CLASSIC_VERBS, "well>rock": "swallows", "well>scissors": "swallows", "paper>well": "covers" },
  },
  dynamite: {
    name: "Dynamite",
    origin: "Playgrounds",
    about: [
      "A hand sneaked in on playgrounds. It blows up rock and burns paper, but scissors cut its fuse. It's a foul in serious tournaments.",
      "Do the math and paper is never better than dynamite. Drop paper, and rock, scissors, and dynamite form a three-way cycle.",
    ],
    how: { dynamite: "Make a fist with the thumb up. The thumb is the fuse" },
    verbs: { ...CLASSIC_VERBS, "dynamite>rock": "blows up", "dynamite>paper": "burns" },
    phrases: { "scissors>dynamite": "Scissors cut the dynamite's fuse" },
  },
  firewater: {
    name: "Fire and Water",
    origin: "Playgrounds",
    about: [
      "Fire beats everything but water, and water beats only fire. Rock, paper, and scissors stay as they are.",
      "The best mix throws rock, paper, and scissors 1/9 each and fire and water 1/3 each. People tend to throw water too rarely.",
    ],
    how: { fire: "Wiggle all five fingers" },
    verbs: {
      ...CLASSIC_VERBS,
      "fire>scissors": "melts",
      "fire>rock": "heats",
      "fire>paper": "burns",
      "water>fire": "puts out",
      "rock>water": "blocks",
      "scissors>water": "cuts through",
      "paper>water": "soaks up",
    },
  },
  sticktigerchickenworm: {
    name: "Stick, Tiger, Chicken, Worm",
    sub: "棒子·老虎·鸡·虫",
    origin: "China",
    about: [
      "The four form a ring and each beats only the next one. Stick beats tiger, tiger beats chicken, chicken beats worm, and worm beats stick.",
      "The two pairs facing each other (stick and chicken, tiger and worm) draw. So random throws draw half the time.",
    ],
    verbs: { "stick>tiger": "clubs", "tiger>chicken": "eats", "chicken>worm": "pecks up", "worm>stick": "gnaws" },
  },
  rpsls: {
    name: "Rock Paper Scissors Lizard Spock",
    origin: "USA (Sam Kass and Karen Bryla)",
    about: [
      "A five-hand version by Sam Kass and Karen Bryla. With five hands the chance of a draw drops from 1/3 to 1/5.",
      "Each hand beats two and loses to two: on the ring it beats the next one and the one after that.",
    ],
    how: { lizard: "Make a mouth with your hand, like a sock puppet", spock: "Index and middle fingers together, ring and little fingers together, split in the middle" },
    verbs: {
      "scissors>lizard": "slashes",
      "scissors>paper": "cuts",
      "lizard>paper": "chews up",
      "lizard>spock": "bites",
      "paper>spock": "refutes",
      "paper>rock": "wraps",
      "spock>rock": "evaporates",
      "spock>scissors": "breaks",
      "rock>scissors": "crushes",
      "rock>lizard": "squashes",
    },
  },
  rps7: { name: "RPS-7", origin: "David C. Lovelace", about: ["Fire, sponge, air, and water added to rock, paper, and scissors. Each hand beats three and loses to three."] },
  rps9: { name: "RPS-9", origin: "David C. Lovelace", about: ["RPS-7 plus human and gun. Each hand beats four and loses to four."] },
  rps11: { name: "RPS-11", origin: "David C. Lovelace", about: ["RPS-9 plus wolf and devil. Each hand beats five and loses to five."] },
  rps15: {
    name: "RPS-15",
    origin: "David C. Lovelace",
    about: ["RPS-11 plus snake, tree, dragon, and lightning. Each hand beats seven and loses to seven. The ring becomes a fifteen-pointed star."],
  },
  rps25: {
    name: "RPS-25",
    origin: "David C. Lovelace",
    about: [
      "Human split into man and woman, plus sun, moon, monkey, cockroach, alien, nuke, and more, for twenty-five hands. Each beats twelve and loses to twelve. The chance of a draw is 1/25, or 4%.",
      "Lovelace went on to make RPS-101, with 101 hands.",
    ],
  },
  rps101: {
    name: "RPS-101",
    origin: "David C. Lovelace",
    about: [
      "Lovelace spent nearly a year after RPS-25 making this 101-hand game. Each hand beats 50 and loses to 50, for 5,050 winning pairs.",
      "It holds every RPS-25 hand but is not a simple extension. Wolf and nuke trade places, so here nuke beats wolf.",
      "Lovelace wrote a sentence for every winning pair. This app shows its own sentences only when two RPS-15 hands meet and just says 'beats' for the rest.",
      "Hands with no emoji of their own, such as whip, chainsaw, cage, turnip, platinum, fence, Medusa, laser, and tank, use the closest picture.",
    ],
  },
  custom: {
    name: "Make Your Own",
    sub: "RPS-n",
    origin: "By the ring rule",
    about: [
      "Pick the number of hands and a ring rule is made: each hand beats the next few on the ring.",
      "With the most wins allowed, an odd number of hands always has a winner unless both throw the same, and an even number also draws with the hand straight across the ring.",
    ],
  },
  mukjjippa: {
    name: "Muk-jji-ppa",
    origin: "Korea",
    about: [
      "Rock paper scissors decides who attacks. The attacker shouts 'Muk! (rock)', 'Jji! (scissors)', or 'Ppa! (paper)' while changing hands, and the defender changes at the same time.",
      "If the defender shows the same hand as the attacker, the attacker wins. Otherwise those two hands play rock paper scissors, and the winner becomes the attacker.",
    ],
  },
  acchimuite: {
    name: "Acchi Muite Hoi",
    sub: "あっち向いてホイ",
    origin: "Japan",
    about: [
      "The winner of rock paper scissors shouts 'Acchi muite hoi!' and points up, down, left, or right, and at the same moment the loser turns their head.",
      "Turn your head the way they point and you lose. Otherwise, go back to rock paper scissors.",
    ],
  },
  minusone: {
    name: "Hana-ppaegi",
    sub: "Rock paper scissors minus one",
    origin: "Korea",
    about: [
      "Both players throw rock paper scissors with both hands at once. After seeing all four hands, each takes one back at 'Hana ppaegi!' (minus one), and the remaining hands play. A draw starts over.",
      "It became widely known after appearing in Squid Game season 2.",
    ],
  },
  glico: {
    name: "Glico",
    sub: "グリコ, staircase RPS",
    origin: "Japan",
    about: [
      "Play rock paper scissors at the bottom of a staircase; only the winner climbs, by the hand they won with. Rock is グ·リ·コ (gu-ri-ko), 3 steps; scissors is チ·ヨ·コ·レ·イ·ト (chi-yo-ko-re-i-to), 6 steps; paper is パ·イ·ナ·ツ·プ·ル (pa-i-na-tsu-pu-ru), 6 steps.",
      "First to the top wins. Because the steps differ, mixing the three evenly is no longer best.",
    ],
  },
  limited: {
    name: "Limited Rock Paper Scissors",
    sub: "12 cards and 3 stars",
    origin: "Japanese manga",
    about: [
      "Each player starts with 12 cards, four each of rock, paper, and scissors, and 3 stars. Both play one card per round, and the winner takes one of the other's stars.",
      "Both can see how many cards the other has left. When the cards run out, more stars wins; lose all your stars and you lose at once. A two-player cut of 'Restricted Rock Paper Scissors' from the manga Kaiji.",
    ],
  },
  dynamitewb: {
    name: "Dynamite and Water Balloon",
    origin: "Programming bot contests",
    about: [
      "Dynamite beats rock, paper, and scissors, but you only get a few. A water balloon beats only dynamite and loses to everything else.",
      "These rules come from programming contests where bots play each other. This app can carry a draw's points over to the next round. With carry-over on, the round after a draw is worth more, so when to use dynamite decides the match.",
    ],
  },
  command: {
    name: "Command RPS",
    sub: "Win, lose, draw",
    origin: "Brain training",
    about: [
      "The screen shows one hand and an order: win, lose, or draw. Quickly throw a hand that does what it says.",
      "Count how many you get right in 30 seconds. You have to think of the losing and drawing hands as fast as the winning one.",
    ],
  },
  group: {
    name: "Group Rock Paper Scissors",
    origin: "Anywhere",
    about: [
      "Three or more throw at once. If all three hands appear, or everyone throws the same, go again. If only two hands appear, everyone who threw the losing hand is out.",
      "The more people, the harder it is to settle. With 8 people, about nine throws in ten have to be redone.",
    ],
  },
  train: {
    name: "Janken Train",
    sub: "じゃんけん列車",
    origin: "Japan",
    about: [
      "Play rock paper scissors with someone nearby; the loser joins behind the winner, hands on their shoulders. Train leaders play again, and the losing train joins behind the winning one.",
      "It ends when everyone is in one line. Each time the crowd doubles, it takes about one more round.",
    ],
  },
  evolution: {
    name: "Evolution RPS",
    origin: "Group game",
    about: [
      "Everyone starts as an egg. Players at the same stage play each other; winning moves you up a stage and losing moves you down. Eggs can't go lower.",
      "Whoever reaches the top steps out and watches. It ends when no one has a partner left, with at most one person at each stage.",
    ],
  },
  league: {
    name: "Strategy League",
    origin: "Computers only",
    about: [
      "Computer strategies play each other thousands of times. Random play loses to no one by much, while a strategy with a habit loses to one that reads it.",
      "Strategies end up beating each other in cycles too, just like rock paper scissors.",
    ],
  },
  lattice: {
    name: "RPS in Nature",
    sub: "Lattice ecosystem",
    origin: "Lizards and E. coli",
    about: [
      "Male side-blotched lizards come in three throat colors: orange beats blue, blue beats yellow, and yellow beats orange. E. coli does it too: a toxin maker, a toxin-sensitive strain, and a toxin-resistant strain beat each other in a cycle.",
      "If each creature holds one cell and fights only its neighbors, the three live together in swirling spirals. The more they move around, and the better they mix, the more likely only one species survives.",
    ],
  },
  war: {
    name: "RPS War",
    origin: "Collide and convert",
    about: [
      "Rocks, papers, and scissors wander the board, and when two collide the loser turns into the winner. It ends when only one kind is left.",
      "Even with equal numbers at the start, a different hand wins each time. Once one kind disappears, the winner of the remaining two takes the whole board, so victory goes to the hand whose predator disappears first.",
    ],
  },
};

/** 한국어 제목인 출처의 영어 제목(주소로 찾는다) */
export const EN_SOURCES = {
  "https://koreascience.kr/article/JAKO201007049666093.pdf":
    "Cho Dae-hyun, Deciding winners by rock paper scissors, with simulations (Korean Journal of Applied Statistics, 2010, in Korean)",
  "https://orsj.org/wp-content/or-archives50/pdf/bul/Vol.28_09_424.pdf": "The origins of janken (Operations Research, vol. 28 no. 9, in Japanese)",
  "https://www.umop.com/rps.htm": "David C. Lovelace, RPS variants (umop.com)",
  "https://www.umop.com/rps101/alloutcomes.htm": "David C. Lovelace, all 5,050 RPS-101 outcomes",
  "https://tvreport.co.kr/movie/article/871051/": "TV Report, Squid Game 2 preview (in Korean)",
  "https://thetvdb.com/series/kaiji/episodes/357041": "TVDB, Kaiji: Ultimate Survivor episode 1 synopsis",
  "https://koreascience.or.kr/article/JAKO201919341608265.pdf":
    "Cho Dae-hyun, A rock paper scissors game between two teams (Korean Journal of Applied Statistics, 2019, in Korean)",
};

function enHand(hd, entryEn) {
  const base = EN_HANDS[hd.id];
  if (!base) throw new Error(`영어 손 이름이 없다: ${hd.id}`);
  const out = { ...hd, ...base };
  if (hd.how) {
    const how = (entryEn.how && entryEn.how[hd.id]) || HOW[hd.id];
    if (!how) throw new Error(`영어 손 모양 설명이 없다: ${hd.id}`);
    out.how = how;
  }
  return out;
}

/** 한국어 도감을 영어 도감으로. verbs 는 OBJECT_VERBS(한국어)를 쓰는 변종이면 EN_OBJECT_VERBS 로 바꾼다 */
export function localizeCatalog(categories, catalog, objectVerbsKo) {
  const cats = categories.map((c) => ({ ...c, ...EN_CATEGORIES[c.id] }));
  const entries = catalog.map((e) => {
    const en = EN_ENTRIES[e.id];
    if (!en) throw new Error(`영어 자료가 없는 변종: ${e.id}`);
    const out = { ...e, lang: "en", name: en.name, sub: en.sub, origin: en.origin, about: en.about };
    if (e.aka) out.aka = en.aka || e.aka;
    if (e.sources) out.sources = e.sources.map((s) => ({ ...s, t: EN_SOURCES[s.u] || s.t }));
    if (e.hands) out.hands = e.hands.map((hd) => enHand(hd, en));
    if (e.rel) {
      out.rel = e.rel.map(([w, l, , phrase]) => {
        const key = `${w}>${l}`;
        const verb = en.verbs && en.verbs[key];
        const ph = phrase ? en.phrases && en.phrases[key] : undefined;
        if (!verb && !ph) throw new Error(`영어 판정 동사가 없다: ${e.id} ${key}`);
        return [w, l, verb || null, ph || undefined];
      });
    }
    if (e.verbs) out.verbs = e.verbs === objectVerbsKo ? EN_OBJECT_VERBS : en.verbs;
    return out;
  });
  return { categories: cats, catalog: entries };
}
