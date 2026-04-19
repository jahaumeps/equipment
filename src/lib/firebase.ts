import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Ensure it's a MEPS institution account
googleProvider.setCustomParameters({
  hd: 'tc.meps.tp.edu.tw'
});

export const signIn = () => signInWithPopup(auth, googleProvider);
export const logOut = () => signOut(auth);

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'admin' | 'teacher';
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { uid, ...docSnap.data() } as UserProfile;
  }
  return null;
};

export const registerUser = async (user: any): Promise<UserProfile> => {
  // Special case: bootstrap the user who requested the app as admin
  const isBootstrapAdmin = user.email === 'jahaulin@tc.meps.tp.edu.tw';
  
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    role: isBootstrapAdmin ? 'admin' : 'teacher',
  };
  await setDoc(doc(db, 'users', user.uid), {
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role
  });
  return profile;
};
