import { login, logout, watchAuth } from "./auth.js";
import { listDecks } from "./decks.js";
import { listCards, listAllCards, recordAnswer } from "./cards.js";
import { getSettings, recordSessionDay } from "./settings.js";
import { pickCard } from "./domain/leitner.js";
import {
  allTimeAccuracy,
  masteryRate,
  recentAccuracy,
} from "./domain/stats.js";
import { escapeHtml, pct } from "./ui-util.js";
import { renderImport } from "./ui-import.js";
import { renderManage } from "./ui-manage.js";
import { onQuotaChange, getStatus } from "./quota.js";

const root = document.getElementById("root");

let view = "import";
let session = null;
let sessionInterrupted = false; // トークン失効等で中断したか（再ログイン画面で案内）

// FR017/FR009 状態バナー。シェル内 #banner を更新（無い画面では何もしない）。
function updateBanner(st = getStatus()) {
  const el = document.getElementById("banner");
  if (!el) return;
  let msg = "";
  if (st.degraded) {
    msg =
      "⚠ 無料枠超過中: 学習と成績記録は継続します（オンライン復帰後に自動同期）。取り込み・生成は一時停止しています。";
  } else if (st.manyPending) {
    msg = `⚠ 未同期の成績が${st.pending}件あります。オンラインで同期してください（データは保持されています）。`;
  }
  el.textContent = msg;
  el.hidden = msg === "";
}
onQuotaChange(updateBanner);

// ローカル日付（YYYY-MM-DD）。連続日数はユーザーのローカル時刻基準（端末クロック依存）。
function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

// --- 認証ゲート ---------------------------------------------------------
function renderLoading() {
  root.innerHTML = `<main class="center" aria-busy="true">読み込み中…</main>`;
}

function renderLogin() {
  root.innerHTML = `
    <main class="center">
      <div class="auth-card">
        <span class="mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <h1>単語帳</h1>
        <p class="sub">資格試験の学習を、複数端末で続ける。</p>
        <button class="btn-primary" id="login">Google でサインイン</button>
        ${
          sessionInterrupted
            ? `<p class="note" role="status">セッションが中断されました。回答済みの成績は保存されており、再サインイン後に同期されます。</p>`
            : ""
        }
        <p role="alert" class="error" id="err"></p>
      </div>
    </main>`;
  const err = root.querySelector("#err");
  root.querySelector("#login").addEventListener("click", async () => {
    err.textContent = "";
    try {
      await login();
    } catch {
      err.textContent =
        "サインインできませんでした。ポップアップを許可して再試行してください。";
    }
  });
}

// --- シェル -------------------------------------------------------------
function renderShell(user) {
  root.innerHTML = `
    <div class="app">
      <header class="topbar">
        <span class="brand">単語帳</span>
        <nav class="nav">
          <button class="tab" data-view="import">取り込み</button>
          <button class="tab" data-view="study">学習</button>
          <button class="tab" data-view="progress">進捗</button>
          <button class="tab" data-view="manage">管理</button>
        </nav>
        <span class="spacer"></span>
        <span class="who"></span>
        <button class="btn-ghost" id="logout">サインアウト</button>
      </header>
      <main class="content">
        <div id="banner" class="banner" role="alert" aria-live="assertive" hidden></div>
        <div id="view"></div>
      </main>
    </div>`;
  root.querySelector(".who").textContent = user.email ?? "";
  root.querySelector("#logout").addEventListener("click", () => logout());
  root.querySelectorAll(".tab").forEach((b) =>
    b.addEventListener("click", () => {
      if (session) return; // セッション中はタブ移動で誤操作させない（中断ボタンで抜ける）
      view = b.dataset.view;
      renderView();
    }),
  );
  renderView();
  updateBanner();
}

function renderView() {
  root
    .querySelectorAll(".tab")
    .forEach((b) => {
      const active = b.dataset.view === view;
      b.classList.toggle("active", active);
      if (active) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
  const host = root.querySelector("#view");
  if (view === "import") renderImport(host);
  else if (view === "study") renderStudy(host);
  else if (view === "progress") renderProgress(host);
  else renderManage(host);
}

// --- 学習 (FR008/010/011) ----------------------------------------------
async function renderStudy(host) {
  if (session) {
    renderCard(host);
    return;
  }
  host.innerHTML = `<h2>学習</h2><p class="muted-line">単語帳を読み込み中…</p>`;
  let decks;
  try {
    decks = await listDecks();
  } catch {
    host.innerHTML = `<h2>学習</h2><p class="result">単語帳の読み込みに失敗しました。</p>`;
    return;
  }
  if (decks.length === 0) {
    host.innerHTML = `<h2>学習</h2><p class="muted-line">まず「取り込み」でカードを登録してください。</p>`;
    return;
  }
  host.innerHTML = `
    <h2>学習</h2>
    <label class="fld">単語帳
      <select id="deck">${decks
        .map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`)
        .join("")}</select>
    </label>
    <label class="fld">セッション
      <select id="size">
        <option value="20">20枚</option>
        <option value="all">単語帳一巡</option>
      </select>
    </label>
    <button class="btn-primary btn-inline" id="start">開始</button>
    <p class="result" id="msg" role="status"></p>`;
  host.querySelector("#start").addEventListener("click", () => startSession(host));
}

async function startSession(host) {
  const deckId = host.querySelector("#deck").value;
  const size = host.querySelector("#size").value;
  const msg = host.querySelector("#msg");
  msg.textContent = "読み込み中…";
  let cards;
  try {
    cards = await listCards(deckId);
  } catch {
    msg.textContent = "カードの読み込みに失敗しました。";
    return;
  }
  if (cards.length === 0) {
    msg.textContent = "有効なカードがありません。"; // FR008 例外
    return;
  }
  const total = size === "all" ? cards.length : Math.min(20, cards.length);
  session = { pool: cards, total, answered: 0, correct: 0, current: null, revealed: false };
  renderCard(host);
}

function backHtml(c) {
  const parts = [];
  if (c.meaning) parts.push(`<div class="b-main">${escapeHtml(c.meaning)}</div>`);
  if (c.example) parts.push(`<div class="b-sub">例: ${escapeHtml(c.example)}</div>`);
  if (c.explanation) parts.push(`<div class="b-sub">${escapeHtml(c.explanation)}</div>`);
  if (c.partOfSpeech) parts.push(`<div class="b-pos">${escapeHtml(c.partOfSpeech)}</div>`);
  return parts.join("") || `<div class="b-main muted-line">（裏面なし）</div>`;
}

function renderCard(host) {
  const s = session;
  if (s.answered >= s.total || s.pool.length === 0) {
    renderSummary(host);
    return;
  }
  if (!s.current) {
    s.current = pickCard(s.pool); // FR010 箱の重み付き抽選
    s.revealed = false;
  }
  const c = s.current;
  host.innerHTML = `
    <div class="study">
      <div class="progress">${s.answered + 1} / ${s.total}</div>
      <div class="card">
        <div class="face front">${escapeHtml(c.term)}</div>
        ${
          s.revealed
            ? `<div class="face back">${backHtml(c)}</div>`
            : `<button class="reveal" id="reveal">裏面を見る</button>`
        }
      </div>
      ${
        s.revealed
          ? `<div class="grade">
               <button class="btn-wrong" id="wrong">不正解</button>
               <button class="btn-right" id="right">正解</button>
             </div>`
          : ""
      }
      <button class="btn-ghost quit" id="quit">中断する</button>
    </div>`;

  if (!s.revealed) {
    host.querySelector("#reveal").addEventListener("click", () => {
      s.revealed = true;
      renderCard(host);
    });
  } else {
    host.querySelector("#right").addEventListener("click", () => grade(host, true));
    host.querySelector("#wrong").addEventListener("click", () => grade(host, false));
  }
  // 中断= FR012の切替に相当。各回答は都度保存済みなので、抜けるだけで成績は確定している。
  host.querySelector("#quit").addEventListener("click", () => {
    session = null;
    renderView();
  });
}

function grade(host, correct) {
  const s = session;
  const c = s.current;
  // FR009: オフライン時はSDKがローカル保持→自動再送するため、UIはサーバ確定を待たない。
  recordAnswer(c, correct).catch(() => {});
  s.answered++;
  if (correct) s.correct++;
  s.pool = s.pool.filter((x) => x.id !== c.id); // 同一セッション内での再出題を避ける
  s.current = null;
  renderCard(host);
}

function renderSummary(host) {
  const s = session;
  // FR014: セッション完了を1日分としてカウント。UIは待たない（オフライン時はSDKが再送）。
  recordSessionDay(localDateStr(), yesterdayStr()).catch(() => {});
  const rate = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
  host.innerHTML = `
    <div class="study">
      <h2>セッション終了</h2>
      <p class="summary">${s.answered} 枚 / 正答率 ${rate}%（${s.correct} / ${s.answered}）</p>
      <button class="btn-primary btn-inline" id="again">学習に戻る</button>
    </div>`;
  host.querySelector("#again").addEventListener("click", () => {
    session = null;
    renderView();
  });
}

// --- 進捗 (FR013/014) ---------------------------------------------------
function statCells(cards, threshold, minAnswers) {
  const r = recentAccuracy(cards, 20);
  return {
    count: cards.length,
    mastery: pct(masteryRate(cards, threshold, minAnswers)),
    all: pct(allTimeAccuracy(cards)),
    recent: r.count ? `${pct(r.rate)}（${r.count}回）` : "—",
  };
}

async function renderProgress(host) {
  host.innerHTML = `<h2>進捗</h2><p class="muted-line">集計中…</p>`;
  let cards, decks, settings;
  try {
    [cards, decks, settings] = await Promise.all([
      listAllCards(),
      listDecks(),
      getSettings(),
    ]);
  } catch {
    host.innerHTML = `<h2>進捗</h2><p class="result">集計の読み込みに失敗しました。</p>`;
    return;
  }
  const threshold = settings?.threshold ?? 0.8;
  const minAnswers = settings?.minAnswers ?? 5;
  const streak = settings?.streak ?? 0;

  if (cards.length === 0) {
    host.innerHTML = `<h2>進捗</h2><p class="muted-line">まだカードがありません。「取り込み」から始めてください。</p>`;
    return;
  }

  const overall = statCells(cards, threshold, minAnswers);
  const deckName = new Map(decks.map((d) => [d.id, d.name]));
  const deckTheme = new Map(decks.map((d) => [d.id, d.theme || ""]));

  // 帳別・テーマ別に有効カードをまとめる。
  const pushTo = (map, key, val) => {
    const arr = map.get(key);
    if (arr) arr.push(val);
    else map.set(key, [val]);
  };
  const byDeck = new Map();
  const byTheme = new Map();
  for (const c of cards) {
    pushTo(byDeck, c.deckId, c);
    pushTo(byTheme, deckTheme.get(c.deckId) || "", c);
  }

  const deckRows = [...byDeck.entries()]
    .map(([id, cs]) => {
      const s = statCells(cs, threshold, minAnswers);
      return `<tr><th scope="row">${escapeHtml(deckName.get(id) ?? "（不明）")}</th>
        <td>${s.count}</td><td>${s.mastery}</td><td>${s.all}</td><td>${s.recent}</td></tr>`;
    })
    .join("");

  const themeRows = [...byTheme.entries()]
    .map(([th, cs]) => {
      const s = statCells(cs, threshold, minAnswers);
      const label = th || "（テーマ未設定）";
      return `<tr><th scope="row">${escapeHtml(label)}</th>
        <td>${s.count}</td><td>${s.mastery}</td></tr>`;
    })
    .join("");

  host.innerHTML = `
    <h2>進捗</h2>
    <div class="kpis">
      <div class="kpi"><div class="kpi-num">${overall.mastery}</div><div class="kpi-lbl">習得率</div></div>
      <div class="kpi"><div class="kpi-num">${streak}日</div><div class="kpi-lbl">連続学習</div></div>
      <div class="kpi"><div class="kpi-num">${overall.all}</div><div class="kpi-lbl">全期間 正答率</div></div>
      <div class="kpi"><div class="kpi-num">${overall.recent}</div><div class="kpi-lbl">直近20回 正答率</div></div>
    </div>
    <p class="muted-line small">習得の基準: 正答率 ${pct(threshold)} 以上 かつ 累計 ${minAnswers} 回以上</p>

    <h3 class="sub-h">単語帳別</h3>
    <table class="stat">
      <thead><tr><th>単語帳</th><th>枚数</th><th>習得率</th><th>全期間</th><th>直近20</th></tr></thead>
      <tbody>${deckRows}</tbody>
    </table>

    <h3 class="sub-h">テーマ別</h3>
    <table class="stat">
      <thead><tr><th>テーマ</th><th>枚数</th><th>習得率</th></tr></thead>
      <tbody>${themeRows}</tbody>
    </table>`;
}

// --- 起動 ---------------------------------------------------------------
renderLoading();
watchAuth((user) => {
  if (user) {
    sessionInterrupted = false;
    renderShell(user);
  } else {
    // トークン失効/サインアウト。回答は都度保存済み（SDKがローカル保持→再認証後に同期）。
    if (session) sessionInterrupted = true;
    session = null;
    renderLogin();
  }
});
