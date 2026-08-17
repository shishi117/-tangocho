import { findOrCreateDeck } from "./decks.js";
import { importCards } from "./cards.js";
import { normalizeCsv, validateFields, CSV_FIELDS } from "./domain/csv.js";
import { buildPrompt } from "./domain/prompt.js";
import { escapeHtml } from "./ui-util.js";
import { isDegraded, noteError } from "./quota.js";

// プレビュー用の一時状態。
let pending = null; // { deckName, theme, dedup, cards, errorRows }

export function renderImport(host) {
  host.innerHTML = `
    <h2>取り込み</h2>

    <section class="panel">
      <h3 class="sub-h">D方式: 生成プロンプトを作る</h3>
      <div class="row">
        <label class="fld inline">テーマ名<input id="pTheme" type="text" maxlength="100" placeholder="例: 動物" /></label>
        <label class="fld inline">資格名<input id="pQual" type="text" maxlength="100" placeholder="例: 英検準1級" /></label>
        <button class="btn-ghost btn-inline" id="pGen">プロンプト生成</button>
      </div>
      <div id="pOut"></div>
    </section>

    <section class="panel">
      <h3 class="sub-h">CSVを取り込む</h3>
      <label class="fld">単語帳名
        <input id="deckName" type="text" placeholder="例: 英検準1級" />
      </label>
      <label class="fld inline">テーマ（任意）
        <input id="deckTheme" type="text" maxlength="100" placeholder="未入力可" />
      </label>
      <label class="fld inline">重複時
        <select id="dedup">
          <option value="skip">スキップ</option>
          <option value="overwrite">上書き</option>
          <option value="both">両方登録</option>
        </select>
      </label>
      <label class="fld">CSV（先頭行に列名: ${CSV_FIELDS.join(",")}）
        <textarea id="csv" rows="8" placeholder="term,meaning&#10;りんご,apple"></textarea>
      </label>
      <div class="row">
        <input id="file" type="file" accept=".csv,text/csv" />
        <button class="btn-primary btn-inline" id="toPreview">プレビュー</button>
      </div>
      <p class="result" id="result" role="status"></p>
    </section>`;

  // --- D方式プロンプト ---
  host.querySelector("#pGen").addEventListener("click", () => {
    const out = host.querySelector("#pOut");
    const r = buildPrompt(
      host.querySelector("#pTheme").value,
      host.querySelector("#pQual").value,
    );
    if (!r.ok) {
      out.innerHTML = `<p class="result">テーマ名と資格名を入力してください。</p>`;
      return;
    }
    out.innerHTML = `
      <textarea class="prompt-box" id="promptBox" rows="10" readonly></textarea>
      <button class="btn-ghost btn-inline" id="copy">コピー</button>`;
    out.querySelector("#promptBox").value = r.prompt; // valueで入れる（HTMLとして解釈させない）
    out.querySelector("#copy").addEventListener("click", async () => {
      const box = out.querySelector("#promptBox");
      box.select();
      try {
        await navigator.clipboard.writeText(box.value);
      } catch {
        document.execCommand("copy"); // クリップボードAPI不可環境のフォールバック
      }
    });
  });

  // --- CSV → プレビュー ---
  const csv = host.querySelector("#csv");
  host.querySelector("#file").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (f) csv.value = await f.text();
  });
  host.querySelector("#toPreview").addEventListener("click", () => {
    const result = host.querySelector("#result");
    const deckName = host.querySelector("#deckName").value.trim();
    if (!deckName) {
      result.textContent = "単語帳名を入力してください。";
      return;
    }
    const norm = normalizeCsv(csv.value);
    if (!norm.ok) {
      result.textContent =
        norm.reason === "no_term_column"
          ? "エラー: term 列がありません。先頭行に列名を入れてください。"
          : "エラー: CSVが空です。";
      return;
    }
    pending = {
      deckName,
      theme: host.querySelector("#deckTheme").value.trim(),
      dedup: host.querySelector("#dedup").value,
      cards: norm.cards,
      errorRows: norm.errorRows,
    };
    renderPreview(host);
  });
}

// FR006 取り込み前プレビュー・編集。行単位の編集・除外を可能にする。
function renderPreview(host) {
  const p = pending;
  const head = CSV_FIELDS.map((f) => `<th>${f}</th>`).join("");
  const rows = p.cards
    .map((c, i) => {
      const cell = (f, val, wide) =>
        `<td><input data-f="${f}" data-i="${i}" value="${escapeHtml(val)}"${wide ? ' class="wide"' : ""} /></td>`;
      return `<tr data-row="${i}">
        ${cell("term", c.term)}
        ${cell("meaning", c.meaning, true)}
        ${cell("example", c.example, true)}
        ${cell("explanation", c.explanation, true)}
        ${cell("partOfSpeech", c.partOfSpeech)}
        ${cell("tags", (c.tags || []).join(";"))}
        <td><input data-f="importance" data-i="${i}" value="${escapeHtml(c.importance)}" class="narrow" /></td>
        <td><input type="checkbox" class="ex" data-i="${i}" aria-label="除外" /></td>
      </tr>`;
    })
    .join("");

  host.innerHTML = `
    <h2>プレビュー（確定前）</h2>
    <p class="muted-line">追加先: <strong>${escapeHtml(p.deckName)}</strong>${
      p.theme ? ` / テーマ: ${escapeHtml(p.theme)}` : ""
    } ・ 重複時: ${{ skip: "スキップ", overwrite: "上書き", both: "両方登録" }[p.dedup]}</p>
    ${
      p.errorRows.length
        ? `<p class="result">取り込み時に除外された行: ${p.errorRows.join(", ")}（256文字超過 / term空）</p>`
        : ""
    }
    <div class="preview-wrap">
      <table class="preview">
        <thead><tr>${head}<th>除外</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="row">
      <button class="btn-primary btn-inline" id="commit">確定登録</button>
      <button class="btn-ghost" id="back">戻る</button>
    </div>
    <p class="result" id="pmsg" role="status"></p>`;

  host.querySelector("#back").addEventListener("click", () => renderImport(host));
  host.querySelector("#commit").addEventListener("click", () => commitPreview(host));
}

async function commitPreview(host) {
  const p = pending;
  const msg = host.querySelector("#pmsg");
  // FR017: 無料枠超過中は取り込み（生成系の追加書き込み）を停止。学習・成績記録は継続可。
  if (isDegraded()) {
    msg.textContent =
      "無料枠超過中のため取り込みは停止しています。学習と成績記録は継続できます。枠が回復してから再試行してください。";
    return;
  }
  const trs = [...host.querySelectorAll("tr[data-row]")];
  const valid = [];
  let excluded = 0;
  for (const tr of trs) {
    if (tr.querySelector(".ex").checked) {
      excluded++;
      continue;
    }
    const g = (f) => tr.querySelector(`[data-f="${f}"]`).value;
    const raw = {};
    for (const f of CSV_FIELDS) raw[f] = g(f);
    const res = validateFields(raw); // 確定時にもう一度検証（term欠落・256超過は除外）
    if (!res.ok) {
      excluded++;
      continue;
    }
    valid.push(res.card);
  }

  msg.textContent = "登録中…";
  try {
    const deckId = await findOrCreateDeck(p.deckName, p.theme);
    const { success, skipped } = await importCards(deckId, valid, p.dedup);
    pending = null;
    host.innerHTML = `
      <h2>取り込み完了</h2>
      <p class="summary">登録 ${success} / スキップ ${skipped} / 除外 ${excluded}</p>
      <button class="btn-primary btn-inline" id="again">取り込みに戻る</button>`;
    host.querySelector("#again").addEventListener("click", () => renderImport(host));
  } catch (e) {
    noteError(e);
    msg.textContent =
      e && e.code === "resource-exhausted"
        ? "無料枠超過のため取り込めませんでした。学習・成績記録は継続できます。"
        : "登録に失敗しました。通信状態を確認して再試行してください。";
  }
}
