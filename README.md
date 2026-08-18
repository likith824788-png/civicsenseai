# CivicSense AI

A civic issue reporting platform with AI-powered categorization, community upvoting, and authority dashboards.

## Quick Start

### Prerequisites
- Node.js 18+
- A Firebase project (Firestore + Auth + Storage)
- A Google Gemini API key

### 1. Firebase Setup
1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. **Authentication**: Enable Email/Password sign-in method
3. **Firestore Database**: Create a database (start in test mode for development)
4. **Storage**: Enable Firebase Storage
5. **Web App**: Register a web app in Project Settings → General → Add app (Web)
   - Copy the `firebaseConfig` object for the client `.env`
6. **Service Account**: Generate a key in Project Settings → Service Accounts → Generate New Private Key
   - Save as `server/serviceAccountKey.json`

### 2. Firestore Indexes
When you first filter by **category + sort by date** or **status + sort by date**, Firestore will prompt you to create composite indexes. Click the link in the browser console error to auto-create them, or create them manually:

| Collection | Fields | Order |
|------------|--------|-------|
| reports | `category` ASC, `created_at` DESC | Composite |
| reports | `status` ASC, `created_at` DESC | Composite |
| reports | `user_id` ASC, `created_at` DESC | Composite |
| reports | `category` ASC, `upvotes` DESC | Composite |

### 3. Environment Variables

**Client** (`client/.env`):
```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

**Server** (`server/.env`):
```
PORT=3001
GEMINI_API_KEY=your-gemini-api-key
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
```

### 4. Install & Run

```bash
# Terminal 1: Backend
cd server
npm install
npm run dev

# Terminal 2: Frontend
cd client
npm install
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3001/api/health

## Features
- 📸 **Report Issues** — Upload photos with auto-geolocation
- 🤖 **AI Categorization** — Gemini Vision classifies issues automatically
- 📢 **Community Feed** — Browse and upvote reports (real-time updates)
- 🗺️ **Authority Dashboard** — Map view, filters, status management
- 📊 **Severity Scoring** — Rule-based v1 (category + upvotes)

## Tech Stack
- **Frontend**: React (Vite) + Tailwind CSS v3
- **Backend**: Node.js + Express
- **Database**: Cloud Firestore (real-time NoSQL)
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage
- **Maps**: Leaflet + OpenStreetMap
- **AI**: Google Gemini Vision API
