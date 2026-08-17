// UI共通の小物。動的値をDOMに入れる際は必ず escapeHtml を通す（XSS防止）。
export function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

export function pct(x) {
  return `${Math.round(x * 100)}%`;
}

// テキストをファイルとしてダウンロード。CSVはExcel互換のためBOM付きUTF-8で保存。
export function downloadText(filename, text, mime = "text/csv") {
  const blob = new Blob(["\uFEFF" + text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
