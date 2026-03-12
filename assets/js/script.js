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
  addTodo, updateTodo, deleteTodo,
  addApikey, updateApikey, deleteApikey,
  addNote, updateNote, deleteNote,
  addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  importData, deleteAllData,
  subscribeToUserData, cacheData, getCachedData
} from "./storage.js";

// ============================================================
// STATE
// ============================================================
let currentUser = null;
let userData = { contacts: [], teams: [], links: [], todos: [], apikeys: [], notes: [], calendarEvents: [] };
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
  termLog(`User authenticated: ${user.email}`);

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
    termLog(`Loaded ${userData.contacts.length} contacts, ${userData.teams.length} teams, ${userData.links.length} links`);
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
  termLog(message);
}

// ============================================================
// LOADING
// ============================================================
function hideLoading() {
  const el = document.getElementById("loading-overlay");
  if (el) {
    const bar = el.querySelector('.neon-progress-bar');
    if (bar) bar.style.width = '100%';
    setTimeout(() => { el.classList.add("fade-out"); setTimeout(() => el.classList.add("hidden"), 300); }, 400);
  }
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
// COLLAPSIBLE SIDEBAR
// ============================================================
const sidebarCollapseBtn = document.getElementById("sidebar-collapse-btn");
let sidebarCollapsed = localStorage.getItem("datadock_sidebar_collapsed") === "true";

function applySidebarState() {
  document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed);
  const icon = sidebarCollapseBtn?.querySelector("i");
  if (icon) {
    icon.className = sidebarCollapsed ? "fas fa-chevron-right" : "fas fa-chevron-left";
  }
}

if (sidebarCollapseBtn) {
  sidebarCollapseBtn.addEventListener("click", () => {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem("datadock_sidebar_collapsed", sidebarCollapsed);
    applySidebarState();
  });
}

applySidebarState();

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
// TERMINAL CONSOLE
// ============================================================
function termLog(message) {
  const body = document.getElementById('terminal-body');
  if (!body) return;
  const line = document.createElement('div');
  line.className = 'terminal-line';
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  line.innerHTML = `<span class="terminal-time">[${ts}]</span> <span class="terminal-prompt">&gt;</span> ${escapeHTML(message)}`;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

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
  renderTodos();
  renderApikeys();
  renderNotes();
  renderRecent();
  renderDashTodos();
  renderCalendar();
  renderDashCalendar();
  renderTodoDualDate();
}

// ============================================================
// STATS
// ============================================================
function renderStats() {
  document.getElementById("stat-contacts").textContent = userData.contacts.length;
  document.getElementById("stat-teams").textContent = userData.teams.length;
  document.getElementById("stat-links").textContent = userData.links.length;
  document.getElementById("stat-todos").textContent = userData.todos.filter(t => !t.done).length;
  document.getElementById("stat-apikeys").textContent = userData.apikeys.length;
  document.getElementById("stat-notes").textContent = userData.notes.length;

  // Update status bar total records
  const totalEl = document.getElementById("status-total-records");
  if (totalEl) {
    const total = userData.contacts.length + userData.teams.length + userData.links.length
      + userData.todos.length + userData.apikeys.length + userData.notes.length;
    totalEl.textContent = total;
  }
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
            <button class="btn-icon" title="View as text" onclick="window.datadock.viewContact(${originalIdx})"><i class="fas fa-eye"></i></button>
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
    const socialIcons = { linkedin: 'fab fa-linkedin', github: 'fab fa-github', instagram: 'fab fa-instagram' };

    // Build plain-text summary for copy
    const copyLines = [`Team: ${team.teamName}`];
    if (team.phone) copyLines.push(`Contact: ${team.phone}`);
    (team.socials || []).forEach(s => copyLines.push(`${s.platform}: ${s.url}`));
    (team.members || []).forEach((m, mi) => {
      copyLines.push(`\nMember ${mi + 1}: ${m.name}`);
      if (m.role) copyLines.push(`  Role: ${m.role}`);
      if (m.phone) copyLines.push(`  Phone: ${m.phone}`);
      if (m.email) copyLines.push(`  Email: ${m.email}`);
      if (m.college) copyLines.push(`  College: ${m.college}`);
      (m.socials || []).forEach(s => copyLines.push(`  ${s.platform}: ${s.url}`));
    });
    if (team.notes) copyLines.push(`\nNotes: ${team.notes}`);
    const copyText = copyLines.join('\n');

    const membersHTML = (team.members || []).map((m) => {
      const initials = (m.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      const memberSocialsHTML = (m.socials || []).map(s => {
        const icon = socialIcons[s.platform] || 'fas fa-globe';
        const safeUrl = sanitizeURL(s.url);
        return safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="member-social-link" title="${escapeHTML(s.platform)}"><i class="${icon}"></i></a>` : '';
      }).join("");
      return `
        <div class="team-member-row">
          <div class="member-avatar">${escapeHTML(initials)}</div>
          <div class="member-info">
            <div class="member-info-top">
              <span class="member-name">${escapeHTML(m.name)}</span>
              ${m.role ? `<span class="member-role">${escapeHTML(m.role)}</span>` : ""}
            </div>
            <div class="member-info-details">
              ${m.phone ? `<span class="member-detail"><i class="fas fa-phone"></i> ${escapeHTML(m.phone)}</span>` : ""}
              ${m.email ? `<span class="member-detail"><i class="fas fa-envelope"></i> ${escapeHTML(m.email)}</span>` : ""}
              ${m.college ? `<span class="member-detail"><i class="fas fa-university"></i> ${escapeHTML(m.college)}</span>` : ""}
            </div>
            ${memberSocialsHTML ? `<div class="member-socials-display">${memberSocialsHTML}</div>` : ""}
          </div>
        </div>
      `;
    }).join("");

    const socialsHTML = (team.socials || []).map((s) => {
      const icon = socialIcons[s.platform] || 'fas fa-globe';
      const safeUrl = sanitizeURL(s.url);
      return `
        <div class="team-social-row">
          <i class="${icon}"></i>
          ${safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.url)}</a>` : `<span>${escapeHTML(s.url)}</span>`}
          <span class="social-type-badge ${escapeHTML(s.type || 'professional')}">${escapeHTML(s.type || 'professional')}</span>
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
            <button class="btn-icon" title="View as text" onclick="window.datadock.viewTeam(${originalIdx})"><i class="fas fa-eye"></i></button>
            <button class="btn-icon" title="Copy All Info" onclick="window.datadock.copyText(${JSON.stringify(copyText).replace(/'/g, "\\'").replace(/"/g, '&quot;')})"><i class="fas fa-copy"></i></button>
            <button class="btn-icon" title="Edit" onclick="window.datadock.editTeam(${originalIdx})"><i class="fas fa-pen"></i></button>
            <button class="btn-icon danger" title="Delete" onclick="window.datadock.confirmDelete('team', ${originalIdx})"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
        <div class="team-full-info">
          ${team.phone ? `<div class="team-info-row"><i class="fas fa-phone"></i><span>${escapeHTML(team.phone)}</span></div>` : ""}
          ${socialsHTML ? `<div class="team-socials-list">${socialsHTML}</div>` : ""}
          <div class="team-members-list">${membersHTML}</div>
          ${team.notes ? `<div class="card-notes"><i class="fas fa-sticky-note"></i> ${escapeHTML(team.notes)}</div>` : ""}
        </div>
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
            <button class="btn-icon" title="View as text" onclick="window.datadock.viewLink(${originalIdx})"><i class="fas fa-eye"></i></button>
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
        <div class="dash-recent-item">
          <div class="dash-recent-icon"><i class="fas fa-user"></i></div>
          <div class="dash-recent-info">
            <span class="dash-recent-name">${escapeHTML(c.name)}</span>
            ${c.email ? `<span class="dash-recent-detail">${escapeHTML(c.email)}</span>` : ''}
          </div>
        </div>
      `).join("")
    : '<p class="dash-empty-msg"><i class="fas fa-address-book"></i> No contacts yet.</p>';

  recentTeams.innerHTML = last3Teams.length
    ? last3Teams.map((t) => `
        <div class="dash-recent-item">
          <div class="dash-recent-icon team"><i class="fas fa-users"></i></div>
          <div class="dash-recent-info">
            <span class="dash-recent-name">${escapeHTML(t.teamName)}</span>
            <span class="dash-recent-detail">${(t.members || []).length} member${(t.members || []).length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      `).join("")
    : '<p class="dash-empty-msg"><i class="fas fa-users"></i> No teams yet.</p>';

  recentLinks.innerHTML = last3Links.length
    ? last3Links.map((l) => {
        const safeUrl = sanitizeURL(l.url);
        return `
          <div class="dash-recent-item">
            <div class="dash-recent-icon link"><i class="fas fa-link"></i></div>
            <div class="dash-recent-info">
              <span class="dash-recent-name">${escapeHTML(l.title)}</span>
              ${safeUrl ? `<a class="dash-recent-detail link-url" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHTML(l.url)}</a>` : `<span class="dash-recent-detail">${escapeHTML(l.url)}</span>`}
            </div>
          </div>
        `;
      }).join("")
    : '<p class="dash-empty-msg"><i class="fas fa-link"></i> No links yet.</p>';
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
  const matchedTodos = userData.todos.filter((t) => matchesSearch(t, query));
  const matchedApikeys = userData.apikeys.filter((k) => matchesSearch(k, query));
  const matchedNotes = userData.notes.filter((n) => matchesSearch(n, query));
  const matchedCalEvents = (userData.calendarEvents || []).filter((ev) => matchesSearch(ev, query));

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
  matchedTodos.forEach((t) => {
    html += `<div class="dash-todo-item${t.done ? ' completed' : ''}"><span class="todo-text">${escapeHTML(t.text)}</span><span class="todo-priority ${escapeHTML(t.priority || 'medium')}">${escapeHTML(t.priority || 'medium')}</span></div>`;
  });
  matchedApikeys.forEach((k) => {
    html += `<div class="apikey-card"><div class="card-header"><div class="card-header-info"><h3><i class="fas fa-key" style="color:var(--neon-purple);margin-right:6px;"></i>${escapeHTML(k.label)}</h3>${k.category ? `<span class="apikey-category">${escapeHTML(k.category)}</span>` : ''}</div></div></div>`;
  });
  matchedNotes.forEach((n) => {
    html += `<div class="note-card"><div class="card-header"><div class="card-header-info"><h3><i class="fas fa-sticky-note" style="color:var(--neon-magenta);margin-right:6px;"></i>${escapeHTML(n.title)}</h3>${n.tag ? `<span class="note-tag">${escapeHTML(n.tag)}</span>` : ''}</div></div></div>`;
  });
  matchedCalEvents.forEach((ev) => {
    html += `<div class="calendar-event-item" style="border-left-color:var(--neon-${ev.color || 'green'})"><div class="calendar-event-title"><i class="fas fa-calendar-alt" style="color:var(--neon-cyan);margin-right:6px;"></i>${escapeHTML(ev.title)}</div><div class="calendar-event-notes">${escapeHTML(ev.bsDate || '')}</div></div>`;
  });

  resultsList.innerHTML = html || '<p style="color:var(--text-muted);">No results found.</p>';
});

// Section-specific search
document.getElementById("contacts-search").addEventListener("input", (e) => renderContacts(e.target.value.trim()));
document.getElementById("teams-search").addEventListener("input", (e) => renderTeams(e.target.value.trim()));
document.getElementById("links-search").addEventListener("input", (e) => renderLinks(e.target.value.trim()));
document.getElementById("todos-search").addEventListener("input", (e) => renderTodos(e.target.value.trim()));
document.getElementById("apikeys-search").addEventListener("input", (e) => renderApikeys(e.target.value.trim()));
document.getElementById("notes-search").addEventListener("input", (e) => renderNotes(e.target.value.trim()));

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
  const socialsContainer = document.getElementById("team-socials-container");
  socialsContainer.innerHTML = "";

  if (index >= 0) {
    const t = userData.teams[index];
    document.getElementById("team-name").value = t.teamName || "";
    document.getElementById("team-phone").value = t.phone || "";
    document.getElementById("team-notes").value = t.notes || "";
    (t.socials || []).forEach((s) => addSocialRow(s.platform, s.url, s.type));
    (t.members || []).forEach((m) => addMemberRow(m.name, m.role, m.email, m.phone, m.college, m.socials));
  } else {
    addMemberRow();
  }

  openModal("team-modal");
}

function addMemberRow(name = "", role = "", email = "", phone = "", college = "", socials = []) {
  const container = document.getElementById("team-members-container");
  const row = document.createElement("div");
  row.className = "member-row";
  row.innerHTML = `
    <div class="member-row-header">
      <input type="text" placeholder="Name" value="${escapeHTML(name)}" class="member-name-input" required />
      <input type="text" placeholder="Role" value="${escapeHTML(role)}" class="member-role-input" />
      <button type="button" class="remove-member-btn" title="Remove member"><i class="fas fa-times"></i></button>
    </div>
    <div class="member-row-details">
      <input type="tel" placeholder="Contact Number" value="${escapeHTML(phone)}" class="member-phone-input" />
      <input type="email" placeholder="Email" value="${escapeHTML(email)}" class="member-email-input" />
      <input type="text" placeholder="College" value="${escapeHTML(college)}" class="member-college-input" />
    </div>
    <div class="member-socials-section">
      <label class="member-socials-label">Social Links</label>
      <div class="member-socials-list"></div>
      <button type="button" class="btn btn-secondary btn-xs add-member-social-btn">
        <i class="fas fa-plus"></i> Add Social Link
      </button>
    </div>
  `;
  row.querySelector(".remove-member-btn").addEventListener("click", () => row.remove());
  row.querySelector(".add-member-social-btn").addEventListener("click", () => {
    addMemberSocialRow(row.querySelector(".member-socials-list"));
  });
  const socialsList = row.querySelector(".member-socials-list");
  (socials || []).forEach(s => addMemberSocialRow(socialsList, s.platform, s.url));
  container.appendChild(row);
}

function addMemberSocialRow(container, platform = "", url = "") {
  const row = document.createElement("div");
  row.className = "member-social-input-row";
  row.innerHTML = `
    <select class="member-social-platform">
      <option value="linkedin" ${platform === 'linkedin' ? 'selected' : ''}>LinkedIn</option>
      <option value="github" ${platform === 'github' ? 'selected' : ''}>GitHub</option>
      <option value="instagram" ${platform === 'instagram' ? 'selected' : ''}>Instagram</option>
    </select>
    <input type="url" placeholder="Profile URL" value="${escapeHTML(url)}" class="member-social-url" />
    <button type="button" class="remove-member-btn" title="Remove"><i class="fas fa-times"></i></button>
  `;
  row.querySelector(".remove-member-btn").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

function addSocialRow(platform = "", url = "", type = "") {
  const container = document.getElementById("team-socials-container");
  const row = document.createElement("div");
  row.className = "social-row";
  row.innerHTML = `
    <select class="social-platform-input">
      <option value="linkedin" ${platform === 'linkedin' ? 'selected' : ''}>LinkedIn</option>
      <option value="github" ${platform === 'github' ? 'selected' : ''}>GitHub</option>
      <option value="instagram" ${platform === 'instagram' ? 'selected' : ''}>Instagram</option>
    </select>
    <input type="url" placeholder="Profile URL" value="${escapeHTML(url)}" class="social-url-input" />
    <select class="social-type-input">
      <option value="professional" ${type === 'professional' ? 'selected' : ''}>Professional</option>
      <option value="personal" ${type === 'personal' ? 'selected' : ''}>Personal</option>
      <option value="portfolio" ${type === 'portfolio' ? 'selected' : ''}>Portfolio</option>
    </select>
    <button type="button" class="remove-member-btn" title="Remove"><i class="fas fa-times"></i></button>
  `;
  row.querySelector(".remove-member-btn").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

document.getElementById("add-member-btn").addEventListener("click", () => addMemberRow());
document.getElementById("add-social-btn").addEventListener("click", () => addSocialRow());

document.getElementById("team-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const index = parseInt(document.getElementById("team-edit-index").value);
  const memberRows = document.querySelectorAll("#team-members-container .member-row");
  const members = Array.from(memberRows).map((row) => {
    const memberSocialRows = row.querySelectorAll(".member-social-input-row");
    const memberSocials = Array.from(memberSocialRows).map(sr => ({
      platform: sr.querySelector(".member-social-platform").value,
      url: sr.querySelector(".member-social-url").value.trim()
    })).filter(s => s.url);
    return {
      name: row.querySelector(".member-name-input").value.trim(),
      phone: row.querySelector(".member-phone-input").value.trim(),
      role: row.querySelector(".member-role-input").value.trim(),
      email: row.querySelector(".member-email-input").value.trim(),
      college: row.querySelector(".member-college-input").value.trim(),
      socials: memberSocials
    };
  }).filter((m) => m.name);

  const socialRows = document.querySelectorAll("#team-socials-container .social-row");
  const socials = Array.from(socialRows).map((row) => ({
    platform: row.querySelector(".social-platform-input").value,
    url: row.querySelector(".social-url-input").value.trim(),
    type: row.querySelector(".social-type-input").value
  })).filter((s) => s.url);

  const team = {
    teamName: document.getElementById("team-name").value.trim(),
    phone: document.getElementById("team-phone").value.trim(),
    socials,
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
  const labels = { contact: "contact", team: "team", link: "link", todo: "task", apikey: "API key", note: "note", calendarEvent: "calendar event" };
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
    } else if (type === "todo") {
      userData.todos = await deleteTodo(currentUser.uid, index, userData.todos);
      showToast("Task deleted.", "success");
    } else if (type === "apikey") {
      userData.apikeys = await deleteApikey(currentUser.uid, index, userData.apikeys);
      showToast("Entry deleted.", "success");
    } else if (type === "note") {
      userData.notes = await deleteNote(currentUser.uid, index, userData.notes);
      showToast("Note deleted.", "success");
    } else if (type === "calendarEvent") {
      userData.calendarEvents = await deleteCalendarEvent(currentUser.uid, index, userData.calendarEvents);
      showToast("Event deleted.", "success");
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
// VIEW CONTACT AS NOTEPAD
// ============================================================
function viewContact(idx) {
  const c = userData.contacts[idx];
  if (!c) return;

  // Avatar initials
  const initials = (c.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  document.getElementById("cv-avatar").textContent = initials;
  document.getElementById("cv-name").textContent = c.name;
  const roleEl = document.getElementById("cv-role");
  roleEl.textContent = c.role || "";
  roleEl.style.display = c.role ? "" : "none";

  // Field rows
  const fields = [
    { icon: "fas fa-envelope", label: "Email",    val: c.email,    cls: "em" },
    { icon: "fas fa-phone",    label: "Phone",    val: c.phone,    cls: "ph" },
    { icon: "fab fa-github",   label: "GitHub",   val: c.github,   cls: "" },
    { icon: "fab fa-linkedin", label: "LinkedIn", val: c.linkedin, cls: "li" },
  ];
  document.getElementById("cv-fields").innerHTML = fields.filter(f => f.val).map(f => `
    <div class="cv-row">
      <span class="cv-row-icon"><i class="${f.icon}"></i></span>
      <span class="cv-row-label">${f.label}</span>
      <span class="cv-row-val ${f.cls}" title="${escapeHTML(f.val)}">${escapeHTML(f.val)}</span>
      <button class="cv-copy-btn" onclick="window.datadock.copyText('${escapeHTML(f.val).replace(/'/g,"&#39;")}')"><i class="fas fa-copy"></i></button>
    </div>
  `).join("");

  // Notes
  const notesEl = document.getElementById("cv-notes");
  if (c.notes) {
    notesEl.style.display = "";
    notesEl.innerHTML = `<div class="cv-notes"><span class="cv-notes-lbl"><i class="fas fa-sticky-note"></i> Notes</span>${escapeHTML(c.notes)}</div>`;
  } else {
    notesEl.style.display = "none";
    notesEl.innerHTML = "";
  }

  // Store idx for copy-all
  document.getElementById("contact-view-modal").dataset.contactIdx = idx;
  document.getElementById("contact-view-modal").classList.remove("hidden");
}

function copyContactAll() {
  const modal = document.getElementById("contact-view-modal");
  // Use generic copyAll if available
  if (modal.dataset.copyAll) {
    copyText(modal.dataset.copyAll);
    return;
  }
  const idx = modal.dataset.contactIdx;
  const c = userData.contacts[+idx];
  if (!c) return;
  const lines = [`Name    : ${c.name}`];
  if (c.role)     lines.push(`Role    : ${c.role}`);
  if (c.email)    lines.push(`Email   : ${c.email}`);
  if (c.phone)    lines.push(`Phone   : ${c.phone}`);
  if (c.github)   lines.push(`GitHub  : ${c.github}`);
  if (c.linkedin) lines.push(`LinkedIn: ${c.linkedin}`);
  if (c.notes)    lines.push(`\nNotes:\n${c.notes}`);
  copyText(lines.join("\n"));
}

// ============================================================
// GENERIC VIEW MODAL HELPER
// ============================================================
function openViewModal(title, initials, subtitle, fields, notes, copyAllText, extraHTML) {
  document.getElementById("cv-avatar").textContent = initials;
  document.getElementById("cv-name").textContent = title;
  const roleEl = document.getElementById("cv-role");
  roleEl.textContent = subtitle || "";
  roleEl.style.display = subtitle ? "" : "none";

  let html = fields.filter(f => f.val).map(f => `
    <div class="cv-row">
      <span class="cv-row-icon"><i class="${f.icon}"></i></span>
      <span class="cv-row-label">${f.label}</span>
      <span class="cv-row-val ${f.cls || ''}" title="${escapeHTML(f.val)}">${escapeHTML(f.val)}</span>
      <button class="cv-copy-btn" onclick="window.datadock.copyText('${escapeHTML(f.val).replace(/'/g,"&#39;")}')"><i class="fas fa-copy"></i></button>
    </div>
  `).join("");

  if (extraHTML) html += extraHTML;

  document.getElementById("cv-fields").innerHTML = html;

  const notesEl = document.getElementById("cv-notes");
  if (notes) {
    notesEl.style.display = "";
    notesEl.innerHTML = `<div class="cv-notes"><span class="cv-notes-lbl"><i class="fas fa-sticky-note"></i> Notes</span>${escapeHTML(notes)}</div>`;
  } else {
    notesEl.style.display = "none";
    notesEl.innerHTML = "";
  }

  const modal = document.getElementById("contact-view-modal");
  modal.dataset.copyAll = copyAllText;
  modal.classList.remove("hidden");
}

function copyViewAll() {
  const text = document.getElementById("contact-view-modal").dataset.copyAll || "";
  copyText(text);
}

// ============================================================
// VIEW TEAM
// ============================================================
function viewTeam(idx) {
  const t = userData.teams[idx];
  if (!t) return;
  const initials = (t.teamName || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const fields = [
    { icon: "fas fa-phone", label: "Phone", val: t.phone, cls: "ph" },
  ];
  (t.socials || []).forEach(s => {
    fields.push({ icon: "fas fa-globe", label: s.platform || "Social", val: s.url, cls: "em" });
  });

  // Build member sub-cards HTML
  let membersHTML = "";
  const members = t.members || [];
  if (members.length) {
    membersHTML += `<div class="cv-section-label"><i class="fas fa-users"></i> Members (${members.length})</div>`;
    members.forEach(m => {
      const mInit = (m.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      membersHTML += `<div class="cv-member">`;
      membersHTML += `<div class="cv-member-head">`;
      membersHTML += `<div class="cv-member-avatar">${mInit}</div>`;
      membersHTML += `<span class="cv-member-name">${escapeHTML(m.name)}</span>`;
      if (m.role) membersHTML += `<span class="cv-member-role">${escapeHTML(m.role)}</span>`;
      membersHTML += `</div>`;
      if (m.phone) membersHTML += `<div class="cv-member-detail"><i class="fas fa-phone"></i> <span>${escapeHTML(m.phone)}</span></div>`;
      if (m.email) membersHTML += `<div class="cv-member-detail"><i class="fas fa-envelope"></i> <span>${escapeHTML(m.email)}</span></div>`;
      if (m.college) membersHTML += `<div class="cv-member-detail"><i class="fas fa-university"></i> <span>${escapeHTML(m.college)}</span></div>`;
      (m.socials || []).forEach(s => {
        if (s.url) membersHTML += `<div class="cv-member-detail"><i class="fas fa-globe"></i> <span>${escapeHTML(s.url)}</span></div>`;
      });
      membersHTML += `</div>`;
    });
  }

  const lines = [`Team: ${t.teamName}`];
  if (t.phone) lines.push(`Phone: ${t.phone}`);
  (t.socials || []).forEach(s => lines.push(`${s.platform}: ${s.url}`));
  members.forEach((m, i) => {
    lines.push(`\nMember ${i+1}: ${m.name}`);
    if (m.role) lines.push(`  Role: ${m.role}`);
    if (m.phone) lines.push(`  Phone: ${m.phone}`);
    if (m.email) lines.push(`  Email: ${m.email}`);
    if (m.college) lines.push(`  College: ${m.college}`);
  });
  if (t.notes) lines.push(`\nNotes:\n${t.notes}`);

  openViewModal(t.teamName, initials, `${members.length} member${members.length!==1?'s':''}`, fields, t.notes, lines.join("\n"), membersHTML);
}

// ============================================================
// VIEW LINK
// ============================================================
function viewLink(idx) {
  const l = userData.links[idx];
  if (!l) return;
  const initials = (l.title || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const fields = [
    { icon: "fas fa-heading", label: "Title", val: l.title },
    { icon: "fas fa-link",    label: "URL",   val: l.url, cls: "em" },
  ];
  const lines = [`Title: ${l.title}`, `URL  : ${l.url}`];
  if (l.notes) lines.push(`\nNotes:\n${l.notes}`);
  openViewModal(l.title, initials, null, fields, l.notes, lines.join("\n"));
}

// ============================================================
// VIEW API KEY
// ============================================================
function viewApikey(idx) {
  const k = userData.apikeys[idx];
  if (!k) return;
  const initials = (k.label || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const fields = [
    { icon: "fas fa-tag",  label: "Label",    val: k.label },
    { icon: "fas fa-key",  label: "Value",    val: k.value },
    { icon: "fas fa-folder", label: "Category", val: k.category },
  ];
  const lines = [`Label   : ${k.label}`, `Value   : ${k.value}`];
  if (k.category) lines.push(`Category: ${k.category}`);
  if (k.notes) lines.push(`\nNotes:\n${k.notes}`);
  openViewModal(k.label, initials, k.category || null, fields, k.notes, lines.join("\n"));
}

// ============================================================
// VIEW NOTE
// ============================================================
function viewNote(idx) {
  const n = userData.notes[idx];
  if (!n) return;
  const initials = (n.title || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const fields = [];
  if (n.tag) fields.push({ icon: "fas fa-tag", label: "Tag", val: n.tag });
  const lines = [`Title: ${n.title}`];
  if (n.tag) lines.push(`Tag  : ${n.tag}`);
  if (n.body) lines.push(`\n${n.body}`);
  // Pass body as the notes param so it renders in the scrollable notes section
  openViewModal(n.title, initials, n.tag || null, fields, n.body || null, lines.join("\n"));
}

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
// QUICK ACTION BUTTONS (removed — no longer on dashboard)
// ============================================================

// Dashboard todo widget view all
document.getElementById("dash-todo-viewall").addEventListener("click", () => gotoSection("todos"));

// Section add buttons
document.getElementById("add-contact-btn").addEventListener("click", () => openContactModal());
document.getElementById("add-first-contact-btn").addEventListener("click", () => openContactModal());
document.getElementById("add-team-btn").addEventListener("click", () => openTeamModal());
document.getElementById("add-first-team-btn").addEventListener("click", () => openTeamModal());
document.getElementById("add-link-btn").addEventListener("click", () => openLinkModal());
document.getElementById("add-first-link-btn").addEventListener("click", () => openLinkModal());

// New section add buttons
document.getElementById("add-todo-btn").addEventListener("click", () => openTodoModal());
document.getElementById("add-first-todo-btn").addEventListener("click", () => openTodoModal());
document.getElementById("add-apikey-btn").addEventListener("click", () => openApikeyModal());
document.getElementById("add-first-apikey-btn").addEventListener("click", () => openApikeyModal());
document.getElementById("add-note-btn").addEventListener("click", () => openNoteModal());
document.getElementById("add-first-note-btn").addEventListener("click", () => openNoteModal());

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
// NEPALI (BIKRAM SAMBAT) DATE CONVERTER
// ============================================================
const BS_CALENDAR = [
  [2000,30,32,31,32,31,30,30,30,29,30,29,31],
  [2001,31,31,32,31,31,31,30,29,30,29,30,30],
  [2002,31,31,32,32,31,30,30,29,30,29,30,30],
  [2003,31,32,31,32,31,30,30,30,29,29,30,31],
  [2004,30,32,31,32,31,30,30,30,29,30,29,31],
  [2005,31,31,32,31,31,31,30,29,30,29,30,30],
  [2006,31,31,32,32,31,30,30,29,30,29,30,30],
  [2007,31,32,31,32,31,30,30,30,29,29,30,31],
  [2008,31,31,31,32,31,31,29,30,30,29,29,31],
  [2009,31,31,32,31,31,31,30,29,30,29,30,30],
  [2010,31,31,32,32,31,30,30,29,30,29,30,30],
  [2011,31,32,31,32,31,30,30,30,29,29,30,31],
  [2012,31,31,31,32,31,31,29,30,30,29,30,30],
  [2013,31,31,32,31,31,31,30,29,30,29,30,30],
  [2014,31,31,32,32,31,30,30,29,30,29,30,30],
  [2015,31,32,31,32,31,30,30,30,29,29,30,31],
  [2016,31,31,31,32,31,31,29,30,30,29,30,30],
  [2017,31,31,32,31,31,31,30,29,30,29,30,30],
  [2018,31,32,31,32,31,30,30,29,30,29,30,30],
  [2019,31,32,31,32,31,30,30,30,29,30,29,31],
  [2020,31,31,31,32,31,31,30,29,30,29,30,30],
  [2021,31,31,32,31,31,31,30,29,30,29,30,30],
  [2022,31,32,31,32,31,30,30,30,29,29,30,30],
  [2023,31,32,31,32,31,30,30,30,29,30,29,31],
  [2024,31,31,31,32,31,31,30,29,30,29,30,30],
  [2025,31,31,32,31,31,31,30,29,30,29,30,30],
  [2026,31,32,31,32,31,30,30,30,29,29,30,31],
  [2027,30,32,31,32,31,30,30,30,29,30,29,31],
  [2028,31,31,32,31,31,31,30,29,30,29,30,30],
  [2029,31,31,32,31,32,30,30,29,30,29,30,30],
  [2030,31,32,31,32,31,30,30,30,29,29,30,31],
  [2031,30,32,31,32,31,30,30,30,29,30,29,31],
  [2032,31,31,32,31,31,31,30,29,30,29,30,30],
  [2033,31,31,32,32,31,30,30,29,30,29,30,30],
  [2034,31,32,31,32,31,30,30,30,29,29,30,31],
  [2035,30,32,31,32,31,31,29,30,30,29,29,31],
  [2036,31,31,32,31,31,31,30,29,30,29,30,30],
  [2037,31,31,32,32,31,30,30,29,30,29,30,30],
  [2038,31,32,31,32,31,30,30,30,29,29,30,31],
  [2039,31,31,31,32,31,31,29,30,30,29,30,30],
  [2040,31,31,32,31,31,31,30,29,30,29,30,30],
  [2041,31,31,32,32,31,30,30,29,30,29,30,30],
  [2042,31,32,31,32,31,30,30,30,29,29,30,31],
  [2043,31,31,31,32,31,31,29,30,30,29,30,30],
  [2044,31,31,32,31,31,31,30,29,30,29,30,30],
  [2045,31,32,31,32,31,30,30,29,30,29,30,30],
  [2046,31,32,31,32,31,30,30,30,29,29,30,31],
  [2047,31,31,31,32,31,31,30,29,30,29,30,30],
  [2048,31,31,32,31,31,31,30,29,30,29,30,30],
  [2049,31,32,31,32,31,30,30,30,29,29,30,30],
  [2050,31,32,31,32,31,30,30,30,29,30,29,31],
  [2051,31,31,31,32,31,31,30,29,30,29,30,30],
  [2052,31,31,32,31,31,31,30,29,30,29,30,30],
  [2053,31,32,31,32,31,30,30,30,29,29,30,30],
  [2054,31,32,31,32,31,30,30,30,29,30,29,31],
  [2055,31,31,32,31,31,31,30,29,30,29,30,30],
  [2056,31,31,32,31,32,30,30,29,30,29,30,30],
  [2057,31,32,31,32,31,30,30,30,29,29,30,31],
  [2058,30,32,31,32,31,30,30,30,29,30,29,31],
  [2059,31,31,32,31,31,31,30,29,30,29,30,30],
  [2060,31,31,32,32,31,30,30,29,30,29,30,30],
  [2061,31,32,31,32,31,30,30,30,29,29,30,31],
  [2062,30,32,31,32,31,31,29,30,29,30,29,31],
  [2063,31,31,32,31,31,31,30,29,30,29,30,30],
  [2064,31,31,32,32,31,30,30,29,30,29,30,30],
  [2065,31,32,31,32,31,30,30,30,29,29,30,31],
  [2066,31,31,31,32,31,31,29,30,30,29,29,31],
  [2067,31,31,32,31,31,31,30,29,30,29,30,30],
  [2068,31,31,32,32,31,30,30,29,30,29,30,30],
  [2069,31,32,31,32,31,30,30,30,29,29,30,31],
  [2070,31,31,31,32,31,31,29,30,30,29,30,30],
  [2071,31,31,32,31,31,31,30,29,30,29,30,30],
  [2072,31,32,31,32,31,30,30,29,30,29,30,30],
  [2073,31,32,31,32,31,30,30,30,29,29,30,31],
  [2074,31,31,31,32,31,31,30,29,30,29,30,30],
  [2075,31,31,32,31,31,31,30,29,30,29,30,30],
  [2076,31,32,31,32,31,30,30,30,29,29,30,30],
  [2077,31,32,31,32,31,30,30,30,29,30,29,31],
  [2078,31,31,31,32,31,31,30,29,30,29,30,30],
  [2079,31,31,32,31,31,31,30,29,30,29,30,30],
  [2080,31,32,31,32,31,30,30,30,29,29,30,30],
  [2081,31,32,31,32,31,30,30,30,29,30,29,31],
  [2082,31,31,32,31,31,31,30,29,30,29,30,30],
  [2083,31,31,32,31,31,31,30,29,30,29,30,30],
  [2084,31,32,31,32,31,30,30,30,29,29,30,31],
  [2085,30,32,31,32,31,30,30,30,29,30,29,31],
  [2086,31,31,32,31,31,31,30,29,30,29,30,30],
  [2087,31,31,32,32,31,30,30,29,30,29,30,30],
  [2088,31,32,31,32,31,30,30,30,29,29,30,31],
  [2089,30,32,31,32,31,31,29,30,29,30,29,31],
  [2090,31,31,32,31,31,31,30,29,30,29,30,30],
  [2091,31,31,32,32,31,30,30,29,30,29,30,30],
  [2092,31,32,31,32,31,30,30,30,29,29,30,31],
  [2093,31,31,31,32,31,31,29,30,30,29,30,30],
  [2094,31,31,32,31,31,31,30,29,30,29,30,30],
  [2095,31,31,32,32,31,30,30,29,30,29,30,30],
  [2096,31,32,31,32,31,30,30,30,29,29,30,31],
  [2097,31,31,31,32,31,31,29,30,30,29,30,30],
  [2098,31,31,32,31,31,31,30,29,30,29,30,30],
  [2099,31,31,32,32,31,30,30,29,30,29,30,30]
];

const BS_MONTHS = ['Baisakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];

function adToBS(adYear, adMonth, adDay) {
  // Reference: 2000-01-01 BS = 1943-04-14 AD
  const refAD = new Date(1943, 3, 14);
  const target = new Date(adYear, adMonth - 1, adDay);
  let totalDays = Math.floor((target - refAD) / 86400000);
  if (totalDays < 0) return null;

  let bsY = 2000, bsM = 0, bsD = 1;

  for (const row of BS_CALENDAR) {
    const year = row[0];
    let yearDays = 0;
    for (let m = 1; m <= 12; m++) yearDays += row[m];
    if (totalDays < yearDays) {
      bsY = year;
      for (let m = 1; m <= 12; m++) {
        if (totalDays < row[m]) {
          bsM = m;
          bsD = totalDays + 1;
          break;
        }
        totalDays -= row[m];
      }
      break;
    }
    totalDays -= yearDays;
  }

  return { year: bsY, month: bsM, day: bsD, monthName: BS_MONTHS[bsM - 1] || '' };
}

function updateNepaliDate() {
  const el = document.getElementById('nepali-date-text');
  if (!el) return;
  const now = new Date();
  const bs = adToBS(now.getFullYear(), now.getMonth() + 1, now.getDate());
  if (bs) {
    const dd = String(bs.day).padStart(2, '0');
    const mm = String(bs.month).padStart(2, '0');
    el.textContent = `${bs.year}-${mm}-${dd} ${bs.monthName} (BS)`;
  } else {
    el.textContent = 'Date unavailable';
  }
}

updateNepaliDate();

// ============================================================
// TO-DO SECTION DUAL DATE HEADER
// ============================================================
function renderTodoDualDate() {
  const el = document.getElementById('todo-dual-date');
  if (!el) return;
  const now = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayName = dayNames[now.getDay()];
  const enDate = `${dayName}, ${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  const bs = adToBS(now.getFullYear(), now.getMonth() + 1, now.getDate());
  let bsDate = '';
  if (bs) {
    bsDate = `${dayName}, ${bs.monthName} ${bs.day}, ${bs.year}`;
  }
  el.innerHTML = `<span class="dual-date-en"><i class="fas fa-calendar"></i> ${escapeHTML(enDate)}</span>${bsDate ? `<span class="dual-date-bs"><i class="fas fa-calendar-alt"></i> ${escapeHTML(bsDate)} (BS)</span>` : ''}`;
}

// ============================================================
// TO-DO CRUD & RENDER
// ============================================================
function isOverdue(todo) {
  if (todo.done || !todo.due) return false;
  const today = new Date().toISOString().slice(0, 10);
  return todo.due < today;
}

function formatDualDate(dueDateStr) {
  if (!dueDateStr) return '';
  const d = new Date(dueDateStr + 'T00:00:00');
  if (isNaN(d)) return escapeHTML(dueDateStr);
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayName = dayNames[d.getDay()];
  const enStr = `${dayName}, ${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const bs = adToBS(d.getFullYear(), d.getMonth() + 1, d.getDate());
  let bsStr = '';
  if (bs) {
    bsStr = `${dayName}, ${bs.monthName} ${bs.day}, ${bs.year}`;
  }
  return `<span class="todo-date-en">${escapeHTML(enStr)}</span>${bsStr ? `<span class="todo-date-bs">${escapeHTML(bsStr)} (BS)</span>` : ''}`;
}

function renderTodoItem(todo, idx, compact = false) {
  const overdue = isOverdue(todo);
  const cls = `dash-todo-item${todo.done ? ' completed' : ''}${overdue ? ' overdue' : ''}`;
  const dualDate = todo.due ? formatDualDate(todo.due) : '';
  return `
    <div class="${cls}" data-idx="${idx}">
      <input type="checkbox" class="todo-checkbox" ${todo.done ? 'checked' : ''} onchange="window.datadock.toggleTodo(${idx})" />
      <div class="todo-content">
        <span class="todo-text">${escapeHTML(todo.text)}</span>
        ${dualDate ? `<div class="todo-dual-date">${dualDate}</div>` : ''}
      </div>
      <span class="todo-priority ${escapeHTML(todo.priority || 'medium')}">${escapeHTML(todo.priority || 'medium')}</span>
      <div class="todo-actions">
        <button class="btn-icon" title="Edit" onclick="window.datadock.editTodo(${idx})"><i class="fas fa-pen"></i></button>
        <button class="btn-icon danger" title="Delete" onclick="window.datadock.confirmDelete('todo', ${idx})"><i class="fas fa-trash-alt"></i></button>
      </div>
    </div>
  `;
}

function renderTodos(filterText = '') {
  const list = document.getElementById('todos-list');
  const empty = document.getElementById('todos-empty');
  const filtered = filterText
    ? userData.todos.filter(t => matchesSearch(t, filterText))
    : userData.todos;

  if (userData.todos.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  // Sort: incomplete first, then by priority weight, then by due date
  const priority = { high: 0, medium: 1, low: 2 };
  const sorted = [...filtered].map((t, i) => ({ ...t, _idx: userData.todos.indexOf(t) }));
  sorted.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (priority[a.priority] || 1) - (priority[b.priority] || 1);
  });
  list.innerHTML = sorted.map(t => renderTodoItem(t, t._idx)).join('');
}

function renderDashTodos() {
  const el = document.getElementById('dash-todo-list');
  if (!el) return;
  const pending = userData.todos.filter(t => !t.done).slice(0, 5);
  if (!pending.length) {
    el.innerHTML = '<p class="dash-empty-msg"><i class="fas fa-check-circle"></i> No pending tasks. You\'re all caught up!</p>';
    return;
  }
  el.innerHTML = pending.map(t => {
    const idx = userData.todos.indexOf(t);
    return renderTodoItem(t, idx, true);
  }).join('');
}

function openTodoModal(index = -1) {
  const form = document.getElementById('todo-form');
  form.reset();
  document.getElementById('todo-edit-index').value = index;
  document.getElementById('todo-modal-title').textContent = index >= 0 ? 'Edit Task' : 'Add Task';

  if (index >= 0) {
    const t = userData.todos[index];
    document.getElementById('todo-text').value = t.text || '';
    document.getElementById('todo-priority').value = t.priority || 'medium';
    document.getElementById('todo-due').value = t.due || '';
  }
  openModal('todo-modal');
}

document.getElementById('todo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const index = parseInt(document.getElementById('todo-edit-index').value);
  const todo = {
    text: document.getElementById('todo-text').value.trim(),
    priority: document.getElementById('todo-priority').value,
    due: document.getElementById('todo-due').value || null,
    done: index >= 0 ? (userData.todos[index]?.done || false) : false,
    createdAt: index >= 0 ? (userData.todos[index]?.createdAt || new Date().toISOString()) : new Date().toISOString()
  };

  try {
    if (index >= 0) {
      userData.todos = await updateTodo(currentUser.uid, index, todo, userData.todos);
      showToast('Task updated!', 'success');
    } else {
      userData.todos = await addTodo(currentUser.uid, todo, userData.todos);
      showToast('Task added!', 'success');
    }
    cacheData(userData);
    renderAll();
    closeModal('todo-modal');
  } catch (err) {
    showToast('Failed to save task.', 'error');
  }
});

async function toggleTodo(index) {
  const todo = { ...userData.todos[index], done: !userData.todos[index].done };
  try {
    userData.todos = await updateTodo(currentUser.uid, index, todo, userData.todos);
    cacheData(userData);
    renderAll();
    showToast(todo.done ? 'Task completed!' : 'Task reopened.', 'info');
  } catch (err) {
    showToast('Failed to update task.', 'error');
  }
}

// ============================================================
// API KEYS CRUD & RENDER
// ============================================================
function renderApikeys(filterText = '') {
  const list = document.getElementById('apikeys-list');
  const empty = document.getElementById('apikeys-empty');
  const filtered = filterText
    ? userData.apikeys.filter(k => matchesSearch(k, filterText))
    : userData.apikeys;

  if (userData.apikeys.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = filtered.map((key, idx) => {
    const originalIdx = userData.apikeys.indexOf(key);
    const masked = '•'.repeat(Math.min(key.value?.length || 16, 32));
    return `
      <div class="apikey-card">
        <div class="card-header">
          <div class="card-header-info">
            <h3><i class="fas fa-key" style="color:var(--neon-purple);margin-right:6px;"></i>${escapeHTML(key.label)}</h3>
            ${key.category ? `<span class="apikey-category">${escapeHTML(key.category)}</span>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-icon" title="View as text" onclick="window.datadock.viewApikey(${originalIdx})"><i class="fas fa-eye"></i></button>
            <button class="btn-icon" title="Edit" onclick="window.datadock.editApikey(${originalIdx})"><i class="fas fa-pen"></i></button>
            <button class="btn-icon danger" title="Delete" onclick="window.datadock.confirmDelete('apikey', ${originalIdx})"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
        <div class="apikey-value-row">
          <span class="apikey-masked" id="apikey-val-${originalIdx}">${masked}</span>
          <button class="btn-icon" title="Reveal" onclick="window.datadock.toggleReveal(${originalIdx})"><i class="fas fa-eye"></i></button>
          <button class="btn-icon" title="Copy" onclick="window.datadock.copyApikey(${originalIdx})"><i class="fas fa-copy"></i></button>
        </div>
        <div class="reveal-warning" id="apikey-warn-${originalIdx}">
          <i class="fas fa-exclamation-triangle"></i> Sensitive data revealed — hide when done.
        </div>
        ${key.notes ? `<div class="card-notes">${escapeHTML(key.notes)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function openApikeyModal(index = -1) {
  const form = document.getElementById('apikey-form');
  form.reset();
  document.getElementById('apikey-edit-index').value = index;
  document.getElementById('apikey-modal-title').textContent = index >= 0 ? 'Edit Entry' : 'Add API Key / Password';
  document.getElementById('apikey-value').type = 'password';

  if (index >= 0) {
    const k = userData.apikeys[index];
    document.getElementById('apikey-label').value = k.label || '';
    document.getElementById('apikey-value').value = k.value || '';
    document.getElementById('apikey-category').value = k.category || '';
    document.getElementById('apikey-notes').value = k.notes || '';
  }
  openModal('apikey-modal');
}

document.getElementById('apikey-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const index = parseInt(document.getElementById('apikey-edit-index').value);
  const entry = {
    label: document.getElementById('apikey-label').value.trim(),
    value: document.getElementById('apikey-value').value,
    category: document.getElementById('apikey-category').value.trim(),
    notes: document.getElementById('apikey-notes').value.trim()
  };

  try {
    if (index >= 0) {
      userData.apikeys = await updateApikey(currentUser.uid, index, entry, userData.apikeys);
      showToast('Entry updated!', 'success');
    } else {
      userData.apikeys = await addApikey(currentUser.uid, entry, userData.apikeys);
      showToast('Entry added!', 'success');
    }
    cacheData(userData);
    renderAll();
    closeModal('apikey-modal');
  } catch (err) {
    showToast('Failed to save entry.', 'error');
  }
});

function toggleReveal(index) {
  const el = document.getElementById(`apikey-val-${index}`);
  const warn = document.getElementById(`apikey-warn-${index}`);
  if (!el) return;
  if (el.classList.contains('revealed')) {
    el.textContent = '•'.repeat(Math.min(userData.apikeys[index].value?.length || 16, 32));
    el.classList.remove('revealed');
    if (warn) warn.classList.remove('visible');
  } else {
    el.textContent = userData.apikeys[index].value || '';
    el.classList.add('revealed');
    if (warn) warn.classList.add('visible');
  }
}

async function copyApikey(index) {
  const val = userData.apikeys[index]?.value || '';
  await copyText(val);
}

// ============================================================
// NOTES CRUD & RENDER
// ============================================================
function formatNoteContent(text) {
  if (!text) return '';
  // Sanitize then apply markup: **bold**, *italic*, `code`
  let safe = escapeHTML(text);
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
  safe = safe.replace(/`(.+?)`/g, '<code>$1</code>');
  return safe;
}

function renderNotes(filterText = '') {
  const list = document.getElementById('notes-list');
  const empty = document.getElementById('notes-empty');
  const filtered = filterText
    ? userData.notes.filter(n => matchesSearch(n, filterText))
    : userData.notes;

  if (userData.notes.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = filtered.map((note, idx) => {
    const originalIdx = userData.notes.indexOf(note);
    return `
      <div class="note-card">
        <div class="card-header">
          <div class="card-header-info">
            <h3><i class="fas fa-sticky-note" style="color:var(--neon-magenta);margin-right:6px;"></i>${escapeHTML(note.title)}</h3>
            ${note.tag ? `<span class="note-tag">${escapeHTML(note.tag)}</span>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-icon" title="View as text" onclick="window.datadock.viewNote(${originalIdx})"><i class="fas fa-eye"></i></button>
            <button class="btn-icon" title="Edit" onclick="window.datadock.editNote(${originalIdx})"><i class="fas fa-pen"></i></button>
            <button class="btn-icon danger" title="Delete" onclick="window.datadock.confirmDelete('note', ${originalIdx})"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
        <div class="note-body-preview">${formatNoteContent(note.body)}</div>
      </div>
    `;
  }).join('');
}

function openNoteModal(index = -1) {
  const form = document.getElementById('note-form');
  form.reset();
  document.getElementById('note-edit-index').value = index;
  document.getElementById('note-modal-title').textContent = index >= 0 ? 'Edit Note' : 'Add Note';

  if (index >= 0) {
    const n = userData.notes[index];
    document.getElementById('note-title').value = n.title || '';
    document.getElementById('note-body').value = n.body || '';
    document.getElementById('note-tag').value = n.tag || '';
  }
  openModal('note-modal');
}

document.getElementById('note-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const index = parseInt(document.getElementById('note-edit-index').value);
  const note = {
    title: document.getElementById('note-title').value.trim(),
    body: document.getElementById('note-body').value.trim(),
    tag: document.getElementById('note-tag').value.trim(),
    createdAt: index >= 0 ? (userData.notes[index]?.createdAt || new Date().toISOString()) : new Date().toISOString()
  };

  try {
    if (index >= 0) {
      userData.notes = await updateNote(currentUser.uid, index, note, userData.notes);
      showToast('Note updated!', 'success');
    } else {
      userData.notes = await addNote(currentUser.uid, note, userData.notes);
      showToast('Note added!', 'success');
    }
    cacheData(userData);
    renderAll();
    closeModal('note-modal');
  } catch (err) {
    showToast('Failed to save note.', 'error');
  }
});

// Note formatting toolbar
document.querySelectorAll('.note-fmt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const textarea = document.getElementById('note-body');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const fmt = btn.getAttribute('data-fmt');
    let wrap = '';
    if (fmt === 'bold') wrap = `**${selected || 'bold text'}**`;
    else if (fmt === 'italic') wrap = `*${selected || 'italic text'}*`;
    else if (fmt === 'code') wrap = '`' + (selected || 'code') + '`';
    textarea.setRangeText(wrap, start, end, 'end');
    textarea.focus();
  });
});

// ============================================================
// NEPALI CALENDAR — FULL MONTHLY GRID
// ============================================================
let calendarState = { year: 2081, month: 1, selectedDate: null };

// Initialize calendar to today's BS date
(function initCalendarState() {
  const now = new Date();
  const bs = adToBS(now.getFullYear(), now.getMonth() + 1, now.getDate());
  if (bs) {
    calendarState.year = bs.year;
    calendarState.month = bs.month;
  }
})();

// Reverse conversion: BS to AD
function bsToAD(bsYear, bsMonth, bsDay) {
  // Reference: 2000-01-01 BS = 1943-04-14 AD
  const refAD = new Date(1943, 3, 14); // April 14, 1943
  let totalDays = 0;

  for (const row of BS_CALENDAR) {
    if (row[0] === bsYear) {
      for (let m = 1; m < bsMonth; m++) totalDays += row[m];
      totalDays += bsDay - 1;
      break;
    }
    for (let m = 1; m <= 12; m++) totalDays += row[m];
  }

  const result = new Date(refAD.getTime() + totalDays * 86400000);
  return result;
}

// Get the day of week for BS date (0=Sun, 6=Sat)
function getBSDayOfWeek(bsYear, bsMonth, bsDay) {
  const ad = bsToAD(bsYear, bsMonth, bsDay);
  return ad.getDay();
}

// Get days in a BS month
function getBSMonthDays(bsYear, bsMonth) {
  const row = BS_CALENDAR.find(r => r[0] === bsYear);
  return row ? row[bsMonth] : 30;
}

// Get today's BS date
function getTodayBS() {
  const now = new Date();
  return adToBS(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// Format BS date as YYYY-MM-DD
function formatBSDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Get events for a specific BS date
function getEventsForDate(bsDateStr) {
  return (userData.calendarEvents || []).filter(ev => ev.bsDate === bsDateStr);
}

// Get todos due on date (by converting BS to AD and matching due date)
function getTodosForBSDate(bsYear, bsMonth, bsDay) {
  const ad = bsToAD(bsYear, bsMonth, bsDay);
  const adStr = ad.toISOString().slice(0, 10);
  return userData.todos.filter(t => t.due === adStr);
}

// Get notes created on date
function getNotesForBSDate(bsYear, bsMonth, bsDay) {
  const ad = bsToAD(bsYear, bsMonth, bsDay);
  const adStr = ad.toISOString().slice(0, 10);
  return userData.notes.filter(n => n.createdAt && n.createdAt.slice(0, 10) === adStr);
}

function renderCalendar() {
  const daysContainer = document.getElementById('calendar-days');
  if (!daysContainer) return;

  const { year, month } = calendarState;

  // Check valid range
  const row = BS_CALENDAR.find(r => r[0] === year);
  if (!row) {
    daysContainer.innerHTML = '<p class="text-muted" style="grid-column:1/-1;text-align:center;">Year not in calendar data range (2000-2099 BS)</p>';
    return;
  }

  // Update header
  document.getElementById('calendar-month-name').textContent = BS_MONTHS[month - 1];
  document.getElementById('calendar-year').textContent = year;

  const totalDays = getBSMonthDays(year, month);
  const startDow = getBSDayOfWeek(year, month, 1);
  const today = getTodayBS();

  let html = '';

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  // Day cells
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = formatBSDate(year, month, d);
    const isToday = today && today.year === year && today.month === month && today.day === d;
    const isSelected = calendarState.selectedDate === dateStr;
    const events = getEventsForDate(dateStr);
    const todos = getTodosForBSDate(year, month, d);
    const isSunday = (startDow + d - 1) % 7 === 0;
    const isSaturday = (startDow + d - 1) % 7 === 6;

    let classes = 'calendar-day';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';
    if (isSunday) classes += ' sunday';
    if (isSaturday) classes += ' saturday';

    // Event dots
    let dotsHtml = '';
    if (events.length || todos.length) {
      dotsHtml = '<div class="calendar-day-dots">';
      events.forEach(ev => {
        const colorVar = `var(--neon-${ev.color || 'green'})`;
        dotsHtml += `<span class="calendar-dot" style="background:${colorVar}"></span>`;
      });
      todos.forEach(() => {
        dotsHtml += '<span class="calendar-dot" style="background:var(--neon-cyan)"></span>';
      });
      dotsHtml += '</div>';
    }

    html += `<div class="${classes}" data-date="${dateStr}" onclick="window.datadock.selectCalendarDate('${dateStr}')">${d}${dotsHtml}</div>`;
  }

  daysContainer.innerHTML = html;
}

function selectCalendarDate(dateStr) {
  calendarState.selectedDate = dateStr;
  renderCalendar();
  renderCalendarDetail(dateStr);
}

function renderCalendarDetail(dateStr) {
  const panel = document.getElementById('calendar-detail-panel');
  if (!panel) return;

  // Parse BS date
  const parts = dateStr.split('-');
  const bsY = parseInt(parts[0]), bsM = parseInt(parts[1]), bsD = parseInt(parts[2]);
  const ad = bsToAD(bsY, bsM, bsD);
  const adStr = ad.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  document.getElementById('calendar-detail-date').textContent = `${bsD} ${BS_MONTHS[bsM - 1]} ${bsY}`;
  document.getElementById('calendar-detail-ad').textContent = adStr;

  // Events
  const eventsEl = document.getElementById('calendar-detail-events');
  const events = getEventsForDate(dateStr);
  if (events.length) {
    eventsEl.innerHTML = events.map((ev, i) => {
      const idx = userData.calendarEvents.indexOf(ev);
      const colorVar = `var(--neon-${ev.color || 'green'})`;
      return `<div class="calendar-event-item" style="border-left-color:${colorVar}">
        <div class="calendar-event-title">${escapeHTML(ev.title)}</div>
        ${ev.notes ? `<div class="calendar-event-notes">${escapeHTML(ev.notes)}</div>` : ''}
        <div class="calendar-event-actions">
          <button class="btn-icon" title="Edit" onclick="window.datadock.editCalendarEvent(${idx})"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" title="Delete" onclick="window.datadock.confirmDelete('calendarEvent', ${idx})"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`;
    }).join('');
  } else {
    eventsEl.innerHTML = '<p class="text-muted">No events for this date.</p>';
  }

  // Todos due
  const todosEl = document.getElementById('calendar-detail-todos');
  const todos = getTodosForBSDate(bsY, bsM, bsD);
  if (todos.length) {
    todosEl.innerHTML = todos.map(t => {
      const idx = userData.todos.indexOf(t);
      return `<div class="calendar-detail-todo ${t.done ? 'completed' : ''}">
        <input type="checkbox" class="todo-checkbox" ${t.done ? 'checked' : ''} onchange="window.datadock.toggleTodo(${idx})" />
        <span class="todo-text">${escapeHTML(t.text)}</span>
        <span class="todo-priority ${escapeHTML(t.priority || 'medium')}">${escapeHTML(t.priority || 'medium')}</span>
      </div>`;
    }).join('');
  } else {
    todosEl.innerHTML = '<p class="text-muted">No tasks due.</p>';
  }

  // Notes
  const notesEl = document.getElementById('calendar-detail-notes');
  const notes = getNotesForBSDate(bsY, bsM, bsD);
  if (notes.length) {
    notesEl.innerHTML = notes.map(n => {
      const idx = userData.notes.indexOf(n);
      return `<div class="calendar-detail-note" onclick="window.datadock.editNote(${idx})">
        <i class="fas fa-sticky-note" style="color:var(--neon-magenta);margin-right:6px;"></i>
        <span>${escapeHTML(n.title)}</span>
      </div>`;
    }).join('');
  } else {
    notesEl.innerHTML = '<p class="text-muted">No notes for this date.</p>';
  }
}

function navigateCalendar(dir) {
  calendarState.month += dir;
  if (calendarState.month > 12) { calendarState.month = 1; calendarState.year++; }
  if (calendarState.month < 1) { calendarState.month = 12; calendarState.year--; }
  calendarState.selectedDate = null;
  renderCalendar();
}

function navigateCalendarYear(dir) {
  calendarState.year += dir;
  calendarState.selectedDate = null;
  renderCalendar();
}

function goToTodayCalendar() {
  const today = getTodayBS();
  if (today) {
    calendarState.year = today.year;
    calendarState.month = today.month;
    calendarState.selectedDate = formatBSDate(today.year, today.month, today.day);
    renderCalendar();
    renderCalendarDetail(calendarState.selectedDate);
  }
}

// Calendar event modal
function openCalendarEventModal(index = -1, presetDate = null) {
  const form = document.getElementById('calendar-event-form');
  form.reset();
  document.getElementById('calendar-event-edit-index').value = index;
  document.getElementById('calendar-event-modal-title').textContent = index >= 0 ? 'Edit Event' : 'Add Event';

  if (index >= 0) {
    const ev = userData.calendarEvents[index];
    document.getElementById('calendar-event-title').value = ev.title || '';
    document.getElementById('calendar-event-bs-date').value = ev.bsDate || '';
    document.getElementById('calendar-event-color').value = ev.color || 'green';
    document.getElementById('calendar-event-notes').value = ev.notes || '';
  } else if (presetDate) {
    document.getElementById('calendar-event-bs-date').value = presetDate;
  } else if (calendarState.selectedDate) {
    document.getElementById('calendar-event-bs-date').value = calendarState.selectedDate;
  }
  openModal('calendar-event-modal');
}

document.getElementById('calendar-event-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const index = parseInt(document.getElementById('calendar-event-edit-index').value);
  const event = {
    title: document.getElementById('calendar-event-title').value.trim(),
    bsDate: document.getElementById('calendar-event-bs-date').value.trim(),
    color: document.getElementById('calendar-event-color').value,
    notes: document.getElementById('calendar-event-notes').value.trim(),
    createdAt: index >= 0 ? (userData.calendarEvents[index]?.createdAt || new Date().toISOString()) : new Date().toISOString()
  };

  try {
    if (index >= 0) {
      userData.calendarEvents = await updateCalendarEvent(currentUser.uid, index, event, userData.calendarEvents);
      showToast('Event updated!', 'success');
    } else {
      userData.calendarEvents = await addCalendarEvent(currentUser.uid, event, userData.calendarEvents);
      showToast('Event added!', 'success');
    }
    cacheData(userData);
    renderAll();
    if (calendarState.selectedDate) renderCalendarDetail(calendarState.selectedDate);
    closeModal('calendar-event-modal');
  } catch (err) {
    showToast('Failed to save event.', 'error');
  }
});

// ============================================================
// DASHBOARD CALENDAR WIDGET
// ============================================================
let dashCalState = { year: 0, month: 0 };

(function initDashCalState() {
  const now = new Date();
  const bs = adToBS(now.getFullYear(), now.getMonth() + 1, now.getDate());
  if (bs) {
    dashCalState.year = bs.year;
    dashCalState.month = bs.month;
  }
})();

function renderDashCalendar() {
  const daysContainer = document.getElementById('dash-cal-days');
  const label = document.getElementById('dash-cal-month-label');
  if (!daysContainer || !label) return;

  const { year, month } = dashCalState;
  const row = BS_CALENDAR.find(r => r[0] === year);
  if (!row) {
    daysContainer.innerHTML = '<span style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:0.75rem;">Year out of range</span>';
    return;
  }

  label.textContent = `${BS_MONTHS[month - 1]} ${year}`;
  const totalDays = getBSMonthDays(year, month);
  const startDow = getBSDayOfWeek(year, month, 1);
  const today = getTodayBS();

  let html = '';
  for (let i = 0; i < startDow; i++) {
    html += '<span class="dash-cal-day empty"></span>';
  }
  for (let d = 1; d <= totalDays; d++) {
    const isToday = today && today.year === year && today.month === month && today.day === d;
    const isSun = (startDow + d - 1) % 7 === 0;
    const isSat = (startDow + d - 1) % 7 === 6;
    const dateStr = formatBSDate(year, month, d);
    const hasEvents = getEventsForDate(dateStr).length > 0;
    const hasTodos = getTodosForBSDate(year, month, d).length > 0;

    let cls = 'dash-cal-day';
    if (isToday) cls += ' today';
    if (isSun) cls += ' sun';
    if (isSat) cls += ' sat';
    if (hasEvents || hasTodos) cls += ' has-events';

    html += `<span class="${cls}">${d}</span>`;
  }
  daysContainer.innerHTML = html;
}

function navigateDashCalendar(dir) {
  dashCalState.month += dir;
  if (dashCalState.month > 12) { dashCalState.month = 1; dashCalState.year++; }
  if (dashCalState.month < 1) { dashCalState.month = 12; dashCalState.year--; }
  renderDashCalendar();
}

document.getElementById('dash-cal-prev')?.addEventListener('click', () => navigateDashCalendar(-1));
document.getElementById('dash-cal-next')?.addEventListener('click', () => navigateDashCalendar(1));

// Calendar navigation buttons
document.getElementById('calendar-prev-month').addEventListener('click', () => navigateCalendar(-1));
document.getElementById('calendar-next-month').addEventListener('click', () => navigateCalendar(1));
document.getElementById('calendar-prev-year').addEventListener('click', () => navigateCalendarYear(-1));
document.getElementById('calendar-next-year').addEventListener('click', () => navigateCalendarYear(1));
document.getElementById('calendar-today-btn').addEventListener('click', goToTodayCalendar);
document.getElementById('add-calendar-event-btn').addEventListener('click', () => openCalendarEventModal());
document.getElementById('calendar-add-event-for-date').addEventListener('click', () => {
  openCalendarEventModal(-1, calendarState.selectedDate);
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
    { title: "Go: To-Do", meta: "Navigation", run: () => gotoSection("todos") },
    { title: "Go: API Keys", meta: "Navigation", run: () => gotoSection("apikeys") },
    { title: "Go: Notes", meta: "Navigation", run: () => gotoSection("notes") },
    { title: "Go: Calendar", meta: "Navigation", run: () => gotoSection("calendar") },
    { title: "Go: Settings", meta: "Navigation", run: () => gotoSection("settings") },
    { title: "Add Contact", meta: "Quick Add", run: () => { gotoSection("contacts"); openContactModal(); } },
    { title: "Add Team", meta: "Quick Add", run: () => { gotoSection("teams"); openTeamModal(); } },
    { title: "Add Link", meta: "Quick Add", run: () => { gotoSection("links"); openLinkModal(); } },
    { title: "Add Task", meta: "Quick Add", run: () => { gotoSection("todos"); openTodoModal(); } },
    { title: "Add API Key", meta: "Quick Add", run: () => { gotoSection("apikeys"); openApikeyModal(); } },
    { title: "Add Note", meta: "Quick Add", run: () => { gotoSection("notes"); openNoteModal(); } },
    { title: "Add Calendar Event", meta: "Quick Add", run: () => { gotoSection("calendar"); openCalendarEventModal(); } },
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
    { title: "Clear Terminal", meta: "Tools", run: () => { const b = document.getElementById('terminal-body'); if (b) b.innerHTML = ''; } }
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
// BUTTON RIPPLE EFFECT
// ============================================================
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn, .action-btn, .quick-fab-main');
  if (!btn) return;
  const ripple = document.createElement('span');
  ripple.className = 'ripple-effect';
  const rect = btn.getBoundingClientRect();
  ripple.style.left = (e.clientX - rect.left) + 'px';
  ripple.style.top = (e.clientY - rect.top) + 'px';
  btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

// Terminal clear button
const termClearBtn = document.getElementById('terminal-clear');
if (termClearBtn) {
  termClearBtn.addEventListener('click', () => {
    const body = document.getElementById('terminal-body');
    if (body) body.innerHTML = '<div class="terminal-line"><span class="terminal-prompt">&gt;</span> Console cleared.<span class="typewriter-cursor"></span></div>';
  });
}

// API key modal: toggle password visibility
document.querySelector('#apikey-modal .toggle-visibility')?.addEventListener('click', function() {
  const input = document.getElementById('apikey-value');
  const icon = this.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
});

// ============================================================
// EXPOSE FUNCTIONS TO WINDOW (for inline onclick handlers)
// ============================================================
window.datadock = {
  viewContact,
  viewTeam,
  viewLink,
  viewApikey,
  viewNote,
  copyContactAll,
  copyViewAll,
  editContact: openContactModal,
  editTeam: openTeamModal,
  editLink: openLinkModal,
  editTodo: openTodoModal,
  editApikey: openApikeyModal,
  editNote: openNoteModal,
  editCalendarEvent: openCalendarEventModal,
  selectCalendarDate,
  toggleTodo,
  toggleReveal,
  copyApikey,
  confirmDelete,
  copyText
};
