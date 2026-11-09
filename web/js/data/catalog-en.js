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
  giant: { name: "Giant" },
  wizard: { name: "Wizard" },
  elf: { name: "Elf" },
  grandma: { name: "Granny" },
  warrior: { name: "Warrior" },
  mosquito: { name: "Mosquito" },
  handshake: { name: "Handshake" },
  fistbump: { name: "Fist bump" },
  hug: { name: "Hug" },
  pirate: { name: "Pirate" },
  zombie: { name: "Zombie" },
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
  "paper>rock": "covers",
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

const CLASSIC_VERBS = { "rock>scissors": "crushes", "scissors>paper": "cuts", "paper>rock": "covers" };

export const EN_CATEGORIES = {
  three: {
    title: "Three in a cycle",
    blurb: "Same rules as rock paper scissors, different stories in the hands. In Japan these are called sansukumi-ken: hand games where three hold each other in check.",
  },
  more: {
    title: "More hands",
    blurb: "These grow the hands to four, five, even 101. Some grow evenly, and some are lopsided on purpose.",
  },
  flow: {
    title: "Games built on RPS",
    blurb: "Rock paper scissors with more rules on top: swap attack and defense, throw two hands, climb the stairs.",
  },
  cousin: {
    title: "RPS cousins",
    blurb: "These use coins, dice, finger counts, or soldiers instead of hands. Whatever you pick, something beats it.",
  },
  group: {
    title: "Group games",
    blurb: "Three or more people play at once. Join in or watch a crowd play.",
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
      "It's the oldest sansukumi-ken in Japan, brought straight from China. The thumb is a frog, the index finger a snake, and the little finger a slug.",
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
      "It was once the most widely played sansukumi-ken in Japan, also known as Tōhachi-ken (東八拳). Unlike the others, it uses both hands.",
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
      "In Indonesia, rock paper scissors is often called suit. People also play a kind of suit where one finger shows an elephant, a human, or an ant.",
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
      "You play with words instead of hands. Tap chopsticks together three times, then call out one of the three. Children play it, and so do people at the dinner table.",
      "The stick beats the tiger thanks to the tale of Wu Song, who clubbed a tiger to death.",
    ],
    verbs: { "stick>tiger": "clubs", "tiger>chicken": "eats", "chicken>stick": "pecks apart" },
  },
  giantwizardelf: {
    name: "Giants, Wizards, Elves",
    origin: "Group game in English-speaking countries",
    about: [
      "Scouts and PE classes play this as a team game. Each team secretly picks one and everyone throws it together. The losing team runs back to its line while the winners chase. Anyone tagged joins the other team.",
      "Giants squash elves, elves outsmart wizards, and wizards zap giants. Some write-ups run the cycle the other way.",
    ],
    how: {
      giant: "Stand on your toes with both arms high",
      wizard: "Lean back and point your fingers to cast a spell",
      elf: "Curl up small like a ball",
    },
    verbs: { "giant>elf": "squashes", "elf>wizard": "outsmarts", "wizard>giant": "zaps" },
  },
  grandmawarriordragon: {
    name: "Granny, Warrior, Dragon",
    sub: "Oma, Krieger, Drache",
    origin: "Germany",
    about: [
      "Two teams stand 3 to 4 meters apart and secretly pick one. Anyone caught moves to the other team, and the game ends when a team runs out of players.",
      "The dragon eats the granny, the granny scolds the warrior into giving up, and the warrior slays the dragon. Like the samurai in Toraken, a hero who beats a dragon still loses to a scolding.",
    ],
    how: {
      grandma: "Wag your index finger and turn in a circle",
      warrior: "Take a fighting stance and swing your sword",
      dragon: "Spread your arms and roar as loud as you can",
    },
    verbs: { "dragon>grandma": "eats", "grandma>warrior": "scolds", "warrior>dragon": "slays" },
  },
  bearfishmosquito: {
    name: "Bear, Fish, Mosquito",
    origin: "Calgary, Canada",
    about: [
      "The City of Calgary shares it as rock paper scissors with local animals. PE classes in the US use it as a warm-up.",
      "The bear catches the fish, the fish eats the mosquito, and the mosquito bites the bear. The smallest beats the biggest.",
    ],
    how: {
      bear: "Raise both hands with your fingers curled like claws",
      fish: "Put your palms together and wiggle them like a fish",
      mosquito: "Point your index finger out",
    },
    verbs: { "bear>fish": "catches", "fish>mosquito": "eats", "mosquito>bear": "bites" },
  },
  greetings: {
    name: "Handshake, Fist Bump, Hug",
    sub: "Wow, this is awkward!",
    origin: "US youth groups",
    about: [
      "Stand back to back, count to three, then turn around offering a greeting. The loser has to do the winner's greeting, and both say \"Wow, this is awkward!\"",
      "A handshake beats a fist bump, a fist bump beats a hug, and a hug beats a handshake. Winners play winners until one is left.",
    ],
    how: { handshake: "Hold out your hand to shake", fistbump: "Hold out your fist", hug: "Open your arms wide" },
    verbs: { "handshake>fistbump": "wraps up", "fistbump>hug": "holds off", "hug>handshake": "swallows up" },
  },
  reverse: {
    name: "Reverse Rock Paper Scissors",
    sub: "じゃんぽんけん",
    origin: "Japan",
    about: [
      "Winning and losing are flipped. The hand that usually loses wins. Draws stay the same.",
      "The hands look the same, so think of the usual winner, then flip it once more.",
    ],
    verbs: {},
    phrases: {
      "scissors>rock": "Scissors win by getting crushed by rock",
      "rock>paper": "Rock wins by getting covered by paper",
      "paper>scissors": "Paper wins by getting cut by scissors",
    },
  },
  well: {
    name: "Well",
    sub: "Pierre-papier-ciseaux-puits",
    origin: "France",
    about: [
      "It adds a well to rock, paper, and scissors. Rock and scissors fall into the well, and paper covers it.",
      "Four hands make it lopsided. Against any hand rock does no better than the well, so good players never throw rock.",
    ],
    how: { well: "Make a circle with your thumb and index finger" },
    verbs: { ...CLASSIC_VERBS, "well>rock": "swallows", "well>scissors": "swallows", "paper>well": "covers" },
  },
  dynamite: {
    name: "Dynamite",
    origin: "Playgrounds",
    about: [
      "Kids sneak this hand into playground games. It blows up rock and burns paper, but scissors cut its fuse. It's a foul in serious tournaments.",
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
      "For the best mix, throw rock, paper, and scissors 1/9 of the time each, and fire and water 1/3 each. People tend to throw water too rarely.",
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
      "Sam Kass and Karen Bryla added lizard and Spock to rock paper scissors. With five hands, the chance of a draw drops from 1/3 to 1/5.",
      "Each hand beats two and loses to two: on the ring it beats the next one and the one after that.",
    ],
    how: { lizard: "Make a mouth with your hand, like a sock puppet", spock: "Index and middle fingers together, ring and little fingers together, split in the middle" },
    verbs: {
      "scissors>lizard": "slashes",
      "scissors>paper": "cuts",
      "lizard>paper": "chews up",
      "lizard>spock": "poisons",
      "paper>spock": "refutes",
      "paper>rock": "covers",
      "spock>rock": "vaporizes",
      "spock>scissors": "smashes",
      "rock>scissors": "crushes",
      "rock>lizard": "squashes",
    },
  },
  moropinzee: {
    name: "Monkey, Robot, Pirate, Ninja, Zombie",
    sub: "Monkey-Robot-Pirate-Ninja-Zombie",
    origin: "Writer Mark Rayner (2010)",
    about: [
      "Writer Mark Rayner posted it on his blog in 2010. Each hand beats two and loses to two.",
      "There's only one way for five hands to each beat two, so it plays exactly like Rock Paper Scissors Lizard Spock. Lay the two rings on top of each other and only the hands' places differ.",
    ],
    verbs: {
      "monkey>ninja": "fools",
      "monkey>robot": "unplugs",
      "robot>ninja": "chokes",
      "robot>zombie": "crushes",
      "pirate>robot": "drowns",
      "pirate>monkey": "skewers",
      "ninja>pirate": "karate chops",
      "ninja>zombie": "slices",
      "zombie>pirate": "eats",
      "zombie>monkey": "mauls",
    },
  },
  rps7: { name: "RPS-7", origin: "David C. Lovelace", about: ["Lovelace added fire, sponge, air, and water to rock, paper, and scissors. Each hand beats three and loses to three."] },
  rps9: { name: "RPS-9", origin: "David C. Lovelace", about: ["Lovelace added human and gun to RPS-7. Each hand beats four and loses to four."] },
  rps11: { name: "RPS-11", origin: "David C. Lovelace", about: ["Lovelace added wolf and devil to RPS-9. Each hand beats five and loses to five."] },
  rps15: {
    name: "RPS-15",
    origin: "David C. Lovelace",
    about: ["Lovelace added snake, tree, dragon, and lightning to RPS-11. Each hand beats seven and loses to seven. The ring becomes a fifteen-pointed star."],
  },
  rps25: {
    name: "RPS-25",
    origin: "David C. Lovelace",
    about: [
      "Lovelace split human into man and woman and added hands like sun, moon, monkey, cockroach, alien, and nuke. Each beats twelve and loses to twelve. The chance of a draw is 1/25, or 4%.",
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
      "Pick the number of hands and the app builds a ring rule. Each hand beats the next few on the ring.",
      "With the most wins allowed, an odd number of hands only draws when both throw the same. With an even number, the hand straight across the ring draws too.",
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
      "Play rock paper scissors at the bottom of a staircase. Only the winner climbs, and the winning hand sets how far. Rock is グ·リ·コ (gu-ri-ko), 3 steps. Scissors is チ·ヨ·コ·レ·イ·ト (chi-yo-ko-re-i-to), 6 steps. Paper is パ·イ·ナ·ツ·プ·ル (pa-i-na-tsu-pu-ru), 6 steps.",
      "First to the top wins. Because the steps differ, throwing all three equally often is no longer best.",
    ],
  },
  limited: {
    name: "Limited Rock Paper Scissors",
    sub: "12 cards and 3 stars",
    origin: "Japanese manga",
    about: [
      "Each player starts with 12 cards, four each of rock, paper, and scissors, and 3 stars. Both play one card per round, and the winner takes one of the other's stars.",
      "Both can see how many cards the other has left. When the cards run out, the player with more stars wins. Lose all your stars and you lose at once. It cuts 'Restricted Rock Paper Scissors' from the manga Kaiji down to two players.",
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
      "Play rock paper scissors with someone nearby. The loser joins behind the winner, hands on their shoulders. Train leaders play again, and the losing train joins behind the winning one.",
      "It ends when everyone is in one line. Each time the crowd doubles, it takes about one more round.",
    ],
  },
  evolution: {
    name: "Evolution RPS",
    origin: "Group game",
    about: [
      "Everyone starts as an egg. Players at the same stage play each other. Winning moves you up a stage, and losing moves you down. Eggs can't go lower.",
      "Whoever reaches the top steps out and watches. It ends when no one has a partner left, with at most one person at each stage.",
    ],
  },
  league: {
    name: "The Evolution of Strategy",
    origin: "Computers only",
    about: [
      "Nine computer strategies play league after league. The bottom players leave and the top ones multiply, so you can see which strategy spreads over the generations.",
      "Change the match length, mistakes or points, and a different strategy survives. Like Nicky Case's The Evolution of Trust, you turn the pages and try it yourself.",
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
  hammer: {
    name: "Hammer and Helmet",
    sub: "たたいて・かぶって・ジャンケンポン",
    origin: "Japan",
    about: [
      "The winner of rock paper scissors bops the other on the head with a squeaky toy hammer, and the loser grabs a helmet as fast as they can. If the helmet comes first, it's blocked, and you go back to rock paper scissors.",
      "Land a hit before the block and you score. First to 3 wins. In this app, the winner taps Hit and the loser taps Block, and whoever taps first decides it.",
    ],
  },
  donpappa: {
    name: "Don Pappa",
    sub: "ドンパッパ, グリンピース",
    origin: "Western Japan",
    about: [
      "Rock is gurin, scissors is chirin, and paper is parin (グリン, チリン, パリン). Rock paper scissors decides who leads. The leader calls 'this hand, this hand, next hand' and throws three times, and the other player throws along to the beat.",
      "If the third hands match, whoever shouts 'Don!' first wins. If not, the lead switches. It's a cousin of muk-jji-ppa, but a match goes to the faster shout. In the Kansai region, shouting before the hands match loses.",
    ],
  },
  relay: {
    name: "RPS Relay",
    sub: "どんじゃんけん, Hoop Hop Showdown",
    origin: "Japan, US PE classes",
    about: [
      "Two teams start at bases at either end of a path. One player from each side runs out, and when they meet they play rock paper scissors. The winner keeps going, and the losing team sends its next player from base. The first team to reach the other base wins.",
      "FiveThirtyEight's puzzle column, the Riddler, built a puzzle on this game. Counting 1 second per step and 1 second per throw under this app's rules, an 8-space path takes about 2 minutes on average.",
    ],
  },
  ecard: {
    name: "Emperor and Slave",
    sub: "E-Card",
    origin: "Japanese manga",
    about: [
      "The emperor beats the citizen, the citizen beats the slave, and the slave beats the emperor. Two citizens draw. The emperor side holds 1 emperor and 4 citizens, the slave side holds 1 slave and 4 citizens, and both play one card at a time.",
      "Play 12 rounds and switch sides every 3. A slave-side win is worth 4 points, an emperor-side win 1. With best play, the slave side wins one round in five. Scoring that win as 4 points makes both sides even. It cuts E-Card from the manga Kaiji down to a two-player game. In the manga, a slave-side win pays five times as much.",
    ],
  },
  shogi: {
    name: "RPS Shogi",
    sub: "じゃんけん将棋",
    origin: "Based on a Japanese app",
    about: [
      "Rock, paper, scissors, and king pieces go on a board 3 wide and 4 tall. A piece can only capture an enemy piece it beats at rock paper scissors. The king captures anything and can be captured by anything. When two of the same piece meet, the mover climbs on top, and the piece underneath can't move.",
      "Captured pieces join your side, and on your turn you can drop one on an empty square instead of moving. Capture the enemy king to win. Rock moves one step straight, scissors one step diagonally, and paper one step to the three squares ahead or to either side. This app's rules are its own, based on the Japanese app じゃんけん将棋.",
    ],
  },
  penney: {
    name: "Penney's Game",
    origin: "Walter Penney (1969)",
    about: [
      "Each player picks a run of three coin flips, like heads-heads-tails. Flip a coin over and over, and whoever's run shows up first wins.",
      "The second picker always has the edge. Flip the middle of the other run, put it in front, and add the first two of the other run. Against heads-heads-heads, tails-heads-heads wins 7 times in 8. Every run has one that beats it, so the runs form a cycle like rock paper scissors.",
    ],
  },
  dice: {
    name: "Strange Dice",
    sub: "Efron dice, Grime dice",
    origin: "Bradley Efron, James Grime",
    about: [
      "Each die has different numbers. Efron's four dice go A over B, B over C, C over D, and D over A, 2 times in 3. So if the other player picks first, you can always pick a die that beats theirs.",
      "Grime's five dice form two cycles when you roll one each, and when you roll two each and compare sums, one of the cycles runs backward. Warren Buffett once tried to bet Bill Gates with dice like these.",
    ],
  },
  morra: {
    name: "Morra",
    sub: "Morra, 划拳",
    origin: "Ancient Rome, China",
    about: [
      "Both players show 0 to 5 fingers at once and call out the total. If only one calls it right, they score. If both or neither do, nobody scores. First to 3 wins.",
      "People played it in ancient Rome, and in China it's a drinking game called huaquan (划拳). There's also odds and evens: one side takes odd, the other even, and the total decides.",
    ],
  },
  blotto: {
    name: "Colonel Blotto",
    origin: "Émile Borel (1921)",
    about: [
      "Both players secretly split 10 soldiers across 3 battlefields. Whoever sends more to a field takes it, and whoever takes more fields wins the round. First to win 3 rounds wins the match.",
      "With enough soldiers, no split always wins. Spread them evenly and you lose to a split with a few more on two fields. Stack them and you give up the rest. The computer picks its splits close to the best mix.",
    ],
  },
  majority: {
    name: "Majority Wins",
    sub: "多い勝ち, 少ない勝ち",
    origin: "Japan",
    about: [
      "Three or more throw at once, and whoever threw the most common hand stays in. There's also minority wins, where the least common hand stays. If two hands tie for most or least, throw again.",
      "Minority wins keeps people from teaming up ahead of time. Repeating it until one player is left, called gamer janken, is a common way to pick who goes first in board games. With two left, finish with regular rock paper scissors.",
    ],
  },
  choki: {
    name: "Scissors Break Ties",
    sub: "チョキじゃんけん",
    origin: "Japan",
    about: [
      "In a group, if rock, paper, and scissors all show up and it's a draw, the players who threw scissors win. Everything else works like group rock paper scissors.",
      "Group rock paper scissors gets harder to settle as the group grows. With 8 people, about nine throws in ten have to be redone. This rule means fewer redos, but the bigger the group, the more scissors is worth.",
    ],
  },
  host: {
    name: "Beat the Host",
    sub: "審判方式",
    origin: "Japan, a ZEP mini game",
    about: [
      "The host picks a hand first, then everyone throws. Lose to the host and you're out. Win and you get 10 points, draw and you get 5, and either way you stay. It ends when one player is left or after 10 rounds.",
      "If two or more make it to the end, the highest score wins. That's how the rock paper scissors mini game in the ZEP metaverse scores it. If everyone left loses, this app throws the round out.",
    ],
  },
  teamtag: {
    name: "RPS Team Tag",
    sub: "Rock Paper Scissors Tag",
    origin: "PE classes in English-speaking countries",
    about: [
      "Two teams each secretly pick one hand and throw it together. The winning team chases, and the losing team runs back to its line. Anyone tagged joins the other team.",
      "It ends when everyone is on one team. Giants, Wizards, Elves and Granny, Warrior, Dragon are played this way too. In this app, each player on the losing team has a 50 percent chance of getting caught, and after 20 rounds the bigger team wins.",
    ],
  },
  teamsplit: {
    name: "Picking Teams",
    sub: "グーパー, Korean 'eopeora dwijibeora'",
    origin: "Japan, Korea",
    about: [
      "Everyone throws rock or paper, and the same hands make a team. Throw again until the teams are even. Japan's uraomote (palms up or down) and Korea's eopeora dwijibeora work the same way.",
      "When 10 people throw at random, a 5 to 5 split comes up about 1 time in 4, so it takes about four throws. The chant changes from place to place.",
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
  "https://docs.channel.io/zep-guide/ko/articles/%EA%B0%80%EC%9C%84%EB%B0%94%EC%9C%84%EB%B3%B4-f03cf86c": "ZEP official guide, Rock paper scissors (in Korean)",
  "https://thewiki.kr/w/%EC%9F%8C%EC%BC%84": "thewiki, Rock paper scissors (in Korean)",
  "https://academy.prompie.com/communities/posts/%EC%9D%B4%EA%B1%B4-%EC%A7%80%EC%97%AD%EB%A7%88%EB%8B%A4-%EB%8B%A4%EB%A5%B8%EA%B1%B0%EB%9D%BC%EB%8A%94%EB%8D%B0-9hi8giQr/":
    "prompie, team-picking chants by region (in Korean)",
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
