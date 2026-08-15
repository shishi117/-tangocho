// FR001 カードデータモデル。Firestore非依存の純粋な型・関数のみ。

export interface Card {
  cardId: string;
  deckId: string;
  front: string;
  back: string;
  term: string;
  meaning: string;
  example: string;
  explanation: string;
  partOfSpeech: string;
  tags: string[];
  importance: number; // 1..5, 既定3
  answerCount: number;
  correctCount: number;
  accuracy: number; // correctCount / answerCount, 0除算は0
  box: number; // Leitner 1..5, 既定1
  isDeleted: boolean;
  owner: string; // UID
  createdAt: number;
  updatedAt: number;
}

// FR001: answerCount=0 のとき 0。
export function accuracy(correctCount: number, answerCount: number): number {
  return answerCount === 0 ? 0 : correctCount / answerCount;
}

// FR001/FR005: 範囲外・非数値は既定3へ補正。
export function clampImportance(value: unknown): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 3;
}
