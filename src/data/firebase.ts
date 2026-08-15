import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 設定は .env（VITE_ 接頭辞のみブラウザに露出）。APIキーはFirebaseの公開キーで秘匿対象ではない。
// 実データ保護は firestore.rules（付録A）が担う。
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// オフライン永続化: 書き込みは自動でキューされ、オンライン復帰時に自動再送される（FR009の骨格）。
// 読み取りはキャッシュ優先になり、統計の全カードスキャンでも読み取り枠をほぼ消費しない。
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);
