import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allTimeAccuracy,
  isMastered,
  masteryRate,
  recentAccuracy,
  updateStreak,
} from "../stats.js";

const card = (correctCount, answerCount, recent = []) => ({
  correctCount,
  answerCount,
  recent,
});

test("isMastered: 80%かつ5回以上の境界", () => {
  assert.equal(isMastered(card(4, 5)), true); // 80%・5回 → 習得
  assert.equal(isMastered(card(4, 6)), false); // 66% → 未達
  assert.equal(isMastered(card(4, 4)), false); // 100%だが4回 → 回数不足
  assert.equal(isMastered(card(8, 10, []), 0.9, 5), false); // 閾値90% → 未達
});

test("masteryRate: 習得カードの割合", () => {
  const cards = [card(5, 5), card(1, 5), card(5, 5)]; // 習得2 / 3
  assert.equal(masteryRate(cards, 0.8, 5), 2 / 3);
  assert.equal(masteryRate([], 0.8, 5), 0);
});

test("allTimeAccuracy: 総正答/総回答", () => {
  assert.equal(allTimeAccuracy([card(3, 4), card(1, 6)]), 4 / 10);
  assert.equal(allTimeAccuracy([card(0, 0)]), 0);
});

test("recentAccuracy: 複数カードをマージし新しい順に20件", () => {
  const a = card(0, 0, [{ c: 1, t: 100 }, { c: 0, t: 300 }]);
  const b = card(0, 0, [{ c: 1, t: 200 }, { c: 1, t: 400 }]);
  const r = recentAccuracy([a, b], 20);
  assert.equal(r.count, 4);
  assert.equal(r.rate, 3 / 4);
  // 上位2件（t=400,300）は 正・誤 → 50%
  assert.equal(recentAccuracy([a, b], 2).rate, 1 / 2);
  assert.deepEqual(recentAccuracy([card(0, 0, [])]), { rate: 0, count: 0 });
});

test("updateStreak: 新規・同日・連続・間欠", () => {
  assert.deepEqual(updateStreak(null, "2026-08-15", "2026-08-14"), {
    lastStudyDate: "2026-08-15",
    streak: 1,
  });
  const prev = { lastStudyDate: "2026-08-15", streak: 3 };
  assert.equal(updateStreak(prev, "2026-08-15", "2026-08-14"), prev); // 同日据え置き
  assert.deepEqual(updateStreak(prev, "2026-08-16", "2026-08-15"), {
    lastStudyDate: "2026-08-16",
    streak: 4,
  }); // 連続
  assert.deepEqual(updateStreak(prev, "2026-08-20", "2026-08-19"), {
    lastStudyDate: "2026-08-20",
    streak: 1,
  }); // 間が空いた
});
