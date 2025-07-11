'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';

export default function AdminPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<{ displayName?: string; role?: string }>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
        const savedProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        setProfile({
          displayName: savedProfile.displayName || user.displayName || user.email,
          role: savedProfile.role || '',
        });
        setCheckedAuth(true);
      } else {
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (!checkedAuth) return <p>Se verifică autentificarea...</p>;
  if (!authenticated) return null;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Bun venit la Unitar Admin</h1>
      <p>Aceasta este pagina de start protejată.</p>
      <p style={{ marginTop: '1rem' }}>
        Te-ai autentificat ca <strong>{profile.displayName}</strong> ({profile.role})
      </p>
    </div>
  );
}
