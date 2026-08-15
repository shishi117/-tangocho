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

// FR005 取り込み。重複時動作は当面「スキップ」（deck×termで既存を除外）。上書き/両方は Slice 3。
export async function importCards(deckId, normalizedCards) {
  const seen = new Set((await listCards(deckId)).map((c) => c.term));
  const uid = auth.currentUser.uid;
  const toWrite = [];
  let skipped = 0;
  for (const c of normalizedCards) {
    if (seen.has(c.term)) {
      skipped++;
      continue;
    }
    seen.add(c.term);
    toWrite.push(c);
  }

  // writeBatch は1バッチ500件上限。400件ずつに分割（1,000行取込にも耐える）。
  const CHUNK = 400;
  for (let i = 0; i < toWrite.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const c of toWrite.slice(i, i + CHUNK)) {
      batch.set(doc(collection(db, "cards")), {
        deckId,
        front: "",
        back: "",
        term: c.term,
        meaning: c.meaning,
        example: c.example,
        explanation: c.explanation,
        partOfSpeech: c.partOfSpeech,
        tags: c.tags,
        importance: c.importance,
        answerCount: 0,
        correctCount: 0,
        accuracy: 0,
        box: 1,
        isDeleted: false,
        owner: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return { success: toWrite.length, skipped };
}

// FR009 成績更新。SDKのオフライン永続化が再送を肩代わりするため、ここは書き込みを1回投げるだけ。
export function recordAnswer(card, correct) {
  const answerCount = card.answerCount + 1;
  const correctCount = card.correctCount + (correct ? 1 : 0);
  return updateDoc(doc(db, "cards", card.id), {
    answerCount,
    correctCount,
    accuracy: accuracy(correctCount, answerCount),
    box: updateBox(card.box, correct),
    updatedAt: serverTimestamp(),
  });
}
