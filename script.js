// ============================================================
// DataDock — Dashboard Logic (Main Script)
// ============================================================

import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  loadUserData,
  addContact, updateContact, deleteContact,
  addTeam, updateTeam, deleteTeam,
  addLink, updateLink, deleteLink,
  importData, deleteAllData,
  subscribeToUserData, cacheData, getCachedData
} from "./storage.js";

// ============================================================
// STATE
// ============================================================
let currentUser = null;
let userData = { contacts: [], teams: [], links: [] };
let pendingDeleteAction = null;
let unsubscribe = null;
let viewMode = localStorage.getItem("datadock_view_mode") || "card";

// ============================================================
// INIT — Auth Guard
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "auth.html";
    return;
  }
  currentUser = user;
  populateUserInfo(user);
  applyViewMode();

  // Load cached data first for instant display
  const cached = getCachedData();
  if (cached) {
    userData = cached;
    renderAll();
  }

  // Load fresh data from Firestore
  try {
    userData = await loadUserData(user.uid);
    cacheData(userData);
    renderAll();
  } catch (err) {
    showToast("Failed to load data. Using cached version.", "warning");
  }

  // Subscribe to real-time updates
  unsubscribe = subscribeToUserData(user.uid, (data) => {
    userData = data;
    cacheData(userData);
    renderAll();
  });

  hideLoading();
});

function populateUserInfo(user) {
  const nameEl = document.getElementById("user-display-name");
  const emailEl = document.getElementById("user-email-display");
  const avatarEl = document.getElementById("user-avatar");
  const settingsName = document.getElementById("settings-name");
  const settingsEmail = document.getElementById("settings-email");
  const settingsUid = document.getElementById("settings-uid");

  const displayName = user.displayName || user.email.split("@")[0];
  nameEl.textContent = displayName;
  emailEl.textContent = user.email;
  settingsName.textContent = displayName;
  settingsEmail.textContent = user.email;
  settingsUid.textContent = user.uid;

  if (user.photoURL) {
    avatarEl.innerHTML = `<img src="${sanitizeURL(user.photoURL)}" alt="Avatar" />`;
  } else {
    const initials = displayName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    avatarEl.innerHTML = `<span>${escapeHTML(initials)}</span>`;
  }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const icons = { success: "fa-check-circle", error: "fa-exclamation-circle", warning: "fa-exclamation-triangle", info: "fa-info-circle" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ============================================================
// LOADING
// ============================================================
function hideLoading() {
  const el = document.getElementById("loading-overlay");
  if (el) { el.classList.add("fade-out"); setTimeout(() => el.classList.add("hidden"), 300); }
}

// ============================================================
// SECURITY HELPERS
// ============================================================
function escapeHTML(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function sanitizeURL(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
    return "";
  } catch {
    return "";
  }
}

// ============================================================
// NAVIGATION
// ============================================================
const navItems = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll(".content-section");

navItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    gotoSection(item.getAttribute("data-section"));
  });
});

function gotoSection(sectionName) {
  navItems.forEach((n) => n.classList.remove("active"));
  sections.forEach((s) => s.classList.remove("active"));
  const nav = document.querySelector(`[data-section="${sectionName}"]`);
  const section = document.getElementById(`section-${sectionName}`);
  if (nav) nav.classList.add("active");
  if (section) section.classList.add("active");
  closeMobileMenu();
}

// Mobile menu
const mobileToggle = document.getElementById("mobile-menu-toggle");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");

mobileToggle.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  sidebarOverlay.classList.toggle("active");
});

sidebarOverlay.addEventListener("click", closeMobileMenu);

function closeMobileMenu() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("active");
}

// ============================================================
// LOGOUT
// ============================================================
document.getElementById("logout-btn").addEventListener("click", async () => {
  if (unsubscribe) unsubscribe();
  await signOut(auth);
  localStorage.removeItem("datadock_cache");
  window.location.href = "auth.html";
});

// ============================================================
// DARK MODE
// ============================================================
const darkToggle = document.getElementById("dark-mode-toggle");

// Restore preference
if (localStorage.getItem("datadock_dark") === "true") {
  document.body.classList.add("dark-mode");
  darkToggle.checked = true;
}

darkToggle.addEventListener("change", () => {
  document.body.classList.toggle("dark-mode", darkToggle.checked);
  localStorage.setItem("datadock_dark", darkToggle.checked);
});

// ============================================================
// VIEW MODE
// ============================================================
function applyViewMode() {
  document.body.classList.toggle("compact-mode", viewMode === "list");
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-view") === viewMode);
  });
}

document.querySelectorAll(".view-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    viewMode = btn.getAttribute("data-view") === "list" ? "list" : "card";
    localStorage.setItem("datadock_view_mode", viewMode);
    applyViewMode();
    showToast(viewMode === "list" ? "List view enabled." : "Card view enabled.", "info");
  });
});

// ============================================================
// RENDER ALL
// ============================================================
function renderAll() {
  renderStats();
  renderContacts();
  renderTeams();
  renderLinks();
  renderRecent();
}

// ============================================================
// STATS
// ============================================================
function renderStats() {
  document.getElementById("stat-contacts").textContent = userData.contacts.length;
  document.getElementById("stat-teams").textContent = userData.teams.length;
  document.getElementById("stat-links").textContent = userData.links.length;
  const totalMembers = userData.teams.reduce((sum, t) => sum + (t.members ? t.members.length : 0), 0);
  document.getElementById("stat-members").textContent = totalMembers;
}

// ============================================================
// CONTACTS
// ============================================================
function renderContacts(filterText = "") {
  const list = document.getElementById("contacts-list");
  const empty = document.getElementById("contacts-empty");
  const filtered = filterText
    ? userData.contacts.filter((c) => matchesSearch(c, filterText))
    : userData.contacts;

  if (userData.contacts.length === 0) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  list.innerHTML = filtered.map((contact, idx) => {
    const originalIdx = userData.contacts.indexOf(contact);
    return `
      <div class="contact-card">
        <div class="card-header">
          <div class="card-header-info">
            <h3>${escapeHTML(contact.name)}</h3>
            ${contact.role ? `<span class="card-role">${escapeHTML(contact.role)}</span>` : ""}
          </div>
          <div class="card-actions">
            <button class="btn-icon" title="Edit" onclick="window.datadock.editContact(${originalIdx})"><i class="fas fa-pen"></i></button>
            <button class="btn-icon danger" title="Delete" onclick="window.datadock.confirmDelete('contact', ${originalIdx})"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
        ${contact.email ? `<div class="card-detail"><i class="fas fa-envelope"></i><span>${escapeHTML(contact.email)}</span><button class="btn-icon copy-btn" title="Copy" onclick="window.datadock.copyText('${escapeHTML(contact.email)}')"><i class="fas fa-copy"></i></button></div>` : ""}
        ${contact.phone ? `<div class="card-detail"><i class="fas fa-phone"></i><span>${escapeHTML(contact.phone)}</span><button class="btn-icon copy-btn" title="Copy" onclick="window.datadock.copyText('${escapeHTML(contact.phone)}')"><i class="fas fa-copy"></i></button></div>` : ""}
        ${contact.github ? `<div class="card-detail"><i class="fab fa-github"></i><span>${escapeHTML(contact.github)}</span><button class="btn-icon copy-btn" title="Copy" onclick="window.datadock.copyText('${escapeHTML(contact.github)}')"><i class="fas fa-copy"></i></button></div>` : ""}
        ${contact.linkedin ? `<div class="card-detail"><i class="fab fa-linkedin"></i><span>${escapeHTML(contact.linkedin)}</span><button class="btn-icon copy-btn" title="Copy" onclick="window.datadock.copyText('${escapeHTML(contact.linkedin)}')"><i class="fas fa-copy"></i></button></div>` : ""}
        ${contact.notes ? `<div class="card-notes">${escapeHTML(contact.notes)}</div>` : ""}
      </div>
    `;
  }).join("");
}

// ============================================================
// TEAMS
// ============================================================
function renderTeams(filterText = "") {
  const list = document.getElementById("teams-list");
  const empty = document.getElementById("teams-empty");
  const filtered = filterText
    ? userData.teams.filter((t) => matchesSearch(t, filterText))
    : userData.teams;

  if (userData.teams.length === 0) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  list.innerHTML = filtered.map((team, idx) => {
    const originalIdx = userData.teams.indexOf(team);
    const membersHTML = (team.members || []).map((m) => {
      const initials = (m.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      return `
        <div class="team-member-row">
          <div class="member-avatar">${escapeHTML(initials)}</div>
          <span class="member-name">${escapeHTML(m.name)}</span>
          <span class="member-role">${escapeHTML(m.role || "")}</span>
          ${m.email ? `<button class="btn-icon copy-btn" title="Copy email" onclick="window.datadock.copyText('${escapeHTML(m.email)}')"><i class="fas fa-copy"></i></button>` : ""}
        </div>
      `;
    }).join("");

    return `
      <div class="team-card">
        <div class="card-header">
          <div class="card-header-info">
            <h3>${escapeHTML(team.teamName)}</h3>
            <span class="card-role">${(team.members || []).length} member${(team.members || []).length !== 1 ? "s" : ""}</span>
          </div>
          <div class="card-actions">
            <button class="btn-icon" title="Edit" onclick="window.datadock.editTeam(${originalIdx})"><i class="fas fa-pen"></i></button>
            <button class="btn-icon danger" title="Delete" onclick="window.datadock.confirmDelete('team', ${originalIdx})"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
        <div class="team-members-list">${membersHTML}</div>
        ${team.notes ? `<div class="card-notes">${escapeHTML(team.notes)}</div>` : ""}
      </div>
    `;
  }).join("");
}

// ============================================================
// LINKS
// ============================================================
function renderLinks(filterText = "") {
  const list = document.getElementById("links-list");
  const empty = document.getElementById("links-empty");
  const filtered = filterText
    ? userData.links.filter((l) => matchesSearch(l, filterText))
    : userData.links;

  if (userData.links.length === 0) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  list.innerHTML = filtered.map((link, idx) => {
    const originalIdx = userData.links.indexOf(link);
    const safeUrl = sanitizeURL(link.url);
    return `
      <div class="link-card">
        <div class="card-header">
          <div class="card-header-info">
            <h3>${escapeHTML(link.title)}</h3>
            ${safeUrl ? `<a class="link-url" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.url)}</a>` : `<span class="link-url">${escapeHTML(link.url)}</span>`}
          </div>
          <div class="card-actions">
            <button class="btn-icon" title="Copy URL" onclick="window.datadock.copyText('${escapeHTML(link.url)}')"><i class="fas fa-copy"></i></button>
            <button class="btn-icon" title="Edit" onclick="window.datadock.editLink(${originalIdx})"><i class="fas fa-pen"></i></button>
            <button class="btn-icon danger" title="Delete" onclick="window.datadock.confirmDelete('link', ${originalIdx})"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
        ${link.notes ? `<div class="card-notes">${escapeHTML(link.notes)}</div>` : ""}
      </div>
    `;
  }).join("");
}

// ============================================================
// RECENT (Dashboard)
// ============================================================
function renderRecent() {
  const recentContacts = document.getElementById("recent-contacts");
  const recentTeams = document.getElementById("recent-teams");
  const recentLinks = document.getElementById("recent-links");

  const last3Contacts = userData.contacts.slice(-3).reverse();
  const last3Teams = userData.teams.slice(-3).reverse();
  const last3Links = userData.links.slice(-3).reverse();

  recentContacts.innerHTML = last3Contacts.length
    ? last3Contacts.map((c) => `
        <div class="contact-card">
          <div class="card-header"><div class="card-header-info"><h3>${escapeHTML(c.name)}</h3>${c.role ? `<span class="card-role">${escapeHTML(c.role)}</span>` : ""}</div></div>
          ${c.email ? `<div class="card-detail"><i class="fas fa-envelope"></i><span>${escapeHTML(c.email)}</span></div>` : ""}
        </div>
      `).join("")
    : '<p style="color:var(--text-muted);font-size:0.9rem;">No contacts yet.</p>';

  recentTeams.innerHTML = last3Teams.length
    ? last3Teams.map((t) => `
        <div class="team-card">
          <div class="card-header"><div class="card-header-info"><h3>${escapeHTML(t.teamName)}</h3><span class="card-role">${(t.members || []).length} members</span></div></div>
        </div>
      `).join("")
    : '<p style="color:var(--text-muted);font-size:0.9rem;">No teams yet.</p>';

  recentLinks.innerHTML = last3Links.length
    ? last3Links.map((l) => {
        const safeUrl = sanitizeURL(l.url);
        return `
          <div class="link-card">
            <div class="card-header"><div class="card-header-info"><h3>${escapeHTML(l.title)}</h3>${safeUrl ? `<a class="link-url" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHTML(l.url)}</a>` : `<span class="link-url">${escapeHTML(l.url)}</span>`}</div></div>
          </div>
        `;
      }).join("")
    : '<p style="color:var(--text-muted);font-size:0.9rem;">No links yet.</p>';
}

// ============================================================
// SEARCH
// ============================================================
function matchesSearch(obj, text) {
  const lower = text.toLowerCase();
  return JSON.stringify(obj).toLowerCase().includes(lower);
}

// Global search
document.getElementById("global-search").addEventListener("input", (e) => {
  const query = e.target.value.trim();
  const resultsSection = document.getElementById("search-results");
  const resultsList = document.getElementById("search-results-list");

  if (!query) {
    resultsSection.classList.add("hidden");
    return;
  }

  resultsSection.classList.remove("hidden");
  const matchedContacts = userData.contacts.filter((c) => matchesSearch(c, query));
  const matchedTeams = userData.teams.filter((t) => matchesSearch(t, query));
  const matchedLinks = userData.links.filter((l) => matchesSearch(l, query));

  let html = "";
  matchedContacts.forEach((c) => {
    html += `<div class="contact-card"><div class="card-header"><div class="card-header-info"><h3>${escapeHTML(c.name)}</h3>${c.role ? `<span class="card-role">${escapeHTML(c.role)}</span>` : ""}</div></div>${c.email ? `<div class="card-detail"><i class="fas fa-envelope"></i><span>${escapeHTML(c.email)}</span></div>` : ""}</div>`;
  });
  matchedTeams.forEach((t) => {
    html += `<div class="team-card"><div class="card-header"><div class="card-header-info"><h3>${escapeHTML(t.teamName)}</h3><span class="card-role">${(t.members || []).length} members</span></div></div></div>`;
  });
  matchedLinks.forEach((l) => {
    const safeUrl = sanitizeURL(l.url);
    html += `<div class="link-card"><div class="card-header"><div class="card-header-info"><h3>${escapeHTML(l.title)}</h3>${safeUrl ? `<a class="link-url" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHTML(l.url)}</a>` : `<span class="link-url">${escapeHTML(l.url)}</span>`}</div></div></div>`;
  });

  resultsList.innerHTML = html || '<p style="color:var(--text-muted);">No results found.</p>';
});

// Section-specific search
document.getElementById("contacts-search").addEventListener("input", (e) => renderContacts(e.target.value.trim()));
document.getElementById("teams-search").addEventListener("input", (e) => renderTeams(e.target.value.trim()));
document.getElementById("links-search").addEventListener("input", (e) => renderLinks(e.target.value.trim()));

// ============================================================
// MODALS
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

// Close buttons
document.querySelectorAll(".modal-close, .modal-cancel").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modalId = btn.getAttribute("data-modal");
    if (modalId) closeModal(modalId);
  });
});

// Close on overlay click
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
});

// ============================================================
// CONTACT FORM
// ============================================================
function openContactModal(index = -1) {
  const form = document.getElementById("contact-form");
  form.reset();
  document.getElementById("contact-edit-index").value = index;
  document.getElementById("contact-modal-title").textContent = index >= 0 ? "Edit Contact" : "Add Contact";

  if (index >= 0) {
    const c = userData.contacts[index];
    document.getElementById("contact-name").value = c.name || "";
    document.getElementById("contact-email").value = c.email || "";
    document.getElementById("contact-phone").value = c.phone || "";
    document.getElementById("contact-github").value = c.github || "";
    document.getElementById("contact-linkedin").value = c.linkedin || "";
    document.getElementById("contact-role").value = c.role || "";
    document.getElementById("contact-notes").value = c.notes || "";
  }
  openModal("contact-modal");
}

document.getElementById("contact-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const index = parseInt(document.getElementById("contact-edit-index").value);
  const contact = {
    name: document.getElementById("contact-name").value.trim(),
    email: document.getElementById("contact-email").value.trim(),
    phone: document.getElementById("contact-phone").value.trim(),
    github: document.getElementById("contact-github").value.trim(),
    linkedin: document.getElementById("contact-linkedin").value.trim(),
    role: document.getElementById("contact-role").value.trim(),
    notes: document.getElementById("contact-notes").value.trim()
  };

  try {
    if (index >= 0) {
      userData.contacts = await updateContact(currentUser.uid, index, contact, userData.contacts);
      showToast("Contact updated!", "success");
    } else {
      userData.contacts = await addContact(currentUser.uid, contact, userData.contacts);
      showToast("Contact added!", "success");
    }
    cacheData(userData);
    renderAll();
    closeModal("contact-modal");
  } catch (err) {
    showToast("Failed to save contact.", "error");
  }
});

// ============================================================
// TEAM FORM
// ============================================================
function openTeamModal(index = -1) {
  const form = document.getElementById("team-form");
  form.reset();
  document.getElementById("team-edit-index").value = index;
  document.getElementById("team-modal-title").textContent = index >= 0 ? "Edit Team" : "Add Team";

  const membersContainer = document.getElementById("team-members-container");
  membersContainer.innerHTML = "";

  if (index >= 0) {
    const t = userData.teams[index];
    document.getElementById("team-name").value = t.teamName || "";
    document.getElementById("team-notes").value = t.notes || "";
    (t.members || []).forEach((m) => addMemberRow(m.name, m.role, m.email));
  } else {
    addMemberRow();
  }

  openModal("team-modal");
}

function addMemberRow(name = "", role = "", email = "") {
  const container = document.getElementById("team-members-container");
  const row = document.createElement("div");
  row.className = "member-row";
  row.innerHTML = `
    <input type="text" placeholder="Name" value="${escapeHTML(name)}" class="member-name-input" required />
    <input type="text" placeholder="Role" value="${escapeHTML(role)}" class="member-role-input" />
    <input type="email" placeholder="Email" value="${escapeHTML(email)}" class="member-email-input" />
    <button type="button" class="remove-member-btn" title="Remove"><i class="fas fa-times"></i></button>
  `;
  row.querySelector(".remove-member-btn").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

document.getElementById("add-member-btn").addEventListener("click", () => addMemberRow());

document.getElementById("team-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const index = parseInt(document.getElementById("team-edit-index").value);
  const memberRows = document.querySelectorAll("#team-members-container .member-row");
  const members = Array.from(memberRows).map((row) => ({
    name: row.querySelector(".member-name-input").value.trim(),
    role: row.querySelector(".member-role-input").value.trim(),
    email: row.querySelector(".member-email-input").value.trim()
  })).filter((m) => m.name);

  const team = {
    teamName: document.getElementById("team-name").value.trim(),
    members,
    notes: document.getElementById("team-notes").value.trim()
  };

  try {
    if (index >= 0) {
      userData.teams = await updateTeam(currentUser.uid, index, team, userData.teams);
      showToast("Team updated!", "success");
    } else {
      userData.teams = await addTeam(currentUser.uid, team, userData.teams);
      showToast("Team added!", "success");
    }
    cacheData(userData);
    renderAll();
    closeModal("team-modal");
  } catch (err) {
    showToast("Failed to save team.", "error");
  }
});

// ============================================================
// LINK FORM
// ============================================================
function openLinkModal(index = -1) {
  const form = document.getElementById("link-form");
  form.reset();
  document.getElementById("link-edit-index").value = index;
  document.getElementById("link-modal-title").textContent = index >= 0 ? "Edit Link" : "Add Link";

  if (index >= 0) {
    const l = userData.links[index];
    document.getElementById("link-title").value = l.title || "";
    document.getElementById("link-url").value = l.url || "";
    document.getElementById("link-notes").value = l.notes || "";
  }
  openModal("link-modal");
}

document.getElementById("link-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const index = parseInt(document.getElementById("link-edit-index").value);
  const link = {
    title: document.getElementById("link-title").value.trim(),
    url: document.getElementById("link-url").value.trim(),
    notes: document.getElementById("link-notes").value.trim()
  };

  try {
    if (index >= 0) {
      userData.links = await updateLink(currentUser.uid, index, link, userData.links);
      showToast("Link updated!", "success");
    } else {
      userData.links = await addLink(currentUser.uid, link, userData.links);
      showToast("Link added!", "success");
    }
    cacheData(userData);
    renderAll();
    closeModal("link-modal");
  } catch (err) {
    showToast("Failed to save link.", "error");
  }
});

// ============================================================
// DELETE CONFIRMATION
// ============================================================
function confirmDelete(type, index) {
  const labels = { contact: "contact", team: "team", link: "link" };
  document.getElementById("confirm-message").textContent = `Are you sure you want to delete this ${labels[type]}? This action cannot be undone.`;
  pendingDeleteAction = { type, index };
  openModal("confirm-modal");
}

document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
  if (!pendingDeleteAction) return;
  const { type, index } = pendingDeleteAction;

  try {
    if (type === "contact") {
      userData.contacts = await deleteContact(currentUser.uid, index, userData.contacts);
      showToast("Contact deleted.", "success");
    } else if (type === "team") {
      userData.teams = await deleteTeam(currentUser.uid, index, userData.teams);
      showToast("Team deleted.", "success");
    } else if (type === "link") {
      userData.links = await deleteLink(currentUser.uid, index, userData.links);
      showToast("Link deleted.", "success");
    } else if (type === "all") {
      userData = await deleteAllData(currentUser.uid);
      showToast("All data deleted.", "success");
    }
    cacheData(userData);
    renderAll();
  } catch (err) {
    showToast("Failed to delete.", "error");
  }

  pendingDeleteAction = null;
  closeModal("confirm-modal");
});

// ============================================================
// COPY TO CLIPBOARD
// ============================================================
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!", "success");
  } catch {
    showToast("Failed to copy.", "error");
  }
}

// ============================================================
// EXPORT / IMPORT JSON
// ============================================================
function exportJSON() {
  const json = JSON.stringify(userData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `datadock_export_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Data exported!", "success");
}

const fileInput = document.getElementById("import-file-input");

function triggerImport() {
  fileInput.click();
}

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate structure
    if (!data || typeof data !== "object") throw new Error("Invalid format");
    if (data.contacts && !Array.isArray(data.contacts)) throw new Error("Invalid contacts");
    if (data.teams && !Array.isArray(data.teams)) throw new Error("Invalid teams");
    if (data.links && !Array.isArray(data.links)) throw new Error("Invalid links");

    userData = await importData(currentUser.uid, data);
    cacheData(userData);
    renderAll();
    showToast(`Imported ${(data.contacts || []).length} contacts, ${(data.teams || []).length} teams, ${(data.links || []).length} links!`, "success");
  } catch (err) {
    showToast("Invalid JSON file. Please check the format.", "error");
  }

  fileInput.value = "";
});

// ============================================================
// DELETE ALL DATA
// ============================================================
document.getElementById("delete-all-data-btn").addEventListener("click", () => {
  document.getElementById("confirm-message").textContent = "Are you sure you want to delete ALL your data? This action cannot be undone!";
  pendingDeleteAction = { type: "all", index: -1 };
  openModal("confirm-modal");
});

// ============================================================
// QUICK ACTION BUTTONS
// ============================================================
document.getElementById("quick-add-contact").addEventListener("click", () => {
  gotoSection("contacts");
  openContactModal();
});

document.getElementById("quick-add-team").addEventListener("click", () => {
  gotoSection("teams");
  openTeamModal();
});

document.getElementById("quick-add-link").addEventListener("click", () => {
  gotoSection("links");
  openLinkModal();
});

document.getElementById("quick-export").addEventListener("click", exportJSON);
document.getElementById("quick-import").addEventListener("click", triggerImport);

// Section add buttons
document.getElementById("add-contact-btn").addEventListener("click", () => openContactModal());
document.getElementById("add-first-contact-btn").addEventListener("click", () => openContactModal());
document.getElementById("add-team-btn").addEventListener("click", () => openTeamModal());
document.getElementById("add-first-team-btn").addEventListener("click", () => openTeamModal());
document.getElementById("add-link-btn").addEventListener("click", () => openLinkModal());
document.getElementById("add-first-link-btn").addEventListener("click", () => openLinkModal());

// Settings export/import
document.getElementById("settings-export").addEventListener("click", exportJSON);
document.getElementById("settings-import").addEventListener("click", triggerImport);

// ============================================================
// QUICK FAB
// ============================================================
const quickFab = document.getElementById("quick-fab");
const quickFabMain = document.getElementById("quick-fab-main");

quickFabMain.addEventListener("click", () => {
  quickFab.classList.toggle("open");
});

document.getElementById("fab-add-contact").addEventListener("click", () => {
  quickFab.classList.remove("open");
  gotoSection("contacts");
  openContactModal();
});

document.getElementById("fab-add-team").addEventListener("click", () => {
  quickFab.classList.remove("open");
  gotoSection("teams");
  openTeamModal();
});

document.getElementById("fab-add-link").addEventListener("click", () => {
  quickFab.classList.remove("open");
  gotoSection("links");
  openLinkModal();
});

document.addEventListener("click", (e) => {
  if (!quickFab.contains(e.target)) {
    quickFab.classList.remove("open");
  }
});

// ============================================================
// COMMAND PALETTE
// ============================================================
const commandPalette = document.getElementById("command-palette");
const commandInput = document.getElementById("command-input");
const commandList = document.getElementById("command-list");
let commandCursor = 0;

function commandActions() {
  return [
    { title: "Go: Dashboard", meta: "Navigation", run: () => gotoSection("dashboard") },
    { title: "Go: Contacts", meta: "Navigation", run: () => gotoSection("contacts") },
    { title: "Go: Teams", meta: "Navigation", run: () => gotoSection("teams") },
    { title: "Go: Links", meta: "Navigation", run: () => gotoSection("links") },
    { title: "Go: Settings", meta: "Navigation", run: () => gotoSection("settings") },
    { title: "Add Contact", meta: "Quick Add", run: () => { gotoSection("contacts"); openContactModal(); } },
    { title: "Add Team", meta: "Quick Add", run: () => { gotoSection("teams"); openTeamModal(); } },
    { title: "Add Link", meta: "Quick Add", run: () => { gotoSection("links"); openLinkModal(); } },
    { title: "Export JSON", meta: "Data", run: exportJSON },
    { title: "Import JSON", meta: "Data", run: triggerImport },
    {
      title: viewMode === "card" ? "Switch to List View" : "Switch to Card View",
      meta: "Appearance",
      run: () => {
        viewMode = viewMode === "card" ? "list" : "card";
        localStorage.setItem("datadock_view_mode", viewMode);
        applyViewMode();
      }
    },
    {
      title: darkToggle.checked ? "Switch to Light Mode" : "Switch to Dark Mode",
      meta: "Appearance",
      run: () => {
        darkToggle.checked = !darkToggle.checked;
        darkToggle.dispatchEvent(new Event("change"));
      }
    }
  ];
}

function filteredCommands() {
  const q = commandInput.value.trim().toLowerCase();
  const all = commandActions();
  if (!q) return all;
  return all.filter((cmd) => `${cmd.title} ${cmd.meta}`.toLowerCase().includes(q));
}

function renderCommands() {
  const items = filteredCommands();
  if (commandCursor >= items.length) commandCursor = 0;
  commandList.innerHTML = items.length
    ? items.map((cmd, idx) => `
        <button class="command-item ${idx === commandCursor ? "active" : ""}" data-idx="${idx}">
          <span>${escapeHTML(cmd.title)}</span>
          <small>${escapeHTML(cmd.meta)}</small>
        </button>
      `).join("")
    : '<div class="command-item"><span>No commands found</span><small>Try another keyword</small></div>';

  commandList.querySelectorAll(".command-item[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      commandCursor = Number(btn.getAttribute("data-idx"));
      runCommandAtCursor();
    });
  });
}

function openCommandPalette() {
  commandPalette.classList.remove("hidden");
  commandInput.value = "";
  commandCursor = 0;
  renderCommands();
  commandInput.focus();
}

function closeCommandPalette() {
  commandPalette.classList.add("hidden");
}

function runCommandAtCursor() {
  const items = filteredCommands();
  if (!items.length) return;
  const selected = items[commandCursor];
  closeCommandPalette();
  selected.run();
}

commandInput.addEventListener("input", () => {
  commandCursor = 0;
  renderCommands();
});

commandInput.addEventListener("keydown", (e) => {
  const size = filteredCommands().length;
  if (e.key === "ArrowDown" && size) {
    e.preventDefault();
    commandCursor = (commandCursor + 1) % size;
    renderCommands();
  }
  if (e.key === "ArrowUp" && size) {
    e.preventDefault();
    commandCursor = (commandCursor - 1 + size) % size;
    renderCommands();
  }
  if (e.key === "Enter") {
    e.preventDefault();
    runCommandAtCursor();
  }
  if (e.key === "Escape") {
    e.preventDefault();
    closeCommandPalette();
  }
});

commandPalette.addEventListener("click", (e) => {
  if (e.target === commandPalette) closeCommandPalette();
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openCommandPalette();
  }
  if (e.key === "Escape" && !commandPalette.classList.contains("hidden")) {
    closeCommandPalette();
  }
});

// ============================================================
// EXPOSE FUNCTIONS TO WINDOW (for inline onclick handlers)
// ============================================================
window.datadock = {
  editContact: openContactModal,
  editTeam: openTeamModal,
  editLink: openLinkModal,
  confirmDelete,
  copyText
};
