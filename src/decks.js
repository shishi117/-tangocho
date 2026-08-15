import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { db, auth } from "./firebase.js";

export async function listDecks() {
  const uid = auth.currentUser.uid;
  const snap = await getDocs(
    query(collection(db, "decks"), where("owner", "==", uid)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// 同名単語帳があれば再利用、無ければ作成。テーマは Slice 3 で扱う（当面 空文字）。
export async function findOrCreateDeck(name) {
  const trimmed = name.trim();
  const existing = (await listDecks()).find((d) => d.name === trimmed);
  if (existing) return existing.id;
  const ref = await addDoc(collection(db, "decks"), {
    name: trimmed,
    theme: "",
    owner: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
