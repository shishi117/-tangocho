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
