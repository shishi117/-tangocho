// FR005 CSV取り込みの中核。パース＋正規化＋検証の純粋関数。外部import無し。
import { clampImportance } from "./card.js";

const FIELDS = [
  "term",
  "meaning",
  "example",
  "explanation",
  "partOfSpeech",
  "tags",
  "importance",
];
const MAX_LEN = 256;

// 制御文字を除去。ただしタブ(0x09)と改行(0x0A)は残す（仕様: 改行・タブを除く制御文字を除去）。
function stripControl(s) {
  return s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
}

// RFC4180準拠の最小パーサ。split(',')は引用符内カンマ・改行で壊れるため自前で持つ。
// 上限: 全文をメモリに載せる素朴実装（1,000行/10秒要件には十分）。巨大化したらストリーム化がアップグレードパス。
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM除去
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// 正規化＋検証。戻り値は取り込み入口の契約に沿う。
// { ok, reason?, cards, errorRows, errorCount }  errorRowsは1始まりの行番号（ヘッダを1行目とする）。
export function normalizeCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { ok: false, reason: "empty", cards: [], errorRows: [], errorCount: 0 };
  }
  const header = rows[0].map((h) => h.trim());
  const idx = {};
  for (const f of FIELDS) idx[f] = header.indexOf(f);
  if (idx.term === -1) {
    // term列が無い → ファイル全体をエラー。
    return { ok: false, reason: "no_term_column", cards: [], errorRows: [], errorCount: 0 };
  }

  const cards = [];
  const errorRows = [];
  for (let r = 1; r < rows.length; r++) {
    const raw = rows[r];
    const lineNo = r + 1; // ヘッダが1行目
    if (raw.every((c) => c.trim() === "")) continue; // 空行はスキップ（エラーではない）

    const get = (f) =>
      stripControl(idx[f] >= 0 && idx[f] < raw.length ? raw[idx[f]] : ""); // 列不足は空欄扱い

    const v = {
      term: get("term"),
      meaning: get("meaning"),
      example: get("example"),
      explanation: get("explanation"),
      partOfSpeech: get("partOfSpeech"),
      tags: get("tags"),
      importance: get("importance"),
    };

    if (v.term.trim() === "") {
      errorRows.push(lineNo); // term空はエラー行
      continue;
    }
    if (Object.values(v).some((x) => x.length > MAX_LEN)) {
      errorRows.push(lineNo); // 256文字超過はエラー行
      continue;
    }

    cards.push({
      term: v.term,
      meaning: v.meaning,
      example: v.example,
      explanation: v.explanation,
      partOfSpeech: v.partOfSpeech,
      tags: v.tags.split(";").map((t) => t.trim()).filter(Boolean),
      importance: clampImportance(v.importance),
    });
  }
  return { ok: true, cards, errorRows, errorCount: errorRows.length };
}
