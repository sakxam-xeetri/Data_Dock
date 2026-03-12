// ============================================================
// DataDock — Firebase Configuration (Shared Module)
// ============================================================
// Replace the placeholder values below with your Firebase project config.
// Get these from: Firebase Console → Project Settings → General → Your apps

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCOUDeZQRR0sPa3qZ6G0LIHjDeztzdV0Cs",
  authDomain: "datadock-1ef02.firebaseapp.com",
  projectId: "datadock-1ef02",
  storageBucket: "datadock-1ef02.firebasestorage.app",
  messagingSenderId: "1070290907423",
  appId: "1:1070290907423:web:72c25f5140e2b2782cc02a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
