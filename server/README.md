# Ultimate RSP 서버

궁극의 가위바위보의 온라인 대전 서버입니다. Cloudflare Workers 와 Durable Objects(무료 플랜)로 돌고, 화면(`web/`)은 지금처럼 GitHub Pages 에 있습니다.

- 주소: `https://ultimate-rsp.youngpyo.workers.dev`
- 판정과 봇은 서버가 합니다. `web/js/core`·`data`·`games` 를 그대로 import 해서, 혼자 할 때와 같은 판정을 씁니다.
- 로그인 없이 닉네임만 씁니다. 손은 모두 낼 때까지 서버만 압니다. 공유 링크에는 번호만 들어갑니다.

## 지금 있는 것

| 주소 | 하는 일 |
| --- | --- |
| `GET /api/hello?v=1` | 서버와 규약 번호 확인 |
| `POST /api/c` | 도전장 만들기: 변종과 손(1·3·5개)을 맡기고 8자 코드를 받는다 |
| `GET /api/c/<코드>?v=1` | 도전장 보기. 답이 오기 전에는 만든 사람 손이 안 보인다 |
| `POST /api/c/<코드>/answer` | 도전장 답하기. 처음 한 사람만 받고 닫는다 |
| `POST /api/rooms` | 방 만들기: 규칙(변종·판 수·인원·봇·제한 시간)을 정하고 4자 코드를 받는다 |
| `GET /api/rooms/<코드>/ws` | 방 WebSocket. 자리, 대기실 준비, 손 내기, 공개, 이모트, 다시 하기 |
| `GET /api/match/ws` | 랜덤 매칭 WebSocket. 게임·판 수마다 대기열, 짝이 없으면 봇과 |
| `GET /api/rank/<게임>?v=1` | 게임마다 순위표(5경기 이상, 상위 50) |
| `POST /api/rank` | 순위표와 내 기록·순위(pid 는 본문으로) |

랭킹은 랜덤 매칭으로 만난 사람끼리 한 첫 경기만 셉니다(같은 방에서 다시 하기, 봇 대전, 보통 방은 안 셈). 점수 계산은 `web/js/core/rating.js`(Elo) 그대로이고, 끝날 때 봇이 잇던 자리는 진 것으로 칩니다.

POST 본문은 JSON 이고, CORS 미리 묻기를 줄이려고 `Content-Type: text/plain` 으로 받습니다. WebSocket 은 `ping` 글자를 보내면 서버를 깨우지 않고 `pong` 으로 답합니다.

## 파일

- `src/protocol.js` 규약 상수(규약 번호, 코드 글자, 오류·닫는 코드, 시간). 순수 모듈이라 화면 시험도 import 해서 맞춰 본다.
- `src/index.js` 입구. 출처(`https://archi142857.github.io`, localhost)와 값을 검사하고 Durable Object 로 넘긴다.
- `src/challenge.js` 도전장 규칙(순수 모듈), `src/challenge-do.js` 도전장 저장(Durable Object, 링크 하나에 하나, 30일 뒤 지움).
- `src/room.js` 방 규칙(순수 모듈): 자리·방장, 손 내기와 공개, 시간 초과, 끊김과 봇 이음, 사람마다 보내는 방 꼴. `src/room-do.js` 방 Durable Object(WebSocket Hibernation, 저장 한 줄, 알람 하나).
- `src/match-do.js` 랜덤 매칭 Durable Object(기다리는 사람은 연결 첨부로만 두어 저장소를 안 쓴다).
- `src/rank.js` 랭킹 순수 함수(pid 해시 열쇠, 줄 꼴), `src/rank-do.js` 랭킹 Durable Object(게임마다 하나, SQLite 표 하나, 경기 하나에 두 줄).
- `src/games.js` 온라인에서 고를 수 있는 게임·방 규칙과 판정 자료, `src/check.js` 코드·pid·닉네임 검사, `src/http.js` 응답과 오류.
- `tests/` Cloudflare 없이 도는 시험. 레포 루트의 `node --test` 가 같이 돌린다.

## 돌려 보기

```sh
node --test              # 레포 루트에서: 화면 시험 + 서버 시험
cd server
npm ci
npx wrangler dev         # http://127.0.0.1:8787 에서 로컬로(Durable Object 포함)
```

## 배포

`main` 에 푸시하면 `.github/workflows/server.yml` 이 시험을 돌리고 `wrangler deploy` 로 올립니다. 레포 Secrets 에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 가 있어야 합니다. 무료 플랜 한도(요청 하루 10만 등)는 한국 시간 오전 9시에 풀립니다.
