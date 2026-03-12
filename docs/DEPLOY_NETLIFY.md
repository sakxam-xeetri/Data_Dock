# Deploying DataDock on Netlify with Google Authentication

This guide walks through deploying DataDock to Netlify and enabling Google sign-in via Firebase Authentication.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Step 1 — Prepare the Repository](#2-step-1--prepare-the-repository)
3. [Step 2 — Deploy to Netlify](#3-step-2--deploy-to-netlify)
4. [Step 3 — Enable Google Authentication in Firebase](#4-step-3--enable-google-authentication-in-firebase)
5. [Step 4 — Add Netlify Domain to Firebase](#5-step-4--add-netlify-domain-to-firebase)
6. [Step 5 — Add a Netlify Redirect Rule](#6-step-5--add-a-netlify-redirect-rule)
7. [Step 6 — Set a Custom Domain (Optional)](#7-step-6--set-a-custom-domain-optional)
8. [Step 7 — Restrict the Firebase API Key (Recommended)](#8-step-7--restrict-the-firebase-api-key-recommended)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

Before starting, make sure you have:

- A **GitHub account** with DataDock pushed to a repository
- A **Firebase project** with Authentication and Firestore already set up
  - If not, see the main [README](README.md#getting-started) for Firebase setup
- A **Netlify account** — sign up free at [netlify.com](https://www.netlify.com)

---

## 2. Step 1 — Prepare the Repository

DataDock is pure vanilla HTML/CSS/JS with no build step, so minimal preparation is needed.

### 2a. Add a `netlify.toml` config file

Create a file named `netlify.toml` in the **root** of your project:

```toml
[build]
  publish = "."

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**What this does:**
- `publish = "."` — tells Netlify to serve from the root directory (no build output folder)
- The redirect rule ensures refreshing any page (e.g. `/dashboard.html`) doesn't return a 404

### 2b. Verify your Firebase config

Open `assets/js/firebase-config.js` and confirm your real Firebase credentials are in place:

```js
const firebaseConfig = {
  apiKey:            "YOUR_REAL_API_KEY",
  authDomain:        "your-project-id.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project-id.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

> Do **not** commit `.env` files or secrets — Firebase web API keys are safe to be in client-side code. Your Firestore Rules enforce data security.

### 2c. Commit and push

```bash
git add netlify.toml
git commit -m "Add Netlify deployment config"
git push origin main
```

---

## 3. Step 2 — Deploy to Netlify

### Option A — Deploy from GitHub (Recommended)

1. Go to [app.netlify.com](https://app.netlify.com) and click **Add new site → Import an existing project**
2. Choose **GitHub** as your Git provider and authorize Netlify
3. Select your **DataDock repository**
4. Configure build settings:

   | Setting | Value |
   |---|---|
   | Branch to deploy | `main` |
   | Base directory | *(leave blank)* |
   | Build command | *(leave blank)* |
   | Publish directory | `.` |

5. Click **Deploy site**

Netlify will assign a random URL like `https://eloquent-einstein-abc123.netlify.app`.

---

### Option B — Drag and Drop (Quick Test)

1. In the Netlify dashboard, go to **Sites**
2. Drag and drop your entire `Data_Dock` project folder onto the deploy area
3. Netlify will instantly deploy and give you a URL

> Note: Drag-and-drop deploys are not connected to Git and won't auto-update on new commits.

---

## 4. Step 3 — Enable Google Authentication in Firebase

1. Go to [Firebase Console](https://console.firebase.google.com) → select your project
2. In the left sidebar click **Authentication → Sign-in method**
3. Click on **Google** in the provider list
4. Toggle **Enable** to ON
5. Set a **Project support email** (required by Google) — use your own email
6. Click **Save**

You should now see Google listed as an enabled sign-in provider.

> **What happens behind the scenes:** Firebase creates an OAuth 2.0 client ID in Google Cloud automatically. You do not need to configure anything in Google Cloud Console unless you want advanced settings.

---

## 5. Step 4 — Add Netlify Domain to Firebase

This is the most common step people miss. Firebase blocks Google sign-in popups from unauthorized domains.

1. In Firebase Console → **Authentication → Settings → Authorized domains**
2. Click **Add domain**
3. Enter your Netlify domain:
   ```
   eloquent-einstein-abc123.netlify.app
   ```
   Replace with your actual Netlify subdomain.
4. Click **Add**

If you later add a custom domain (e.g. `datadock.yourdomain.com`), repeat this step for that domain too.

---

## 6. Step 5 — Add a Netlify Redirect Rule

If you did not add `netlify.toml` in Step 1, you can add the redirect rule manually:

1. In Netlify dashboard → **Site configuration → Redirects**
2. Click **Add redirect rule**:

   | Field | Value |
   |---|---|
   | From | `/*` |
   | To | `/index.html` |
   | Status | `200` (Rewrite, not redirect) |

3. Save

---

## 7. Step 6 — Set a Custom Domain (Optional)

If you want `datadock.yourdomain.com` instead of the Netlify subdomain:

1. In Netlify → **Domain management → Add a domain**
2. Enter your domain name and follow the DNS instructions
3. Netlify will provision a free **SSL certificate** automatically via Let's Encrypt

Then go back to Firebase → Authentication → Authorized domains and also add your custom domain.

---

## 8. Step 7 — Restrict the Firebase API Key (Recommended)

While Firebase API keys are safe to expose, it is best practice to restrict them by allowed HTTP referrer so they cannot be misused from other domains.

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your Firebase project from the project dropdown
3. Navigate to **APIs & Services → Credentials**
4. Find the **API key** used by your Firebase web app (labeled "Browser key")
5. Click the key name → under **API restrictions** and **Application restrictions**:
   - Select **HTTP referrers (web sites)**
   - Add the following referrers:

     ```
     https://your-site.netlify.app/*
     https://datadock.yourdomain.com/*
     http://localhost:5500/*
     http://localhost:3000/*
     ```

6. Click **Save**

> Keep `localhost` entries during development. Remove them when going to production if you want strict lockdown.

---

## 9. Troubleshooting

### Google sign-in popup is blocked or fails immediately

**Cause:** The domain is not in Firebase's authorized domains list.

**Fix:** Go to Firebase Console → Authentication → Settings → Authorized domains → Add your Netlify URL (exactly as shown in the browser, no trailing slash).

---

### Sign-in opens but returns `auth/unauthorized-domain` error

**Cause:** The `authDomain` in `firebase-config.js` doesn't match or the domain isn't authorized.

**Fix:**
1. Confirm `authDomain` in `firebase-config.js` is `your-project-id.firebaseapp.com`
2. Confirm the Netlify domain is in Firebase's authorized domains list

---

### Page refreshes return 404

**Cause:** Netlify doesn't know to serve `index.html` for unknown paths.

**Fix:** Ensure `netlify.toml` is in the project root with the redirect rule from Step 1. Redeploy after adding it.

---

### Data loads on login but Firestore writes fail

**Cause:** Firestore security rules are missing or incorrect.

**Fix:** In Firebase Console → Firestore → Rules, apply these rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

---

### Google login works locally but fails on Netlify

**Cause:** The Netlify domain was not added to Firebase authorized domains.

**Fix:** Re-do [Step 4](#5-step-4--add-netlify-domain-to-firebase). The domain must be exact — check that you're using `https://` not `http://` and there is no trailing slash.

---

### Netlify deploy shows "Page not found" for all pages

**Cause:** `netlify.toml` is missing or `publish` directory is wrong.

**Fix:** Confirm `netlify.toml` exists in the project root and `publish = "."` is set. Trigger a new deploy from the Netlify dashboard.

---

## Quick Reference Checklist

Before going live, verify all of these:

- [ ] `netlify.toml` added to project root with `publish = "."` and redirect rule
- [ ] Firebase credentials in `assets/js/firebase-config.js` are real (not placeholders)
- [ ] Firebase Authentication → Google provider is **enabled**
- [ ] Project support email is set in Firebase Google provider settings
- [ ] Netlify domain (`*.netlify.app`) is in Firebase → Authorized domains
- [ ] Firestore security rules enforce per-user isolation (`request.auth.uid == userId`)
- [ ] Firebase API key HTTP referrer restriction includes the Netlify domain

---

*For general setup, data model reference, and local development instructions see the main [README](README.md).*
