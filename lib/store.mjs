// Слой данных на Netlify Blobs (встроенное KV-хранилище).
// Каждая заметка - отдельный блоб (ключ = id), ревизии - блоб-массив на заметку.
import { getStore } from "@netlify/blobs";

const notesStore = () => getStore({ name: "notes", consistency: "strong" });
const revsStore = () => getStore({ name: "revisions", consistency: "strong" });
const gamesStore = () => getStore({ name: "games", consistency: "strong" });

const REV_CAP = 300; // сколько последних правок храним на заметку

export async function getNote(id) {
  return (await notesStore().get(id, { type: "json" })) || null;
}

export async function putNote(note) {
  await notesStore().setJSON(note.id, note);
}

export async function deleteNote(id) {
  await Promise.all([notesStore().delete(id), revsStore().delete(id)]);
}

export async function listNotes() {
  const store = notesStore();
  const { blobs } = await store.list();
  const notes = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return notes
    .filter(Boolean)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated_at - a.updated_at);
}

export async function getRevisions(id) {
  return (await revsStore().get(id, { type: "json" })) || [];
}

export async function setRevisions(id, arr) {
  await revsStore().setJSON(id, arr);
}

export async function appendRevision(id, rev) {
  const arr = await getRevisions(id);
  arr.push(rev);
  if (arr.length > REV_CAP) arr.splice(0, arr.length - REV_CAP);
  await setRevisions(id, arr);
  return arr;
}

// ---------- игры ----------

export async function getGame(id) {
  return (await gamesStore().get(id, { type: "json" })) || null;
}

export async function putGame(game) {
  await gamesStore().setJSON(game.id, game);
}

export async function deleteGame(id) {
  await gamesStore().delete(id);
}

export async function listGames() {
  const store = gamesStore();
  const { blobs } = await store.list();
  const games = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return games.filter(Boolean).sort((a, b) => b.updated_at - a.updated_at);
}
