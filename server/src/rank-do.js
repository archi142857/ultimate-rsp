// 랭킹 Durable Object. 게임 id 마다 하나(이름 "classic" 같은 꼴). SQLite 표 하나에 사람마다 한 줄.
// 경기 하나에 두 줄만 쓴다(WITHOUT ROWID 라 따로 붙는 색인 쓰기가 없다). 순위표는 메모리에 두고 기록이 바뀌면 버린다.
// 방(room-do.js)이 랜덤 방 첫 경기가 끝나면 record 를, 입구(index.js)가 순위표를 보일 때 board 를 부른다.

import { DurableObject } from "cloudflare:workers";
import { BOARD_MIN_GAMES, onBoard, rateMatch } from "../../web/js/core/rating.js";
import { afterEntry, boardEntry, fromRow, rankKey } from "./rank.js";
import { RANK_TOP } from "./protocol.js";

const UPSERT = `INSERT INTO players (key, name, rating, games, wins, losses, draws, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET name = excluded.name, rating = excluded.rating, games = excluded.games,
  wins = excluded.wins, losses = excluded.losses, draws = excluded.draws, at = excluded.at`;

export class Ranking extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    /** 순위표 { n, top } (기록이 바뀌면 null) */
    this.board_ = null;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS players (
      key TEXT PRIMARY KEY, name TEXT NOT NULL, rating INTEGER NOT NULL, games INTEGER NOT NULL,
      wins INTEGER NOT NULL, losses INTEGER NOT NULL, draws INTEGER NOT NULL, at INTEGER NOT NULL
    ) WITHOUT ROWID`);
  }

  #row(key) {
    return this.sql.exec("SELECT * FROM players WHERE key = ?", key).toArray()[0] || null;
  }

  #put(key, name, rec, at) {
    this.sql.exec(UPSERT, key, name, rec.rating, rec.games, rec.wins, rec.losses, rec.draws, at);
  }

  /** 한 경기 결과. a·b 는 {pid, name}, score 는 a 쪽에서 본 1·0.5·0. 돌려주는 값: 두 사람 새 기록(delta 포함) */
  async record({ a, b, score }) {
    const [ka, kb] = await Promise.all([rankKey(a.pid), rankKey(b.pid)]);
    if (ka === kb) return null;
    const out = rateMatch(fromRow(this.#row(ka)), fromRow(this.#row(kb)), score);
    const at = Date.now();
    this.#put(ka, a.name, out.a, at);
    this.#put(kb, b.name, out.b, at);
    this.board_ = null;
    return { a: afterEntry(out.a), b: afterEntry(out.b) };
  }

  /** 순위표(상위 RANK_TOP, 경기 BOARD_MIN_GAMES 이상). pid 를 주면 그 사람 기록과 순위(me)도 */
  async board({ pid = null } = {}) {
    if (!this.board_) {
      const top = this.sql
        .exec("SELECT * FROM players WHERE games >= ? ORDER BY rating DESC, games DESC, at ASC LIMIT ?", BOARD_MIN_GAMES, RANK_TOP)
        .toArray()
        .map(boardEntry);
      const n = this.sql.exec("SELECT COUNT(*) AS n FROM players WHERE games >= ?", BOARD_MIN_GAMES).one().n;
      this.board_ = { n, top };
    }
    if (!pid) return this.board_;
    const row = this.#row(await rankKey(pid));
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
      me = { ...boardEntry(row), rank };
    }
    return { ...this.board_, me };
  }
}
