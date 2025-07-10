'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function HomePage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('onAuthStateChanged triggered:', firebaseUser);
      if (firebaseUser) {
        setAuthenticated(true);
        setUser(firebaseUser);
        const nameOrEmail = firebaseUser.displayName || firebaseUser.email || 'Utilizator';
        toast.success(`Bine ai revenit, ${nameOrEmail}!`);
      } else {
        console.log('User is not authenticated. Redirecting to /login...');
        router.replace('/login');
      }
      setCheckedAuth(true);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    const confirmLogout = confirm('Sigur vrei să te deloghezi?');
    if (!confirmLogout) return;

    await signOut(auth);
    toast.success('Te-ai delogat cu succes!');
    setTimeout(() => router.replace('/login'), 1500);
  };

  if (!checkedAuth) return <p>Se verifică autentificarea...</p>;
  if (!authenticated) return null;

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <ToastContainer />
      <h1>Bun venit la Unitar Admin</h1>
      <p>Aceasta este pagina de start protejată.</p>

      {user && (
        <p style={{ marginTop: '0.5rem' }}>
          Te-ai autentificat ca <strong>{user.displayName || user.email}</strong>.
        </p>
      )}

      {/* Buton Profil */}
      <button
        onClick={() => router.push('/profil')}
        style={{
          marginTop: '1.5rem',
          marginRight: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#2980b9',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Profil
      </button>

      {/* Buton Logout */}
      <button
        onClick={handleLogout}
        style={{
          marginTop: '1.5rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#c0392b',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Logout
      </button>
    </div>
  );
}
