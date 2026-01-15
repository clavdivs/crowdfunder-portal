# Firebase Setup Guide

Step-by-step instructions to set up Firebase for the Crowdfunder Portal.

---

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project**
3. Enter project name: `crowdfunder-portal` (or your preferred name)
4. **Disable** Google Analytics (not needed for MVP)
5. Click **Create project**

---

## 2. Register Web App

1. In your project, click the **web icon** `</>` (Add app)
2. App nickname: `crowdfunder-web`
3. Check **Also set up Firebase Hosting**
4. Click **Register app**
5. Copy the `firebaseConfig` object - you'll need these values:

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

---

## 3. Enable Authentication

1. Go to **Build → Authentication** in the sidebar
2. Click **Get started**
3. Go to **Sign-in method** tab
4. Enable **Email/Password**:
   - Click Email/Password
   - Toggle **Enable** to ON
   - Toggle **Email link (passwordless sign-in)** to ON
   - Click **Save**

### Configure Email Link Settings

1. Still in Authentication, go to **Settings** tab
2. Click **Authorized domains**
3. Add your development domain: `localhost`
4. (Later) Add your production domain

### Action URL Settings (for magic links)

1. Go to **Templates** tab
2. Click **Edit template** on any template
3. Note the **Action URL** - this is where users land after clicking magic link
4. You may need to customize this later to point to your app's `/investor/verify` route

---

## 4. Set Up Firestore Database

1. Go to **Build → Firestore Database** in the sidebar
2. Click **Create database**
3. Select **Start in test mode** (we'll add proper rules later)
4. Choose a location closest to your users (e.g., `europe-west2` for UK)
5. Click **Enable**

### Create Indexes (do this after app is running)

Firestore will auto-prompt you to create indexes when queries need them. For now, note these will be needed:

| Collection | Fields | Order |
|------------|--------|-------|
| `rounds` | `companyId`, `createdAt` | Ascending |
| `financingEvents` | `companyId`, `eventDate` | Ascending |
| `allocations` (subcollection) | `investorEmail` | - |
| `investments` (subcollection) | `investorEmail` | - |

---

## 5. Generate Admin SDK Credentials

1. Go to **Project Settings** (gear icon) → **Service accounts**
2. Click **Generate new private key**
3. Click **Generate key** - this downloads a JSON file
4. Open the JSON file and extract these values:
   - `project_id`
   - `client_email`
   - `private_key`

**Keep this file secure - never commit it to git!**

---

## 6. Create Environment File

Create `.env.local` in your project root:

```bash
# Firebase Client SDK (public)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Firebase Admin SDK (server-side - keep secret!)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----\n"
```

**Important for `FIREBASE_ADMIN_PRIVATE_KEY`:**
- Keep the quotes around the entire value
- Keep all the `\n` characters as-is
- Copy the entire key from the JSON file including `-----BEGIN...` and `-----END...`

---

## 7. Set Up Firebase CLI (for deployment)

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (run from project root)
firebase init
```

When running `firebase init`, select:
- **Firestore** (for rules and indexes deployment)
- **Functions** (for Cloud Functions)
- **Hosting** (for Next.js deployment)

Configuration choices:
- Firestore Rules file: `firestore.rules`
- Firestore Indexes file: `firestore.indexes.json`
- Functions language: **TypeScript**
- Hosting public directory: `out` (or configure for Next.js)
- Single-page app: **No** (Next.js handles routing)

---

## 8. Create Admin User

After the app is running, you'll need to create the admin account:

1. Go to **Authentication → Users** in Firebase Console
2. Click **Add user**
3. Enter your admin email and a strong password
4. Note the **User UID**

Then in Firestore, create the admin record:
1. Go to **Firestore Database**
2. Start a collection called `admins`
3. Add a document with:
   - Document ID: the User UID from above
   - Fields:
     - `email`: your admin email
     - `role`: `"admin"`
     - `createdAt`: (timestamp)

---

## 9. Test Mode Security Warning

The app starts in Firestore **test mode** which allows all reads/writes. Before going live:

1. Update `firestore.rules` with proper security rules
2. Deploy rules: `firebase deploy --only firestore:rules`

The app will include production-ready security rules.

---

## Checklist

- [ ] Firebase project created
- [ ] Web app registered
- [ ] Email/Password auth enabled
- [ ] Email link (passwordless) auth enabled
- [ ] Firestore database created
- [ ] Service account key generated
- [ ] `.env.local` file created with all values
- [ ] Firebase CLI installed and logged in
- [ ] Admin user created in Authentication
- [ ] Admin record created in Firestore

---

## Troubleshooting

### "Firebase App not initialized"
- Check all `NEXT_PUBLIC_*` values are set correctly
- Restart the dev server after changing `.env.local`

### Magic link emails not sending
- Verify Email link sign-in is enabled in Authentication settings
- Check spam folder
- Ensure `localhost` is in authorized domains

### "Permission denied" errors
- Check Firestore is in test mode, or rules are correctly configured
- Verify admin credentials are correct in `.env.local`

### Private key errors
- Ensure the private key is wrapped in quotes
- Keep all `\n` characters - don't convert to actual newlines
