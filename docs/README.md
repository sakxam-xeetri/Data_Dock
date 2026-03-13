<div align="center">

# DataDock

**A secure personal data dashboard with a fun, playable landing experience.**

![Version](https://img.shields.io/badge/version-2.2-e52521?style=flat-square)
![Stack](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20Firebase-f7b731?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-00a800?style=flat-square)
![Deployment](https://img.shields.io/badge/deploy-Netlify%20%7C%20GitHub%20Pages-5b8dd9?style=flat-square)

> One authenticated workspace for contacts, teams, links, notes, todos, API keys, and calendar events with real-time sync.

</div>

---

## Screenshots

### Landing
![DataDock Landing](../assets/img/landing.png)

### Dashboard
![DataDock Dashboard](../assets/img/dashboard.png)

---

## Story: Why I Built This

As a team lead, I kept facing the same problem before every hackathon, client submission, or event registration.

I was repeatedly filling the same details again and again: member emails, phone numbers, GitHub links, project notes, deadlines, and credentials. Everything existed, but it was scattered across chats, old forms, sticky notes, and random files.

So I asked one question:

**What if I could get all my data at once, in one secure place, ready when pressure is high?**

DataDock is the answer to that question. It gives me one private command center where all important data is organized, searchable, and synced in real time.

I also wanted the product to feel memorable, not boring. That is why the landing page includes a playable retro game. It adds personality, makes onboarding enjoyable, and helps users discover the platform in a fun way.

---

## Features

### Authentication
- Email and password signup/login
- Google OAuth one-click login
- Per-user workspace isolation
- Protected routes for authenticated access only

### Data Modules
| Module | Description |
|---|---|
| Contacts | Name, email, phone, GitHub, LinkedIn, role, and notes |
| Teams | Team profiles with members, social links, and notes |
| Links | Personal link vault with quick copy |
| To-Do | Priority tasks with due dates and completion tracking |
| API Keys | Masked credential storage with reveal action |
| Notes | Rich notes with fullscreen editor and markdown preview |
| Calendar | Nepali BS calendar with event management |

### Dashboard Experience
- Summary cards with quick section navigation
- Global search across modules
- Quick actions for fast data entry
- Recent activity and mini-calendar widgets
- Responsive sidebar and mobile drawer

### Notes Editor
- Fullscreen writing mode
- Line numbers and cursor position
- Markdown preview toggle
- Unsaved changes guard
- Keyboard shortcuts: `Ctrl+S`, `Ctrl+B`, `Ctrl+I`, `Esc`, `Tab`

### Playable Landing Game
- Retro platformer embedded in the landing page (`index.html`)
- Works as an interactive product intro
- Designed for fun without blocking core app access

### Data Portability
- Export full workspace as JSON backup
- Import JSON with merge behavior
- Delete-all reset with confirmation

---

## Project Structure

```
Data_Dock/
├── index.html                 # Landing page with playable game
├── auth.html                  # Login/signup page
├── dashboard.html             # Main dashboard
├── netlify.toml               # Netlify deployment config
├── assets/
│   ├── css/
│   │   └── style.css          # Shared styling
│   ├── img/
│   └── js/
│       ├── auth.js            # Authentication logic
│       ├── storage.js         # Firestore CRUD and sync helpers
│       └── script.js          # Dashboard UI + interactions
└── docs/
    ├── README.md              # Project documentation
    ├── DEPLOY_NETLIFY.md      # Netlify deployment guide
    └── SECURITY.md            # Security policy
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES modules) |
| Authentication | Firebase Authentication (Email + Google OAuth) |
| Database | Cloud Firestore (real-time NoSQL) |
| Icons | Font Awesome |
| Fonts | IBM Plex Mono, Fira Code, Press Start 2P |
| Hosting | Netlify or GitHub Pages |

---

## Getting Started

### Prerequisites
- A Firebase project with Authentication and Firestore enabled
- A local HTTP server (ES modules do not work with `file://`)

### 1. Clone

```bash
git clone https://github.com/<your-username>/DataDock.git
cd DataDock
```

### 2. Configure Firebase

Create `assets/js/firebase-config.js` and add your Firebase project config:

```js
// assets/js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
```

Note: Firebase web API keys are public by design for frontend apps. Security must be enforced with Firebase Auth and Firestore Rules.

### 3. Enable Firebase Services

1. In Firebase Authentication, enable:
- Email/Password
- Google
2. In Firestore, create a database in production mode.

### 4. Apply Firestore Security Rules

```txt
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

### 5. Run Locally

Option A - VS Code Live Server
1. Install Live Server extension
2. Open `index.html` with Live Server

Option B - Python

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`

Option C - Node

```bash
npx serve .
```

---

## Deployment

### Netlify (Recommended)

Use the deployment guide in this folder:

**[DEPLOY_NETLIFY.md](DEPLOY_NETLIFY.md)**

### GitHub Pages

1. Push to GitHub
2. Go to Settings > Pages
3. Deploy from `main` branch root
4. App URL:

```txt
https://<your-username>.github.io/<repository-name>/
```

---

## Data Model

All user data is stored under:

```txt
users/{uid}
```

Collections inside the user document:
- contacts
- teams
- links
- todos
- apikeys
- notes
- calendarEvents

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl + K | Open command palette |
| Ctrl + N | Open quick-add menu |
| Ctrl + S | Save note |
| Ctrl + B | Bold in note editor |
| Ctrl + I | Italic in note editor |
| Esc | Close editor/modal |
| Tab | Insert indent in note editor |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Blank page or module import errors | Run through HTTP server, not `file://` |
| Login works but no data loads | Verify Firestore Rules and Firebase project ID |
| Google login popup blocked | Allow popups and verify authorized domains |
| GitHub Pages 404 | Ensure asset paths are relative |
| Import fails | Validate JSON structure |
| Auth redirect loop | Clear localStorage/cookies and retry |

---

## Security

- Firestore rules enforce per-user data isolation
- No server-side admin credentials are used in the repo
- User input is sanitized/escaped before rendering
- API key values are masked in UI by default
- See **[SECURITY.md](SECURITY.md)** for vulnerability reporting

---

## Roadmap

- Type-to-confirm for delete-all
- Duplicate detection during import
- Drag-and-drop ordering
- PWA offline support
- Light/dark theme toggle
- Advanced tags and filters

---

## License

Licensed under the MIT License.

---

## Acknowledgments

- Firebase
- Font Awesome
- Google Fonts
- Netlify and GitHub Pages

---

<div align="center">

Built with focus, pressure, and a lot of late nights.

**[index.html](../index.html) · [auth.html](../auth.html) · [dashboard.html](../dashboard.html)**

</div>
