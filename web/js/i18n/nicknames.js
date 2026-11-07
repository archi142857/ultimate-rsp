// 온라인 이름의 기본값을 만드는 낱말("날쌘 여우 42", "Swift Fox 42").
// 처음 한 번 그때 화면 언어로 정하고, 사용자가 바꿀 수 있다. 상대에게 보이니 좋은 뜻의 낱말만 쓴다.

export const NICK_WORDS = {
  ko: {
    adj: ["날쌘", "용감한", "느긋한", "반짝이는", "씩씩한", "영리한", "다정한", "재빠른", "엉뚱한", "꼼꼼한", "명랑한", "든든한", "유쾌한", "차분한", "부지런한", "상냥한"],
    noun: ["여우", "수달", "펭귄", "고양이", "거북", "다람쥐", "부엉이", "판다", "고래", "너구리", "토끼", "사슴", "하마", "코알라", "참새", "돌고래"],
  },
  en: {
    adj: ["Swift", "Brave", "Mellow", "Shiny", "Plucky", "Clever", "Kind", "Quick", "Quirky", "Careful", "Cheerful", "Steady", "Jolly", "Calm", "Busy", "Gentle"],
    noun: ["Fox", "Otter", "Penguin", "Cat", "Turtle", "Squirrel", "Owl", "Panda", "Whale", "Raccoon", "Rabbit", "Deer", "Hippo", "Koala", "Sparrow", "Dolphin"],
  },
};
