'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebaseConfig';

export default function AdminPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
      } else {
        router.replace('/login'); // mai sigur decât push()
      }
      setCheckedAuth(true);
    });

    return () => unsubscribe();
  }, [router]);

  if (!checkedAuth) {
    return <p>Se verifică autentificarea...</p>; // sau loading spinner
  }

  if (!authenticated) {
    return null; // Nu afișăm nimic cât timp redirecționează
  }

  return (
    <div>
      <h1>Admin Panel</h1>
      <p>Bine ai venit în zona protejată!</p>
    </div>
  );
}
