<div align="center">

# 🗄️ DataDock

**A secure, personal data management dashboard — powered by Firebase.**

![Version](https://img.shields.io/badge/version-2.0-e52521?style=flat-square)
![Stack](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20Firebase-f7b731?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-00a800?style=flat-square)
![Deployment](https://img.shields.io/badge/deploy-GitHub%20Pages-5b8dd9?style=flat-square)

> Store and manage your contacts, teams, links, notes, to-dos, API keys, and calendar events — all in one private, authenticated workspace with real-time sync.

</div>

---

## Features

- Email/password signup and login
- Google OAuth login
- Per-user workspace in Firestore under `users/{uid}`
- Automatic workspace initialization for new users
- Dashboard with summary stats and recent items
- Full CRUD for contacts, teams, and links
- Dynamic team member management
- Search (global + section-level)
- Copy-to-clipboard actions (email, phone, links)
- JSON export and JSON import (merge behavior)
- Dark mode toggle with persistent preference
- Responsive sidebar layout (desktop + mobile)
- Real-time Firestore sync using `onSnapshot`
- Local cache fallback using `localStorage`
- Toast notifications and confirmation modals

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript (ES modules)
- Authentication: Firebase Authentication
- Database: Cloud Firestore
- Hosting: GitHub Pages

## Project Structure

```text
Data_Dock/
├── index.html          # Default landing page
├── auth.html           # Login / signup page
├── dashboard.html      # Main app dashboard
├── style.css           # Shared styling and responsive UI
├── firebase-config.js  # Firebase app/auth/db initialization
├── auth.js             # Auth logic for index page
├── storage.js          # Firestore data access and CRUD helpers
├── script.js           # Dashboard UI and interaction logic
├── SECURITY.md         # Security policy file
└── README.md           # Project documentation
```

## Data Model

Firestore collection/document layout:

```text
users/
  {uid}/
    contacts: [Contact]
    teams: [Team]
    links: [Link]
```

### Contact

```json
{
  "name": "Full Name",
  "email": "example@gmail.com",
  "phone": "9800000000",
  "github": "github.com/username",
  "linkedin": "linkedin.com/in/username",
  "role": "Developer",
  "notes": "Extra notes"
}
```

### Team

```json
{
  "teamName": "Team Alpha",
  "members": [
    {
      "name": "Sakshyam",
      "role": "Leader",
      "email": "example@gmail.com"
    }
  ],
  "notes": "Team project info"
}
```

### Link

```json
{
  "title": "GitHub",
  "url": "https://github.com/username",
  "notes": "Personal profile"
}
```

## Local Development

Because this project uses JavaScript modules, run it through a local server (do not open `index.html` or `auth.html` directly with `file://`).

### Option 1: VS Code Live Server

1. Install the Live Server extension.
2. Open `index.html` for landing, then click `Get Started` to open `auth.html`.
3. Click `Go Live`.

### Option 2: Python HTTP Server

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

## Firebase Setup

### 1. Create Firebase Project

1. Go to Firebase Console.
2. Create/select a project.
3. Add a Web App.
4. Copy the config values.

### 2. Configure `firebase-config.js`

Open `firebase-config.js` and verify these values are correct for your Firebase project:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

### 3. Enable Authentication Providers

In Firebase Console -> Authentication -> Sign-in method:

- Enable `Email/Password`
- Enable `Google`

### 4. Create Firestore Database

In Firebase Console -> Firestore Database:

- Create database
- Pick your region

### 5. Apply Firestore Security Rules

Use rules that isolate each user to only their own data:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## GitHub Pages Deployment

1. Push this project to a GitHub repository.
2. Go to repository `Settings` -> `Pages`.
3. Under `Build and deployment`, select:
   - Source: `Deploy from a branch`
   - Branch: `main` (or `master`), root folder
4. Save and wait for deployment.
5. Access your app at:

```text
https://<your-username>.github.io/<repository-name>/
```

If your repository name is `datadock`:

```text
https://<your-username>.github.io/datadock/
```

## Authentication Flow

- User signs up with email/password or Google OAuth.
- App checks whether `users/{uid}` exists.
- If missing, app creates an empty workspace:
  - `contacts: []`
  - `teams: []`
  - `links: []`
- Authenticated users are redirected to `dashboard.html`.
- Unauthenticated users are redirected to `auth.html`.

## CRUD and Real-Time Sync

`storage.js` centralizes Firestore operations:

- Load user data
- Add/update/delete contacts, teams, links
- Import/merge JSON data
- Reset all data to empty arrays
- Subscribe to live document updates with `onSnapshot`

`script.js` handles:

- Rendering all sections
- Modals and form submissions
- Search filtering
- Clipboard actions
- Export/import interactions

## JSON Import/Export

### Export

- Exports full workspace (`contacts`, `teams`, `links`) as formatted JSON.

### Import

- Validates imported JSON shape.
- Merges with existing data (does not replace whole workspace by default).

## Security Notes

- Firebase web config (`apiKey`, etc.) is not a secret for frontend apps.
- Security must be enforced by Firestore Rules and Authentication.
- Never commit Firebase Admin SDK service account keys.
- Restrict API key by referrer in Google Cloud Console when possible.
- Review and update `SECURITY.md` to match your maintenance policy.

## Browser Compatibility

Modern browsers are recommended:

- Chrome
- Edge
- Firefox
- Safari

Requirements:

- ES modules support
- Clipboard API support

## Troubleshooting

### Login works but data fails

- Check Firestore rules.
- Confirm `projectId` and Firebase config values.
- Verify Firestore database is created.

### Google login popup blocked

- Allow popups for your site.
- Ensure your domain is in Firebase Authentication authorized domains.

### Blank page / modules not loading

- Use a local server for development.
- Check browser console for module import errors.

### GitHub Pages path issues

- Confirm all script/style imports are relative (they are in this project).
- Verify repository name in final URL.

## Roadmap Ideas

- Type-to-confirm before "Delete All Data"
- Better duplicate detection during import
- Optional drag-and-drop ordering
- Optional PWA/offline enhancements

## License

Choose a license and add a `LICENSE` file (MIT is common for open-source projects).

## Acknowledgments

- Firebase for authentication and database services
- Font Awesome for iconography
- Google Fonts (Inter) for typography
