// ============================================================
// DataDock — Firestore Storage (CRUD Operations)
// ============================================================

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Load all user data ----------
export async function loadUserData(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (userDoc.exists()) {
    const data = userDoc.data();
    return {
      contacts: data.contacts || [],
      teams: data.teams || [],
      links: data.links || [],
      todos: data.todos || [],
      apikeys: data.apikeys || [],
      notes: data.notes || []
    };
  }
  // Initialize workspace if missing
  const empty = { contacts: [], teams: [], links: [], todos: [], apikeys: [], notes: [] };
  await setDoc(doc(db, "users", uid), empty);
  return empty;
}

// ---------- Save entire collection ----------
export async function saveContacts(uid, contacts) {
  await updateDoc(doc(db, "users", uid), { contacts });
}

export async function saveTeams(uid, teams) {
  await updateDoc(doc(db, "users", uid), { teams });
}

export async function saveLinks(uid, links) {
  await updateDoc(doc(db, "users", uid), { links });
}

export async function saveTodos(uid, todos) {
  await updateDoc(doc(db, "users", uid), { todos });
}

export async function saveApikeys(uid, apikeys) {
  await updateDoc(doc(db, "users", uid), { apikeys });
}

export async function saveNotes(uid, notes) {
  await updateDoc(doc(db, "users", uid), { notes });
}

// ---------- Add single item ----------
export async function addContact(uid, contact, existingContacts) {
  const updated = [...existingContacts, contact];
  await saveContacts(uid, updated);
  return updated;
}

export async function addTeam(uid, team, existingTeams) {
  const updated = [...existingTeams, team];
  await saveTeams(uid, updated);
  return updated;
}

export async function addLink(uid, link, existingLinks) {
  const updated = [...existingLinks, link];
  await saveLinks(uid, updated);
  return updated;
}

// --- Todos ---
export async function addTodo(uid, todo, existing) {
  const updated = [...existing, todo];
  await saveTodos(uid, updated);
  return updated;
}

export async function updateTodo(uid, index, todo, existing) {
  const updated = [...existing];
  updated[index] = todo;
  await saveTodos(uid, updated);
  return updated;
}

export async function deleteTodo(uid, index, existing) {
  const updated = existing.filter((_, i) => i !== index);
  await saveTodos(uid, updated);
  return updated;
}

// --- API Keys ---
export async function addApikey(uid, key, existing) {
  const updated = [...existing, key];
  await saveApikeys(uid, updated);
  return updated;
}

export async function updateApikey(uid, index, key, existing) {
  const updated = [...existing];
  updated[index] = key;
  await saveApikeys(uid, updated);
  return updated;
}

export async function deleteApikey(uid, index, existing) {
  const updated = existing.filter((_, i) => i !== index);
  await saveApikeys(uid, updated);
  return updated;
}

// --- Notes ---
export async function addNote(uid, note, existing) {
  const updated = [...existing, note];
  await saveNotes(uid, updated);
  return updated;
}

export async function updateNote(uid, index, note, existing) {
  const updated = [...existing];
  updated[index] = note;
  await saveNotes(uid, updated);
  return updated;
}

export async function deleteNote(uid, index, existing) {
  const updated = existing.filter((_, i) => i !== index);
  await saveNotes(uid, updated);
  return updated;
}

// ---------- Update item at index ----------
export async function updateContact(uid, index, contact, existingContacts) {
  const updated = [...existingContacts];
  updated[index] = contact;
  await saveContacts(uid, updated);
  return updated;
}

export async function updateTeam(uid, index, team, existingTeams) {
  const updated = [...existingTeams];
  updated[index] = team;
  await saveTeams(uid, updated);
  return updated;
}

export async function updateLink(uid, index, link, existingLinks) {
  const updated = [...existingLinks];
  updated[index] = link;
  await saveLinks(uid, updated);
  return updated;
}

// ---------- Delete item at index ----------
export async function deleteContact(uid, index, existingContacts) {
  const updated = existingContacts.filter((_, i) => i !== index);
  await saveContacts(uid, updated);
  return updated;
}

export async function deleteTeam(uid, index, existingTeams) {
  const updated = existingTeams.filter((_, i) => i !== index);
  await saveTeams(uid, updated);
  return updated;
}

export async function deleteLink(uid, index, existingLinks) {
  const updated = existingLinks.filter((_, i) => i !== index);
  await saveLinks(uid, updated);
  return updated;
}

// ---------- Import data (merge) ----------
export async function importData(uid, data) {
  const current = await loadUserData(uid);
  const merged = {
    contacts: [...current.contacts, ...(data.contacts || [])],
    teams: [...current.teams, ...(data.teams || [])],
    links: [...current.links, ...(data.links || [])],
    todos: [...current.todos, ...(data.todos || [])],
    apikeys: [...current.apikeys, ...(data.apikeys || [])],
    notes: [...current.notes, ...(data.notes || [])]
  };
  await setDoc(doc(db, "users", uid), merged);
  return merged;
}

// ---------- Delete all data ----------
export async function deleteAllData(uid) {
  const empty = { contacts: [], teams: [], links: [], todos: [], apikeys: [], notes: [] };
  await setDoc(doc(db, "users", uid), empty);
  return empty;
}

// ---------- Real-time listener ----------
export function subscribeToUserData(uid, callback) {
  return onSnapshot(doc(db, "users", uid), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback({
        contacts: data.contacts || [],
        teams: data.teams || [],
        links: data.links || [],
        todos: data.todos || [],
        apikeys: data.apikeys || [],
        notes: data.notes || []
      });
    }
  });
}

// ---------- Cache to LocalStorage for offline ----------
export function cacheData(data) {
  try {
    localStorage.setItem("datadock_cache", JSON.stringify(data));
  } catch {
    // Storage full or unavailable
  }
}

export function getCachedData() {
  try {
    const raw = localStorage.getItem("datadock_cache");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
