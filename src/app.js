import { login, logout, watchAuth } from "./auth.js";

const root = document.getElementById("root");

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
        <p role="alert" class="error" id="err"></p>
      </div>
    </main>`;
  const err = root.querySelector("#err");
  root.querySelector("#login").addEventListener("click", async () => {
    err.textContent = "";
    try {
      await login();
    } catch {
      // 失敗は原因より次の行動を伝える（キャンセル/ポップアップブロック等）。
      err.textContent =
        "サインインできませんでした。ポップアップを許可して再試行してください。";
    }
  });
}

function renderShell(user) {
  root.innerHTML = `
    <div class="app">
      <header class="topbar">
        <span class="brand">単語帳</span>
        <span class="spacer"></span>
        <span class="who" id="who"></span>
        <button class="btn-ghost" id="logout">サインアウト</button>
      </header>
      <main class="content">
        <p class="placeholder">準備完了。次のスライスで「取り込み → 出題 → 成績」を通します。</p>
      </main>
    </div>`;
  // 動的値は textContent で注入（innerHTML経由の混入を避ける）。
  root.querySelector("#who").textContent = user.email ?? "";
  root.querySelector("#logout").addEventListener("click", () => logout());
}

renderLoading();
// Slice 0 到達点: サインインすると空のシェルが出る。以降のスライスでシェル内に画面を足す。
watchAuth((user) => (user ? renderShell(user) : renderLogin()));
