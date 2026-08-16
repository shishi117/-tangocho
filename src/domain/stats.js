// FR013/FR014 統計の純粋ロジック。副作用なし。テスト対象。
import { accuracy } from "./card.js";

// 習得判定（用語定義）: 正答率>=閾値 かつ 累計回答>=最低回数。既定 80% / 5回（BG-2で変更可）。
export function isMastered(card, threshold = 0.8, minAnswers = 5) {
  return (
    card.answerCount >= minAnswers &&
    accuracy(card.correctCount, card.answerCount) >= threshold
  );
}

// 習得率: 対象カードのうち習得状態の割合（呼び出し側は有効カードのみ渡す）。
export function masteryRate(cards, threshold, minAnswers) {
  if (cards.length === 0) return 0;
  const m = cards.filter((c) => isMastered(c, threshold, minAnswers)).length;
  return m / cards.length;
}

// 全期間正答率: 単位内の 総正答 / 総回答。
export function allTimeAccuracy(cards) {
  let a = 0;
  let c = 0;
  for (const card of cards) {
    a += card.answerCount;
    c += card.correctCount;
  }
  return a === 0 ? 0 : c / a;
}

// 直近N回正答率: 各カードの直近履歴 recent=[{c:0|1,t:ms}] をマージし、新しい順にN件で算出。
// カードごとに直近20件保持していれば、単位全体の直近20件は必ずこの和集合に含まれる。
export function recentAccuracy(cards, n = 20) {
  const events = [];
  for (const card of cards) {
    for (const e of card.recent ?? []) events.push(e);
  }
  events.sort((a, b) => b.t - a.t);
  const top = events.slice(0, n);
  if (top.length === 0) return { rate: 0, count: 0 };
  const correct = top.filter((e) => e.c === 1).length;
  return { rate: correct / top.length, count: top.length };
}

// 連続学習日数（FR014）: 「1日1回以上のセッション完了」を継続条件とする状態遷移。
// 日付は呼び出し側がローカル日付文字列(YYYY-MM-DD)で渡す（純粋性とテスト容易性のため）。
export function updateStreak(prev, today, yesterday) {
  if (!prev || !prev.lastStudyDate) return { lastStudyDate: today, streak: 1 };
  if (prev.lastStudyDate === today) return prev; // 同日は据え置き
  if (prev.lastStudyDate === yesterday) {
    return { lastStudyDate: today, streak: prev.streak + 1 };
  }
  return { lastStudyDate: today, streak: 1 }; // 間が空いたらリセット
}
