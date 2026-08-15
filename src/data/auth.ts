import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

const provider = new GoogleAuthProvider();

// Safari/iOS では signInWithRedirect がサードパーティストレージ制限で失敗するため
// signInWithPopup を用いる（PWA前提の要件）。
export function login(): Promise<unknown> {
  return signInWithPopup(auth, provider);
}

export function logout(): Promise<void> {
  return signOut(auth);
}

// ログイン状態の変化を購読。unsubscribe を返す。
export function watchAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}
