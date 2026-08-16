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

// 同一(テーマ,名前)の単語帳があれば再利用、無ければ作成（FR002: 同一テーマ内の名前重複は作らない）。
export async function findOrCreateDeck(name, theme = "") {
  const n = name.trim();
  const t = theme.trim();
  const existing = (await listDecks()).find(
    (d) => d.name === n && (d.theme || "") === t,
  );
  if (existing) return existing.id;
  const ref = await addDoc(collection(db, "decks"), {
    name: n,
    theme: t,
    owner: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// テーマ一覧（重複除去、空文字含む）。FR012のプルダウン用。
export async function listThemes() {
  const themes = new Set((await listDecks()).map((d) => d.theme || ""));
  return [...themes];
}
