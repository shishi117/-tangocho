import { listDecks, listThemes } from "./decks.js";
import { listCards, addCard, updateCard, softDeleteCard } from "./cards.js";
import { validateFields, CSV_FIELDS } from "./domain/csv.js";
import { searchCards } from "./domain/search.js";
import { escapeHtml } from "./ui-util.js";

const state = { theme: null, deckId: null, query: "", sortBy: "", order: "desc" };
let loaded = []; // 選択中単語帳のカード（キャッシュ）

export async function renderManage(host) {
  host.innerHTML = `<h2>管理</h2><p class="muted-line">読み込み中…</p>`;
  let decks, themes;
  try {
    [decks, themes] = await Promise.all([listDecks(), listThemes()]);
  } catch {
    host.innerHTML = `<h2>管理</h2><p class="result">読み込みに失敗しました。</p>`;
    return;
  }
  if (decks.length === 0) {
    host.innerHTML = `<h2>管理</h2><p class="muted-line">まず「取り込み」でカードを登録してください。</p>`;
    return;
  }

  if (state.theme === null || !themes.includes(state.theme)) state.theme = themes[0];
  const decksInTheme = decks.filter((d) => (d.theme || "") === state.theme);
  if (!decksInTheme.some((d) => d.id === state.deckId)) {
    state.deckId = decksInTheme[0]?.id ?? null;
  }

  const themeOpts = themes
    .map(
      (t) =>
        `<option value="${escapeHtml(t)}"${t === state.theme ? " selected" : ""}>${escapeHtml(t || "（テーマ未設定）")}</option>`,
    )
    .join("");
  const deckOpts = decksInTheme
    .map(
      (d) =>
        `<option value="${escapeHtml(d.id)}"${d.id === state.deckId ? " selected" : ""}>${escapeHtml(d.name)}</option>`,
    )
    .join("");

  host.innerHTML = `
    <h2>管理</h2>
    <div class="row">
      <label class="fld inline">テーマ<select id="mtheme">${themeOpts}</select></label>
      <label class="fld inline">単語帳<select id="mdeck">${deckOpts}</select></label>
    </div>
    <div id="mcards"></div>`;

  host.querySelector("#mtheme").addEventListener("change", (e) => {
    state.theme = e.target.value;
    state.deckId = null;
    renderManage(host);
  });
  host.querySelector("#mdeck").addEventListener("change", (e) => {
    state.deckId = e.target.value;
    renderCards(host);
  });
  renderCards(host);
}

async function renderCards(host) {
  const box = host.querySelector("#mcards");
  if (!state.deckId) {
    box.innerHTML = `<p class="muted-line">このテーマに単語帳がありません。</p>`;
    return;
  }
  box.innerHTML = `<p class="muted-line">読み込み中…</p>`;
  try {
    loaded = await listCards(state.deckId);
  } catch {
    box.innerHTML = `<p class="result">カードの読み込みに失敗しました。</p>`;
    return;
  }
  box.innerHTML = `
    <div class="row mtools">
      <input id="mq" type="text" placeholder="term・tagで検索" />
      <select id="msort">
        <option value="">並び替えなし</option>
        <option value="box">箱</option>
        <option value="accuracy">正答率</option>
        <option value="importance">重要度</option>
      </select>
      <select id="morder"><option value="desc">降順</option><option value="asc">昇順</option></select>
      <button class="btn-primary btn-inline" id="madd">＋新規カード</button>
    </div>
    <div id="mlistbox"></div>`;

  const q = box.querySelector("#mq");
  q.value = state.query;
  q.addEventListener("input", () => {
    state.query = q.value; // 入力欄は据え置き、リストのみ再描画（フォーカス維持）
    renderList(host);
  });
  const sort = box.querySelector("#msort");
  const order = box.querySelector("#morder");
  sort.value = state.sortBy;
  order.value = state.order;
  sort.addEventListener("change", () => {
    state.sortBy = sort.value;
    renderList(host);
  });
  order.addEventListener("change", () => {
    state.order = order.value;
    renderList(host);
  });
  box.querySelector("#madd").addEventListener("click", () => openEditor(host, null));
  renderList(host);
}

function rowHtml(c) {
  const acc = c.answerCount ? `${Math.round(c.accuracy * 100)}%` : "未計測";
  const tags = (c.tags || [])
    .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
    .join("");
  return `<div class="mrow">
    <div class="mrow-main">
      <div class="mterm">${escapeHtml(c.term)}</div>
      <div class="mmean">${escapeHtml(c.meaning || "")}</div>
      ${tags ? `<div class="mtags">${tags}</div>` : ""}
    </div>
    <div class="mrow-stat">箱${c.box} ・ ${acc} ・ 重${c.importance}</div>
    <div class="mrow-act">
      <button class="btn-ghost" data-edit="${escapeHtml(c.id)}">編集</button>
      <button class="btn-ghost danger" data-del="${escapeHtml(c.id)}">削除</button>
    </div>
  </div>`;
}

function renderList(host) {
  const listbox = host.querySelector("#mlistbox");
  const shown = searchCards(loaded, {
    query: state.query,
    sortBy: state.sortBy,
    order: state.order,
  });
  listbox.innerHTML = `
    <p class="muted-line small">${shown.length}件${
      loaded.length !== shown.length ? ` / 全${loaded.length}件` : ""
    }</p>
    ${
      shown.length === 0
        ? `<p class="muted-line">該当なし</p>`
        : `<div class="mlist">${shown.map(rowHtml).join("")}</div>`
    }`;
  listbox
    .querySelectorAll("[data-edit]")
    .forEach((b) => b.addEventListener("click", () => openEditor(host, b.dataset.edit)));
  listbox
    .querySelectorAll("[data-del]")
    .forEach((b) => b.addEventListener("click", () => onDelete(host, b.dataset.del)));
}

async function onDelete(host, id) {
  const c = loaded.find((x) => x.id === id);
  // 論理削除だが学習対象から外れるため確認を挟む（データ損失系は怠けない）。
  if (!confirm(`「${c?.term ?? ""}」を削除しますか？（論理削除・学習対象から除外）`)) return;
  try {
    await softDeleteCard(id);
  } catch {
    alert("削除に失敗しました。通信状態を確認してください。");
    return;
  }
  loaded = loaded.filter((x) => x.id !== id);
  renderList(host);
}

function editorField(name, label, val, wide) {
  return `<label class="fld">${label}
    <input id="f_${name}" type="text" value="${escapeHtml(val || "")}"${wide ? "" : ""} /></label>`;
}

function openEditor(host, id) {
  const c = id
    ? loaded.find((x) => x.id === id)
    : { term: "", meaning: "", example: "", explanation: "", partOfSpeech: "", tags: [], importance: 3 };
  const box = host.querySelector("#mcards");
  box.innerHTML = `
    <h3 class="sub-h">${id ? "カード編集" : "新規カード"}</h3>
    <div class="editor">
      ${editorField("term", "語（term・必須）", c.term)}
      ${editorField("meaning", "意味", c.meaning)}
      ${editorField("example", "例文", c.example)}
      ${editorField("explanation", "解説", c.explanation)}
      ${editorField("partOfSpeech", "品詞", c.partOfSpeech)}
      ${editorField("tags", "タグ（; 区切り）", (c.tags || []).join(";"))}
      <label class="fld inline">重要度
        <select id="f_importance">${[1, 2, 3, 4, 5]
          .map((n) => `<option value="${n}"${n === c.importance ? " selected" : ""}>${n}</option>`)
          .join("")}</select>
      </label>
      <div class="row">
        <button class="btn-primary btn-inline" id="save">保存</button>
        <button class="btn-ghost" id="cancel">取消</button>
      </div>
      <p class="result" id="ederr"></p>
    </div>`;
  box.querySelector("#cancel").addEventListener("click", () => renderCards(host));
  box.querySelector("#save").addEventListener("click", () => onSave(host, id));
}

async function onSave(host, id) {
  const box = host.querySelector("#mcards");
  const g = (n) => box.querySelector(`#f_${n}`).value;
  const raw = {};
  for (const f of CSV_FIELDS) raw[f] = f === "importance" ? g("importance") : g(f);
  const res = validateFields(raw);
  const err = box.querySelector("#ederr");
  if (!res.ok) {
    err.textContent = "語（term）は必須です。各項目は256文字以内で入力してください。";
    return;
  }
  err.textContent = "保存中…";
  try {
    if (id) await updateCard(id, res.card);
    else await addCard(state.deckId, res.card);
  } catch {
    err.textContent = "保存に失敗しました。通信状態を確認してください。";
    return;
  }
  renderCards(host);
}
