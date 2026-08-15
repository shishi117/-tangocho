import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { login, logout, watchAuth } from "./data/auth";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchAuth((u) => {
    setUser(u);
    setReady(true);
  }), []);

  async function handleLogin() {
    setError(null);
    try {
      await login();
    } catch {
      // 失敗は原因より次の行動を伝える（キャンセル/ポップアップブロック等）。
      setError("サインインできませんでした。ポップアップを許可して再試行してください。");
    }
  }

  if (!ready) {
    return <main className="center" aria-busy="true">読み込み中…</main>;
  }

  if (!user) {
    return (
      <main className="center">
        <div className="auth-card">
          <span className="mark" aria-hidden="true"><i /><i /><i /></span>
          <h1>単語帳</h1>
          <p className="sub">資格試験の学習を、複数端末で続ける。</p>
          <button className="btn-primary" onClick={handleLogin}>
            Google でサインイン
          </button>
          {error && <p role="alert" className="error">{error}</p>}
        </div>
      </main>
    );
  }

  // Slice 0 到達点: ログインすると空のシェルが出る。以降のスライスでここに画面を足す。
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">単語帳</span>
        <span className="spacer" />
        <span className="who">{user.email}</span>
        <button className="btn-ghost" onClick={() => logout()}>
          サインアウト
        </button>
      </header>
      <main className="content">
        <p className="placeholder">
          準備完了。次のスライスで「取り込み → 出題 → 成績」を通します。
        </p>
      </main>
    </div>
  );
}
