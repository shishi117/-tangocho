// FR010 間隔反復（Leitner 5箱）。純粋関数。将来 SM-2 等へ差し替えるならこのファイルを置換する。

// 出題重み比 box1:box2:box3:box4:box5 = 16:8:4:2:1（苦手ほど高頻度）。
export const BOX_WEIGHTS = [16, 8, 4, 2, 1] as const;

export function clampBox(box: number): number {
  const n = Math.trunc(box);
  return n < 1 ? 1 : n > 5 ? 5 : n;
}

// 正解: box+1（上限5）。不正解: box=1 リセット。
export function updateBox(box: number, correct: boolean): number {
  return correct ? clampBox(clampBox(box) + 1) : 1;
}

// 箱の重みで1枚を抽選。全カードが同一箱なら重みが等しくなり、自動的に一様抽選になる（FR010の例外を包含）。
// rng は [0,1) を返す関数。既定 Math.random。テスト時はシード付きRNGを注入する。
export function pickCard<T extends { box: number }>(
  cards: readonly T[],
  rng: () => number = Math.random,
): T {
  if (cards.length === 0) {
    throw new Error("pickCard: 対象カードが0件");
  }
  const weights = cards.map((c) => BOX_WEIGHTS[clampBox(c.box) - 1]);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < cards.length; i++) {
    r -= weights[i];
    if (r < 0) return cards[i];
  }
  return cards[cards.length - 1]; // 浮動小数の丸め対策
}
