import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCsv, parseCsv, toCsv } from "../csv.js";

test("parseCsv: 引用符内のカンマ・改行・エスケープを処理", () => {
  const rows = parseCsv('term,meaning\n"a,b","line1\nline2"\n"he said ""hi""",x');
  assert.deepEqual(rows[0], ["term", "meaning"]);
  assert.deepEqual(rows[1], ["a,b", "line1\nline2"]);
  assert.deepEqual(rows[2], ['he said "hi"', "x"]);
});

test("TR-3: term列が無ければファイル全体エラー", () => {
  const res = normalizeCsv("meaning,example\nfoo,bar");
  assert.equal(res.ok, false);
  assert.equal(res.reason, "no_term_column");
});

test("TR-3: term空行はエラー行として除外", () => {
  const res = normalizeCsv("term,meaning\n,空だよ\nりんご,apple");
  assert.equal(res.cards.length, 1);
  assert.deepEqual(res.errorRows, [2]);
  assert.equal(res.cards[0].term, "りんご");
});

test("TR-3: 256文字超過行は除外", () => {
  const long = "あ".repeat(257);
  const res = normalizeCsv(`term,meaning\nok,fine\nbad,${long}`);
  assert.equal(res.cards.length, 1);
  assert.deepEqual(res.errorRows, [3]);
});

test("TR-3: 列不足は空欄補正、列超過は無視", () => {
  const res = normalizeCsv("term,meaning,extra\nりんご,apple,無視,余分");
  assert.equal(res.cards.length, 1);
  assert.equal(res.cards[0].meaning, "apple");
  assert.equal(res.cards[0].example, ""); // example列が無い→空欄
});

test("tags は ; 区切りで配列化、importance は範囲補正", () => {
  const res = normalizeCsv("term,tags,importance\nりんご,果物;赤,9");
  assert.deepEqual(res.cards[0].tags, ["果物", "赤"]);
  assert.equal(res.cards[0].importance, 3); // 9は範囲外→既定3
});

test("制御文字（改行・タブ以外）は除去", () => {
  const res = normalizeCsv("term\nり\u0007んご");
  assert.equal(res.cards[0].term, "りんご");
});

test("toCsv→normalizeCsv 往復: カンマ・引用符・改行・tags・importanceを保持", () => {
  const cards = [
    { term: "a,b", meaning: 'say "hi"', example: "l1\nl2", explanation: "", partOfSpeech: "名詞", tags: ["x", "y"], importance: 5 },
    { term: "犬", meaning: "dog", example: "", explanation: "", partOfSpeech: "", tags: [], importance: 3 },
  ];
  const back = normalizeCsv(toCsv(cards));
  assert.equal(back.ok, true);
  assert.equal(back.cards.length, 2);
  assert.equal(back.cards[0].term, "a,b");
  assert.equal(back.cards[0].meaning, 'say "hi"');
  assert.equal(back.cards[0].example, "l1\nl2");
  assert.deepEqual(back.cards[0].tags, ["x", "y"]);
  assert.equal(back.cards[0].importance, 5);
});
