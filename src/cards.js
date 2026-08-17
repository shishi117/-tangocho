import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { db, auth } from "./firebase.js";
import { accuracy } from "./domain/card.js";
import { updateBox } from "./domain/leitner.js";
import { trackWrite, noteError } from "./quota.js";

export async function listCards(deckId) {
  const snap = await getDocs(
    query(
      collection(db, "cards"),
      where("owner", "==", auth.currentUser.uid),
      where("deckId", "==", deckId),
    ),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => !c.isDeleted);
}

// FR005 取り込み。dedup: "skip"（既定）／"overwrite"（内容更新・成績は保持）／"both"（重複でも新規追加）。
export async function importCards(deckId, normalizedCards, dedup = "skip") {
  const existing = await listCards(deckId);
  const byTerm = new Map(existing.map((c) => [c.term, c]));
  const uid = auth.currentUser.uid;

  const creates = [];
  const overwrites = []; // {id, card}
  let skipped = 0;

  for (const c of normalizedCards) {
    const hit = byTerm.get(c.term);
    if (hit && dedup === "skip") {
      skipped++;
      continue;
    }
    if (hit && dedup === "overwrite") {
      overwrites.push({ id: hit.id, card: c });
      continue;
    }
    creates.push(c); // "both" もしくは 重複なし
  }

  // writeBatch は1バッチ500件上限。400件ずつに分割。
  const CHUNK = 400;
  const ops = [
    ...creates.map((c) => ({ type: "create", c })),
    ...overwrites.map((o) => ({ type: "update", ...o })),
  ];
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + CHUNK)) {
      if (op.type === "create") {
        batch.set(doc(collection(db, "cards")), {
          deckId,
          front: "",
          back: "",
          ...op.c,
          answerCount: 0,
          correctCount: 0,
          accuracy: 0,
          box: 1,
          recent: [], // FR013 直近20回用の履歴 [{c:0|1,t:ms}]
          isDeleted: false,
          owner: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // 上書き: 内容のみ差し替え、学習成績(answerCount等)は保持する。
        batch.update(doc(db, "cards", op.id), {
          ...op.card,
          updatedAt: serverTimestamp(),
        });
      }
    }
    try {
      await batch.commit();
    } catch (e) {
      noteError(e); // FR017: 無料枠超過なら状態遷移させる
      throw e;
    }
  }
  return { success: creates.length + overwrites.length, skipped };
}

// FR007 個別カードの追加。cardは validateFields 済みのカード形。
export function addCard(deckId, card) {
  return addDoc(collection(db, "cards"), {
    deckId,
    front: "",
    back: "",
    ...card,
    answerCount: 0,
    correctCount: 0,
    accuracy: 0,
    box: 1,
    recent: [],
    isDeleted: false,
    owner: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// FR007 内容の修正（成績は保持）。
export function updateCard(cardId, card) {
  return updateDoc(doc(db, "cards", cardId), {
    ...card,
    updatedAt: serverTimestamp(),
  });
}

// FR007 論理削除（物理削除はMVP対象外）。
export function softDeleteCard(cardId) {
  return updateDoc(doc(db, "cards", cardId), {
    isDeleted: true,
    updatedAt: serverTimestamp(),
  });
}

// 全単語帳のカード（統計用）。1回のgetDocsで取得しキャッシュ優先で読む。
export async function listAllCards() {
  const snap = await getDocs(
    query(collection(db, "cards"), where("owner", "==", auth.currentUser.uid)),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => !c.isDeleted);
}

// FR009 成績更新。SDKのオフライン永続化が再送を肩代わりするため、ここは書き込みを1回投げるだけ。
export function recordAnswer(card, correct) {
  const answerCount = card.answerCount + 1;
  const correctCount = card.correctCount + (correct ? 1 : 0);
  // 直近履歴を末尾に追加し20件で打ち切る。tはクライアント時刻（単一利用者なので順序付けに十分）。
  const recent = [...(card.recent ?? []), { c: correct ? 1 : 0, t: Date.now() }].slice(-20);
  // trackWrite: 未同期件数の監視＋超過検知（FR009/FR017）。SDKが再送を肩代わりする。
  return trackWrite(
    updateDoc(doc(db, "cards", card.id), {
      answerCount,
      correctCount,
      accuracy: accuracy(correctCount, answerCount),
      box: updateBox(card.box, correct),
      recent,
      updatedAt: serverTimestamp(),
    }),
  );
}
