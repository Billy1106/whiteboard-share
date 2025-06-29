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

  // セッション認証状態のキー
  const authKey = `session_auth_${sessionId}`;

  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true);
      setError(null);
      try {
        // セッションストレージから認証状態を復元
        const storedAuth = sessionStorage.getItem(authKey);
        const isStoredAuthenticated = storedAuth === 'true';

        const sessionRef = ref(db, `sessions/${sessionId}`);
        const snapshot = await get(sessionRef);
        if (snapshot.exists()) {
          const data = snapshot.val() as SessionData;
          setSession(data);
          
          if (!data.password) {
            // パスワードがない場合は認証済みとする
            setIsAuthenticated(true);
            sessionStorage.setItem(authKey, 'true');
          } else if (isStoredAuthenticated) {
            // 以前に認証済みの場合は状態を復元
            setIsAuthenticated(true);
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
  }, [sessionId, authKey]);

  const authenticate = async (inputPassword: string) => {
    if (!session?.password) {
      // パスワードが設定されていないセッションの場合
      setIsAuthenticated(true);
      sessionStorage.setItem(authKey, 'true');
      return true;
    }

    try {
      const match = await bcrypt.compare(inputPassword, session.password);
      if (match) {
        setIsAuthenticated(true);
        // 認証成功時にセッションストレージに保存
        sessionStorage.setItem(authKey, 'true');
        setError(null);
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

  // セッション認証状態をクリアする関数（必要に応じて使用）
  const clearAuth = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem(authKey);
  };

  return { session, loading, isAuthenticated, error, authenticate, clearAuth };
}
