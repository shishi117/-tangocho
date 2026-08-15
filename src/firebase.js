// CDN（gstatic）のブラウザ向けESMを直接import。ビルド・install不要。
// バージョンを上げるときはこの3行のURLの版数だけ差し替える。
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
// import { firebaseConfig } from "../config.js";

// const app = initializeApp(firebaseConfig);

// オフライン永続化: 書き込みは自動でキューされ、オンライン復帰時に自動再送される（FR009の骨格）。
// 読み取りはキャッシュ優先になり、統計の全カードスキャンでも読み取り枠をほぼ消費しない。
// export const db = initializeFirestore(app, {
//   localCache: persistentLocalCache({
//     tabManager: persistentMultipleTabManager(),
//   }),
// });

// export const auth = getAuth(app);
