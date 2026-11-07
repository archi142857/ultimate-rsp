// 온라인 이름의 기본값을 만드는 낱말("날쌘 여우 42", "Swift Fox 42").
// 처음 한 번 그때 화면 언어로 정하고, 사용자가 바꿀 수 있다. 상대에게 보이니 좋은 뜻의 낱말만 쓴다.
// 동물은 web/art 에 그림이 있는 것만 쓴다. 이름 끝 동물이 고리에서 그 사람 그림이 된다(online/avatar.js).
// NICK_ART 와 noun 은 같은 차례다.

export const NICK_ART = ["fox", "bear", "cat", "wolf", "tiger", "monkey", "snake", "dragon"];

export const NICK_WORDS = {
  ko: {
    adj: ["날쌘", "용감한", "느긋한", "반짝이는", "씩씩한", "영리한", "다정한", "재빠른", "엉뚱한", "꼼꼼한", "명랑한", "든든한", "유쾌한", "차분한", "부지런한", "상냥한"],
    noun: ["여우", "곰", "고양이", "늑대", "호랑이", "원숭이", "뱀", "용"],
  },
  en: {
    adj: ["Swift", "Brave", "Mellow", "Shiny", "Plucky", "Clever", "Kind", "Quick", "Quirky", "Careful", "Cheerful", "Steady", "Jolly", "Calm", "Busy", "Gentle"],
    noun: ["Fox", "Bear", "Cat", "Wolf", "Tiger", "Monkey", "Snake", "Dragon"],
  },
};
