'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setAuthenticated(true);
        setUser(firebaseUser);
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

  const success = searchParams.get('success');

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Admin Panel</h1>
      <p>Bine ai venit în zona protejată!</p>

      {user && (
        <p>
          Te-ai autentificat ca <strong>{user.displayName || user.email}</strong>.
        </p>
      )}

      {success === '1' && (
        <p style={{ color: 'green', marginTop: '1rem' }}>
          Profil salvat cu succes!
        </p>
      )}
    </div>
  );
}
