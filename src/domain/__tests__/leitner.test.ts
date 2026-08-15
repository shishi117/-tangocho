import { describe, expect, it } from "vitest";
import { BOX_WEIGHTS, clampBox, pickCard, updateBox } from "../leitner";

// 決定論的な擬似乱数（mulberry32）。テストのフレークを避けるためシード固定。
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("updateBox", () => {
  it("正解で+1、上限5", () => {
    expect(updateBox(1, true)).toBe(2);
    expect(updateBox(5, true)).toBe(5);
  });
  it("不正解で1へリセット", () => {
    expect(updateBox(4, false)).toBe(1);
  });
  it("範囲外入力を丸める", () => {
    expect(clampBox(0)).toBe(1);
    expect(clampBox(9)).toBe(5);
  });
});

describe("pickCard 抽選比 (TR-1)", () => {
  it("大量試行で 16:8:4:2:1 に相対±5%で収束する", () => {
    // 各箱に1枚ずつ → カード選択＝箱選択。
    const cards = [1, 2, 3, 4, 5].map((box) => ({ box }));
    const rng = mulberry32(42);
    const N = 200_000; // 校正: box5(期待3.2%)でも十分な標本数になるよう設定
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < N; i++) {
      counts[pickCard(cards, rng).box - 1]++;
    }
    const totalW = BOX_WEIGHTS.reduce((a, b) => a + b, 0);
    for (let b = 0; b < 5; b++) {
      const observed = counts[b] / N;
      const expected = BOX_WEIGHTS[b] / totalW;
      expect(Math.abs(observed - expected) / expected).toBeLessThan(0.05);
    }
  });

  it("全カード同一箱なら一様に近い（例外フォールバック）", () => {
    const cards = Array.from({ length: 4 }, () => ({ box: 3 }));
    const rng = mulberry32(7);
    const counts = [0, 0, 0, 0];
    const N = 40_000;
    for (let i = 0; i < N; i++) {
      counts[cards.indexOf(pickCard(cards, rng))]++;
    }
    for (const c of counts) {
      expect(Math.abs(c / N - 0.25)).toBeLessThan(0.02);
    }
  });
});
