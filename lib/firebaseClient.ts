import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// Client-only config (safe to expose — Firebase's security comes from
// Firebase Auth + backend checks, not from hiding these values). Reuses the
// existing "phool-gobhi" Firebase project already used for mobile push.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy on purpose: getAuth() validates the config immediately, which would
// throw during the server-side prerender of this ('use client') page — the
// env vars are only meant to be read in the browser, so init is deferred
// until a user actually clicks the button.
function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

// Returns a Firebase ID token for the signed-in Google account. The backend
// re-verifies this token itself and only accepts it for an email that
// already has a gobhi-role account — signing in with Google never grants
// staff access on its own.
export async function signInWithGoogle(): Promise<string> {
  const auth = getAuth(getFirebaseApp());
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user.getIdToken();
}
