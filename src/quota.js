// FR017 無料枠超過の検知と、FR009 未同期件数の監視。
// Firestoreは残量を返さないため、書き込みが resource-exhausted で失敗したら「超過」とみなす受動検知。

let degraded = false; // 無料枠超過中か
let pending = 0; // 未同期の成績書き込み数（オンライン確定前）
let manyPending = false; // 500件超過警告
const subs = new Set();

function notify() {
  const st = getStatus();
  subs.forEach((f) => f(st));
}

export function getStatus() {
  return { degraded, manyPending, pending };
}

export function onQuotaChange(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function isDegraded() {
  return degraded;
}

// 書き込みエラーを分類。resource-exhausted のみ「超過」に遷移させる（offline等は正常扱い）。
export function noteError(err) {
  if (err && err.code === "resource-exhausted" && !degraded) {
    degraded = true;
    notify();
  }
  return err;
}

// 書き込み成功時に超過フラグを解除（枠回復の楽観的検知）。
export function noteSuccess() {
  if (degraded) {
    degraded = false;
    notify();
  }
}

function updatePending() {
  const over = pending > 500; // FR009: 未同期が500件を超えたら警告
  if (over !== manyPending) {
    manyPending = over;
    notify();
  }
}

// 成績書き込みを監視下に置く。件数を数え、成否で超過フラグを更新する。
// 注: 意図的な割り切り — SDKは未同期をIndexedDBに保持し破棄しない。仕様の「最古から破棄」より
// データを残す方が安全なため、破棄せず「500件超で警告」のみ行う（データ損失を避ける）。
export function trackWrite(promise) {
  pending++;
  updatePending();
  promise.then(noteSuccess, noteError).finally(() => {
    pending--;
    updatePending();
  });
  return promise;
}
