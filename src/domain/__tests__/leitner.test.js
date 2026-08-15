import { test } from "node:test";
import assert from "node:assert/strict";
import { BOX_WEIGHTS, clampBox, pickCard, updateBox } from "../leitner.js";

// 決定論的な擬似乱数（mulberry32）。テストのフレークを避けるためシード固定。
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("updateBox: 正解で+1・上限5、不正解で1リセット", () => {
  assert.equal(updateBox(1, true), 2);
  assert.equal(updateBox(5, true), 5);
  assert.equal(updateBox(4, false), 1);
});

test("clampBox: 範囲外を丸める", () => {
  assert.equal(clampBox(0), 1);
  assert.equal(clampBox(9), 5);
});

test("pickCard 抽選比 (TR-1): 16:8:4:2:1 に相対±5%で収束", () => {
  // 各箱に1枚ずつ → カード選択＝箱選択。
  const cards = [1, 2, 3, 4, 5].map((box) => ({ box }));
  const rng = mulberry32(42);
  const N = 200_000; // 校正: box5(期待3.2%)でも十分な標本数になる試行数
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    counts[pickCard(cards, rng).box - 1]++;
  }
  const totalW = BOX_WEIGHTS.reduce((a, b) => a + b, 0);
  for (let b = 0; b < 5; b++) {
    const observed = counts[b] / N;
    const expected = BOX_WEIGHTS[b] / totalW;
    assert.ok(
      Math.abs(observed - expected) / expected < 0.05,
      `box${b + 1}: observed=${observed.toFixed(4)} expected=${expected.toFixed(4)}`,
    );
  }
});

test("全カード同一箱なら一様に近い（例外フォールバック）", () => {
  const cards = Array.from({ length: 4 }, () => ({ box: 3 }));
  const rng = mulberry32(7);
  const counts = [0, 0, 0, 0];
  const N = 40_000;
  for (let i = 0; i < N; i++) {
    counts[cards.indexOf(pickCard(cards, rng))]++;
  }
  for (const c of counts) {
    assert.ok(Math.abs(c / N - 0.25) < 0.02);
  }
});
