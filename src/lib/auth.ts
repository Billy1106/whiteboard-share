import { auth } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';

export const signInAnonymouslyFirebase = async (): Promise<User | null> => {
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error: any) {
    console.error("Error signing in anonymously:", error.code, error.message);
    return null;
  }
};

export const onAuthStateChangedFirebase = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
