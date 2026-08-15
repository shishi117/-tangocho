// FR001 カードデータモデル。純粋関数のみ。外部import無し（node/ブラウザ両対応）。

/**
 * @typedef {Object} Card
 * @property {string} cardId
 * @property {string} deckId
 * @property {string} front
 * @property {string} back
 * @property {string} term
 * @property {string} meaning
 * @property {string} example
 * @property {string} explanation
 * @property {string} partOfSpeech
 * @property {string[]} tags
 * @property {number} importance  1..5（既定3）
 * @property {number} answerCount
 * @property {number} correctCount
 * @property {number} accuracy    correctCount/answerCount（0除算は0）
 * @property {number} box         Leitner 1..5（既定1）
 * @property {boolean} isDeleted
 * @property {string} owner       UID
 * @property {number} createdAt
 * @property {number} updatedAt
 */

// FR001: answerCount=0 のとき 0。
export function accuracy(correctCount, answerCount) {
  return answerCount === 0 ? 0 : correctCount / answerCount;
}

// FR001/FR005: 範囲外・非数値は既定3へ補正。
export function clampImportance(value) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 3;
}
