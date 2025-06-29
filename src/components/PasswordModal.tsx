'use client';

import { useState } from 'react';

interface PasswordModalProps {
  onAuthenticate: (password: string) => Promise<boolean>;
  error: string | null;
}

export default function PasswordModal({ onAuthenticate, error }: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSubmit = async () => {
    setIsAuthenticating(true);
    await onAuthenticate(password);
    setIsAuthenticating(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">セッションに参加</h2>
        <p className="mb-4">このセッションはパスワードで保護されています。</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワードを入力"
          className="p-2 border rounded w-full mb-4"
          disabled={isAuthenticating}
        />
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 w-full"
          disabled={isAuthenticating}
        >
          {isAuthenticating ? '認証中...' : '認証'}
        </button>
      </div>
    </div>
  );
}
