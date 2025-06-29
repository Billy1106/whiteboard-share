import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { signInAnonymouslyFirebase, onAuthStateChangedFirebase } from '@/lib/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChangedFirebase(async (firebaseUser) => {
      if (!firebaseUser) {
        // 匿名ログインを試みる
        const anonymousUser = await signInAnonymouslyFirebase();
        setUser(anonymousUser);
      } else {
        setUser(firebaseUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
