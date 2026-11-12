# 소리

효과음을 내는 곳. 소리 세션이 맡는다. 화면 쪽은 `index.js` 만 부른다.

## 화면에서 부르기

```js
import { sfx } from "../sound/index.js";

sfx("throw", hand); // 손을 냈을 때. hand 는 도감의 손 객체(가위는 싹둑, 바위는 딱, 보는 책장, 나머지는 톡)
sfx("count", 3); // 셋을 셀 때 한 마디마다. 3 은 세는 마디 수
sfx("reveal"); // 손을 공개할 때. sfx("reveal", "win") 처럼 판 결과를 같이 주면 뒤이어 결과 가락이 난다
sfx("win"); // 판 결과: "win" · "lose" · "draw". 값으로 줄 때는 sfx("result", cmp) (cmp 는 1, 0, −1)
sfx("matchwin"); // 경기 끝: "matchwin" · "matchlose" · "match"(승패가 없을 때)
sfx("go"); // 지금 눌러야 할 때(먼저 누르기 놀이의 '치기!' 같은 글 바로 뒤). 방금 건 승패 가락 대신 이 소리가 난다
sfx("right"); // 빠르게 잇달아 답하는 놀이의 맞음과 틀림: "right" · "wrong"
```

- 꺼져 있거나 아직 누른 적이 없으면 아무 일도 하지 않는다. 소리 때문에 오류가 나서 화면이 멈추는 일은 없다.
- 단추와 링크를 누르는 소리는 `index.js` 가 알아서 낸다. 누른 단추가 위의 소리를 냈으면 겹쳐 내지 않는다.
- 겹치는 차례는 엔진이 정리한다.
  - 결과 가락은 공개 소리 0.3초 뒤에 나온다. 새 손, 새로 세기 시작, 공개, 새 가락이 오면 앞 가락은 거둔다.
  - 같은 순간에 판 결과와 경기 끝을 같이 부르면 경기 끝 가락만 난다. 경기 끝 가락이 울리는 동안에는 판 가락을 내지 않는다.
  - 손을 내자마자 세기 시작하면 손 내는 소리가 첫 마디를 대신한다. 그래서 손 내는 소리는 `onPick` 같은 다음 일보다 먼저 부른다.
- 무대의 `say(글, "win" | "lose")` 는 승리·패배 가락을 낸다. 그 글이 결과가 아니라 누르라는 신호면 바로 뒤에 `sfx("go")` 를 부른다.
- 소리는 화면에 이미 보이는 것을 한 번 더 알릴 뿐이다. 소리로만 전하는 것은 두지 않는다.

지금 소리를 부르는 곳:

- `ui/widgets.js`: 손 단추(`handGrid`), 외치기(`chant`: 마디마다 세는 소리, 끝에 공개), 무대의 승패 글(`say`).
- `views/matrix.js`(무승부, 경기 끝), `views/home.js`(바로 한 판), `online/room.js`(세기, 공개와 판 결과, 경기 끝), `online/challenge.js`(도전장 결과).
- 놀이 화면: 무승부나 다시 하는 판에 `draw`, 놀이가 끝날 때 `matchwin`·`matchlose`·`match`.
  묵찌빠, 아치무이테호이, 글리코, 한정, 다이너마이트와 물풍선, 뿅망치, 돈파파, 릴레이, 황제와 노예, 모라, 블로토 대령, 여럿이, 진행자 이기기, 술래잡기, 장기.
  - 한 번 겨뤄 끝나는 놀이(하나빼기, 페니의 게임, 비추이 주사위)는 끝에도 판 가락(`win`·`lose`·`draw`)을 낸다.
  - 먼저 누르기 신호 `go`: 뿅망치('치기!'·'막기!'), 돈파파('같음!'), 술래잡기('달아나기!').
  - 손 단추를 따로 그리는 화면은 `throw` 를 직접 부른다: 하나빼기(남길 손), 편 가르기.
  - 명령 가위바위보는 답마다 `right`·`wrong`, 끝에 `match`(새 기록이면 `matchwin`).
  - 여럿이는 판마다 나에게 어땠는지(`roundTone`)에 맞춰 낸다. 남은 사람끼리 마저 하는 동안에는 끝 가락만 난다.

## 설정

```js
import { soundState, setSound, onSoundChange, onFirstSound, HAS_MUSIC } from "../sound/index.js";

soundState(); // { sfx: false, music: false, volume: 0.8 }
setSound({ sfx: true }); // 효과음 켬. 누른 그 자리(click 안)에서 부른다. 이 브라우저에 남는다
setSound({ volume: 0.5 }); // 0~1. 효과음과 배경음악에 같이 걸린다. 바꾸면 그 크기로 한 번 들려준다
const off = onSoundChange((s) => {}); // 바뀔 때마다(다른 탭에서 바꿔도) 부른다. off() 로 그만 듣는다
onFirstSound(() => {}); // 이 쪽에서 첫 소리가 날 때 한 번 부른다('효과음 켜짐 · 끄기' 같은 알림에 쓴다)
HAS_MUSIC; // 배경음악이 들어 있는가. 지금은 false(배경음악 줄을 숨길 때 쓴다)
```

- 저장하는 곳은 `ui/store.js` 의 설정: `ursp.set.sound.sfx`, `ursp.set.sound.music`, `ursp.set.sound.vol`.
- 처음 온 사람은 효과음이 꺼져 있다. 소리 단추가 화면에 놓이면 `index.js` 의 `DEFAULTS` 를 정한 값으로 바꾼다.
  그때까지는 주소에 `?sound=1` 을 붙여 켜고 `?sound=0` 으로 끈다(예: `…/ultimate-rsp/?sound=1`). 붙인 값은 주소에서 바로 지워진다.
- 배경음악(`music`)은 자리만 있다. 아직 소리가 없다.
- 다 끄면 엔진과 오디오 장치를 놓는다. 꺼 둔 사람은 `engine.js` 와 녹음 파일을 받지 않는다.

## 파일

- `index.js`: 앞문. 첫 화면에 같이 실리므로 가볍게 둔다. 설정, 단추 소리, 첫 손짓 뒤에 오디오 열기, 엔진을 뒤늦게 받기.
- `engine.js`: 소리를 만든다. 나무토막·마림바·손뼉·단추 소리는 Web Audio 로 그 자리에서 만들고, 물건 소리는 `web/sound/` 의 녹음을 튼다.
- `web/sound/*.wav`: 녹음. 모두 CC0 이고 출처는 `web/sound/LICENSE` 에 있다. 16비트 한 채널 WAV, 모두 합쳐 200KB 아래.
  넣거나 뺄 때는 `engine.js` 의 `SAMPLES` 와 `LICENSE` 를 같이 고친다(`tests/sound.test.mjs` 가 맞는지 본다).

## 고칠 때

- 소리 크기는 귀로만 맞추지 않는다. `OfflineAudioContext` 로 뽑아 가장 큰 0.1초의 A 가중 크기를 잰다(값은 `engine.js` 의 짜임 위에 적혀 있다).
- `node --test tests/sound.test.mjs` 는 가짜 AudioContext 로 무엇이 언제 걸리는지만 본다. 실제 화면에서는 브라우저로 따로 본다.
