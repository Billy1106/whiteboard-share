'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/hooks/useSession';
import Whiteboard from '@/components/Whiteboard';
import ParticipantsList from '@/components/ParticipantsList';
import PasswordModal from '@/components/PasswordModal';

export default function BoardPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const { user, loading: authLoading } = useAuth();
  const { session, loading: sessionLoading, isAuthenticated, error, authenticate } = useSession(sessionId);

  if (authLoading || sessionLoading) {
    return <div className="flex justify-center items-center min-h-screen">読み込み中...</div>;
  }

  if (error && error !== 'セッションが見つかりません。') {
    return <div className="flex justify-center items-center min-h-screen text-red-500">エラー: {error}</div>;
  }

  if (!session) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">セッションが見つかりません。</div>;
  }

  if (!isAuthenticated) {
    return <PasswordModal onAuthenticate={authenticate} error={error} />;
  }

  if (!user) {
    return <div className="flex justify-center items-center min-h-screen">認証エラーが発生しました。</div>;
  }

  return (
    <div className="flex flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-8">ホワイトボード: {sessionId}</h1>
      <Whiteboard sessionId={sessionId} userId={user.uid} />
      <ParticipantsList sessionId={sessionId} currentUserUid={user.uid} />
    </div>
  );
}
