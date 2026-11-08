// 놀이 화면의 소품 그림(손이 아닌 그림). 그림은 web/art 에 있고, 화면은 ui/art.js 의 handArt(PROPS.hammer) 처럼 넣는다.
// 그림이 없거나 못 불러오면 emoji 가 나온다. 사용자 결정(11-06: 보이는 이모지는 Fluent 그림으로)대로 디자인이 Fluent 원본을 줬다(11-08).

export const PROPS = {
  /** 뿅망치 가위바위보의 뿅망치(Fluent Hammer) */
  hammer: { id: "hammer", emoji: "🔨" },
  /** 뿅망치 가위바위보의 헬멧(Fluent Rescue worker's helmet) */
  helmet: { id: "helmet", emoji: "⛑️" },
  /** 가위바위보 릴레이의 주자(Fluent Person running, 왼쪽을 보고 달린다. 오른쪽으로 보낼 때는 화면에서 뒤집는다) */
  runner: { id: "runner", emoji: "🏃" },
};
