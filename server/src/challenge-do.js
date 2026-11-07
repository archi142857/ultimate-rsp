// 도전장 Durable Object. 링크(코드) 하나에 하나. 규칙은 challenge.js, 여기는 저장만 한다.
// 저장은 키 하나("c")에 기록 전체. 30일 뒤 알람으로 지운다.

import { DurableObject } from "cloudflare:workers";
import { answerChallenge, viewChallenge } from "./challenge.js";
import { Fail } from "./http.js";

const KEY = "c";

export class Challenge extends DurableObject {
  /** 새 기록을 둔다. 이미 쓰는 코드면 { taken: true } (입구가 다른 코드로 다시 한다) */
  async create(rec) {
    if (await this.ctx.storage.get(KEY)) return { taken: true };
    await this.ctx.storage.put(KEY, rec);
    await this.ctx.storage.setAlarm(rec.expires);
    return { taken: false };
  }

  async view() {
    const rec = await this.#load();
    return rec ? { view: viewChallenge(rec) } : { error: "not_found", status: 404 };
  }

  async answer(body) {
    const rec = await this.#load();
    if (!rec) return { error: "not_found", status: 404 };
    try {
      const { rec: next, changed } = answerChallenge(rec, body, Date.now());
      if (changed) await this.ctx.storage.put(KEY, next);
      return { view: viewChallenge(next) };
    } catch (e) {
      if (e instanceof Fail) return { error: e.code, status: e.status, ...(e.extra || {}) };
      throw e;
    }
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }

  async #load() {
    const rec = await this.ctx.storage.get(KEY);
    if (!rec) return null;
    if (Date.now() >= rec.expires) {
      // 알람이 늦어도 기한 지난 것은 안 보인다
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      return null;
    }
    return rec;
  }
}
