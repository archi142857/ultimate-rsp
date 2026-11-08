// 온라인 규약 상수(규약 번호 1). 순수 모듈이라 서버·화면·시험 어디서나 import 할 수 있다.
// 화면(web/js/online)도 같은 값을 쓴다. 바꿀 때는 규약 문서(세션소통\자료\온라인_규약.md)와 화면 쪽 사본을 같이 고친다.

export const PROTOCOL = 1;

/** 받는 출처(배포된 화면). localhost·127.0.0.1 은 포트와 상관없이 받는다(로컬 시험) */
export const ORIGINS = ["https://archi142857.github.io"];

/** 코드 글자(헷갈리는 0·1·I·L·O 뺌)와 길이 */
export const CODE_ABC = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LEN = { challenge: 8, room: 4 };

/** 닉네임 최대 길이(코드 포인트), POST 본문과 WebSocket 메시지 최대 크기(바이트) */
export const NAME_MAX = 20;
export const BODY_MAX = 2048;
export const MSG_MAX = 1024;

/** 이모트 id(그림과 글은 화면이 정한다)와 한 사람이 보낼 수 있는 간격 */
export const EMOTES = ["hi", "gg", "good", "wow", "lol", "hmm", "oops", "cry"];
export const EMOTE_GAP_MS = 2000;

// 도전장
export const CHALLENGE_ROUNDS = [1, 3, 5];
/** 도전장 하나에 답할 수 있는 사람 수(max). 1 이 보통 도전장, 2 부터는 링크 하나에 여럿이 답한다 */
export const CHALLENGE_MAX = { default: 1, max: 50 };
export const CHALLENGE_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

// 방
export const FORMATS = ["single", "bo3", "bo5", "endless"];
export const TIMERS = [0, 10, 20, 30, 60];
export const ROOM_DEFAULTS = { game: "classic", format: "bo3", bot: "human", timer: 20 };
export const GROUP_SEATS = { min: 3, max: 10, default: 5 };
export const GROUP_MODES = ["survive", "loser"];
/** 끊긴 자리를 지키는 시간 */
export const GRACE_MS = 60_000;
/** 공개 연출 몫. 다음 판 마감에 더한다 */
export const REVEAL_MS = 2500;
/** 연달아 이만큼 시간을 넘기면 봇이 자리를 잇는다 */
export const AFK_LIMIT = 3;
/** 아무도 안 낸 판이 이만큼 이어지면 시간을 멈춘다 */
export const IDLE_LIMIT = 3;
export const ENDLESS_MAX = 999;
/** room.hist 에 싣는 판 수 */
export const HIST_MAX = 20;
/** 모두 나간 뒤 방을 지우기까지 */
export const ROOM_DELETE_MS = 10 * 60_000;
/** 한 방의 연결 수(자리 + 구경꾼) */
export const ROOM_SOCKETS = 16;
/** 한 연결이 이 시간 안에 이보다 많이 보내면 끊는다 */
export const MSG_BURST = { count: 20, ms: 10_000 };

// 랜덤 매칭
export const MATCH_FORMATS = ["single", "bo3", "bo5"];
export const MATCH_TIMER = 20;
/** 짝이 없을 때 화면이 봇 대전을 묻는 때 */
export const MATCH_BOT_OFFER_MS = 20_000;
/** 짝이 정해진 뒤 이 안에 안 들어온 자리는 봇이 앉는다 */
export const MATCH_SHOW_MS = 15_000;
/** 여럿이 대기열: 최소 인원이 모인 뒤 사람을 더 기다리는 시간(최대 인원이 차면 바로 시작) */
export const GROUP_MATCH_WAIT_MS = 10_000;

// 랭킹(게임마다 따로, 랜덤 방 첫 경기만 센다. 점수 계산은 web/js/core/rating.js)
/** 순위표에 보이는 사람 수 */
export const RANK_TOP = 50;

// 연결 유지: 화면이 PING 글자를 보내면 서버가 PONG 으로 바로 답한다(서버를 깨우지 않는다)
export const PING = "ping";
export const PONG = "pong";
export const PING_MS = 30_000;
/** 끊긴 뒤 다시 붙는 간격. 끝 값을 계속 쓴다 */
export const RETRY_MS = [1000, 2000, 4000, 8000, 16000, 30000];

/** 오류 코드와 HTTP 상태 */
export const ERRORS = {
  version: 426,
  origin: 403,
  bad_request: 400,
  bad_pid: 400,
  bad_name: 400,
  bad_game: 400,
  bad_rules: 400,
  bad_hand: 400,
  not_found: 404,
  closed: 409,
  own: 409,
  too_fast: 429,
  busy: 503,
  server: 500,
};
/** WebSocket 에서만 쓰는 오류 코드({"t":"error","code"}, 연결은 그대로) */
export const WS_ERRORS = ["not_host", "phase", "stale", "already", "full"];

/** WebSocket 닫는 코드 */
export const CLOSE = {
  version: 4000,
  leave: 4001,
  origin: 4003,
  not_found: 4004,
  bad_request: 4008,
  replaced: 4009,
  deleted: 4010,
  too_fast: 4013,
  full: 4029,
  matched: 4100,
  busy: 4503,
};
/** 이 코드로 닫히면 다시 붙지 않는다(too_fast 는 30초 뒤, matched 는 방으로, busy 는 보통 간격으로 다시) */
export const NO_RETRY = [4000, 4001, 4003, 4004, 4008, 4009, 4010, 4029];
