'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export default function SessionCreate() {
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleCreateSession = async () => {
    const sessionId = uuidv4();
    let hashedPassword = null;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    await set(ref(db, `sessions/${sessionId}`), {
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    });

    router.push(`/board/${sessionId}`);
  };

  return (
    <div className="flex flex-col items-center">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="パスワード (任意)"
        className="p-2 border rounded mb-4"
      />
      <button
        onClick={handleCreateSession}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        新しいセッションを作成
      </button>
    </div>
  );
}
