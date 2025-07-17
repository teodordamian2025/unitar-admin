'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import dynamic from 'next/dynamic';

const Chatbot = dynamic(() => import('@/components/Chatbot'), { ssr: false });

export default function AdminPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('Utilizator');

  useEffect(() => {
    const storedName = localStorage.getItem('displayName');
    if (storedName) setDisplayName(storedName);
  }, []);

  const handleLogout = async () => {
    const confirmLogout = confirm('Sigur vrei să te deloghezi?');
    if (!confirmLogout) return;

    await signOut(auth);
    toast.success('Te-ai delogat cu succes!');
    setTimeout(() => router.replace('/login'), 1000);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <ToastContainer />
      <h1>Bun venit la UNITAR PROIECT TDA -Admin</h1>
      <p>Aceasta este pagina de start!.</p>
      <p style={{ marginTop: '0.5rem' }}>
        Te-ai autentificat ca <strong>{displayName}</strong>.
      </p>
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

      <Chatbot />
    </div>
  );
}
