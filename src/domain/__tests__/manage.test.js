import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt } from "../prompt.js";
import { searchCards } from "../search.js";
import { validateFields } from "../csv.js";

test("buildPrompt: 空入力は生成しない、両方あれば列定義を含む", () => {
  assert.equal(buildPrompt("", "英検").ok, false);
  assert.equal(buildPrompt("動物", "").ok, false);
  const r = buildPrompt("動物", "英検準1級");
  assert.equal(r.ok, true);
  assert.match(r.prompt, /term,meaning,example,explanation,partOfSpeech,tags,importance/);
  assert.match(r.prompt, /英検準1級/);
});

test("searchCards: term・tagsで絞り込み", () => {
  const cards = [
    { term: "apple", tags: ["果物"], box: 1, accuracy: 0.2, importance: 5 },
    { term: "dog", tags: ["動物"], box: 3, accuracy: 0.9, importance: 2 },
  ];
  assert.equal(searchCards(cards, { query: "app" }).length, 1);
  assert.equal(searchCards(cards, { query: "動物" })[0].term, "dog");
  assert.equal(searchCards(cards, { query: "zzz" }).length, 0);
});

test("searchCards: box/accuracy/importanceで並び替え、非対応キーは無視", () => {
  const cards = [
    { term: "a", box: 3, accuracy: 0.1, importance: 1, tags: [] },
    { term: "b", box: 1, accuracy: 0.9, importance: 5, tags: [] },
  ];
  assert.equal(searchCards(cards, { sortBy: "box", order: "asc" })[0].term, "b");
  assert.equal(searchCards(cards, { sortBy: "accuracy", order: "desc" })[0].term, "b");
  assert.equal(searchCards(cards, { sortBy: "term" })[0].term, "a"); // 非対応→元順
});

test("validateFields: term空・256超過は除外、tags分割・importance補正", () => {
  assert.equal(validateFields({ term: "" }).ok, false);
  assert.equal(validateFields({ term: "あ".repeat(257) }).ok, false);
  const r = validateFields({ term: "犬", tags: "動物;哺乳類", importance: "9" });
  assert.deepEqual(r.card.tags, ["動物", "哺乳類"]);
  assert.equal(r.card.importance, 3);
});
