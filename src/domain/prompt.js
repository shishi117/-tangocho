// FR004 D方式: テーマ名・資格名から生成指示文を作る純粋関数。
// 出力CSVがFR005でそのまま取り込めるよう、列定義を明記する。
export function buildPrompt(theme, qualification) {
  const t = (theme ?? "").trim();
  const q = (qualification ?? "").trim();
  if (!t || !q) return { ok: false };
  const prompt = `資格「${q}」の学習用に、テーマ「${t}」の単語カードを10枚作ってください。
出力はCSVのみ（前後の説明文は不要）。1行目はヘッダ、UTF-8・カンマ区切り。
列（この順・この名前）: term,meaning,example,explanation,partOfSpeech,tags,importance
- term: 語（必須）
- meaning: 意味
- example: 例文
- explanation: 補足解説
- partOfSpeech: 品詞
- tags: 関連タグ（複数は ; 区切り）
- importance: 重要度（1〜5の整数）
値にカンマ・改行・引用符を含む場合は " で囲み、内部の " は "" にエスケープしてください。`;
  return { ok: true, prompt };
}
