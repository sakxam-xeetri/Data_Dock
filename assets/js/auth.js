// ============================================================
// DataDock — Authentication Logic
// ============================================================

import { auth, db, googleProvider } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Utility: Toast ----------
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const icons = { success: "fa-check-circle", error: "fa-exclamation-circle", warning: "fa-exclamation-triangle", info: "fa-info-circle" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ---------- Utility: Loading ----------
function showLoading() {
  const el = document.getElementById("loading-overlay");
  if (el) { el.classList.remove("hidden"); el.classList.remove("fade-out"); }
}

function hideLoading() {
  const el = document.getElementById("loading-overlay");
  if (el) { el.classList.add("fade-out"); setTimeout(() => el.classList.add("hidden"), 300); }
}

// ---------- Initialize empty workspace for new users ----------
async function initUserWorkspace(uid) {
  const userRef = doc(db, "users", uid);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) {
    await setDoc(userRef, { contacts: [], teams: [], links: [] });
  }
}

// ---------- Tab Switching ----------
document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach((f) => f.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.getAttribute("data-tab");
    document.getElementById(`${target}-form`).classList.add("active");
  });
});

// ---------- Email/Password Signup ----------
document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const confirm = document.getElementById("signup-confirm").value;

  if (password !== confirm) {
    showToast("Passwords do not match.", "error");
    return;
  }

  showLoading();
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await initUserWorkspace(cred.user.uid);
    showToast("Account created successfully!", "success");
    // onAuthStateChanged will handle redirect
  } catch (err) {
    hideLoading();
    showToast(getFirebaseErrorMessage(err.code), "error");
  }
});

// ---------- Email/Password Login ----------
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  showLoading();
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("Logged in successfully!", "success");
  } catch (err) {
    hideLoading();
    showToast(getFirebaseErrorMessage(err.code), "error");
  }
});

// ---------- Handle redirect result (Google redirect flow) ----------
(async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      showLoading();
      await initUserWorkspace(result.user.uid);
      showToast("Logged in with Google!", "success");
      // onAuthStateChanged will redirect
    }
  } catch (err) {
    showToast(getFirebaseErrorMessage(err.code), "error");
  }
})();

// ---------- Google Login ----------
document.getElementById("google-login-btn").addEventListener("click", async () => {
  showLoading();
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await initUserWorkspace(result.user.uid);
    showToast("Logged in with Google!", "success");
  } catch (err) {
    hideLoading();
    if (err.code === "auth/popup-blocked" || err.code === "auth/popup-cancelled-by-user") {
      // Popup was blocked — fall back to redirect flow
      showToast("Popup blocked. Redirecting...", "info");
      setTimeout(() => signInWithRedirect(auth, googleProvider), 800);
    } else if (err.code !== "auth/popup-closed-by-user") {
      showToast(getFirebaseErrorMessage(err.code), "error");
    }
  }
});

// ---------- Auth State Observer ----------
onAuthStateChanged(auth, (user) => {
  hideLoading();
  if (user) {
    window.location.href = "dashboard.html";
  }
});

// ---------- Firebase Error Messages ----------
function getFirebaseErrorMessage(code) {
  const messages = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email": "Invalid email format.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/popup-blocked": "Popup was blocked. Please allow popups for this site.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/unauthorized-domain": "This domain is not authorized in Firebase. Go to Firebase Console → Authentication → Settings → Authorized domains and add your domain.",
    "auth/cancelled-popup-request": "Another sign-in is already in progress.",
    "auth/operation-not-allowed": "Google sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method."
  };
  return messages[code] || "An error occurred. Please try again.";
}
