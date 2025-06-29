'use client';

import { useEffect, useState } from 'react';
import { ref, onValue, off, set, remove, onDisconnect } from 'firebase/database';
import { db } from '@/lib/firebase';

interface Participant {
  uid: string;
  displayName: string;
  lastSeen: number;
}

interface ParticipantsListProps {
  sessionId: string;
  currentUserUid: string;
}

export default function ParticipantsList({ sessionId, currentUserUid }: ParticipantsListProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    const participantsRef = ref(db, `participants/${sessionId}`);
    const currentUserRef = ref(db, `participants/${sessionId}/${currentUserUid}`);

    // 現在のユーザーの存在をリアルタイムで更新
    set(currentUserRef, { uid: currentUserUid, displayName: `User-${currentUserUid.substring(0, 4)}`, lastSeen: Date.now() });
    onDisconnect(currentUserRef).remove(); // 接続が切れたら削除

    const handleValueChange = onValue(participantsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedParticipants: Participant[] = Object.keys(data).map((key) => data[key]);
        setParticipants(loadedParticipants);
      } else {
        setParticipants([]);
      }
    });

    return () => {
      off(participantsRef, 'value', handleValueChange);
      remove(currentUserRef); // コンポーネントアンマウント時に削除
    };
  }, [sessionId, currentUserUid]);

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">参加者</h2>
      <ul>
        {participants.map((p) => (
          <li key={p.uid} className="mb-2">
            {p.displayName} {p.uid === currentUserUid && '(あなた)'}
          </li>
        ))}
      </ul>
    </div>
  );
}
