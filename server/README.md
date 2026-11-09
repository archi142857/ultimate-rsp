# Ultimate RSP 서버

궁극의 가위바위보의 온라인 대전 서버입니다. Cloudflare Workers 와 Durable Objects(무료 플랜)로 돌고, 화면(`web/`)은 지금처럼 GitHub Pages 에 있습니다.

- 주소: `https://ultimate-rsp.youngpyo.workers.dev`
- 판정과 봇은 서버가 합니다. `web/js/core`·`data`·`games` 를 그대로 import 해서, 혼자 할 때와 같은 판정을 씁니다.
- 로그인 없이도 닉네임과 프로필 그림(`face`, `web/art` 그림 이름, 없어도 됨)만으로 놉니다. 로그인(구글·카카오, 나중에 애플·스팀)은 고를 수 있고, 하면 기록과 이름이 어느 기기에서든 따라옵니다. 손은 모두 낼 때까지 서버만 압니다. 공유 링크에는 번호만 들어갑니다.

## 지금 있는 것

| 주소 | 하는 일 |
| --- | --- |
| `GET /api/hello?v=1` | 서버와 규약 번호 확인 |
| `POST /api/c` | 도전장 만들기: 변종과 손(1·3·5개)을 맡기고 8자 코드를 받는다. `max` 를 2–50 으로 주면 링크 하나에 여럿이 답하고, 결과는 마감(다 참·만든 사람이 닫음·만든 뒤 24시간) 때 한꺼번에 연다 |
| `GET /api/c/<코드>?v=1` | 도전장 보기. 답이 오기 전에는 만든 사람 손이 안 보인다(여럿이 도전장은 답한 사람들의 결과만, 손은 안 보인다) |
| `POST /api/c/<코드>/answer` | 도전장 답하기. 보통 도전장은 처음 한 사람만 받고 닫고, 여럿이 도전장은 `max` 명까지 받는다 |
| `POST /api/c/<코드>/me` | pid 로 묻는 도전장 꼴. 여럿이 도전장에서 만든 사람은 모든 답의 손, 답한 사람은 마감 뒤에 자기 결과 |
| `POST /api/c/<코드>/close` | 만든 사람이 여럿이 도전장을 닫는다(더 받지 않고 모두에게 결과를 연다) |
| `POST /api/rooms` | 방 만들기: 규칙(변종·판 수·인원·봇·제한 시간)을 정하고 4자 코드를 받는다. 화면이 고른 `code` 를 주면 그 코드로 만들고, 이미 있는 방이면 `taken` 과 방장 이름·그림(`host`)으로 알린다 |
| `GET /api/rooms/<코드>/ws` | 방 WebSocket. 자리, 대기실 준비, 손 내기, 공개, 이모트, 다시 하기 |
| `GET /api/match/ws` | 랜덤 매칭 WebSocket. 게임·판 수마다 대기열, 짝이 없으면 봇과. `game=group` 이면 여럿이 가위바위보 대기열(바탕·정하기마다, 3명이 모이면 10초 더 기다렸다가, 바탕의 최대 인원이 차면 바로) |
| `GET /api/rank/<게임>?v=1` | 게임마다 순위표(5경기 이상, 상위 50) |
| `POST /api/rank` | 순위표와 내 기록·순위(pid 는 본문으로) |
| `GET /api/auth?v=1` | 켜진 로그인 방법(서버에 열쇠가 있는 제공자만) |
| `POST /api/auth/<제공자>/start` → `GET …/callback` → `POST /api/auth/redeem` | 웹 로그인: 제공자 로그인 창에 다녀와 한 번 쓰는 코드를 세션 토큰으로 바꾼다 |
| `POST /api/auth/<제공자>/token` | 앱·스팀 로그인: 그 플랫폼이 준 토큰(구글 ID 토큰, 카카오 액세스 토큰)을 서버가 확인하고 세션 토큰을 준다 |
| `POST /api/auth/signup` | 처음 보는 로그인은 가입 표를 받는다. 가입 화면(이름·처리방침 동의·만 14세 이상)을 마치면 계정을 만들고 동의한 판·시각을 남긴다 |
| `POST /api/auth/email/signup·verify·login·reset·reset/confirm` | 이메일·비밀번호: 확인 코드 메일로 가입·비밀번호 찾기. 비밀번호는 화면이 PBKDF2(60만 번)로 바꿔 보낸다. **지금은 꺼 둠**(메일 열쇠가 없으면 `no_provider`) |
| `POST /api/account[/profile\|/logout\|/unlink\|/delete]` | 세션 토큰으로 계정 보기(로그인 방법, 로그인해 있는 기기 수 `devices`), 이름·그림, 이 기기 로그아웃, 로그인 방법 떼기, 계정 지우기 |

랭킹은 랜덤 매칭으로 만난 두 사람이 한 첫 경기만 셉니다(같은 방에서 다시 하기, 봇 대전, 보통 방, 여럿이 랜덤, 같은 곳(IP)에서 온 두 사람은 안 셈. IP 는 날마다 바뀌는 해시로만 대기열에 둡니다). 게임마다 하루(UTC)에 pid 하나는 30경기, 같은 곳 하나는 60경기까지만 셉니다. 점수 계산은 `web/js/core/rating.js`(Elo) 그대로이고, 끝날 때 봇이 잇던 자리는 진 것으로 칩니다.

랜덤 매칭 대기열과 게임마다 하나인 순위표는 동북아(`apac-ne`)에 두고, 랜덤 방은 두 사람이 있는 곳 가까이 만듭니다(`src/where.js`). 사람이 직접 만드는 방·도전장은 만든 사람 가까이 생깁니다. 방 상태 저장은 확인을 기다리지 않고 바로 알립니다(손 하나마다 지연을 줄이려고).

여럿이 인원은 방과 랜덤 매칭 모두 바탕마다 `web/js/data/online.js` 의 `seatRange`(손 셋 3–8명, 손 많은 바탕 3–20명)를 따릅니다. 손 많은 바탕은 `MANY_HAND_GROUP` 을 켜면 열립니다. 서버는 준비돼 있고, 켜면 `server/tests/room.test.mjs` 의 손 많은 바탕 시험이 같이 돕니다. 방의 구경꾼은 6명까지고, 자리가 있거나 앉을 수 있는 사람은 늘 들어옵니다. 닉네임에 빈칸처럼 보이는 글자(한글 채움 문자, 점자 빈칸, 크메르 안 보이는 모음)와 서식 문자(U+200D 빼고)는 받지 않습니다. 이체 선택자는 그림 글자 뒤 U+FE0E·U+FE0F 와 한자 뒤 U+E0100–U+E01EF 만 받습니다.

이메일·비밀번호 가입은 지금 꺼 둡니다(로그인은 구글·카카오만, 사용자 11-09). 코드는 그대로 두었고 메일 열쇠를 넣으면 켜집니다. 켜면 메일 주소를 HMAC 한 값만, 비밀번호는 화면이 PBKDF2-HMAC-SHA256(60만 번, 소금은 `ursp-email-v1:` + 다듬은 주소)로 만든 열쇠를 다시 HMAC 한 값만 둡니다. 가입된 주소인지 아닌지는 답으로 드러나지 않고(메일만 다름), 확인 코드는 5번, 하루 15번까지 틀릴 수 있고, 메일은 한 주소에 한 시간 5통, 로그인은 15분에 10번 틀리면 잠깁니다. 메일은 Resend 로 보냅니다(`RESEND_API_KEY`·`MAIL_FROM`, 우리 도메인 인증이 필요).

계정은 게임 속 나(pid)를 어느 기기에서든 되찾는 열쇠입니다. 게임 주소는 지금처럼 pid 만 보고, 로그인하면 계정의 pid 를 받아 씁니다. 계정 하나에 로그인을 여러 개 붙일 수 있습니다. 서버는 이메일·이름을 받지 않고(구글은 `openid` 범위만, 카카오는 동의 항목 없이 사용자 정보 `/v2/user/me` 에서 회원번호만 읽음. 카카오는 처음 로그인 뒤 24시간 안에 이 조회가 없으면 '가입 미완료'로 보고 연결을 끊는다), 제공자 회원번호는 서버만 아는 값으로 HMAC 한 값만, 세션 토큰은 SHA-256 만 둡니다. 세션 토큰은 쿠키가 아니라 본문으로 주고받아 웹·앱·스팀이 같은 방식을 씁니다. 웹 로그인은 로그인을 시작한 화면만 아는 nonce 로 끝을 맺어, 남이 만든 로그인 주소로 남의 계정에 들어가게 할 수 없습니다(구글은 PKCE·OIDC nonce 도 씁니다). 로그인한 채 방법을 더하면 그 기기는 새 토큰을 받고, 옛 토큰은 1분 뒤 끝납니다(그사이 떠 있던 요청이 막히지 않게).

POST 본문은 JSON 이고, CORS 미리 묻기를 줄이려고 `Content-Type: text/plain` 으로 받습니다. WebSocket 은 `ping` 글자를 보내면 서버를 깨우지 않고 `pong` 으로 답합니다.

## 파일

- `src/protocol.js` 규약 상수(규약 번호, 코드 글자, 오류·닫는 코드, 시간). 순수 모듈이라 화면 시험도 import 해서 맞춰 본다.
- `src/index.js` 입구. 출처(`https://archi142857.github.io`, localhost)와 값을 검사하고 Durable Object 로 넘긴다.
- `src/challenge.js` 도전장 규칙(순수 모듈), `src/challenge-do.js` 도전장 저장(Durable Object, 링크 하나에 하나, 30일 뒤 지움).
- `src/room.js` 방 규칙(순수 모듈): 자리·방장, 손 내기와 공개, 시간 초과, 끊김과 봇 이음, 사람마다 보내는 방 꼴. `src/room-do.js` 방 Durable Object(WebSocket Hibernation, 저장 한 줄, 알람 하나).
- `src/match-do.js` 랜덤 매칭 Durable Object(기다리는 사람은 연결 첨부로만 두어 저장소를 안 쓴다. 여럿이 대기열은 알람 하나만 둔다). `src/queue.js` 여럿이 대기열이 언제 시작할지(순수 모듈).
- `src/where.js` DO 자리 힌트(나라·대륙 → location hint).
- `src/auth.js` 로그인 제공자(구글·카카오, 로컬 시험용 test). 제공자마다 '확인된 회원번호'만 얻는 모듈이라 애플·스팀은 하나씩 더하면 된다. ID 토큰(RS256) 확인, PKCE.
- `src/account.js` 계정 규칙(순수 모듈: 로그인 정하기, 돌아갈 주소·동의·메일·코드 검사), `src/account-do.js` 계정 Durable Object(하나, 동북아, SQLite), `src/account-route.js` 로그인·계정 주소, `src/mail.js` 메일(Resend).
- `src/rank.js` 랭킹 순수 함수(pid 해시 열쇠, 줄 꼴), `src/rank-do.js` 랭킹 Durable Object(게임마다 하나, SQLite 표 하나, 경기 하나에 두 줄).
- `src/games.js` 온라인에서 고를 수 있는 게임·방 규칙과 판정 자료, `src/check.js` 코드·pid·닉네임·그림 검사, `src/http.js` 응답과 오류.
- `tests/` Cloudflare 없이 도는 시험. 레포 루트의 `node --test` 가 같이 돌린다.

## 돌려 보기

```sh
node --test              # 레포 루트에서: 화면 시험 + 서버 시험
cd server
npm ci
npx wrangler dev         # http://127.0.0.1:8787 에서 로컬로(Durable Object 포함)
npx wrangler dev --var AUTH_TEST:1   # 로그인 창 없이 바로 돌아오는 시험 제공자(test)와, 메일 대신 답에 코드를 싣는 이메일 가입까지
```

## 배포

`main` 에 푸시하면 `.github/workflows/server.yml` 이 시험을 돌리고 `wrangler deploy` 로 올립니다. 레포 Secrets 에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 가 있어야 합니다. 로그인을 켜려면 같은 곳에 `GOOGLE_CLIENT_ID`·`GOOGLE_CLIENT_SECRET`, `KAKAO_REST_KEY`(카카오 앱에서 클라이언트 시크릿을 켰으면 `KAKAO_CLIENT_SECRET` 도)를 넣습니다. 배포가 있는 것만 Worker secrets 로 넣고, 열쇠가 없는 제공자는 꺼져 있습니다. 리디렉션 URI 는 `https://ultimate-rsp.youngpyo.workers.dev/api/auth/<google|kakao>/callback` 입니다. 카카오 앱의 동의항목은 아무것도 켜지 않습니다(처리방침대로 회원번호만 받는다). 이메일 열쇠(`RESEND_API_KEY`·`MAIL_FROM`)는 이메일을 켤 때만 넣습니다. 무료 플랜 한도(요청 하루 10만 등)는 한국 시간 오전 9시에 풀립니다.
