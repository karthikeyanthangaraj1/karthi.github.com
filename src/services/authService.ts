import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import type { UserSettings } from '../types';

export const defaultCategories = [
  'Food',
  'Salary',
  'Rent',
  'Transport',
  'Shopping',
  'Health',
  'Utilities',
  'Entertainment',
  'Transfer'
];

export const defaultSettings: UserSettings = {
  currency: 'INR',
  monthStartDay: 1,
  theme: 'light',
  categories: defaultCategories,
  subcategoriesEnabled: true
};

async function ensureUserDocument(user: User) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      profile: {
        displayName: user.displayName || 'Money Manager',
        email: user.email || '',
        photoURL: user.photoURL || ''
      },
      settings: defaultSettings,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

export function listenToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
    if (user) {
      ensureUserDocument(user).catch((error) => {
        console.error('Could not initialize user profile:', error);
      });
    }
  });
}

export async function signUp(email: string, password: string, displayName: string) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  await ensureUserDocument(result.user);
}

export async function signIn(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signInGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserDocument(result.user);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await signOut(auth);
}
