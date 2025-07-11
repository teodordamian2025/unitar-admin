'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';

export default function AdminPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [displayName, setDisplayName] = useState<string>('Utilizator');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);

        // Citire displayName din localStorage
        const storedName = localStorage.getItem('displayName');
        setDisplayName(storedName || user.displayName || user.email || 'Utilizator');
      } else {
        router.replace('/login');
      }
      setCheckedAuth(true);
    });

    return () => unsubscribe();
  }, [router]);

  if (!checkedAuth) {
    return <p>Se verifică autentificarea...</p>;
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Admin Panel</h1>
      <p>Bine ai venit în zona protejată!</p>
      <p style={{ marginTop: '1rem' }}>
        Te-ai autentificat ca <strong>{displayName}</strong>.
      </p>
    </div>
  );
}
