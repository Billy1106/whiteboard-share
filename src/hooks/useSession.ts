import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import bcrypt from 'bcryptjs';

interface SessionData {
  password?: string;
  createdAt: string;
}

export function useSession(sessionId: string) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true);
      setError(null);
      try {
        const sessionRef = ref(db, `sessions/${sessionId}`);
        const snapshot = await get(sessionRef);
        if (snapshot.exists()) {
          const data = snapshot.val() as SessionData;
          setSession(data);
          if (!data.password) {
            setIsAuthenticated(true); // パスワードがない場合は認証済みとする
          }
        } else {
          setError('セッションが見つかりません。');
        }
      } catch (err) {
        console.error("Error fetching session:", err);
        setError('セッションの取得中にエラーが発生しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  const authenticate = async (inputPassword: string) => {
    if (!session?.password) {
      // パスワードが設定されていないセッションの場合
      setIsAuthenticated(true);
      return true;
    }

    try {
      const match = await bcrypt.compare(inputPassword, session.password);
      if (match) {
        setIsAuthenticated(true);
        return true;
      } else {
        setError('パスワードが間違っています。');
        return false;
      }
    } catch (err) {
      console.error("Error comparing password:", err);
      setError('パスワード認証中にエラーが発生しました。');
      return false;
    }
  };

  return { session, loading, isAuthenticated, error, authenticate };
}
