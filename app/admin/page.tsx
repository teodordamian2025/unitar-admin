'use client';

import React from 'react';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import auth from '../../lib/firebaseConfig';

export default function AdminPage() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Bun venit în zona de administrare!</h1>
      <button onClick={handleLogout} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
        Logout
      </button>
    </div>
  );
}
