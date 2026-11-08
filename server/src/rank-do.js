// 랭킹 Durable Object. 게임 id 마다 하나(이름 "classic" 같은 꼴). SQLite 표 하나에 사람마다 한 줄.
// 경기 하나에 두 줄만 쓴다(WITHOUT ROWID 라 따로 붙는 색인 쓰기가 없다). 순위표는 메모리에 두고 기록이 바뀌면 버린다.
// 방(room-do.js)이 랜덤 방 첫 경기가 끝나면 record 를, 입구(index.js)가 순위표를 보일 때 board 를 부른다.

import { DurableObject } from "cloudflare:workers";
import { BOARD_MIN_GAMES, onBoard, rateMatch } from "../../web/js/core/rating.js";
import { afterEntry, boardEntry, dayOf, fromRow, overDaily, rankKey } from "./rank.js";
import { RANK_TOP } from "./protocol.js";

const UPSERT = `INSERT INTO players (key, name, face, rating, games, wins, losses, draws, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET name = excluded.name, face = excluded.face, rating = excluded.rating, games = excluded.games,
  wins = excluded.wins, losses = excluded.losses, draws = excluded.draws, at = excluded.at`;

export class Ranking extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    /** 순위표 { n, top } (기록이 바뀌면 null) */
    this.board_ = null;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS players (
      key TEXT PRIMARY KEY, name TEXT NOT NULL, rating INTEGER NOT NULL, games INTEGER NOT NULL,
      wins INTEGER NOT NULL, losses INTEGER NOT NULL, draws INTEGER NOT NULL, at INTEGER NOT NULL, face TEXT
    ) WITHOUT ROWID`);
    // 11-08 에 그림(face) 칸을 더했다. 그 전에 만든 표에는 한 번만 붙인다
    try {
      this.sql.exec("SELECT face FROM players LIMIT 0");
    } catch {
      this.sql.exec("ALTER TABLE players ADD COLUMN face TEXT");
    }
    // 하루 상한(11-09): 열쇠(pid 해시 또는 "h:" + 같은 곳 꼬리표)마다 오늘 센 경기 수. 지난날 줄은 하루에 한 번 지운다
    this.sql.exec("CREATE TABLE IF NOT EXISTS daily (key TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (key, day)) WITHOUT ROWID");
    this.tidied = null;
  }

  #today(key, day) {
    return key ? this.sql.exec("SELECT n FROM daily WHERE key = ? AND day = ?", key, day).toArray()[0]?.n ?? 0 : null;
  }

  #bump(key, day) {
    if (key) this.sql.exec("INSERT INTO daily (key, day, n) VALUES (?, ?, 1) ON CONFLICT(key, day) DO UPDATE SET n = n + 1", key, day);
  }

  #row(key) {
    return this.sql.exec("SELECT * FROM players WHERE key = ?", key).toArray()[0] || null;
  }

  #put(key, who, rec, at) {
    this.sql.exec(UPSERT, key, who.name, who.face ?? null, rec.rating, rec.games, rec.wins, rec.losses, rec.draws, at);
  }

  /**
   * 한 경기 결과. a·b 는 {pid, name, face, home}(home 은 같은 곳 꼬리표, 모르면 null), score 는 a 쪽에서 본 1·0.5·0.
   * 돌려주는 값: 두 사람 새 기록(delta 포함). 하루 상한(RANK_DAILY)에 닿았으면 { skip: true }(기록은 그대로)
   */
  async record({ a, b, score }) {
    const [ka, kb] = await Promise.all([rankKey(a.pid), rankKey(b.pid)]);
    if (ka === kb) return null;
    const at = Date.now();
    const day = dayOf(at);
    if (this.tidied !== day) {
      this.sql.exec("DELETE FROM daily WHERE day < ?", day);
      this.tidied = day;
    }
    const ha = a.home ? `h:${a.home}` : null;
    const hb = b.home ? `h:${b.home}` : null;
    if (overDaily({ a: this.#today(ka, day), b: this.#today(kb, day), ha: this.#today(ha, day), hb: this.#today(hb, day) })) return { skip: true };
    const out = rateMatch(fromRow(this.#row(ka)), fromRow(this.#row(kb)), score);
    this.#put(ka, a, out.a, at);
    this.#put(kb, b, out.b, at);
    for (const k of [ka, kb, ha, hb]) this.#bump(k, day);
    this.board_ = null;
    return { a: afterEntry(out.a), b: afterEntry(out.b) };
  }

  /**
   * 순위표(상위 RANK_TOP, 경기 BOARD_MIN_GAMES 이상). pid 를 주면 그 사람 기록·순위와,
   * 순위표 안에 있으면 그 줄 번호(me.index, 0부터. 없으면 null)도 준다. 열쇠는 내보내지 않는다
   */
  async board({ pid = null } = {}) {
    if (!this.board_) {
      const rows = this.sql
        .exec("SELECT * FROM players WHERE games >= ? ORDER BY rating DESC, games DESC, at ASC LIMIT ?", BOARD_MIN_GAMES, RANK_TOP)
        .toArray();
      const n = this.sql.exec("SELECT COUNT(*) AS n FROM players WHERE games >= ?", BOARD_MIN_GAMES).one().n;
      this.board_ = { n, top: rows.map(boardEntry), keys: rows.map((r) => r.key) };
    }
    const { n, top, keys } = this.board_;
    if (!pid) return { n, top };
    const key = await rankKey(pid);
    const row = this.#row(key);
    let me = null;
    if (row) {
      let rank = null;
      if (onBoard(row)) {
        const ahead = this.sql
          .exec(
            "SELECT COUNT(*) AS n FROM players WHERE games >= ? AND (rating > ? OR (rating = ? AND games > ?))",
            BOARD_MIN_GAMES,
            row.rating,
            row.rating,
            row.games,
          )
          .one().n;
        rank = ahead + 1;
      }
      const i = keys.indexOf(key);
      me = { ...boardEntry(row), rank, index: i < 0 ? null : i };
    }
    return { n, top, me };
  }
}
