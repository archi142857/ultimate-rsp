// 서버 규약의 수(온라인 규약 1.4·3·4·5장). server/src/protocol.js 와 같아야 한다.
// 화면은 서버 폴더를 불러올 수 없어(배포는 web/ 만) 사본을 두고, tests/online-protocol.test.mjs 가 맞는지 본다.

export const EMOTES = ["hi", "gg", "good", "wow", "lol", "hmm", "oops", "cry"];
export const EMOTE_GAP_MS = 2000;

export const FORMATS = ["single", "bo3", "bo5", "endless"];
export const MATCH_FORMATS = ["single", "bo3", "bo5"];
export const TIMERS = [0, 10, 20, 30, 60];
export const ROOM_DEFAULTS = { game: "classic", format: "bo3", bot: "human", timer: 20 };
export const GROUP_SEATS = { min: 3, max: 10, default: 5 };
export const GROUP_MODES = ["survive", "loser"];

/** 끊긴 자리를 지켜 주는 시간, 공개 연출 몫, 랜덤 매칭에서 봇을 권하는 때 */
export const GRACE_MS = 60_000;
export const REVEAL_MS = 2500;
export const MATCH_BOT_OFFER_MS = 20_000;
/** 여럿이 랜덤 매칭: 최소 인원이 모인 뒤 더 기다리는 시간(규약 4.2) */
export const GROUP_MATCH_WAIT_MS = 10_000;

export const PING = "ping";
export const PONG = "pong";
export const PING_MS = 30_000;
/** 다시 붙는 간격(그 뒤로는 마지막 값마다) */
export const RETRY_MS = [1000, 2000, 4000, 8000, 16000, 30000];
/** 너무 많이 보내 끊겼을 때(4013) 기다리는 시간 */
export const TOO_FAST_WAIT_MS = 30_000;

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
/** 이 코드로 닫히면 다시 붙지 않는다 */
export const NO_RETRY = [4000, 4001, 4003, 4004, 4008, 4009, 4010, 4029];
