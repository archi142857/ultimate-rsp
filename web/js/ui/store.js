// 브라우저에만 남기는 기록과 설정. 저장이 막힌 곳(사생활 보호 창 등)에서도 앱은 그대로 돈다.

const PREFIX = "ursp.";

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 저장 못 해도 괜찮다 */
  }
}

/** 변종마다 이긴·비긴·진 판 수 */
export function record(id) {
  const all = load("records", {});
  return all[id] || { w: 0, d: 0, l: 0 };
}

export function addRecord(id, cmp) {
  const all = load("records", {});
  const r = all[id] || { w: 0, d: 0, l: 0 };
  if (cmp > 0) r.w += 1;
  else if (cmp < 0) r.l += 1;
  else r.d += 1;
  all[id] = r;
  save("records", all);
  return r;
}

export function setting(key, fallback) {
  return load("set." + key, fallback);
}

export function setSetting(key, value) {
  save("set." + key, value);
}
