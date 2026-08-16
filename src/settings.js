import {
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { db, auth } from "./firebase.js";
import { updateStreak } from "./domain/stats.js";

// 設定は settings/{uid} に集約（連続日数・BG-2閾値）。
// 未作成の可能性があるため getDoc ではなく list（where owner==uid）で読む。
// これなら存在しなくても空集合が返り、既存ルール（付録A）で許可される。
export async function getSettings() {
  const uid = auth.currentUser.uid;
  const snap = await getDocs(
    query(collection(db, "settings"), where("owner", "==", uid)),
  );
  return snap.empty ? null : snap.docs[0].data();
}

// FR014 セッション完了時に連続学習日数を更新。日付はローカル日付文字列で受け取る。
export async function recordSessionDay(today, yesterday) {
  const uid = auth.currentUser.uid;
  const cur = await getSettings();
  const next = updateStreak(cur, today, yesterday);
  if (cur && next === cur) return next; // 同日は書き込み省略
  await setDoc(
    doc(db, "settings", uid),
    {
      owner: uid,
      lastStudyDate: next.lastStudyDate,
      streak: next.streak,
      threshold: cur?.threshold ?? 0.8, // BG-2 閾値の設定UIは Slice 3。未設定は既定80%/5回。
      minAnswers: cur?.minAnswers ?? 5,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return next;
}
