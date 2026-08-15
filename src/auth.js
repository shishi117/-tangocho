import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { auth } from "./firebase.js";

const provider = new GoogleAuthProvider();

// Safari/iOS では signInWithRedirect がサードパーティストレージ制限で失敗するため popup を使う。
export function login() {
  return signInWithPopup(auth, provider);
}

export function logout() {
  return signOut(auth);
}

// ログイン状態の変化を購読。unsubscribe を返す。
export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}
