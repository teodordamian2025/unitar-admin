'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import dynamic from 'next/dynamic';

const Chatbot = dynamic(() => import('@/components/Chatbot'), { ssr: false });

export default function AdminPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const storedName = localStorage.getItem('displayName');
    if (storedName) setDisplayName(storedName);
  }, []);

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }

    // Verifică rolul utilizatorului
    checkUserRole();
  }, [user, loading, router]);

  const checkUserRole = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/user-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email })
      });

      const data = await response.json();
      
      if (data.success) {
        setUserRole(data.role);
        
        // Dacă nu este admin, redirecționează către pagina principală
        if (data.role !== 'admin') {
          toast.error('Nu ai permisiunea să accesezi zona de administrare!');
          setTimeout(() => router.push('/'), 2000);
          return;
        }
        
        setIsAuthorized(true);
      } else {
        toast.error('Eroare la verificarea permisiunilor!');
        setTimeout(() => router.push('/'), 2000);
      }
    } catch (error) {
      console.error('Eroare la verificarea rolului:', error);
      toast.error('Eroare de conectare!');
      setTimeout(() => router.push('/'), 2000);
    }
  };

  const handleLogout = async () => {
    const confirmLogout = confirm('Sigur vrei să te deloghezi?');
    if (!confirmLogout) return;

    await signOut(auth);
    toast.success('Te-ai delogat cu succes!');
    setTimeout(() => router.replace('/login'), 1000);
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Se încarcă...</div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Redirecting to login...</div>
      </div>
    );
  }

  // Not authorized (not admin)
  if (!isAuthorized) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <ToastContainer />
        <div>Verificare permisiuni...</div>
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          Dacă nu ai permisiuni de admin, vei fi redirecționat în curând.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <ToastContainer />
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem',
        padding: '1rem',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <div>
          <h1>Bun venit la UNITAR PROIECT TDA - Admin</h1>
          <p>Aceasta este pagina de administrare cu acces complet!</p>
          <p style={{ marginTop: '0.5rem' }}>
            Te-ai autentificat ca <strong>{displayName}</strong> cu rol <strong>{userRole}</strong>.
          </p>
        </div>
        
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#c0392b',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ 
        background: '#d4edda',
        color: '#155724',
        padding: '1rem',
        borderRadius: '8px',
        border: '1px solid #c3e6cb',
        marginBottom: '2rem'
      }}>
        <h3>🔓 Acces Administrator</h3>
        <p>Ai acces complet la:</p>
        <ul>
          <li>Toate informațiile din baza de date</li>
          <li>Funcții financiare (facturi, tranzacții, bugete)</li>
          <li>Gestionarea proiectelor și contractelor</li>
          <li>Rapoarte complete</li>
          <li>Administrarea utilizatorilor</li>
        </ul>
      </div>

      <Chatbot />
    </div>
  );
}

