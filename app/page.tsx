'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';

export default function HomePage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
      } else {
        router.replace('/login');
      }
      setCheckedAuth(true);
    });

    return () => unsubscribe();
  }, [router]);

  if (!checkedAuth) {
    return <p>Se verifică autentificarea...</p>; // sau loading
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div>
      <h1>Bun venit la Unitar Admin</h1>
      <p>Aceasta este pagina de start protejată.</p>
    </div>
  );
}
