// FR015 単語帳内の検索(term・tags)・並び替え(box・accuracy・importance)。純粋関数。
const SORTABLE = new Set(["box", "accuracy", "importance"]);

export function searchCards(cards, { query = "", sortBy = "", order = "desc" } = {}) {
  const q = query.trim().toLowerCase();
  let out = cards;
  if (q) {
    out = out.filter(
      (c) =>
        c.term.toLowerCase().includes(q) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }
  if (SORTABLE.has(sortBy)) {
    const dir = order === "asc" ? 1 : -1;
    // 元配列を壊さないためコピーしてソート。
    out = [...out].sort((a, b) => ((a[sortBy] ?? 0) - (b[sortBy] ?? 0)) * dir);
  }
  return out;
}
